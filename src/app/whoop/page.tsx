import { redirect } from "next/navigation";

// Keep existing bookmarks and OAuth return URLs working.
export default async function WhoopPage({ searchParams }: { searchParams: Promise<{ auth_error?: string }> }) {
  const { auth_error } = await searchParams;
  redirect(auth_error ? `/setup/connection?auth_error=${encodeURIComponent(auth_error)}` : "/dashboard");
}
