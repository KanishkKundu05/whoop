# WHOOP + Garmin + Apple Watch Dashboard

A private Next.js dashboard for WHOOP API data with optional Garmin API account linking and an Apple Watch/HealthKit support skeleton. It implements separate WHOOP OAuth and Garmin OAuth 2.0 PKCE flows, stores provider tokens in separate encrypted HTTP-only cookies, refreshes access tokens server-side, displays recent WHOOP profile, body, recovery, cycle, sleep, and workout data, and includes an Agentic DJ that matches SoundCloud tracks to the freshest WHOOP heart-rate signal available through the API.

## Try the Deployed App

Production URL:

```text
https://whoop-delta-sable.vercel.app
```

To let someone else try it, they need:

1. A WHOOP account with data.
2. The production redirect URI added to the WHOOP developer app:

```text
https://whoop-delta-sable.vercel.app/api/auth/whoop/callback
```

3. The deployed Vercel project configured with these Production environment variables:

```text
WHOOP_CLIENT_ID
WHOOP_CLIENT_SECRET
WHOOP_SESSION_SECRET
GARMIN_CLIENT_ID
GARMIN_CLIENT_SECRET
GARMIN_SESSION_SECRET
NEXT_PUBLIC_CONVEX_URL
```

After those are in place, the tester can open the production URL, click **Connect WHOOP** or **Connect Garmin**, authorize access, and return to the dashboard.

## First-Time Local Setup

1. Create a WHOOP app in the developer dashboard:

```text
https://developer-dashboard.whoop.com
```

2. Add this local redirect URI to the WHOOP app:

```text
http://localhost:3000/api/auth/whoop/callback
```

3. Create a Garmin app in the Garmin Connect Developer Program and add this local redirect URI:

```text
http://localhost:3000/api/auth/garmin/callback
```

Garmin permissions are managed in the Garmin developer portal and during user consent.

4. Copy the env template:

```bash
cp .env.example .env.local
```

5. Fill in `.env.local`:

```text
WHOOP_CLIENT_ID=your-whoop-client-id
WHOOP_CLIENT_SECRET=your-whoop-client-secret
WHOOP_REDIRECT_URI=http://localhost:3000/api/auth/whoop/callback
WHOOP_SESSION_SECRET=replace-with-at-least-32-random-characters
GARMIN_CLIENT_ID=your-garmin-client-id
GARMIN_CLIENT_SECRET=your-garmin-client-secret
GARMIN_REDIRECT_URI=http://localhost:3000/api/auth/garmin/callback
GARMIN_SESSION_SECRET=replace-with-at-least-32-random-characters
NEXT_PUBLIC_CONVEX_URL=your-convex-deployment-url
WHOOP_PUBLIC_USER_ID=optional-public-whoop-user-id
```

Generate a session secret with:

```bash
openssl rand -base64 32
```

6. Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. If port 3000 is busy, Next.js prints the alternate local URL.
If you use an alternate port, update `WHOOP_REDIRECT_URI`,
`GARMIN_REDIRECT_URI`, and both developer app redirect URIs to the exact
callback URLs.

## Convex Database

The app can persist every dashboard fetch into Convex using the schema in
`convex/schema.ts`. WHOOP data is normalized into typed tables for users, body
measurements, cycles, recoveries, sleeps, workouts, and dashboard fetch audits.

Set up Convex locally with:

```bash
npm run convex:dev
```

That command provisions a Convex deployment, writes the Convex environment
values, and keeps backend functions synced while it runs. Once
`NEXT_PUBLIC_CONVEX_URL` is present, dashboard loads call the
`whoop:storeDashboardFetch` mutation after fetching WHOOP. If Convex is not
configured, the dashboard still renders live WHOOP data and skips persistence.

## Public Sleep Dashboard

The public read-only dashboard is available at:

```text
/public
```

It does not call WHOOP directly and it does not require a visitor auth cookie.
Instead, the owner signs in at `/`, the authenticated dashboard fetches WHOOP
data and stores the latest records in Convex, and `/public` renders the stored
sleep, recovery, cycle strain, and workout summaries for the configured user.

