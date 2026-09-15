import Link from "next/link";
import { ArrowRight, Check, Headphones, Moon, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { OnboardingShell, primaryAction } from "@/components/onboarding-shell";
import { getWhoopSession, isSessionExpiring } from "@/lib/whoop/session";
import { getConfigStatus } from "@/lib/whoop/config";
import { whoopAuthError } from "@/lib/auth/navigation";

export default async function WhoopPage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const [session, params] = await Promise.all([getWhoopSession(), searchParams]);
  const config = getConfigStatus();
  if (session && isSessionExpiring(session) && session.refreshToken && !params.auth_error) redirect("/api/auth/refresh?next=/whoop");
  const connected = !!session && !isSessionExpiring(session);
  const error = whoopAuthError(params.auth_error) ?? (session && !connected ? whoopAuthError("session_expired") : null);
  return <OnboardingShell>
    {connected ? <>
      <p className="inline-flex items-center gap-2 rounded-full bg-lime-100 px-3 py-2 text-xs font-medium text-lime-900"><Check size={14} />WHOOP connected</p>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">What’s your next move?</h1>
      <p className="mt-4 text-base leading-7 text-zinc-500">Your account is connected. Choose an experience to get started. You can always come back for the other.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[{ href: "/whoop/music", Icon: Headphones, title: "Sync your pace to music", description: "Find music that matches your latest WHOOP heart-rate signal.", cta: "Find your rhythm" }, { href: "/setup", Icon: Moon, title: "Morning sleep texts", description: "Share a sleep report with someone you care about, automatically.", cta: "Set up morning texts" }].map(({ href, Icon, title, description, cta }) => <Link key={href} href={href} prefetch={false} className="group flex flex-col rounded-3xl border border-zinc-200 bg-white p-7 transition hover:border-lime-500 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-600">
          <span className="w-fit rounded-2xl bg-lime-100 p-3 text-lime-900"><Icon size={26} /></span><h2 className="mt-6 text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p><span className="mt-auto flex items-center justify-between gap-2 pt-8 text-sm font-semibold">{cta}<ArrowRight size={18} /></span>
        </Link>)}
      </div>
      <Link href="/setup/connection" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-zinc-600 underline underline-offset-4">WHOOP connection settings<ArrowRight size={15} /></Link>
      <form action="/api/auth/logout" method="post" className="mt-6"><button className="min-h-11 text-sm text-zinc-500 underline underline-offset-4">Sign out</button></form>
    </> : <>
      <ShieldCheck size={36} className="text-lime-700" /><p className="mt-6 text-xs font-semibold uppercase tracking-widest text-lime-800">First, connect your account</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Bring your WHOOP along.</h1>
      <p className="mt-4 text-base leading-7 text-zinc-500">Authorize access to your WHOOP data. Then choose music that matches your pace or a morning sleep report.</p>
      {error && <p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
      {config.isReady ? <Link href="/setup/connection" className={`${primaryAction} mt-7`}>Connect WHOOP<ArrowRight size={18} /></Link> : <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900"><p>WHOOP connection isn’t available yet. The app owner needs to finish configuration.</p><Link href="/setup/connection" className="mt-3 inline-block underline underline-offset-4">Open connection settings</Link></div>}
      <p className="mt-5 text-xs leading-6 text-zinc-500">You’ll sign in on WHOOP. Your password is never shared with this app.</p>
    </>}
  </OnboardingShell>;
}
