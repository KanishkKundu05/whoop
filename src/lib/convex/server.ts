import "server-only";
import { fetchMutation as mutate, fetchQuery as query } from "convex/nextjs";
import type { DefaultFunctionArgs, FunctionReference } from "convex/server";

export function serverSecret() {
  const secret = process.env.WHOOP_SERVER_SECRET;
  if (!secret || secret.length < 32) throw new Error("WHOOP_SERVER_SECRET must match the Convex server secret (32+ characters).");
  return secret;
}

// These functions are only called after the Next.js route authenticates a
// session, cron, or signed webhook and derives the account ID on the server.
export function fetchQuery<Args extends DefaultFunctionArgs, Result>(
  ref: FunctionReference<"query", "public", Args, Result>, args: Args, options: { url?: string },
): Promise<Result> {
  return query(ref as unknown as FunctionReference<"query", "public", { secret: string }, Result>, { ...args, secret: serverSecret() }, options);
}

export function fetchMutation<Args extends DefaultFunctionArgs, Result>(
  ref: FunctionReference<"mutation", "public", Args, Result>, args: Args, options: { url?: string },
): Promise<Result> {
  return mutate(ref as unknown as FunctionReference<"mutation", "public", { secret: string }, Result>, { ...args, secret: serverSecret() }, options);
}