To publish your own data:

1. Connect WHOOP at `/` and wait for the dashboard to load once.
2. Keep `NEXT_PUBLIC_CONVEX_URL` configured so the public route can read the
   stored data.
3. Optionally set `WHOOP_PUBLIC_USER_ID=your-whoop-user-id` to pin the public
   page to one user. If it is omitted, `/public` uses the latest synced WHOOP
   user in Convex.

The public page intentionally omits email and body measurements.

## Wake-Triggered Linq Message

Start with **[Connection setup](/setup)** in the app before enabling messages.
The dashboard walks through WHOOP consent, a read-only profile/sleep API test,
and receipt of a real signed `sleep.updated` webhook. See
[dashboard setup instructions](docs/whoop-connection-dashboard.md).

See the [personal WHOOP + Linq setup guide and logic review](docs/whoop-linq-personal-setup.md)
for current configuration steps, webhook/OAuth details, a controlled delivery test,
and known reliability issues to fix before unattended use.

The app can send a message to a configured recipient when WHOOP reports that
your main sleep was updated and scored:

```text
Good morning Mom - I woke up at 7:12 AM, slept 7h 34m, and went to sleep at 11:18 PM last night.
```

It uses the WHOOP `sleep.updated` webhook as the primary trigger, fetches that
sleep from the WHOOP API, waits for a scored non-nap sleep, and sends through
Linq over iMessage/RCS/SMS. The sleep `end` timestamp is used as the wake-up
time. The `/api/messages/daily/cron` route is a future reconciliation fallback
for missed webhooks. Its schedule is disabled during connection testing.

Setup:

1. Add these environment variables locally and in Vercel Production:

```text
DAILY_MESSAGE_SECRET=replace-with-at-least-32-random-characters
LINQ_API_KEY=your-linq-api-key
LINQ_PREFERRED_SERVICE=optional-iMessage-RCS-or-SMS
DAILY_MESSAGE_GREETING=Good morning Mom
CRON_SECRET=required-for-reconciliation-cron
```

2. Connect WHOOP, then open `/daily-message`.
3. Enter the recipient phone number in E.164 format, such as `+14155552671`.
4. In the WHOOP Developer Dashboard, add this webhook URL:

```text
https://your-vercel-domain.vercel.app/api/whoop/webhook
```

The setup stores the WHOOP access token, WHOOP refresh token, and recipient
phone number encrypted in Convex. The webhook route validates
`X-WHOOP-Signature` and `X-WHOOP-Signature-Timestamp`. If
`WHOOP_WEBHOOK_SECRET` is unset, it falls back to `WHOOP_CLIENT_SECRET`.
Leave the override unset: WHOOP signs with the client secret. Empty overrides
also fall back to the client secret.
The reconciliation cron route requires
`Authorization: Bearer $CRON_SECRET`, which Vercel sends automatically for
cron invocations when `CRON_SECRET` is configured.

## WHOOP Scopes

The app requests these scopes:

```text
offline read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout
```

These scopes are used for profile details, body metrics, recovery, cycle, sleep, workout records, token refresh, the JSON export route, and the Agentic DJ heart-rate signal.

## Garmin API Support

Garmin uses OAuth 2.0 with PKCE for the Garmin Connect Developer Program. This app keeps Garmin separate from WHOOP with:

- `/api/auth/garmin` to start the Garmin OAuth flow.
- `/api/auth/garmin/callback` as the Garmin redirect URI.
- `/api/auth/garmin/refresh` to rotate Garmin access tokens.
- `/api/auth/garmin/disconnect` to delete the Garmin user registration and clear the local Garmin session.
- `/api/garmin/diagnostics` to verify the connected Garmin user ID, permissions, token expiry, and configuration.

Garmin API permissions are selected in the Garmin developer portal and by the user during consent, so the app does not send a `scope` parameter.

## Apple Watch Support Skeleton

The dashboard includes an Apple Watch support panel and a manifest route at
`/api/apple-watch/manifest`. This is intentionally a skeleton: HealthKit data
cannot be read directly by the web app, so real Apple Watch support requires an
iOS/watchOS companion app that requests HealthKit permissions and sends
summarized samples to this server.

