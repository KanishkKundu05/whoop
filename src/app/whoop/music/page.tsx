import { SpotifyDj } from "@/components/spotify-dj";
import { OnboardingShell } from "@/components/onboarding-shell";
import { requireWhoopSession } from "@/lib/whoop/require-session";

export default async function MusicPage() {
  await requireWhoopSession("/whoop/music");
  return <OnboardingShell wide navigation backHref="/dashboard" backLabel="Overview">
    <p className="text-xs font-semibold uppercase tracking-widest text-lime-800">WHOOP · Music</p>
    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Move to your own rhythm.</h1>
    <p className="mb-8 mt-4 max-w-xl text-sm leading-7 text-zinc-500">Build a Spotify soundtrack that matches your live WHOOP heart rate.</p>
    <SpotifyDj />
  </OnboardingShell>;
}
