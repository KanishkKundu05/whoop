import { NextRequest, NextResponse } from "next/server";
import { revokeGarminAccess } from "@/lib/garmin/client";
import {
  garminTokenResponseToSession,
  refreshGarminTokens,
} from "@/lib/garmin/oauth";
import {
  clearGarminCookies,
  getGarminSession,
  isGarminSessionExpiring,
} from "@/lib/garmin/session";

async function disconnect(request: NextRequest) {
  const session = await getGarminSession();
  let accessToken = session?.accessToken;

  try {
    if (session?.refreshToken && isGarminSessionExpiring(session)) {
      const token = await refreshGarminTokens(session.refreshToken);
      accessToken = garminTokenResponseToSession(token, session).accessToken;
    }

    if (accessToken) {
      await revokeGarminAccess(accessToken);
    }

    const response = NextResponse.redirect(
      new URL("/?garmin_disconnected=1", request.url),
    );
    clearGarminCookies(response);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/?garmin_auth_error=disconnect_failed", request.url),
    );
    clearGarminCookies(response);
    return response;
  }
}

export async function POST(request: NextRequest) {
  return disconnect(request);
}
