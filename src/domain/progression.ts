import { fmtKg, round } from '../lib/format';
import type { Exercise, SetLog, Target, Tier } from './types';

export interface Performance {
  date: string;
  sets: SetLog[];
}

/** 1RM estimado (Epley). */
export function e1rm(load: number, reps: number): number {
  if (reps <= 0) return 0;
  return reps === 1 ? load : load * (1 + reps / 30);
}

export const bestE1rm = (sets: SetLog[]) => Math.max(0, ...sets.map((s) => e1rm(s.load, s.reps)));

/** Séries feitas com a maior carga da sessão (as "séries de trabalho"). */
function workSets(sets: SetLog[]) {
  const load = Math.max(...sets.map((s) => s.load));
  const top = sets.filter((s) => s.load === load);
  return { load, top, minReps: Math.min(...top.map((s) => s.reps)) };
}

/**
 * Dupla progressão: sobe reps dentro da faixa; quando todas as séries
 * batem o topo, sobe a carga e volta para o piso da faixa.
 * `history` vem da sessão mais recente para a mais antiga.
 */
export function nextTarget(
  ex: Pick<Exercise, 'repMin' | 'repMax' | 'increment'>,
  history: Performance[],
  tier: Tier,
  refLoad?: number,
): Target {
  const done = history.filter((h) => h.sets.length > 0);
  const last = done[0];
  if (!last) {
    return {
      load: refLoad ?? null,
      reps: ex.repMin,
      action: 'start',
      reason:
        refLoad !== undefined
          ? `Carga de referência. Faça ${ex.repMin}–${ex.repMax} reps deixando 1–2 na reserva.`
          : ex.increment <= 0
            ? `Primeira vez: faça ${ex.repMin}–${ex.repMax} reps com 1–2 na reserva.`
            : `Primeira vez: ache a carga que permite ${ex.repMin}–${ex.repMax} reps com 1–2 na reserva.`,
    };
  }

  const { load, top, minReps } = workSets(last.sets);

  if (top.every((s) => s.reps >= ex.repMax)) {
    if (ex.increment <= 0) {
      return { load, reps: ex.repMax, action: 'hold', reason: 'Topo da faixa atingido: aumente a amplitude ou faça pausa de 2 s em cada rep.' };
    }
    if (tier === 'recover') {
      return { load, reps: ex.repMax, action: 'hold', reason: 'Pronto para subir carga, mas hoje é recuperação: mantenha.' };
    }
    return {
      load: round(load + ex.increment, 2),
      reps: ex.repMin,
      action: 'increase',
      reason: `Todas as séries no topo com ${fmtKg(load)}: suba ${fmtKg(ex.increment)} e volte para ${ex.repMin} reps.`,
    };
  }

  if (minReps < ex.repMin) {
    const prev = done[1] ? workSets(done[1].sets) : null;
    if (prev && prev.load === load && prev.minReps < ex.repMin && ex.increment > 0) {
      return {
        load: Math.max(0, round(load - ex.increment, 2)),
        reps: ex.repMin,
        action: 'decrease',
        reason: `Duas sessões abaixo de ${ex.repMin} reps com ${fmtKg(load)}: desça um degrau e reconstrua.`,
      };
    }
    return { load, reps: ex.repMin, action: 'hold', reason: `Última sessão abaixo da faixa (${minReps} reps): mantenha a carga e busque ${ex.repMin}.` };
  }

  if (tier === 'recover') {
    return { load, reps: minReps, action: 'hold', reason: `Recuperação: repita ${minReps} reps com ${fmtKg(load)}, sem forçar.` };
  }
  const reps = Math.min(ex.repMax, minReps + 1);
  return { load, reps, action: 'hold', reason: `Mesma carga; busque ${reps} reps na série mais fraca (última: ${minReps}).` };
}
