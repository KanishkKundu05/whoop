import { NextRequest, NextResponse } from "next/server";
import { getGarminProfile } from "@/lib/garmin/client";
import {
  exchangeGarminAuthorizationCode,
  garminTokenResponseToSession,
} from "@/lib/garmin/oauth";
import {
  clearGarminCookies,
  clearGarminOAuthCookie,
  GARMIN_OAUTH_COOKIE,
  setGarminSessionCookie,
  unsealGarminOAuthContext,
} from "@/lib/garmin/session";

function redirectWithError(request: NextRequest, error: string) {
  const response = NextResponse.redirect(
    new URL(`/?garmin_auth_error=${error}`, request.url),
  );
  clearGarminCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const returnedState = request.nextUrl.searchParams.get("state");
  const oauthCookie = request.cookies.get(GARMIN_OAUTH_COOKIE)?.value;
  const oauthContext = oauthCookie ? unsealGarminOAuthContext(oauthCookie) : null;
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");

  if (providerError) {
    return redirectWithError(request, providerError);
  }

  if (!code) {
    return redirectWithError(request, "missing_code");
  }

  if (
    !returnedState ||
    !oauthContext?.state ||
    returnedState !== oauthContext.state
  ) {
    return redirectWithError(request, "state_mismatch");
  }

  try {
    const token = await exchangeGarminAuthorizationCode(
      request,
      code,
      oauthContext.codeVerifier,
    );
    const profile = await getGarminProfile(token.access_token).catch(() => null);
    const session = garminTokenResponseToSession(token, null, profile);
    const response = NextResponse.redirect(new URL("/", request.url));

    clearGarminOAuthCookie(response);
    setGarminSessionCookie(response, session);

    return response;
  } catch {
    return redirectWithError(request, "token_exchange_failed");
  }
}
