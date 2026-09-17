"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Cloud, Music2, Radio, ArrowUpRight } from "lucide-react";
import { bluetoothAvailable, connectHeartRate } from "@/lib/spotify/bluetooth";
import { CACHE_TTL, clearCache, readCache, saveCache } from "@/lib/spotify/cache";
import { chooseTrack, DecisionClock, targetHeartRate, type BpmTrack, type Playback, type Sample, type Track } from "@/lib/spotify/dj";

async function api<T>(action: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/spotify/${action}`, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  const data = await response.json();
  if (!response.ok) throw new Error(`${data.error ?? "Request failed."}${response.headers.get("retry-after") ? ` Retry after ${response.headers.get("retry-after")} seconds.` : ""}`);
  return data;
}
type Playlist = { id: string; name: string; importable: boolean };
const button = "rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-zinc-100";

export function SpotifyDj() {
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  const [includeLiked, setIncludeLiked] = useState(true);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState("");
  const [playlistAttempt, setPlaylistAttempt] = useState(0);
  const [tracks, setTracks] = useState<BpmTrack[]>([]);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sensor, setSensor] = useState("");
  const [hr, setHr] = useState<number | null>(null);
  const [supported, setSupported] = useState(false);
  const [running, setRunning] = useState(false);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [next, setNext] = useState<{ track: BpmTrack; target: number } | null>(null);
  const [first, setFirst] = useState("");
  const samples = useRef<Sample[]>([]);
  const connection = useRef<Awaited<ReturnType<typeof connectHeartRate>> | null>(null);
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const importController = useRef<AbortController | null>(null);
  const clock = useRef(new DecisionClock());
  const history = useRef<string[]>([]);
  const lastDevice = useRef("");
  const alive = useRef(true);

  function stop() {
    active.current = false;
    controller.current?.abort();
    setRunning(false);
  }

  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    void api<{ connected: boolean; configured: boolean; id: string; name: string }>("status", undefined, abort.signal).then(status => {
      setConfigured(status.configured);
      if (status.connected) { setAccount({ id: status.id, name: status.name }); setTracks(readCache(status.id)); }
      if (new URLSearchParams(location.search).has("spotify_error")) setError("Spotify authorization was cancelled or failed. Connect again.");
    }).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) { setLoaded(true); setSupported(bluetoothAvailable()); } });
    const timer = setInterval(() => setHr(targetHeartRate(samples.current)), 1000);
    const visibility = () => {
      if (document.hidden && active.current) { stop(); setMessage("DJ stopped because this tab is hidden. An already queued song will still play."); }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive.current = false;
      abort.abort(); importController.current?.abort(); controller.current?.abort(); active.current = false;
      connection.current?.disconnect(); clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!account) return;
    const abort = new AbortController();
    async function loadPlaylists() {
      setPlaylistLoading(true); setPlaylistError("");
      try {
        const all = new Map<string, Playlist>();
        let offset: number | null = 0;
        while (offset !== null) {
          const page: { playlists: Playlist[]; nextOffset: number | null } = await api(`playlists?offset=${offset}`, undefined, abort.signal);
          for (const playlist of page.playlists) all.set(playlist.id, playlist);
          offset = page.nextOffset;
        }
        if (!abort.signal.aborted) setPlaylists([...all.values()]);
      } catch (e) {
        if (!abort.signal.aborted) setPlaylistError(e instanceof Error ? e.message : "Could not load playlists.");
      } finally { if (!abort.signal.aborted) setPlaylistLoading(false); }
    }
    void loadPlaylists();
    return () => abort.abort();
  }, [account, playlistAttempt]);

  async function importLibrary() {
    if (!account || (!includeLiked && !selectedPlaylists.length)) return;
    setBusy(true); setImporting(true); setError("");
    const abort = new AbortController(); importController.current = abort;
    const previous = new Map(tracks.map(t => [t.id, t]));
    const imported = new Map<string, Track>();
    const enriched = new Map(previous);
    try {
      const sources = [
        ...(includeLiked ? [{ action: "library", name: "Liked Songs" }] : []),
        ...selectedPlaylists.map(id => ({ action: `playlist-tracks?id=${id}`, name: playlists.find(p => p.id === id)?.name ?? "playlist" })),
      ];
      for (const source of sources) {
        let offset: number | null = 0;
        while (offset !== null) {
          const page: { tracks: Track[]; nextOffset: number | null; total: number } = await api(`${source.action}${source.action.includes("?") ? "&" : "?"}offset=${offset}`, undefined, abort.signal);
          for (const track of page.tracks) imported.set(track.id, track);
          setMessage(`Importing ${source.name}: ${Math.min(offset + 50, page.total)} of ${page.total} · ${imported.size} unique songs…`);
          offset = page.nextOffset;
        }
      }
      // Save all metadata before tempo lookups so a provider failure cannot lose the import.
      for (const track of imported.values()) {
        const cached = previous.get(track.id);
        enriched.set(track.id, cached && Date.now() - cached.fetchedAt < CACHE_TTL
          ? { ...cached, ...track }
          : { ...track, bpm: null, fetchedAt: Date.now(), provider: "reccobeats", lookupStatus: "missing" });
      }
      saveCache(account.id, [...enriched.values()]);
      setTracks([...imported.keys()].map(id => enriched.get(id)!));
      let count = 0;
      for (const track of imported.values()) {
        if (abort.signal.aborted) break;
        const cached = previous.get(track.id);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL && cached.bpm !== null) enriched.set(track.id, { ...cached, ...track });
        else {
          const result = await api<{ bpm: number | null; fetchedAt: number }>(`bpm?id=${track.id}`, undefined, abort.signal);
          enriched.set(track.id, { ...track, ...result, provider: "reccobeats", lookupStatus: result.bpm === null ? "missing" : "matched" });
          // Checkpoint completed lookups without deleting old membership on partial failure.
          saveCache(account.id, [...enriched.values()]);
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        setMessage(`BPM lookup ${++count} of ${imported.size}…`);
      }
      if (abort.signal.aborted) return;
      const complete = [...imported.keys()].flatMap(id => enriched.has(id) ? [enriched.get(id)!] : []);
      saveCache(account.id, complete); setTracks(complete);
      setMessage(`${complete.filter(t => t.bpm !== null).length} of ${complete.length} imported songs have a BPM. Songs without BPM stay imported but are excluded from the DJ.`);
    } catch (e) {
      if (!abort.signal.aborted) { setTracks(readCache(account.id)); setError(e instanceof Error ? e.message : "Import failed."); }
    } finally {
      if (alive.current) {
        if (abort.signal.aborted) { setTracks(readCache(account.id)); setMessage("Import cancelled. Completed BPM lookups are saved; sync again to continue."); }
        setBusy(false); setImporting(false);
      }
    }
  }

  async function connectSensor() {
    setError(""); setBusy(true);
    try {
      connection.current?.disconnect(); samples.current = []; setHr(null); setSensor("");
      const connected = await connectHeartRate(bpm => { samples.current = [...samples.current.filter(s => Date.now() - s.at < 5000), { bpm, at: Date.now() }]; setHr(bpm); }, () => { samples.current = []; setHr(null); setSensor(""); stop(); setError("WHOOP disconnected. Reconnect before restarting the DJ."); });
      if (!alive.current) { connected.disconnect(); return; }
      connection.current = connected; setSensor(connected.name);
    } catch (e) { setError(e instanceof Error ? e.message : "Bluetooth connection failed."); }
    finally { if (alive.current) setBusy(false); }
  }

  async function start() {
    setError("");
    if (targetHeartRate(samples.current) === null) { setError("Connect WHOOP and wait for a fresh heart-rate reading."); return; }
    if (!navigator.locks) { setError("This browser cannot coordinate DJ tabs. Use a current Chrome or Edge browser."); return; }
    await navigator.locks.request("whoop-spotify-dj", { ifAvailable: true }, async lock => {
      if (!lock) { setError("The DJ is running in another tab. Stop it there first."); return; }
      const abort = new AbortController(); controller.current = abort;
      // Explicit restart is allowed; the server inspects the queue before any new mutation.
      clock.current = new DecisionClock();
      active.current = true; setRunning(true); setNext(null); lastDevice.current = "";
      try {
        while (active.current && !abort.signal.aborted) {
          const state = await api<Playback | null>("playback", undefined, abort.signal);
          if (abort.signal.aborted) break;
          setPlayback(state);
          if (!state?.item || !state.device?.id) throw new Error("Open Spotify and play a single song, then start the DJ.");
          if (lastDevice.current && lastDevice.current !== state.device.id) throw new Error("Playback moved to another device. Check its queue before restarting.");
          lastDevice.current = state.device.id;
          if (state.repeat_state !== "off" || state.shuffle_state) throw new Error("Turn off repeat and shuffle in Spotify, then restart the DJ.");
          if (history.current.at(-1) !== state.item.id) { history.current = [...history.current.slice(-19), state.item.id]; setNext(null); }
          if (clock.current.update(state)) {
            const target = targetHeartRate(samples.current);
            if (target === null) throw new Error("No fresh WHOOP reading. Live matching stopped; existing playback continues.");
            const track = chooseTrack(tracks.filter(t => Date.now() - t.fetchedAt < CACHE_TTL), target, state.item.id, history.current);
            if (!track) throw new Error("No other liked song with a known BPM is available. Import more songs.");
            clock.current.commit(); // An uncertain command must not be automatically repeated.
            await api("queue", { id: track.id, currentId: state.item.id, deviceId: state.device.id }, abort.signal);
            if (abort.signal.aborted) break;
            setNext({ track, target }); setMessage(`Next song selected using ${Math.round(target)} BPM heart rate.`);
          }
          const untilDecision = state.item.duration_ms - (state.progress_ms ?? 0) - 15000;
          const delay = state.is_playing ? Math.max(1000, Math.min(5000, untilDecision)) : 5000;
          await new Promise<void>(resolve => { const timer = setTimeout(done, delay); function done() { clearTimeout(timer); abort.signal.removeEventListener("abort", done); resolve(); } abort.signal.addEventListener("abort", done, { once: true }); });
        }
      } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "DJ stopped."); }
      finally { active.current = false; if (alive.current) setRunning(false); }
    });
  }

  async function playFirst() {
    setBusy(true); setError("");
    try { await api("play", { id: first }); setMessage("Song started. Connect WHOOP, then start the DJ."); }
    catch (e) { setError(e instanceof Error ? e.message : "Playback failed."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    stop(); setBusy(true); setError("");
    try {
      await api("disconnect", {});
      if (account) clearCache(account.id);
      connection.current?.disconnect(); samples.current = []; setSensor(""); setHr(null);
      setAccount(null); setPlaylists([]); setSelectedPlaylists([]); setIncludeLiked(true); setTracks([]); setPlayback(null); setNext(null); setMessage("");
    } catch (e) { setError(e instanceof Error ? e.message : "Disconnect failed."); }
    finally { setBusy(false); }
  }

  const matched = tracks.filter(t => t.bpm !== null);
  return <>
    <div className="mb-8 grid gap-4 sm:grid-cols-3" aria-label="Music services">
      <button disabled={!loaded || busy || (!account && !configured)} onClick={() => account ? document.getElementById("spotify-library")?.scrollIntoView({ behavior: "smooth", block: "start" }) : window.location.assign("/api/spotify/connect")} className="group flex min-h-60 flex-col rounded-3xl border border-lime-300 bg-lime-50 p-6 text-left transition hover:border-lime-500 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-700 disabled:opacity-60">
        <Radio aria-hidden="true" className="mb-7 size-9 text-green-700" />
        <span className="text-xl font-semibold">Spotify</span>
        <span className="mt-2 text-sm leading-6 text-zinc-600">Your liked songs and handpicked playlists, in step with you.</span>
        <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-green-800">{!loaded ? "Checking connection…" : account ? "Connected · Choose music" : !configured ? "Setup pending" : "Connect Spotify"}<ArrowUpRight aria-hidden="true" className="size-4" /></span>
      </button>
      {[{ name: "Apple Music", Icon: Music2, color: "text-rose-500", description: "Bring your Apple Music library along for the run." }, { name: "SoundCloud", Icon: Cloud, color: "text-orange-500", description: "Find your rhythm with independent tracks and mixes." }].map(({ name, Icon, color, description }) => <div key={name} className="flex min-h-60 flex-col rounded-3xl border border-zinc-200 bg-white p-6">
        <Icon aria-hidden="true" className={`mb-7 size-9 ${color}`} /><h2 className="text-xl font-semibold">{name}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p><span className="mt-auto pt-6 text-sm text-zinc-500">Coming soon</span>
      </div>)}
    </div>
    <section id="spotify-library" className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8">
    <div><h2 className="text-xl font-semibold">Your music. Your live rhythm.</h2><p className="mt-2 text-sm leading-6 text-zinc-600">About 15 seconds before each song ends, we choose your closest BPM match and queue it in Spotify. The current song finishes naturally.</p></div>
    {!loaded ? <p role="status">Checking Spotify connection…</p> : !account ? <div className="space-y-3">
      {configured ? <button className={`${button} inline-block bg-lime-200`} onClick={() => window.location.assign("/api/spotify/connect")}>Connect Spotify</button> : <p className="text-sm text-amber-800">Spotify connection is not available yet. Please try again once setup is complete.</p>}
      <p className="text-sm text-zinc-500">Spotify Premium is required to control playback.</p>
    </div> : <>
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm">Connected as {account.name}</span><button className={button} disabled={busy} onClick={() => void disconnect()}>Disconnect Spotify</button></div>
      <div className="space-y-4">
        <h3 className="font-medium">1. Choose your music</h3>
        <p className="text-sm text-zinc-600">Import all your liked songs and any playlists you select. Duplicate songs are only added once. Each import replaces your previous selection on this browser.</p>
        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 p-4"><input type="checkbox" checked={includeLiked} disabled={busy || running} onChange={e => setIncludeLiked(e.target.checked)} className="size-4 accent-green-700" /><span className="text-sm font-medium">All Liked Songs</span></label>
        <fieldset disabled={busy || running} className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Your playlists · {selectedPlaylists.length} selected</legend>
          <p className="text-xs leading-5 text-zinc-500">Spotify allows importing playlists you own or collaborate on.</p>
          {playlistLoading ? <p role="status" className="text-sm text-zinc-500">Loading playlists…</p> : playlistError ? <div className="space-y-2"><p role="alert" className="text-sm text-amber-800">{playlistError}</p><button className={button} onClick={() => setPlaylistAttempt(n => n + 1)}>Retry playlists</button> <button className="text-sm underline" onClick={() => window.location.assign("/api/spotify/connect")}>Reconnect to grant playlist access</button></div> : playlists.length ? <div className="max-h-72 space-y-2 overflow-y-auto">{playlists.map(p => <label key={p.id} className={`flex items-center gap-3 rounded-xl border p-3 ${selectedPlaylists.includes(p.id) ? "border-green-300 bg-green-50" : "border-zinc-200"}`}><input type="checkbox" disabled={!p.importable} checked={selectedPlaylists.includes(p.id)} onChange={e => setSelectedPlaylists(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} className="size-4 shrink-0 accent-green-700" /><span className="min-w-0 break-words text-sm">{p.name}{!p.importable && <span className="block text-xs text-zinc-500">Owner or collaborator access required</span>}</span></label>)}</div> : <p className="text-sm text-zinc-500">No playlists found. You can still import your liked songs.</p>}
        </fieldset>
        <p className="text-sm text-zinc-600">{tracks.length} imported songs · {matched.length} ready for BPM matching. Saved on this browser for up to seven days.</p>
        <div className="flex flex-wrap gap-2"><button className={`${button} bg-lime-200`} disabled={busy || running || (!includeLiked && !selectedPlaylists.length)} onClick={() => void importLibrary()}>{importing ? "Importing…" : "Import selected music"}</button>{importing && <button className={button} onClick={() => importController.current?.abort()}>Cancel import</button>}</div>
      </div>
      <div className="space-y-3"><h3 className="font-medium">2. Connect live heart rate</h3><p className="text-sm text-zinc-600">Enable Heart Rate Broadcast in WHOOP, then select your band. Keep this tab visible during playback.</p>{!supported && <p className="text-sm text-amber-800">Web Bluetooth is unavailable here. Use a supported Chrome or Edge browser; iPhone/Safari requires a future native bridge.</p>}<button className={button} disabled={!supported || busy || running} onClick={() => void connectSensor()}>{sensor ? `Reconnect ${sensor}` : "Connect WHOOP Bluetooth"}</button><p className="text-2xl font-semibold" aria-live="polite">{hr === null ? "Waiting for live heart rate" : `${Math.round(hr)} BPM`}</p></div>
      <div className="space-y-3"><h3 className="font-medium">3. Start listening</h3><p className="text-sm text-zinc-600">Open Spotify on your playback device. Clear its queue and turn off shuffle, repeat, autoplay, and crossfade. Play one song there, or choose your first song below.</p>
        <div className="flex flex-wrap gap-2"><select aria-label="First song" className="min-w-0 max-w-full rounded-xl border p-2 text-sm" value={first} disabled={running || busy} onChange={e => setFirst(e.target.value)}><option value="">Choose first song</option>{matched.map(t => <option key={t.id} value={t.id}>{t.name} — {t.artists.map(a => a.name).join(", ")} ({Math.round(t.bpm!)} BPM)</option>)}</select><button className={button} disabled={!first || busy || running} onClick={() => void playFirst()}>Play song</button></div>
        <div className="flex flex-wrap gap-2"><button className={`${button} bg-lime-200`} disabled={running || busy || matched.length < 2 || hr === null} onClick={() => void start()}>Start live DJ</button><button className={button} disabled={!running} onClick={() => { stop(); setMessage("DJ stopped. An already queued song will still play."); }}>Stop DJ</button><button className={button} disabled={busy} onClick={() => { stop(); void api("pause", {}).catch(e => setError(e.message)); }}>Pause Spotify</button></div>
      </div>
      {playback?.item && <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs uppercase text-zinc-500">{playback.is_playing ? "Now playing on Spotify" : "Paused on Spotify"}</p><a href={`https://open.spotify.com/track/${playback.item.id}`} target="_blank" rel="noreferrer" className="font-medium underline">{playback.item.name} — {playback.item.artists.map(a => a.name).join(", ")}</a>{playback.item.album?.images[0] && <div className="mt-3">{/* Spotify artwork is displayed with its corresponding track. */}
        <Image unoptimized src={playback.item.album.images[0].url} alt={`${playback.item.name} cover`} width={96} height={96} className="rounded-lg" /></div>}</div>}
      {next && <p className="text-sm">Up next: <a className="underline" href={next.track.uri.replace("spotify:track:", "https://open.spotify.com/track/")}>{next.track.name}</a> · {Math.round(next.track.bpm!)} BPM · selected at {Math.round(next.target)} BPM heart rate.</p>}
    </>}
    {message && <p role="status" className="text-sm text-zinc-600">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    <p className="text-xs text-zinc-500">BPM data from <a className="underline" href="https://reccobeats.com">ReccoBeats</a>. Heart-rate samples stay in this tab. Stopping the DJ does not remove songs already queued in Spotify.</p>
  </section></>;
}
