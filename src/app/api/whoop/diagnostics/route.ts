import { NextRequest, NextResponse } from "next/server";
import { syncWhoopDashboardData } from "@/lib/convex/whoop-sync";
import { getRecentWhoopData } from "@/lib/whoop/client";
import { getConfigStatus } from "@/lib/whoop/config";
import {
  refreshWhoopTokens,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import {
  clearWhoopCookies,
  getWhoopSession,
  isSessionExpiring,
  setWhoopSessionCookie,
} from "@/lib/whoop/session";

export const dynamic = "force-dynamic";

function parseRange(value: string | null) {
  const range = Number(value);
  return [7, 30, 90].includes(range) ? range : 30;
}

function resourceSummary<T extends { records?: unknown[] }>(
  resource: { data: T | null; error: string | null; status?: number },
) {
  return {
    status: resource.status ?? "ok",
    records: resource.data?.records?.length ?? 0,
    error: resource.error,
  };
}

function hasConvexUrl() {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL);
}

export async function GET(request: NextRequest) {
  const config = getConfigStatus(request);
  let session = await getWhoopSession();

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        reason: "not_connected",
        config: {
          whoopReady: config.isReady,
          missing: config.missing,
          convexUrlConfigured: hasConvexUrl(),
        },
        session: { hasSession: false },
      },
      { status: 401 },
    );
  }

  let refreshedSession = false;

  if (isSessionExpiring(session)) {
    if (!session.refreshToken) {
      const response = NextResponse.json(
        {
          ok: false,
          reason: "session_expired_no_refresh_token",
          session: {
            hasSession: true,
            userId: session.userId,
            expiresAt: new Date(session.expiresAt).toISOString(),
            hasRefreshToken: false,
          },
        },
        { status: 401 },
      );
      clearWhoopCookies(response);
      return response;
    }

    try {
      const token = await refreshWhoopTokens(session.refreshToken);
      session = tokenResponseToSession(token, session);
      refreshedSession = true;
    } catch (error) {
      console.error("[whoop-diagnostics:refresh_failed]", {
        userId: session.userId,
        error: error instanceof Error ? error.message : "Unknown refresh failure.",
      });

      const response = NextResponse.json(
        { ok: false, reason: "refresh_failed" },
        { status: 401 },
      );
      clearWhoopCookies(response);
      return response;
    }
  }

  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const data = await getRecentWhoopData(session.accessToken, range);
  const syncResult = await syncWhoopDashboardData(data, session);
  const response = NextResponse.json({
    ok: syncResult.ok,
    config: {
      whoopReady: config.isReady,
      missing: config.missing,
      convexUrlConfigured: hasConvexUrl(),
    },
    session: {
      hasSession: true,
      userId: data.profile.data?.user_id ?? session.userId,
      expiresAt: new Date(session.expiresAt).toISOString(),
      expiresInMs: session.expiresAt - Date.now(),
      hasRefreshToken: Boolean(session.refreshToken),
      refreshed: refreshedSession,
      scope: session.scope,
    },
    whoopFetch: {
      rangeDays: data.rangeDays,
      start: data.start,
      end: data.end,
      fetchedAt: data.fetchedAt,
      profile: {
        status: data.profile.status ?? "ok",
        found: Boolean(data.profile.data),
        error: data.profile.error,
      },
      body: {
        status: data.body.status ?? "ok",
        found: Boolean(data.body.data),
        error: data.body.error,
      },
      cycles: resourceSummary(data.cycles),
      recoveries: resourceSummary(data.recoveries),
      sleeps: resourceSummary(data.sleeps),
      workouts: resourceSummary(data.workouts),
    },
    convexSync: syncResult,
  });

  if (refreshedSession) {
    setWhoopSessionCookie(response, session);
  }

  return response;
}
