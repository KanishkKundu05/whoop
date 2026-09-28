import { safeNextPath } from "@/lib/auth/navigation";
import { WhoopConnection } from "@/components/whoop-connection";

export default async function ConnectionPage({ searchParams }: { searchParams: Promise<{ auth_error?: string; next?: string }> }) {
  const params = await searchParams;
  return <WhoopConnection authError={params.auth_error} nextPath={safeNextPath(params.next)} />;
}
