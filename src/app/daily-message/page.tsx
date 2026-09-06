import { Bell, FileText, LogIn, Stethoscope } from "lucide-react";
import Link from "next/link";
import { DailyMessageSetup } from "@/components/daily-message-setup";
import { getDailySmsConfigStatus } from "@/lib/messages/daily-subscriptions";
import { getConfigStatus } from "@/lib/whoop/config";
import { getWhoopSession } from "@/lib/whoop/session";

export const dynamic = "force-dynamic";

function DailyMessageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">
              Linq daily message
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              Mom text setup
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
            >
              <Stethoscope size={16} />
              Dashboard
            </Link>
            <Link
              href="/privacy"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
            >
              <FileText size={16} />
              Privacy
            </Link>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export default async function DailyMessagePage() {
  const [session, whoopConfig, dailyConfig] = await Promise.all([
    getWhoopSession(),
    getConfigStatus(),
    getDailySmsConfigStatus(),
  ]);

  if (!session) {
    return (
      <DailyMessageShell>
        <section className="border border-zinc-200 bg-white p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-lime-300">
            <Bell size={22} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-normal">
            Connect WHOOP first
          </h2>
          <div className="mt-7">
            <a
              href="/api/auth/whoop?next=/daily-message"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              <LogIn size={17} />
              Connect WHOOP
            </a>
          </div>
        </section>
      </DailyMessageShell>
    );
  }

  return (
    <DailyMessageShell>
      {whoopConfig.isReady && dailyConfig.isReady ? null : (
        <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Missing environment variables:{" "}
          {[...whoopConfig.missing, ...dailyConfig.missing].join(", ")}
        </div>
      )}
      <DailyMessageSetup />
    </DailyMessageShell>
  );
}
