import "server-only";

import { fetchQuery } from "@/lib/convex/server";
import { makeFunctionReference } from "convex/server";
import type {
  BodyMeasurementInput,
  CycleInput,
  DashboardFetchInput,
  RecoveryInput,
  SleepInput,
  WhoopUserInput,
  WorkoutInput,
} from "../../../convex/whoopValidators";

type PublicWhoopDashboard = {
  rangeDays: number;
  start: string;
  user: WhoopUserInput | null;
  body: BodyMeasurementInput | null;
  latestFetch: DashboardFetchInput | null;
  latestFetches: DashboardFetchInput[];
  cycles: CycleInput[];
  recoveries: RecoveryInput[];
  sleeps: SleepInput[];
  workouts: WorkoutInput[];
};

const publicDashboardQuery = makeFunctionReference<
  "query",
  {
    whoopUserId?: number;
    rangeDays: number;
    start: string;
  },
  PublicWhoopDashboard
>("whoop:publicDashboard");

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
}

export function getPublicWhoopUserId() {
  const raw = process.env.WHOOP_PUBLIC_USER_ID?.trim();
  const userId = raw ? Number(raw) : NaN;

  return Number.isFinite(userId) ? userId : null;
}

export function getPublicDashboardStatus() {
  const missing: string[] = [];

  if (!getConvexUrl()) missing.push("NEXT_PUBLIC_CONVEX_URL");

  return {
    isReady: missing.length === 0,
    missing,
  };
}

export async function fetchPublicWhoopDashboard(rangeDays = 7) {
  const convexUrl = getConvexUrl();
  const whoopUserId = getPublicWhoopUserId();

  if (!convexUrl || !whoopUserId) return null;

  const start = new Date(
    Date.now() - rangeDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  return fetchQuery(
    publicDashboardQuery,
    {
      ...(whoopUserId ? { whoopUserId } : {}),
      rangeDays,
      start,
    },
    {
      url: convexUrl,
    },
  );
}

export type { PublicWhoopDashboard };
