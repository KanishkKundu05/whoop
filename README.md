# WHOOP Dashboard

A private Next.js dashboard for WHOOP API data. It implements WHOOP OAuth, stores tokens in an encrypted HTTP-only cookie, refreshes access tokens server-side, and displays recent profile, body, recovery, cycle, sleep, and workout data.

## Setup

1. Create a WHOOP app in the developer dashboard.
2. Add this redirect URI to the app:

```text
http://localhost:3000/api/auth/whoop/callback
```

3. Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Generate a session secret with:

```bash
openssl rand -base64 32
```

The app requests these scopes:

```text
offline read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout
```

## Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Routes

- `/api/auth/whoop` starts the WHOOP OAuth flow.
- `/api/auth/refresh` refreshes and rotates the WHOOP token session.
- `/api/auth/logout` clears only the local encrypted cookie.
- `/api/auth/disconnect` revokes WHOOP access and clears the local session.
- `/api/whoop/export?range=30` returns the same dashboard data as JSON for the current browser session.

## Verification

```bash
npm run lint
npm run build
```

