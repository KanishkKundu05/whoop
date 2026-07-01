import { NextRequest, NextResponse } from "next/server";
import {
  garminTokenResponseToSession,
  refreshGarminTokens,
} from "@/lib/garmin/oauth";
import {
  clearGarminCookies,
  getGarminSession,
  setGarminSessionCookie,
} from "@/lib/garmin/session";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const session = await getGarminSession();
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!session?.refreshToken) {
    const response = NextResponse.redirect(
      new URL("/?garmin_auth_error=session_expired", request.url),
    );
    clearGarminCookies(response);
    return response;
  }

  try {
    const token = await refreshGarminTokens(session.refreshToken);
    const refreshedSession = garminTokenResponseToSession(token, session);
    const response = NextResponse.redirect(new URL(nextPath, request.url));

    setGarminSessionCookie(response, refreshedSession);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/?garmin_auth_error=refresh_failed", request.url),
    );
    clearGarminCookies(response);
    return response;
  }
}
