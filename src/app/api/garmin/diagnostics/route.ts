import { NextRequest, NextResponse } from "next/server";
import { getGarminProfile } from "@/lib/garmin/client";
import { getGarminConfigStatus } from "@/lib/garmin/config";
import {
  garminTokenResponseToSession,
  refreshGarminTokens,
} from "@/lib/garmin/oauth";
import {
  clearGarminCookies,
  getGarminSession,
  isGarminSessionExpiring,
  setGarminSessionCookie,
} from "@/lib/garmin/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = getGarminConfigStatus(request);
  let session = await getGarminSession();

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        reason: "not_connected",
        config: {
          garminReady: config.isReady,
          missing: config.missing,
          redirectUri: config.redirectUri,
        },
        session: { hasSession: false },
      },
      { status: 401 },
    );
  }

  let refreshedSession = false;

  if (isGarminSessionExpiring(session)) {
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
      clearGarminCookies(response);
      return response;
    }

    try {
      const token = await refreshGarminTokens(session.refreshToken);
      session = garminTokenResponseToSession(token, session);
      refreshedSession = true;
    } catch (error) {
      console.warn("[garmin-diagnostics:refresh_failed]", {
        userId: session.userId,
        error: error instanceof Error ? error.message : "Unknown refresh failure.",
      });

      const response = NextResponse.json(
        { ok: false, reason: "refresh_failed" },
        { status: 401 },
      );
      clearGarminCookies(response);
      return response;
    }
  }

  const profile = await getGarminProfile(session.accessToken);
  session = {
    ...session,
    userId: profile.userId,
    permissions: profile.permissions,
  };

  const response = NextResponse.json({
    ok: true,
    config: {
      garminReady: config.isReady,
      missing: config.missing,
      redirectUri: config.redirectUri,
    },
    session: {
      hasSession: true,
      userId: session.userId,
      permissions: session.permissions ?? [],
      expiresAt: new Date(session.expiresAt).toISOString(),
      expiresInMs: session.expiresAt - Date.now(),
      refreshTokenExpiresAt: session.refreshTokenExpiresAt
        ? new Date(session.refreshTokenExpiresAt).toISOString()
        : null,
      hasRefreshToken: Boolean(session.refreshToken),
      refreshed: refreshedSession,
      scope: session.scope,
    },
  });

  setGarminSessionCookie(response, session);

  return response;
}
