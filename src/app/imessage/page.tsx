import {
  FileText,
  LogIn,
  MessageCircle,
  ShieldOff,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WhoopShareCardDemo } from "@/components/whoop-share-card-demo";
import { getRecentWhoopData } from "@/lib/whoop/client";
import { getConfigStatus, getRedirectUriFromHeaders, getScopeParam } from "@/lib/whoop/config";
import { buildWhoopShareCardPayload } from "@/lib/whoop/share-card";
import {
  getWhoopSession,
  isSessionExpiring,
} from "@/lib/whoop/session";
import type {
  Recovery,
  ResourceResult,
  Sleep,
} from "@/lib/whoop/types";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  auth_error?: string | string[];
  range?: string | string[];
}>;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parseRange(value?: string | string[]) {
  const range = Number(firstParam(value));
  return [7, 30, 90].includes(range) ? range : 30;
}

function getRecords<T>(resource: ResourceResult<{ records?: T[] }>) {
  return resource.data?.records ?? [];
}

function isScored<T extends { score_state?: string; score?: unknown }>(record: T) {
  return record.score_state?.toUpperCase() === "SCORED" && record.score != null;
}

function latestScored<T extends { score_state?: string; score?: unknown }>(records: T[]) {
  return records.find(isScored);
}

function buildNativeImportUrl(payload: ReturnType<typeof buildWhoopShareCardPayload>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `whoopshare://import?payload=${encodedPayload}`;
}

function errorMessage(code?: string) {
  const messages: Record<string, string> = {
    missing_code: "WHOOP did not return an authorization code.",
    missing_config: "WHOOP credentials are not configured on this Vercel deployment.",
    refresh_failed: "WHOOP token refresh failed. Connect again.",
    session_expired: "The WHOOP session expired. Connect again.",
    state_mismatch: "The OAuth state check failed. Start the connection again.",
    token_exchange_failed: "The WHOOP authorization code could not be exchanged.",
  };

  return code ? messages[code] ?? `WHOOP auth error: ${code}` : null;
}

async function getDisplayRedirectUri() {
  const headerStore = await headers();
  return getRedirectUriFromHeaders(headerStore);
}

function ImessageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lime-700">
              WHOOP share card
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">
              iMessage demo flow
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
            >
              <Stethoscope size={16} />
              Dashboard
            </Link>
            <Link
              href="/privacy"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:border-zinc-950"
            >
              <FileText size={16} />
              Privacy
            </Link>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function AuthFlow({
  authError,
  missing,
  redirectUri,
}: {
  authError?: string;
  missing: string[];
  redirectUri: string;
}) {
  const isReady = missing.length === 0;

  return (
    <ImessageShell>
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-zinc-200 bg-white p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-lime-300">
            <MessageCircle size={22} />
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-normal">
            Try the WHOOP share card
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
            Connect WHOOP once, then this page builds the demo reply for
            <span className="font-medium text-zinc-800"> how u feeling?</span>
            {" "}from your latest scored sleep and recovery records.
          </p>

          {authError ? (
            <div className="mt-5 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {errorMessage(authError)}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {isReady ? (
              <a
                href="/api/auth/whoop?next=/imessage"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <LogIn size={17} />
                Connect WHOOP
              </a>
            ) : (
              <button
                disabled
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-300 px-4 text-sm font-semibold text-zinc-500"
              >
                <ShieldOff size={17} />
                Configure Vercel env
              </button>
            )}
          </div>
        </div>

        <aside className="border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-950">
            First-time auth checklist
          </h3>
          <ol className="mt-4 space-y-3 text-sm text-zinc-700">
            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold text-zinc-950">1</span>
              <span>Open this page on the Vercel deployment.</span>
            </li>
            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold text-zinc-950">2</span>
              <span>Tap Connect WHOOP and approve the requested scopes.</span>
            </li>
            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
              <span className="font-semibold text-zinc-950">3</span>
              <span>Return here automatically and show the share card.</span>
            </li>
          </ol>
          <dl className="mt-5 space-y-4 border-t border-zinc-200 pt-4 text-sm">
            <div>
              <dt className="font-medium text-zinc-500">Redirect URI</dt>
              <dd className="mt-1 break-all font-mono text-xs text-zinc-900">
                {redirectUri}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Scopes</dt>
              <dd className="mt-1 break-words font-mono text-xs text-zinc-900">
                {getScopeParam()}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Missing env</dt>
              <dd className="mt-1 text-zinc-900">
                {missing.length ? missing.join(", ") : "None"}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </ImessageShell>
  );
}

export default async function ImessagePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const authError = firstParam(params.auth_error);
  const range = parseRange(params.range);
  const config = getConfigStatus();
  const redirectUri = await getDisplayRedirectUri();

  if (!config.isReady) {
    return (
      <AuthFlow
        authError={authError}
        missing={config.missing}
        redirectUri={redirectUri}
      />
    );
  }

  const session = await getWhoopSession();

  if (!session) {
    return (
      <AuthFlow
        authError={authError}
        missing={[]}
        redirectUri={redirectUri}
      />
    );
  }

  if (isSessionExpiring(session)) {
    if (session.refreshToken) {
      redirect(`/api/auth/refresh?next=${encodeURIComponent("/imessage")}`);
    }

    return (
      <AuthFlow
        authError="session_expired"
        missing={[]}
        redirectUri={redirectUri}
      />
    );
  }

  const data = await getRecentWhoopData(session.accessToken, range);
  const latestSleep = latestScored(getRecords<Sleep>(data.sleeps));
  const latestRecovery = latestScored(getRecords<Recovery>(data.recoveries));
  const payload = buildWhoopShareCardPayload({
    memberName: data.profile.data?.first_name,
    recovery: latestRecovery,
    sleep: latestSleep,
  });
  const nativeImportUrl = buildNativeImportUrl(payload);

  return (
    <ImessageShell>
      <section className="border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
        WHOOP is connected. This demo is using the latest scored sleep and
        recovery records available to the dashboard.
      </section>
      <WhoopShareCardDemo
        memberName={data.profile.data?.first_name}
        recovery={latestRecovery}
        sleep={latestSleep}
      />
      <section className="border border-zinc-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">
              Send from your iPhone Messages app
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              After installing the Xcode app on your phone, tap this button on
              the phone. It imports this authenticated card into the native app
              and makes it available inside the Messages app drawer.
            </p>
          </div>
          <a
            href={nativeImportUrl}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Open in app
          </a>
        </div>
      </section>
      <section className="border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-950">
          Native iMessage handoff
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
          The production iMessage extension would call
          <span className="font-mono text-xs"> /api/whoop/share-card</span>
          after the same WHOOP auth session exists, then insert the summary as
          an <span className="font-mono text-xs">MSMessage</span>.
        </p>
      </section>
    </ImessageShell>
  );
}
