import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// These functions are server-only in use. Every invocation must authenticate;
// a WHOOP user ID or knowledge of the deployment URL grants no access.
function authorize(secret: string) {
  const expected = process.env.WHOOP_SETUP_SECRET;
  if (!expected || expected.length < 32 || secret !== expected) {
    throw new Error("Setup storage unauthorized. Configure matching WHOOP_SETUP_SECRET values in Next.js and Convex.");
  }
}

const args = { secret: v.string(), whoopUserId: v.number() };

export const start = mutation({
  args,
  handler: async (ctx, args) => {
    authorize(args.secret);
    const previous = await ctx.db.query("whoopSetupTests")
      .withIndex("by_user", q => q.eq("whoopUserId", args.whoopUserId)).unique();
    const test = { whoopUserId: args.whoopUserId, startedAt: Date.now(), expiresAt: Date.now() + 15 * 60_000 };
    if (previous) await ctx.db.replace(previous._id, test);
    else await ctx.db.insert("whoopSetupTests", test);
    return test;
  },
});

export const status = query({
  args,
  handler: async (ctx, args) => {
    authorize(args.secret);
    const test = await ctx.db.query("whoopSetupTests")
      .withIndex("by_user", q => q.eq("whoopUserId", args.whoopUserId)).unique();
    if (!test) return null;
    const { _id, _creationTime, ...result } = test;
    void _id; void _creationTime;
    return result;
  },
});

export const receive = mutation({
  args: { ...args, signedAt: v.number(), eventType: v.string(), sleepId: v.string(), traceId: v.string() },
  handler: async (ctx, args) => {
    authorize(args.secret);
    const test = await ctx.db.query("whoopSetupTests")
      .withIndex("by_user", q => q.eq("whoopUserId", args.whoopUserId)).unique();
    if (!test || test.expiresAt < Date.now() || args.signedAt < test.startedAt) return false;
    // Preserve a successful sleep event if a recovery event arrives afterward.
    if (test.eventType === "sleep.updated") return true;
    await ctx.db.patch(test._id, {
      receivedAt: Date.now(), eventType: args.eventType,
      sleepId: args.sleepId, traceId: args.traceId,
    });
    return true;
  },
});
