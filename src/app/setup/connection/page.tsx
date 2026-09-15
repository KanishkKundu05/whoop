import { WhoopConnection } from "@/components/whoop-connection";

export default async function ConnectionPage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  return <WhoopConnection authError={(await searchParams).auth_error} />;
}
