import "server-only";

export type LinqPreferredService = "iMessage" | "RCS" | "SMS";

export type LinqSendResult = {
  id?: string;
  status?: string;
  chatId?: string;
  service?: string;
  raw: unknown;
};

const LINQ_MESSAGES_URL = "https://api.linqapp.com/api/partner/v3/messages";

function getLinqApiKey() {
  const apiKey = process.env.LINQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("LINQ_API_KEY is not configured.");
  }

  return apiKey;
}

function getPreferredService(): LinqPreferredService | undefined {
  const value = process.env.LINQ_PREFERRED_SERVICE?.trim();

  if (value === "iMessage" || value === "RCS" || value === "SMS") {
    return value;
  }

  return undefined;
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export async function sendLinqTextMessage({
  to,
  body,
  idempotencyKey,
}: {
  to: string;
  body: string;
  idempotencyKey: string;
}): Promise<LinqSendResult> {
  const transport = process.env.LINQ_TRANSPORT?.trim() || "api";
  if (transport === "cli") {
    const { sendLinqCliTextMessage } = await import("./linq-cli");
    return sendLinqCliTextMessage(to, body);
  }
  if (transport !== "api") throw new Error("LINQ_TRANSPORT must be api or cli.");
  const preferredService = getPreferredService();
  const payload = {
    to: [to],
    message: {
      ...(preferredService ? { preferred_service: preferredService } : {}),
      idempotency_key: idempotencyKey,
      parts: [
        {
          type: "text",
          value: body,
        },
      ],
    },
  };

  const response = await fetch(LINQ_MESSAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getLinqApiKey()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = text;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Linq message request failed with ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const object = data && typeof data === "object" ? data : {};
  const firstMessage =
    "messages" in object &&
    Array.isArray(object.messages) &&
    object.messages[0] &&
    typeof object.messages[0] === "object"
      ? object.messages[0]
      : {};

  return {
    id:
      stringField("id" in object ? object.id : undefined) ??
      stringField("message_id" in object ? object.message_id : undefined) ??
      stringField("id" in firstMessage ? firstMessage.id : undefined),
    status:
      stringField("status" in object ? object.status : undefined) ??
      stringField("status" in firstMessage ? firstMessage.status : undefined),
    chatId:
      stringField("chat_id" in object ? object.chat_id : undefined) ??
      stringField("chat_id" in firstMessage ? firstMessage.chat_id : undefined),
    service:
      stringField("service" in object ? object.service : undefined) ??
      stringField("service" in firstMessage ? firstMessage.service : undefined),
    raw: data,
  };
}
