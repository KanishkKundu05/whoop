"use client";

import { Pause, Play, Radio, RefreshCw, Sparkles, Volume2 } from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DjRecommendation, DjSong } from "@/lib/dj/types";

type SoundCloudWidgetOptions = {
  auto_play?: boolean;
  buying?: boolean;
  callback?: () => void;
  color?: string;
  download?: boolean;
  sharing?: boolean;
  show_artwork?: boolean;
  show_comments?: boolean;
  show_playcount?: boolean;
  show_user?: boolean;
};

type SoundCloudWidget = {
  bind: (eventName: string, listener: () => void) => void;
  unbind: (eventName: string) => void;
  load: (url: string, options?: SoundCloudWidgetOptions) => void;
  pause: () => void;
  play: () => void;
  setVolume: (volume: number) => void;
};

type SoundCloudWidgetFactory = ((iframe: HTMLIFrameElement | string) => SoundCloudWidget) & {
  Events: {
    ERROR: string;
    FINISH: string;
    PAUSE: string;
    PLAY: string;
    READY: string;
  };
};

declare global {
  interface Window {
    SC?: {
      Widget: SoundCloudWidgetFactory;
    };
  }
}

type RecommendationResponse = DjRecommendation | { error: string };

function buildPlayerSrc(track: DjSong) {
  const params = new URLSearchParams({
    url: track.soundCloudUrl,
    auto_play: "false",
    buying: "false",
    download: "false",
    sharing: "false",
    show_artwork: "true",
    show_comments: "false",
    show_playcount: "false",
    show_user: "true",
    color: "#65a30d",
  });

  return `https://w.soundcloud.com/player/?${params.toString()}`;
}

function formatDateTime(value?: string) {
  if (!value) return "Pending";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function isRecommendation(
  response: RecommendationResponse,
): response is DjRecommendation {
  return "track" in response;
}

export function AgenticDj({ songs }: { songs: DjSong[] }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<SoundCloudWidget | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [recommendation, setRecommendation] = useState<DjRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialTrack = songs[0];

  const playerSrc = useMemo(() => {
    if (!initialTrack) return "";
    return buildPlayerSrc(initialTrack);
  }, [initialTrack]);

  const loadTrack = useCallback((track: DjSong, shouldPlay: boolean) => {
    const widget = widgetRef.current;

    if (!widget) return;

    if (currentTrackIdRef.current === track.id) {
      if (shouldPlay) widget.play();
      return;
    }

    currentTrackIdRef.current = track.id;
    widget.load(track.soundCloudUrl, {
      auto_play: shouldPlay,
      buying: false,
      download: false,
      sharing: false,
      show_artwork: true,
      show_comments: false,
      show_playcount: false,
      show_user: true,
      color: "#65a30d",
      callback: () => {
        if (shouldPlay) widget.play();
      },
    });
  }, []);

  const pollRecommendation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dj/recommendation", {
        cache: "no-store",
      });
      const body = (await response.json()) as RecommendationResponse;

      if (!response.ok || !isRecommendation(body)) {
        setError("error" in body ? body.error : "DJ recommendation failed.");
        return;
      }

      setRecommendation(body);
      loadTrack(body.track, activeRef.current);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "DJ recommendation failed.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadTrack]);

  useEffect(() => {
    activeRef.current = active;

    if (!active) {
      widgetRef.current?.pause();
    }
  }, [active]);

  useEffect(() => {
    if (!scriptReady || !iframeRef.current || !window.SC) return;

    const widget = window.SC.Widget(iframeRef.current);
    const events = window.SC.Widget.Events;

    widgetRef.current = widget;

    const handleReady = () => {
      setWidgetReady(true);
      widget.setVolume(82);
    };
    const handleError = () => {
      setError("SoundCloud could not load the selected track.");
    };

    widget.bind(events.READY, handleReady);
    widget.bind(events.ERROR, handleError);

    return () => {
      widget.unbind(events.READY);
      widget.unbind(events.ERROR);
      widgetRef.current = null;
      setWidgetReady(false);
    };
  }, [scriptReady]);

  useEffect(() => {
    if (!active) return;

    const initialPoll = window.setTimeout(() => {
      void pollRecommendation();
    }, 0);
    const interval = window.setInterval(() => {
      void pollRecommendation();
    }, 20_000);

    return () => {
      window.clearTimeout(initialPoll);
      window.clearInterval(interval);
    };
  }, [active, pollRecommendation]);

  useEffect(() => {
    if (active && widgetReady && recommendation) {
      loadTrack(recommendation.track, true);
    }
  }, [active, loadTrack, recommendation, widgetReady]);

  if (!initialTrack) return null;

  const currentTrack = recommendation?.track ?? initialTrack;

  return (
    <section className="border border-zinc-200 bg-white p-5">
      <Script
        src="https://w.soundcloud.com/player/api.js"
        strategy="lazyOnload"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
        onError={() => setError("SoundCloud player script failed to load.")}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-lime-700">
                <Sparkles size={15} />
                Agentic DJ
              </p>
              <h3 className="mt-2 text-lg font-semibold text-zinc-950">
                {currentTrack.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                {currentTrack.artist} · {currentTrack.bpm} song bpm
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActive((value) => !value)}
                className={[
                  "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold",
                  active
                    ? "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950"
                    : "bg-zinc-950 text-white hover:bg-zinc-800",
                ].join(" ")}
              >
                {active ? <Pause size={16} /> : <Play size={16} />}
                {active ? "Stop" : "Start"}
              </button>
              <button
                type="button"
                onClick={() => void pollRecommendation()}
                disabled={loading}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-950 disabled:text-zinc-400"
                aria-label="Refresh DJ recommendation"
                title="Refresh DJ recommendation"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <iframe
            ref={iframeRef}
            title="SoundCloud Agentic DJ player"
            className="h-[166px] w-full border-0"
            allow="autoplay"
            scrolling="no"
            src={playerSrc}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="border border-zinc-200 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                WHOOP BPM
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">
                {recommendation ? Math.round(recommendation.signal.bpm) : "—"}
              </p>
            </div>
            <div className="border border-zinc-200 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                Band
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">
                {recommendation?.targetBand ?? "—"}
              </p>
            </div>
            <div className="border border-zinc-200 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                Player
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-zinc-950">
                <Volume2 size={16} />
                {widgetReady ? "Ready" : scriptReady ? "Loading" : "Queued"}
              </p>
            </div>
          </div>

          {recommendation ? (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              {recommendation.reason}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {error}
            </p>
          ) : null}
        </div>

        <aside className="border border-zinc-200">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h4 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950">
              <Radio size={16} />
              Song pool
            </h4>
          </div>
          <div className="divide-y divide-zinc-100">
            {songs.map((song) => (
              <div
                key={song.id}
                className={[
                  "grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3",
                  currentTrack.id === song.id ? "bg-lime-50" : "",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-950">
                    {song.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {song.artist} · {song.tags.join(", ")}
                  </p>
                </div>
                <p className="text-right text-sm font-semibold text-zinc-700">
                  {song.bpm}
                </p>
              </div>
            ))}
          </div>
          <p className="border-t border-zinc-200 px-4 py-3 text-xs leading-5 text-zinc-500">
            WHOOP source: {recommendation?.signal.label ?? "Pending"} ·{" "}
            {formatDateTime(recommendation?.signal.sampledAt)}
          </p>
        </aside>
      </div>
    </section>
  );
}
