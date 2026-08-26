import type { Recovery, Sleep } from "@/lib/whoop/types";

export type WhoopShareCardPayload = {
  generatedAt: string;
  summary: string;
  card: {
    memberName?: string;
    recoveryLabel: string;
    recoveryScore?: number;
    sleepDurationMilli?: number;
    sleepPerformancePercentage?: number;
    wakeTime: string;
    hrvRmssdMilli?: number;
    restingHeartRate?: number;
  };
  privacy: {
    expiresAt: string;
    includesRawRecords: false;
  };
};

function formatNumber(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";

  return value.toLocaleString("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function formatShareDuration(milliseconds?: number) {
  if (!milliseconds) return "--";

  const totalMinutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function getTimezoneOffsetMilliseconds(offset?: string) {
  if (!offset || offset === "Z") return 0;

  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const [, sign, hours, minutes] = match;
  const multiplier = sign === "-" ? -1 : 1;

  return multiplier * ((Number(hours) * 60 + Number(minutes)) * 60_000);
}

function formatLocalTime(value?: string, offset?: string) {
  if (!value) return "--";

  const localTimestamp = new Date(value).getTime() + getTimezoneOffsetMilliseconds(offset);

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(localTimestamp));
}

function getSleepTimeMilliseconds(sleep?: Sleep) {
  const stages = sleep?.score?.stage_summary;

  if (!stages) return undefined;

  return (
    stages.total_light_sleep_time_milli +
    stages.total_slow_wave_sleep_time_milli +
    stages.total_rem_sleep_time_milli
  );
}

function getRecoveryLabel(recoveryScore?: number) {
  if (recoveryScore === undefined) return "waiting on recovery";
  if (recoveryScore >= 67) return "feeling ready";
  if (recoveryScore >= 34) return "feeling okay";
  return "taking it easy";
}

export function buildWhoopShareCardPayload({
  generatedAt = new Date(),
  memberName,
  recovery,
  sleep,
}: {
  generatedAt?: Date;
  memberName?: string;
  recovery?: Recovery;
  sleep?: Sleep;
}): WhoopShareCardPayload {
  const recoveryScore = recovery?.score?.recovery_score;
  const recoveryLabel = getRecoveryLabel(recoveryScore);
  const sleepDurationMilli = getSleepTimeMilliseconds(sleep);
  const wakeTime = formatLocalTime(sleep?.end, sleep?.timezone_offset);
  const expiresAt = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    generatedAt: generatedAt.toISOString(),
    summary: `I'm ${recoveryLabel}: ${formatNumber(recoveryScore)}% recovery, ${formatShareDuration(sleepDurationMilli)} sleep, woke up at ${wakeTime}.`,
    card: {
      memberName,
      recoveryLabel,
      recoveryScore,
      sleepDurationMilli,
      sleepPerformancePercentage: sleep?.score?.sleep_performance_percentage,
      wakeTime,
      hrvRmssdMilli: recovery?.score?.hrv_rmssd_milli,
      restingHeartRate: recovery?.score?.resting_heart_rate,
    },
    privacy: {
      expiresAt: expiresAt.toISOString(),
      includesRawRecords: false,
    },
  };
}
