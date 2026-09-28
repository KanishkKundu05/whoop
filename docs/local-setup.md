# Local setup

## Demo first

Use Node.js 20.9 or newer, then run `npm ci` and `npm run dev`.
Visit `http://localhost:3000/demo`. No service credentials are needed for sample
metrics, the simulated music match, or the message preview.

## Connect WHOOP

1. Create a WHOOP developer application in the
   [developer dashboard](https://developer-dashboard.whoop.com).
2. Register `http://localhost:3000/api/auth/whoop/callback` as a redirect URI.
3. Copy the template: `cp .env.example .env.local`.
4. Fill in only these values to start:

   ```dotenv
   WHOOP_CLIENT_ID=your-client-id
   WHOOP_CLIENT_SECRET=your-client-secret
   WHOOP_REDIRECT_URI=http://localhost:3000/api/auth/whoop/callback
   WHOOP_SESSION_SECRET=your-random-secret-at-least-32-characters
   ```

   Generate a secret with `openssl rand -base64 32`.
5. Restart `npm run dev`, open the local app, and choose **Connect WHOOP**.
6. After consent, Overview shows your own recent metrics. Use **Account** to
   check the connected email, switch accounts, disconnect, or delete stored data.

If Next.js chooses another port, register that exact callback and update
`WHOOP_REDIRECT_URI`. OAuth requires the same protocol, host, port, and path.

## Optional features

| Feature | Additional configuration |
| --- | --- |
| Stored history | `NEXT_PUBLIC_CONVEX_URL`, matching `WHOOP_SERVER_SECRET` in Next.js and Convex; deployed Convex functions |
| Morning texts | Stored history plus `DAILY_MESSAGE_SECRET`, Linq sending line and `LINQ_API_KEY`, public HTTPS WHOOP delivery webhook |
| Spotify DJ | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_SESSION_SECRET`, `SPOTIFY_REDIRECT_URI` |
| Owner diagnostics | `WHOOP_ADMIN_USER_ID` and matching `WHOOP_SETUP_SECRET` in Next.js and Convex |

Run `npm run convex:dev` to provision/sync a development backend. Add the same
random `WHOOP_SERVER_SECRET` (32+ characters) to `.env.local` and the Convex
deployment's environment settings. Leave Convex unconfigured if you only want
live WHOOP reads.

For Spotify, use `http://127.0.0.1:3000/api/spotify/callback`. Use
`http://127.0.0.1:3000` in the browser and register/update the WHOOP callback to
`http://127.0.0.1:3000/api/auth/whoop/callback` too. Reconnect WHOOP on that origin;
cookies from `localhost` are not shared with `127.0.0.1`.

See [Deployment](deployment.md) for messaging configuration and
[Integration reference](integrations.md) for Spotify's playback prerequisites.
For local messaging, see [Linq CLI development](linq-cli-development.md).
