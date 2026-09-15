import { NextRequest, NextResponse } from "next/server";
import { getConfigStatus } from "@/lib/whoop/config";
import { getWhoopSession, isSessionExpiring, setWhoopSessionCookie } from "@/lib/whoop/session";
import { fetchWhoop, getWhoopProfile, WhoopApiError } from "@/lib/whoop/client";
import { readWebhookTest, setupStorageMissing, startWebhookTest } from "@/lib/whoop/setup";
import type { PaginatedWhoopResponse, Sleep } from "@/lib/whoop/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: NextRequest) {
  const config = getConfigStatus(request);
  let callbackMatchesOrigin = false;
  try { callbackMatchesOrigin = new URL(config.redirectUri).origin === request.nextUrl.origin; } catch { /* Invalid configuration is shown in the dashboard. */ }
  const session = await getWhoopSession();
  const storageMissing = setupStorageMissing();
  let webhook = null;
  let storageError: string | null = null;
  if (session?.userId && !storageMissing.length) {
    try { webhook = await readWebhookTest(session.userId); }
    catch { storageError = "Cannot read webhook tests. Deploy the Convex functions and set the same WHOOP_SETUP_SECRET in Next.js and Convex."; }
  }
  return json({
    config, storageMissing, storageError, webhook, callbackMatchesOrigin,
    expectedRedirectUri: `${request.nextUrl.origin}/api/auth/whoop/callback`,
    webhookUrl: `${request.nextUrl.origin}/api/whoop/setup/webhook`,
    session: session ? {
      userId: session.userId, expiresAt: session.expiresAt,
      expired: isSessionExpiring(session), hasRefreshToken: !!session.refreshToken,
      scopes: session.scope.split(" "),
    } : null,
  });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "Use this dashboard to run the test." }, 403);
  const session = await getWhoopSession();
  if (!session || isSessionExpiring(session)) return json({ error: "Connect WHOOP again to get a fresh session." }, 401);
  let action;
  try { action = (await request.json()).action; }
  catch { return json({ error: "Invalid request." }, 400); }
  if (action === "webhook") {
    if (!session.userId) return json({ error: "Run the API test first to identify your WHOOP account." }, 409);
    try { return json({ webhook: await startWebhookTest(session.userId) }); }
    catch { return json({ error: "Cannot start webhook test. Deploy Convex functions and configure matching WHOOP_SETUP_SECRET values." }, 503); }
  }
  if (action !== "api") return json({ error: "Unknown test." }, 400);

  // Read-only, bounded calls. No dashboard sync or background token refresh.
  // A fresh consent flow avoids rotating the existing daily sender's token copy.
  try {
    const profile = await getWhoopProfile(session.accessToken);
    const sleeps = await fetchWhoop<PaginatedWhoopResponse<Sleep>>(
      session.accessToken, "/v2/activity/sleep", { limit: 5 },
    );
    // A successful HTTP response alone does not prove that sleep data was read.
    // Do not silently turn a missing or malformed records field into zero sleeps.
    if (!sleeps || !Array.isArray(sleeps.records)) {
      return json({
        ok: false, reason: "invalid_sleep_response",
        error: "WHOOP returned an unexpected sleep response (records is not an array). Sleep data could not be verified.",
        userId: profile.user_id,
        responseKeys: sleeps && typeof sleeps === "object" ? Object.keys(sleeps) : [],
      }, 502);
    }
    const latest = sleeps.records.find(sleep => !sleep.nap);
    const hasSleeps = sleeps.records.length > 0;
    const response = json({
      ok: hasSleeps, reason: hasSleeps ? "sleep_records_found" : "empty_sleep_collection",
      testedAt: Date.now(), userId: profile.user_id,
      name: profile.first_name, sleepCount: sleeps.records.length,
      diagnostics: {
        endpoint: "/v2/activity/sleep", limit: 5,
        dateFilter: "No start filter; WHOOP defaults end to now",
        recordsIsArray: true, hasMorePages: Boolean(sleeps.next_token),
        sessionScopes: session.scope.split(/\s+/).filter(Boolean),
      },
      latest: latest ? {
        id: latest.id, end: latest.end, scoreState: latest.score_state,
        performance: latest.score?.sleep_performance_percentage,
        efficiency: latest.score?.sleep_efficiency_percentage,
      } : null,
    });
    setWhoopSessionCookie(response, { ...session, userId: profile.user_id });
    return response;
  } catch (error) {
    const status = error instanceof WhoopApiError ? error.status : 502;
    const explanation = status === 401 ? "Session rejected. Reconnect WHOOP and try again."
      : status === 403 ? "Access denied. Reconnect and allow profile and sleep access."
      : status === 429 ? "WHOOP rate limit reached. Wait a minute and retry."
      : "WHOOP could not complete the test. Try again shortly.";
    return json({ error: explanation, providerStatus: status }, status >= 400 && status < 600 ? status : 502);
  }
}
