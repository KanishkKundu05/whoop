import { NextRequest, NextResponse } from "next/server";
import {
  getDailySmsConfigStatus,
  getDailySmsSubscriptionStatus,
  saveDailySmsSubscription,
  setDailySmsSubscriptionEnabled,
} from "@/lib/messages/daily-subscriptions";
import { normalizeE164Phone, phoneLast4 } from "@/lib/messages/daily-whoop";
import { getWhoopProfile } from "@/lib/whoop/client";
import {
  refreshWhoopTokens,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import {
  clearWhoopCookies,
  getWhoopSession,
  isSessionExpiring,
  setWhoopSessionCookie,
} from "@/lib/whoop/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getFreshSession() {
  let session = await getWhoopSession();

  if (!session) {
    return { session: null, refreshed: false };
  }

  if (!isSessionExpiring(session, 5 * 60_000)) {
    return { session, refreshed: false };
  }

  if (!session.refreshToken) {
    return { session: null, refreshed: false, expired: true };
  }

  const token = await refreshWhoopTokens(session.refreshToken);
  session = tokenResponseToSession(token, session);

  return { session, refreshed: true };
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  const config = getDailySmsConfigStatus();
  const { session, refreshed, expired } = await getFreshSession();

  if (expired) {
    const response = errorResponse(
      "WHOOP session expired. Reconnect your account.",
      401,
    );
    clearWhoopCookies(response);
    return response;
  }

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        config,
      },
      { status: 401 },
    );
  }

  const whoopUserId = session.userId;

  if (!whoopUserId) {
    return errorResponse("WHOOP user id is not available yet.", 409);
  }

  let status;
  try {
    status = config.missing.includes("NEXT_PUBLIC_CONVEX_URL")
      ? null
      : await getDailySmsSubscriptionStatus(whoopUserId);
  } catch {
    const response = NextResponse.json({
      ok: false, connected: true, config,
      error: "Could not load saved messaging settings. Check Convex configuration and refresh status.",
    }, { status: 503 });
    if (refreshed) setWhoopSessionCookie(response, session);
    return response;
  }
  const response = NextResponse.json({
    ok: true,
    connected: true,
    config,
    subscription: status,
  });

  if (refreshed) {
    setWhoopSessionCookie(response, session);
  }

  return response;
}

export async function POST(request: NextRequest) {
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

  const { session, refreshed, expired } = await getFreshSession();

  if (expired) {
    const response = errorResponse(
      "WHOOP session expired. Reconnect your account.",
      401,
    );
    clearWhoopCookies(response);
    return response;
  }

  if (!session) {
    return errorResponse("Connect WHOOP before setting up daily messages.", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Expected a JSON request body.");
  }

  const recipientPhone =
    body && typeof body === "object" && "recipientPhone" in body
      ? body.recipientPhone
      : undefined;

  if (typeof recipientPhone !== "string") {
    return errorResponse("recipientPhone is required.");
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeE164Phone(recipientPhone);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid phone number.");
  }
  const profile = session.userId
    ? null
    : await getWhoopProfile(session.accessToken).catch(() => null);
  const whoopUserId = profile?.user_id ?? session.userId;

  if (!whoopUserId) {
    return errorResponse("Could not identify the connected WHOOP user.", 409);
  }

  const updatedSession = {
    ...session,
    userId: whoopUserId,
  };

  await saveDailySmsSubscription({
    session: updatedSession,
    whoopUserId,
    recipientPhone: normalizedPhone,
    recipientPhoneLast4: phoneLast4(normalizedPhone),
  });

  const response = NextResponse.json({
    ok: true,
    subscription: {
      active: true,
      recipientPhoneLast4: phoneLast4(normalizedPhone),
    },
  });

  if (refreshed || profile) {
    setWhoopSessionCookie(response, updatedSession);
  }

  return response;
}

export async function DELETE() {
  const { session, refreshed, expired } = await getFreshSession();

  if (expired) {
    const response = errorResponse(
      "WHOOP session expired. Reconnect your account.",
      401,
    );
    clearWhoopCookies(response);
    return response;
  }

  if (!session?.userId) {
    return errorResponse("No connected WHOOP user is available.", 401);
  }

  const disabled = await setDailySmsSubscriptionEnabled(session.userId, false);
  const response = NextResponse.json({ ok: true, disabled });

  if (refreshed) {
    setWhoopSessionCookie(response, session);
  }

  return response;
}
