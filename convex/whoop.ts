import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  bodyMeasurementValidator,
  cycleValidator,
  dailySmsSubscriptionValidator,
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

export const upsertDailySmsSubscription = mutation({
  args: {
    subscription: dailySmsSubscriptionValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("dailySmsSubscriptions")
      .withIndex("by_user", (q) =>
        q.eq("whoopUserId", args.subscription.whoopUserId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args.subscription,
        createdAt: existing.createdAt,
        lastSentAt: existing.lastSentAt,
        lastSentSleepId: existing.lastSentSleepId,
        lastSentMessageSid: existing.lastSentMessageSid,
        lastProviderStatus: existing.lastProviderStatus,
        lastError: undefined,
        lastErrorAt: undefined,
        updatedAt: now,
      });

      return existing._id;
    }

    return ctx.db.insert("dailySmsSubscriptions", {
      ...args.subscription,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const dailySmsSubscriptionStatus = query({
  args: {
    whoopUserId: v.number(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("dailySmsSubscriptions")
      .withIndex("by_user", (q) => q.eq("whoopUserId", args.whoopUserId))
      .unique();

    if (!subscription) return null;

    return {
      active: subscription.active,
      recipientPhoneLast4: subscription.recipientPhoneLast4,
      updatedAt: subscription.updatedAt,
      lastSentAt: subscription.lastSentAt,
      lastSentSleepId: subscription.lastSentSleepId,
      lastProviderStatus: subscription.lastProviderStatus,
      lastError: subscription.lastError,
      lastErrorAt: subscription.lastErrorAt,
    };
  },
});

export const activeDailySmsSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("dailySmsSubscriptions")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
  },
});

export const activeDailySmsSubscriptionByUser = query({
  args: {
    whoopUserId: v.number(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("dailySmsSubscriptions")
      .withIndex("by_user", (q) => q.eq("whoopUserId", args.whoopUserId))
      .unique();

    if (!subscription?.active) return null;

    return subscription;
  },
});

export const updateDailySmsSubscriptionTokens = mutation({
  args: {
    whoopUserId: v.number(),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.string(),
    tokenType: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("dailySmsSubscriptions")
      .withIndex("by_user", (q) => q.eq("whoopUserId", args.whoopUserId))
      .unique();

    if (!subscription) return false;

    await ctx.db.patch(subscription._id, {
      encryptedAccessToken: args.encryptedAccessToken,
      encryptedRefreshToken: args.encryptedRefreshToken,
      expiresAt: args.expiresAt,
      scope: args.scope,
      tokenType: args.tokenType,
      updatedAt: Date.now(),
    });

    return true;
  },
});

export const setDailySmsSubscriptionActive = mutation({
  args: {
    whoopUserId: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("dailySmsSubscriptions")
      .withIndex("by_user", (q) => q.eq("whoopUserId", args.whoopUserId))
      .unique();

    if (!subscription) return false;

    await ctx.db.patch(subscription._id, {
      active: args.active,
      updatedAt: Date.now(),
    });

    return true;
  },
});

export const markDailySmsSent = mutation({
  args: {
    whoopUserId: v.number(),
    sentAt: v.string(),
    sleepId: v.string(),
    messageSid: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("dailySmsSubscriptions")
      .withIndex("by_user", (q) => q.eq("whoopUserId", args.whoopUserId))
      .unique();

    if (!subscription) return false;

    await ctx.db.patch(subscription._id, {
      lastSentAt: args.sentAt,
      lastSentSleepId: args.sleepId,
      lastSentMessageSid: args.messageSid,
      lastProviderStatus: args.providerStatus,
      lastError: undefined,
      lastErrorAt: undefined,
      updatedAt: Date.now(),
    });

    return true;
  },
});

export const markDailySmsError = mutation({
  args: {
    whoopUserId: v.number(),
    error: v.string(),
    errorAt: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("dailySmsSubscriptions")
      .withIndex("by_user", (q) => q.eq("whoopUserId", args.whoopUserId))
      .unique();

    if (!subscription) return false;

    await ctx.db.patch(subscription._id, {
      lastError: args.error,
      lastErrorAt: args.errorAt,
      updatedAt: Date.now(),
    });

    return true;
  },
});

export const publicDashboard = query({
  args: {
    whoopUserId: v.optional(v.number()),
    rangeDays: v.number(),
    start: v.string(),
  },
  handler: async (ctx, args) => {
    const rangeDays = Math.min(Math.max(args.rangeDays, 1), 14);
    const limit = 25;
    const latestFetch = args.whoopUserId
      ? null
      : await ctx.db
          .query("dashboardFetches")
          .withIndex("by_fetched_at")
          .order("desc")
          .first();
    const whoopUserId = args.whoopUserId ?? latestFetch?.whoopUserId;

    if (!whoopUserId) {
      return {
        rangeDays,
        start: args.start,
        user: null,
        body: null,
        latestFetch: null,
        latestFetches: [],
        cycles: [],
        recoveries: [],
        sleeps: [],
        workouts: [],
      };
    }

    const user = await ctx.db
      .query("whoopUsers")
      .withIndex("by_whoop_user_id", (q) =>
        q.eq("whoopUserId", whoopUserId),
      )
      .unique();

    const body = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_user", (q) =>
        q.eq("whoopUserId", whoopUserId),
      )
      .unique();

    const [latestFetches, cycles, recoveries, sleeps, workouts] =
      await Promise.all([
        ctx.db
          .query("dashboardFetches")
          .withIndex("by_user_fetched_at", (q) =>
            q.eq("whoopUserId", whoopUserId),
          )
          .order("desc")
          .take(5),
        ctx.db
          .query("cycles")
          .withIndex("by_user_start", (q) =>
            q.eq("whoopUserId", whoopUserId).gte("start", args.start),
          )
          .order("desc")
          .take(limit),
        ctx.db
          .query("recoveries")
          .withIndex("by_user_created_at", (q) =>
            q.eq("whoopUserId", whoopUserId).gte("createdAt", args.start),
          )
          .order("desc")
          .take(limit),
        ctx.db
          .query("sleeps")
          .withIndex("by_user_start", (q) =>
            q.eq("whoopUserId", whoopUserId).gte("start", args.start),
          )
          .order("desc")
          .take(limit),
        ctx.db
          .query("workouts")
          .withIndex("by_user_start", (q) =>
            q.eq("whoopUserId", whoopUserId).gte("start", args.start),
          )
          .order("desc")
          .take(limit),
      ]);

    return {
      rangeDays,
      start: args.start,
      user,
      body,
      latestFetch: latestFetches[0] ?? null,
      latestFetches,
      cycles,
      recoveries,
      sleeps,
      workouts,
    };
  },
});
