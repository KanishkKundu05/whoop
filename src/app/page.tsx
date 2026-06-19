import {
  Activity,
  CalendarRange,
  Download,
  Dumbbell,
  FileText,
  HeartPulse,
  LogIn,
  LogOut,
  RefreshCw,
  Scale,
  ShieldOff,
  User,
} from "lucide-react";
import { Children } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgenticDj } from "@/components/agentic-dj";
import { MetricTrendChart, type MetricTrendPoint } from "@/components/metric-trend-chart";
import { DJ_SONG_CATALOG } from "@/lib/dj/catalog";
import { getConfigStatus, getScopeParam } from "@/lib/whoop/config";
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

function getRecords<T>(resource: ResourceResult<{ records?: T[] }>) {
  return resource.data?.records ?? [];
}

function latestScored<T extends { score_state: string; score?: unknown }>(records: T[]) {
  return records.find((record) => record.score_state === "SCORED" && record.score);
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

async function getDisplayRedirectUri() {
  if (process.env.WHOOP_REDIRECT_URI) {
    return process.env.WHOOP_REDIRECT_URI;
  }

  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}/api/auth/whoop/callback`;
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
  missing,
  redirectUri,
}: {
  authError?: string;
  disconnected?: boolean;
  missing: string[];
  redirectUri: string;
}) {
  const isReady = missing.length === 0;

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
              <dt className="font-medium text-zinc-500">Scopes</dt>
              <dd className="mt-1 break-words font-mono text-xs text-zinc-900">
                {getScopeParam()}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Missing env</dt>
              <dd className="mt-1 text-zinc-900">
                {missing.length ? missing.join(", ") : "None"}
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

function Dashboard({ data, range }: { data: WhoopDashboardData; range: number }) {
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
  const redirectUri = await getDisplayRedirectUri();
  const config = getConfigStatus();

  if (!config.isReady) {
    return (
      <ConnectScreen
        authError={authError}
        disconnected={disconnected}
        missing={config.missing}
        redirectUri={redirectUri}
      />
    );
  }

  const session = await getWhoopSession();

  if (!session) {
    return (
      <ConnectScreen
        authError={authError}
        disconnected={disconnected}
        missing={[]}
        redirectUri={redirectUri}
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
        missing={[]}
        redirectUri={redirectUri}
      />
    );
  }

  const data = await getRecentWhoopData(session.accessToken, range);

  return <Dashboard data={data} range={range} />;
}
