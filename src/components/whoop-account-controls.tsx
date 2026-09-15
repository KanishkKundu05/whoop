"use client";
import { useState } from "react";
import { secondaryAction } from "./onboarding-shell";

export function WhoopAccountControls() {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  async function remove() {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/whoop/account", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!result.accessRevoked) { setDeleted(true); return; }
      window.location.assign("/whoop");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not delete your data. Please retry."); }
    finally { setBusy(false); }
  }
  if (deleted) return <p role="status" className="mt-6 text-sm">Your stored WHOOP data was deleted and you’re signed out. We couldn’t revoke WHOOP access; remove Pace from your connected apps in WHOOP to finish disconnecting. <a href="/whoop" className="underline">Done</a></p>;
  return <section className="mt-8 border-t border-zinc-200 pt-6">
    <h2 className="font-semibold">Your account</h2>
    <div className="mt-3 flex flex-wrap gap-3"><form action="/api/auth/disconnect" method="post"><button disabled={busy} className={secondaryAction}>Disconnect WHOOP</button></form><button disabled={busy} onClick={() => setConfirm(true)} className={secondaryAction}>Delete my WHOOP data</button></div>
    {confirm && <div className="mt-4 rounded-xl border border-red-200 p-4"><p className="text-sm leading-6">Delete your stored WHOOP data, saved recipient, and automatic messaging setup from Pace and disconnect this account? This cannot be undone. Your data in WHOOP stays intact.</p><div className="mt-3 flex gap-3"><button disabled={busy} onClick={remove} className="rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Deleting…" : "Delete and disconnect"}</button><button disabled={busy} onClick={() => setConfirm(false)} className={secondaryAction}>Cancel</button></div></div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
