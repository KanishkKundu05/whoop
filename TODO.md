# TODO

Roadmap for remaining work and future integrations. Unchecked items are planned,
not supported features. WHOOP is the current user-facing integration; Garmin
has account-linking infrastructure, and Apple Watch has a capability skeleton.

## Garmin

- [ ] Complete end-to-end account-linking validation with a configured Garmin developer app.
- [ ] Implement ingestion and storage for available sleep, heart rate, HRV, and workout data, based on granted permissions.
- [ ] Add historical sync, incremental updates, retries, and sync status.
- [ ] Populate dashboard charts and sleep reports with Garmin data.
- [ ] Support Garmin in morning texts and music pacing where the required metrics are available.
- [ ] Enable Garmin onboarding once the full data flow is verified; replace the coming-soon state.

## Apple Watch / Apple Health

- [ ] Build an iOS companion app to request HealthKit access and connect to the user's account.
- [ ] Add authenticated upload endpoints and storage for summarized HealthKit samples.
- [ ] Sync sleep, heart rate, HRV, resting heart rate, respiratory rate, wrist temperature, and workouts where available.
- [ ] Handle background sync, offline uploads, duplicate samples, and revoked permissions.
- [ ] Add Apple Health data to dashboard charts and morning sleep reports.
- [ ] Explore sleep latency and in-bed timing widgets when suitable samples are available.
- [ ] Add watchOS support, complications, and native widgets after the sync foundation is working.
- [ ] Replace the coming-soon state with companion-app setup and connection status.

## Shared wearable support

- [ ] Define shared metric and sleep-report models while preserving provider-specific fields, units, and source labels.
- [ ] Let users choose a primary data source and avoid double-counting overlapping sleep or workouts.
- [ ] Show last-sync time, missing metrics, and reconnect actions for each provider.
- [ ] Extend disconnect and data-deletion flows to every integration.
- [ ] Evaluate Oura, Fitbit / Google Pixel Watch, and Android Health Connect as later integrations; confirm API access and supported metrics before committing.

## WHOOP and morning-text reliability

Track and resolve the findings in the [existing delivery review](docs/whoop-linq-personal-setup.md#6-logic-review-fixes-before-unattended-use):

- [ ] Unify browser and background token storage and serialize token refreshes.
- [ ] Add durable webhook processing, bounded retries, and pending-score retries.
- [ ] Apply a shared freshness and subscription-activation cutoff to webhook and cron sends.
- [ ] Add an atomic per-sleep send ledger and webhook replay protection.
- [ ] Restrict Convex operations and personal data reads to authorized callers.
- [ ] Persist Linq message IDs and distinguish accepted messages from confirmed delivery.
- [ ] Expand sleep reports with available performance, efficiency, deep sleep, REM, and awake-time measurements.
- [ ] Enable reconciliation scheduling after reliability fixes and controlled delivery validation.
- [ ] Verify one-time delivery, expired-token recovery, recipient changes, and disabling messages end to end.

## Product follow-ups

- [ ] Turn the proposed sleep widget specs into working widgets with clear data requirements.
- [ ] Expand the DJ track catalog and validate recommendations against the age and source of the heart-rate signal.
- [ ] Add integration coverage for new providers, missing data, revoked access, and sync failures.
- [ ] Keep setup documentation and supported-device labels aligned with shipped functionality.
