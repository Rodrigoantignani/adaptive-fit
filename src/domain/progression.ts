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
  ex: Pick<Exercise, 'repMin' | 'repMax' | 'increment'> & Partial<Pick<Exercise, 'loadMode'>>,
  history: Performance[],
  tier: Tier,
  refLoad?: number,
): Target {
  if (ex.loadMode === 'assisted') return assistedTarget(ex, history, tier, refLoad);
  const t = normalTarget(ex, history, tier, refLoad);
  return t.load !== null && t.load < 0 ? { ...t, load: 0 } : t;
}

/**
 * Máquina com contrapeso: a "carga" registrada é ajuda. Roda a mesma dupla progressão
 * com a ajuda negativa (menos ajuda = mais difícil) e reescreve as mensagens.
 */
function assistedTarget(ex: Pick<Exercise, 'repMin' | 'repMax' | 'increment'>, history: Performance[], tier: Tier, refLoad?: number): Target {
  const flipped = history.map((h) => ({ ...h, sets: h.sets.map((s) => ({ ...s, load: -s.load })) }));
  const t = normalTarget(ex, flipped, tier, refLoad === undefined ? undefined : -refLoad);
  const help = t.load === null ? null : Math.max(0, -t.load);
  const prev = t.action === 'increase' ? help! + ex.increment : t.action === 'decrease' ? help! - ex.increment : help;
  const reasons: Record<Target['action'], string> = {
    start: `Escolha a ajuda que permite ${ex.repMin}–${ex.repMax} reps com 1–2 na reserva.`,
    increase:
      help === 0
        ? 'Ajuda zerada: na próxima, troque pela barra fixa livre (edite em Máquinas).'
        : `Todas as séries no topo com ${fmtKg(prev ?? 0)} de ajuda: tire ${fmtKg(ex.increment)} e volte para ${ex.repMin} reps.`,
    hold: t.reason
      .replace(/com -?([\d.,]+) kg/g, 'com $1 kg de ajuda')
      .replace('Mesma carga', 'Mesma ajuda')
      .replace('mantenha a carga', 'mantenha a ajuda')
      .replace('Pronto para subir carga', 'Pronto para tirar ajuda'),
    decrease: `Duas sessões abaixo de ${ex.repMin} reps: coloque ${fmtKg(ex.increment)} a mais de ajuda e reconstrua.`,
  };
  return { ...t, load: help, reason: reasons[t.action] };
}

function normalTarget(
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
        load: round(load - ex.increment, 2),
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
