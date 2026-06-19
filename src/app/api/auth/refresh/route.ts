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

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const session = await getWhoopSession();
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!session?.refreshToken) {
    const response = NextResponse.redirect(
      new URL("/?auth_error=session_expired", request.url),
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
      new URL("/?auth_error=refresh_failed", request.url),
    );
    clearWhoopCookies(response);
    return response;
  }
}

