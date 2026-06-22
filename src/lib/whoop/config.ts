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

type HeaderReader = {
  get(name: string): string | null;
};

export function getScopeParam() {
  return WHOOP_SCOPES.join(" ");
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getOriginFromHeaders(headers?: HeaderReader, requestUrl?: string) {
  const forwardedHost = firstHeaderValue(headers?.get("x-forwarded-host") ?? null);
  const host = forwardedHost ?? firstHeaderValue(headers?.get("host") ?? null);
  const forwardedProto = firstHeaderValue(headers?.get("x-forwarded-proto") ?? null);

  if (host) {
    const protocol =
      forwardedProto ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

    return `${protocol}://${host}`;
  }

  if (requestUrl) {
    return new URL(requestUrl).origin;
  }

  return "http://localhost:3000";
}

export function getRedirectUri(request?: Request) {
  const configuredRedirectUri = process.env.WHOOP_REDIRECT_URI?.trim();

  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  return `${getOriginFromHeaders(request?.headers, request?.url)}/api/auth/whoop/callback`;
}

export function getRedirectUriFromHeaders(headers?: HeaderReader) {
  const configuredRedirectUri = process.env.WHOOP_REDIRECT_URI?.trim();

  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  return `${getOriginFromHeaders(headers)}/api/auth/whoop/callback`;
}

export function getConfigStatus(request?: Request): WhoopConfigStatus {
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
  request?: Request,
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
