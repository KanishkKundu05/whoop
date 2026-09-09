"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy, LoaderCircle, Radio, ShieldCheck } from "lucide-react";
import type { WebhookTest } from "@/lib/whoop/setup";

type Status = {
  config: { isReady: boolean; missing: string[]; redirectUri: string };
  storageMissing: string[]; storageError: string | null; webhookUrl: string;
  callbackMatchesOrigin: boolean; expectedRedirectUri: string;
  session: { userId?: number; expiresAt: number; expired: boolean; hasRefreshToken: boolean; scopes: string[] } | null;
  webhook: WebhookTest | null;
};
type ApiResult = {
  ok: boolean; testedAt: number; userId: number; name: string; sleepCount: number;
  latest: { id: string; end: string; scoreState: string; performance?: number; efficiency?: number } | null;
};
const button = "inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40";

async function fetchStatus(): Promise<Status> {
  const response = await fetch("/api/whoop/setup", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load setup status. Retry in a moment.");
  return response.json();
}

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
    <p className="text-xs font-medium text-zinc-500">{label}</p>
    <div className="mt-2 flex items-start gap-3">
      <code className="min-w-0 flex-1 break-all text-xs leading-5">{value}</code>
      <button aria-label={`Copy ${label}`} className="rounded p-1 hover:bg-zinc-200" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setError(false); }
        catch { setError(true); }
      }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
    </div>
    {error && <p className="mt-2 text-xs text-amber-800">Select the URL and copy it manually.</p>}
  </div>;
}

