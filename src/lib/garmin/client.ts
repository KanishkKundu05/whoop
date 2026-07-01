import "server-only";

import { GARMIN_API_BASE_URL } from "./config";
import type { GarminPermissionsResponse, GarminUserIdResponse } from "./types";

export class GarminApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public details?: string,
  ) {
    super(message);
  }
}

export class GarminUnauthorizedError extends GarminApiError {}

function buildUrl(path: string) {
  return new URL(`${GARMIN_API_BASE_URL}${path}`);
}

function logGarmin(
  level: "info" | "warn",
  event: string,
  context: Record<string, unknown>,
) {
  console[level](`[garmin:${event}]`, context);
}

export async function fetchGarmin<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
) {
  const url = buildUrl(path);
  const startedAt = Date.now();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    const errorClass =
      response.status === 401 ? GarminUnauthorizedError : GarminApiError;

    logGarmin("warn", "request_failed", {
      path,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      details: details.slice(0, 300),
    });

    throw new errorClass(
      `Garmin request failed with ${response.status}.`,
      response.status,
      path,
      details.slice(0, 500),
    );
  }

  if (response.status === 204) {
    logGarmin("info", "request_complete", {
      path,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
    });

    return null as T;
  }

  const data = (await response.json()) as T;

  logGarmin("info", "request_complete", {
    path,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
  });

  return data;
}

export async function getGarminUserId(accessToken: string) {
  return fetchGarmin<GarminUserIdResponse>(accessToken, "/user/id");
}

export async function getGarminPermissions(accessToken: string) {
  const response = await fetchGarmin<GarminPermissionsResponse>(
    accessToken,
    "/user/permissions",
  );

  return Array.isArray(response) ? response : response.permissions ?? [];
}

export async function getGarminProfile(accessToken: string) {
  const [user, permissions] = await Promise.all([
    getGarminUserId(accessToken),
    getGarminPermissions(accessToken).catch(() => []),
  ]);

  return {
    userId: user.userId,
    permissions,
  };
}

export async function revokeGarminAccess(accessToken: string) {
  await fetchGarmin<null>(accessToken, "/user/registration", {
    method: "DELETE",
  });
}
