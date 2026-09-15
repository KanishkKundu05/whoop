import { notFound } from "next/navigation";
import { WhoopSetup } from "@/components/whoop-setup";
import { isWhoopAdmin } from "@/lib/whoop/admin";

export default async function AdminWhoopPage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  if (!(await isWhoopAdmin())) notFound();
  return <WhoopSetup authError={(await searchParams).auth_error} />;
}
