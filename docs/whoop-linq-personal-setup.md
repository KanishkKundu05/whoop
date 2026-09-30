# Morning texts: WHOOP → Linq

Open `/morning` to see the actual message format with sample sleep data, enter an
international recipient number, and review before enabling. `/setup` and
`/daily-message` redirect here. The preview, form, and app-owner configuration are
available before sign-in and when the status service is unavailable. Saving still
requires an authenticated WHOOP account, offline access, and configured storage.
The recipient does not need a WHOOP account.

## Server configuration

Start with `.env.example`. Set these in `.env.local` for development or your
hosting environment for production:

```dotenv
WHOOP_CLIENT_ID=<WHOOP developer app ID>
WHOOP_CLIENT_SECRET=<WHOOP developer app secret>
WHOOP_REDIRECT_URI=https://YOUR-HOST/api/auth/whoop/callback
WHOOP_SESSION_SECRET=<random secret of at least 32 characters>
NEXT_PUBLIC_CONVEX_URL=<your Convex deployment URL>
WHOOP_SERVER_SECRET=<separate random secret of at least 32 characters>
DAILY_MESSAGE_SECRET=<separate random secret of at least 32 characters>
DAILY_MESSAGE_GREETING="Good morning Mom"
LINQ_TRANSPORT=api
LINQ_API_KEY=<Linq bearer token>
# Optional: iMessage, RCS, or SMS
LINQ_PREFERRED_SERVICE=
# Required by the scheduled fallback, not the sleep webhook
CRON_SECRET=<random secret of at least 16 characters>
```

Generate each random secret with `openssl rand -base64 32`. Preserve existing
encryption secrets; replacing them makes saved credentials unreadable. Set the
same `WHOOP_SERVER_SECRET` in the app and the selected Convex deployment. Deploy
functions with `npx convex deploy` (production) or `npm run convex:dev` (development),
and restart/redeploy Next.js after changing its environment.

Register the exact `WHOOP_REDIRECT_URI` in your WHOOP developer app. Connect through
`/morning`; the app requests `read:sleep`, `read:profile`, and `offline` among its
scopes. Reconnect if the status says offline access is missing.

## Sleep webhook

Register `https://YOUR-HOST/api/whoop/webhook` with model **v2**. WHOOP sends all
supported event types; this handler only processes `sleep.updated`. Signature
verification uses the WHOOP client secret by default, so leave
`WHOOP_WEBHOOK_SECRET` unset. See [WHOOP webhook configuration and signing](https://developer.whoop.com/docs/developing/webhooks/).

For a local server, expose its port through a public HTTPS tunnel and register
`https://YOUR-TUNNEL/api/whoop/webhook`. Keep it running along with Next.js. Hosting
protection must allow WHOOP to POST to the endpoint. The separate
`/api/whoop/setup/webhook` endpoint records diagnostics; it does not send texts.

## Linq API or CLI

Production uses `LINQ_TRANSPORT=api` and `LINQ_API_KEY`, with a provisioned sending
line. The adapter calls Linq's auto-selected sender endpoint; no
`LINQ_FROM_NUMBER` setting is needed. API acceptance is not handset delivery.
See [Linq send-message reference](https://docs.linqapp.com/channel/imessage/api/resources/messages/methods/create/).

For local development, use the existing CLI adapter instead:

```sh
npm install -g @linqapp/cli@latest
linq login # or linq signup for a new account
linq whoami
linq phonenumbers
linq profile set fromPhone +YOUR_LINQ_NUMBER
```

```dotenv
LINQ_TRANSPORT=cli
# Optional: absolute executable path from `which linq`
LINQ_CLI_PATH=
```

Run `npm run dev`. CLI mode requires Node 22+, CLI 2.6.0+, and development mode;
it cannot run in a production build. A configured `LINQ_API_KEY` overrides CLI
profile credentials. Shared-line recipients must send the first message.
See [the official CLI](https://github.com/linq-team/linq-cli) and
[local CLI setup](linq-cli-development.md) for profile overrides and manual checks.

## Enable and verify

1. Open `/morning`, connect WHOOP, and review the sample template.
2. Enter a consenting recipient's full number, including `+` and country code.
3. Review and enable. This stores the recipient and WHOOP tokens encrypted in
   Convex; it does not send a test message.
4. After a processed main-sleep update, check the status on `/morning` and confirm
   receipt on the recipient's phone. Naps and unscored sleep are skipped.
5. Use **Change recipient** or **Turn off morning texts** to manage delivery.

The configured greeting and the sleep's timezone are used by both preview and
sender. The sample message is:

> Good morning Mom - I woke up at 7:12 AM, slept 7h 34m, and went to sleep at 11:14 PM last night.

## Fallback and current limits

`vercel.json` schedules `/api/messages/daily/cron` at **04:30 UTC daily**. The route
requires `Authorization: Bearer <CRON_SECRET>`. Configure the secret before relying
on this fallback. It selects the latest scored main sleep within a seven-day
fetch window, so it can send older sleep; it is not a fixed wake-time scheduler.

The sender stores the last sent sleep ID and the API transport supplies a
per-user/per-sleep idempotency key. There is no durable send ledger or queue, and
CLI sends have no provider idempotency. Concurrent events, old sleep edits, or
uncertain sends can duplicate delivery. The webhook currently returns 200 for
handled send failures, so check saved error status and the fallback; it does not
request WHOOP retries for those failures. Browser and background token refreshes
can also race. Check chat history before retrying an uncertain CLI send.

Configuration readiness checks presence and format, not token validity, webhook
reachability, or delivery. `WHOOP_SETUP_SECRET` is only for the owner diagnostic
wizard and is not required by the morning-text flow.
