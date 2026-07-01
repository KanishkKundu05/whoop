export const GARMIN_AUTH_URL = "https://connect.garmin.com/oauth2Confirm";
export const GARMIN_TOKEN_URL =
  "https://diauth.garmin.com/di-oauth2-service/oauth/token";
export const GARMIN_API_BASE_URL = "https://apis.garmin.com/wellness-api/rest";

export type GarminConfigStatus = {
  isReady: boolean;
  missing: string[];
  redirectUri: string;
};

export type GarminClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type HeaderReader = {
  get(name: string): string | null;
};

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
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

function getConfiguredRedirectUri(requestOrigin: string) {
  const configuredRedirectUri = process.env.GARMIN_REDIRECT_URI?.trim();

  if (!configuredRedirectUri) {
    return null;
  }

  try {
    const configuredUrl = new URL(configuredRedirectUri);
    const requestUrl = new URL(requestOrigin);

    if (
      isLocalHostname(configuredUrl.hostname) &&
      !isLocalHostname(requestUrl.hostname)
    ) {
      return null;
    }

    return configuredUrl.toString();
  } catch {
    return configuredRedirectUri;
  }
}

function getRedirectUriFromOrigin(origin: string) {
  const configuredRedirectUri = getConfiguredRedirectUri(origin);

  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  return `${origin}/api/auth/garmin/callback`;
}

export function getGarminRedirectUri(request?: Request) {
  const origin = getOriginFromHeaders(request?.headers, request?.url);
  return getRedirectUriFromOrigin(origin);
}

export function getGarminRedirectUriFromHeaders(headers?: HeaderReader) {
  return getRedirectUriFromOrigin(getOriginFromHeaders(headers));
}

export function getGarminScopeDescription() {
  return "Managed in the Garmin developer portal";
}

export function getGarminConfigStatus(request?: Request): GarminConfigStatus {
  const missing: string[] = [];

  if (!process.env.GARMIN_CLIENT_ID) missing.push("GARMIN_CLIENT_ID");
  if (!process.env.GARMIN_CLIENT_SECRET) missing.push("GARMIN_CLIENT_SECRET");

  if (!process.env.GARMIN_SESSION_SECRET) {
    missing.push("GARMIN_SESSION_SECRET");
  } else if (process.env.GARMIN_SESSION_SECRET.length < 32) {
    missing.push("GARMIN_SESSION_SECRET (32+ chars)");
  }

  return {
    isReady: missing.length === 0,
    missing,
    redirectUri: getGarminRedirectUri(request),
  };
}

export function getRequiredGarminConfig(
  request?: Request,
): GarminClientConfig {
  const status = getGarminConfigStatus(request);

  if (!status.isReady) {
    throw new Error(
      `Missing Garmin environment values: ${status.missing.join(", ")}`,
    );
  }

  return {
    clientId: process.env.GARMIN_CLIENT_ID!,
    clientSecret: process.env.GARMIN_CLIENT_SECRET!,
    redirectUri: status.redirectUri,
  };
}
