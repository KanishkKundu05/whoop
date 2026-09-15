# Public WHOOP onboarding

Visitors use `/whoop` → `/setup/connection` → WHOOP consent. After consent,
Pace automatically reads the authenticated account's profile and latest five
sleep records. The connected email is displayed so visitors can spot a different
account from the one used on their phone. Empty history and provider failures
have separate retry/switch-account messages. No developer setup or manual
webhook test is required for a visitor.

## Operator deployment

Use one stable HTTPS production domain. Register
`https://YOUR-DOMAIN/api/auth/whoop/callback` in your WHOOP developer app and set
that exact value as `WHOOP_REDIRECT_URI` in Vercel. Keep `WHOOP_CLIENT_ID`,
`WHOOP_CLIENT_SECRET`, and `WHOOP_SESSION_SECRET` configured server-side.

New settings:

- `WHOOP_SERVER_SECRET`: generate a random secret of at least 32 characters
  (for example, `openssl rand -hex 32`). Set the identical value in Vercel and
  production Convex. All `whoop` Convex queries and mutations now require it;
  deploying only one side will interrupt stored-data and messaging operations.
  Never prefix this secret with `NEXT_PUBLIC_`.
- `WHOOP_ADMIN_USER_ID`: your real phone account's numeric WHOOP user ID in
  Vercel. Only that authenticated account can visit `/admin/whoop` or call the
  setup/diagnostics APIs. Unset means access is disabled. You can find your ID
  in `profile.data.user_id` from `/api/whoop/export` while connected.
- `NEXT_PUBLIC_CONVEX_URL`: use the production Convex deployment. Deploy the
  updated Convex functions and Vercel code together.

The diagnostic listener at `/api/whoop/setup/webhook` remains available to
signed WHOOP events; it does not send messages. Owner tests also require the
existing matching `WHOOP_SETUP_SECRET` in Next.js and Convex.

For actual automatic morning texts, configure the WHOOP v2 webhook once as
`https://YOUR-DOMAIN/api/whoop/webhook`. The handler selects the subscription by
the signed event's WHOOP user ID. Configure the existing Linq and
`DAILY_MESSAGE_SECRET` settings once for the deployment. Each visitor separately
opts in and supplies a recipient with permission. Vercel protection must allow
WHOOP's server to reach the webhook.

WHOOP currently permits development apps up to 10 members. Broad availability
requires app approval: https://developer.whoop.com/docs/developing/app-approval/
Fill in the actual app name, operator contact email, and production privacy URL
in WHOOP, then submit the approval request. Code changes cannot remove this
provider limit.

## Access and account controls

The public connection summary reads directly from the visitor's encrypted
session token and does not publish or persist those reads. Existing dashboard
sync and messaging use server-authenticated Convex calls. Caller-supplied user
IDs never authorize browser requests. No Convex function permits anonymous
reading or modifying another user's records.

The legacy `/public` dashboard still requires an explicitly configured
`WHOOP_PUBLIC_USER_ID`. Leave it unset for a private deployment. There is no
fallback to the latest synced account.

Disconnect disables the account's automatic messaging subscription before
revoking WHOOP access. Deletion removes its stored records, messaging tokens,
recipient, and diagnostic receipts, then attempts revocation and clears the
browser session. If revocation fails, the UI asks the visitor to remove the
connected app in WHOOP. Deletion does not erase original WHOOP records, already
delivered messages, or hosting/provider backups and logs. An already-running
message delivery may finish; deletion does not recall a message.

## Verification

`node --test tests/*.test.cjs`, `npx tsc --noEmit`, and `npm run build`.
Test production with two separate WHOOP accounts/browser profiles: each should
see its own email and sleep; a non-owner should get 404 at `/admin/whoop`; opting
one account out of messaging must not change the other. Real OAuth, webhook
receipt, and app approval require the configured production services.
