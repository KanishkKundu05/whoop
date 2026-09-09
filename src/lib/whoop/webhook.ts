import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type WhoopWebhookEvent = {
  user_id: number;
  id: string;
  type:
    | "workout.updated"
    | "workout.deleted"
    | "sleep.updated"
    | "sleep.deleted"
    | "recovery.updated"
    | "recovery.deleted"
    | string;
  trace_id: string;
};

function getWebhookSecret() {
  return process.env.WHOOP_WEBHOOK_SECRET?.trim() || process.env.WHOOP_CLIENT_SECRET;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function verifyWhoopWebhookSignature({
  body,
  signature,
  timestamp,
}: {
  body: string;
  signature: string | null;
  timestamp: string | null;
}) {
  const secret = getWebhookSecret();

  if (!secret) {
    throw new Error("WHOOP_WEBHOOK_SECRET or WHOOP_CLIENT_SECRET is not configured.");
  }

  if (!signature || !timestamp) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}${body}`)
    .digest("base64");

  return safeCompare(signature, expected);
}

export function parseWhoopWebhookEvent(body: string): WhoopWebhookEvent {
  const parsed = JSON.parse(body) as unknown;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("WHOOP webhook body must be an object.");
  }

  const event = parsed as Partial<WhoopWebhookEvent>;

  if (
    typeof event.user_id !== "number" ||
    typeof event.id !== "string" ||
    typeof event.type !== "string" ||
    typeof event.trace_id !== "string"
  ) {
    throw new Error("WHOOP webhook body is missing required fields.");
  }

  return {
    user_id: event.user_id,
    id: event.id,
    type: event.type,
    trace_id: event.trace_id,
  };
}