The planned HealthKit bridge covers sleep analysis, heart rate, HRV, resting
heart rate, respiratory rate, wrist temperature, and workouts.

## Sleep Widget Specs

The dashboard includes a sleep widget spec section for metrics beyond the
standard WHOOP app widgets. WHOOP-derived ideas include bedtime compass, sleep
consistency drift, sleep debt payoff, restorative yield, awake tax, and nap
leverage. Apple Watch-dependent ideas include true sleep latency and wind-down
nudges from HealthKit in-bed/asleep samples.

WHOOP exposes sleep start/end timestamps, stage summaries, sleep-needed
breakdowns, performance, consistency, and efficiency through the public API. It
does not expose a direct time-to-fall-asleep field in the public sleep schema,
so the dashboard treats bedtime guidance as derived timing until Apple Health
data is connected.

## Agentic DJ

After connecting WHOOP, the dashboard shows an **Agentic DJ** panel. Click **Start** to poll the server for a recommendation. The server reads the latest available WHOOP heart-rate signal, selects the closest matching song from the local BPM-tagged SoundCloud catalogue, and the client plays it through the SoundCloud Widget API.

WHOOP does not expose continuous live heart-rate data through the public API. The DJ uses the freshest API signal available in this order:

1. Latest workout average heart rate.
2. Latest cycle average heart rate.
3. Latest recovery resting heart rate.

The dashboard labels the source so testers know whether the BPM came from workout, cycle, or recovery data.

## Deploying With Vercel

1. Link the project:

```bash
npx vercel link
```

2. Add Production environment variables:

```bash
npx vercel env add WHOOP_CLIENT_ID production
npx vercel env add WHOOP_CLIENT_SECRET production
npx vercel env add WHOOP_SESSION_SECRET production
npx vercel env add GARMIN_CLIENT_ID production
npx vercel env add GARMIN_CLIENT_SECRET production
npx vercel env add GARMIN_SESSION_SECRET production
npx vercel env add NEXT_PUBLIC_CONVEX_URL production
npx vercel env add WHOOP_PUBLIC_USER_ID production
```

3. Deploy:

```bash
npx vercel --prod
```

4. Add the production callback URL to the WHOOP app:

```text
https://your-vercel-domain.vercel.app/api/auth/whoop/callback
```

5. Add the production callback URL to the Garmin app:

```text
https://your-vercel-domain.vercel.app/api/auth/garmin/callback
```

If `WHOOP_REDIRECT_URI` or `GARMIN_REDIRECT_URI` is not set in Vercel, the app derives the callback URL from the request host. That is usually the easiest setup for deployments.

## OAuth Redirect Troubleshooting

WHOOP and Garmin require exact redirect URI matches. The callback URLs shown on
the app's setup screen must be present in the corresponding developer apps,
including protocol, hostname, port, path, and trailing slash behavior.

For production deployments, either leave provider redirect URI variables unset
so the app uses the public request host, or set them to the exact production
callback URLs. Do not reuse local callback URLs in Vercel. If a localhost
redirect URI is accidentally present on a non-local host, the app ignores it and
derives the callback URL from the current request host instead.

## Useful Routes

- `/api/auth/whoop` starts the WHOOP OAuth flow.
- `/api/auth/refresh` refreshes and rotates the WHOOP token session.
- `/api/auth/logout` clears local encrypted provider cookies.
- `/api/auth/disconnect` revokes WHOOP access and clears the local session.
- `/api/auth/garmin` starts the Garmin OAuth PKCE flow.
- `/api/auth/garmin/refresh` refreshes and rotates the Garmin token session.
- `/api/auth/garmin/disconnect` revokes Garmin access and clears the local session.
- `/public` renders the public read-only sleep and strain dashboard from Convex.
- `/api/garmin/diagnostics` returns Garmin configuration and session diagnostics.
- `/api/apple-watch/manifest` returns the planned Apple Watch/HealthKit bridge capabilities.
- `/api/whoop/export?range=30` returns the same dashboard data as JSON for the current browser session.
- `/api/dj/recommendation` returns the current Agentic DJ recommendation for a connected session.

