import { OnboardingShell } from "@/components/onboarding-shell";
import { MorningTextOnboarding } from "@/components/morning-text-onboarding";
import { DEFAULT_DAILY_GREETING, formatDailyMessage } from "@/lib/messages/template";
import { requireWhoopSession } from "@/lib/whoop/require-session";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  await requireWhoopSession("/setup");
  const { step } = await searchParams;
  const greeting = process.env.DAILY_MESSAGE_GREETING?.trim() || DEFAULT_DAILY_GREETING;
  const preview = formatDailyMessage({ greeting, wakeTime: "7:12 AM", sleepDuration: "7h 34m", sleepStart: "11:14 PM" });
  return <OnboardingShell backHref="/whoop" backLabel="WHOOP experiences"><MorningTextOnboarding requestedStep={step} preview={preview} greeting={greeting} /></OnboardingShell>;
}
