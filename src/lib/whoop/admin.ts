import "server-only";
import { getWhoopSession, isSessionExpiring } from "./session";

export async function isWhoopAdmin() {
  const session = await getWhoopSession();
  const owner = process.env.WHOOP_ADMIN_USER_ID?.trim();
  return Boolean(owner && session && !isSessionExpiring(session) && String(session.userId) === owner);
}
