import { NextRequest, NextResponse } from "next/server";
import { makeFunctionReference } from "convex/server";
import { fetchMutation } from "@/lib/convex/server";
import { getWhoopProfile, revokeWhoopAccess, WhoopApiError } from "@/lib/whoop/client";
import { getWhoopSession, clearWhoopCookies } from "@/lib/whoop/session";

const deleteBatch = makeFunctionReference<"mutation", { whoopUserId: number }, boolean>("whoop:deleteAccountBatch");
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function DELETE(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "Manage your account from this app." }, 403);
  const session = await getWhoopSession();
  if (!session) return json({ error: "Connect WHOOP to manage your data." }, 401);
  try {
    // Never accept a target account from the request body or query string.
    const whoopUserId = session.userId ?? (await getWhoopProfile(session.accessToken)).user_id;
    const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
    if (url) {
      let remaining = true;
      for (let batch = 0; remaining && batch < 100; batch++) remaining = await fetchMutation(deleteBatch, { whoopUserId }, { url });
      if (remaining) return json({ error: "Some records remain. Run deletion again to finish." }, 503);
    }
    let accessRevoked = true;
    try { await revokeWhoopAccess(session.accessToken); }
    catch (error) {
      // An expired token does not prove that the underlying grant was revoked.
      accessRevoked = false;
      if (!(error instanceof WhoopApiError)) console.warn("[whoop:revoke_unavailable]");
    }
    const response = json({ ok: true, accessRevoked });
    clearWhoopCookies(response);
    return response;
  } catch { return json({ error: "We couldn’t finish deleting your data. Please retry." }, 503); }
}
