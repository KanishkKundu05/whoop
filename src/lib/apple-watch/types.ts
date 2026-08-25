export type AppleWatchCapabilityStatus = "planned" | "ready" | "needs-native-app";

export type AppleWatchCapability = {
  name: string;
  status: AppleWatchCapabilityStatus;
  source: string;
  detail: string;
};

export const APPLE_WATCH_CAPABILITIES: AppleWatchCapability[] = [
  {
    name: "HealthKit permission bridge",
    status: "needs-native-app",
    source: "iOS companion app",
    detail:
      "Request read access for sleep analysis, heart rate, HRV, resting heart rate, respiratory rate, wrist temperature, and workouts.",
  },
  {
    name: "Watch metric snapshots",
    status: "planned",
    source: "watchOS background delivery",
    detail:
      "Send summarized Apple Watch samples to this dashboard for widgets WHOOP does not expose, such as sleep latency or in-bed timing.",
  },
  {
    name: "Dashboard normalization",
    status: "ready",
    source: "Next.js API skeleton",
    detail:
      "Keep Apple Watch data separate from WHOOP and Garmin records, then merge only at the widget/spec layer.",
  },
  {
    name: "Complications and widgets",
    status: "planned",
    source: "WidgetKit",
    detail:
      "Expose glanceable targets for bedtime consistency, recovery-safe strain, and sleep debt payoff once native data sync exists.",
  },
];

export const APPLE_WATCH_HEALTHKIT_TYPES = [
  "HKCategoryTypeIdentifierSleepAnalysis",
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierRespiratoryRate",
  "HKQuantityTypeIdentifierAppleSleepingWristTemperature",
  "HKWorkoutTypeIdentifier",
];
