import { OnboardingShell } from "@/components/onboarding-shell";

export default function Loading() {
  return <OnboardingShell wide navigation backHref="/setup/connection" backLabel="Your account">
    <h1 className="text-3xl font-semibold">Your overview.</h1><p role="status" className="mt-4 text-sm text-zinc-500">Loading your latest WHOOP data…</p>
    <div aria-hidden="true" className="mt-7 grid animate-pulse gap-4 motion-reduce:animate-none sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map(key => <div key={key} className="h-36 rounded-2xl bg-zinc-200" />)}</div>
  </OnboardingShell>;
}
