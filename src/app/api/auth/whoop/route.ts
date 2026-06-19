import { NextRequest, NextResponse } from "next/server";
import { getConfigStatus } from "@/lib/whoop/config";
import { buildAuthorizationUrl, createOAuthState } from "@/lib/whoop/oauth";
import { setOAuthStateCookie } from "@/lib/whoop/session";

export async function GET(request: NextRequest) {
  const status = getConfigStatus(request);

  if (!status.isReady) {
    return NextResponse.redirect(new URL("/?auth_error=missing_config", request.url));
  }

  const state = createOAuthState();
  const response = NextResponse.redirect(buildAuthorizationUrl(request, state));
  setOAuthStateCookie(response, state);

  return response;
}

