import { NextRequest, NextResponse } from "next/server";
import { parseWhoopWebhookEvent, verifyWhoopWebhookSignature } from "@/lib/whoop/webhook";
import { recordWebhookTest } from "@/lib/whoop/setup";

export const runtime = "nodejs";

// Dedicated diagnostic endpoint: never imports or invokes the message sender.
export async function POST(request: NextRequest) {
  const body = await request.text();
  if (body.length > 16_384) return NextResponse.json({ error: "Body too large." }, { status: 413 });
  const timestamp = request.headers.get("x-whoop-signature-timestamp");
  try {
    if (!verifyWhoopWebhookSignature({ body, timestamp, signature: request.headers.get("x-whoop-signature") })) {
      return NextResponse.json({ error: "Invalid WHOOP signature." }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Configure the WHOOP client secret on this server." }, { status: 503 });
  }
  const signedAt = Number(timestamp);
  if (!Number.isFinite(signedAt) || Math.abs(Date.now() - signedAt) > 5 * 60_000) {
    return NextResponse.json({ error: "Signature timestamp is outside the test window." }, { status: 401 });
  }
  let event;
  try { event = parseWhoopWebhookEvent(body); }
  catch { return NextResponse.json({ error: "Expected a WHOOP v2 event with a string ID." }, { status: 400 }); }
  try {
    const recorded = await recordWebhookTest(event.user_id, {
      signedAt, eventType: event.type, sleepId: event.id, traceId: event.trace_id,
    });
    return NextResponse.json({ ok: true, recorded });
  } catch {
    return NextResponse.json({ error: "Webhook test storage unavailable. Check Convex deployment and setup secret." }, { status: 503 });
  }
}
