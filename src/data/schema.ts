import { round } from '../lib/format';
import type { BodyAssessment, CheckIn, Exercise, MeasureCondition, PerimeterSite, Profile, Session, SplitId, WeekDay } from '../domain/types';

export const SCHEMA_VERSION = 2;

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
  },
  customExercises: [],
  checkIns: [],
  sessions: [],
  assessments: [],
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
  if (typeof r !== 'object' || (r.schemaVersion !== 1 && r.schemaVersion !== SCHEMA_VERSION)) {
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
  };
}

export type ParsedBackup = { kind: 'full'; state: AppState } | { kind: 'legacy'; assessments: BodyAssessment[] };

export function parseBackup(text: string): ParsedBackup {
  const raw: unknown = JSON.parse(text);
  if (Array.isArray(raw)) return { kind: 'legacy', assessments: fromLegacy(raw) };
  return { kind: 'full', state: migrate(raw) };
}

/** Junta avaliações sem duplicar a mesma data. */
export function mergeAssessments(current: BodyAssessment[], incoming: BodyAssessment[]): BodyAssessment[] {
  const dates = new Set(current.map((a) => a.date));
  return [...current, ...incoming.filter((a) => !dates.has(a.date))].sort((a, b) => a.date.localeCompare(b.date));
}
