"use client";

import { Bell, LoaderCircle, Power, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type StatusResponse = {
  ok: boolean;
  connected?: boolean;
  error?: string;
  config?: {
    isReady: boolean;
    missing: string[];
  };
  subscription?: {
    active: boolean;
    recipientPhoneLast4: string;
    updatedAt: number;
    lastSentAt?: string;
    lastProviderStatus?: string;
    lastError?: string;
    lastErrorAt?: string;
  } | null;
};

function formatDateTime(value?: string | number) {
  if (!value) return "Never";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DailyMessageSetup({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchStatus() {
    const response = await fetch("/api/messages/daily/setup", {
      cache: "no-store",
    });

    return (await response.json()) as StatusResponse;
  }

  async function loadStatus() {
    setStatus(await fetchStatus());
  }

  useEffect(() => {
    let ignore = false;

    fetchStatus()
      .then((data) => {
        if (!ignore) setStatus(data);
      })
      .catch((error) => {
        if (!ignore) {
          setStatus({
            ok: false,
            error:
              error instanceof Error ? error.message : "Status request failed.",
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function saveRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/messages/daily/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipientPhone }),
      });
      const data = (await response.json()) as StatusResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not save daily message setup.");
      }

      setRecipientPhone("");
      setMessage("Daily message is active.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  async function disableDailyMessage() {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/messages/daily/setup", {
        method: "DELETE",
      });
      const data = (await response.json()) as StatusResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not disable daily message.");
      }

      setMessage("Daily message is off.");
      await loadStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Disable failed.");
    } finally {
      setPending(false);
    }
  }

  const subscription = status?.subscription;
  const missing = status?.config?.missing ?? [];
  const canSave = !!status?.ok && !!status.connected && !!status.config?.isReady;

  return (
    <section className={`grid gap-5 ${compact ? "" : "lg:grid-cols-[minmax(0,1fr)_380px]"}`}>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-lime-300">
          <Bell size={22} />
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-normal">
          Daily WHOOP text
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Choose who receives your sleep report. Saving enables automatic messages when WHOOP sends a scored main-sleep update; it does not send a test text.</p>
        {status?.error && <p role="alert" className="mt-4 text-sm text-rose-700">{status.error}</p>}
        {status?.connected === false && <p className="mt-4 text-sm text-amber-800">Connect WHOOP before saving a recipient.</p>}
        {missing.length > 0 && <p className="mt-4 break-words text-sm text-amber-800">Set these server variables and restart the app: {missing.join(", ")}.</p>}
        <button type="button" className="mt-4 text-sm underline underline-offset-4" disabled={pending} onClick={() => loadStatus().catch(() => setMessage("Could not refresh status. Try again."))}>Refresh messaging status</button>
        <form className="mt-7 grid gap-4" onSubmit={saveRecipient}>
          <label className="grid gap-2 text-sm font-medium text-zinc-800">
            Recipient phone number
            <input
              className="h-11 border border-zinc-300 bg-white px-3 text-base font-normal text-zinc-950 outline-none focus:border-zinc-950"
              disabled={pending}
              type="tel"
              name="recipientPhone"
              autoComplete="tel"
              required
              aria-describedby="recipient-phone-help"
              inputMode="tel"
              onChange={(event) => setRecipientPhone(event.target.value)}
              placeholder="+14155552671"
              value={recipientPhone}
            />
          </label>
          <p id="recipient-phone-help" className="text-xs leading-5 text-zinc-500">Include + and the country code, for example +14155552671. Spaces, dashes, and parentheses are accepted.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500"
              disabled={pending || !canSave || !recipientPhone.trim()}
            >
              {pending ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
              Save & enable messages
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-950 disabled:border-zinc-200 disabled:text-zinc-400"
              disabled={pending || !subscription?.active}
              onClick={disableDailyMessage}
              type="button"
            >
              <Power size={17} />
              Turn off
            </button>
          </div>
        </form>
        {message ? (
          <div role="status" className="mt-5 border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            {message}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-zinc-950">Status</h3>
        <dl className="mt-5 grid gap-4 text-sm">
          <div>
            <dt className="text-zinc-500">Configuration</dt>
            <dd className="mt-1 font-medium text-zinc-950">
              {status ? (status.config?.isReady ? "Configured" : missing.length ? missing.join(", ") : "Unavailable") : "Loading"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Recipient</dt>
            <dd className="mt-1 font-medium text-zinc-950">
              {subscription
                ? `Ends in ${subscription.recipientPhoneLast4}`
                : "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">State</dt>
            <dd className="mt-1 font-medium text-zinc-950">
              {subscription?.active ? "Active" : "Off"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Last sent</dt>
            <dd className="mt-1 font-medium text-zinc-950">
              {formatDateTime(subscription?.lastSentAt)}
            </dd>
          </div>
          {subscription?.lastError ? (
            <div>
              <dt className="text-zinc-500">Last error</dt>
              <dd className="mt-1 font-medium text-rose-700">
                {subscription.lastError}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
