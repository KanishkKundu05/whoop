# Connection dashboard

Open `/setup` (or click **Connection setup** on the main dashboard).

1. Set the existing `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, and
   `WHOOP_SESSION_SECRET` environment variables. The page shows any missing values
   and the exact OAuth callback URL to register in WHOOP.
2. Click **Connect WHOOP** and authorize your own account. You return to `/setup`.
3. Click **Run API test**. This makes two read-only WHOOP v2 calls: profile and up
   to five recent sleeps. An empty sleep list leaves sleep data unverified and
   shows account and request diagnostics; a malformed response or API error
   fails the request. Tokens are never returned to the UI.
4. Configure `NEXT_PUBLIC_CONVEX_URL` and generate `WHOOP_SETUP_SECRET` with
   `openssl rand -hex 32`. Set the same secret in Next.js and the corresponding
   Convex deployment's Settings → Environment Variables. Every new test-storage
   operation authenticates with it. It is never sent to the browser.
5. Deploy the new Convex table and functions: `npm run convex:dev` for development,
   or `npx convex deploy` for production. Restart Next.js after local env changes.
6. In WHOOP developer settings, register the dashboard's **test webhook URL**,
   ending in `/api/whoop/setup/webhook`, using model **v2**. Replace the old
   daily-message webhook URL during testing if it is registered; that old route
   can still send messages for active subscriptions. The test endpoint never does.
7. Click **Start 15-minute test**. Edit a recent sleep's end time by one minute
   in the WHOOP app and save. The dashboard polls every four seconds and passes
   only after a real signed `sleep.updated` event for your account is stored.
   Restore the sleep time afterward. This is WHOOP's documented
   [webhook testing procedure](https://developer.whoop.com/docs/developing/webhooks/#webhooks-testing).

WHOOP requires public HTTPS for webhooks. For local testing, open `/setup` through
an HTTPS tunnel to the local server and register that origin's URLs. Use the
same browser origin throughout OAuth. Ensure `WHOOP_REDIRECT_URI` matches the
tunnel origin if explicitly set. Hosting login protection must not block WHOOP.

The listener validates the exact raw-body signature, requires a timestamp within
five minutes, and only records events signed after the test started. Invalid
requests cannot create passing receipts. Test windows last 15 minutes. Expired
or unstarted tests acknowledge valid events without recording them. Recovery or
workout events can show arrival but cannot pass the sleep check. Only the current
test per WHOOP user is retained, containing IDs and times rather than health data.

If the session expires, reconnect. This diagnostic flow deliberately does not
refresh competing browser/background token copies or configure subscriptions.
The existing refresh ownership issue still needs fixing before daily messaging.
If you already use the daily sender, turn it off before this diagnostic flow.

Linq credentials, a recipient, and `CRON_SECRET` are not needed for these checks.
The production setup deployment has an empty `crons` list in `vercel.json`.
Existing messaging routes still exist; enable scheduling separately when ready.
API-test results are displayed for the current page visit; webhook
receipts survive reloads in Convex.

Validation:

```bash
node --test tests/whoop-setup.test.cjs
npm run lint
npm run build
```

The automated tests use isolated provider/storage mocks. A pass there does not
claim that your live WHOOP credentials, hosting URL, or real webhook delivery have
been validated. The dashboard's three checks establish that with your account.
