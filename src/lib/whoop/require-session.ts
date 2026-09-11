import "server-only";
import { redirect } from "next/navigation";
import { getWhoopSession, isSessionExpiring } from "@/lib/whoop/session";

export async function requireWhoopSession(nextPath: string) {
  const session = await getWhoopSession();
  if (!session) redirect("/whoop");
  if (isSessionExpiring(session)) {
    if (!session.refreshToken) redirect("/whoop?auth_error=session_expired");
    redirect(`/api/auth/refresh?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}
