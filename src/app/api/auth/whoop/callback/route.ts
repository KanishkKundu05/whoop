import { NextRequest, NextResponse } from "next/server";
import { getWhoopProfile } from "@/lib/whoop/client";
import {
  exchangeAuthorizationCode,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import {
  clearWhoopCookies,
  setWhoopSessionCookie,
  WHOOP_OAUTH_STATE_COOKIE,
} from "@/lib/whoop/session";

function redirectWithError(request: NextRequest, error: string) {
  const response = NextResponse.redirect(new URL(`/?auth_error=${error}`, request.url));
  clearWhoopCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(WHOOP_OAUTH_STATE_COOKIE)?.value;
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  if (providerError) {
    return redirectWithError(request, providerError);
  }

  if (!code) {
    return redirectWithError(request, "missing_code");
  }

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return redirectWithError(request, "state_mismatch");
  }

  try {
    const token = await exchangeAuthorizationCode(request, code);
    const profile = await getWhoopProfile(token.access_token).catch(() => null);
    const session = tokenResponseToSession(token, null, profile);
    const response = NextResponse.redirect(new URL("/", request.url));

    clearWhoopCookies(response);
    setWhoopSessionCookie(response, session);

    return response;
  } catch {
    return redirectWithError(request, "token_exchange_failed");
  }
}

