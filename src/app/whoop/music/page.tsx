import { AgenticDj } from "@/components/agentic-dj";
import { OnboardingShell } from "@/components/onboarding-shell";
import { DJ_SONG_CATALOG } from "@/lib/dj/catalog";
import { requireWhoopSession } from "@/lib/whoop/require-session";

export default async function MusicPage() {
  await requireWhoopSession("/whoop/music");
  return <OnboardingShell wide backHref="/whoop" backLabel="WHOOP experiences">
    <p className="text-xs font-semibold uppercase tracking-widest text-lime-800">WHOOP · Music</p>
    <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Move to your own rhythm.</h1>
    <p className="mb-8 mt-4 max-w-xl text-sm leading-7 text-zinc-500">Match music to your latest available WHOOP heart-rate signal. Updates depend on WHOOP syncing your data; this isn’t a live pace sensor.</p>
    <AgenticDj songs={DJ_SONG_CATALOG} />
  </OnboardingShell>;
}
