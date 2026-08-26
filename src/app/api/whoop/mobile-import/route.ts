import { NextResponse } from "next/server";
import { getRecentWhoopData } from "@/lib/whoop/client";
import {
  refreshWhoopTokens,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import { buildWhoopShareCardPayload } from "@/lib/whoop/share-card";
import {
  clearWhoopCookies,
  getWhoopSession,
  isSessionExpiring,
  setWhoopSessionCookie,
} from "@/lib/whoop/session";
import type {
  Recovery,
  ResourceResult,
  Sleep,
} from "@/lib/whoop/types";

export const dynamic = "force-dynamic";

function getRecords<T>(resource: ResourceResult<{ records?: T[] }>) {
  return resource.data?.records ?? [];
}

function isScored<T extends { score_state?: string; score?: unknown }>(record: T) {
  return record.score_state?.toUpperCase() === "SCORED" && record.score != null;
}

function latestScored<T extends { score_state?: string; score?: unknown }>(records: T[]) {
  return records.find(isScored);
}

function buildImportUrl(payload: ReturnType<typeof buildWhoopShareCardPayload>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `whoopshare://import?payload=${encodedPayload}`;
}

function buildErrorUrl(code: string) {
  return `whoopshare://import-error?code=${encodeURIComponent(code)}`;
}

function redirectToApp(url: string) {
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET() {
  let session = await getWhoopSession();

  if (!session) {
    return redirectToApp(buildErrorUrl("not_connected"));
  }

  let refreshedSession = false;

  if (isSessionExpiring(session)) {
    if (!session.refreshToken) {
      const response = redirectToApp(buildErrorUrl("session_expired"));
      clearWhoopCookies(response);
      return response;
    }

    try {
      const token = await refreshWhoopTokens(session.refreshToken);
      session = tokenResponseToSession(token, session);
      refreshedSession = true;
    } catch {
      const response = redirectToApp(buildErrorUrl("refresh_failed"));
      clearWhoopCookies(response);
      return response;
    }
  }

  const data = await getRecentWhoopData(session.accessToken, 30);
  const latestSleep = latestScored(getRecords<Sleep>(data.sleeps));
  const latestRecovery = latestScored(getRecords<Recovery>(data.recoveries));
  const response = redirectToApp(
    buildImportUrl(
      buildWhoopShareCardPayload({
        memberName: data.profile.data?.first_name,
        recovery: latestRecovery,
        sleep: latestSleep,
      }),
    ),
  );

  if (refreshedSession) {
    setWhoopSessionCookie(response, session);
  }

  return response;
}
