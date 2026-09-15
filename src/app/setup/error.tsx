"use client";

import Link from "next/link";
import { OnboardingShell, primaryAction, secondaryAction } from "@/components/onboarding-shell";

export default function SetupError({ reset }: { reset: () => void }) {
  return <OnboardingShell backHref="/whoop" backLabel="WHOOP experiences"><section role="alert" className="rounded-3xl border border-zinc-200 bg-white p-8"><h1 className="text-2xl font-semibold">We couldn’t load your setup.</h1><p className="mt-4 text-sm leading-6 text-zinc-500">Please try again. Your saved messaging settings are still in place.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={reset} className={primaryAction}>Try again</button><Link href="/whoop" className={secondaryAction}>Back to WHOOP</Link></div></section></OnboardingShell>;
}
