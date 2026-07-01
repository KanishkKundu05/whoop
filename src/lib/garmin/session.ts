import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { GarminOAuthContext, GarminSession } from "./types";

export const GARMIN_SESSION_COOKIE = "__garmin_session";
export const GARMIN_OAUTH_COOKIE = "__garmin_oauth";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_MAX_AGE_SECONDS = 60 * 10;
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
  const secret = process.env.GARMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("GARMIN_SESSION_SECRET must be set to at least 32 characters.");
  }

  return createHash("sha256").update(secret).digest();
}

function encode(value: Buffer) {
  return value.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

function seal<T>(payload: T) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, getSessionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [encode(iv), encode(tag), encode(encrypted)].join(".");
}

function unseal<T>(value: string): T | null {
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

    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function sealGarminSession(session: GarminSession) {
  return seal(session);
}

export function unsealGarminSession(value: string) {
  return unseal<GarminSession>(value);
}

export function unsealGarminOAuthContext(value: string) {
  return unseal<GarminOAuthContext>(value);
}

export async function getGarminSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(GARMIN_SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  return unsealGarminSession(value);
}

export function setGarminSessionCookie(
  response: NextResponse,
  session: GarminSession,
) {
  response.cookies.set(
    GARMIN_SESSION_COOKIE,
    sealGarminSession(session),
    getCookieOptions(SESSION_MAX_AGE_SECONDS),
  );
}

export function setGarminOAuthCookie(
  response: NextResponse,
  context: GarminOAuthContext,
) {
  response.cookies.set(
    GARMIN_OAUTH_COOKIE,
    seal(context),
    getCookieOptions(OAUTH_MAX_AGE_SECONDS),
  );
}

export function clearGarminCookies(response: NextResponse) {
  response.cookies.set(GARMIN_SESSION_COOKIE, "", {
    ...getCookieOptions(0),
    maxAge: 0,
  });
  response.cookies.set(GARMIN_OAUTH_COOKIE, "", {
    ...getCookieOptions(0),
    maxAge: 0,
  });
}

export function clearGarminOAuthCookie(response: NextResponse) {
  response.cookies.set(GARMIN_OAUTH_COOKIE, "", {
    ...getCookieOptions(0),
    maxAge: 0,
  });
}

export function isGarminSessionExpiring(
  session: GarminSession,
  withinMs = 10 * 60 * 1000,
) {
  return session.expiresAt <= Date.now() + withinMs;
}
