"use client";

import Link from "next/link";
import { OnboardingShell, primaryAction, secondaryAction } from "@/components/onboarding-shell";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <OnboardingShell wide navigation backHref="/setup/connection" backLabel="Your account">
    <h1 className="text-3xl font-semibold">Your overview couldn’t load.</h1><p role="alert" className="mt-4 text-sm leading-6 text-zinc-500">Please try again. If your WHOOP connection has expired, reconnect from Account.</p>
    <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={reset} className={primaryAction}>Try again</button><Link href="/setup/connection" className={secondaryAction}>Check account</Link></div>
  </OnboardingShell>;
}
