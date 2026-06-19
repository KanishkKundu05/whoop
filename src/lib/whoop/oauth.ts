import "server-only";

import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  getRequiredWhoopConfig,
  getScopeParam,
  WHOOP_AUTH_URL,
  WHOOP_TOKEN_URL,
} from "./config";
import type { UserBasicProfile, WhoopSession, WhoopTokenResponse } from "./types";

export class WhoopOAuthError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: string,
  ) {
    super(message);
  }
}

export function createOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function buildAuthorizationUrl(request: NextRequest, state: string) {
  const config = getRequiredWhoopConfig(request);
  const url = new URL(WHOOP_AUTH_URL);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", getScopeParam());
  url.searchParams.set("state", state);

  return url;
}

async function requestToken(body: URLSearchParams) {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new WhoopOAuthError(
      "WHOOP token request failed.",
      response.status,
      details.slice(0, 500),
    );
  }

  return (await response.json()) as WhoopTokenResponse;
}

export async function exchangeAuthorizationCode(
  request: NextRequest,
  code: string,
) {
  const config = getRequiredWhoopConfig(request);

  return requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  );
}

export async function refreshWhoopTokens(refreshToken: string) {
  const config = getRequiredWhoopConfig();

  return requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      scope: "offline",
    }),
  );
}

export function tokenResponseToSession(
  token: WhoopTokenResponse,
  previous?: WhoopSession | null,
  profile?: UserBasicProfile | null,
): WhoopSession {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? previous?.refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope ?? previous?.scope ?? getScopeParam(),
    tokenType: token.token_type,
    connectedAt: previous?.connectedAt ?? Date.now(),
    userId: profile?.user_id ?? previous?.userId,
  };
}

