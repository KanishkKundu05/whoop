# Pace

Make your WHOOP a little more useful: see your sleep and recovery, match Spotify
music to your heart rate, and share an automatic morning sleep update.

## Try it

Open [Pace](https://whoop-delta-sable.vercel.app).

1. Choose **Try a demo** to explore sample metrics, a simulated music match, and
   a morning-text preview. No account or setup is required.
2. Choose **Connect WHOOP** when you want to use your own data. Sign in with the
   account you use in the WHOOP phone app and authorize access.
3. You land on **Overview**, with your recent metrics and links to **Music**,
   **Morning texts**, and **Account**.

A visitor does **not** need developer credentials, their own deployment, or a
webhook test. The app owner configures those services once.

| Experience | What you need | What to expect |
| --- | --- | --- |
| Demo | A browser | Clearly labeled sample data; no playback or messages |
| Overview | WHOOP account with synced data | Sleep, recovery, strain, trends, and refresh |
| Music | Spotify Premium, WHOOP Heart Rate Broadcast, compatible Bluetooth browser | Import songs, pair WHOOP, then start the DJ |
| Morning texts | Connected WHOOP; delivery configured by the app owner | Preview, choose a consenting recipient, explicitly enable reports |

Live music does not work in iPhone/Safari browsers with the current implementation.
Garmin and Apple Watch experiences are not part of the supported visitor flow.
Morning reports follow processed WHOOP sleep updates, not a fixed wake-up time.
Enabling texts does not send a test message.

## Run locally

For the demo, only Node.js 20.9+ and npm are needed:

```bash
npm ci
npm run dev
```

Open [the local demo](http://localhost:3000/demo). No `.env.local` is required.

To connect a real WHOOP account, follow [Local setup](docs/local-setup.md).
Garmin, Spotify, Convex, and Linq are optional for the basic WHOOP overview.

## Guides

- [Try the app and troubleshoot](docs/try-it.md)
- [Local development](docs/local-setup.md)
- [Deploy and configure optional features](docs/deployment.md)
- [Navigation and onboarding behavior](docs/onboarding.md)
- [Public onboarding and account controls](docs/public-whoop-onboarding.md)
- [Owner connection diagnostics](docs/whoop-connection-dashboard.md)
- [Integration reference](docs/integrations.md)
- [Personal messaging setup and known delivery limitations](docs/whoop-linq-personal-setup.md)
- [Local Linq CLI development](docs/linq-cli-development.md)

## Verify changes

```bash
npm run lint
npx tsc --noEmit
node --test tests/*.test.cjs
npm run build
```

Real OAuth, WHOOP Bluetooth, Spotify playback, and handset delivery also need
checks with configured services and authorized accounts.
