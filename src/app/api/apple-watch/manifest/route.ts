import {
  APPLE_WATCH_CAPABILITIES,
  APPLE_WATCH_HEALTHKIT_TYPES,
} from "@/lib/apple-watch/types";

export async function GET() {
  return Response.json({
    provider: "apple-watch",
    status: "skeleton",
    note:
      "Apple Watch support requires an iOS/watchOS companion app because HealthKit data is not readable directly from a web app.",
    healthKitTypes: APPLE_WATCH_HEALTHKIT_TYPES,
    capabilities: APPLE_WATCH_CAPABILITIES,
  });
}
