# WHOOP iMessage Share Card Demo

## Demo Moment

A friend texts:

```text
how u feeling?
```

The user replies from Messages with a WHOOP share card:

```text
I'm feeling ready: 82% recovery, 7h 34m sleep, woke up at 7:12 AM.
```

The visual card shows:

- Recovery score and recovery color state.
- Sleep duration from the latest scored main sleep.
- Wake-up time from the sleep end timestamp.
- Sleep performance percentage.
- Optional HRV and resting heart rate in the expanded detail view.

## Product Scope

The goal is a lightweight Messages extension that turns private WHOOP data into a controlled, friend-safe status card. It is not a social feed and it should not expose raw health records.

Primary use cases:

- Reply to "how are you feeling?" with sleep and recovery context.
- Share an excuse or readiness signal before a workout.
- Send a bedtime accountability card to a friend.
- Send a morning recap without sharing screenshots from the WHOOP app.

## Data Used

The existing dashboard already fetches the required WHOOP records:

- Sleep start: `sleep.start`
- Wake time: `sleep.end`
- Time in bed: `sleep.score.stage_summary.total_in_bed_time_milli`
- Actual sleep: light + REM + slow-wave sleep
- Sleep performance: `sleep.score.sleep_performance_percentage`
- Sleep consistency: `sleep.score.sleep_consistency_percentage`
- Recovery: `recovery.score.recovery_score`
- HRV: `recovery.score.hrv_rmssd_milli`
- Resting heart rate: `recovery.score.resting_heart_rate`

WHOOP does not expose a direct "time to fall asleep" field in the public sleep schema. The share card should avoid claiming sleep latency unless a native HealthKit bridge is added later.

## Technical Implementation

### How To Try It On Vercel

Use this route for a clean first-time demo:

```text
https://whoop-delta-sable.vercel.app/imessage
```

Expected flow:

1. Open `/imessage`.
2. Click **Connect WHOOP**.
3. Approve the WHOOP OAuth scopes.
4. WHOOP redirects back to `/imessage`.
5. The page renders the "how u feeling?" conversation and the WHOOP share card.

The dashboard uses a safe `next` path during OAuth:

```text
/api/auth/whoop?next=/imessage
```

The auth callback stores the encrypted WHOOP session in an HTTP-only cookie and returns the user to `/imessage`. If the user later opens `/imessage` with an expiring session, the page sends them through `/api/auth/refresh?next=/imessage`.

### How To Use It In The Real Messages App

Native Xcode project:

```text
ios/WhoopShare/WhoopShare.xcodeproj
```

Install flow for your iPhone:

1. Open `ios/WhoopShare/WhoopShare.xcodeproj` in Xcode.
2. Select the `WhoopShare` app target.
3. Set your Apple developer team for both targets:
   - `WhoopShare`
   - `WhoopShareMessagesExtension`
4. Enable the same App Group for both targets:

```text
group.com.kanishkkundu.whoopshare
```

5. Plug in your iPhone and run the `WhoopShare` scheme on the device.
6. On the phone, open the Vercel `/imessage` page in Safari.
7. Connect WHOOP and wait for the share card to render.
8. Tap **Open in app**. This opens the installed native app through:

```text
whoopshare://import?payload=...
```

9. The native app stores the latest share-card payload in the App Group container.
10. Open Messages, choose a conversation, open the Messages app drawer, select **Whoop Share**, and tap **Send WHOOP card**.

The Messages extension sends an actual `MSMessage` using `MSMessageTemplateLayout`. It reads from the shared App Group rather than calling WHOOP directly from the extension.

Implementation files:

- `ios/WhoopShare/project.yml`
- `ios/WhoopShare/WhoopShare.xcodeproj`
- `ios/WhoopShare/Sources/WhoopShareApp/WhoopShareApp.swift`
- `ios/WhoopShare/Sources/WhoopShareApp/ContentView.swift`
- `ios/WhoopShare/Sources/MessagesExtension/MessagesViewController.swift`
- `ios/WhoopShare/Sources/Shared/ShareCardPayload.swift`
- `ios/WhoopShare/Sources/Shared/ShareCardStore.swift`

