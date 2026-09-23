# Local messaging with Linq CLI

This checkout already sends with Linq REST; it contains no Twilio or sandbox
implementation. The optional CLI transport exercises the same sleep-report flow
locally. Existing REST delivery remains the default; no Twilio code is removed.

## Setup

Use Node 22+ and CLI 2.6.0+:

```sh
npm install -g @linqapp/cli@latest
which linq
linq --version
linq signup
# Existing account: use linq login instead.
linq whoami
```

Keep the API key in a password manager. The CLI also stores it locally; do not
commit the CLI config or paste secrets into source code. If using nvm, either
configure your preferred default Node version or use the absolute CLI path below.

Set these in `.env.local`, then run `npm run dev`:

```dotenv
LINQ_TRANSPORT=cli
LINQ_CLI_PATH=/absolute/path/from/which/linq
```

CLI mode uses the logged-in CLI profile and its default sending line. Use
`linq phonenumbers set` if necessary. `LINQ_PROFILE` selects a profile;
`LINQ_FROM_PHONE` overrides the sender. If `LINQ_API_KEY` is set, the adapter passes
it as `LINQ_TOKEN`, overriding the profile token. Remove an old placeholder key
before using profile authentication. The key is never passed as a command argument.

The existing WHOOP, Convex, `WHOOP_SERVER_SECRET`, and `DAILY_MESSAGE_SECRET`
configuration is still required for the app's report flow. The setup page only
checks configuration presence; it does not certify CLI authentication or delivery.

## First contact and delivery

Use your own phone for the first test. Replace placeholders before running:

```sh
linq contacts add <your-phone-with-country-code>
linq webhooks listen
```

On a Shared Line, text the Linq Number from your phone first. The contact-add
output includes a share link/QR shortcut. Wait for `message.received`, then stop
the listener with Ctrl+C. Send a conversational test:

```sh
linq chats create --to <your-phone-with-country-code> --message "Hello! How are you feeling today?" --json
```

Confirm receipt on the phone. The response includes `chat.id` and
`chat.message.id`; API acceptance is not proof of handset delivery. The app's
existing WHOOP sleep trigger now uses the CLI when `LINQ_TRANSPORT=cli`.

Shared Lines allow up to 20 contacts and require each contact to text first.
Linq's supplied quickstart recommends two-way conversations; this app's current
one-way sleep reports do not yet implement an inbound responder. Use this setup
for development testing, and design the reply handling before unattended use.

## Limits and production

- CLI mode is limited to `NODE_ENV=development` and needs a local Node process.
- CLI 2.6.0 has no idempotency or preferred-service flag for `chats create`.
  `LINQ_PREFERRED_SERVICE` applies only to REST mode. The CLI/provider selects
  the messaging service; this adapter does not independently retry via SMS.
- CLI sends are real messages. Concurrent sleep events or reconciliation retries
  can duplicate a message. A timeout or malformed response may happen after
  acceptance: inspect chat history before retrying. The adapter never retries or
  falls back to another provider automatically.
- For Vercel or production, leave `LINQ_TRANSPORT=api` (or unset) and configure
  `LINQ_API_KEY`. No CLI installation is needed there.
- `linq webhooks listen` shows messaging events, not WHOOP sleep events. Forward
  to a Linq-specific handler only after implementing one; do not forward Linq
  events into `/api/whoop/webhook`.

Run `linq <command> --help` for flags. See the [API docs](https://apidocs.linqapp.com)
and [example apps](https://linqapp.com/s/example-apps) for further integration.
