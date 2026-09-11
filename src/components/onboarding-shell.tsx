import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";

export const primaryAction = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600 disabled:cursor-not-allowed disabled:opacity-40";
export const secondaryAction = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600 disabled:opacity-40";

export function OnboardingShell({ children, backHref = "/", backLabel = "All devices", wide = false }: {
  children: React.ReactNode; backHref?: string; backLabel?: string; wide?: boolean;
}) {
  return <main className="min-h-screen bg-[#f5f6f3] text-zinc-950">
    <div className={`mx-auto px-5 py-7 sm:px-8 sm:py-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
      <nav aria-label="Main navigation" className="mb-12 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight"><Activity size={22} className="text-lime-700" />PACE<span className="font-normal text-zinc-400">/ your daily rhythm</span></Link>
        <Link href={backHref} prefetch={false} className="inline-flex min-h-11 items-center gap-2 text-sm text-zinc-600 hover:text-zinc-950"><ArrowLeft size={15} /><span>{backLabel}</span></Link>
      </nav>
      {children}
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
        <p>Your wearable. A little more useful.</p><Link href="/privacy" className="min-h-10 content-center underline-offset-4 hover:underline">Privacy</Link>
      </footer>
    </div>
  </main>;
}
