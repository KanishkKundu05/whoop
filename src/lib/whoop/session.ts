import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { WhoopSession } from "./types";

export const WHOOP_SESSION_COOKIE = "__whoop_session";
export const WHOOP_OAUTH_STATE_COOKIE = "__whoop_oauth_state";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const STATE_MAX_AGE_SECONDS = 60 * 10;
const CIPHER = "aes-256-gcm";

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function getSessionKey() {
  const secret = process.env.WHOOP_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("WHOOP_SESSION_SECRET must be set to at least 32 characters.");
  }

  return createHash("sha256").update(secret).digest();
}

function encode(value: Buffer) {
  return value.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

export function sealSession(session: WhoopSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, getSessionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [encode(iv), encode(tag), encode(encrypted)].join(".");
}

export function unsealSession(value: string): WhoopSession | null {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");

    if (!ivValue || !tagValue || !encryptedValue) {
      return null;
    }

    const decipher = createDecipheriv(CIPHER, getSessionKey(), decode(ivValue));
    decipher.setAuthTag(decode(tagValue));

    const decrypted = Buffer.concat([
      decipher.update(decode(encryptedValue)),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as WhoopSession;
  } catch {
    return null;
  }
}

export async function getWhoopSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(WHOOP_SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  return unsealSession(value);
}

export function setWhoopSessionCookie(
  response: NextResponse,
  session: WhoopSession,
) {
  response.cookies.set(
    WHOOP_SESSION_COOKIE,
    sealSession(session),
    getCookieOptions(SESSION_MAX_AGE_SECONDS),
  );
}

export function setOAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set(
    WHOOP_OAUTH_STATE_COOKIE,
    state,
    getCookieOptions(STATE_MAX_AGE_SECONDS),
  );
}

export function clearWhoopCookies(response: NextResponse) {
  response.cookies.set(WHOOP_SESSION_COOKIE, "", {
    ...getCookieOptions(0),
    maxAge: 0,
  });
  response.cookies.set(WHOOP_OAUTH_STATE_COOKIE, "", {
    ...getCookieOptions(0),
    maxAge: 0,
  });
}

export function isSessionExpiring(session: WhoopSession, withinMs = 60_000) {
  return session.expiresAt <= Date.now() + withinMs;
}

