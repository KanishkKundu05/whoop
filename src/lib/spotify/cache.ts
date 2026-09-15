import type { BpmTrack } from "./dj";

const PREFIX = "whoop-spotify-bpm-v1:";
export const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
export function readCache(userId: string): BpmTrack[] {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key) ?? "null");
        if (!entry || Date.now() - entry.savedAt > CACHE_TTL) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
    const value = JSON.parse(localStorage.getItem(PREFIX + userId) ?? "null");
    if (!value || Date.now() - value.savedAt > CACHE_TTL || !Array.isArray(value.tracks)) {
      localStorage.removeItem(PREFIX + userId);
      return [];
    }
    const valid = value.tracks.filter((t: BpmTrack) => typeof t.id === "string" && typeof t.name === "string" && Array.isArray(t.artists) && typeof t.fetchedAt === "number" && Date.now() - t.fetchedAt < CACHE_TTL && (t.bpm === null || (Number.isFinite(t.bpm) && t.bpm > 0)));
    if (valid.length !== value.tracks.length) saveCache(userId, valid);
    return valid;
  } catch { return []; }
}
export function saveCache(userId: string, tracks: BpmTrack[]) {
  // Compact records: don't persist provider responses, album art, or credentials.
  localStorage.setItem(PREFIX + userId, JSON.stringify({ savedAt: Date.now(), tracks: tracks.map(t => ({ id: t.id, uri: t.uri, name: t.name, artists: t.artists.map(a => ({ name: a.name })), duration_ms: t.duration_ms, is_playable: t.is_playable, bpm: t.bpm, fetchedAt: t.fetchedAt, provider: t.provider, lookupStatus: t.lookupStatus })) }));
}
export function clearCache(userId: string) { localStorage.removeItem(PREFIX + userId); }
