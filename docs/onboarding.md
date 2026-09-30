# Navigation and onboarding

The supported journey is **Landing → Demo or Connect WHOOP → Overview → Music /
Morning texts**. The shared navigation links Overview, Music, Morning texts, and
Account. Returning users can open their dashboard directly from the landing page.

| Route | Purpose |
| --- | --- |
| `/` | Product introduction, Connect WHOOP, Try a demo |
| `/demo` | Public synthetic metrics, simulated music match, sample message preview |
| `/dashboard` | Authenticated overview, trends, feature statuses, deeper health details |
| `/whoop` | Compatibility redirect to Overview; auth errors go to Account |
| `/whoop/music` | Spotify setup and live DJ |
| `/morning` | Public template and recipient form; authenticated activation and saved status |
| `/setup` | Compatibility redirect to `/morning`, preserving the step |
| `/setup/connection` | Visitor connection, latest sleep, account controls |
| `/admin/whoop` | Owner-only API and signed webhook diagnostic wizard |
| `/daily-message` | Compatibility redirect to `/morning` |

OAuth defaults to Overview. Account switches return there too. The dashboard
refresh link retains the selected date range. Anonymous dashboard visitors see the
connection page with a demo option. Expired sessions refresh where possible.

The demo uses synthetic values only. It never calls provider or messaging APIs,
reads a user's metrics, or writes subscriptions. The greeting and heart-rate slider
live only in component state. Demo text explicitly distinguishes previews from
real playback, delivery, and settings.

## Morning texts

Connection and server configuration are checked automatically. The visible flow is:

1. **Recipient:** show the production formatter with sample sleep values alongside
   the phone input; normalize an international number and acknowledge sharing consent.
2. **Enable:** review the number and explicitly save/activate the subscription.

Loading, failed status requests, and missing authentication do not hide the form,
template, or app-owner configuration. Incomplete delivery configuration does not
block the preview, but activation is
disabled with an explanation. Technical instructions stay under app-owner details.
Completion is read from the server, never trusted from `?step=complete`. The recipient
draft survives in-app Back/Continue but is not persisted to browser storage; reloading
a review URL returns to the recipient form. Old step URLs safely fall back to preview.

Enabled subscriptions distinguish “Waiting for first sleep update” from “Report
requested.” Neither claims handset receipt. Changing a recipient and turning off
messages remain available. Saving does not send a test message.

## Music

Show Premium and Bluetooth requirements before connecting/importing. A four-part
progress indicator tracks Spotify connection, two or more BPM-ready songs, sensor
readings, and the running DJ. Imported music can be collapsed once ready; pairing
and playback controls remain accessible. A disabled Start button has a nearby
explanation. Existing queue verification, visibility, and stale-sensor protections
remain in place.

## Verification

Run the commands in the README. Browser checks should cover demo interactions,
mobile overflow, navigation, anonymous gates, preview/recipient/review, invalid
phone numbers, failed saves, reload and browser Back, incomplete configuration,
and disabling a subscription. Use mocked provider responses for UI checks; real
OAuth, hardware playback, and message delivery need configured services.
