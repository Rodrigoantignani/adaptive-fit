import type { CarbSlot } from '../domain/dietCoach';
import type { NutritionGoal } from '../domain/energy';
import type { Meal, MealItem } from '../domain/foods';
import { round } from '../lib/format';
import type { BodyAssessment, CheckIn, Exercise, FunctionalTest, MeasureCondition, PerimeterSite, Profile, Session, SplitId, WeekDay } from '../domain/types';

export const SCHEMA_VERSION = 3;

export interface Settings {
  obsidianVault: string;
  obsidianFolder: string;
  gymName: string;
  /** Carga inicial por exercício, usada até existir histórico. */
  refLoads: Record<string, number>;
  /** Exercícios padrão que o usuário tirou da biblioteca. */
  hiddenExercises: string[];
  /** Rotina por dia da semana ("0" = domingo). */
  week: Record<string, WeekDay>;
  /** Ordem de alternância dos treinos. */
  rotation: SplitId[];
  /** Descanso entre séries que o usuário ajustou no cronômetro, por exercício. */
  learnedRest: Record<string, number>;
  nutritionGoal: NutritionGoal;
  /** Anotações livres sobre a dieta. */
  dietBase: string;
  /** Plano alimentar base: refeições com alimentos e gramas. */
  mealPlan: Meal[];
  /** O que se come a mais nos dias de turno em pé. */
  shiftExtras: MealItem[];
  /**
   * Calibração pelo peso real: "peso estável comendo este plano" ⇒
   * gasto real = ingestão; fator aplicado sobre a fórmula.
   */
  calibration: { factor: number; date: string; observedKcal: number } | null;
  /** Treina em jejum (de manhã): sem lanche pré-treino nas sugestões. */
  trainsFasted: boolean;
  /** Caminhada diária leve (ex.: passeio com o cachorro), minutos. */
  dailyWalkMin: number;
  /** Onde o usuário aceita carboidrato extra. */
  carbSlots: CarbSlot[];
  /** Carboidrato dá sono no trabalho sentado: IG baixo de dia, porção maior à noite. */
  avoidSpikes: boolean;
}

export interface AppState {
  schemaVersion: typeof SCHEMA_VERSION;
  profile: Profile | null;
  settings: Settings;
  /** Máquinas cadastradas e edições de exercícios padrão (mesmo id). */
  customExercises: Exercise[];
  checkIns: CheckIn[];
  sessions: Session[];
  assessments: BodyAssessment[];
  functionalTests: FunctionalTest[];
}

export const emptyState = (): AppState => ({
  schemaVersion: SCHEMA_VERSION,
  profile: null,
  settings: {
    obsidianVault: '',
    obsidianFolder: 'Treino',
    gymName: '',
    refLoads: {},
    hiddenExercises: [],
    week: {},
    rotation: ['upper', 'lower'],
    learnedRest: {},
    nutritionGoal: 'recomp',
    dietBase: '',
    mealPlan: [],
    shiftExtras: [],
    calibration: null,
    trainsFasted: false,
    dailyWalkMin: 0,
    carbSlots: ['preWorkout', 'breakfast', 'lunch', 'preShift', 'dinner'],
    avoidSpikes: false,
  },
  customExercises: [],
  checkIns: [],
  sessions: [],
  assessments: [],
  functionalTests: [],
});

/** v1 tinha upper_full / push / pull / legs. */
const V1_SPLIT: Record<string, SplitId> = { upper_full: 'upper', push: 'upper', pull: 'upper', legs: 'lower' };
const toSplit = (s: string): SplitId => V1_SPLIT[s] ?? (s as SplitId);

/** Formato do protótipo v2 (array de registros no localStorage). */
interface LegacyRecord {
  date: string;
  weight: number;
  condition?: string;
  bf?: number;
  sumFolds?: number;
  chest?: number;
  absUp?: number;
  absLow?: number;
  bicR?: number;
  bicL?: number;
  foreR?: number;
  foreL?: number;
  quadR?: number;
  quadL?: number;
  calfR?: number;
  calfL?: number;
}

const LEGACY_MAP: [keyof LegacyRecord, PerimeterSite][] = [
  ['chest', 'chest'],
  ['absUp', 'absUpper'],
  ['absLow', 'absLower'],
  ['bicR', 'bicepsR'],
  ['bicL', 'bicepsL'],
  ['foreR', 'forearmR'],
  ['foreL', 'forearmL'],
  ['quadR', 'thighR'],
  ['quadL', 'thighL'],
  ['calfR', 'calfR'],
  ['calfL', 'calfL'],
];

function legacyCondition(c?: string): MeasureCondition {
  if (!c) return 'other';
  if (/jejum|frio/i.test(c)) return 'fasted';
  if (/p[oó]s|pump/i.test(c)) return 'post_workout';
  return 'other';
}

