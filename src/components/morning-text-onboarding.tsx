"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, CheckCircle2, LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";
import { primaryAction, secondaryAction } from "@/components/onboarding-shell";
import { DeliveryConfiguration } from "@/components/delivery-configuration";
import { normalizeE164Phone } from "@/lib/messages/template";

const steps = [{ label: "Recipient", index: 1 }, { label: "Enable", index: 2 }];
const stepNames = ["report", "recipient", "review", "complete"];
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

export function MorningTextOnboarding({ requestedStep, preview }: {
  requestedStep?: string; preview: string;
}) {
  const searchParams = useSearchParams();
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
  const ready = !loading && !!status?.connected && !!status?.config?.isReady && !!status?.hasOfflineAccess;
  const active = !!status?.subscription?.active;
  const requestedIndex = stepNames.indexOf(searchParams.get("step") ?? requestedStep ?? "");
  // Completion always comes from the server. A reload cannot restore an unsaved recipient.
  const step = requestedIndex === 3 ? (active ? 3 : 1)
    : requestedIndex === 2 ? (phone && consent ? 2 : 1)
    : requestedIndex >= 0 ? 1 : active ? 3 : 1;
  const busy = pending;

  async function refresh(signal?: AbortSignal) {
    try {
      const next = await requestSettings("GET", undefined, signal);
      if (!signal?.aborted) setStatus(next);
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "Please try again.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }

  function reload() { setLoading(true); setError(null); void refresh(); }

  useEffect(() => {
    const controller = new AbortController();
    requestSettings("GET", undefined, controller.signal)
      .then(next => { if (!controller.signal.aborted) setStatus(next); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => { if (!loading) heading.current?.focus(); }, [step, loading]);

  function goTo(index: number) {
    setError(null); setNotice(null);
    // Step changes stay local so the unsaved recipient survives Back/Continue.
    window.history.pushState(null, "", `/morning?step=${stepNames[index]}`);
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { setPhone(normalizeE164Phone(phone)); setPhoneError(null); }
    catch (error) { setPhoneError(error instanceof Error ? error.message : "Check your phone number."); phoneInput.current?.focus(); return; }
    if (consent) goTo(2);
  }

  async function save() {
    if (mutationInFlight.current || !ready || !consent) return;
    mutationInFlight.current = true; setPending(true); setError(null);
    try {
      const result = await requestSettings("POST", normalizeE164Phone(phone));
      if (result.connected === false) { setStatus(result); return; }
      if (!result.subscription?.active) throw new Error("We couldn’t confirm your saved recipient. Refresh status before trying again.");
      setStatus(current => ({ ...current!, subscription: result.subscription }));
      setPhone(""); setConsent(false); goTo(3);
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn’t save your recipient."); }
    finally { mutationInFlight.current = false; setPending(false); }
  }

  async function turnOff() {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true; setPending(true); setError(null);
    try {
      const result = await requestSettings("DELETE");
      if (result.connected === false) { setStatus(result); return; }
      setStatus(current => ({ ...current!, subscription: current?.subscription ? { ...current.subscription, active: false } : null }));
      goTo(1); setNotice("Morning texts are off. You can enable them again whenever you’re ready.");
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t turn off messages."); }
    finally { mutationInFlight.current = false; setPending(false); }
  }

  return <>
    <header className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-800">WHOOP · Morning texts</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">A better way to say good morning.</h1><p className="mt-3 text-sm leading-6 text-zinc-500">A small sleep update, sent to someone who matters.</p></header>
    <ol aria-label="Setup progress" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
      {steps.map(({ label, index }) => <li key={label}><button type="button" disabled={loading || busy || index > step || step === 3} onClick={() => goTo(index)} aria-current={index === step ? "step" : undefined} className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium ${index === step ? "bg-lime-100 text-lime-950" : "text-zinc-500"}`}><span>{index < step ? <Check size={16} /> : index}</span>{label}</button></li>)}
    </ol>
    {error && <div role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-900">{error}<button type="button" disabled={busy || loading} onClick={reload} className="ml-3 underline">Refresh status</button></div>}
    {notice && <p role="status" className="mb-5 rounded-xl bg-lime-50 p-4 text-sm text-lime-900">{notice}</p>}
    {loading && <p role="status" className="mb-5 flex items-center gap-3 text-sm text-zinc-500"><LoaderCircle size={20} className="animate-spin" />Checking connection and delivery…</p>}
    <section aria-busy={busy} className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
      {status?.connected === false && <div className="mb-6 rounded-xl bg-lime-50 p-4"><ShieldCheck className="text-lime-700" /><p className="mt-3 text-sm text-zinc-600">Connect WHOOP to save your recipient and enable automatic sleep reports.</p><a href="/api/auth/whoop?next=/morning" className={`${primaryAction} mt-4`}>Connect WHOOP</a></div>}
        <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-100 text-lime-900">{step === 3 ? <CheckCircle2 /> : <MessageCircle />}</span>
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{["Here’s what they’ll receive.", "Who gets your morning update?", "Ready to enable morning texts?", "Morning texts are enabled."][step]}</h2>
        {!loading && status?.connected && !ready && <div role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p className="font-semibold">Delivery setup pending</p><p>You can preview your report now. The app owner needs to finish delivery setup before you can enable texts.</p>{status?.hasOfflineAccess === false && <a href="/api/auth/whoop?next=/morning" className="block underline">Reconnect WHOOP to allow automatic reports</a>}<button type="button" onClick={reload} className="mt-2 min-h-11 underline">Check again</button></div>}
        <div className="mt-6 rounded-2xl bg-zinc-50 p-5"><p className="mb-3 text-xs text-zinc-500">Message template · sample sleep data</p><p className="whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-lime-200 p-5 text-sm leading-7 text-lime-950">{preview}</p></div>
        <p className="mt-4 text-xs leading-6 text-zinc-500">Wake time, time asleep, and bedtime use the timezone recorded by WHOOP. The app owner sets the greeting. Reports follow a processed main sleep; there’s no fixed send time.</p>
        {step === 1 && <form className="mt-4" onSubmit={review}>
          <p className="text-sm leading-7 text-zinc-500">They don’t need a WHOOP account. Nothing is enabled until you confirm on the next screen.</p>
          {status?.subscription && <p className="mt-4 text-sm text-zinc-600">{active ? "Currently sending to" : "Previously saved number"}: •••• {status?.subscription.recipientPhoneLast4}.</p>}
          <label htmlFor="recipient-phone" className="mb-2 mt-6 block text-sm font-semibold">Recipient phone number</label>
          <input ref={phoneInput} id="recipient-phone" name="recipientPhone" type="tel" autoComplete="tel" inputMode="tel" required disabled={busy} value={phone} onChange={event => { setPhone(event.target.value); setPhoneError(null); }} placeholder="+1 415 555 2671" aria-invalid={!!phoneError} aria-describedby={phoneError ? "phone-error phone-help" : "phone-help"} className="min-h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base focus:outline-lime-600" />
          <p id="phone-help" className="mt-2 text-xs leading-6 text-zinc-500">Include + and the country code. Spaces, parentheses, and dashes are fine.</p>
          {phoneError && <p id="phone-error" role="alert" className="mt-2 text-sm text-rose-700">{phoneError}</p>}
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600"><input type="checkbox" required checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-lime-700" />I want to share my sleep report with this person and they’re happy to receive these texts.</label>
          <div className="mt-7 flex flex-wrap justify-between gap-3"><button disabled={busy || !phone.trim() || !consent} className={primaryAction}>Review<ArrowRight size={17} /></button></div>
        </form>}
        {step === 2 && <>
          <p className="mt-4 text-sm leading-7 text-zinc-600">Send automatic sleep reports to <strong className="break-all">{phone}</strong>.</p>
          <p className="mt-4 text-sm leading-7 text-zinc-500">Enabling saves this recipient and turns on reports after WHOOP processes your sleep. It won’t send a test text. You can turn reports off at any time.</p>
          <div className="mt-7 flex flex-wrap justify-between gap-3"><button type="button" disabled={busy} className={secondaryAction} onClick={() => goTo(1)}>Edit recipient</button><button type="button" disabled={busy || !ready} className={primaryAction} onClick={() => void save()}>{pending ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}{active ? "Save recipient" : "Enable morning texts"}</button></div>
        </>}
        {step === 3 && <>
          <p className="mt-4 text-sm leading-7 text-zinc-500">Your reports are set to go to the number ending in <strong className="text-zinc-900">{status?.subscription?.recipientPhoneLast4}</strong>.</p>
          <div className="mt-6 rounded-2xl bg-lime-50 p-5 text-sm leading-7 text-lime-950"><p className="font-semibold">{status?.subscription?.lastSentAt ? "Report requested" : "Waiting for first sleep update"}</p><p className="mt-1">{status?.subscription?.lastSentAt ? `Last requested: ${new Date(status?.subscription.lastSentAt).toLocaleString()}. Check the recipient’s phone to confirm delivery.` : "Once WHOOP processes your main sleep and notifies this app, we’ll request your report through Linq. You don’t need to keep this page open."}</p></div>
          {status?.subscription?.lastError && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">The last delivery attempt had a problem. Check delivery configuration, then refresh status.</p>}
          <div className="mt-7 flex flex-wrap gap-3"><Link href="/dashboard" className={primaryAction}>Back to overview<ArrowRight size={17} /></Link><button type="button" disabled={busy} className={secondaryAction} onClick={() => goTo(1)}>Change recipient</button></div>
          <button type="button" disabled={busy} className="mt-4 min-h-11 text-sm underline" onClick={reload}>Refresh delivery status</button>
        </>}
        {active && <button type="button" disabled={busy} className="mt-4 block min-h-11 text-sm text-rose-700 underline" onClick={() => void turnOff()}>Turn off morning texts</button>}
    </section>
    <DeliveryConfiguration missing={status?.config?.missing ?? []} onError={setError} />
  </>;
}
