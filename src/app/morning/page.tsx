import { OnboardingShell } from "@/components/onboarding-shell";
import { MorningTextOnboarding } from "@/components/morning-text-onboarding";
import { DEFAULT_DAILY_GREETING, formatDailyMessage } from "@/lib/messages/template";

export default async function MorningPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step } = await searchParams;
  const greeting = process.env.DAILY_MESSAGE_GREETING?.trim() || DEFAULT_DAILY_GREETING;
  const preview = formatDailyMessage({ greeting, wakeTime: "7:12 AM", sleepDuration: "7h 34m", sleepStart: "11:14 PM" });
  return <OnboardingShell navigation backHref="/dashboard" backLabel="Overview"><MorningTextOnboarding requestedStep={step} preview={preview} /></OnboardingShell>;
}