## Verification

```bash
npm run lint
npm run build
```

## Spotify live BPM DJ

The `/whoop/music` experience now imports Spotify liked songs, resolves BPM with
ReccoBeats, and selects the next track using live WHOOP Bluetooth heart rate about
**15 seconds before each song finishes**. It queues the match and lets Spotify
finish the current song naturally. The dashboard's older SoundCloud DJ remains
available separately.

### Setup

1. Register a Spotify developer application and add the exact callback URL below.
2. Set these server environment variables (also shown in `.env.example`):

   ```dotenv
   SPOTIFY_CLIENT_ID=your-client-id
   SPOTIFY_CLIENT_SECRET=your-client-secret
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
   SPOTIFY_SESSION_SECRET=a-separate-random-secret-of-at-least-32-characters
   ```

   Use your HTTPS domain for production. Use the same origin in your browser as
   the configured callback. Spotify does not accept `localhost` as a redirect host;
   use the loopback IP for development. Restart the application after configuring.
   If WHOOP was previously connected on `localhost`, configure its callback on
   the same `127.0.0.1` origin and reconnect there so its session cookie is available.
3. Connect WHOOP, visit `/whoop/music`, then connect Spotify. Spotify Premium and
   access to your development-mode app are required. Requested scopes are
   `user-library-read`, `user-read-playback-state`, and
   `user-modify-playback-state`. Tokens are encrypted in an HTTP-only cookie.
4. Sync liked songs. ReccoBeats requires no API key. Imports paginate through the
   entire library, checkpoint completed BPM lookups, and can resume after failure.
   Only exact Spotify-ID mappings are accepted; missing BPMs are excluded.
5. Enable WHOOP **Heart Rate Broadcast**, then use **Connect WHOOP Bluetooth** in a
   supported Chrome/Edge browser. Safari/iPhone browsers need a native bridge,
   which is not included. Bluetooth must be available on the listening device.
6. Open Spotify on the desired device, clear its queue, and disable shuffle,
   repeat, autoplay, and crossfade. Start one song there or use the first-song
   selector. Start the live DJ and keep its tab visible.

### Runtime and data behavior

- The decision uses the preceding five seconds of fresh heart-rate samples and
  minimizes the absolute difference between heart rate and song BPM. Current and
  recent songs are excluded where the library permits. No half/double-time or
  energy weighting is applied.
- A browser lock prevents two tabs from controlling the DJ simultaneously. The
  controller stops on hidden tabs, device changes, sensor disconnects, stale
  heart rate at decision time, and queue conflicts. It resumes only when started
  again. Pausing Spotify suspends selection until playback resumes.
- Queue commands are verified and never automatically retried after an uncertain
  result. Spotify cannot reliably replace an arbitrary pre-existing queue with
  this API. The app reports conflicts instead of silently appending tracks.
- Stop DJ stops future selection; a song already submitted to Spotify remains
  queued. Pause Spotify also pauses playback. A request already received by
  Spotify may finish even if the local session is stopped.
- Compact track/BPM records are cached per Spotify account in this browser for
  seven days. Heart-rate samples remain in memory. Disconnect Spotify removes
  that account's local cache and cookie. Disconnecting here does not revoke the
  grant in Spotify; revoke it from Spotify account settings if needed.
- Successful full imports reconcile unliked tracks. Partial failures preserve
  previous membership and successful lookup checkpoints. Browser storage limits
  and missing provider coverage are surfaced as errors, not fabricated BPMs.
- GetSongBPM and Soundcharts are researched alternatives, not enabled adapters.
  Retention and provider permissions should be reviewed for wider distribution.

Run `node --test tests/spotify-dj.test.cjs` for isolated matching, Bluetooth parsing,
cache, OAuth, and playback-route tests. Hardware pairing and real Spotify queue
transitions require an authorized Premium account and a nearby WHOOP device.
See [the implementation plan](docs/spotify-whoop-bpm-dj-plan.md) for research and
remaining platform constraints.
