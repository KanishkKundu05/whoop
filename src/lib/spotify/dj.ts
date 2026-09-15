export type Track = { id: string; uri: string; name: string; artists: { name: string }[]; duration_ms: number; is_playable?: boolean; is_local?: boolean; album?: { images: { url: string }[] } };
export type BpmTrack = Track & { bpm: number | null; fetchedAt: number; provider: "reccobeats"; lookupStatus: "matched" | "missing" };
export type Playback = { item: Track | null; progress_ms: number | null; is_playing: boolean; device: { id: string; is_restricted?: boolean }; repeat_state: string; shuffle_state: boolean };
export type Sample = { bpm: number; at: number };

export function parseHeartRate(value: DataView): number | null {
  if (value.byteLength < 2) return null;
  const flags = value.getUint8(0);
  if ((flags & 4) && !(flags & 2)) return null; // Supported contact sensor says off-body.
  if ((flags & 1) && value.byteLength < 3) return null;
  const bpm = flags & 1 ? value.getUint16(1, true) : value.getUint8(1);
  return bpm > 0 && bpm <= 300 ? bpm : null;
}

export function targetHeartRate(samples: Sample[], now = Date.now()): number | null {
  const recent = samples.filter(s => now - s.at >= 0 && now - s.at <= 5000 && s.bpm > 0 && s.bpm <= 300);
  return recent.length ? recent.reduce((sum, s) => sum + s.bpm, 0) / recent.length : null;
}

export function chooseTrack(tracks: BpmTrack[], target: number, current: string, history: string[]): BpmTrack | null {
  const eligible = tracks.filter(t => t.id !== current && !t.is_local && t.is_playable !== false && t.bpm !== null && Number.isFinite(t.bpm) && t.bpm > 0);
  const fresh = eligible.filter(t => !history.slice(-5).includes(t.id));
  return (fresh.length ? fresh : eligible).slice().sort((a, b) =>
    Math.abs(a.bpm! - target) - Math.abs(b.bpm! - target) || history.lastIndexOf(a.id) - history.lastIndexOf(b.id) || a.id.localeCompare(b.id)
  )[0] ?? null;
}

// One decision per occurrence. A backward seek must never duplicate a committed queue item.
export class DecisionClock {
  private track = "";
  private device = "";
  private committed = false;
  update(playback: Playback | null) {
    if (!playback?.item) return false;
    if (this.track !== playback.item.id || this.device !== playback.device.id) {
      this.track = playback.item.id;
      this.device = playback.device.id;
      this.committed = false;
    }
    const remaining = playback.item.duration_ms - (playback.progress_ms ?? 0);
    return !this.committed && playback.is_playing && remaining > 0 && remaining <= 15000;
  }
  commit() { this.committed = true; }
}
