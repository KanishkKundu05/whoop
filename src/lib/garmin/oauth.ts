import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  GARMIN_AUTH_URL,
  GARMIN_TOKEN_URL,
  getRequiredGarminConfig,
} from "./config";
import type { GarminSession, GarminTokenResponse } from "./types";

export class GarminOAuthError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: string,
  ) {
    super(message);
  }
}

export function createGarminOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function createPkceCodeVerifier() {
  return randomBytes(64).toString("base64url");
}

export function createPkceCodeChallenge(codeVerifier: string) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function buildGarminAuthorizationUrl(
  request: NextRequest,
  state: string,
  codeChallenge: string,
) {
  const config = getRequiredGarminConfig(request);
  const url = new URL(GARMIN_AUTH_URL);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  return url;
}

async function requestToken(body: URLSearchParams) {
  const response = await fetch(GARMIN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new GarminOAuthError(
      "Garmin token request failed.",
      response.status,
      details.slice(0, 500),
    );
  }

  return (await response.json()) as GarminTokenResponse;
}

export async function exchangeGarminAuthorizationCode(
  request: NextRequest,
  code: string,
  codeVerifier: string,
) {
  const config = getRequiredGarminConfig(request);

  return requestToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: config.redirectUri,
    }),
  );
}

export async function refreshGarminTokens(refreshToken: string) {
  const config = getRequiredGarminConfig();

  return requestToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  );
}

function tokenExpiresAt(expiresInSeconds: number) {
  const safetyWindowSeconds = expiresInSeconds > 600 ? 600 : 0;
  return Date.now() + (expiresInSeconds - safetyWindowSeconds) * 1000;
}

export function garminTokenResponseToSession(
  token: GarminTokenResponse,
  previous?: GarminSession | null,
  profile?: { userId?: string; permissions?: string[] } | null,
): GarminSession {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? previous?.refreshToken,
    expiresAt: tokenExpiresAt(token.expires_in),
    refreshTokenExpiresAt: token.refresh_token_expires_in
      ? Date.now() + token.refresh_token_expires_in * 1000
      : previous?.refreshTokenExpiresAt,
    scope: token.scope ?? previous?.scope,
    tokenType: token.token_type,
    connectedAt: previous?.connectedAt ?? Date.now(),
    userId: profile?.userId ?? previous?.userId,
    permissions: profile?.permissions ?? previous?.permissions,
  };
}
