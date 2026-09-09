# WHOOP → daily sleep text to Mom: personal setup and logic review

Reviewed on 7 September 2026 against this repository and the official API documentation. This guide documents the existing implementation and required fixes; it does not deploy changes or send a message.

Update, 9 September: a [connection test dashboard](whoop-connection-dashboard.md)
is available at `/setup`. The empty webhook-secret fallback issue below has been
fixed. Other daily-message findings remain applicable.

## What you can expect

Use your own WHOOP account, one recipient, the existing Next.js app, Convex for persistent credentials, and Linq for sending. Your mother does not need a WHOOP account or to authorize your app.

The trigger is **WHOOP has processed a sleep update**, not the exact moment you wake up. The current app treats the sleep's `end` as wake time. Sending depends on your WHOOP data reaching its cloud and a usable score becoming available; there is no guaranteed wake-to-text delay.

The existing message contains start time, wake time, and actual sleep duration. **Sleep-quality metrics are not yet included.** The fixes below are necessary before treating this as a reliable unattended daily report.

## 1. Configure WHOOP

Create or edit your app in the [WHOOP developer dashboard](https://developer-dashboard.whoop.com). Personal development can start without public app approval: WHOOP currently permits 10 members before approval for broader access. [App approval](https://developer.whoop.com/docs/developing/app-approval/)

Use your stable deployed origin. The repository README lists `https://whoop-delta-sable.vercel.app`; substitute your actual production domain if it has changed. That deployment was not inspected during this review.

| Setting | Value for the domain in the README |
| --- | --- |
| OAuth redirect URL | `https://whoop-delta-sable.vercel.app/api/auth/whoop/callback` |
| Webhook URL | `https://whoop-delta-sable.vercel.app/api/whoop/webhook` |
| Webhook model | **v2** |
| Local OAuth redirect, if developing locally | `http://localhost:3000/api/auth/whoop/callback` |

Configure these scopes to match `src/lib/whoop/config.ts`:

```text
offline read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout
```

A future sleep-only app could request `offline read:profile read:sleep`. Keep the existing scopes for now because this app's dashboard and reconciliation path fetch other resources too.

Save the client ID and client secret in the app's server environment. The callback URL must match the registered URL exactly. It is a separate endpoint from the webhook.

## 2. Configure Linq

1. Arrange at least one provisioned sending number on your Linq account. Check that your account can reach your mother's number and country over the intended service. A syntactically valid phone number alone does not establish delivery support. [Linq quickstart](https://docs.linqapp.com/channel/imessage/getting-started/quickstart/)
2. In [Linq API tooling](https://dashboard.linqapp.com/api-tooling), open **API → Overview → Generate new token**. Store that bearer token as `LINQ_API_KEY`. [Authentication](https://docs.linqapp.com/channel/imessage/getting-started/authentication/)
3. Initially use your own phone as the recipient for testing. Later replace it with your mother's full international number, such as `+91` followed by her Indian mobile number.

The existing sender calls `POST https://api.linqapp.com/api/partner/v3/messages` with `Authorization: Bearer <LINQ_API_KEY>`, `to`, and `message.parts`. This endpoint automatically selects a Linq sending line, so **no `LINQ_FROM_NUMBER` is required by this code**. The message comes from that line; it is not automatically sent from your personal SIM. [Sending messages](https://docs.linqapp.com/channel/imessage/guides/messaging/sending-messages/)

`LINQ_PREFERRED_SERVICE` may be `iMessage`, `RCS`, or `SMS`; leave it unset initially unless you require a particular service. The current request's service preference and idempotency fields are documented by Linq. Its response is `202 Accepted`, with message information nested under `message`, including `message.id` and `message.delivery_status`. Acceptance does not prove handset delivery. [Send-message reference](https://docs.linqapp.com/channel/imessage/api/resources/messages/methods/create/)

No Linq webhook is required to initiate a sleep text. Delivery tracking would be a separate addition.

## 3. Configure environment and storage

Local inspection found WHOOP credentials, the session secret, and the Convex URL present. **`DAILY_MESSAGE_SECRET`, `LINQ_API_KEY`, and `CRON_SECRET` were unset.** Presence is not credential validation, and local settings do not establish what is configured in Vercel.

Add these to Vercel's **Production** environment, and to root `.env.local` for local development:

```dotenv
WHOOP_CLIENT_ID=<from WHOOP>
WHOOP_CLIENT_SECRET=<from WHOOP>
WHOOP_SESSION_SECRET=<random secret of at least 32 characters>
WHOOP_REDIRECT_URI=https://whoop-delta-sable.vercel.app/api/auth/whoop/callback
NEXT_PUBLIC_CONVEX_URL=https://<your-production-deployment>.convex.cloud
DAILY_MESSAGE_SECRET=<different random secret of at least 32 characters>
LINQ_API_KEY=<Linq bearer token>
CRON_SECRET=<another random secret>
DAILY_MESSAGE_GREETING="Good morning Mom"
```

Generate each new secret separately:

```bash
openssl rand -hex 32
```

Preserve existing session/encryption secrets if already in use. Changing `DAILY_MESSAGE_SECRET` without re-encrypting existing records makes their tokens and recipient numbers unreadable. Secrets belong on the server; do not prefix them with `NEXT_PUBLIC_`.

**Leave `WHOOP_WEBHOOK_SECRET` unset unless it is exactly the WHOOP client secret.** WHOOP signs with the client secret. This app permits an override, but does not need a separate generated webhook secret. As of 9 September, blank overrides correctly fall back to the client secret. [Webhook security](https://developer.whoop.com/docs/developing/webhooks/#webhooks-security)

Do not overwrite an existing `.env.local` by copying the template. For local work, use the localhost redirect and the corresponding registered URL.

Convex is required for background sending even though the main dashboard can fetch WHOOP without it. The `dailySmsSubscriptions` table stores encrypted access/refresh tokens, the encrypted recipient, token expiry, active state, and send status.

For initial local provisioning:

```bash
npm install
npm run convex:dev
```

Use the Convex CLI to select/create the intended project. Before production use, deploy the checked-in schema/functions to that project's production deployment:

```bash
npx convex deploy
```

Verify Vercel's `NEXT_PUBLIC_CONVEX_URL` points to that production deployment, not a separate development database. Set the variables before rebuilding/redeploying Next.js. Use the existing project's Vercel deployment workflow; if using its CLI:

```bash
npx vercel --prod
```

The public webhook must be reachable by WHOOP without a hosting login challenge. Its signature validation supplies request authentication. Localhost alone cannot receive WHOOP callbacks; local webhook testing needs an HTTPS tunnel and a running app. Use the stable deployment for overnight operation.

## 4. Connect your account and save the recipient

1. Open `/daily-message` on the deployed app and connect **your** WHOOP account.
2. Complete WHOOP consent and return to the app.
3. Enter your own E.164 phone number first and click **Save**.
4. Verify status shows **Ready**, **Active**, and the expected last four digits.
5. Complete the controlled test below before switching to your mother's number.

Connecting WHOOP alone does not enable background messages. Saving on `/daily-message` copies the credentials into Convex. The process can then run without an open browser. Saving the recipient does not itself send a test message.

Garmin, Apple Watch, the iMessage extension, and an LLM are unnecessary for this flow.

## 5. Understand the trigger and authentication

```mermaid
sequenceDiagram
    participant You
    participant App as Next.js app
    participant WHOOP
    participant DB as Convex
    participant Linq
    You->>App: Connect WHOOP
    App->>WHOOP: Authorization request with state and scopes
    WHOOP-->>App: Callback with authorization code
    App->>WHOOP: Exchange code for tokens
    You->>App: Save recipient
    App->>DB: Persist encrypted tokens and recipient
    WHOOP->>App: Signed sleep.updated event
    App->>DB: Load active subscription by WHOOP user ID
    App->>WHOOP: Refresh token if needed; fetch sleep by UUID
    App->>App: Check scored main sleep and send history
    App->>Linq: Send text with bearer token
    Linq-->>App: Message accepted
    App->>DB: Record send
```

### Which webhook?

WHOOP sends `sleep.updated` for creation and edits. Register a v2 URL; WHOOP sends all event types, and this route ignores everything except `sleep.updated`. Its payload identifies `user_id`, sleep UUID `id`, event `type`, and `trace_id`; it does not carry the report. [WHOOP webhooks](https://developer.whoop.com/docs/developing/webhooks/)

The app fetches `GET /developer/v2/activity/sleep/{id}` and requires `nap === false`, `score_state === "SCORED"`, and a score object. `PENDING_SCORE` currently gets skipped, without a scheduled per-sleep retry. The fallback may pick it up later. Sleep `updated_at` indicates a data revision; `end` is the recorded sleep end. Neither establishes webhook arrival time. [Sleep API](https://developer.whoop.com/api/#tag/Sleep)

### Three separate credentials

| Connection | Authentication in this app |
| --- | --- |
| Your account → WHOOP data | OAuth authorization-code flow; callback checks random `state` against an HTTP-only cookie; server exchanges code using client credentials |
| WHOOP → webhook | Base64 HMAC-SHA256 of timestamp header concatenated with the exact raw request body, keyed with the WHOOP client secret; constant-time comparison |
| App → Linq | Server's Linq bearer token |
| Scheduler → cron route | `Authorization: Bearer <CRON_SECRET>` |

The webhook verifier reads `X-WHOOP-Signature` and `X-WHOOP-Signature-Timestamp`; JSON must not be reserialized before checking. This is implemented in `src/lib/whoop/webhook.ts`.

OAuth requires `offline` for a refresh token. `expires_in` determines expiry; the background sender refreshes within five minutes of it and saves replacement tokens. WHOOP rotates tokens: a refresh invalidates the prior tokens, so all consumers must share the current pair. The current browser/Convex separation violates that requirement; see the review below. [WHOOP OAuth](https://developer.whoop.com/docs/developing/oauth/)

## 6. Logic review: fixes before unattended use

These findings come from the checked-in code, not a live delivery test.

| Priority | Finding and consequence | Required change |
| --- | --- | --- |
| First | `daily-whoop.ts` formats only timing and duration. The requested quality report is absent. | Add the measured fields described below. |
| First | Browser refresh in `/api/auth/refresh` and `/api/messages/daily/setup` updates cookies, while `daily-send.ts` updates Convex. Either can invalidate the other's credentials. Simultaneous cron/webhook refreshes also race. | Use one persistent token source for all consumers, with a per-user refresh lock/lease and re-read after acquiring it. Cookies should identify the session, not own a competing token pair. |
| First | `/api/whoop/webhook` returns HTTP 200 even for `result.ok === false`. Errors from WHOOP or Linq can therefore look successfully handled. | Return non-2xx for transient failures until a durable retry queue exists. Prefer acknowledging only after durable enqueue, then process/retry in a worker. |
| First | No freshness or activation cutoff. A historical sleep edit can send an old report. Cron can select an older scored sleep while today's sleep is pending, and the data client may fall back to unfiltered history. | Use the same eligibility rule for webhook and cron: newest eligible main sleep, recent `end`, and explicit activation cutoff. Suggested personal policy: ended within 18 hours and after messaging was enabled; make historical tests an explicit exception. |
| First | `convex/whoop.ts` exports subscription queries/mutations without authorization checks, including token updates and active-state changes. `publicDashboard` also exposes stored records directly. | Restrict backend operations to authorized server calls and restrict personal data reads. Hiding the web page or encrypting token fields alone does not authorize Convex operations. This matters for a personal deployment too. |
| Next | `linq.ts` parses top-level IDs or `messages[0]`, but misses documented `message.id` and `message.delivery_status`. | Parse the actual response, persist message ID, and distinguish accepted from delivered. Confirm the first delivery on the recipient's handset. |
| Next | Only `lastSentSleepId` is stored. This is a last-record check, not a complete send ledger. Concurrent handlers can both reach Linq. | Keep provider idempotency (already present) and add an atomic record keyed by `(whoopUserId, sleepId)`. Preserve historical send records and do not resend on ordinary edits. |
| Next | Pending scores have no dedicated retry; webhook handling performs all network work inline. | Schedule bounded retries for pending/transient cases and retain reconciliation. |
| Next | Signature validation has no timestamp freshness check or persisted event replay check. | Validate timestamp age with a retry-aware policy and deduplicate event traces alongside the sleep send ledger. |

WHOOP retries failed deliveries five times over roughly an hour, recommends a quick response and reconciliation, and may duplicate events. These behaviors make correct HTTP status and durable processing important. [Delivery and retries](https://developer.whoop.com/docs/developing/webhooks/#delivery--retries)

### What the quality report should contain

Suggested template, **not currently implemented**; numbers are illustrative:

> Good morning Mom — WHOOP recorded my sleep ending at 7:12 AM. I slept 7h 34m. Sleep performance: 92%; efficiency: 95%. Deep sleep: 1h 28m; REM: 1h 42m; awake time: 24m.

Use `sleep_performance_percentage`, `sleep_efficiency_percentage`, and `stage_summary` fields for deep, REM, and awake duration. The current duration calculation correctly sums light + deep + REM rather than treating the whole sleep interval as time asleep. Omit unavailable values; preserve legitimate zeros. Label these as WHOOP measurements, without inventing a separate quality score or diagnosing health from them. [Sleep response fields](https://developer.whoop.com/api/#tag/Sleep)

For this first version, keep recovery/HRV out of the report. Adding them later requires fetching the matching recovery and handling its separate readiness. The current route ignores `recovery.updated`.

### Reconciliation schedule

The original `vercel.json` used `0 15 * * *`: **15:00 UTC / 8:30 PM IST**, once daily. The 9 September setup deployment removes that schedule until daily messaging is ready. `CRON_SECRET` is required for this route even though the older README called it optional. The daily-message setup screen's **Ready** check does not check it, webhook reachability, or Linq delivery.

For a daily morning fallback, a proposed schedule is `30 4 * * *` (10:00 AM IST). For quicker recovery, use a scheduler supporting authenticated calls every 10–15 minutes, after fixing freshness and refresh races. Vercel Hobby supports only once-daily jobs with imprecise timing; frequent cron requires an appropriate plan or another scheduler. No schedule was changed in this review. [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## 7. Controlled end-to-end test

The following steps can send real messages. Use your own number first.

1. Save your own number, with exactly one active subscription in the intended Convex deployment. Verify a recent main sleep is scored in WHOOP.
2. Run one reconciliation request. Set `APP_ORIGIN` to the deployed origin and securely supply its `CRON_SECRET` in your terminal environment; `.env.local` is not automatically loaded by your shell.

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_ORIGIN}/api/messages/daily/cron"
```

This processes **all active subscriptions**, not just the logged-in user. It is not a dry run. Inspect the JSON: HTTP 200 alone is insufficient because the current cron also reports item failures inside a successful HTTP response.

3. Confirm `checked: 1`, `sent: 1`, and actual receipt on your phone. If already processed, expect `already_sent`. Repeat once after completion: it should skip the same sleep.
4. Separately test the real WHOOP webhook by editing a recent sleep's start/end by one minute and reverting afterward. WHOOP documents this as a test trigger. Watch the webhook request in hosting logs and inspect subscription status. If the sleep was already sent, a skip is expected; that validates delivery/routing without another text. [Webhook testing](https://developer.whoop.com/docs/developing/webhooks/#webhooks-testing)
5. Observe the next newly scored main sleep without manually calling cron. Confirm a single message and compare its times with WHOOP. After token expiry, verify background sending still works; revisit the dashboard too when testing the refresh fix.
6. Change the recipient to your mother's number and save. Existing send history is preserved, so the already-tested sleep will not immediately send again; the next eligible sleep should trigger it.

To stop sending, use **Turn off** on `/daily-message`. Browser logout only clears cookies; it does not disable the stored subscription. If stale tokens prevent opening setup, reconnect WHOOP, save the recipient again to replace stored tokens, and then disable if desired. Reconnection is recovery from the current token bug, not a permanent fix.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing configuration | Local and production variables separately; redeploy after changes; replace placeholders |
| Webhook 401 | Remove an empty/incorrect `WHOOP_WEBHOOK_SECRET`; verify client secret and raw-body signature |
| No webhook arrives | v2 URL, public HTTPS access, app authorization, and a newly processed sleep change |
| `no_active_subscription` | Recipient was saved under this WHOOP user and in the same Convex deployment |
| `pending_score` or `no_scored_main_sleep` | WHOOP scoring/data sync; inspect API errors too, since collection failures can currently become an empty-result skip |
| Cron 401 | Production `CRON_SECRET` matches the bearer header |
| Refresh failure / WHOOP 401 | Competing browser/background token copies; reconnect and save again, then implement shared token ownership |
| Linq 401/403 | Token validity and access to a provisioned sending line |
| “Sent” but no text | Linq acceptance is not delivery; inspect Linq status, recipient format, and service/country support |

## Scope of this review

Read the OAuth, webhook, message formatting/sending, subscription storage, cron, UI, and Convex code; compared the APIs with official documentation; checked local environment presence without printing credentials. No provider credentials were validated, no cloud configuration was changed, and no live message was sent.

The personal flow needs no billing, onboarding for other users, or public WHOOP approval yet. After the first reliable days of operation, broader service work would add user isolation, recipient verification/preferences, durable delivery monitoring, and WHOOP approval. The immediate work is the concrete personal-use fixes above.
