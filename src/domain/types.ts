export type Sex = 'M' | 'F';
export type Side = 'L' | 'R';

export interface Profile {
  name: string;
  sex: Sex;
  /** YYYY-MM-DD */
  birthDate: string;
  heightCm?: number;
  /** Cuidado permanente com a coluna (escoliose, hérnia...): bloqueia carga axial sempre. */
  spineCare: boolean;
  /** Escoliose: lado do tronco encurtado (côncavo). Gera o bloco corretivo. */
  scoliosis?: { shortSide: Side } | null;
  /** Haglund / tendinopatia de Aquiles: limita carga e dorsiflexão no tornozelo. */
  achilles?: { side: Side } | null;
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

export type SplitId = 'full_body' | 'upper' | 'lower';
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
  splits: SplitId[];
  /** 1 = base do treino (sai por último), 3 = acessório (primeiro a cortar). */
  priority: 1 | 2 | 3;
  /** Executado um lado de cada vez: séries registradas por lado. */
  unilateral: boolean;
  /** Foto da máquina (data URL JPEG comprimido) para reconhecer na academia. */
  photo?: string;
  custom?: boolean;
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
  /** Carga no tendão de Aquiles / dorsiflexão com peso. */
  ankleLoad: 'none' | 'moderate' | 'high';
  /** 'assisted': a carga é ajuda (contrapeso); progredir = tirar ajuda. */
  loadMode: 'normal' | 'assisted';
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
  /** Dor no tendão de Aquiles hoje, 0–10 (só com a condição no perfil). */
  tendonPain?: number;
  /** Regra das 24 h: a dor do tendão piorou desde a manhã seguinte ao último treino? */
  tendonWorse?: boolean;
  /** Sinal de alerta: formigamento ou dor que irradia. */
  radiating?: boolean;
}

/** Avaliação funcional: testes de movimento repetidos a cada 4–6 semanas. */
export interface FunctionalTest {
  id: string;
  date: string;
  /** Joelho na parede: distância máxima do dedão à parede com o calcanhar no chão (cm). */
  dorsiflexionL?: number;
  dorsiflexionR?: number;
  /** Braço acima da cabeça encostado na parede, costas e lombar apoiadas. */
  overheadL?: 'ok' | 'limited';
  overheadR?: 'ok' | 'limited';
  /** Elevação de calcanhar unilateral no chão plano, reps até a fadiga (só com dor ≤ 3). */
  calfRaiseL?: number;
  calfRaiseR?: number;
  /** Teste de Adams: lado da gibosidade (costela mais alta) ao inclinar o tronco. */
  adamsHump?: Side | 'none';
  /** Lado em que o dorsal "não aparece" / não ativa nas puxadas. */
  latWeak?: Side | 'none';
  photos?: { front?: string; back?: string; side?: string };
  notes?: string;
}

export interface Finding {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
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
  /** 0 livre · 1 condição presente (sai carga alta) · 2 dor ≥ 5 (sai carga moderada também) */
  ankleLevel: 0 | 1 | 2;
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
  side?: Side;
  /** Série extra do lado fraco: máximo de reps até a falha técnica. */
  amrap?: boolean;
}

export interface Target {
  load: number | null;
  reps: number;
  action: 'start' | 'increase' | 'hold' | 'decrease';
  reason: string;
}

export interface PlannedExercise {
  exerciseId: string;
  /** Em exercícios unilaterais: séries por lado. */
  sets: number;
  restSec: number;
  target: Target;
  perSide?: boolean;
  /** Lado mais fraco: começa por ele e, se `extraSet`, faz uma série a mais. */
  weakSide?: Side;
  extraSet?: boolean;
  /** Avisos do dia: assimetria, músculo dolorido, tendão... */
  notes?: string[];
  /** Técnica sugerida para a última série (id de techniques.ts). */
  technique?: string;
  supersetWith?: string;
  substitutedFor?: string;
}

export interface CorrectiveItem {
  id: string;
  title: string;
  dose: string;
  how: string;
}

export interface CorrectiveBlock {
  title: string;
  minutes: number;
  disclaimer: string;
  items: CorrectiveItem[];
}

export interface Plan {
  items: PlannedExercise[];
  corrective: CorrectiveBlock | null;
  estimatedMin: number;
  rules: Rule[];
  dropped: { exerciseId: string; reason: string }[];
}

/** Agenda de trabalho do dia: define a demanda física e o gasto calórico. */
export interface WorkDay {
  sittingH: number;
  /** Turno em pé (ex.: restaurante). */
  standingH: number;
  standingStart?: string;
  standingEnd?: string;
}

/** Padrão de cada dia da semana; o check-in já nasce preenchido com ele. */
export interface WeekDay {
  /** 'auto' = segue a alternância a partir do último treino. */
  split: SplitId | 'rest' | 'auto';
  timeAvailMin: number;
  dayLoad: DayLoad;
  work?: WorkDay;
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
  corrective?: CorrectiveBlock | null;
  rules: Rule[];
  entries: SessionEntry[];
  startedAt: number;
  endedAt?: number;
}
