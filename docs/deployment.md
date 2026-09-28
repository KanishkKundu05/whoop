# Deploy and operate Pace

Visitors connect to your configured application. They do not create developer
apps, enter secrets, or register webhooks themselves.

## Basic WHOOP dashboard

1. Link the Vercel project with `npx vercel link`.
2. Configure Production `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, and a random
   `WHOOP_SESSION_SECRET` of at least 32 characters.
3. Pick one stable HTTPS domain. Register
   `https://YOUR-DOMAIN/api/auth/whoop/callback` in the WHOOP developer app and set
   `WHOOP_REDIRECT_URI` to that same URL. Never use the local callback in production.
4. Deploy with `npx vercel --prod`.
5. Open the app in a fresh browser session. Try the demo, connect WHOOP, and verify
   the correct account and real data appear in Overview and Account.

Without Convex, live WHOOP data still renders and persistence is skipped. Other
integration credentials are optional. Provider developer-mode access restrictions
can still prevent new accounts from authorizing; check the WHOOP developer portal
and [app approval guidance](https://developer.whoop.com/docs/developing/app-approval/)
before inviting a larger audience.

## Stored history and morning texts

Configure these values on the server:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Production Convex deployment URL |
| `WHOOP_SERVER_SECRET` | Random 32+ character secret; **same value in Vercel and Convex** |
| `DAILY_MESSAGE_SECRET` | 32+ character encryption secret for messaging credentials and recipient |
| `LINQ_API_KEY` | Linq API credentials; configure a sending line in Linq too |
| `DAILY_MESSAGE_GREETING` | Optional greeting; used in both live preview and sent reports |
| `LINQ_PREFERRED_SERVICE` | Optional delivery service preference |

Deploy Convex functions with `npx convex deploy` and deploy the corresponding
Next.js code together. Preserve existing encryption secrets when redeploying.

Register `https://YOUR-DOMAIN/api/whoop/webhook` as the WHOOP **v2** webhook.
Ensure hosting protection allows WHOOP to reach it. Leave `WHOOP_WEBHOOK_SECRET`
unset unless deliberately overriding configuration; the handler defaults to the
WHOOP client secret for signature validation.

Each visitor separately chooses a recipient, acknowledges their consent, and
explicitly enables messages. Configuration checks do not prove provider credentials,
webhook registration, or handset delivery. Test the full path with an explicitly
chosen recipient before relying on it. See the
[personal setup guide](whoop-linq-personal-setup.md) for known sender limitations.

The reconciliation endpoint is `/api/messages/daily/cron` and requires
`Authorization: Bearer $CRON_SECRET`. The checked-in `vercel.json` schedules it daily at 04:30 UTC. Set `CRON_SECRET`
in Vercel before relying on this fallback.

## Optional Spotify setup

Set `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_SESSION_SECRET` (32+
characters), and `SPOTIFY_REDIRECT_URI=https://YOUR-DOMAIN/api/spotify/callback`.
Register that exact callback with Spotify. Test using an authorized Premium
account, a supported Bluetooth browser, and a nearby WHOOP. See
[Integration reference](integrations.md) for import and playback behavior.

## Owner diagnostics and public sharing

- Set `WHOOP_ADMIN_USER_ID` to your numeric WHOOP user ID to enable `/admin/whoop`
  for that account. Find it in `profile.data.user_id` from `/api/whoop/export`.
- Set matching 32+ character `WHOOP_SETUP_SECRET` values in Next.js and Convex for
  diagnostic test storage. See [Owner diagnostics](whoop-connection-dashboard.md).
- `/public` only displays the explicitly configured `WHOOP_PUBLIC_USER_ID` from
  stored Convex data. There is **no fallback to the latest synced account**. Leave
  it unset to keep public sharing disabled. Ordinary visitors should use Overview.

## Release checks

Run the README verification commands. Check desktop and mobile layouts, a fresh
anonymous session, OAuth success/cancellation, missing sleep, expiry/reconnect,
and two separate accounts. Verify one account's morning-text changes do not affect
the other. Test real Bluetooth, Spotify queue transitions, and message receipt
with authorized accounts and hardware.
