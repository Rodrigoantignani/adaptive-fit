import { round } from '../lib/format';
import type { BodyAssessment, CheckIn, MeasureCondition, PerimeterSite, Profile, Session } from '../domain/types';

export const SCHEMA_VERSION = 1;

export interface Settings {
  obsidianVault: string;
  obsidianFolder: string;
  /** Carga inicial por exercício, usada até existir histórico. */
  refLoads: Record<string, number>;
}

export interface AppState {
  schemaVersion: typeof SCHEMA_VERSION;
  profile: Profile | null;
  settings: Settings;
  checkIns: CheckIn[];
  sessions: Session[];
  assessments: BodyAssessment[];
}

export const emptyState = (): AppState => ({
  schemaVersion: SCHEMA_VERSION,
  profile: null,
  settings: { obsidianVault: '', obsidianFolder: 'Treino', refLoads: {} },
  checkIns: [],
  sessions: [],
  assessments: [],
});

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
  const r = raw as Partial<AppState>;
  if (typeof r !== 'object' || r.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('Formato de dados desconhecido.');
  }
  const base = emptyState();
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: r.profile ?? null,
    settings: { ...base.settings, ...r.settings, refLoads: { ...r.settings?.refLoads } },
    checkIns: r.checkIns ?? [],
    sessions: r.sessions ?? [],
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
