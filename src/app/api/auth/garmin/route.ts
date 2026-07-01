import { NextRequest, NextResponse } from "next/server";
import { getGarminConfigStatus } from "@/lib/garmin/config";
import {
  buildGarminAuthorizationUrl,
  createGarminOAuthState,
  createPkceCodeChallenge,
  createPkceCodeVerifier,
} from "@/lib/garmin/oauth";
import { setGarminOAuthCookie } from "@/lib/garmin/session";

export async function GET(request: NextRequest) {
  const status = getGarminConfigStatus(request);

  if (!status.isReady) {
    return NextResponse.redirect(
      new URL("/?garmin_auth_error=missing_config", request.url),
    );
  }

  const state = createGarminOAuthState();
  const codeVerifier = createPkceCodeVerifier();
  const codeChallenge = createPkceCodeChallenge(codeVerifier);
  const response = NextResponse.redirect(
    buildGarminAuthorizationUrl(request, state, codeChallenge),
  );

  setGarminOAuthCookie(response, { state, codeVerifier });

  return response;
}
