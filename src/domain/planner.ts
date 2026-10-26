import { nextTarget, type Performance } from './progression';
import type { CheckIn, Exercise, Plan, PlannedExercise, Readiness, ReadinessFlags, Rule } from './types';

const SET_WORK_SEC = 40;
const SETUP_SEC = 60;

export function exclusionReason(e: Exercise, flags: ReadinessFlags): string | null {
  if (flags.noAxial && e.axialLoad) return 'carga axial na coluna';
  if (flags.noHighCore && e.coreDemand === 'high') return 'exige muito do core';
  if (flags.machinesOnly && (e.equipment === 'free' || e.equipment === 'bodyweight')) return 'dia de máquinas guiadas';
  return null;
}

/** Duração estimada; super-séries dividem o descanso entre os dois exercícios. */
export function estimateSeconds(items: PlannedExercise[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const it of items) {
    if (seen.has(it.exerciseId)) continue;
    seen.add(it.exerciseId);
    const partner = it.supersetWith ? items.find((p) => p.exerciseId === it.supersetWith) : undefined;
    if (partner) {
      seen.add(partner.exerciseId);
      total += Math.max(it.sets, partner.sets) * (2 * SET_WORK_SEC + Math.max(it.restSec, partner.restSec)) + 2 * SETUP_SEC;
    } else {
      total += it.sets * (SET_WORK_SEC + it.restSec) + SETUP_SEC;
    }
  }
  return total;
}

export interface PlanInput {
  checkIn: CheckIn;
  readiness: Readiness;
  exercises: Exercise[];
  historyFor: (exerciseId: string) => Performance[];
  refLoads: Record<string, number>;
}

export function buildPlan({ checkIn, readiness, exercises, historyFor, refLoads }: PlanInput): Plan {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const rules: Rule[] = [...readiness.rules];
  const dropped: Plan['dropped'] = [];

  // 1. Seleção com substituição segura
  const candidates = exercises.filter((e) => e.splits.includes(checkIn.split));
  const candidateIds = new Set(candidates.map((e) => e.id));
  const chosen: { ex: Exercise; replaces?: string }[] = [];
  for (const e of candidates) {
    const why = exclusionReason(e, readiness.flags);
    if (!why) {
      chosen.push({ ex: e });
      continue;
    }
    const sub = exercises.find(
      (alt) =>
        alt.muscle === e.muscle &&
        !candidateIds.has(alt.id) &&
        !chosen.some((c) => c.ex.id === alt.id) &&
        !exclusionReason(alt, readiness.flags),
    );
    if (sub) chosen.push({ ex: sub, replaces: e.id });
    else dropped.push({ exerciseId: e.id, reason: why });
  }

  // 2. Volume, descanso e alvo de carga
  const lighter = readiness.tier === 'recover' || readiness.flags.reducedVolume;
  let items: PlannedExercise[] = chosen.map(({ ex, replaces }) => ({
    exerciseId: ex.id,
    sets: lighter ? Math.max(2, ex.sets - 1) : ex.sets,
    restSec: ex.restSec + (readiness.tier === 'recover' ? 30 : 0),
    target: nextTarget(ex, historyFor(ex.id), readiness.tier, refLoads[ex.id]),
    ...(replaces ? { substitutedFor: replaces } : {}),
  }));

  // 3. Encaixe no tempo disponível
  const budget = checkIn.timeAvailMin * 60;
  if (estimateSeconds(items) > budget) {
    let pairs = 0;
    for (const it of items) {
      if (it.supersetWith) continue;
      const ant = byId.get(it.exerciseId)?.antagonist;
      const partner = ant ? items.find((p) => p.exerciseId === ant && !p.supersetWith) : undefined;
      if (partner) {
        it.supersetWith = partner.exerciseId;
        partner.supersetWith = it.exerciseId;
        pairs++;
      }
    }
    // parceiro logo em seguida
    const ordered: PlannedExercise[] = [];
    for (const it of items) {
      if (ordered.includes(it)) continue;
      ordered.push(it);
      const partner = it.supersetWith ? items.find((p) => p.exerciseId === it.supersetWith) : undefined;
      if (partner && !ordered.includes(partner)) ordered.push(partner);
    }
    items = ordered;

    let setsCut = 0;
    for (let i = items.length - 1; i >= 0 && estimateSeconds(items) > budget; i--) {
      while (items[i].sets > 2 && estimateSeconds(items) > budget) {
        items[i].sets--;
        setsCut++;
      }
    }

    let exCut = 0;
    while (items.length > 2 && estimateSeconds(items) > budget) {
      const removed = items.pop()!;
      const partner = removed.supersetWith ? items.find((p) => p.exerciseId === removed.supersetWith) : undefined;
      if (partner) delete partner.supersetWith;
      dropped.push({ exerciseId: removed.exerciseId, reason: 'não cabe no tempo' });
      exCut++;
    }

    const parts = [
      pairs ? `${pairs} super-série(s) de antagonistas` : '',
      setsCut ? `${setsCut} série(s) a menos` : '',
      exCut ? `${exCut} exercício(s) fora` : '',
    ].filter(Boolean);
    rules.push({
      id: 'time',
      tone: 'info',
      title: 'Alta densidade',
      detail: `Para caber em ${checkIn.timeAvailMin} min: ${parts.join(', ') || 'ritmo acelerado'}. Em super-série, descanse só depois do segundo exercício.`,
    });
  }

  return { items, estimatedMin: Math.round(estimateSeconds(items) / 60), rules, dropped };
}
