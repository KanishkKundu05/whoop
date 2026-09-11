import "server-only";
import { DEFAULT_DAILY_GREETING, formatDailyMessage } from "@/lib/messages/template";

import type { Sleep } from "@/lib/whoop/types";

export type DailySleepDigest = {
  sleepId: string;
  sleepStart: string;
  wakeTime: string;
  sleepDuration: string;
  message: string;
};

export { normalizeE164Phone } from "@/lib/messages/template";

export function phoneLast4(value: string) {
  return value.slice(-4);
}

function getTimezoneOffsetMilliseconds(offset?: string) {
  if (!offset || offset === "Z") return 0;

  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const [, sign, hours, minutes] = match;
  const multiplier = sign === "-" ? -1 : 1;

  return multiplier * ((Number(hours) * 60 + Number(minutes)) * 60_000);
}

function formatLocalTime(value: string, offset?: string) {
  const localTimestamp =
    new Date(value).getTime() + getTimezoneOffsetMilliseconds(offset);

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(localTimestamp));
}

function formatDuration(milliseconds?: number) {
  if (!milliseconds) return "--";

  const totalMinutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function sleepDurationMilliseconds(sleep: Sleep) {
  const stages = sleep.score?.stage_summary;

  if (!stages) {
    return new Date(sleep.end).getTime() - new Date(sleep.start).getTime();
  }

  return (
    stages.total_light_sleep_time_milli +
    stages.total_slow_wave_sleep_time_milli +
    stages.total_rem_sleep_time_milli
  );
}

export function latestMainSleep(sleeps: Sleep[]) {
  return sleeps
    .filter((sleep) => !sleep.nap)
    .filter(isSendableMainSleep)
    .sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime())[0];
}

export function isSendableMainSleep(sleep: Sleep) {
  return sleep.score_state?.toUpperCase() === "SCORED" && !sleep.nap && !!sleep.score;
}

export function buildDailySleepDigest(sleep: Sleep): DailySleepDigest {
  const sleepStart = formatLocalTime(sleep.start, sleep.timezone_offset);
  const wakeTime = formatLocalTime(sleep.end, sleep.timezone_offset);
  const sleepDuration = formatDuration(sleepDurationMilliseconds(sleep));
  const greeting = process.env.DAILY_MESSAGE_GREETING?.trim() || DEFAULT_DAILY_GREETING;

  return {
    sleepId: sleep.id,
    sleepStart,
    wakeTime,
    sleepDuration,
    message: formatDailyMessage({ greeting, wakeTime, sleepDuration, sleepStart }),
  };
}
