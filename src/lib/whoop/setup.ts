import "server-only";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

export type WebhookTest = {
  whoopUserId: number; startedAt: number; expiresAt: number;
  receivedAt?: number; eventType?: string; sleepId?: string; traceId?: string;
};

export function setupStorageMissing() {
  const missing: string[] = [];
  if (!(process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL)) missing.push("NEXT_PUBLIC_CONVEX_URL");
  if ((process.env.WHOOP_SETUP_SECRET?.length ?? 0) < 32) missing.push("WHOOP_SETUP_SECRET (32+ characters, also set in Convex)");
  return missing;
}

function options(whoopUserId: number) {
  if (setupStorageMissing().length) throw new Error("Webhook test storage is not configured.");
  return {
    args: { whoopUserId, secret: process.env.WHOOP_SETUP_SECRET! },
    connection: { url: process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL },
  };
}

type Auth = { whoopUserId: number; secret: string };
export async function startWebhookTest(userId: number) {
  const { args, connection } = options(userId);
  return fetchMutation(makeFunctionReference<"mutation", Auth, WebhookTest>("whoopSetup:start"), args, connection);
}
export async function readWebhookTest(userId: number) {
  const { args, connection } = options(userId);
  return fetchQuery(makeFunctionReference<"query", Auth, WebhookTest | null>("whoopSetup:status"), args, connection);
}
export async function recordWebhookTest(userId: number, event: { signedAt: number; eventType: string; sleepId: string; traceId: string }) {
  const { args, connection } = options(userId);
  return fetchMutation(makeFunctionReference<"mutation", Auth & typeof event, boolean>("whoopSetup:receive"), { ...args, ...event }, connection);
}
