import "server-only";

import {
  getActiveDailySmsSubscriptionByUser,
  markDailySmsSubscriptionError,
  markDailySmsSubscriptionSent,
  saveRefreshedDailySmsSession,
} from "@/lib/messages/daily-subscriptions";
import {
  buildDailySleepDigest,
  isSendableMainSleep,
  latestMainSleep,
} from "@/lib/messages/daily-whoop";
import { sendLinqTextMessage } from "@/lib/messages/linq";
import { decryptSecret } from "@/lib/messages/secure";
import { syncWhoopDashboardData } from "@/lib/convex/whoop-sync";
import { getRecentWhoopData, getWhoopSleep } from "@/lib/whoop/client";
import {
  refreshWhoopTokens,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import { isSessionExpiring } from "@/lib/whoop/session";
import type { DailySmsSubscriptionInput } from "../../../convex/whoopValidators";
import type { Sleep, WhoopSession } from "@/lib/whoop/types";

export type DailyMessageProcessResult = {
  whoopUserId: number;
  ok: boolean;
  status: "sent" | "skipped" | "failed";
  sleepId?: string;
  reason?: string;
  messageId?: string;
};

function records<T>(resource: { data: { records?: T[] } | null }) {
  return resource.data?.records ?? [];
}

function subscriptionToSession(
  subscription: DailySmsSubscriptionInput,
): WhoopSession {
  return {
    accessToken: decryptSecret(subscription.encryptedAccessToken),
    refreshToken: decryptSecret(subscription.encryptedRefreshToken),
    expiresAt: subscription.expiresAt,
    scope: subscription.scope,
    tokenType: subscription.tokenType,
    connectedAt: subscription.connectedAt,
    userId: subscription.whoopUserId,
  };
}

async function ensureFreshSession(subscription: DailySmsSubscriptionInput) {
  let session = subscriptionToSession(subscription);

  if (!isSessionExpiring(session, 5 * 60_000)) {
    return session;
  }

  if (!session.refreshToken) {
    throw new Error("Stored WHOOP session is missing a refresh token.");
  }

  const token = await refreshWhoopTokens(session.refreshToken);
  session = tokenResponseToSession(token, session);
  await saveRefreshedDailySmsSession(subscription.whoopUserId, session);

  return session;
}

async function sendSleepDigest({
  subscription,
  sleep,
}: {
  subscription: DailySmsSubscriptionInput;
  sleep: Sleep;
}): Promise<DailyMessageProcessResult> {
  if (subscription.lastSentSleepId === sleep.id) {
    return {
      whoopUserId: subscription.whoopUserId,
      ok: true,
      status: "skipped",
      sleepId: sleep.id,
      reason: "already_sent",
    };
  }

  const digest = buildDailySleepDigest(sleep);
  const sendResult = await sendLinqTextMessage({
    to: decryptSecret(subscription.encryptedRecipientPhone),
    body: digest.message,
    idempotencyKey: `whoop-daily-sleep-${subscription.whoopUserId}-${sleep.id}`,
  });

  await markDailySmsSubscriptionSent({
    whoopUserId: subscription.whoopUserId,
    sleepId: sleep.id,
    ...(sendResult.id ? { messageSid: sendResult.id } : {}),
    ...(sendResult.status ?? sendResult.service
      ? { providerStatus: sendResult.status ?? sendResult.service }
      : {}),
  });

  return {
    whoopUserId: subscription.whoopUserId,
    ok: true,
    status: "sent",
    sleepId: sleep.id,
    messageId: sendResult.id,
  };
}

function failedResult(
  whoopUserId: number,
  error: unknown,
): DailyMessageProcessResult {
  const message =
    error instanceof Error ? error.message : "Unknown daily message failure.";

  return {
    whoopUserId,
    ok: false,
    status: "failed",
    reason: message,
  };
}

async function recordError(whoopUserId: number, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown daily message failure.";

  await markDailySmsSubscriptionError({
    whoopUserId,
    error: message,
  }).catch(() => null);
}

export async function processDailyMessageSubscription(
  subscription: DailySmsSubscriptionInput,
): Promise<DailyMessageProcessResult> {
  try {
    const session = await ensureFreshSession(subscription);
    const data = await getRecentWhoopData(session.accessToken, 7);
    await syncWhoopDashboardData(data, session);

    const sleep = latestMainSleep(records<Sleep>(data.sleeps));

    if (!sleep) {
      return {
        whoopUserId: subscription.whoopUserId,
        ok: true,
        status: "skipped",
        reason: "no_scored_main_sleep",
      };
    }

    return sendSleepDigest({ subscription, sleep });
  } catch (error) {
    await recordError(subscription.whoopUserId, error);
    return failedResult(subscription.whoopUserId, error);
  }
}

export async function processDailyMessageSleepWebhook({
  whoopUserId,
  sleepId,
}: {
  whoopUserId: number;
  sleepId: string;
}): Promise<DailyMessageProcessResult> {
  const subscription = await getActiveDailySmsSubscriptionByUser(whoopUserId);

  if (!subscription) {
    return {
      whoopUserId,
      ok: true,
      status: "skipped",
      sleepId,
      reason: "no_active_subscription",
    };
  }

  try {
    const session = await ensureFreshSession(subscription);
    const sleep = await getWhoopSleep(session.accessToken, sleepId);

    if (!isSendableMainSleep(sleep)) {
      return {
        whoopUserId,
        ok: true,
        status: "skipped",
        sleepId,
        reason: sleep.nap ? "nap" : sleep.score_state.toLowerCase(),
      };
    }

    return sendSleepDigest({ subscription, sleep });
  } catch (error) {
    await recordError(whoopUserId, error);
    return failedResult(whoopUserId, error);
  }
}
