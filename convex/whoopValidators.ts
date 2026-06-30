import { v, type Infer } from "convex/values";

export const sleepStageSummaryFields = {
  totalInBedTimeMilli: v.number(),
  totalAwakeTimeMilli: v.number(),
  totalNoDataTimeMilli: v.number(),
  totalLightSleepTimeMilli: v.number(),
  totalSlowWaveSleepTimeMilli: v.number(),
  totalRemSleepTimeMilli: v.number(),
  sleepCycleCount: v.number(),
  disturbanceCount: v.number(),
};

export const sleepNeededFields = {
  baselineMilli: v.number(),
  needFromSleepDebtMilli: v.number(),
  needFromRecentStrainMilli: v.number(),
  needFromRecentNapMilli: v.number(),
};

export const sleepScoreFields = {
  stageSummary: v.object(sleepStageSummaryFields),
  sleepNeeded: v.object(sleepNeededFields),
  respiratoryRate: v.optional(v.number()),
  sleepPerformancePercentage: v.optional(v.number()),
  sleepConsistencyPercentage: v.optional(v.number()),
  sleepEfficiencyPercentage: v.optional(v.number()),
};

export const cycleScoreFields = {
  strain: v.number(),
  kilojoule: v.number(),
  averageHeartRate: v.number(),
  maxHeartRate: v.number(),
};

export const recoveryScoreFields = {
  userCalibrating: v.boolean(),
  recoveryScore: v.number(),
  restingHeartRate: v.number(),
  hrvRmssdMilli: v.number(),
  spo2Percentage: v.optional(v.number()),
  skinTempCelsius: v.optional(v.number()),
};

export const zoneDurationsFields = {
  zoneZeroMilli: v.number(),
  zoneOneMilli: v.number(),
  zoneTwoMilli: v.number(),
  zoneThreeMilli: v.number(),
  zoneFourMilli: v.number(),
  zoneFiveMilli: v.number(),
};

export const workoutScoreFields = {
  strain: v.number(),
  averageHeartRate: v.number(),
  maxHeartRate: v.number(),
  kilojoule: v.number(),
  percentRecorded: v.number(),
  distanceMeter: v.optional(v.number()),
  altitudeGainMeter: v.optional(v.number()),
  altitudeChangeMeter: v.optional(v.number()),
  zoneDurations: v.object(zoneDurationsFields),
};

export const whoopUserFields = {
  whoopUserId: v.number(),
  email: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  connectedAt: v.number(),
  updatedAt: v.number(),
};

export const bodyMeasurementFields = {
  whoopUserId: v.number(),
  heightMeter: v.number(),
  weightKilogram: v.number(),
  maxHeartRate: v.number(),
  measuredAt: v.string(),
};

export const cycleFields = {
  whoopUserId: v.number(),
  cycleId: v.number(),
  createdAt: v.string(),
  updatedAt: v.string(),
  start: v.string(),
  end: v.optional(v.string()),
  timezoneOffset: v.string(),
  scoreState: v.string(),
  score: v.optional(v.object(cycleScoreFields)),
};

export const recoveryFields = {
  whoopUserId: v.number(),
  cycleId: v.number(),
  sleepId: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
  scoreState: v.string(),
  score: v.optional(v.object(recoveryScoreFields)),
};

export const sleepFields = {
  whoopUserId: v.number(),
  sleepId: v.string(),
  cycleId: v.number(),
  v1Id: v.optional(v.number()),
  createdAt: v.string(),
  updatedAt: v.string(),
  start: v.string(),
  end: v.string(),
  timezoneOffset: v.string(),
  nap: v.boolean(),
  scoreState: v.string(),
  score: v.optional(v.object(sleepScoreFields)),
};

export const workoutFields = {
  whoopUserId: v.number(),
  workoutId: v.string(),
  v1Id: v.optional(v.number()),
  createdAt: v.string(),
  updatedAt: v.string(),
  start: v.string(),
  end: v.string(),
  timezoneOffset: v.string(),
  sportName: v.string(),
  sportId: v.optional(v.number()),
  scoreState: v.string(),
  score: v.optional(v.object(workoutScoreFields)),
};

export const dashboardFetchFields = {
  whoopUserId: v.number(),
  rangeDays: v.number(),
  start: v.string(),
  end: v.string(),
  fetchedAt: v.string(),
  counts: v.object({
    cycles: v.number(),
    recoveries: v.number(),
    sleeps: v.number(),
    workouts: v.number(),
  }),
  errors: v.object({
    profile: v.optional(v.string()),
    body: v.optional(v.string()),
    cycles: v.optional(v.string()),
    recoveries: v.optional(v.string()),
    sleeps: v.optional(v.string()),
    workouts: v.optional(v.string()),
  }),
};

export const whoopUserValidator = v.object(whoopUserFields);
export const bodyMeasurementValidator = v.object(bodyMeasurementFields);
export const cycleValidator = v.object(cycleFields);
export const recoveryValidator = v.object(recoveryFields);
export const sleepValidator = v.object(sleepFields);
export const workoutValidator = v.object(workoutFields);
export const dashboardFetchValidator = v.object(dashboardFetchFields);

export type WhoopUserInput = Infer<typeof whoopUserValidator>;
export type BodyMeasurementInput = Infer<typeof bodyMeasurementValidator>;
export type CycleInput = Infer<typeof cycleValidator>;
export type RecoveryInput = Infer<typeof recoveryValidator>;
export type SleepInput = Infer<typeof sleepValidator>;
export type WorkoutInput = Infer<typeof workoutValidator>;
export type DashboardFetchInput = Infer<typeof dashboardFetchValidator>;
