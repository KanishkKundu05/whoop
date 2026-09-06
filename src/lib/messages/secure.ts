import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const CIPHER = "aes-256-gcm";

function getEncryptionKey() {
  const secret = process.env.DAILY_MESSAGE_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("DAILY_MESSAGE_SECRET must be set to at least 32 characters.");
  }

  return createHash("sha256").update(secret).digest();
}

function encode(value: Buffer) {
  return value.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [encode(iv), encode(tag), encode(encrypted)].join(".");
}

export function decryptSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error("Encrypted value is malformed.");
  }

  const decipher = createDecipheriv(CIPHER, getEncryptionKey(), decode(ivValue));
  decipher.setAuthTag(decode(tagValue));

  const decrypted = Buffer.concat([
    decipher.update(decode(encryptedValue)),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
