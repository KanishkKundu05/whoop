"use client";

import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const subscribeToOrigin = () => () => {};
const serverOrigin = () => "https://YOUR-PUBLIC-HOST";
const browserOrigin = () => window.location.origin;

export function DeliveryConfiguration({ missing, onError }: {
  missing: string[]; onError: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(subscribeToOrigin, browserOrigin, serverOrigin);
  const webhookUrl = `${origin}/api/whoop/webhook`;

  return <details className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
    <summary className="cursor-pointer font-medium text-zinc-700">App owner · Delivery configuration</summary>
    <div className="mt-4 space-y-5 leading-6 text-zinc-600">
      {!!missing.length && <p className="break-words rounded-lg bg-amber-50 p-3 text-amber-800">Missing or invalid: {missing.join(", ")}.</p>}
      <section>
        <h3 className="font-semibold text-zinc-900">1. WHOOP and storage</h3>
        <p className="mt-2">Set these server variables in <code>.env.local</code> for development or your hosting environment for production. Use separate random secrets of at least 32 characters.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs">{`WHOOP_CLIENT_ID=<WHOOP app ID>
WHOOP_CLIENT_SECRET=<WHOOP app secret>
WHOOP_REDIRECT_URI=${origin}/api/auth/whoop/callback
WHOOP_SESSION_SECRET=<32+ character secret>
NEXT_PUBLIC_CONVEX_URL=<Convex deployment URL>
WHOOP_SERVER_SECRET=<32+ character secret>
DAILY_MESSAGE_SECRET=<32+ character encryption secret>
DAILY_MESSAGE_GREETING="Good morning Mom"`}</pre>
        <p className="mt-3">Register that exact OAuth callback in WHOOP. Set the same <code>WHOOP_SERVER_SECRET</code> in Convex, deploy its functions with <code>npx convex deploy</code> (or <code>npm run convex:dev</code> locally), then restart the app. Keep existing encryption secrets when redeploying.</p>
      </section>
      <section>
        <h3 className="font-semibold text-zinc-900">2. Sleep webhook</h3>
        <p className="mt-2">Register this public HTTPS URL in your WHOOP app with model <strong>v2</strong>. This handler processes <code>sleep.updated</code> and ignores other event types.</p>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
          <code className="min-w-0 flex-1 break-all text-xs">{webhookUrl}</code>
          <button type="button" aria-label="Copy delivery webhook URL" className="shrink-0 rounded-lg p-2 hover:bg-zinc-200" onClick={async () => {
            try { await navigator.clipboard.writeText(webhookUrl); setCopied(true); }
            catch { onError("Clipboard unavailable. Select the webhook URL and copy it manually."); }
          }}>{copied ? <Check size={17} /> : <Copy size={17} />}</button>
        </div>
        <p className="mt-3">For local development, replace the local origin with a public HTTPS tunnel to this app. Allow webhook requests through hosting protection. The signing key is your WHOOP client secret; leave <code>WHOOP_WEBHOOK_SECRET</code> unset to use it. The diagnostic endpoint <code>/api/whoop/setup/webhook</code> only records connection tests and does not send reports.</p>
      </section>
      <section>
        <h3 className="font-semibold text-zinc-900">3. Linq delivery</h3>
        <p className="mt-2">For production, provision a Linq sending line and set <code>LINQ_TRANSPORT=api</code> and <code>LINQ_API_KEY</code>. The API selects the sending line. Optional <code>LINQ_PREFERRED_SERVICE</code>: iMessage, RCS, or SMS.</p>
        <p className="mt-3">For local CLI integration, use Node 22+ and Linq CLI 2.6.0+:</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs">{`npm install -g @linqapp/cli@latest
linq login  # or: linq signup
linq whoami
linq phonenumbers
linq profile set fromPhone +YOUR_LINQ_NUMBER`}</pre>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs">{`# .env.local — then restart npm run dev
LINQ_TRANSPORT=cli
# Optional absolute executable path from: which linq
LINQ_CLI_PATH=
# Optional profile and sender overrides
LINQ_PROFILE=default
LINQ_FROM_PHONE=`}</pre>
        <p className="mt-3">CLI mode uses your logged-in profile. Remove placeholder <code>LINQ_API_KEY</code> values: a configured key overrides the CLI token. Shared-line recipients must text your Linq number first. CLI mode runs only in development and does not provide provider idempotency; inspect chat history before retrying an uncertain send.</p>
      </section>
      <p>The daily fallback at <code>/api/messages/daily/cron</code> runs at 04:30 UTC in the checked-in Vercel schedule. Set <code>CRON_SECRET</code> to at least 16 random characters on the server. Webhook delivery does not require this fallback.</p>
      <p>Connect WHOOP with offline access, choose a consenting recipient above, then explicitly enable reports. Saving does not send a test. Configuration checks do not verify provider login, webhook registration, or handset delivery.</p>
      <Link href="/setup/connection" className="inline-block underline underline-offset-4">Manage WHOOP account</Link>
    </div>
  </details>;
}
