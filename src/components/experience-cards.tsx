import Link from "next/link";
import { ArrowRight, Headphones, Moon } from "lucide-react";
import { getDailySmsConfigStatus, getDailySmsSubscriptionStatus } from "@/lib/messages/daily-subscriptions";
import { readSession } from "@/lib/spotify/server";

export async function ExperienceCards({ whoopUserId }: { whoopUserId?: number }) {
  const config = getDailySmsConfigStatus();
  const [spotify, messages] = await Promise.allSettled([
    readSession(),
    whoopUserId && config.isReady ? getDailySmsSubscriptionStatus(whoopUserId) : Promise.resolve(null),
  ]);
  const subscription = messages.status === "fulfilled" ? messages.value : null;
  const textStatus = messages.status === "rejected" ? "Status unavailable · Open to retry"
    : !config.isReady ? "Delivery setup pending" : subscription?.active
    ? subscription.lastError ? "Delivery needs attention" : subscription.lastSentAt ? "Enabled · Report requested" : "Enabled · Waiting for first sleep update"
    : "Not enabled";
  const musicStatus = spotify.status === "fulfilled" && spotify.value ? "Spotify linked · Open to check playback" : "Connect Spotify to get started";
  return <section aria-label="Your experiences" className="grid gap-5 sm:grid-cols-2">
    {[{ href: "/whoop/music", Icon: Headphones, title: "Music for your pace", description: "Match your Spotify soundtrack to your live heart rate.", status: musicStatus, cta: "Open music" },
      { href: "/morning", Icon: Moon, title: "Morning texts", description: "Share a small sleep update with someone you care about.", status: textStatus, cta: subscription?.active ? "Manage morning texts" : "Set up morning texts" }].map(({ href, Icon, title, description, status, cta }) =>
      <Link href={href} prefetch={false} key={href} className="rounded-3xl border border-zinc-200 bg-white p-6 transition hover:border-lime-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-700">
        <Icon className="text-lime-700" size={25} /><h2 className="mt-4 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        <p className="mt-4 text-xs font-medium text-zinc-600">{status}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">{cta}<ArrowRight size={17} /></span>
      </Link>)}
  </section>;
}
