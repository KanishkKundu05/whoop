import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | WHOOP Dashboard",
  description: "Privacy policy for this personal WHOOP dashboard and connection tester.",
};

const sections = [
  {
    title: "Information We Collect",
    body: [
      "When you connect WHOOP, this app requests access to your WHOOP profile, body measurement, recovery, cycle, sleep, and workout data using OAuth authorization. The requested categories are shown on the WHOOP consent screen.",
      "When you connect Garmin, this app requests the Garmin permissions configured for the developer app and authorized by you during Garmin consent.",
      "When you connect Spotify, the music experience reads your liked songs and playback state and can control playback with your permission. Spotify tokens are encrypted in HTTP-only cookies. Live WHOOP Bluetooth heart-rate samples are held in the listening tab's memory.",
      "The app stores WHOOP access and refresh tokens in encrypted server-side records and encrypted HTTP-only session cookies. The connection setup test stores only WHOOP user and webhook event identifiers, timestamps, and test status.",
      "If daily messaging is enabled, the app stores your recipient's phone number in encrypted server-side storage and sends the generated sleep report through Linq. Do not enter another person's number without permission.",
      "The hosting provider may process basic technical logs, such as request times, IP address, user agent, and requested URLs, to operate and secure the service.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "WHOOP data is used to show your personal performance dashboard, test API access, refresh your OAuth session, and provide the JSON export route available in the app.",
      "Garmin data is used to verify the connected Garmin user ID, list granted permissions, refresh your OAuth session, and support Garmin API routes added to this app.",
      "The Spotify DJ uses recent Bluetooth heart rate to choose a liked song with a similar BPM approximately 15 seconds before the current song ends.",
      "If you enable daily messaging, selected sleep timing and sleep-quality measurements are formatted into a message for the recipient you configure. The app does not sell your provider data, use it for advertising, or use it to make automated decisions about you.",
    ],
  },
  {
    title: "Storage and Retention",
    body: [
      "WHOOP health and activity records are fetched from the WHOOP API when needed. Garmin API diagnostics are fetched from Garmin when requested. Dashboard records may be synchronized to Convex for the dashboard and public view.",
      "OAuth session tokens and daily-message records remain until you disconnect/revoke the provider, disable the feature, delete the deployment data, or an operational retention process removes them. The connection test keeps its latest test state until it is replaced or deleted.",
      "Linq and hosting/database providers may retain message or operational records under their own policies. Hosting logs are retained according to the hosting provider's operational settings.",
      "The music experience caches compact liked-song metadata and BPM values per Spotify account in browser storage. Entries expire after seven days and are removed when the cache is next opened or when you disconnect Spotify here. You can also erase them by clearing this site's browser storage. Heart-rate samples are discarded when the listening tab closes.",
    ],
  },
  {
    title: "Sharing",
    body: [
      "The app sends requests to WHOOP and Garmin only as needed to retrieve data you authorized and to refresh or revoke OAuth access.",
      "Spotify track IDs are sent through our server to ReccoBeats to look up BPM. Your Spotify tokens, account identity, and heart-rate samples are not sent to ReccoBeats. Spotify receives playback requests when you use the DJ.",
      "The app runs on Vercel and may store application data in Convex. If daily messaging is enabled, the generated report and recipient address are sent to Linq for delivery. These providers process data under their own terms and privacy policies.",
      "The app does not share provider data with advertisers, data brokers, or unrelated third parties.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You can sign out to clear the local session cookie from this app.",
      "Disconnect Spotify on the music page to clear its local cache and session cookie. To revoke the authorization grant itself, remove the app in your Spotify account settings.",
      "You can use Revoke access in the dashboard or manage connected applications in your WHOOP or Garmin account to stop future API access.",
      "You can request access to or deletion of data collected through this app from the operator of the deployment where you use it. Disconnect WHOOP/Garmin and disable daily messaging before requesting deletion.",
    ],
  },
  {
    title: "Security",
    body: [
      "The app uses OAuth state validation, signed WHOOP webhook verification, encrypted server-side secrets, encrypted HTTP-only cookies, and HTTPS in production to reduce the risk of unauthorized access.",
      "No internet service can guarantee absolute security, so you should only connect this app from deployments you trust.",
    ],
  },
  {
    title: "Children",
    body: [
      "This app is not intended for children under 13 and should only be used by people who are allowed to maintain WHOOP or Garmin accounts.",
    ],
  },
  {
    title: "Changes and Contact",
    body: [
      "This policy may be updated when the app changes how it handles data.",
      "For privacy questions, access, or deletion requests, contact the operator or administrator who provided access to this deployment using the contact information in the WHOOP developer app.",
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-zinc-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-zinc-200 pb-6">
          <Link
            href="/"
            className="text-sm font-medium text-lime-700 hover:text-lime-800"
          >
            Back to dashboard
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">
            WHOOP Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600">
            Last updated September 15, 2026. This policy explains how this
            deployment of WHOOP Dashboard handles information when you connect
            your WHOOP, Garmin, or Spotify account, use the live music DJ, test a webhook, or enable a daily
            sleep message.
          </p>
        </header>

        <section className="border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-600 sm:p-6">
          <h2 className="text-base font-semibold text-zinc-950">
            Plain-Language Summary
          </h2>
          <p className="mt-3">
            This is a personal-use dashboard. It retrieves the provider data you
            authorize, displays it back to you, and can test a signed WHOOP
            webhook. If enabled, it sends a sleep summary to the recipient you
            choose. This codebase does not sell or advertise against your data.
          </p>
        </section>

        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="border border-zinc-200 bg-white p-5 sm:p-6"
            >
              <h2 className="text-lg font-semibold tracking-normal text-zinc-950">
                {section.title}
              </h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
