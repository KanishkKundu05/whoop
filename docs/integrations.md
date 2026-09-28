# Integration reference

For first-time setup, start with [Local setup](local-setup.md) or
[Deployment](deployment.md). The public flow supports WHOOP. Legacy Garmin linking,
Apple Watch bridge specifications, and the older SoundCloud DJ are experimental
and live under the dashboard’s Labs section.

## Spotify live BPM DJ

The `/whoop/music` experience offers Spotify, Apple Music, and SoundCloud cards. Spotify is implemented;
Apple Music and SoundCloud are marked coming soon. Spotify imports all liked songs
and selected playlists, resolves BPM with
ReccoBeats, and selects the next track using live WHOOP Bluetooth heart rate about
**15 seconds before each song finishes**. It queues the match and lets Spotify
finish the current song naturally. The dashboard's older SoundCloud DJ remains
available separately.

### Setup

1. Register a Spotify developer application and add the exact callback URL below.
2. Set these server environment variables (also shown in `.env.example`):

   ```dotenv
   SPOTIFY_CLIENT_ID=your-client-id
   SPOTIFY_CLIENT_SECRET=your-client-secret
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
   SPOTIFY_SESSION_SECRET=a-separate-random-secret-of-at-least-32-characters
   ```

   Use your HTTPS domain for production. Use the same origin in your browser as
   the configured callback. Spotify does not accept `localhost` as a redirect host;
   use the loopback IP for development. Restart the application after configuring.
   If WHOOP was previously connected on `localhost`, configure its callback on
   the same `127.0.0.1` origin and reconnect there so its session cookie is available.
3. Connect WHOOP, visit `/whoop/music`, then connect Spotify. Spotify Premium and
   access to your development-mode app are required. Requested scopes are
   `user-library-read`, `playlist-read-private`, `playlist-read-collaborative`,
   `user-read-playback-state`, and
   `user-modify-playback-state`. Tokens are encrypted in an HTTP-only cookie.
4. Click the Spotify card to authorize, then choose All Liked Songs and/or playlists
   and click **Import selected music**. Existing connections must reconnect to grant
   the new playlist scopes. Spotify currently permits playlist item access only for
   playlists the user owns or collaborates on; other playlists are disabled.
   Imports paginate through every selected source, deduplicate by Spotify track ID,
   and save metadata before BPM enrichment. Each successful sync replaces the prior
   library selection. ReccoBeats requires no API key; completed lookups are checkpointed
   and can resume after failure. Songs without BPM remain imported but are excluded
   from DJ matching. Imports are browser-local and expire after seven days.

   Production callback: `https://whoop-delta-sable.vercel.app/api/spotify/callback`.
   Register that exact URL in Spotify and set `SPOTIFY_REDIRECT_URI` to match.
5. Enable WHOOP **Heart Rate Broadcast**, then use **Connect WHOOP Bluetooth** in a
   supported Chrome/Edge browser. Safari/iPhone browsers need a native bridge,
   which is not included. Bluetooth must be available on the listening device.
6. Open Spotify on the desired device, clear its queue, and disable shuffle,
   repeat, autoplay, and crossfade. Start one song there or use the first-song
   selector. Start the live DJ and keep its tab visible.

### Runtime and data behavior

- The decision uses the preceding five seconds of fresh heart-rate samples and
  minimizes the absolute difference between heart rate and song BPM. Current and
  recent songs are excluded where the library permits. No half/double-time or
  energy weighting is applied.
- A browser lock prevents two tabs from controlling the DJ simultaneously. The
  controller stops on hidden tabs, device changes, sensor disconnects, stale
  heart rate at decision time, and queue conflicts. It resumes only when started
  again. Pausing Spotify suspends selection until playback resumes.
- Queue commands are verified and never automatically retried after an uncertain
  result. Spotify cannot reliably replace an arbitrary pre-existing queue with
  this API. The app reports conflicts instead of silently appending tracks.
- Stop DJ stops future selection; a song already submitted to Spotify remains
  queued. Pause Spotify also pauses playback. A request already received by
  Spotify may finish even if the local session is stopped.
- Compact track/BPM records are cached per Spotify account in this browser for
  seven days. Heart-rate samples remain in memory. Disconnect Spotify removes
  that account's local cache and cookie. Disconnecting here does not revoke the
  grant in Spotify; revoke it from Spotify account settings if needed.
- Successful full imports reconcile unliked tracks. Partial failures preserve
  previous membership and successful lookup checkpoints. Browser storage limits
  and missing provider coverage are surfaced as errors, not fabricated BPMs.
- GetSongBPM and Soundcharts are researched alternatives, not enabled adapters.
  Retention and provider permissions should be reviewed for wider distribution.

Run `node --test tests/spotify-dj.test.cjs` for isolated matching, Bluetooth parsing,
cache, OAuth, and playback-route tests. Hardware pairing and real Spotify queue
transitions require an authorized Premium account and a nearby WHOOP device.
See [the implementation plan](spotify-whoop-bpm-dj-plan.md) for research and
remaining platform constraints.
