import { daysBetween, weekStart } from '../lib/date';
import { round } from '../lib/format';
import { exerciseById } from './exercises';
import { bestE1rm, type Performance } from './progression';
import type { Exercise, Muscle, Session, SetLog, SplitId } from './types';

const finishedDesc = (sessions: Session[]) =>
  sessions.filter((s) => s.endedAt).sort((a, b) => b.startedAt - a.startedAt);

/** Desempenho do exercício, da sessão finalizada mais recente para a mais antiga. */
export function performanceHistory(sessions: Session[], exerciseId: string): Performance[] {
  return finishedDesc(sessions)
    .map((s) => ({ date: s.date, sets: s.entries.find((e) => e.exerciseId === exerciseId)?.sets ?? [] }))
    .filter((p) => p.sets.length > 0);
}

/**
 * Tonelagem; carga "por lado" conta os dois lados.
 * Assistida: o trabalho é o peso corporal menos a ajuda (0 se o peso é desconhecido).
 */
export function setVolume(set: SetLog, ex: Pick<Exercise, 'loadUnit' | 'loadMode'> | undefined, bodyweightKg?: number): number {
  if (ex?.loadMode === 'assisted') return Math.max(0, (bodyweightKg ?? 0) - set.load) * set.reps;
  return set.load * set.reps * (ex?.loadUnit === 'kg/lado' ? 2 : 1);
}

export function sessionTotals(session: Session, bodyweightKg?: number) {
  let sets = 0;
  let volume = 0;
  for (const entry of session.entries) {
    const ex = exerciseById(entry.exerciseId);
    for (const st of entry.sets) {
      sets++;
      volume += setVolume(st, ex, bodyweightKg);
    }
  }
  const minutes = session.endedAt ? Math.round((session.endedAt - session.startedAt) / 60_000) : 0;
  return { sets, volume: Math.round(volume), minutes };
}

/** Melhor 1RM estimado de cada lado na sessão mais recente com séries por lado. */
export function lastSideStrength(sessions: Session[], exerciseId: string): { L: number; R: number } | null {
  for (const s of finishedDesc(sessions)) {
    // Série máxima do lado fraco fica de fora: a comparação é entre séries equivalentes.
    const sets = s.entries.find((e) => e.exerciseId === exerciseId)?.sets.filter((x) => x.side && !x.amrap) ?? [];
    if (!sets.length) continue;
    return { L: bestE1rm(sets.filter((x) => x.side === 'L')), R: bestE1rm(sets.filter((x) => x.side === 'R')) };
  }
  return null;
}

/**
 * Séries semanais por músculo principal (unilateral: E + D = 1 série).
 * Referência de hipertrofia: ~10–20 séries/semana por músculo.
 */
export function weeklySetsByMuscle(sessions: Session[], weekStartIso: string): Map<Muscle, number> {
  const out = new Map<Muscle, number>();
  for (const s of sessions) {
    if (!s.endedAt || weekStart(s.date) !== weekStartIso) continue;
    for (const e of s.entries) {
      const ex = exerciseById(e.exerciseId);
      if (!ex || !e.sets.length) continue;
      const n = e.sets.reduce((a, st) => a + (st.side ? 0.5 : 1), 0);
      out.set(ex.muscle, (out.get(ex.muscle) ?? 0) + n);
    }
  }
  return out;
}

/** Séries máximas do lado fraco por exercício (mais antiga → mais recente): o termômetro da correção. */
export function amrapHistory(sessions: Session[]) {
  const out = new Map<string, { date: string; load: number; reps: number; side?: 'L' | 'R' }[]>();
  for (const s of [...finishedDesc(sessions)].reverse()) {
    for (const e of s.entries) {
      for (const st of e.sets.filter((x) => x.amrap)) {
        out.set(e.exerciseId, [...(out.get(e.exerciseId) ?? []), { date: s.date, load: st.load, reps: st.reps, side: st.side }]);
      }
    }
  }
  return out;
}

/** Recordes de 1RM estimado batidos nesta sessão contra todas as anteriores. */
export function sessionRecords(session: Session, all: Session[]) {
  const before = all.filter((s) => s.endedAt && s.id !== session.id && s.startedAt < session.startedAt);
  return session.entries.flatMap((entry) => {
    if (!entry.sets.length || exerciseById(entry.exerciseId)?.loadMode === 'assisted') return [];
    const now = bestE1rm(entry.sets);
    const prevSets = before.flatMap((s) => s.entries.find((e) => e.exerciseId === entry.exerciseId)?.sets ?? []);
    if (!prevSets.length) return [];
    const prev = bestE1rm(prevSets);
    return now > prev ? [{ exerciseId: entry.exerciseId, e1rm: round(now), previous: round(prev) }] : [];
  });
}

/** Rotação fixa (ex.: Superior ↔ Inferior): o próximo depois do último treinado. */
export function nextInRotation(sessions: Session[], rotation: SplitId[]): SplitId {
  const last = finishedDesc(sessions).find((s) => rotation.includes(s.split));
  if (!last) return rotation[0];
  return rotation[(rotation.indexOf(last.split) + 1) % rotation.length];
}

/** Sugere o split treinado há mais tempo (nunca treinado vence). */
export function suggestSplit(sessions: Session[], today: string, order: SplitId[]): { split: SplitId; daysAgo: number | null } {
  let best: { split: SplitId; daysAgo: number | null } = { split: order[0], daysAgo: -1 };
  for (const split of order) {
    const last = finishedDesc(sessions).find((s) => s.split === split);
    if (!last) return { split, daysAgo: null };
    const days = daysBetween(last.date, today);
    if (best.daysAgo === null || days > best.daysAgo) best = { split, daysAgo: days };
  }
  return best;
}
