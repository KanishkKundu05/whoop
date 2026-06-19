export type DjSong = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  energy: 1 | 2 | 3 | 4 | 5;
  soundCloudUrl: string;
  tags: string[];
};

export type HeartRateSignal = {
  bpm: number;
  source: "workout_average" | "cycle_average" | "recovery_resting";
  label: string;
  sampledAt: string;
  isLive: boolean;
};

export type DjRecommendation = {
  signal: HeartRateSignal;
  track: DjSong;
  alternatives: DjSong[];
  targetBand: string;
  tempoDelta: number;
  reason: string;
  generatedAt: string;
};
