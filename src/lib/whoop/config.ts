import type { NextRequest } from "next/server";

export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API_BASE_URL = "https://api.prod.whoop.com/developer";

export const WHOOP_SCOPES = [
  "offline",
  "read:profile",
  "read:body_measurement",
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
] as const;

export type WhoopConfigStatus = {
  isReady: boolean;
  missing: string[];
  redirectUri: string;
};

export type WhoopClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function getScopeParam() {
  return WHOOP_SCOPES.join(" ");
}

export function getRedirectUri(request?: NextRequest | Request) {
  if (process.env.WHOOP_REDIRECT_URI) {
    return process.env.WHOOP_REDIRECT_URI;
  }

  if (request) {
    return new URL("/api/auth/whoop/callback", request.url).toString();
  }

  return "http://localhost:3000/api/auth/whoop/callback";
}

export function getConfigStatus(request?: NextRequest | Request): WhoopConfigStatus {
  const missing: string[] = [];

  if (!process.env.WHOOP_CLIENT_ID) missing.push("WHOOP_CLIENT_ID");
  if (!process.env.WHOOP_CLIENT_SECRET) missing.push("WHOOP_CLIENT_SECRET");

  if (!process.env.WHOOP_SESSION_SECRET) {
    missing.push("WHOOP_SESSION_SECRET");
  } else if (process.env.WHOOP_SESSION_SECRET.length < 32) {
    missing.push("WHOOP_SESSION_SECRET (32+ chars)");
  }

  return {
    isReady: missing.length === 0,
    missing,
    redirectUri: getRedirectUri(request),
  };
}

export function getRequiredWhoopConfig(
  request?: NextRequest | Request,
): WhoopClientConfig {
  const status = getConfigStatus(request);

  if (!status.isReady) {
    throw new Error(`Missing WHOOP environment values: ${status.missing.join(", ")}`);
  }

  return {
    clientId: process.env.WHOOP_CLIENT_ID!,
    clientSecret: process.env.WHOOP_CLIENT_SECRET!,
    redirectUri: status.redirectUri,
  };
}

