import { WhoopSetup } from "@/components/whoop-setup";

import { Funnel_Display } from "next/font/google";

const funnelDisplay = Funnel_Display({ subsets: ["latin"], variable: "--font-funnel-display", display: "swap" });

export default async function ConnectionPage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const { auth_error } = await searchParams;
  return <div className={funnelDisplay.variable}><WhoopSetup authError={auth_error} /></div>;
}
