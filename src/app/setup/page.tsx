import { redirect } from "next/navigation";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const { step } = await searchParams;
  redirect(`/morning${typeof step === "string" ? `?step=${encodeURIComponent(step)}` : ""}`);
}
