import { NextRequest, NextResponse } from "next/server";
import {
  refreshWhoopTokens,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import { revokeWhoopAccess } from "@/lib/whoop/client";
import { setDailySmsSubscriptionEnabled } from "@/lib/messages/daily-subscriptions";
import {
  clearWhoopCookies,
  getWhoopSession,
  isSessionExpiring,
} from "@/lib/whoop/session";

async function disconnect(request: NextRequest) {
  const session = await getWhoopSession();
  let accessToken = session?.accessToken;

  try {
    if (session?.userId && (process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL)) {
      await setDailySmsSubscriptionEnabled(session.userId, false);
    }
    if (session?.refreshToken && isSessionExpiring(session)) {
      const token = await refreshWhoopTokens(session.refreshToken);
      accessToken = tokenResponseToSession(token, session).accessToken;
    }

    if (accessToken) {
      await revokeWhoopAccess(accessToken);
    }

    const response = NextResponse.redirect(new URL("/whoop", request.url), 303);
    clearWhoopCookies(response);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/setup/connection?auth_error=disconnect_failed", request.url),
      303,
    );
    return response;
  }
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Disconnect from this app." }, { status: 403 });
  return disconnect(request);
}
