import { NextRequest, NextResponse } from "next/server";
import { syncWhoopDashboardData } from "@/lib/convex/whoop-sync";
import { getRecentWhoopData } from "@/lib/whoop/client";
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

function parseRange(value: string | null) {
  const range = Number(value);
  return [7, 30, 90].includes(range) ? range : 30;
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
  const syncResult = await syncWhoopDashboardData(data, session);
  const jsonResponse = NextResponse.json(data, {
    headers: {
      "X-Whoop-Convex-Sync": syncResult.ok
        ? "stored"
        : syncResult.skipped
          ? `skipped:${syncResult.reason}`
          : `failed:${syncResult.reason}`,
    },
  });

  if (refreshedSession) {
    setWhoopSessionCookie(jsonResponse, session);
  }

  return jsonResponse;
}
