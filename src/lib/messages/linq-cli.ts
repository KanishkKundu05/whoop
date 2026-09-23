import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LinqSendResult } from "./linq";

const run = promisify(execFile);

/** Local development only: the CLI does not expose provider idempotency. */
export async function sendLinqCliTextMessage(to: string, body: string): Promise<LinqSendResult> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Linq CLI transport requires NODE_ENV=development. Use the API transport in production.");
  }
  if (!/^\+[1-9]\d{7,14}$/.test(to) || !body.trim()) {
    throw new Error("Linq CLI requires an E.164 recipient and a nonempty message.");
  }

  const binary = process.env.LINQ_CLI_PATH?.trim() || "linq";
  const options = {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    env: {
      ...process.env,
      // Pass credentials through the environment, never process arguments.
      ...(process.env.LINQ_API_KEY?.trim() ? { LINQ_TOKEN: process.env.LINQ_API_KEY.trim() } : {}),
    },
  };
  let version: string;
  try {
    ({ stdout: version } = await run(binary, ["--version"], options));
  } catch {
    throw new Error("Cannot run Linq CLI. Install @linqapp/cli@latest and check LINQ_CLI_PATH.");
  }
  const match = version.match(/(?:@linqapp\/cli\/|^v?)(\d+)\.(\d+)\.(\d+)/);
  if (!match || Number(match[1]) < 2 || (Number(match[1]) === 2 && Number(match[2]) < 6)) {
    throw new Error("Linq CLI 2.6.0 or later is required. Run npm install -g @linqapp/cli@latest.");
  }

  let stdout: string;
  try {
    // execFile passes literal arguments without shell interpolation. Do not retry:
    // a timeout can occur after the provider has already accepted the message.
    ({ stdout } = await run(binary, ["chats", "create", "--to", to, "--message", body, "--json"], options));
  } catch {
    // Child-process errors contain the command/message and potentially credentials.
    throw new Error("Linq CLI send failed or timed out. Check linq whoami, the default sending line, and inbound-first contact activation. Check chat history before retrying; delivery may already have occurred.");
  }
  try {
    const data = JSON.parse(stdout);
    const chat = data?.chat;
    const message = chat?.message;
    if (typeof chat?.id !== "string" || typeof message?.id !== "string") throw new Error();
    return {
      id: message.id,
      chatId: chat.id,
      status: typeof message.delivery_status === "string" ? message.delivery_status : "accepted",
      service: typeof message.service === "string" ? message.service : undefined,
      raw: data,
    };
  } catch {
    throw new Error("Linq CLI returned an unexpected response. Check chat history before retrying; delivery may already have occurred.");
  }
}
