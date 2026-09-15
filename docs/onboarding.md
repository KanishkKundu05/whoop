# Device and WHOOP onboarding

The home page (`/`) offers Garmin, Apple Watch, and WHOOP. Garmin and Apple Watch are marked coming soon. The WHOOP card opens `/setup/connection`, a three-step configuration funnel. Authorization started in the funnel returns there and resumes at the data check. The `/whoop` page is where a connected user chooses music pacing (`/whoop/music`) or morning sleep texts (`/setup`). Anonymous visits to either experience return to the WHOOP connection screen. Expired sessions use the existing refresh endpoint and return to a reconnect screen if renewal fails.

Morning texts use four steps, with a progress indicator above the current panel:

1. WHOOP: the authorized account is already connected.
2. Delivery: check server configuration and offline access; expose Linq/storage/webhook instructions under app-owner settings.
3. Sleep report: preview the same formatter and configured greeting used by the sender, with explicitly illustrative sleep values.
4. Recipient: validate an international phone number, acknowledge sharing, and explicitly enable messages.

Back/Continue navigation uses `?step=` and browser history. The phone draft survives navigation between steps in the mounted flow but is not written to browser storage. Activation is restored from server subscription status, never from a completion URL. Only the number’s last four digits are returned by the API. Saving enables the existing subscription and does not send a test text. Users can change the recipient or turn messages off after activation.

The former data dashboard remains at `/dashboard`; advanced WHOOP connection checks are at `/setup/connection`. The old `/daily-message` URL redirects to `/setup`.

## Deployment configuration

The onboarding checks the Convex URL, a `DAILY_MESSAGE_SECRET` of at least 32 characters, and a nonblank `LINQ_API_KEY`. Configure a Linq sending line and deploy the existing Convex schema/functions. Preserve existing encryption secrets. Register the app’s public HTTPS `/api/whoop/webhook` endpoint with WHOOP using model v2, replacing the test listener URL. Optional `DAILY_MESSAGE_GREETING` controls the greeting in both preview and sent report.

Configuration presence does not verify Linq credentials, webhook registration, or handset receipt. Sending still uses the existing scored-sleep webhook pipeline, not a scheduled wake-up time. No changes to external credentials, webhook registration, or scheduled jobs are part of this UI change. The sender limitations recorded in `whoop-linq-personal-setup.md` still apply; a successful onboarding is not an end-to-end delivery certification.

## Verification

Run `npm run lint`, `npx tsc --noEmit`, `node --test tests/*.test.cjs`, and `npm run build`.

Browser checks use a synthetic authenticated session and intercepted messaging responses; they never call Linq or write subscriptions to Convex. Cover the anonymous gate, WHOOP feature choices, desktop/mobile layouts, Back/Continue and browser history, invalid number, failed-save retry, completion after reload, configuration gating, expired sessions, and disabling messages. A live delivery check requires a configured Linq line, WHOOP webhook, and an explicitly chosen recipient.

## WHOOP configuration funnel

`/setup/connection` shows one panel at a time: authorize WHOOP, verify profile/sleep API access, then receive a signed sleep update. Continue requires the active check to pass; Back and the progress rail revisit accessible steps. API verification stays in memory and must be rerun after a reload; the session and webhook receipt are read from the server. A missing or expired session returns the flow to connection. An API result only counts for the currently connected user.

The WHOOP skin uses route-scoped Funnel Display headings, an ivory background, forest-green actions, and a responsive progress rail. Completion hands off to the existing `/setup` morning-text flow. Linq, recipient activation, and delivery reliability remain separate; this funnel never sends a message. Garmin and Apple Watch remain coming soon as described in `TODO.md`.
