export const DEFAULT_DAILY_GREETING = "Good morning Mom";

export function formatDailyMessage({ greeting, wakeTime, sleepDuration, sleepStart }: {
  greeting: string; wakeTime: string; sleepDuration: string; sleepStart: string;
}) {
  return `${greeting} - I woke up at ${wakeTime}, slept ${sleepDuration}, and went to sleep at ${sleepStart} last night.`;
}

export function normalizeE164Phone(value: string) {
  const normalized = value.trim().replace(/[()\s.-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Enter a full phone number with + and the country code, like +14155552671.");
  }
  return normalized;
}
