import { Apple, ArrowUpRight, HeartPulse, Watch } from "lucide-react";
import Link from "next/link";
import { OnboardingShell } from "@/components/onboarding-shell";
import { getWhoopSession, isSessionExpiring } from "@/lib/whoop/session";
import { whoopAuthError } from "@/lib/auth/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const [session, params] = await Promise.all([getWhoopSession(), searchParams]);
  const connected = !!session && !isSessionExpiring(session);
  const error = whoopAuthError(params.auth_error);
  return <OnboardingShell wide>
    <header className="mb-10 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-800">Start with your wearable</p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Find your daily rhythm.</h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-zinc-500">Music that moves with you. A sleep report for someone you care about. Choose your device to get started.</p>
    </header>
    {error && <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
    <div className="grid gap-5 md:grid-cols-3">
      {[{ name: "Garmin", Icon: Watch, description: "A new rhythm for your training." }, { name: "Apple Watch", Icon: Apple, description: "More from the watch you wear every day." }].map(({ name, Icon, description }) => <div key={name} aria-disabled="true" className="flex min-h-72 flex-col rounded-3xl border border-zinc-200 bg-white/60 p-7">
        <Icon size={32} strokeWidth={1.5} className="text-zinc-400" /><h2 className="mt-8 text-2xl font-semibold text-zinc-500">{name}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p><span className="mt-auto pt-7 text-xs font-medium text-zinc-400">Coming soon</span>
      </div>)}
      <Link href={connected ? "/whoop" : "/api/auth/whoop?next=/whoop"} prefetch={false} className="group flex min-h-72 flex-col rounded-3xl bg-zinc-950 p-7 text-white shadow-lg shadow-zinc-950/10 transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600 motion-reduce:transform-none">
        <div className="flex items-center justify-between"><HeartPulse size={32} strokeWidth={1.5} className="text-lime-300" /><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-lime-200">{connected ? "Connected" : "Available now"}</span></div>
        <h2 className="mt-8 text-2xl font-semibold">WHOOP</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Turn your body’s rhythm into music and morning updates.</p><span className="mt-auto flex items-center justify-between pt-7 text-sm font-semibold text-lime-300">{connected ? "Continue with WHOOP" : "Connect WHOOP"}<ArrowUpRight size={20} /></span>
      </Link>
    </div>
    <p className="mt-6 text-sm text-zinc-500">Connect securely with WHOOP, then choose what you’d like to do.</p>
  </OnboardingShell>;
}
