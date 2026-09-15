import { SpotifyDj } from "@/components/spotify-dj";
import { OnboardingShell } from "@/components/onboarding-shell";
import { requireWhoopSession } from "@/lib/whoop/require-session";

export default async function MusicPage() {
  await requireWhoopSession("/whoop/music");
  return <OnboardingShell wide backHref="/whoop" backLabel="WHOOP experiences">
    <p className="text-xs font-semibold uppercase tracking-widest text-lime-800">WHOOP · Music</p>
    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Move to your own rhythm.</h1>
    <p className="mb-8 mt-4 max-w-xl text-sm leading-7 text-zinc-500">Play your Spotify liked songs to match live WHOOP heart rate. Your next song is selected 15 seconds before the current one ends.</p>
    <SpotifyDj />
  </OnboardingShell>;
}
