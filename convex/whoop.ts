import { v } from "convex/values";
import {
  mutationGeneric as mutation,
  queryGeneric as query,
} from "convex/server";
import {
  bodyMeasurementValidator,
  cycleValidator,
  dashboardFetchValidator,
  recoveryValidator,
  sleepValidator,
  whoopUserValidator,
  workoutValidator,
} from "./whoopValidators";

export const storeDashboardFetch = mutation({
  args: {
    fetch: dashboardFetchValidator,
    user: v.optional(whoopUserValidator),
    body: v.optional(bodyMeasurementValidator),
    cycles: v.array(cycleValidator),
    recoveries: v.array(recoveryValidator),
    sleeps: v.array(sleepValidator),
    workouts: v.array(workoutValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = args.user ?? {
      whoopUserId: args.fetch.whoopUserId,
      connectedAt: now,
      updatedAt: now,
    };

    const existingUser = await ctx.db
      .query("whoopUsers")
      .withIndex("by_whoop_user_id", (q) =>
        q.eq("whoopUserId", args.fetch.whoopUserId),
      )
      .unique();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        ...user,
        connectedAt: existingUser.connectedAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("whoopUsers", user);
    }

    await ctx.db.insert("dashboardFetches", args.fetch);

    if (args.body) {
      const existingBody = await ctx.db
        .query("bodyMeasurements")
        .withIndex("by_user", (q) =>
          q.eq("whoopUserId", args.fetch.whoopUserId),
        )
        .unique();

      if (existingBody) {
        await ctx.db.patch(existingBody._id, args.body);
      } else {
        await ctx.db.insert("bodyMeasurements", args.body);
      }
    }

    for (const cycle of args.cycles) {
      const existing = await ctx.db
        .query("cycles")
        .withIndex("by_user_cycle", (q) =>
          q.eq("whoopUserId", cycle.whoopUserId),
        )
        .filter((q) => q.eq(q.field("cycleId"), cycle.cycleId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, cycle);
      } else {
        await ctx.db.insert("cycles", cycle);
      }
    }

    for (const recovery of args.recoveries) {
      const existing = await ctx.db
        .query("recoveries")
        .withIndex("by_user_cycle", (q) =>
          q.eq("whoopUserId", recovery.whoopUserId),
        )
        .filter((q) => q.eq(q.field("cycleId"), recovery.cycleId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, recovery);
      } else {
        await ctx.db.insert("recoveries", recovery);
      }
    }

    for (const sleep of args.sleeps) {
      const existing = await ctx.db
        .query("sleeps")
        .withIndex("by_user_sleep", (q) =>
          q.eq("whoopUserId", sleep.whoopUserId),
        )
        .filter((q) => q.eq(q.field("sleepId"), sleep.sleepId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, sleep);
      } else {
        await ctx.db.insert("sleeps", sleep);
      }
    }

    for (const workout of args.workouts) {
      const existing = await ctx.db
        .query("workouts")
        .withIndex("by_user_workout", (q) =>
          q.eq("whoopUserId", workout.whoopUserId),
        )
        .filter((q) => q.eq(q.field("workoutId"), workout.workoutId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, workout);
      } else {
        await ctx.db.insert("workouts", workout);
      }
    }

    return args.fetch.counts;
  },
});

export const latestDashboardFetches = query({
  args: {
    whoopUserId: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 10, 50);

    return ctx.db
      .query("dashboardFetches")
      .withIndex("by_user_fetched_at", (q) =>
        q.eq("whoopUserId", args.whoopUserId),
      )
      .order("desc")
      .take(limit);
  },
});

export const latestSleeps = query({
  args: {
    whoopUserId: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 10, 50);

    return ctx.db
      .query("sleeps")
      .withIndex("by_user_start", (q) => q.eq("whoopUserId", args.whoopUserId))
      .order("desc")
      .take(limit);
  },
});
