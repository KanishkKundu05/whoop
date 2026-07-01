export type ScoreState = "SCORED" | "PENDING_SCORE" | "UNSCORABLE" | string;

export type WhoopTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: "bearer" | string;
};

export type WhoopSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
  connectedAt: number;
  userId?: number;
};

export type UserBasicProfile = {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
};

export type UserBodyMeasurement = {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
};

export type CycleScore = {
  strain: number;
  kilojoule: number;
  average_heart_rate: number;
  max_heart_rate: number;
};

export type Cycle = {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end?: string;
  timezone_offset: string;
  score_state: ScoreState;
  score?: CycleScore;
};

export type RecoveryScore = {
  user_calibrating: boolean;
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage?: number;
  skin_temp_celsius?: number;
};

export type Recovery = {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: ScoreState;
  score?: RecoveryScore;
};

export type SleepStageSummary = {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_no_data_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  sleep_cycle_count: number;
  disturbance_count: number;
};

export type SleepNeeded = {
  baseline_milli: number;
  need_from_sleep_debt_milli: number;
  need_from_recent_strain_milli: number;
  need_from_recent_nap_milli: number;
};

export type SleepScore = {
  stage_summary: SleepStageSummary;
  sleep_needed: SleepNeeded;
  respiratory_rate?: number;
  sleep_performance_percentage?: number;
  sleep_consistency_percentage?: number;
  sleep_efficiency_percentage?: number;
};

export type Sleep = {
  id: string;
  cycle_id: number;
  v1_id?: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: ScoreState;
  score?: SleepScore;
};

export type ZoneDurations = {
  zone_zero_milli: number;
  zone_one_milli: number;
  zone_two_milli: number;
  zone_three_milli: number;
  zone_four_milli: number;
  zone_five_milli: number;
};

export type WorkoutScore = {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
  percent_recorded: number;
  distance_meter?: number;
  altitude_gain_meter?: number;
  altitude_change_meter?: number;
  zone_durations: ZoneDurations;
};

export type Workout = {
  id: string;
  v1_id?: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_name: string;
  sport_id?: number;
  score_state: ScoreState;
  score?: WorkoutScore;
};

export type PaginatedWhoopResponse<T> = {
  records?: T[];
  next_token?: string;
};

export type ResourceResult<T> = {
  data: T | null;
  error: string | null;
  status?: number;
};

export type WhoopDashboardData = {
  rangeDays: number;
  source: "range" | "latest_unfiltered";
  start: string;
  end: string;
  fetchedAt: string;
  profile: ResourceResult<UserBasicProfile>;
  body: ResourceResult<UserBodyMeasurement>;
  cycles: ResourceResult<PaginatedWhoopResponse<Cycle>>;
  recoveries: ResourceResult<PaginatedWhoopResponse<Recovery>>;
  sleeps: ResourceResult<PaginatedWhoopResponse<Sleep>>;
  workouts: ResourceResult<PaginatedWhoopResponse<Workout>>;
};
