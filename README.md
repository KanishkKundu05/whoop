# WHOOP + Garmin Dashboard

A private Next.js dashboard for WHOOP API data with optional Garmin API account linking. It implements separate WHOOP OAuth and Garmin OAuth 2.0 PKCE flows, stores provider tokens in separate encrypted HTTP-only cookies, refreshes access tokens server-side, displays recent WHOOP profile, body, recovery, cycle, sleep, and workout data, and includes an Agentic DJ that matches SoundCloud tracks to the freshest WHOOP heart-rate signal available through the API.

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
- `/api/garmin/diagnostics` returns Garmin configuration and session diagnostics.
- `/api/whoop/export?range=30` returns the same dashboard data as JSON for the current browser session.
- `/api/dj/recommendation` returns the current Agentic DJ recommendation for a connected session.

## Verification

```bash
npm run lint
npm run build
```
