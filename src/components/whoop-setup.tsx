"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, Copy, LoaderCircle, Radio, ShieldCheck } from "lucide-react";
import styles from "./whoop-setup.module.css";
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
const button = styles.primary;
const steps = [
  { title: "Connect WHOOP", detail: "A secure introduction" },
  { title: "Check your data", detail: "Make sure everything is in sync" },
  { title: "Test sleep updates", detail: "Listen for your next update" },
];

async function fetchStatus(): Promise<Status> {
  const response = await fetch("/api/whoop/setup", { cache: "no-store", signal: AbortSignal.timeout(15000) });
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
  return <section className={styles.step}>
    <div className={styles.stepLabel}><span>WHOOP SETUP / {number}</span>{done && <span className={styles.passed}><Check size={14} />Verified</span>}</div>
    <h2 tabIndex={-1}>{title}</h2>
    {children}
  </section>;
}

export function WhoopSetup({ authError }: { authError?: string }) {
  const actionInFlight = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
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
    const clock = setInterval(() => setNow(Date.now()), 1000);
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try { await refresh(); }
      catch { if (!cancelled) setError("Status check failed. Check your connection, then refresh status."); }
      if (!cancelled) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);
    return () => { cancelled = true; clearTimeout(timer); clearInterval(clock); };
  }, [waiting, refresh]);

  async function run(action: "api" | "webhook") {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(action); setError(null);
    if (action === "api") setApi(null);
    try {
      const response = await fetch("/api/whoop/setup", {
        method: "POST", signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Test failed. Try again.");
      if (action === "api") setApi(result);
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not run test."); }
    finally { actionInFlight.current = false; setBusy(null); }
  }

  const connected = !!status?.session && !status.session.expired;
  const apiPassed = connected && !!api?.ok && api.userId === status?.session?.userId;
  const passed = connected && status?.webhook?.eventType === "sleep.updated";
  const complete = apiPassed && passed;
  const unlocked = !connected ? 0 : !apiPassed ? 1 : !passed ? 2 : 3;
  const step = Math.min(selectedStep ?? (connected ? 1 : 0), unlocked);
  const progress = Number(connected) + Number(apiPassed) + Number(passed);

  const loaded = !!status;
  useEffect(() => { panel.current?.querySelector("h2")?.focus(); }, [step, loaded]);

  function goTo(next: number) {
    setSelectedStep(next);
    setError(null);
  }

  return <main className={styles.root}>
    <div className={styles.container}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.brand}><Activity size={25} />pace<span>/ your daily rhythm</span></Link>
        <Link href="/whoop"><ArrowLeft size={15} />Back to WHOOP</Link>
      </nav>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>A LITTLE MORE CONNECTED</p>
          <h1>Your rhythm.{" "}<br />Meet your{" "}<br /><em>everyday.</em></h1>
          <p className={styles.intro}>Bring your WHOOP into Pace.{" "}<br />One small step at a time.</p>
          <ol className={styles.steps} aria-label="WHOOP setup progress">
            {steps.map((item, index) => {
              const done = [connected, apiPassed, passed][index];
              return <li key={item.title}><button disabled={!status || !!busy || index > unlocked} onClick={() => goTo(index)} aria-current={step === index ? "step" : undefined}>
                <span className={`${styles.number} ${done ? styles.checked : ""}`}>{done ? <Check size={17} /> : `0${index + 1}`}</span>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                {step === index && <span className={styles.currentDot} />}
              </button></li>;
            })}
          </ol>
          <div className={styles.privacy}><ShieldCheck size={19} /><p>Your password stays with WHOOP.<br />You’re always in control of access.</p></div>
        </aside>
        <div className={styles.workspace}>
          <div className={styles.workspaceTop}><span><span className={styles.whoopMark}>W</span> WHOOP <span className={styles.integrationLabel}>INTEGRATION</span></span><span>{complete ? "All checks passed" : `${progress} of 3 verified`}</span></div>
          <div className={styles.progress} role="progressbar" aria-label="WHOOP checks passed" aria-valuemin={0} aria-valuemax={3} aria-valuenow={progress}><span style={{ width: `${progress / 3 * 100}%` }} /></div>
          {(error || oauthError) && <div role="alert" className={styles.error}>{error || oauthError}</div>}
          {!status ? <div className={styles.loading} role="status"><LoaderCircle size={24} className="animate-spin" /><h2>Getting things ready.</h2><p>Checking your WHOOP configuration…</p>{error && <button className={button} onClick={() => { setError(null); refresh().catch(error => setError(error.message)); }}>Try again</button>}</div> :
          <div ref={panel} aria-busy={!!busy}>
          {step === 0 && <Step number="01" title="First, make the connection." done={connected}>
            <p className="text-sm leading-6 text-zinc-600">Add this redirect URL to your WHOOP developer app. Then sign in and allow access to your data.</p>
            <CopyValue label="OAuth redirect URL" value={status.config.redirectUri} />
            {status.callbackMatchesOrigin === false && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p>The configured callback points to a different origin or is invalid. Set WHOOP_REDIRECT_URI to the URL below, register it in WHOOP, and restart this app before connecting.</p>
              <CopyValue label="Callback for this dashboard" value={status.expectedRedirectUri} />
            </div>}
            {!status.config.isReady && <p className="mt-4 text-sm text-amber-800">Set these server variables and restart: {status.config.missing.join(", ")}.</p>}
            {status.session && <p className="mt-4 text-sm text-zinc-600">{status.session.expired ? "Your session has expired. Connect again." : `Connected${status.session.userId ? ` as WHOOP user ${status.session.userId}` : ""}.`} {status.session.hasRefreshToken ? "Offline access granted." : "Offline access not granted; allow the offline scope when reconnecting."}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-4">
              {status.config.isReady && status.callbackMatchesOrigin !== false && <a className={button} href="/api/auth/whoop?next=/setup/connection">{connected ? "Reconnect WHOOP" : "Connect WHOOP"}<ArrowUpRight size={16} /></a>}
              <a href="https://developer-dashboard.whoop.com" target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">Developer settings</a>
            </div>
          </Step>}
          {step === 1 && <Step number="02" title="Let’s find your rhythm." done={apiPassed}>
            <p className="text-sm leading-6 text-zinc-600">Check that Pace can read your profile and recent sleep. This brings in up to five sleep records from your WHOOP account.</p>
            <button className={`${button} mt-5`} disabled={!connected || !!busy} onClick={() => run("api")}>{busy === "api" && <LoaderCircle size={16} className="animate-spin" />} {api ? "Run again" : "Run API test"}</button>
            {apiPassed && api && <div className="mt-5 rounded-xl bg-lime-50 p-4 text-sm leading-6">
              <p className="font-semibold">Profile and sleep API passed{api.name ? `, ${api.name}` : ""}.</p>
              <p>{api.sleepCount} sleep records returned. Checked {new Date(api.testedAt).toLocaleTimeString()}.</p>
              {api.latest ? <><p>Latest main sleep ended {new Date(api.latest.end).toLocaleString()}.</p><p>Score state: {api.latest.scoreState}</p>
                {api.latest.performance != null && <p>Sleep performance: {Math.round(api.latest.performance)}%</p>}
                {api.latest.efficiency != null && <p>Sleep efficiency: {Math.round(api.latest.efficiency)}%</p>}</> : <p>No main sleep returned. Access works; wear and sync WHOOP to create sleep data.</p>}
            </div>}
          </Step>}
          {step === 2 && <Step number="03" title="A little wake-up call." done={passed}>
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
            <button className={`${button} mt-5`} disabled={!apiPassed || !!busy || status.storageMissing.length > 0 || !!status.storageError || !status.webhookUrl.startsWith("https://") || waiting} onClick={() => run("webhook")}>
              {busy === "webhook" ? <LoaderCircle size={16} className="animate-spin" /> : <Radio size={16} />}{waiting ? "Listening…" : "Start 15-minute test"}
            </button>
            <div className="mt-4 text-sm leading-6" aria-live="polite">
              {waiting && <p className="text-zinc-600">Waiting for a signed sleep.updated event. Checking every four seconds; test ends at {new Date(status.webhook!.expiresAt).toLocaleTimeString()}.</p>}
              {passed && <div className="rounded-xl bg-lime-50 p-4"><p className="font-semibold">Real sleep webhook received. Signature verified.</p><p>{new Date(status.webhook!.receivedAt!).toLocaleString()} · Your WHOOP account matched.</p><p className="break-all text-xs">Sleep: {status.webhook!.sleepId}</p><p className="break-all text-xs">Trace: {status.webhook!.traceId}</p></div>}
              {status.webhook?.eventType && !passed && <p>Received {status.webhook.eventType}; still waiting for sleep.updated.</p>}
              {status.webhook && !waiting && !passed && <p className="text-amber-800">Test timed out. Check the v2 URL, HTTPS access, and hosting logs, then start a new test.</p>}
            </div>
          </Step>}
          {step === 3 && <section className={`${styles.step} ${styles.success}`}>
            <CheckCircle2 size={46} strokeWidth={1.25} />
            <p className={styles.eyebrow}>THREE CHECKS. ALL CONNECTED.</p>
            <h2 tabIndex={-1}>You’re in rhythm.</h2>
            <p>Your account is connected, your sleep data is accessible, and a signed sleep update has arrived from WHOOP.</p>
            <div className={styles.nextUp}><span>UP NEXT / OPTIONAL</span><h3>Make mornings a little closer.</h3><p>Set up Linq delivery and choose who gets your morning sleep report.</p><Link href="/setup" className={button}>Set up morning texts<ArrowRight size={17} /></Link></div>
            <Link href="/whoop" className={styles.textLink}>Explore WHOOP experiences<ArrowUpRight size={16} /></Link>
          </section>}
          {step < 3 && <div className={styles.actions}>
            <button className={styles.back} disabled={step === 0 || !!busy} onClick={() => goTo(step - 1)}><ArrowLeft size={16} />Back</button>
            <button className={button} disabled={!!busy || ![connected, apiPassed, complete][step]} onClick={() => goTo(step + 1)}>{step === 2 ? "Finish WHOOP setup" : "Continue"}<ArrowRight size={16} /></button>
          </div>}
          </div>}
          <div className={styles.help}><span><ShieldCheck size={15} />Secure connection through WHOOP</span><button disabled={!!busy} onClick={() => { setError(null); refresh().catch(error => setError(error.message)); }}>Refresh status</button></div>
        </div>
      </div>
      <footer className={styles.footer}><span>A little more in tune with you.</span><Link href="/privacy">Privacy</Link></footer>
    </div>
  </main>;
}
