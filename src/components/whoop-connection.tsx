import Link from "next/link";
import { redirect } from "next/navigation";
import { Moon, ShieldCheck } from "lucide-react";
import { OnboardingShell, primaryAction, secondaryAction } from "@/components/onboarding-shell";
import { getWhoopSession, isSessionExpiring } from "@/lib/whoop/session";
import { getConfigStatus } from "@/lib/whoop/config";
import { fetchWhoop, getWhoopProfile } from "@/lib/whoop/client";
import { whoopAuthError } from "@/lib/auth/navigation";
import { WhoopAccountControls } from "@/components/whoop-account-controls";
import type { PaginatedWhoopResponse, Sleep, UserBasicProfile } from "@/lib/whoop/types";

const connectUrl = "/api/auth/whoop?next=/setup/connection";

export async function WhoopConnection({ authError }: { authError?: string }) {
  const session = await getWhoopSession();
  const connected = !!session && !isSessionExpiring(session);
  if (session && !connected && session.refreshToken && !authError) redirect("/api/auth/refresh?next=/setup/connection");
  let error = whoopAuthError(authError);
  let profile: UserBasicProfile | null = null;
  let sleeps: Sleep[] | null = null;
  if (connected) {
    const results = await Promise.allSettled([
      getWhoopProfile(session.accessToken),
      fetchWhoop<PaginatedWhoopResponse<Sleep>>(session.accessToken, "/v2/activity/sleep", { limit: 5 }, { signal: AbortSignal.timeout(12000) }),
    ]);
    if (results[0].status === "fulfilled") profile = results[0].value;
    if (results[1].status === "fulfilled" && Array.isArray(results[1].value?.records)) sleeps = results[1].value.records;
    if (!profile || !sleeps) error = "We couldn’t load all your WHOOP data right now. Try again, or reconnect if your connection has expired.";
  }
  const latest = sleeps?.find(sleep => !sleep.nap) ?? sleeps?.[0];
  const stages = latest?.score?.stage_summary;
  const minutes = stages ? Math.round((stages.total_light_sleep_time_milli + stages.total_slow_wave_sleep_time_milli + stages.total_rem_sleep_time_milli) / 60000) : null;
  return <OnboardingShell backHref="/whoop" backLabel="WHOOP experiences">
    <ShieldCheck size={36} className="text-lime-700" />
    <h1 className="mt-5 text-3xl font-semibold tracking-tight">{connected ? "Your WHOOP, connected." : "Bring your WHOOP along."}</h1>
    <p className="mt-4 text-zinc-600">{connected ? "Your latest sleep, in one place." : "Sign in with the same email you use in the WHOOP phone app. We’ll bring in your latest sleep automatically."}</p>
    {profile && <p className="mt-3 text-sm text-zinc-500">Connected as {profile.first_name} · {profile.email}</p>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
    {!connected ? getConfigStatus().isReady ? <a href={connectUrl} className={`${primaryAction} mt-6`}>Connect WHOOP</a> : <p className="mt-6 text-sm text-zinc-600">WHOOP connection is temporarily unavailable. Please try again later.</p> : <>
      {latest && <section className="mt-7 rounded-3xl border border-zinc-200 bg-white p-6">
        <Moon className="text-lime-700" /><h2 className="mt-3 text-xl font-semibold">{latest.nap ? "Latest nap" : "Latest sleep"}</h2>
        <p className="mt-2 text-sm text-zinc-500">{new Date(latest.end).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</p>
        <div className="mt-5 flex flex-wrap gap-8"><div><p className="text-xs text-zinc-500">Time asleep</p><p className="mt-1 text-2xl font-semibold">{minutes === null ? "Processing" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}</p></div><div><p className="text-xs text-zinc-500">Sleep performance</p><p className="mt-1 text-2xl font-semibold">{latest.score?.sleep_performance_percentage == null ? "Processing" : `${Math.round(latest.score.sleep_performance_percentage)}%`}</p></div></div>
      </section>}
      {sleeps?.length === 0 && <p role="status" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">WHOOP hasn’t returned any sleep for this account. Check that the email above matches your phone account, and that your latest sleep has synced. You can switch accounts below.</p>}
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/whoop" className={primaryAction}>Explore experiences</Link><a href="/setup/connection" className={secondaryAction}>Refresh sleep</a><a href={connectUrl} className={secondaryAction}>Switch WHOOP account</a></div>
      <WhoopAccountControls />
    </>}
    <p className="mt-6 text-xs leading-6 text-zinc-500">Your password stays with WHOOP. You control access to your data.</p>
  </OnboardingShell>;
}
