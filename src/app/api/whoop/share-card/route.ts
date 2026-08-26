import { NextRequest, NextResponse } from "next/server";
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

function parseRange(value: string | null) {
  const range = Number(value);
  return [7, 30, 90].includes(range) ? range : 30;
}

function getRecords<T>(resource: ResourceResult<{ records?: T[] }>) {
  return resource.data?.records ?? [];
}

function isScored<T extends { score_state?: string; score?: unknown }>(record: T) {
  return record.score_state?.toUpperCase() === "SCORED" && record.score != null;
}

function latestScored<T extends { score_state?: string; score?: unknown }>(records: T[]) {
  return records.find(isScored);
}

export async function GET(request: NextRequest) {
  let session = await getWhoopSession();

  if (!session) {
    return NextResponse.json({ error: "Not connected to WHOOP." }, { status: 401 });
  }

  let refreshedSession = false;

  if (isSessionExpiring(session)) {
    if (!session.refreshToken) {
      const response = NextResponse.json(
        { error: "WHOOP session expired. Reconnect your account." },
        { status: 401 },
      );
      clearWhoopCookies(response);
      return response;
    }

    const token = await refreshWhoopTokens(session.refreshToken);
    session = tokenResponseToSession(token, session);
    refreshedSession = true;
  }

  const range = parseRange(request.nextUrl.searchParams.get("range"));
  const data = await getRecentWhoopData(session.accessToken, range);
  const profile = data.profile.data;
  const latestSleep = latestScored(getRecords<Sleep>(data.sleeps));
  const latestRecovery = latestScored(getRecords<Recovery>(data.recoveries));
  const response = NextResponse.json(
    buildWhoopShareCardPayload({
      memberName: profile?.first_name,
      recovery: latestRecovery,
      sleep: latestSleep,
    }),
  );

  if (refreshedSession) {
    setWhoopSessionCookie(response, session);
  }

  return response;
}
