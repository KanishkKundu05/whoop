import "server-only";

import { fetchMutation } from "convex/nextjs";
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
import type {
  Cycle,
  Recovery,
  Sleep,
  WhoopDashboardData,
  WhoopSession,
  Workout,
} from "@/lib/whoop/types";

type StoreDashboardFetchArgs = {
  fetch: DashboardFetchInput;
  user?: WhoopUserInput;
  body?: BodyMeasurementInput;
  cycles: CycleInput[];
  recoveries: RecoveryInput[];
  sleeps: SleepInput[];
  workouts: WorkoutInput[];
};

const storeDashboardFetch = makeFunctionReference<
  "mutation",
  StoreDashboardFetchArgs,
  DashboardFetchInput["counts"]
>("whoop:storeDashboardFetch");

function records<T>(resource: { data: { records?: T[] } | null }) {
  return resource.data?.records ?? [];
}

function optionalNumber(value?: number | null) {
  return value === undefined || value === null || Number.isNaN(value)
    ? undefined
    : value;
}

function mapUser(
  data: WhoopDashboardData,
  session: WhoopSession,
  whoopUserId: number,
): WhoopUserInput {
  const profile = data.profile.data;

  return {
    whoopUserId,
    ...(profile?.email ? { email: profile.email } : {}),
    ...(profile?.first_name ? { firstName: profile.first_name } : {}),
    ...(profile?.last_name ? { lastName: profile.last_name } : {}),
    connectedAt: session.connectedAt,
    updatedAt: Date.now(),
  };
}

function mapBody(data: WhoopDashboardData, whoopUserId: number) {
  const body = data.body.data;

  if (!body) return undefined;

  return {
    whoopUserId,
    heightMeter: body.height_meter,
    weightKilogram: body.weight_kilogram,
    maxHeartRate: body.max_heart_rate,
    measuredAt: data.fetchedAt,
  };
}

function mapCycle(record: Cycle, whoopUserId: number): CycleInput {
  return {
    whoopUserId,
    cycleId: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    start: record.start,
    ...(record.end ? { end: record.end } : {}),
    timezoneOffset: record.timezone_offset,
    scoreState: record.score_state,
    ...(record.score
      ? {
          score: {
            strain: record.score.strain,
            kilojoule: record.score.kilojoule,
            averageHeartRate: record.score.average_heart_rate,
            maxHeartRate: record.score.max_heart_rate,
          },
        }
      : {}),
  };
}

function mapRecovery(record: Recovery, whoopUserId: number): RecoveryInput {
  return {
    whoopUserId,
    cycleId: record.cycle_id,
    sleepId: record.sleep_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    scoreState: record.score_state,
    ...(record.score
      ? {
          score: {
            userCalibrating: record.score.user_calibrating,
            recoveryScore: record.score.recovery_score,
            restingHeartRate: record.score.resting_heart_rate,
            hrvRmssdMilli: record.score.hrv_rmssd_milli,
            ...(optionalNumber(record.score.spo2_percentage) !== undefined
              ? { spo2Percentage: record.score.spo2_percentage }
              : {}),
            ...(optionalNumber(record.score.skin_temp_celsius) !== undefined
              ? { skinTempCelsius: record.score.skin_temp_celsius }
              : {}),
          },
        }
      : {}),
  };
}

function mapSleep(record: Sleep, whoopUserId: number): SleepInput {
  const stageSummary = record.score?.stage_summary;
  const sleepNeeded = record.score?.sleep_needed;

  return {
    whoopUserId,
    sleepId: record.id,
    cycleId: record.cycle_id,
    ...(optionalNumber(record.v1_id) !== undefined ? { v1Id: record.v1_id } : {}),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    start: record.start,
    end: record.end,
    timezoneOffset: record.timezone_offset,
    nap: record.nap,
    scoreState: record.score_state,
    ...(stageSummary && sleepNeeded
      ? {
          score: {
            stageSummary: {
              totalInBedTimeMilli: stageSummary.total_in_bed_time_milli,
              totalAwakeTimeMilli: stageSummary.total_awake_time_milli,
              totalNoDataTimeMilli: stageSummary.total_no_data_time_milli,
              totalLightSleepTimeMilli: stageSummary.total_light_sleep_time_milli,
              totalSlowWaveSleepTimeMilli:
                stageSummary.total_slow_wave_sleep_time_milli,
              totalRemSleepTimeMilli: stageSummary.total_rem_sleep_time_milli,
              sleepCycleCount: stageSummary.sleep_cycle_count,
              disturbanceCount: stageSummary.disturbance_count,
            },
            sleepNeeded: {
              baselineMilli: sleepNeeded.baseline_milli,
              needFromSleepDebtMilli: sleepNeeded.need_from_sleep_debt_milli,
              needFromRecentStrainMilli: sleepNeeded.need_from_recent_strain_milli,
              needFromRecentNapMilli: sleepNeeded.need_from_recent_nap_milli,
            },
            ...(optionalNumber(record.score?.respiratory_rate) !== undefined
              ? { respiratoryRate: record.score?.respiratory_rate }
              : {}),
            ...(optionalNumber(record.score?.sleep_performance_percentage) !== undefined
              ? {
                  sleepPerformancePercentage:
                    record.score?.sleep_performance_percentage,
                }
              : {}),
            ...(optionalNumber(record.score?.sleep_consistency_percentage) !== undefined
              ? {
                  sleepConsistencyPercentage:
                    record.score?.sleep_consistency_percentage,
                }
              : {}),
            ...(optionalNumber(record.score?.sleep_efficiency_percentage) !== undefined
              ? {
                  sleepEfficiencyPercentage:
                    record.score?.sleep_efficiency_percentage,
                }
              : {}),
          },
        }
      : {}),
  };
}

