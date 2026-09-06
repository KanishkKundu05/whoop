import {
  Activity,
  BedDouble,
  CalendarDays,
  Clock3,
  Dumbbell,
  Gauge,
  HeartPulse,
  LogIn,
  Moon,
  RefreshCw,
  Sunrise,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { MetricTrendChart, type MetricTrendPoint } from "@/components/metric-trend-chart";
import {
  fetchPublicWhoopDashboard,
  getPublicDashboardStatus,
  type PublicWhoopDashboard,
} from "@/lib/whoop/public-dashboard";
import type {
  CycleInput,
  RecoveryInput,
  SleepInput,
  WorkoutInput,
} from "../../../convex/whoopValidators";

export const dynamic = "force-dynamic";

function formatNumber(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatPercent(value?: number | null) {
  return value === undefined || value === null ? "-" : `${formatNumber(value)}%`;
}

function formatDuration(milliseconds?: number | null) {
  if (!milliseconds) return "-";
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

function getLocalDate(value: string, offset?: string) {
  return new Date(
    new Date(value).getTime() + getTimezoneOffsetMilliseconds(offset),
  );
}

function formatLocalDate(value?: string, offset?: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(getLocalDate(value, offset));
}

function formatLocalDateTime(value?: string, offset?: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(getLocalDate(value, offset));
}

function formatClock(value?: string, offset?: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(getLocalDate(value, offset));
}

function getSleepTimeMilliseconds(sleep?: SleepInput) {
  const stages = sleep?.score?.stageSummary;

  if (!stages) return undefined;

  return (
    stages.totalLightSleepTimeMilli +
    stages.totalSlowWaveSleepTimeMilli +
    stages.totalRemSleepTimeMilli
  );
}

function getSleepNeedMilliseconds(sleep?: SleepInput) {
  const needed = sleep?.score?.sleepNeeded;

  if (!needed) return undefined;

  return (
    needed.baselineMilli +
    needed.needFromSleepDebtMilli +
    needed.needFromRecentStrainMilli -
    needed.needFromRecentNapMilli
  );
}

function latestScored<T extends { scoreState: string; score?: unknown }>(
  records: T[],
) {
  return records.find(
    (record) => record.scoreState.toUpperCase() === "SCORED" && record.score,
  );
}

function average(values: Array<number | null | undefined>) {
  const validValues = values.filter((value): value is number => (
    value !== undefined && value !== null && !Number.isNaN(value)
  ));

  if (validValues.length === 0) return undefined;

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function localDateKey(value: string, offset?: string) {
  return getLocalDate(value, offset).toISOString().slice(0, 10);
}

function buildTrendData(data: PublicWhoopDashboard): MetricTrendPoint[] {
  const byDate = new Map<string, MetricTrendPoint & { timestamp: number }>();

  const ensurePoint = (date: string, offset?: string) => {
    const key = localDateKey(date, offset);
    const existing = byDate.get(key);

    if (existing) return existing;

    const point: MetricTrendPoint & { timestamp: number } = {
      label: formatLocalDate(date, offset),
      timestamp: getLocalDate(date, offset).getTime(),
    };
    byDate.set(key, point);
    return point;
  };

  data.recoveries.forEach((record) => {
    if (record.score?.recoveryScore !== undefined) {
      ensurePoint(record.createdAt).recovery = record.score.recoveryScore;
    }
  });

  data.cycles.forEach((record) => {
    if (record.score?.strain !== undefined) {
      ensurePoint(record.start, record.timezoneOffset).strain = record.score.strain;
    }
  });

  data.sleeps.forEach((record) => {
    if (record.score?.sleepPerformancePercentage !== undefined) {
      ensurePoint(record.start, record.timezoneOffset).sleep =
        record.score.sleepPerformancePercentage;
    }
  });

  return [...byDate.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((point) => ({
      label: point.label,
      recovery: point.recovery,
      strain: point.strain,
      sleep: point.sleep,
    }));
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">
              Public WHOOP dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Sleep and strain
            </h1>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
          >
            <LogIn size={16} />
            Owner login
          </Link>
        </header>
        {children}
      </div>
    </main>
  );
}

function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <PublicShell>
      <section className="border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <h2 className="text-lg font-semibold tracking-normal">
          Public dashboard is not configured
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
          Connect WHOOP from the owner dashboard first, let it sync into Convex,
          then set the public WHOOP user id on the server.
        </p>
        <dl className="mt-5 grid gap-3 border-t border-amber-200 pt-4 text-sm md:grid-cols-2">
          <div>
            <dt className="font-medium text-amber-800">Missing env</dt>
            <dd className="mt-1 font-mono text-xs text-amber-950">
              {missing.join(", ")}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-amber-800">Public route</dt>
            <dd className="mt-1 font-mono text-xs text-amber-950">/public</dd>
          </div>
        </dl>
      </section>
    </PublicShell>
  );
}

function SummaryCard({
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

function SleepHistory({ sleeps }: { sleeps: SleepInput[] }) {
  const scoredSleeps = sleeps.filter((sleep) => sleep.score);

  return (
    <section className="border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-950">Past week sleep</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Slept</th>
              <th className="px-4 py-3">Woke</th>
              <th className="px-4 py-3">Asleep</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Efficiency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {scoredSleeps.length ? (
              scoredSleeps.map((sleep) => (
                <tr key={sleep.sleepId}>
                  <td className="px-4 py-3 font-medium text-zinc-950">
                    {formatLocalDate(sleep.end, sleep.timezoneOffset)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatClock(sleep.start, sleep.timezoneOffset)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatClock(sleep.end, sleep.timezoneOffset)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatDuration(getSleepTimeMilliseconds(sleep))}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-950">
                    {formatPercent(sleep.score?.sleepPerformancePercentage)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {formatPercent(sleep.score?.sleepEfficiencyPercentage)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-zinc-500" colSpan={6}>
                  No scored sleep records in the synced week.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WorkoutHistory({ workouts }: { workouts: WorkoutInput[] }) {
  const scoredWorkouts = workouts.filter((workout) => workout.score);

  return (
    <section className="border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-950">Recent strain</h2>
      </div>
      <div className="divide-y divide-zinc-100">
        {scoredWorkouts.length ? (
          scoredWorkouts.slice(0, 6).map((workout) => (
            <div
              key={workout.workoutId}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-950">
                  {workout.sportName}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {formatLocalDateTime(workout.start, workout.timezoneOffset)}
                </p>
              </div>
              <p className="text-right text-sm font-semibold text-zinc-700">
                {formatNumber(workout.score?.strain, 1)} strain
              </p>
            </div>
          ))
        ) : (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">
            No scored workouts in the synced week.
          </div>
        )}
      </div>
    </section>
  );
}

function SyncModelPanel({ data }: { data: PublicWhoopDashboard }) {
  return (
    <section className="border border-zinc-200 bg-white p-5">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
          <RefreshCw size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-normal text-zinc-950">
            How sync works
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            WHOOP does not expose these records publicly. The owner signs in
            with OAuth, this app reads WHOOP with a short-lived bearer token,
            stores the latest records in Convex, and this route renders only
            those stored summaries. Last stored fetch:{" "}
            {formatLocalDateTime(data.latestFetch?.fetchedAt)}.
          </p>
        </div>
      </div>
    </section>
  );
}

function PublicDashboard({ data }: { data: PublicWhoopDashboard }) {
  const latestSleep = latestScored<SleepInput>(
    data.sleeps.filter((sleep) => !sleep.nap),
  ) ?? latestScored<SleepInput>(data.sleeps);
  const latestCycle = latestScored<CycleInput>(data.cycles);
  const latestRecovery = latestScored<RecoveryInput>(data.recoveries);
  const latestWorkout = latestScored<WorkoutInput>(data.workouts);
  const trendData = buildTrendData(data);
  const avgSleep = average(data.sleeps.map(getSleepTimeMilliseconds));
  const avgNeed = average(data.sleeps.map(getSleepNeedMilliseconds));
  const displayName = data.user?.firstName
    ? `${data.user.firstName}'s`
    : "Personal";

  return (
    <PublicShell>
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal">
            {displayName} latest WHOOP read
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Public summary for the last {data.rangeDays} days, updated by owner sync.
          </p>
        </div>
        <p className="text-sm text-zinc-500">
          Synced {formatLocalDateTime(data.latestFetch?.fetchedAt)}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Moon size={20} />}
          label="Sleep quality"
          value={formatPercent(latestSleep?.score?.sleepPerformancePercentage)}
          detail={`${formatDuration(getSleepTimeMilliseconds(latestSleep))} asleep of ${formatDuration(getSleepNeedMilliseconds(latestSleep))} needed`}
          tone="cyan"
        />
        <SummaryCard
          icon={<BedDouble size={20} />}
          label="Slept"
          value={formatClock(latestSleep?.start, latestSleep?.timezoneOffset)}
          detail={`On ${formatLocalDate(latestSleep?.start, latestSleep?.timezoneOffset)}`}
          tone="zinc"
        />
        <SummaryCard
          icon={<Sunrise size={20} />}
          label="Woke"
          value={formatClock(latestSleep?.end, latestSleep?.timezoneOffset)}
          detail={`${formatPercent(latestSleep?.score?.sleepEfficiencyPercentage)} efficiency`}
          tone="lime"
        />
        <SummaryCard
          icon={<Activity size={20} />}
          label="Day strain"
          value={formatNumber(latestCycle?.score?.strain, 1)}
          detail={`${formatNumber(latestCycle?.score?.averageHeartRate)} avg bpm · ${formatNumber(latestWorkout?.score?.strain, 1)} latest workout`}
          tone="rose"
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          icon={<HeartPulse size={20} />}
          label="Recovery"
          value={formatPercent(latestRecovery?.score?.recoveryScore)}
          detail={`${formatNumber(latestRecovery?.score?.hrvRmssdMilli, 1)} ms HRV · ${formatNumber(latestRecovery?.score?.restingHeartRate)} bpm RHR`}
          tone="rose"
        />
        <SummaryCard
          icon={<Clock3 size={20} />}
          label="Avg sleep"
          value={formatDuration(avgSleep)}
          detail={`Average need ${formatDuration(avgNeed)}`}
          tone="cyan"
        />
        <SummaryCard
          icon={<Gauge size={20} />}
          label="Consistency"
          value={formatPercent(latestSleep?.score?.sleepConsistencyPercentage)}
          detail={`${formatNumber(latestSleep?.score?.stageSummary.disturbanceCount)} disturbances latest sleep`}
          tone="lime"
        />
      </section>

      <section className="border border-zinc-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">7-day trend</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Recovery and sleep use percent; strain uses the right axis.
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
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SleepHistory sleeps={data.sleeps} />
        <WorkoutHistory workouts={data.workouts} />
      </section>

      <SyncModelPanel data={data} />

      <section className="grid gap-3 border border-zinc-200 bg-white p-4 text-sm text-zinc-600 md:grid-cols-4">
        <span className="inline-flex items-center gap-2">
          <CalendarDays size={16} />
          Sleeps {data.sleeps.length}
        </span>
        <span className="inline-flex items-center gap-2">
          <Zap size={16} />
          Cycles {data.cycles.length}
        </span>
        <span className="inline-flex items-center gap-2">
          <HeartPulse size={16} />
          Recoveries {data.recoveries.length}
        </span>
        <span className="inline-flex items-center gap-2">
          <Dumbbell size={16} />
          Workouts {data.workouts.length}
        </span>
      </section>
    </PublicShell>
  );
}

export default async function PublicPage() {
  const status = getPublicDashboardStatus();

  if (!status.isReady) {
    return <SetupNotice missing={status.missing} />;
  }

  const data = await fetchPublicWhoopDashboard(7);

  if (!data?.user) {
    return (
      <SetupNotice
        missing={[
          "No synced Convex records for WHOOP_PUBLIC_USER_ID",
        ]}
      />
    );
  }

  return <PublicDashboard data={data} />;
}
