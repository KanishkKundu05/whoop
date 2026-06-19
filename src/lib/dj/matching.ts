import { DJ_SONG_CATALOG } from "./catalog";
import type { DjRecommendation, DjSong, HeartRateSignal } from "./types";

function getTargetBand(bpm: number) {
  if (bpm < 95) return "Recovery";
  if (bpm < 120) return "Warmup";
  if (bpm < 145) return "Tempo";
  if (bpm < 165) return "Push";
  return "Sprint";
}

function getTargetEnergy(bpm: number) {
  if (bpm < 95) return 1;
  if (bpm < 120) return 2;
  if (bpm < 145) return 3;
  if (bpm < 165) return 4;
  return 5;
}

function closestTempoDelta(heartRateBpm: number, songBpm: number) {
  const candidates = [songBpm / 2, songBpm, songBpm * 2];
  return Math.min(
    ...candidates.map((candidate) => Math.abs(heartRateBpm - candidate)),
  );
}

function buildReason(signal: HeartRateSignal, song: DjSong, tempoDelta: number) {
  const source = signal.isLive
    ? "live WHOOP heart rate"
    : signal.label.toLowerCase();

  return `${song.title} is closest to ${Math.round(signal.bpm)} bpm from ${source}, with a ${Math.round(tempoDelta)} bpm tempo gap after half/double-time matching.`;
}

export function recommendDjSong(
  signal: HeartRateSignal,
  songs: DjSong[] = DJ_SONG_CATALOG,
): DjRecommendation {
  const targetEnergy = getTargetEnergy(signal.bpm);
  const ranked = songs
    .map((song) => {
      const tempoDelta = closestTempoDelta(signal.bpm, song.bpm);
      const energyDelta = Math.abs(song.energy - targetEnergy);

      return {
        song,
        tempoDelta,
        score: tempoDelta + energyDelta * 4,
      };
    })
    .sort((a, b) => a.score - b.score || a.tempoDelta - b.tempoDelta);

  const best = ranked[0];

  if (!best) {
    throw new Error("The DJ catalogue is empty.");
  }

  return {
    signal,
    track: best.song,
    alternatives: ranked.slice(1, 4).map((entry) => entry.song),
    targetBand: getTargetBand(signal.bpm),
    tempoDelta: best.tempoDelta,
    reason: buildReason(signal, best.song, best.tempoDelta),
    generatedAt: new Date().toISOString(),
  };
}
