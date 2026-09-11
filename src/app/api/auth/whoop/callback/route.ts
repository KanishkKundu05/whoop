import { safeNextPath } from "@/lib/auth/navigation";
import { NextRequest, NextResponse } from "next/server";
import { getWhoopProfile } from "@/lib/whoop/client";
import {
  exchangeAuthorizationCode,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import {
  clearWhoopCookies,
  setWhoopSessionCookie,
  WHOOP_OAUTH_NEXT_COOKIE,
  WHOOP_OAUTH_STATE_COOKIE,
} from "@/lib/whoop/session";


function redirectWithError(request: NextRequest, nextPath: string, error: string) {
  const url = new URL(nextPath, request.url);
  url.searchParams.set("auth_error", error);
  const response = NextResponse.redirect(url);
  clearWhoopCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(WHOOP_OAUTH_STATE_COOKIE)?.value;
  const nextPath = safeNextPath(request.cookies.get(WHOOP_OAUTH_NEXT_COOKIE)?.value);
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  if (providerError) {
    return redirectWithError(request, nextPath, providerError);
  }

  if (!code) {
    return redirectWithError(request, nextPath, "missing_code");
  }

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return redirectWithError(request, nextPath, "state_mismatch");
  }

  try {
    const token = await exchangeAuthorizationCode(request, code);
    const profile = await getWhoopProfile(token.access_token).catch(() => null);
    const session = tokenResponseToSession(token, null, profile);
    const response = NextResponse.redirect(new URL(nextPath, request.url));

    clearWhoopCookies(response);
    setWhoopSessionCookie(response, session);

    return response;
  } catch {
    return redirectWithError(request, nextPath, "token_exchange_failed");
  }
}