function mapWorkout(record: Workout, whoopUserId: number): WorkoutInput {
  return {
    whoopUserId,
    workoutId: record.id,
    ...(optionalNumber(record.v1_id) !== undefined ? { v1Id: record.v1_id } : {}),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    start: record.start,
    end: record.end,
    timezoneOffset: record.timezone_offset,
    sportName: record.sport_name,
    ...(optionalNumber(record.sport_id) !== undefined
      ? { sportId: record.sport_id }
      : {}),
    scoreState: record.score_state,
    ...(record.score
      ? {
          score: {
            strain: record.score.strain,
            averageHeartRate: record.score.average_heart_rate,
            maxHeartRate: record.score.max_heart_rate,
            kilojoule: record.score.kilojoule,
            percentRecorded: record.score.percent_recorded,
            ...(optionalNumber(record.score.distance_meter) !== undefined
              ? { distanceMeter: record.score.distance_meter }
              : {}),
            ...(optionalNumber(record.score.altitude_gain_meter) !== undefined
              ? { altitudeGainMeter: record.score.altitude_gain_meter }
              : {}),
            ...(optionalNumber(record.score.altitude_change_meter) !== undefined
              ? { altitudeChangeMeter: record.score.altitude_change_meter }
              : {}),
            zoneDurations: {
              zoneZeroMilli: record.score.zone_durations.zone_zero_milli,
              zoneOneMilli: record.score.zone_durations.zone_one_milli,
              zoneTwoMilli: record.score.zone_durations.zone_two_milli,
              zoneThreeMilli: record.score.zone_durations.zone_three_milli,
              zoneFourMilli: record.score.zone_durations.zone_four_milli,
              zoneFiveMilli: record.score.zone_durations.zone_five_milli,
            },
          },
        }
      : {}),
  };
}

function buildFetchRecord(
  data: WhoopDashboardData,
  whoopUserId: number,
): DashboardFetchInput {
  return {
    whoopUserId,
    rangeDays: data.rangeDays,
    start: data.start,
    end: data.end,
    fetchedAt: data.fetchedAt,
    counts: {
      cycles: records<Cycle>(data.cycles).length,
      recoveries: records<Recovery>(data.recoveries).length,
      sleeps: records<Sleep>(data.sleeps).length,
      workouts: records<Workout>(data.workouts).length,
    },
    errors: {
      ...(data.profile.error ? { profile: data.profile.error } : {}),
      ...(data.body.error ? { body: data.body.error } : {}),
      ...(data.cycles.error ? { cycles: data.cycles.error } : {}),
      ...(data.recoveries.error ? { recoveries: data.recoveries.error } : {}),
      ...(data.sleeps.error ? { sleeps: data.sleeps.error } : {}),
      ...(data.workouts.error ? { workouts: data.workouts.error } : {}),
    },
  };
}

export async function syncWhoopDashboardData(
  data: WhoopDashboardData,
  session: WhoopSession,
) {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return;
  }

  const whoopUserId = data.profile.data?.user_id ?? session.userId;

  if (!whoopUserId) {
    return;
  }

  const body = mapBody(data, whoopUserId);
  const payload: StoreDashboardFetchArgs = {
    fetch: buildFetchRecord(data, whoopUserId),
    user: mapUser(data, session, whoopUserId),
    ...(body ? { body } : {}),
    cycles: records<Cycle>(data.cycles).map((record) =>
      mapCycle(record, whoopUserId),
    ),
    recoveries: records<Recovery>(data.recoveries).map((record) =>
      mapRecovery(record, whoopUserId),
    ),
    sleeps: records<Sleep>(data.sleeps).map((record) =>
      mapSleep(record, whoopUserId),
    ),
    workouts: records<Workout>(data.workouts).map((record) =>
      mapWorkout(record, whoopUserId),
    ),
  };

  try {
    await fetchMutation(storeDashboardFetch, payload);
  } catch {
    // Convex sync should never prevent the live WHOOP dashboard from rendering.
  }
}
