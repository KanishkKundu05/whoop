import "server-only";

import { fetchMutation, fetchQuery } from "@/lib/convex/server";
import { makeFunctionReference } from "convex/server";
import type {
  DailySmsSubscriptionInput,
} from "../../../convex/whoopValidators";
import { encryptSecret } from "@/lib/messages/secure";
import type { WhoopSession } from "@/lib/whoop/types";

type DailySmsSubscriptionStatus = {
  active: boolean;
  recipientPhoneLast4: string;
  updatedAt: number;
  lastSentAt?: string;
  lastSentSleepId?: string;
  lastProviderStatus?: string;
  lastError?: string;
  lastErrorAt?: string;
} | null;

const upsertDailySmsSubscription = makeFunctionReference<
  "mutation",
  { subscription: DailySmsSubscriptionInput },
  string
>("whoop:upsertDailySmsSubscription");

const dailySmsSubscriptionStatus = makeFunctionReference<
  "query",
  { whoopUserId: number },
  DailySmsSubscriptionStatus
>("whoop:dailySmsSubscriptionStatus");

const activeDailySmsSubscriptions = makeFunctionReference<
  "query",
  Record<string, never>,
  DailySmsSubscriptionInput[]
>("whoop:activeDailySmsSubscriptions");

const activeDailySmsSubscriptionByUser = makeFunctionReference<
  "query",
  { whoopUserId: number },
  DailySmsSubscriptionInput | null
>("whoop:activeDailySmsSubscriptionByUser");

const updateDailySmsSubscriptionTokens = makeFunctionReference<
  "mutation",
  {
    whoopUserId: number;
    encryptedAccessToken: string;
    encryptedRefreshToken: string;
    expiresAt: number;
    scope: string;
    tokenType: string;
  },
  boolean
>("whoop:updateDailySmsSubscriptionTokens");

const setDailySmsSubscriptionActive = makeFunctionReference<
  "mutation",
  {
    whoopUserId: number;
    active: boolean;
  },
  boolean
>("whoop:setDailySmsSubscriptionActive");

const markDailySmsSent = makeFunctionReference<
  "mutation",
  {
    whoopUserId: number;
    sentAt: string;
    sleepId: string;
    messageSid?: string;
    providerStatus?: string;
  },
  boolean
>("whoop:markDailySmsSent");

const markDailySmsError = makeFunctionReference<
  "mutation",
  {
    whoopUserId: number;
    error: string;
    errorAt: string;
  },
  boolean
>("whoop:markDailySmsError");

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
}

function requireConvexUrl() {
  const convexUrl = getConvexUrl();

  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL or CONVEX_URL is not configured.");
  }

  return convexUrl;
}

function convexOptions() {
  return {
    url: requireConvexUrl(),
  };
}

export function getDailySmsConfigStatus() {
  const missing: string[] = [];

  try {
    const url = new URL(getConvexUrl() ?? "");
    if (!["https:", "http:"].includes(url.protocol)) missing.push("NEXT_PUBLIC_CONVEX_URL");
  } catch { missing.push("NEXT_PUBLIC_CONVEX_URL"); }
  if (!process.env.DAILY_MESSAGE_SECRET || process.env.DAILY_MESSAGE_SECRET.length < 32) missing.push("DAILY_MESSAGE_SECRET");
  if ((process.env.WHOOP_SERVER_SECRET?.length ?? 0) < 32) missing.push("WHOOP_SERVER_SECRET");
  const transport = process.env.LINQ_TRANSPORT?.trim() || "api";
  if (transport === "cli") {
    if (process.env.NODE_ENV !== "development") missing.push("LINQ_TRANSPORT (cli requires development)");
  } else {
    if (transport !== "api") missing.push("LINQ_TRANSPORT (api or cli)");
    if (!process.env.LINQ_API_KEY?.trim()) missing.push("LINQ_API_KEY");
  }

  return {
    isReady: missing.length === 0,
    missing,
  };
}

export async function saveDailySmsSubscription({
  session,
  whoopUserId,
  recipientPhone,
  recipientPhoneLast4,
}: {
  session: WhoopSession;
  whoopUserId: number;
  recipientPhone: string;
  recipientPhoneLast4: string;
}) {
  if (!session.refreshToken) {
    throw new Error("WHOOP did not provide a refresh token. Reconnect WHOOP.");
  }

  return fetchMutation(
    upsertDailySmsSubscription,
    {
      subscription: {
        whoopUserId,
        encryptedAccessToken: encryptSecret(session.accessToken),
        encryptedRefreshToken: encryptSecret(session.refreshToken),
        encryptedRecipientPhone: encryptSecret(recipientPhone),
        recipientPhoneLast4,
        expiresAt: session.expiresAt,
        scope: session.scope,
        tokenType: session.tokenType,
        connectedAt: session.connectedAt,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    convexOptions(),
  );
}

export async function getDailySmsSubscriptionStatus(whoopUserId: number) {
  return fetchQuery(
    dailySmsSubscriptionStatus,
    {
      whoopUserId,
    },
    convexOptions(),
  );
}

export async function listActiveDailySmsSubscriptions() {
  return fetchQuery(activeDailySmsSubscriptions, {}, convexOptions());
}

export async function getActiveDailySmsSubscriptionByUser(whoopUserId: number) {
  return fetchQuery(
    activeDailySmsSubscriptionByUser,
    {
      whoopUserId,
    },
    convexOptions(),
  );
}

export async function saveRefreshedDailySmsSession(
  whoopUserId: number,
  session: WhoopSession,
) {
  if (!session.refreshToken) {
    throw new Error("WHOOP session is missing a refresh token.");
  }

  return fetchMutation(
    updateDailySmsSubscriptionTokens,
    {
      whoopUserId,
      encryptedAccessToken: encryptSecret(session.accessToken),
      encryptedRefreshToken: encryptSecret(session.refreshToken),
      expiresAt: session.expiresAt,
      scope: session.scope,
      tokenType: session.tokenType,
    },
    convexOptions(),
  );
}

export async function setDailySmsSubscriptionEnabled(
  whoopUserId: number,
  active: boolean,
) {
  return fetchMutation(
    setDailySmsSubscriptionActive,
    {
      whoopUserId,
      active,
    },
    convexOptions(),
  );
}

export async function markDailySmsSubscriptionSent({
  whoopUserId,
  sleepId,
  messageSid,
  providerStatus,
}: {
  whoopUserId: number;
  sleepId: string;
  messageSid?: string;
  providerStatus?: string;
}) {
  return fetchMutation(
    markDailySmsSent,
    {
      whoopUserId,
      sentAt: new Date().toISOString(),
      sleepId,
      ...(messageSid ? { messageSid } : {}),
      ...(providerStatus ? { providerStatus } : {}),
    },
    convexOptions(),
  );
}

export async function markDailySmsSubscriptionError({
  whoopUserId,
  error,
}: {
  whoopUserId: number;
  error: string;
}) {
  return fetchMutation(
    markDailySmsError,
    {
      whoopUserId,
      error: error.slice(0, 1_000),
      errorAt: new Date().toISOString(),
    },
    convexOptions(),
  );
}