export function fromLegacy(records: unknown[]): BodyAssessment[] {
  return records.map((raw) => {
    const r = raw as LegacyRecord;
    if (typeof r?.date !== 'string' || typeof r.weight !== 'number') {
      throw new Error('Registro antigo inválido: faltam "date" ou "weight".');
    }
    const perimeters: BodyAssessment['perimeters'] = {};
    for (const [from, to] of LEGACY_MAP) {
      const v = r[from];
      if (typeof v === 'number') perimeters[to] = v;
    }
    const fatKg = typeof r.bf === 'number' ? round((r.weight * r.bf) / 100) : null;
    return {
      id: `legacy-${r.date}`,
      date: r.date,
      weightKg: r.weight,
      condition: legacyCondition(r.condition),
      skinfolds: {},
      perimeters,
      result:
        fatKg !== null
          ? { protocol: 'recorded', bfPercent: r.bf!, fatKg, leanKg: round(r.weight - fatKg), sumFolds: r.sumFolds ?? 0 }
          : null,
      source: 'legacy',
    };
  });
}

export function migrate(raw: unknown): AppState {
  if (raw == null) return emptyState();
  if (Array.isArray(raw)) return { ...emptyState(), assessments: fromLegacy(raw) };
  const r = raw as Omit<Partial<AppState>, 'schemaVersion'> & { schemaVersion?: number };
  if (typeof r !== 'object' || ![1, 2, SCHEMA_VERSION].includes(r.schemaVersion ?? -1)) {
    throw new Error('Formato de dados desconhecido.');
  }
  const base = emptyState();
  const fromV1 = r.schemaVersion === 1;
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: r.profile ?? null,
    settings: {
      ...base.settings,
      ...r.settings,
      refLoads: { ...r.settings?.refLoads },
      hiddenExercises: r.settings?.hiddenExercises ?? [],
      week: r.settings?.week ?? {},
    },
    customExercises: r.customExercises ?? [],
    checkIns: fromV1 ? (r.checkIns ?? []).map((c) => ({ ...c, split: toSplit(c.split) })) : (r.checkIns ?? []),
    sessions: fromV1 ? (r.sessions ?? []).map((s) => ({ ...s, split: toSplit(s.split) })) : (r.sessions ?? []),
    assessments: r.assessments ?? [],
    functionalTests: r.functionalTests ?? [],
  };
}

export type ParsedBackup = { kind: 'full'; state: AppState } | { kind: 'legacy'; assessments: BodyAssessment[] };

export function parseBackup(text: string): ParsedBackup {
  const raw: unknown = JSON.parse(text);
  if (Array.isArray(raw)) return { kind: 'legacy', assessments: fromLegacy(raw) };
  return { kind: 'full', state: migrate(raw) };
}

/**
 * Mescla um arquivo de dados iniciais (sem treinos) no estado atual sem apagar nada:
 * o que já existe aqui vence; do arquivo entra só o que falta.
 */
export function mergeSeed(current: AppState, seed: AppState): AppState {
  const cs = current.settings;
  const ss = seed.settings;
  const defaults = emptyState().settings;
  // Preferência ainda no valor padrão = o usuário não mexeu: aceita a do arquivo.
  const pick = <K extends keyof Settings>(k: K): Settings[K] => (JSON.stringify(cs[k]) === JSON.stringify(defaults[k]) ? ss[k] : cs[k]);
  const byDate = <T extends { date: string }>(a: T[], b: T[]) => [...a, ...b.filter((x) => !a.some((y) => y.date === x.date))].sort((x, y) => x.date.localeCompare(y.date));
  return {
    ...current,
    profile: current.profile ?? seed.profile,
    settings: {
      ...cs,
      refLoads: { ...ss.refLoads, ...cs.refLoads },
      week: Object.keys(cs.week).length ? cs.week : ss.week,
      mealPlan: cs.mealPlan.length ? cs.mealPlan : ss.mealPlan,
      shiftExtras: cs.shiftExtras.length ? cs.shiftExtras : ss.shiftExtras,
      calibration: cs.calibration ?? ss.calibration,
      trainsFasted: pick('trainsFasted'),
      dailyWalkMin: pick('dailyWalkMin'),
      carbSlots: pick('carbSlots'),
      avoidSpikes: pick('avoidSpikes'),
      nutritionGoal: pick('nutritionGoal'),
      rotation: pick('rotation'),
      dietBase: cs.dietBase || ss.dietBase,
      obsidianVault: cs.obsidianVault || ss.obsidianVault,
      gymName: cs.gymName || ss.gymName,
    },
    customExercises: [...current.customExercises, ...seed.customExercises.filter((e) => !current.customExercises.some((c) => c.id === e.id))],
    assessments: byDate(current.assessments, seed.assessments),
    functionalTests: byDate(current.functionalTests, seed.functionalTests),
  };
}

/** Junta avaliações sem duplicar a mesma data. */
export function mergeAssessments(current: BodyAssessment[], incoming: BodyAssessment[]): BodyAssessment[] {
  const dates = new Set(current.map((a) => a.date));
  return [...current, ...incoming.filter((a) => !dates.has(a.date))].sort((a, b) => a.date.localeCompare(b.date));
}
