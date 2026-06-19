# WHOOP Dashboard

A private Next.js dashboard for WHOOP API data. It implements WHOOP OAuth, stores tokens in an encrypted HTTP-only cookie, refreshes access tokens server-side, displays recent profile, body, recovery, cycle, sleep, and workout data, and includes an Agentic DJ that matches SoundCloud tracks to the freshest WHOOP heart-rate signal available through the API.

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
```

After those are in place, the tester can open the production URL, click **Connect WHOOP**, authorize access, and return to the dashboard.

## First-Time Local Setup

1. Create a WHOOP app in the developer dashboard:

```text
https://developer-dashboard.whoop.com
```

2. Add this local redirect URI to the WHOOP app:

```text
http://localhost:3000/api/auth/whoop/callback
```

3. Copy the env template:

```bash
cp .env.example .env.local
```

4. Fill in `.env.local`:

```text
WHOOP_CLIENT_ID=your-whoop-client-id
WHOOP_CLIENT_SECRET=your-whoop-client-secret
WHOOP_REDIRECT_URI=http://localhost:3000/api/auth/whoop/callback
WHOOP_SESSION_SECRET=replace-with-at-least-32-random-characters
```

Generate a session secret with:

```bash
openssl rand -base64 32
```

5. Install dependencies and start the app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. If port 3000 is busy, Next.js prints the alternate local URL.

## WHOOP Scopes

The app requests these scopes:

```text
offline read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout
```

These scopes are used for profile details, body metrics, recovery, cycle, sleep, workout records, token refresh, the JSON export route, and the Agentic DJ heart-rate signal.

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
```

3. Deploy:

```bash
npx vercel --prod
```

4. Add the production callback URL to the WHOOP app:

```text
https://your-vercel-domain.vercel.app/api/auth/whoop/callback
```

If `WHOOP_REDIRECT_URI` is not set in Vercel, the app derives the callback URL from the request host. That is usually the easiest setup for deployments.

## Useful Routes

- `/api/auth/whoop` starts the WHOOP OAuth flow.
- `/api/auth/refresh` refreshes and rotates the WHOOP token session.
- `/api/auth/logout` clears only the local encrypted cookie.
- `/api/auth/disconnect` revokes WHOOP access and clears the local session.
- `/api/whoop/export?range=30` returns the same dashboard data as JSON for the current browser session.
- `/api/dj/recommendation` returns the current Agentic DJ recommendation for a connected session.

## Verification

```bash
npm run lint
npm run build
```
