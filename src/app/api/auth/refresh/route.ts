import { safeNextPath } from "@/lib/auth/navigation";
import { NextRequest, NextResponse } from "next/server";
import {
  refreshWhoopTokens,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import {
  clearWhoopCookies,
  getWhoopSession,
  setWhoopSessionCookie,
} from "@/lib/whoop/session";


export async function GET(request: NextRequest) {
  const session = await getWhoopSession();
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!session?.refreshToken) {
    const response = NextResponse.redirect(
      new URL("/whoop?auth_error=session_expired", request.url),
    );
    clearWhoopCookies(response);
    return response;
  }

  try {
    const token = await refreshWhoopTokens(session.refreshToken);
    const refreshedSession = tokenResponseToSession(token, session);
    const response = NextResponse.redirect(new URL(nextPath, request.url));

    setWhoopSessionCookie(response, refreshedSession);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/whoop?auth_error=refresh_failed", request.url),
    );
    clearWhoopCookies(response);
    return response;
  }
}

