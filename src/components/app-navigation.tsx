"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Dashboard navigation" className="mb-7 flex flex-wrap gap-1 rounded-2xl border border-zinc-200 bg-white p-2">
    {[
      ["/dashboard", "Overview"], ["/whoop/music", "Music"],
      ["/morning", "Morning texts"], ["/setup/connection", "Account"],
    ].map(([href, label]) => <Link key={href} href={href} prefetch={false} aria-current={pathname === href ? "page" : undefined}
      className={`min-h-11 rounded-xl px-4 py-3 text-sm font-medium transition ${pathname === href ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>{label}</Link>)}
  </nav>;
}
