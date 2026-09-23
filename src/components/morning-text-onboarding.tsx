"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, LoaderCircle, MessageCircle, Moon, ShieldCheck } from "lucide-react";
import { primaryAction, secondaryAction } from "@/components/onboarding-shell";
import { normalizeE164Phone } from "@/lib/messages/template";

const steps = ["WHOOP", "Delivery", "Sleep report", "Recipient"];
const stepNames = ["account", "delivery", "report", "recipient", "complete"];
type Subscription = { active: boolean; recipientPhoneLast4: string; lastSentAt?: string; lastError?: string };
type Status = {
  ok: boolean; connected?: boolean; hasOfflineAccess?: boolean; error?: string;
  config?: { isReady: boolean; missing: string[] }; subscription?: Subscription | null;
};

async function requestSettings(method = "GET", recipientPhone?: string, signal?: AbortSignal): Promise<Status> {
  let response: Response;
  try {
    response = await fetch("/api/messages/daily/setup", {
    method, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    ...(recipientPhone ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientPhone }) } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(method === "GET"
      ? "We couldn’t reach messaging setup. Check your connection and try again."
      : "We couldn’t confirm the update. Refresh status to check whether it was saved before trying again.");
  }
  let data: Status;
  try { data = await response.json(); }
  catch { throw new Error("We couldn’t reach messaging setup. Please try again."); }
  if (response.status === 401) return { ...data, connected: false };
  if (!response.ok || !data.ok) throw new Error(data.error || "We couldn’t update messaging setup. Please try again.");
  return data;
}

function DeliveryDetails({ missing, onError }: { missing: string[]; onError: (message: string) => void }) {
    const [copied, setCopied] = useState(false);
    return <details className="mt-5 rounded-xl border border-zinc-200 p-4 text-sm">
      <summary className="cursor-pointer font-medium text-zinc-700">App owner · Delivery configuration</summary>
      <div className="mt-4 space-y-4 text-sm leading-6 text-zinc-600">
        <p>Configure a sending line in Linq, and set <code>LINQ_API_KEY</code> on this app’s server. Set <code>DAILY_MESSAGE_SECRET</code> to at least 32 characters and <code>NEXT_PUBLIC_CONVEX_URL</code> to your Convex deployment. Deploy its functions, then restart or redeploy the app.</p>
        <p>For local CLI testing, set <code>LINQ_TRANSPORT=cli</code> and log in with <code>linq login</code> or <code>linq signup</code>. Select a default sending line and have the recipient text it first. CLI mode requires the development server; its configuration check does not verify CLI login.</p>
        {!!missing.length && <p className="break-words text-amber-800">Missing or invalid: {missing.join(", ")}.</p>}
        <p>In WHOOP developer settings, register the public HTTPS URL below as the <strong>v2 webhook</strong>. Replace the connection-test webhook when you’re ready to enable delivery.</p>
        <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3"><code className="min-w-0 flex-1 break-all text-xs">{typeof window !== "undefined" ? window.location.origin : "Your app’s public origin"}/api/whoop/webhook</code><button type="button" aria-label="Copy delivery webhook URL" className="shrink-0 rounded-lg p-2 hover:bg-zinc-200" onClick={async () => {
          try { await navigator.clipboard.writeText(`${window.location.origin}/api/whoop/webhook`); setCopied(true); }
          catch { onError("Clipboard unavailable. Select the webhook URL and copy it manually."); }
        }}>{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
        <p>Configuration checks do not verify your Linq token, sending line, or webhook registration. Confirm the first report arrives on the recipient’s phone.</p>
        <Link href="/setup/connection" className="inline-block underline underline-offset-4">Advanced WHOOP connection checks</Link>
      </div>
    </details>;
  }


