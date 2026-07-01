import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | WHOOP + Garmin Dashboard",
  description: "Privacy policy for the WHOOP + Garmin Dashboard application.",
};

const sections = [
  {
    title: "Information We Collect",
    body: [
      "When you connect WHOOP, this app requests access to your WHOOP profile, body measurement, recovery, cycle, sleep, and workout data using OAuth authorization.",
      "When you connect Garmin, this app requests the Garmin permissions configured for the developer app and authorized by you during Garmin consent.",
      "The app stores provider access and refresh tokens in encrypted HTTP-only cookies so it can keep your sessions active without exposing tokens to browser JavaScript.",
      "The hosting provider may process basic technical logs, such as request times, IP address, user agent, and requested URLs, to operate and secure the service.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "WHOOP data is used to show your personal performance dashboard, refresh your OAuth session, and provide the JSON export route available in the app.",
      "Garmin data is used to verify the connected Garmin user ID, list granted permissions, refresh your OAuth session, and support Garmin API routes added to this app.",
      "The app does not sell your provider data, use it for advertising, or use it to make automated decisions about you.",
    ],
  },
  {
    title: "Storage and Retention",
    body: [
      "WHOOP health and activity records are fetched from the WHOOP API when needed. Garmin API diagnostics are fetched from Garmin when requested.",
      "OAuth session tokens remain in encrypted cookies until you sign out, revoke access, the cookies expire, or your browser removes them.",
      "Hosting logs are retained according to the hosting provider's operational settings.",
    ],
  },
  {
    title: "Sharing",
    body: [
      "The app sends requests to WHOOP and Garmin only as needed to retrieve data you authorized and to refresh or revoke OAuth access.",
      "The app runs on Vercel, which may process deployment, request, and operational data to provide hosting infrastructure.",
      "The app does not share provider data with advertisers, data brokers, or unrelated third parties.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You can sign out to clear the local session cookie from this app.",
      "You can use Revoke access in the dashboard or manage connected applications in your WHOOP or Garmin account to stop future API access.",
      "You can request access to data collected through this app from the operator of the deployment where you use it.",
    ],
  },
  {
    title: "Security",
    body: [
      "The app uses OAuth, encrypted HTTP-only cookies, and HTTPS in production to reduce the risk of unauthorized access.",
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
      "For privacy questions or support, contact the operator or administrator who provided access to this deployment.",
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
            Last updated June 19, 2026. This policy explains how this
            deployment of WHOOP Dashboard handles information when you connect
            your WHOOP or Garmin account.
          </p>
        </header>

        <section className="border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-600 sm:p-6">
          <h2 className="text-base font-semibold text-zinc-950">
            Plain-Language Summary
          </h2>
          <p className="mt-3">
            This app retrieves the provider data you authorize, displays it back
            to you, and keeps OAuth tokens in encrypted HTTP-only cookies. This
            codebase does not sell or advertise against your data.
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
