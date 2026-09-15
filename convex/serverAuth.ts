export function requireServerSecret(secret: string) {
  const expected = process.env.WHOOP_SERVER_SECRET;
  if (!expected || expected.length < 32 || secret !== expected) {
    throw new Error("Unauthorized server request");
  }
}
