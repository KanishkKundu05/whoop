import { WhoopSetup } from "@/components/whoop-setup";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const { auth_error } = await searchParams;
  return <WhoopSetup authError={auth_error} />;
}