Why this flow exists:

- The WHOOP client secret stays on the Vercel server.
- The user authenticates with WHOOP through the existing web OAuth flow.
- The native app receives only the privacy-safe share-card payload.
- The Messages extension has fast local access to the latest card and does not need to run OAuth inside Messages.

### Authentication Requirements

Before anyone can try the Vercel demo, the deployment needs:

- `WHOOP_CLIENT_ID`
- `WHOOP_CLIENT_SECRET`
- `WHOOP_SESSION_SECRET`

The WHOOP developer app must allow this redirect URI:

```text
https://whoop-delta-sable.vercel.app/api/auth/whoop/callback
```

The OAuth scopes requested by the app are:

```text
offline read:profile read:body_measurement read:recovery read:cycles read:sleep read:workout
```

The share card is usable only after the visitor authenticates their own WHOOP account and has scored sleep and recovery records available through the API. Friends who receive the final iMessage card do not need to authenticate unless they tap into a future private detail page.

### Web Dashboard Demo

Implemented in this repo as a server-rendered dashboard section:

- Component: `src/components/whoop-share-card-demo.tsx`
- Data source: latest scored `Sleep` and `Recovery` records already fetched for the dashboard.
- Dashboard insertion: `src/app/page.tsx`
- Dedicated first-time route: `src/app/imessage/page.tsx`
- Rendering: static iMessage-style conversation with one incoming text bubble, one outgoing summary bubble, and one WHOOP share card.

This is enough for a product demo because the card uses real connected WHOOP data when the dashboard session has sleep and recovery records.

### Native iMessage Extension

For a real Messages app, create an iOS app target with an iMessage extension:

- `MessagesViewController`: subclass `MSMessagesAppViewController`.
- `MSConversation`: read the active conversation and insert an `MSMessage`.
- `MSMessageTemplateLayout`: configure card title, subtitle, image, and caption.
- `MSMessage.url`: include a private deep link such as `whoopshare://card/{token}`.
- App Group: share the latest prepared card payload between the host iOS app and extension.

The iMessage extension should not make expensive network calls inside the message compose path. The host app should prefetch the latest share-card payload after WHOOP sync and save it into the App Group container. The extension can fall back to a quick backend refresh if the cached card is stale.

### Backend Contract

Implemented route:

```text
GET /api/whoop/share-card
```

Response shape:

```json
{
  "generatedAt": "2026-08-26T08:00:00.000Z",
  "summary": "I'm feeling ready: 82% recovery, 7h 34m sleep, woke up at 7:12 AM.",
  "card": {
    "recoveryScore": 82,
    "sleepDurationMilli": 27240000,
    "wakeTime": "7:12 AM",
    "sleepPerformancePercentage": 91,
    "hrvRmssdMilli": 68.4,
    "restingHeartRate": 49
  },
  "privacy": {
    "expiresAt": "2026-08-27T08:00:00.000Z",
    "includesRawRecords": false
  }
}
```

Implementation files:

- `src/lib/whoop/share-card.ts`
- `src/app/api/whoop/share-card/route.ts`
- `src/app/api/auth/whoop/route.ts`
- `src/app/api/auth/whoop/callback/route.ts`

### Privacy Rules

- Default to one latest sleep/recovery summary.
- Never include email, user ID, OAuth tokens, or raw JSON records.
- Let users hide exact wake time.
- Let users hide HRV and resting heart rate.
- Expire backend-hosted share links after 24 hours.
- Require explicit user action before inserting the message into a conversation.

## MVP Build Plan

1. Ship the web dashboard demo card.
2. Add card image rendering for rich previews.
3. Build a small iOS host app that authenticates or pairs with the web session.
4. Add an iMessage extension that reads the cached card from App Groups.
5. Submit through App Store Connect as an iOS app with an iMessage extension.

## Demo Script

1. Open the dashboard with a connected WHOOP account.
2. Scroll to "Messages share card demo."
3. Show the incoming friend message: `how u feeling?`
4. Show the generated reply text and WHOOP card.
5. Explain that the production version would insert this as an `MSMessage` from the Messages app drawer.
