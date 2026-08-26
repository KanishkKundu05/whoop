import {
  BedDouble,
  Clock3,
  HeartPulse,
  MessageCircle,
  Moon,
} from "lucide-react";
import {
  buildWhoopShareCardPayload,
  formatShareDuration,
} from "@/lib/whoop/share-card";
import type { Recovery, Sleep } from "@/lib/whoop/types";

type WhoopShareCardDemoProps = {
  memberName?: string;
  recovery?: Recovery;
  sleep?: Sleep;
};

function formatNumber(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";

  return value.toLocaleString("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function getRecoveryTone(recoveryScore?: number) {
  if (recoveryScore === undefined) return "bg-zinc-900 text-white";
  if (recoveryScore >= 67) return "bg-lime-600 text-white";
  if (recoveryScore >= 34) return "bg-amber-500 text-zinc-950";
  return "bg-rose-600 text-white";
}

export function WhoopShareCardDemo({
  memberName,
  recovery,
  sleep,
}: WhoopShareCardDemoProps) {
  const payload = buildWhoopShareCardPayload({ memberName, recovery, sleep });
  const { card } = payload;

  return (
    <section className="border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-950">
            Messages share card demo
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
            Demo flow for replying to a friend with a WHOOP sleep and recovery card.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white">
          <MessageCircle size={16} />
          iMessage concept
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)]">
        <div className="flex min-h-96 flex-col gap-4 bg-[#f5f7f8] p-4">
          <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm font-medium text-zinc-950 shadow-sm">
            how u feeling?
          </div>

          <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#007aff] px-4 py-3 text-sm font-medium text-white shadow-sm">
            {payload.summary}
          </div>

          <div className="ml-auto w-full max-w-sm overflow-hidden rounded-2xl rounded-br-md border border-zinc-200 bg-white shadow-sm">
            <div className={`${getRecoveryTone(card.recoveryScore)} px-4 py-3`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                    WHOOP check-in
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">
                    {memberName ?? "WHOOP member"}
                  </h4>
                </div>
                <HeartPulse size={24} />
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-zinc-100">
              <ShareMetric
                icon={<HeartPulse size={16} />}
                label="Recovery"
                value={`${formatNumber(card.recoveryScore)}%`}
              />
              <ShareMetric
                icon={<BedDouble size={16} />}
                label="Sleep"
                value={formatShareDuration(card.sleepDurationMilli)}
              />
              <ShareMetric
                icon={<Clock3 size={16} />}
                label="Woke"
                value={card.wakeTime}
              />
            </div>

            <div className="border-t border-zinc-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <Moon size={16} />
                  Sleep performance
                </span>
                <span className="text-sm font-semibold text-zinc-950">
                  {formatNumber(card.sleepPerformancePercentage)}%
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Shared from latest scored WHOOP sleep and recovery records.
              </p>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <DemoDetail
            label="Message payload"
            value={payload.summary}
          />
          <DemoDetail
            label="Native extension surface"
            value="MSMessagesAppViewController renders the picker; MSMessage carries the summary text and a deep link."
          />
          <DemoDetail
            label="Data contract"
            value="Backend returns wake time, sleep duration, sleep performance, recovery, HRV, RHR, and a privacy-safe card token."
          />
        </div>
      </div>
    </section>
  );
}

function ShareMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-3 py-4 text-center">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
        {icon}
      </div>
      <p className="mt-2 truncate text-lg font-semibold tracking-normal text-zinc-950">
        {value}
      </p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function DemoDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{value}</p>
    </div>
  );
}
