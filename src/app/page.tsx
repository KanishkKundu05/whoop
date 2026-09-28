import { ArrowRight, Headphones, HeartPulse, Moon } from "lucide-react";
import Link from "next/link";
import { OnboardingShell, primaryAction, secondaryAction } from "@/components/onboarding-shell";
import { getWhoopSession } from "@/lib/whoop/session";
import { whoopAuthError } from "@/lib/auth/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const [session, params] = await Promise.all([getWhoopSession(), searchParams]);
  const error = whoopAuthError(params.auth_error);
  return <OnboardingShell wide backHref={session ? "/dashboard" : "/demo"} backLabel={session ? "Open dashboard" : "Explore demo"}>
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-800">Made for your WHOOP</p>
        <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">Your rhythm.<br />More possibilities.</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600">Understand your sleep. Move with your music. Send a morning update to someone you care about.</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={session ? "/dashboard" : "/setup/connection"} prefetch={false} className={primaryAction}>{session ? "Open dashboard" : "Connect WHOOP"}<ArrowRight size={18} /></Link>
          <Link href="/demo" className={secondaryAction}>Try a demo</Link>
        </div>
        <p className="mt-4 text-sm text-zinc-500">Explore sample data without an account. Connect WHOOP when you’re ready.</p>
      </header>
      <section aria-label="Sample dashboard preview" className="rounded-3xl bg-zinc-950 p-7 text-white sm:p-9">
        <div className="flex items-center justify-between gap-4"><HeartPulse className="text-lime-300" size={30} /><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">Sample data</span></div>
        <p className="mt-8 text-sm text-zinc-400">A little more in tune with you.</p><h2 className="mt-2 text-2xl font-semibold">Your morning, at a glance.</h2>
        <dl className="mt-8 grid grid-cols-2 gap-6"><div><dt className="text-sm text-zinc-400">Time asleep</dt><dd className="mt-2 text-3xl font-semibold">7h 34m</dd></div><div><dt className="text-sm text-zinc-400">Recovery</dt><dd className="mt-2 text-3xl font-semibold text-lime-300">82%</dd></div></dl>
        <Link href="/demo" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-lime-300">Explore the sample dashboard<ArrowRight size={17} /></Link>
      </section>
    </div>
    <div className="mt-12 grid gap-5 sm:grid-cols-3">
      {[{ Icon: HeartPulse, title: "See your day", text: "Sleep, recovery, strain, and trends in one place." }, { Icon: Headphones, title: "Find your pace", text: "Match Spotify songs to your heart rate. Requires Premium and a Bluetooth-capable browser." }, { Icon: Moon, title: "Make mornings closer", text: "Opt in to a sleep update for someone you care about, after WHOOP processes your sleep." }].map(({ Icon, title, text }) => <section key={title} className="rounded-2xl border border-zinc-200 bg-white p-6"><Icon size={24} className="text-lime-700" /><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p></section>)}
    </div>
    <p className="mt-6 text-sm text-zinc-500">Available now for WHOOP. Garmin and Apple Watch experiences are coming later.</p>
  </OnboardingShell>;
}
