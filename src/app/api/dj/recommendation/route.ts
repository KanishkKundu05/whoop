import { NextResponse } from "next/server";
import { recommendDjSong } from "@/lib/dj/matching";
import { getLatestHeartRateSignal } from "@/lib/whoop/client";
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

export async function GET() {
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

  const signal = await getLatestHeartRateSignal(session.accessToken);

  if (!signal) {
    return NextResponse.json(
      { error: "No WHOOP heart-rate signal is available yet." },
      { status: 404 },
    );
  }

  const jsonResponse = NextResponse.json(recommendDjSong(signal));

  if (refreshedSession) {
    setWhoopSessionCookie(jsonResponse, session);
  }

  return jsonResponse;
}
