import { NextRequest, NextResponse } from "next/server";
import {
  refreshWhoopTokens,
  tokenResponseToSession,
} from "@/lib/whoop/oauth";
import { revokeWhoopAccess } from "@/lib/whoop/client";
import {
  clearWhoopCookies,
  getWhoopSession,
  isSessionExpiring,
} from "@/lib/whoop/session";

async function disconnect(request: NextRequest) {
  const session = await getWhoopSession();
  let accessToken = session?.accessToken;

  try {
    if (session?.refreshToken && isSessionExpiring(session)) {
      const token = await refreshWhoopTokens(session.refreshToken);
      accessToken = tokenResponseToSession(token, session).accessToken;
    }

    if (accessToken) {
      await revokeWhoopAccess(accessToken);
    }

    const response = NextResponse.redirect(new URL("/?disconnected=1", request.url));
    clearWhoopCookies(response);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/?auth_error=disconnect_failed", request.url),
    );
    clearWhoopCookies(response);
    return response;
  }
}

export async function POST(request: NextRequest) {
  return disconnect(request);
}

