import "server-only";

import type { HeartRateSignal } from "@/lib/dj/types";
import { WHOOP_API_BASE_URL } from "./config";
import type {
  Cycle,
  PaginatedWhoopResponse,
  Recovery,
  ResourceResult,
  Sleep,
  UserBasicProfile,
  UserBodyMeasurement,
  WhoopDashboardData,
  Workout,
} from "./types";

export class WhoopApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public details?: string,
  ) {
    super(message);
  }
}

export class WhoopUnauthorizedError extends WhoopApiError {}

type Query = Record<string, string | number | undefined>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${WHOOP_API_BASE_URL}${path}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

export async function fetchWhoop<T>(
  accessToken: string,
  path: string,
  query?: Query,
  init?: RequestInit,
) {
  const url = buildUrl(path, query);
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
      response.status === 401 ? WhoopUnauthorizedError : WhoopApiError;

    throw new errorClass(
      `WHOOP request failed with ${response.status}.`,
      response.status,
      path,
      details.slice(0, 500),
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export async function getWhoopProfile(accessToken: string) {
  return fetchWhoop<UserBasicProfile>(accessToken, "/v2/user/profile/basic");
}

export async function revokeWhoopAccess(accessToken: string) {
  await fetchWhoop<null>(accessToken, "/v2/user/access", undefined, {
    method: "DELETE",
  });
}

async function resource<T>(request: Promise<T>): Promise<ResourceResult<T>> {
  try {
    return {
      data: await request,
      error: null,
    };
  } catch (error) {
    if (error instanceof WhoopApiError) {
      return {
        data: null,
        error: error.details || error.message,
        status: error.status,
      };
    }

    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown request failure.",
    };
  }
}

export async function getRecentWhoopData(
  accessToken: string,
  rangeDays: number,
): Promise<WhoopDashboardData> {
  const end = new Date();
  const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const collectionQuery = {
    limit: 25,
    start: start.toISOString(),
    end: end.toISOString(),
  };

  const [profile, body, cycles, recoveries, sleeps, workouts] =
    await Promise.all([
      resource(fetchWhoop<UserBasicProfile>(accessToken, "/v2/user/profile/basic")),
      resource(
        fetchWhoop<UserBodyMeasurement>(
          accessToken,
          "/v2/user/measurement/body",
        ),
      ),
      resource(
        fetchWhoop<PaginatedWhoopResponse<Cycle>>(
          accessToken,
          "/v2/cycle",
          collectionQuery,
        ),
      ),
      resource(
        fetchWhoop<PaginatedWhoopResponse<Recovery>>(
          accessToken,
          "/v2/recovery",
          collectionQuery,
        ),
      ),
      resource(
        fetchWhoop<PaginatedWhoopResponse<Sleep>>(
          accessToken,
          "/v2/activity/sleep",
          collectionQuery,
        ),
      ),
      resource(
        fetchWhoop<PaginatedWhoopResponse<Workout>>(
          accessToken,
          "/v2/activity/workout",
          collectionQuery,
        ),
      ),
    ]);

  return {
    rangeDays,
    start: start.toISOString(),
    end: end.toISOString(),
    fetchedAt: new Date().toISOString(),
    profile,
    body,
    cycles,
    recoveries,
    sleeps,
    workouts,
  };
}

function latestByUpdatedAt<T extends { updated_at: string }>(records: T[]) {
  return [...records].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];
}

export async function getLatestHeartRateSignal(
  accessToken: string,
): Promise<HeartRateSignal | null> {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const query = {
    limit: 10,
    start: start.toISOString(),
    end: end.toISOString(),
  };

  const [workouts, cycles, recoveries] = await Promise.all([
    fetchWhoop<PaginatedWhoopResponse<Workout>>(
      accessToken,
      "/v2/activity/workout",
      query,
    ),
    fetchWhoop<PaginatedWhoopResponse<Cycle>>(accessToken, "/v2/cycle", query),
    fetchWhoop<PaginatedWhoopResponse<Recovery>>(
      accessToken,
      "/v2/recovery",
      query,
    ),
  ]);

  const workout = latestByUpdatedAt(
    (workouts.records ?? []).filter(
      (record) => record.score?.average_heart_rate,
    ),
  );

  if (workout?.score?.average_heart_rate) {
    return {
      bpm: workout.score.average_heart_rate,
      source: "workout_average",
      label: "Latest workout average HR",
      sampledAt: workout.updated_at,
      isLive: false,
    };
  }

  const cycle = latestByUpdatedAt(
    (cycles.records ?? []).filter((record) => record.score?.average_heart_rate),
  );

  if (cycle?.score?.average_heart_rate) {
    return {
      bpm: cycle.score.average_heart_rate,
      source: "cycle_average",
      label: "Latest cycle average HR",
      sampledAt: cycle.updated_at,
      isLive: false,
    };
  }

  const recovery = latestByUpdatedAt(
    (recoveries.records ?? []).filter(
      (record) => record.score?.resting_heart_rate,
    ),
  );

  if (recovery?.score?.resting_heart_rate) {
    return {
      bpm: recovery.score.resting_heart_rate,
      source: "recovery_resting",
      label: "Latest recovery resting HR",
      sampledAt: recovery.updated_at,
      isLive: false,
    };
  }

  return null;
}