function Step({ number, title, done, children }: { number: string; title: string; done: boolean; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7">
    <div className="mb-5 flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-lime-200 text-lime-950" : "bg-zinc-100 text-zinc-500"}`}>{done ? <Check size={18} /> : number}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {done && <span className="ml-auto text-xs font-medium text-lime-800">Passed</span>}
    </div>
    {children}
  </section>;
}

export function WhoopSetup({ authError }: { authError?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [api, setApi] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const oauthError = authError ? (authError === "access_denied" ? "WHOOP access was declined. Connect again when you’re ready." : `WHOOP connection failed (${authError}). Check the callback URL and try again.`) : null;
  const [now, setNow] = useState(0);

  const refresh = useCallback(async () => {
    setStatus(await fetchStatus());
    setNow(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().then(value => {
      if (!cancelled) { setStatus(value); setNow(Date.now()); }
    }).catch(error => { if (!cancelled) setError(error.message); });
    return () => { cancelled = true; };
  }, []);

  const waiting = !!status?.webhook && status.webhook.eventType !== "sleep.updated" && status.webhook.expiresAt > now;
  useEffect(() => {
    if (!waiting) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { await refresh(); }
      catch { if (!cancelled) setError("Status check failed. Check your connection, then refresh status."); }
      if (!cancelled) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [waiting, refresh]);

  async function run(action: "api" | "webhook") {
    setBusy(action); setError(null);
    if (action === "api") setApi(null);
    try {
      const response = await fetch("/api/whoop/setup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Test failed. Try again.");
      if (action === "api") setApi(result);
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not run test."); }
    finally { setBusy(null); }
  }

  const connected = !!status?.session && !status.session.expired;
  const passed = status?.webhook?.eventType === "sleep.updated";
  const complete = connected && !!api?.ok && passed;
  const progress = Number(connected) + Number(!!api?.ok) + Number(passed);

  return <main className="min-h-screen bg-[#f5f6f3] text-zinc-950">
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <nav className="mb-10 flex items-center justify-between text-sm">
        <Link href="/" className="font-bold tracking-widest">WHOOP <span className="font-normal tracking-normal text-zinc-400">/ personal setup</span></Link>
        <Link href="/" className="text-zinc-500 hover:text-zinc-950">Dashboard <span aria-hidden>↗</span></Link>
      </nav>
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-lime-800">Connect · Check · Listen</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Let’s connect your WHOOP.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">Three checks to make sure your account and sleep updates reach this app. Daily messaging comes next.</p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm">{progress} of 3 checks passed</span>
      </div>
      <div aria-live="polite">
        {(error || oauthError) && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error || oauthError}</div>}
      </div>
      {!status ? <div className="rounded-2xl bg-white p-8"><p>Loading configuration…</p><button className={`${button} mt-4`} onClick={() => refresh().catch(error => setError(error.message))}>Retry</button></div> :
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-5">
          <Step number="01" title="Authorize your account" done={connected}>
            <p className="text-sm leading-6 text-zinc-600">Add this redirect URL to your WHOOP developer app. Then sign in and allow access to your data.</p>
            <CopyValue label="OAuth redirect URL" value={status.config.redirectUri} />
            {status.callbackMatchesOrigin === false && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p>The configured callback points to a different origin or is invalid. Set WHOOP_REDIRECT_URI to the URL below, register it in WHOOP, and restart this app before connecting.</p>
              <CopyValue label="Callback for this dashboard" value={status.expectedRedirectUri} />
            </div>}
            {!status.config.isReady && <p className="mt-4 text-sm text-amber-800">Set these server variables and restart: {status.config.missing.join(", ")}.</p>}
            {status.session && <p className="mt-4 text-sm text-zinc-600">{status.session.expired ? "Your session has expired. Connect again." : `Connected${status.session.userId ? ` as WHOOP user ${status.session.userId}` : ""}.`} {status.session.hasRefreshToken ? "Offline access granted." : "Offline access not granted; allow the offline scope when reconnecting."}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-4">
              {status.config.isReady && status.callbackMatchesOrigin !== false && <a className={button} href="/api/auth/whoop?next=/setup">{connected ? "Reconnect WHOOP" : "Connect WHOOP"}<ArrowUpRight size={16} /></a>}
              <a href="https://developer-dashboard.whoop.com" target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">Developer settings</a>
            </div>
          </Step>
          <Step number="02" title="Check API access" done={!!api?.ok}>
            <p className="text-sm leading-6 text-zinc-600">Fetch your profile and five recent sleeps to check that WHOOP grants this app access.</p>
            <button className={`${button} mt-5`} disabled={!connected || !!busy} onClick={() => run("api")}>{busy === "api" && <LoaderCircle size={16} className="animate-spin" />} {api ? "Run again" : "Run API test"}</button>
            {api && <div className="mt-5 rounded-xl bg-lime-50 p-4 text-sm leading-6">
              <p className="font-semibold">Profile and sleep API passed{api.name ? `, ${api.name}` : ""}.</p>
              <p>{api.sleepCount} sleep records returned. Checked {new Date(api.testedAt).toLocaleTimeString()}.</p>
              {api.latest ? <><p>Latest main sleep ended {new Date(api.latest.end).toLocaleString()}.</p><p>Score state: {api.latest.scoreState}</p>
                {api.latest.performance != null && <p>Sleep performance: {Math.round(api.latest.performance)}%</p>}
                {api.latest.efficiency != null && <p>Sleep efficiency: {Math.round(api.latest.efficiency)}%</p>}</> : <p>No main sleep returned. Access works; wear and sync WHOOP to create sleep data.</p>}
            </div>}
          </Step>
          <Step number="03" title="Receive a sleep webhook" done={passed}>
            <p className="text-sm leading-6 text-zinc-600">In WHOOP developer settings, use this webhook URL with model <strong>v2</strong>. For this test, replace any daily-message webhook URL so sleep edits only reach this listener.</p>
            <CopyValue label="Test webhook URL" value={status.webhookUrl} />
            {!status.webhookUrl.startsWith("https://") && <p className="mt-3 text-sm text-amber-800">WHOOP needs public HTTPS. Open this dashboard through an HTTPS tunnel or hosted URL before copying the webhook URL. Keep the local server running.</p>}
            {(status.storageMissing.length > 0 || status.storageError) && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p>{status.storageError || `Set ${status.storageMissing.join(", ")} to enable the listener.`}</p>
              <p>Generate a secret with <code>openssl rand -hex 32</code>. Save the same WHOOP_SETUP_SECRET in this app’s environment and Convex Settings → Environment Variables. Run <code>npm run convex:dev</code> for local development, or <code>npx convex deploy</code> for production.</p>
            </div>}
            <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-600">
              <li>Save the webhook URL in WHOOP, then start listening below.</li>
              <li>In the WHOOP phone app, change a recent sleep’s end time by one minute and save it.</li>
              <li>Wait for processing. Once this check passes, restore the original time.</li>
            </ol>
            <button className={`${button} mt-5`} disabled={!connected || !api?.ok || !!busy || status.storageMissing.length > 0 || waiting} onClick={() => run("webhook")}>
              {busy === "webhook" ? <LoaderCircle size={16} className="animate-spin" /> : <Radio size={16} />}{waiting ? "Listening…" : "Start 15-minute test"}
            </button>
            <div className="mt-4 text-sm leading-6" aria-live="polite">
              {waiting && <p className="text-zinc-600">Waiting for a signed sleep.updated event. Checking every four seconds; test ends at {new Date(status.webhook!.expiresAt).toLocaleTimeString()}.</p>}
              {passed && <div className="rounded-xl bg-lime-50 p-4"><p className="font-semibold">Real sleep webhook received. Signature verified.</p><p>{new Date(status.webhook!.receivedAt!).toLocaleString()} · Your WHOOP account matched.</p><p className="break-all text-xs">Sleep: {status.webhook!.sleepId}</p><p className="break-all text-xs">Trace: {status.webhook!.traceId}</p></div>}
              {status.webhook?.eventType && !passed && <p>Received {status.webhook.eventType}; still waiting for sleep.updated.</p>}
              {status.webhook && !waiting && !passed && <p className="text-amber-800">Test timed out. Check the v2 URL, HTTPS access, and hosting logs, then start a new test.</p>}
            </div>
          </Step>
        </div>
        <aside className="rounded-2xl bg-zinc-950 p-6 text-white lg:sticky lg:top-6">
          <ShieldCheck className="text-lime-300" size={26} />
          <h2 className="mt-5 text-lg font-semibold">{complete ? "Connection verified." : "One account. Three checks."}</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{complete ? "WHOOP authorization, API access, and a signed sleep update have all passed. You’re ready for the daily-message step later." : "Your tokens stay on the server. This listener records only event IDs and timestamps and never sends a text."}</p>
          <div className="my-6 border-t border-zinc-800" />
          <p className="text-xs uppercase tracking-widest text-zinc-500">Next, later</p>
          <p className="mt-2 text-sm text-zinc-300">Linq delivery · Sleep report · Daily schedule</p>
          <button className="mt-6 text-sm text-lime-300 underline underline-offset-4" onClick={() => { setError(null); refresh().catch(error => setError(error.message)); }}>Refresh status</button>
          <a className="mt-4 block text-xs text-zinc-400 underline" href="https://developer.whoop.com/docs/developing/webhooks/#webhooks-testing" target="_blank" rel="noreferrer">WHOOP webhook testing guide</a>
        </aside>
      </div>}
    </div>
  </main>;
}