export function MorningTextOnboarding({ requestedStep, preview, greeting }: {
  requestedStep?: string; preview: string; greeting: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const mutationInFlight = useRef(false);
  const ready = !!status?.config?.isReady && !!status?.hasOfflineAccess;
  const active = !!status?.subscription?.active;
  const requestedIndex = stepNames.indexOf(requestedStep ?? "");
  // Server state, not a URL flag, determines whether setup is complete.
  const step = !status?.connected || requestedIndex === 0 ? 0 : !ready ? 1
    : requestedIndex === 4 ? (active ? 4 : 3)
    : requestedIndex >= 0 ? requestedIndex : active ? 4 : 1;
  const busy = pending || navigating;

  async function refresh(signal?: AbortSignal) {
    try {
      const next = await requestSettings("GET", undefined, signal);
      if (!signal?.aborted) setStatus(next);
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error && error.name !== "TimeoutError" ? error.message : "That took too long. Please try again.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }

  function reload() {
    setLoading(true); setError(null);
    void refresh();
  }

  useEffect(() => {
    const controller = new AbortController();
    requestSettings("GET", undefined, controller.signal)
      .then(next => { if (!controller.signal.aborted) setStatus(next); })
      .catch(error => { if (!controller.signal.aborted) setError(error.name === "TimeoutError" ? "That took too long. Please try again." : error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => { if (!loading) heading.current?.focus(); }, [step, loading]);

  function goTo(index: number) {
    setError(null); setNotice(null);
    startNavigation(() => router.push(`/setup?step=${stepNames[index]}`, { scroll: false }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlight.current || !ready || !consent) return;
    let normalized: string;
    try { normalized = normalizeE164Phone(phone); }
    catch (error) {
      setPhoneError(error instanceof Error ? error.message : "Check your phone number.");
      phoneInput.current?.focus(); return;
    }
    mutationInFlight.current = true;
    setPending(true); setError(null); setPhoneError(null);
    try {
      const result = await requestSettings("POST", normalized);
      if (result.connected === false) { setStatus(result); return; }
      if (!result.subscription?.active) throw new Error("We couldn’t confirm your saved recipient. Refresh status before trying again.");
      setStatus(current => ({ ...current!, subscription: result.subscription }));
      setPhone(""); setConsent(false);
      goTo(4);
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn’t save your recipient. Please try again."); }
    finally { mutationInFlight.current = false; setPending(false); }
  }

  async function turnOff() {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true; setPending(true); setError(null);
    try {
      const result = await requestSettings("DELETE");
      if (result.connected === false) { setStatus(result); return; }
      setStatus(current => ({ ...current!, subscription: current?.subscription ? { ...current.subscription, active: false } : null }));
      goTo(3); setNotice("Morning texts are off. You can enable them again whenever you’re ready.");
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t turn off messages. Please try again."); }
    finally { mutationInFlight.current = false; setPending(false); }
  }


  return <>
    <header className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-800">WHOOP · Morning texts</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A better way to say good morning.</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-500">A small sleep update, sent to someone who matters.</p>
    </header>
    <div aria-label="Setup progress" className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex justify-between gap-3 text-xs font-medium"><span>{loading ? "Checking your progress…" : step === 4 ? "Setup complete" : `Step ${step + 1} of 4 · ${steps[step]}`}</span><span className="text-zinc-500">{loading ? "" : `${step} of 4 steps complete`}</span></div>
      <div role="progressbar" aria-label="Morning text setup completion" aria-valuemin={0} aria-valuemax={4} aria-valuenow={loading ? undefined : step} className="h-1.5 overflow-hidden rounded-full bg-zinc-100"><div style={{ width: `${loading ? 0 : step * 25}%` }} className="h-full rounded-full bg-lime-500 transition-all motion-reduce:transition-none" /></div>
      <ol className="mt-4 grid grid-cols-4 gap-2">
        {steps.map((label, index) => <li key={label}><button type="button" disabled={loading || busy || index > step || (index > 1 && !ready)} onClick={() => goTo(index)} aria-current={index === step ? "step" : undefined} className={`flex min-h-11 w-full flex-col items-center gap-2 rounded-lg px-1 py-2 text-[11px] font-medium sm:flex-row sm:text-xs ${index === step ? "bg-lime-50 text-lime-900" : index < step ? "text-zinc-800 hover:bg-zinc-50" : "text-zinc-400"}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${index < step ? "bg-lime-200" : "bg-zinc-100"}`}>{index < step ? <Check size={13} /> : index + 1}</span>{label}</button></li>)}
      </ol>
    </div>
    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">{error}<button type="button" disabled={busy || loading} onClick={reload} className="ml-3 underline underline-offset-4">{status ? "Refresh status" : "Try again"}</button></div>}
    {notice && <p role="status" className="mb-5 rounded-xl bg-lime-50 p-4 text-sm text-lime-900">{notice}</p>}
    {loading ? <div role="status" className="flex min-h-72 items-center justify-center gap-3 rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500"><LoaderCircle size={20} className="animate-spin" />Loading your saved setup…</div> : status && <section aria-busy={busy} className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-100 text-lime-900">{step === 4 ? <CheckCircle2 size={26} /> : step < 2 ? <ShieldCheck size={26} /> : step === 2 ? <Moon size={26} /> : <MessageCircle size={26} />}</span>
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{[status.connected ? "Your WHOOP is connected." : "Reconnect your WHOOP.", "Get delivery ready.", "Here’s what they’ll receive.", "Who gets your morning update?", "Morning texts are enabled."][step]}</h2>
      {step === 0 && <>
        <p className="mt-4 text-sm leading-7 text-zinc-500">{status.connected ? "Your sleep report uses your connected WHOOP account. You’re ready for the next step." : "Your session has ended. Connect again to continue setting up your morning texts."}</p>
        {status.connected ? <button type="button" className={`${primaryAction} mt-7`} onClick={() => goTo(1)}>Continue<ArrowRight size={17} /></button> : <a href="/api/auth/whoop?next=/whoop" className={`${primaryAction} mt-7`}>Reconnect WHOOP<ArrowRight size={17} /></a>}
      </>}
      {step === 1 && <>
        <p className="mt-4 text-sm leading-7 text-zinc-500">Linq sends your report after WHOOP processes a main-sleep update. There’s no fixed send time, and you won’t need to keep this page open.</p>
        <div className={`mt-5 rounded-xl p-4 text-sm leading-6 ${ready ? "bg-lime-50 text-lime-900" : "bg-amber-50 text-amber-900"}`}><p className="font-semibold">{ready ? "Messaging configuration is in place" : "Delivery needs a little setup"}</p><p className="mt-1">{ready ? "Confirm the WHOOP delivery webhook is registered, then continue to your report." : "The app owner needs to finish delivery configuration before you can enable texts. Open the settings below, then check again."}</p></div>
        {status.hasOfflineAccess === false && <p className="mt-4 text-sm text-amber-900">WHOOP hasn’t granted offline access. <a href="/api/auth/whoop?next=/whoop" className="underline">Reconnect WHOOP</a> to allow automatic reports.</p>}
        <DeliveryDetails missing={status.config?.missing ?? []} onError={setError} />
        {active && <p className="mt-4 text-sm leading-6 text-zinc-600">Messages are currently enabled for •••• {status.subscription?.recipientPhoneLast4}. <button type="button" disabled={busy} className="underline underline-offset-4" onClick={turnOff}>Turn off morning texts</button></p>}
        <button type="button" className="mt-4 min-h-11 text-sm text-zinc-600 underline underline-offset-4" onClick={reload}>Check configuration again</button>
      </>}
      {step === 2 && <>
        <p className="mt-4 text-sm leading-7 text-zinc-500">A short, plain-text report with your wake time, time asleep, and bedtime. Times follow the timezone recorded by WHOOP.</p>
        <div className="mt-6 rounded-2xl bg-zinc-50 p-5"><p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-zinc-400">Example message · sample sleep data</p><p className="ml-auto max-w-md whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-lime-200 p-5 text-sm leading-7 text-lime-950">{preview}</p></div>
        <dl className="mt-6 grid gap-3 border-b border-zinc-100 pb-6 text-sm sm:grid-cols-3">{[["Wake time", "7:12 AM"], ["Time asleep", "7h 34m"], ["Bedtime", "11:14 PM"]].map(([label, value]) => <div key={label}><dt className="text-zinc-500">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl>
        <details className="mt-5 text-sm leading-6 text-zinc-500"><summary className="cursor-pointer font-medium text-zinc-700">Message formatting</summary><p className="mt-3">The greeting is “{greeting}”. The app owner can change it with <code>DAILY_MESSAGE_GREETING</code> and restart or redeploy. Sleep values fill in automatically; this version includes timing and duration, without sleep-quality scores.</p></details>
      </>}
      {step === 3 && <form className="mt-4" onSubmit={save}>
        <p className="text-sm leading-7 text-zinc-500">Enter the number of the person you’d like to share your sleep report with. They don’t need a WHOOP account.</p>
        {status.subscription && <p className="mt-4 text-sm text-zinc-600">{active ? "Currently sending to" : "Previously saved number"}: •••• {status.subscription.recipientPhoneLast4}. Enter a full number to {active ? "change the recipient" : "enable messages"}.</p>}
        <label htmlFor="recipient-phone" className="mb-2 mt-6 block text-sm font-semibold">Recipient phone number</label>
        <input ref={phoneInput} id="recipient-phone" name="recipientPhone" type="tel" autoComplete="tel" inputMode="tel" required disabled={busy} value={phone} onChange={event => { setPhone(event.target.value); setPhoneError(null); }} placeholder="+1 415 555 2671" aria-invalid={!!phoneError} aria-describedby={phoneError ? "phone-error phone-help" : "phone-help"} className={`min-h-14 w-full rounded-xl border bg-white px-4 text-base outline-none focus:border-lime-600 focus:ring-2 focus:ring-lime-600/20 disabled:opacity-50 ${phoneError ? "border-rose-500" : "border-zinc-300"}`} />
        <p id="phone-help" className="mt-2 text-xs leading-6 text-zinc-500">Include + and the country code. Spaces, parentheses, and dashes are fine.</p>
        {phoneError && <p id="phone-error" role="alert" className="mt-2 text-sm text-rose-700">{phoneError}</p>}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600"><input type="checkbox" required checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-lime-700" />I want to share my sleep report with this person and they’re happy to receive these texts.</label>
        <p className="mt-4 text-xs leading-6 text-zinc-500">Enabling saves your number and turns on automatic reports. It won’t send a test text. You can turn messages off here at any time.</p>
        <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-zinc-100 pt-6"><button type="button" disabled={busy} className={secondaryAction} onClick={() => goTo(2)}><ArrowLeft size={17} />Back</button><button disabled={busy || !phone.trim() || !consent || !ready} className={primaryAction}>{pending ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}{active ? "Save recipient" : "Enable morning texts"}</button></div>
      </form>}
      {step === 4 && <>
        <p className="mt-4 text-sm leading-7 text-zinc-500">Your sleep reports are set to go to the number ending in <strong className="text-zinc-900">{status.subscription?.recipientPhoneLast4}</strong>.</p>
        <div className="mt-6 rounded-2xl bg-lime-50 p-5 text-sm leading-7 text-lime-950"><p className="font-semibold">What happens next</p><p className="mt-1">Once WHOOP processes a main-sleep update and sends it to this app, we’ll request your report through Linq. Check the recipient’s phone to confirm the first delivery.</p></div>
        <p className="mt-4 text-sm leading-6 text-zinc-500">{status.subscription?.lastSentAt ? `Last report requested: ${new Date(status.subscription.lastSentAt).toLocaleString()}.` : "No report has been sent yet."}</p>
        {status.subscription?.lastError && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">The last delivery attempt had a problem. Check delivery configuration and reconnect WHOOP if needed, then check status again.</p>}
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/whoop" prefetch={false} className={primaryAction}>Back to WHOOP<ArrowRight size={17} /></Link><button type="button" disabled={busy} className={secondaryAction} onClick={() => goTo(3)}>Change recipient</button></div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2"><button type="button" disabled={busy} className="min-h-11 text-sm text-zinc-500 underline underline-offset-4" onClick={reload}>Refresh delivery status</button><button type="button" disabled={busy} className="inline-flex min-h-11 items-center gap-2 text-sm text-rose-700 underline underline-offset-4" onClick={turnOff}>{pending && <LoaderCircle size={15} className="animate-spin" />}Turn off morning texts</button></div>
        <DeliveryDetails missing={status.config?.missing ?? []} onError={setError} />
      </>}
      {(step === 1 || step === 2) && <div className="mt-7 flex justify-between gap-3 border-t border-zinc-100 pt-6"><button type="button" disabled={busy} className={secondaryAction} onClick={() => goTo(step - 1)}><ArrowLeft size={17} />Back</button><button type="button" disabled={busy || !ready} className={primaryAction} onClick={() => goTo(step + 1)}>Continue{navigating ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} />}</button></div>}
    </section>}
  </>;
}
