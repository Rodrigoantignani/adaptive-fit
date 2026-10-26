import { daysBetween } from '../lib/date';
import { round } from '../lib/format';
import { exerciseById } from './exercises';
import { bestE1rm, type Performance } from './progression';
import type { Exercise, Session, SetLog, SplitId } from './types';

const finishedDesc = (sessions: Session[]) =>
  sessions.filter((s) => s.endedAt).sort((a, b) => b.startedAt - a.startedAt);

/** Desempenho do exercício, da sessão finalizada mais recente para a mais antiga. */
export function performanceHistory(sessions: Session[], exerciseId: string): Performance[] {
  return finishedDesc(sessions)
    .map((s) => ({ date: s.date, sets: s.entries.find((e) => e.exerciseId === exerciseId)?.sets ?? [] }))
    .filter((p) => p.sets.length > 0);
}

/** Tonelagem; carga "por lado" conta os dois lados. */
export function setVolume(set: SetLog, ex: Pick<Exercise, 'loadUnit'> | undefined): number {
  return set.load * set.reps * (ex?.loadUnit === 'kg/lado' ? 2 : 1);
}

export function sessionTotals(session: Session) {
  let sets = 0;
  let volume = 0;
  for (const entry of session.entries) {
    const ex = exerciseById(entry.exerciseId);
    for (const st of entry.sets) {
      sets++;
      volume += setVolume(st, ex);
    }
  }
  const minutes = session.endedAt ? Math.round((session.endedAt - session.startedAt) / 60_000) : 0;
  return { sets, volume: Math.round(volume), minutes };
}

/** Recordes de 1RM estimado batidos nesta sessão contra todas as anteriores. */
export function sessionRecords(session: Session, all: Session[]) {
  const before = all.filter((s) => s.endedAt && s.id !== session.id && s.startedAt < session.startedAt);
  return session.entries.flatMap((entry) => {
    if (!entry.sets.length) return [];
    const now = bestE1rm(entry.sets);
    const prevSets = before.flatMap((s) => s.entries.find((e) => e.exerciseId === entry.exerciseId)?.sets ?? []);
    if (!prevSets.length) return [];
    const prev = bestE1rm(prevSets);
    return now > prev ? [{ exerciseId: entry.exerciseId, e1rm: round(now), previous: round(prev) }] : [];
  });
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
