import { NextRequest, NextResponse } from "next/server";
import { getConfigStatus } from "@/lib/whoop/config";
import { buildAuthorizationUrl, createOAuthState } from "@/lib/whoop/oauth";
import { setOAuthNextCookie, setOAuthStateCookie } from "@/lib/whoop/session";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

function redirectWithError(request: NextRequest, nextPath: string, error: string) {
  const url = new URL(nextPath, request.url);
  url.searchParams.set("auth_error", error);

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const status = getConfigStatus(request);
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!status.isReady) {
    return redirectWithError(request, nextPath, "missing_config");
  }

  const state = createOAuthState();
  const response = NextResponse.redirect(buildAuthorizationUrl(request, state));
  setOAuthStateCookie(response, state);
  setOAuthNextCookie(response, nextPath);

  return response;
}
