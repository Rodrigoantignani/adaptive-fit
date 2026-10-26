export type Sex = 'M' | 'F';

export interface Profile {
  name: string;
  sex: Sex;
  /** YYYY-MM-DD */
  birthDate: string;
  heightCm?: number;
  /** Cuidado permanente com a coluna (escoliose, hérnia...): bloqueia carga axial sempre. */
  spineCare: boolean;
}

export type SkinfoldSite =
  | 'chest'
  | 'midaxillary'
  | 'triceps'
  | 'subscapular'
  | 'abdominal'
  | 'suprailiac'
  | 'thigh'
  | 'calf';

export type PerimeterSite =
  | 'shoulders'
  | 'chest'
  | 'absUpper'
  | 'absLower'
  | 'hips'
  | 'bicepsR'
  | 'bicepsL'
  | 'forearmR'
  | 'forearmL'
  | 'thighR'
  | 'thighL'
  | 'calfR'
  | 'calfL';

export type MeasureCondition = 'fasted' | 'post_workout' | 'other';

export interface BodyCompResult {
  /** 'recorded' = valor importado, sem dobras suficientes para recalcular. */
  protocol: 'JP7' | 'JP3' | 'recorded';
  bfPercent: number;
  fatKg: number;
  leanKg: number;
  sumFolds: number;
  density?: number;
}

export interface BodyAssessment {
  id: string;
  date: string;
  weightKg: number;
  condition: MeasureCondition;
  skinfolds: Partial<Record<SkinfoldSite, number>>;
  perimeters: Partial<Record<PerimeterSite, number>>;
  result: BodyCompResult | null;
  source?: 'app' | 'legacy';
  notes?: string;
}

export type SplitId = 'upper_full' | 'push' | 'pull' | 'legs';
export type Equipment = 'machine' | 'cable' | 'free' | 'bodyweight';
export type Muscle =
  | 'chest'
  | 'back'
  | 'front_delt'
  | 'side_delt'
  | 'rear_delt'
  | 'biceps'
  | 'triceps'
  | 'forearm'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'core';

export interface Exercise {
  id: string;
  name: string;
  /** Músculo principal: usado para achar substitutos. */
  muscle: Muscle;
  /** Ordem no array = prioridade dentro do split. */
  splits: SplitId[];
  equipment: Equipment;
  loadUnit: 'kg' | 'kg/lado';
  /** Degrau de carga da progressão. 0 = progride por reps/técnica. */
  increment: number;
  repMin: number;
  repMax: number;
  sets: number;
  restSec: number;
  axialLoad: boolean;
  coreDemand: 'low' | 'high';
  antagonist?: string;
  cue?: string;
}

export type DayLoad = 'light' | 'standing' | 'double' | 'off';
export type SorenessArea = 'core' | 'lower_back' | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs';

export interface CheckIn {
  id: string;
  date: string;
  sleepHours: number;
  /** 1..5 */
  sleepQuality: number;
  /** 1..5 */
  energy: number;
  dayLoad: DayLoad;
  timeAvailMin: number;
  soreness: SorenessArea[];
  spineAlert: boolean;
  split: SplitId;
}

export type Tier = 'push' | 'maintain' | 'recover';
export type Tone = 'good' | 'info' | 'warn';

export interface Rule {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
}

export interface ReadinessFlags {
  machinesOnly: boolean;
  noAxial: boolean;
  noHighCore: boolean;
  reducedVolume: boolean;
}

export interface Readiness {
  score: number;
  tier: Tier;
  factors: { label: string; value: string; tone: Tone }[];
  flags: ReadinessFlags;
  rules: Rule[];
}

export interface SetLog {
  load: number;
  reps: number;
  at: number;
}

export interface Target {
  load: number | null;
  reps: number;
  action: 'start' | 'increase' | 'hold' | 'decrease';
  reason: string;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  restSec: number;
  target: Target;
  supersetWith?: string;
  substitutedFor?: string;
}

export interface Plan {
  items: PlannedExercise[];
  estimatedMin: number;
  rules: Rule[];
  dropped: { exerciseId: string; reason: string }[];
}

export interface SessionEntry {
  exerciseId: string;
  sets: SetLog[];
}

export interface Session {
  id: string;
  date: string;
  checkInId: string | null;
  split: SplitId;
  readinessScore: number;
  tier: Tier;
  plan: PlannedExercise[];
  rules: Rule[];
  entries: SessionEntry[];
  startedAt: number;
  endedAt?: number;
}
