import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION = "__spotify_session";
export const STATE = "__spotify_state";
export const SCOPES = "user-library-read user-read-playback-state user-modify-playback-state";
export type Session = { accessToken: string; refreshToken: string; expiresAt: number };
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export class ApiError extends Error {
  constructor(message: string, public status = 502, public retryAfter?: string) { super(message); }
}

export function config() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const secret = process.env.SPOTIFY_SESSION_SECRET;
  if (!clientId || !clientSecret || !redirectUri || !secret || secret.length < 32) {
    throw new ApiError("Spotify is not configured. Set the Spotify environment variables listed in the setup guide.", 503);
  }
  return { clientId, clientSecret, redirectUri, secret };
}

export function seal(session: Session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(config().secret).digest(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(x => x.toString("base64url")).join(".");
}

export async function readSession(): Promise<Session | null> {
  const value = (await cookies()).get(SESSION)?.value;
  if (!value) return null;
  try {
    const [iv, tag, data] = value.split(".").map(x => Buffer.from(x, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(config().secret).digest(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString());
  } catch { return null; }
}

export async function token(body: URLSearchParams, previous?: Session): Promise<Session> {
  const c = config();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body, cache: "no-store", signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new ApiError("Spotify authorization expired or failed. Reconnect Spotify.", response.status === 429 ? 429 : 401, response.headers.get("retry-after") ?? undefined);
  const data = await response.json();
  if (!data.access_token || !(data.refresh_token || previous?.refreshToken)) throw new ApiError("Spotify did not return usable credentials.", 401);
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? previous?.refreshToken, expiresAt: Date.now() + data.expires_in * 1000 };
}

export async function spotify<T>(session: Session, path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const messages: Record<number, string> = { 401: "Reconnect Spotify to renew access.", 403: "Spotify denied access. Check Premium, app access, and granted permissions.", 404: "Open Spotify and start a song on your playback device.", 429: "Spotify rate limit reached. Try again after the indicated delay." };
    throw new ApiError(messages[response.status] ?? "Spotify request failed.", response.status, response.headers.get("retry-after") ?? undefined);
  }
  return response.status === 204 ? null as T : response.json();
}
