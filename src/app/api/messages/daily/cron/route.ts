import { NextRequest, NextResponse } from "next/server";
import {
  getDailySmsConfigStatus,
  listActiveDailySmsSubscriptions,
} from "@/lib/messages/daily-subscriptions";
import { processDailyMessageSubscription } from "@/lib/messages/daily-send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const config = getDailySmsConfigStatus();

  if (!config.isReady) {
    return NextResponse.json(
      {
        ok: false,
        error: "Daily message configuration is incomplete.",
        config,
      },
      { status: 500 },
    );
  }

  const subscriptions = await listActiveDailySmsSubscriptions();
  const results = await Promise.all(
    subscriptions.map(processDailyMessageSubscription),
  );

  return NextResponse.json({
    ok: results.every((result) => result.ok),
    schedule: request.headers.get("x-vercel-cron-schedule"),
    checked: subscriptions.length,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  });
}
