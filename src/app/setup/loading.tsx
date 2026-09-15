import { OnboardingShell } from "@/components/onboarding-shell";

export default function Loading() {
  return <OnboardingShell backHref="/whoop" backLabel="WHOOP experiences"><div role="status" className="rounded-3xl border border-zinc-200 bg-white p-10 text-sm text-zinc-500">Loading your morning text setup…</div></OnboardingShell>;
}
