import { defineSchema, defineTable } from "convex/server";
import {
  bodyMeasurementFields,
  cycleFields,
  dashboardFetchFields,
  recoveryFields,
  sleepFields,
  whoopUserFields,
  workoutFields,
} from "./whoopValidators";

export default defineSchema({
  whoopUsers: defineTable(whoopUserFields).index("by_whoop_user_id", [
    "whoopUserId",
  ]),

  dashboardFetches: defineTable(dashboardFetchFields)
    .index("by_user_fetched_at", ["whoopUserId", "fetchedAt"])
    .index("by_fetched_at", ["fetchedAt"]),

  bodyMeasurements: defineTable(bodyMeasurementFields).index("by_user", [
    "whoopUserId",
  ]),

  cycles: defineTable(cycleFields)
    .index("by_user_cycle", ["whoopUserId", "cycleId"])
    .index("by_user_start", ["whoopUserId", "start"])
    .index("by_user_score_state", ["whoopUserId", "scoreState"]),

  recoveries: defineTable(recoveryFields)
    .index("by_user_cycle", ["whoopUserId", "cycleId"])
    .index("by_user_sleep", ["whoopUserId", "sleepId"])
    .index("by_user_score_state", ["whoopUserId", "scoreState"]),

  sleeps: defineTable(sleepFields)
    .index("by_user_sleep", ["whoopUserId", "sleepId"])
    .index("by_user_start", ["whoopUserId", "start"])
    .index("by_user_score_state", ["whoopUserId", "scoreState"]),

  workouts: defineTable(workoutFields)
    .index("by_user_workout", ["whoopUserId", "workoutId"])
    .index("by_user_start", ["whoopUserId", "start"])
    .index("by_user_score_state", ["whoopUserId", "scoreState"]),
});
