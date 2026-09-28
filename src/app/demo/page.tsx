import Link from "next/link";
import { OnboardingShell, primaryAction } from "@/components/onboarding-shell";
import { DemoExperiences } from "@/components/demo-experiences";
import { MetricTrendChart } from "@/components/metric-trend-chart";

const trend = [
  { label: "Mon", recovery: 64, sleep: 76, strain: 12.1 },
  { label: "Tue", recovery: 72, sleep: 82, strain: 10.4 },
  { label: "Wed", recovery: 58, sleep: 71, strain: 15.2 },
  { label: "Thu", recovery: 69, sleep: 85, strain: 8.7 },
  { label: "Fri", recovery: 77, sleep: 88, strain: 11.3 },
  { label: "Sat", recovery: 74, sleep: 86, strain: 13.6 },
  { label: "Sun", recovery: 82, sleep: 91, strain: 9.4 },
];

export default function DemoPage() {
  return <OnboardingShell wide backHref="/" backLabel="Home">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-lime-200 bg-lime-50 p-5">
      <div><p className="font-semibold text-lime-950">Demo · Sample data</p><p className="mt-1 text-sm text-lime-900">Explore freely. This demo doesn’t connect accounts, play music, or send texts.</p></div>
      <Link href="/setup/connection" className={primaryAction}>Connect your WHOOP</Link>
    </div>
    <h1 className="text-3xl font-semibold tracking-tight">Your day could look like this.</h1>
    <p className="mt-3 text-zinc-500">A sample week of sleep, recovery, and movement.</p>
    <dl className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[["Time asleep", "7h 34m", "11:14 PM – 7:12 AM · 24m awake"], ["Recovery", "82%", "58 ms HRV · 54 bpm resting HR"], ["Sleep performance", "91%", "Latest main sleep"], ["Cycle strain", "9.4", "Sample daily activity"]].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-6"><dt className="text-sm text-zinc-500">{label}</dt><dd className="mt-3 text-3xl font-semibold">{value}</dd><dd className="mt-2 text-xs text-zinc-500">{detail}</dd></div>)}
    </dl>
    <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">Your week in rhythm</h2><p className="mb-5 mt-2 text-sm text-zinc-500">Recovery (rose) and sleep (blue): 0–100%. Strain (green): 0–21.</p><MetricTrendChart data={trend} /></section>
    <DemoExperiences />
  </OnboardingShell>;
}
