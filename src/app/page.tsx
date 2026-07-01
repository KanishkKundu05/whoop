import {
  Activity,
  BadgeCheck,
  BedDouble,
  Brain,
  CalendarRange,
  ChartBarStacked,
  Clock3,
  Download,
  Dumbbell,
  FileText,
  Gauge,
  HeartPulse,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Scale,
  ShieldOff,
  Stethoscope,
  User,
  Watch,
} from "lucide-react";
import { Children } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgenticDj } from "@/components/agentic-dj";
import { MetricTrendChart, type MetricTrendPoint } from "@/components/metric-trend-chart";
import { syncWhoopDashboardData } from "@/lib/convex/whoop-sync";
import { DJ_SONG_CATALOG } from "@/lib/dj/catalog";
import {
  getGarminConfigStatus,
  getGarminRedirectUriFromHeaders,
  getGarminScopeDescription,
} from "@/lib/garmin/config";
import {
  getGarminSession,
  isGarminSessionExpiring,
} from "@/lib/garmin/session";
import type { GarminSession } from "@/lib/garmin/types";
import {
  getConfigStatus,
  getRedirectUriFromHeaders,
  getScopeParam,
} from "@/lib/whoop/config";
import { getRecentWhoopData } from "@/lib/whoop/client";
import {
  getWhoopSession,
  isSessionExpiring,
} from "@/lib/whoop/session";
import type {
  Cycle,
  Recovery,
  ResourceResult,
  Sleep,
  WhoopDashboardData,
  Workout,
} from "@/lib/whoop/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  auth_error?: string | string[];
  disconnected?: string | string[];
  garmin_auth_error?: string | string[];
  garmin_disconnected?: string | string[];
  range?: string | string[];
}>;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseRange(value?: string | string[]) {
  const range = Number(firstParam(value));
  return [7, 30, 90].includes(range) ? range : 30;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatDuration(milliseconds?: number) {
  if (!milliseconds) return "—";
  const totalMinutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatPercent(value?: number | null) {
  return value === undefined || value === null ? "—" : `${formatNumber(value)}%`;
}

function average(values: Array<number | null | undefined>) {
  const validValues = values.filter((value): value is number => (
    value !== undefined && value !== null && !Number.isNaN(value)
  ));

  if (validValues.length === 0) return undefined;

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
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

function getSleepNeedMilliseconds(sleep?: Sleep) {
  const needed = sleep?.score?.sleep_needed;

  if (!needed) return undefined;

  return (
    needed.baseline_milli +
    needed.need_from_sleep_debt_milli +
    needed.need_from_recent_strain_milli -
    needed.need_from_recent_nap_milli
  );
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function getRecords<T>(resource: ResourceResult<{ records?: T[] }>) {
  return resource.data?.records ?? [];
}

function isScored<T extends { score_state?: string; score?: unknown }>(record: T) {
  return record.score_state?.toUpperCase() === "SCORED" && record.score != null;
}

function latestScored<T extends { score_state?: string; score?: unknown }>(records: T[]) {
  return records.find(isScored);
}

function buildTrendData(data: WhoopDashboardData): MetricTrendPoint[] {
  const byDate = new Map<string, MetricTrendPoint & { timestamp: number }>();

  const ensurePoint = (date: string) => {
    const key = date.slice(0, 10);
    const existing = byDate.get(key);

    if (existing) return existing;

    const point: MetricTrendPoint & { timestamp: number } = {
      label: formatDate(date),
      timestamp: new Date(date).getTime(),
    };
    byDate.set(key, point);
    return point;
  };

  getRecords<Recovery>(data.recoveries).forEach((record) => {
    if (record.score?.recovery_score !== undefined) {
      ensurePoint(record.created_at).recovery = record.score.recovery_score;
    }
  });

  getRecords<Cycle>(data.cycles).forEach((record) => {
    if (record.score?.strain !== undefined) {
      ensurePoint(record.start).strain = record.score.strain;
    }
  });

  getRecords<Sleep>(data.sleeps).forEach((record) => {
    if (record.score?.sleep_performance_percentage !== undefined) {
      ensurePoint(record.start).sleep = record.score.sleep_performance_percentage;
    }
  });

  return [...byDate.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-30)
    .map((point) => ({
      label: point.label,
      recovery: point.recovery,
      strain: point.strain,
      sleep: point.sleep,
    }));
}

function errorMessage(code?: string) {
  const messages: Record<string, string> = {
    disconnect_failed: "WHOOP access could not be revoked, so the local session was cleared.",
    missing_code: "WHOOP did not return an authorization code.",
    missing_config: "WHOOP credentials are not configured yet.",
    refresh_failed: "WHOOP token refresh failed. Reconnect your account.",
    session_expired: "The WHOOP session expired. Reconnect your account.",
    state_mismatch: "The OAuth state check failed. Start the connection again.",
    token_exchange_failed: "The WHOOP authorization code could not be exchanged.",
  };

  return code ? messages[code] ?? `WHOOP auth error: ${code}` : null;
}

function garminErrorMessage(code?: string) {
  const messages: Record<string, string> = {
    disconnect_failed: "Garmin access could not be revoked, so the local session was cleared.",
    missing_code: "Garmin did not return an authorization code.",
    missing_config: "Garmin credentials are not configured yet.",
    refresh_failed: "Garmin token refresh failed. Reconnect your account.",
    session_expired: "The Garmin session expired. Reconnect your account.",
    state_mismatch: "The Garmin OAuth state check failed. Start the connection again.",
    token_exchange_failed: "The Garmin authorization code could not be exchanged.",
  };

  return code ? messages[code] ?? `Garmin auth error: ${code}` : null;
}

async function getDisplayRedirectUris() {
  const headerStore = await headers();
  return {
    garmin: getGarminRedirectUriFromHeaders(headerStore),
    whoop: getRedirectUriFromHeaders(headerStore),
  };
}

function RangeTabs({ range }: { range: number }) {
  return (
    <div className="flex rounded-lg border border-zinc-200 bg-white p-1">
      {[7, 30, 90].map((option) => (
        <Link
          key={option}
          href={`/?range=${option}`}
          className={[
            "flex h-9 min-w-14 items-center justify-center rounded-md px-3 text-sm font-medium transition",
            range === option
              ? "bg-zinc-950 text-white"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
          ].join(" ")}
        >
          {option}d
        </Link>
      ))}
    </div>
  );
}

function Shell({
  children,
  connected,
}: {
  children: React.ReactNode;
  connected?: boolean;
}) {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">
              WHOOP API
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Personal performance dashboard
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/privacy"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
            >
              <FileText size={16} />
              Privacy
            </Link>
            {connected ? (
              <>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
                >
                  <RefreshCw size={16} />
                  Refresh
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950">
                    <LogOut size={16} />
                    Sign out
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function ConnectScreen({
  authError,
  disconnected,
  garminAuthError,
  garminDisconnected,
  garminMissing,
  garminRedirectUri,
  garminSession,
  missing,
  redirectUri,
}: {
  authError?: string;
  disconnected?: boolean;
  garminAuthError?: string;
  garminDisconnected?: boolean;
  garminMissing: string[];
  garminRedirectUri: string;
  garminSession?: GarminSession | null;
  missing: string[];
  redirectUri: string;
}) {
  const isReady = missing.length === 0;
  const isGarminReady = garminMissing.length === 0;

  return (
    <Shell>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border border-zinc-200 bg-white p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-lime-300">
            <HeartPulse size={22} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-normal">
            Connect your WHOOP account
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            The app requests profile, body measurement, recovery, cycle, sleep,
            and workout scopes, then keeps refresh tokens in an encrypted
            HTTP-only cookie on this server.
          </p>
          {authError ? (
            <div className="mt-5 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {errorMessage(authError)}
            </div>
          ) : null}
          {disconnected ? (
            <div className="mt-5 border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
              WHOOP access was revoked and the local session was cleared.
            </div>
          ) : null}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {isReady ? (
              <a
                href="/api/auth/whoop"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <LogIn size={17} />
                Connect WHOOP
              </a>
            ) : (
              <button
                disabled
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-300 px-4 text-sm font-semibold text-zinc-500"
              >
                <ShieldOff size={17} />
                Configure env
              </button>
            )}
            <a
              href="https://developer-dashboard.whoop.com"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-950"
            >
              <User size={17} />
              Developer dashboard
            </a>
          </div>
        </div>
        <div className="border border-zinc-200 bg-white p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-950 text-emerald-200">
            <Watch size={22} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-normal">
            Connect your Garmin account
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            Garmin uses a separate OAuth 2.0 PKCE flow. This app stores Garmin
            tokens in a separate encrypted HTTP-only cookie and can verify the
            connected user ID and permissions through the Garmin Wellness API.
          </p>
          {garminAuthError ? (
            <div className="mt-5 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {garminErrorMessage(garminAuthError)}
            </div>
          ) : null}
          {garminDisconnected ? (
            <div className="mt-5 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Garmin access was revoked and the local session was cleared.
            </div>
          ) : null}
          {garminSession ? (
            <div className="mt-5 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Connected{garminSession.userId ? ` as ${garminSession.userId}` : ""}.
            </div>
          ) : null}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {garminSession ? (
              <>
                <a
                  href="/api/garmin/diagnostics"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-950"
                >
                  <Stethoscope size={17} />
                  Garmin diagnostics
                </a>
                <form action="/api/auth/garmin/disconnect" method="post">
                  <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:border-rose-600">
                    <ShieldOff size={17} />
                    Revoke Garmin
                  </button>
                </form>
              </>
            ) : isGarminReady ? (
              <a
                href="/api/auth/garmin"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-950 px-4 text-sm font-semibold text-white hover:bg-emerald-900"
              >
                <LogIn size={17} />
                Connect Garmin
              </a>
            ) : (
              <button
                disabled
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-300 px-4 text-sm font-semibold text-zinc-500"
              >
                <ShieldOff size={17} />
                Configure Garmin env
              </button>
            )}
            <a
              href="https://developer.garmin.com/gc-developer-program/overview/"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-950"
            >
              <User size={17} />
              Garmin developer
            </a>
          </div>
        </div>
        <aside className="border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-950">
            First-time setup
          </h3>
          <ol className="mt-4 space-y-3 text-sm text-zinc-700">
            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold text-zinc-950">1</span>
              <span>Create or open a WHOOP developer app.</span>
            </li>
            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold text-zinc-950">2</span>
              <span>Add the redirect URI below to the app.</span>
            </li>
            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold text-zinc-950">3</span>
              <span>Set the required environment variables on this server.</span>
            </li>
            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold text-zinc-950">4</span>
              <span>Restart or redeploy, then connect your WHOOP account.</span>
            </li>
          </ol>
          <dl className="mt-5 space-y-4 border-t border-zinc-200 pt-4 text-sm">
            <div>
              <dt className="font-medium text-zinc-500">Redirect URI</dt>
              <dd className="mt-1 break-all font-mono text-xs text-zinc-900">
                {redirectUri}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Garmin redirect URI</dt>
              <dd className="mt-1 break-all font-mono text-xs text-zinc-900">
                {garminRedirectUri}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Scopes</dt>
              <dd className="mt-1 break-words font-mono text-xs text-zinc-900">
                {getScopeParam()}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Garmin permissions</dt>
              <dd className="mt-1 break-words font-mono text-xs text-zinc-900">
                {getGarminScopeDescription()}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Missing WHOOP env</dt>
              <dd className="mt-1 text-zinc-900">
                {missing.length ? missing.join(", ") : "None"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Missing Garmin env</dt>
              <dd className="mt-1 text-zinc-900">
                {garminMissing.length ? garminMissing.join(", ") : "None"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            The Agentic DJ appears after connection and uses the freshest WHOOP
            heart-rate signal available through the API.
          </p>
        </aside>
      </section>
    </Shell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "rose" | "lime" | "cyan" | "zinc";
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700",
    lime: "bg-lime-50 text-lime-700",
    cyan: "bg-cyan-50 text-cyan-700",
    zinc: "bg-zinc-100 text-zinc-700",
  };

  return (
    <article className="border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          {icon}
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </p>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-normal text-zinc-950">
        {value}
      </p>
      <p className="mt-2 min-h-5 text-sm text-zinc-500">{detail}</p>
    </article>
  );
}

function SleepAnalyser({
  sleeps,
  sleepError,
  range,
}: {
  sleeps: Sleep[];
  sleepError?: string | null;
  range: number;
}) {
  const scoredSleeps = sleeps
    .filter(isScored)
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const mainSleeps = scoredSleeps.filter((sleep) => !sleep.nap);
  const analysedSleeps = mainSleeps.length ? mainSleeps : scoredSleeps;
  const latestSleep = analysedSleeps[0];
  const latestStages = latestSleep?.score?.stage_summary;
  const latestDebt = latestSleep?.score?.sleep_needed.need_from_sleep_debt_milli;
  const averageSleepTime = average(analysedSleeps.map(getSleepTimeMilliseconds));
  const averageSleepNeed = average(analysedSleeps.map(getSleepNeedMilliseconds));
  const averagePerformance = average(
    analysedSleeps.map((sleep) => sleep.score?.sleep_performance_percentage),
  );
  const averageEfficiency = average(
    analysedSleeps.map((sleep) => sleep.score?.sleep_efficiency_percentage),
  );
  const averageConsistency = average(
    analysedSleeps.map((sleep) => sleep.score?.sleep_consistency_percentage),
  );
  const stageSegments = [
    {
      label: "Light",
      value: latestStages?.total_light_sleep_time_milli ?? 0,
      color: "bg-sky-500",
    },
    {
      label: "REM",
      value: latestStages?.total_rem_sleep_time_milli ?? 0,
      color: "bg-violet-500",
    },
    {
      label: "Deep",
      value: latestStages?.total_slow_wave_sleep_time_milli ?? 0,
      color: "bg-lime-500",
    },
    {
      label: "Awake",
      value: latestStages?.total_awake_time_milli ?? 0,
      color: "bg-zinc-400",
    },
  ];
  const stageTotal = stageSegments.reduce((total, segment) => total + segment.value, 0);
  const sleepNotes = buildSleepNotes({
    latestSleep,
    averagePerformance,
    latestDebt,
  });
  const hasSleepSyncError = Boolean(sleepError && sleeps.length === 0);

  return (
    <section className="border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">Sleep analyser</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {sleepError
              ? "Sleep data could not sync from WHOOP"
              : `${analysedSleeps.length} scored ${analysedSleeps.length === 1 ? "sleep" : "sleeps"} in the last ${range} days`}
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800">
          <Moon size={16} />
          Latest {formatPercent(latestSleep?.score?.sleep_performance_percentage)}
        </div>
      </div>

      {hasSleepSyncError ? (
        <div className="mt-5 border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">
            WHOOP did not return sleep records for this session.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            {sleepError}
          </p>
          <a
            href="/api/auth/whoop"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-950 px-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <LogIn size={16} />
            Reconnect WHOOP
          </a>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SleepStat
                icon={<BedDouble size={18} />}
                label="Avg sleep"
                value={formatDuration(averageSleepTime)}
                detail="Main sleep duration"
              />
              <SleepStat
                icon={<Clock3 size={18} />}
                label="Avg need"
                value={formatDuration(averageSleepNeed)}
                detail="Baseline plus WHOOP load"
              />
              <SleepStat
                icon={<Gauge size={18} />}
                label="Efficiency"
                value={formatPercent(averageEfficiency)}
                detail="Time asleep while in bed"
              />
              <SleepStat
                icon={<ChartBarStacked size={18} />}
                label="Consistency"
                value={formatPercent(averageConsistency)}
                detail="Sleep timing regularity"
              />
            </div>

            <div className="border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-950">
                    Latest stage mix
                  </h4>
                  <p className="mt-1 text-xs text-zinc-500">
                    {latestSleep ? formatDateTime(latestSleep.start) : "No scored sleep"}
                  </p>
                </div>
                <p className="text-right text-sm font-semibold text-zinc-950">
                  {formatDuration(getSleepTimeMilliseconds(latestSleep))}
                </p>
              </div>

              {stageTotal > 0 ? (
                <>
                  <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-zinc-200">
                    {stageSegments.map((segment) => (
                      <span
                        key={segment.label}
                        className={segment.color}
                        style={{ width: `${clampPercent((segment.value / stageTotal) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    {stageSegments.map((segment) => (
                      <div key={segment.label}>
                        <p className="inline-flex items-center gap-1 font-medium text-zinc-700">
                          <span className={`h-2 w-2 rounded-full ${segment.color}`} />
                          {segment.label}
                        </p>
                        <p className="mt-1 text-zinc-500">
                          {formatDuration(segment.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-4 border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">
                  No sleep-stage data in this range
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {sleepNotes.map((note) => (
              <div
                key={note}
                className="flex gap-3 border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"
              >
                <Brain className="mt-0.5 shrink-0 text-cyan-700" size={17} />
                <p className="leading-6">{note}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SleepStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
          {icon}
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </p>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-normal text-zinc-950">
        {value}
      </p>
      <p className="mt-1 min-h-5 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function buildSleepNotes({
  latestSleep,
  averagePerformance,
  latestDebt,
}: {
  latestSleep?: Sleep;
  averagePerformance?: number;
  latestDebt?: number;
}) {
  const notes: string[] = [];
  const performance = latestSleep?.score?.sleep_performance_percentage;
  const efficiency = latestSleep?.score?.sleep_efficiency_percentage;
  const consistency = latestSleep?.score?.sleep_consistency_percentage;

  if (performance === undefined) {
    notes.push("Waiting for a scored sleep before generating a performance read.");
  } else if (performance >= 85) {
    notes.push("Latest sleep covered most of the calculated need.");
  } else if (performance >= 70) {
    notes.push("Latest sleep was serviceable, but still below full WHOOP need.");
  } else {
    notes.push("Latest sleep fell meaningfully short of the calculated need.");
  }

  if (latestDebt !== undefined && latestDebt > 60 * 60 * 1000) {
    notes.push(`${formatDuration(latestDebt)} of current need comes from sleep debt.`);
  } else if (averagePerformance !== undefined && averagePerformance >= 85) {
    notes.push("Average performance is holding in a strong range for this window.");
  } else {
    notes.push("Average performance leaves room for more sleep coverage this window.");
  }

  if (consistency !== undefined && consistency < 70) {
    notes.push("Consistency is the weakest signal; bedtime and wake timing are drifting.");
  } else if (efficiency !== undefined && efficiency < 85) {
    notes.push("Efficiency is below target, with more wake time inside the sleep window.");
  } else {
    notes.push("Efficiency and consistency are not the main limiters in the latest score.");
  }

  return notes;
}

function DataWarning({ data }: { data: WhoopDashboardData }) {
  const failures = [
    ["Profile", data.profile],
    ["Body", data.body],
    ["Cycles", data.cycles],
    ["Recoveries", data.recoveries],
    ["Sleeps", data.sleeps],
    ["Workouts", data.workouts],
  ].filter(([, result]) => (result as ResourceResult<unknown>).error);

  if (failures.length === 0) return null;

  return (
    <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {failures.map(([name]) => name).join(", ")} request
      {failures.length === 1 ? " is" : "s are"} unavailable for this session.
    </div>
  );
}

function EmptyDataNotice({
  range,
  counts,
  source,
}: {
  range: number;
  counts: {
    cycles: number;
    recoveries: number;
    sleeps: number;
    workouts: number;
  };
  source: WhoopDashboardData["source"];
}) {
  const total =
    counts.cycles + counts.recoveries + counts.sleeps + counts.workouts;

  if (total > 0) return null;

  return (
    <section className="border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
            <Stethoscope size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-normal">
              WHOOP returned no metric records
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
              The profile request succeeds, but cycle, recovery, sleep, and
              workout collections are all empty. The app tried the last {range}
              days and {source === "latest_unfiltered" ? "also tried WHOOP's unfiltered latest records." : "did not need the fallback."}
            </p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 text-xs font-semibold sm:grid-cols-4 md:grid-cols-2">
          <span className="border border-amber-200 bg-white px-3 py-2">
            Cycles {counts.cycles}
          </span>
          <span className="border border-amber-200 bg-white px-3 py-2">
            Recovery {counts.recoveries}
          </span>
          <span className="border border-amber-200 bg-white px-3 py-2">
            Sleep {counts.sleeps}
          </span>
          <span className="border border-amber-200 bg-white px-3 py-2">
            Workouts {counts.workouts}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={`/api/whoop/diagnostics?range=${range}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 hover:border-amber-700"
        >
          <Stethoscope size={15} />
          Diagnostics JSON
        </a>
        <a
          href={`/api/whoop/export?range=${range}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 hover:border-amber-700"
        >
          <Download size={15} />
          Raw WHOOP JSON
        </a>
      </div>
    </section>
  );
}

function GarminConnectionPanel({
  missing,
  redirectUri,
  session,
}: {
  missing: string[];
  redirectUri: string;
  session?: GarminSession | null;
}) {
  const isReady = missing.length === 0;

  return (
    <section className="border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
            {session ? <BadgeCheck size={20} /> : <Watch size={20} />}
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-normal text-zinc-950">
              Garmin API
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              {session
                ? `Connected${session.userId ? ` as ${session.userId}` : ""}. Garmin permissions are managed during app setup and user consent.`
                : "Optional Garmin support uses a separate OAuth 2.0 PKCE flow and its own encrypted session cookie."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {session ? (
            <>
              <a
                href="/api/garmin/diagnostics"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
              >
                <Stethoscope size={16} />
                Diagnostics
              </a>
              <form action="/api/auth/garmin/disconnect" method="post">
                <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 hover:border-rose-600">
                  <ShieldOff size={16} />
                  Revoke Garmin
                </button>
              </form>
            </>
          ) : isReady ? (
            <a
              href="/api/auth/garmin"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-950 px-3 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              <LogIn size={16} />
              Connect Garmin
            </a>
          ) : (
            <button
              disabled
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-300 px-3 text-sm font-semibold text-zinc-500"
            >
              <ShieldOff size={16} />
              Configure Garmin
            </button>
          )}
        </div>
      </div>
      <dl className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 text-sm md:grid-cols-3">
        <div>
          <dt className="font-medium text-zinc-500">Redirect URI</dt>
          <dd className="mt-1 break-all font-mono text-xs text-zinc-900">
            {redirectUri}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Permissions</dt>
          <dd className="mt-1 break-words font-mono text-xs text-zinc-900">
            {session?.permissions?.length
              ? session.permissions.join(" ")
              : getGarminScopeDescription()}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Missing env</dt>
          <dd className="mt-1 text-zinc-900">
            {missing.length ? missing.join(", ") : "None"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function Dashboard({
  data,
  garminMissing,
  garminRedirectUri,
  garminSession,
  range,
}: {
  data: WhoopDashboardData;
  garminMissing: string[];
  garminRedirectUri: string;
  garminSession?: GarminSession | null;
  range: number;
}) {
  const cycles = getRecords<Cycle>(data.cycles);
  const recoveries = getRecords<Recovery>(data.recoveries);
  const sleeps = getRecords<Sleep>(data.sleeps);
  const workouts = getRecords<Workout>(data.workouts);

  const latestRecovery = latestScored(recoveries);
  const latestCycle = latestScored(cycles);
  const latestSleep = latestScored(sleeps);
  const latestWorkout = latestScored(workouts);
  const trendData = buildTrendData(data);
  const profile = data.profile.data;
  const body = data.body.data;
  const counts = {
    cycles: cycles.length,
    recoveries: recoveries.length,
    sleeps: sleeps.length,
    workouts: workouts.length,
  };

  return (
    <Shell connected>
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">
            {profile ? `${profile.first_name} ${profile.last_name}` : "WHOOP member"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Last fetched {formatDateTime(data.fetchedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs range={range} />
          <a
            href={`/api/whoop/export?range=${range}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
          >
            <Download size={16} />
            JSON
          </a>
        </div>
      </section>

      <DataWarning data={data} />

      <EmptyDataNotice range={range} counts={counts} source={data.source} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<HeartPulse size={20} />}
          label="Recovery"
          value={`${formatNumber(latestRecovery?.score?.recovery_score)}%`}
          detail={`${formatNumber(latestRecovery?.score?.hrv_rmssd_milli, 1)} ms HRV · ${formatNumber(latestRecovery?.score?.resting_heart_rate)} bpm RHR`}
          tone="rose"
        />
        <MetricCard
          icon={<Activity size={20} />}
          label="Cycle strain"
          value={formatNumber(latestCycle?.score?.strain, 1)}
          detail={`${formatNumber(latestCycle?.score?.average_heart_rate)} avg bpm · ${formatNumber(latestCycle?.score?.kilojoule)} kJ`}
          tone="lime"
        />
        <MetricCard
          icon={<CalendarRange size={20} />}
          label="Sleep"
          value={`${formatNumber(latestSleep?.score?.sleep_performance_percentage)}%`}
          detail={`${formatDuration(latestSleep?.score?.stage_summary.total_in_bed_time_milli)} in bed · ${latestSleep?.nap ? "Nap" : "Main sleep"}`}
          tone="cyan"
        />
        <MetricCard
          icon={<Dumbbell size={20} />}
          label="Workout"
          value={formatNumber(latestWorkout?.score?.strain, 1)}
          detail={`${latestWorkout?.sport_name ?? "No scored workout"} · ${formatNumber(latestWorkout?.score?.average_heart_rate)} avg bpm`}
          tone="zinc"
        />
      </section>

      <SleepAnalyser
        sleeps={sleeps}
        sleepError={data.sleeps.error}
        range={range}
      />

      <GarminConnectionPanel
        missing={garminMissing}
        redirectUri={garminRedirectUri}
        session={garminSession}
      />

      <AgenticDj songs={DJ_SONG_CATALOG} />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border border-zinc-200 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Trend</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Recovery and sleep use the left axis, strain uses the right axis.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-zinc-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-600" />
                Recovery
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan-600" />
                Sleep
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-lime-600" />
                Strain
              </span>
            </div>
          </div>
          <MetricTrendChart data={trendData} />
        </div>

        <aside className="border border-zinc-200 bg-white p-5">
          <h3 className="text-base font-semibold text-zinc-950">Body</h3>
          <dl className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <dt className="inline-flex items-center gap-2 text-sm text-zinc-500">
                <Scale size={16} />
                Weight
              </dt>
              <dd className="text-sm font-semibold text-zinc-950">
                {formatNumber(body?.weight_kilogram, 1)} kg
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm text-zinc-500">Height</dt>
              <dd className="text-sm font-semibold text-zinc-950">
                {formatNumber(body?.height_meter, 2)} m
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm text-zinc-500">Max HR</dt>
              <dd className="text-sm font-semibold text-zinc-950">
                {formatNumber(body?.max_heart_rate)} bpm
              </dd>
            </div>
            <div className="border-t border-zinc-200 pt-4 text-xs leading-5 text-zinc-500">
              {profile?.email ?? "Profile scope unavailable"}
            </div>
          </dl>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <RecordPanel title="Recoveries">
          {recoveries.slice(0, 8).map((record) => (
            <RecordRow
              key={`${record.cycle_id}-${record.sleep_id}`}
              primary={`${formatNumber(record.score?.recovery_score)}%`}
              secondary={`${formatNumber(record.score?.hrv_rmssd_milli, 1)} ms HRV`}
              detail={formatDateTime(record.created_at)}
            />
          ))}
        </RecordPanel>
        <RecordPanel title="Sleeps">
          {sleeps.slice(0, 8).map((record) => (
            <RecordRow
              key={record.id}
              primary={`${formatNumber(record.score?.sleep_performance_percentage)}%`}
              secondary={formatDuration(record.score?.stage_summary.total_in_bed_time_milli)}
              detail={formatDateTime(record.start)}
            />
          ))}
        </RecordPanel>
        <RecordPanel title="Workouts">
          {workouts.slice(0, 8).map((record) => (
            <RecordRow
              key={record.id}
              primary={record.sport_name}
              secondary={`${formatNumber(record.score?.strain, 1)} strain`}
              detail={formatDateTime(record.start)}
            />
          ))}
        </RecordPanel>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-600">
          Connected scopes: <span className="font-mono text-xs">{data.profile.data ? getScopeParam() : "WHOOP session"}</span>
        </p>
        <form action="/api/auth/disconnect" method="post">
          <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 hover:border-rose-600">
            <ShieldOff size={16} />
            Revoke access
          </button>
        </form>
      </section>
    </Shell>
  );
}

function RecordPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const hasChildren = Children.count(children) > 0;

  return (
    <div className="border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      </div>
      <div className="divide-y divide-zinc-100">
        {hasChildren ? children : (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            No records in this range
          </div>
        )}
      </div>
    </div>
  );
}

function RecordRow({
  primary,
  secondary,
  detail,
}: {
  primary: string;
  secondary: string;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-950">{primary}</p>
        <p className="mt-1 truncate text-xs text-zinc-500">{detail}</p>
      </div>
      <p className="text-right text-sm font-semibold text-zinc-700">{secondary}</p>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const authError = firstParam(params.auth_error);
  const disconnected = firstParam(params.disconnected) === "1";
  const garminAuthError = firstParam(params.garmin_auth_error);
  const garminDisconnected = firstParam(params.garmin_disconnected) === "1";
  const redirectUris = await getDisplayRedirectUris();
  const config = getConfigStatus();
  const garminConfig = getGarminConfigStatus();
  const garminSession = await getGarminSession();

  if (!config.isReady) {
    return (
      <ConnectScreen
        authError={authError}
        disconnected={disconnected}
        garminAuthError={garminAuthError}
        garminDisconnected={garminDisconnected}
        garminMissing={garminConfig.missing}
        garminRedirectUri={redirectUris.garmin}
        garminSession={garminSession}
        missing={config.missing}
        redirectUri={redirectUris.whoop}
      />
    );
  }

  const session = await getWhoopSession();

  if (!session) {
    return (
      <ConnectScreen
        authError={authError}
        disconnected={disconnected}
        garminAuthError={garminAuthError}
        garminDisconnected={garminDisconnected}
        garminMissing={garminConfig.missing}
        garminRedirectUri={redirectUris.garmin}
        garminSession={garminSession}
        missing={[]}
        redirectUri={redirectUris.whoop}
      />
    );
  }

  if (isSessionExpiring(session)) {
    if (session.refreshToken) {
      redirect(`/api/auth/refresh?next=${encodeURIComponent(`/?range=${range}`)}`);
    }

    return (
      <ConnectScreen
        authError="session_expired"
        disconnected={false}
        garminAuthError={garminAuthError}
        garminDisconnected={garminDisconnected}
        garminMissing={garminConfig.missing}
        garminRedirectUri={redirectUris.garmin}
        garminSession={garminSession}
        missing={[]}
        redirectUri={redirectUris.whoop}
      />
    );
  }

  if (garminSession && isGarminSessionExpiring(garminSession)) {
    redirect(`/api/auth/garmin/refresh?next=${encodeURIComponent(`/?range=${range}`)}`);
  }

  const data = await getRecentWhoopData(session.accessToken, range);
  await syncWhoopDashboardData(data, session);

  return (
    <Dashboard
      data={data}
      garminMissing={garminConfig.missing}
      garminRedirectUri={redirectUris.garmin}
      garminSession={garminSession}
      range={range}
    />
  );
}
