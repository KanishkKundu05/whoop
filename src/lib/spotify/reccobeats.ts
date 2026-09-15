import "server-only";
import { ApiError } from "./server";

async function get(path: string) {
  const response = await fetch(`https://api.reccobeats.com/v1/${path}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError("BPM lookup failed. Retry the import to continue.", response.status === 429 ? 429 : 502, response.headers.get("retry-after") ?? undefined);
  return response.json();
}

export async function lookupBpm(id: string): Promise<number | null> {
  const data = await get(`track?ids=${encodeURIComponent(id)}`);
  const matches = data?.content?.filter((t: { href?: string; id?: string }) => t.href === `https://open.spotify.com/track/${id}` && typeof t.id === "string") ?? [];
  if (matches.length !== 1) return null;
  const features = await get(`track/${encodeURIComponent(matches[0].id)}/audio-features`);
  if (features?.href !== `https://open.spotify.com/track/${id}`) return null;
  const bpm = Number(features?.tempo);
  return Number.isFinite(bpm) && bpm > 0 && bpm <= 400 ? bpm : null;
}
