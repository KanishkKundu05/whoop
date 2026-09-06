import { NextRequest, NextResponse } from "next/server";
import { processDailyMessageSleepWebhook } from "@/lib/messages/daily-send";
import {
  parseWhoopWebhookEvent,
  verifyWhoopWebhookSignature,
} from "@/lib/whoop/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.text();

  if (
    !verifyWhoopWebhookSignature({
      body,
      signature: request.headers.get("x-whoop-signature"),
      timestamp: request.headers.get("x-whoop-signature-timestamp"),
    })
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid WHOOP webhook signature." },
      { status: 401 },
    );
  }

  let event;

  try {
    event = parseWhoopWebhookEvent(body);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid webhook body.",
      },
      { status: 400 },
    );
  }

  if (event.type !== "sleep.updated") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "ignored_event_type",
      type: event.type,
      traceId: event.trace_id,
    });
  }

  const result = await processDailyMessageSleepWebhook({
    whoopUserId: event.user_id,
    sleepId: event.id,
  });

  return NextResponse.json({
    ok: result.ok,
    traceId: event.trace_id,
    result,
  });
}
