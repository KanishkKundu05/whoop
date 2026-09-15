import { OnboardingShell } from "@/components/onboarding-shell";
export default function Loading() {
  return <OnboardingShell><div role="status"><h1 className="text-3xl font-semibold">Finding your rhythm…</h1><p className="mt-4 text-zinc-600">Checking your WHOOP connection and latest sleep.</p></div></OnboardingShell>;
}
