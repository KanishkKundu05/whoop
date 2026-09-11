import { NextRequest, NextResponse } from "next/server";
import {
  getDailySmsConfigStatus, getDailySmsSubscriptionStatus,
  saveDailySmsSubscription, setDailySmsSubscriptionEnabled,
} from "@/lib/messages/daily-subscriptions";
import { normalizeE164Phone, phoneLast4 } from "@/lib/messages/daily-whoop";
import { getWhoopProfile } from "@/lib/whoop/client";
import { refreshWhoopTokens, tokenResponseToSession } from "@/lib/whoop/oauth";
import {
  clearWhoopCookies, getWhoopSession, isSessionExpiring, setWhoopSessionCookie,
} from "@/lib/whoop/session";
import type { WhoopSession } from "@/lib/whoop/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});
const errorResponse = (error: string, status = 400) => json({ ok: false, error }, status);

async function withSession(action: (session: WhoopSession) => Promise<NextResponse>) {
  let session = await getWhoopSession();
  if (!session) return json({ ok: false, connected: false, error: "Connect WHOOP to continue." }, 401);
  let refreshed = false;
  if (isSessionExpiring(session, 5 * 60_000)) {
    try {
      if (!session.refreshToken) throw new Error("Missing refresh token");
      session = tokenResponseToSession(await refreshWhoopTokens(session.refreshToken), session);
      refreshed = true;
    } catch {
      const response = json({ ok: false, connected: false, error: "Your WHOOP connection expired. Reconnect to continue." }, 401);
      clearWhoopCookies(response);
      return response;
    }
  }
  let response: NextResponse;
  try {
    if (!session.userId) {
      const profile = await getWhoopProfile(session.accessToken);
      session = { ...session, userId: profile.user_id };
      refreshed = true;
    }
    response = await action(session);
  } catch {
    response = errorResponse("We couldn’t access your messaging settings. Please try again. If this continues, check the app’s storage configuration.", 503);
  }
  // A failed save must still persist rotated credentials so retry can succeed.
  if (refreshed) setWhoopSessionCookie(response, session);
  return response;
}

export async function GET() {
  return withSession(async (session) => {
    const config = getDailySmsConfigStatus();
    const subscription = config.missing.includes("NEXT_PUBLIC_CONVEX_URL")
      ? null : await getDailySmsSubscriptionStatus(session.userId!);
    return json({ ok: true, connected: true, hasOfflineAccess: !!session.refreshToken, config, subscription });
  });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return errorResponse("Save your recipient from this app.", 403);
  let recipientPhone: string;
  try {
    const body = await request.json();
    if (typeof body?.recipientPhone !== "string") return errorResponse("Enter a recipient phone number.");
    recipientPhone = normalizeE164Phone(body.recipientPhone);
  } catch (error) {
    return errorResponse(error instanceof Error && !(error instanceof SyntaxError) ? error.message : "Enter a valid recipient phone number.");
  }
  return withSession(async (session) => {
    const config = getDailySmsConfigStatus();
    if (!config.isReady) return json({ ok: false, error: "Message delivery needs configuration before you can continue.", config }, 503);
    if (!session.refreshToken) return errorResponse("Reconnect WHOOP and allow offline access to enable automatic messages.", 409);
    await saveDailySmsSubscription({
      session, whoopUserId: session.userId!, recipientPhone,
      recipientPhoneLast4: phoneLast4(recipientPhone),
    });
    return json({ ok: true, subscription: { active: true, recipientPhoneLast4: phoneLast4(recipientPhone) } });
  });
}

export async function DELETE(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return errorResponse("Manage your messages from this app.", 403);
  return withSession(async (session) => {
    const disabled = await setDailySmsSubscriptionEnabled(session.userId!, false);
    return json({ ok: true, disabled });
  });
}
