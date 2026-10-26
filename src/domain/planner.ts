import { fmtNum } from '../lib/format';
import { analyzeAsymmetry } from './asymmetry';
import { correctiveBlock } from './correctives';
import { SIDE_LABEL } from './labels';
import { nextTarget, type Performance } from './progression';
import type {
  CheckIn,
  Exercise,
  Muscle,
  PerimeterSite,
  Plan,
  PlannedExercise,
  Profile,
  Readiness,
  ReadinessFlags,
  Rule,
  SetLog,
  Side,
  SplitId,
} from './types';

const SET_WORK_SEC = 40;
const SETUP_SEC = 60;

const SPLIT_MUSCLES: Record<SplitId, Muscle[] | 'all'> = {
  full_body: 'all',
  upper: ['chest', 'back', 'front_delt', 'side_delt', 'rear_delt', 'biceps', 'triceps', 'forearm', 'core'],
  lower: ['quads', 'hamstrings', 'calves', 'core'],
};

const PAIR_MUSCLE: Record<string, Muscle> = { biceps: 'biceps', forearm: 'forearm', thigh: 'quads', calf: 'calves' };

const splitTrains = (split: SplitId, m: Muscle) => SPLIT_MUSCLES[split] === 'all' || (SPLIT_MUSCLES[split] as Muscle[]).includes(m);

export function exclusionReason(e: Exercise, flags: ReadinessFlags): string | null {
  if (flags.noAxial && e.axialLoad) return 'carga axial na coluna';
  if (flags.noHighCore && e.coreDemand === 'high') return 'exige muito do core';
  if (flags.machinesOnly && (e.equipment === 'free' || e.equipment === 'bodyweight')) return 'dia de máquinas guiadas';
  return null;
}

/** Total de séries executadas (unilateral conta os dois lados + a extra). */
export const setCount = (it: PlannedExercise) => (it.perSide ? it.sets * 2 : it.sets) + (it.extraSet ? 1 : 0);

/** Unilateral: lado fraco primeiro, alterna, e a série extra fica para o fim. */
export function nextSide(sets: SetLog[], item: PlannedExercise): Side {
  const weak = item.weakSide ?? 'L';
  const strong: Side = weak === 'L' ? 'R' : 'L';
  const count = (s: Side) => sets.filter((x) => x.side === s).length;
  const goal = (s: Side) => item.sets + (item.extraSet && s === weak ? 1 : 0);
  if (count(weak) < goal(weak) && (count(weak) <= count(strong) || count(strong) >= goal(strong))) return weak;
  return count(strong) < goal(strong) ? strong : weak;
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
      total += Math.max(setCount(it), setCount(partner)) * (2 * SET_WORK_SEC + Math.max(it.restSec, partner.restSec)) + 2 * SETUP_SEC;
    } else {
      total += setCount(it) * (SET_WORK_SEC + it.restSec) + SETUP_SEC;
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
  profile?: Pick<Profile, 'scoliosis'> | null;
  /** Perímetros da avaliação mais recente com medidas bilaterais. */
  perimeters?: Partial<Record<PerimeterSite, number>>;
}

export function buildPlan({ checkIn, readiness, exercises, historyFor, refLoads, profile, perimeters }: PlanInput): Plan {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const { flags, tier } = readiness;
  const rules: Rule[] = [...readiness.rules];
  const dropped: Plan['dropped'] = [];
  const lighter = tier === 'recover' || flags.reducedVolume;
  const priority = new Map<string, number>();

  const toItem = (ex: Exercise): PlannedExercise => ({
    exerciseId: ex.id,
    sets: lighter ? Math.max(2, ex.sets - 1) : ex.sets,
    restSec: ex.restSec + (tier === 'recover' ? 30 : 0),
    target: nextTarget(ex, historyFor(ex.id), tier, refLoads[ex.id]),
    ...(ex.unilateral ? { perSide: true } : {}),
  });

  // 1. Seleção por prioridade, com substituição segura
  const candidates = exercises.filter((e) => e.splits.includes(checkIn.split)).sort((a, b) => a.priority - b.priority);
  const candidateIds = new Set(candidates.map((e) => e.id));
  let items: PlannedExercise[] = [];
  for (const e of candidates) {
    const why = exclusionReason(e, flags);
    if (!why) {
      items.push(toItem(e));
      priority.set(e.id, e.priority);
      continue;
    }
    const sub = exercises.find(
      (alt) => alt.muscle === e.muscle && !candidateIds.has(alt.id) && !items.some((i) => i.exerciseId === alt.id) && !exclusionReason(alt, flags),
    );
    if (sub) {
      items.push({ ...toItem(sub), substitutedFor: e.id });
      priority.set(sub.id, e.priority);
    } else {
      dropped.push({ exerciseId: e.id, reason: why });
    }
  }

  // 2. Assimetrias: lado fraco primeiro e, se relevante, unilateral extra
  const notes: string[] = [];
  for (const a of perimeters ? analyzeAsymmetry(perimeters) : []) {
    if (a.level === 'ok' || !a.smaller) continue;
    const muscle = PAIR_MUSCLE[a.key];
    if (!splitTrains(checkIn.split, muscle)) continue;
    let target = items.find((it) => it.perSide && byId.get(it.exerciseId)?.muscle === muscle);
    if (!target && a.level === 'act') {
      const pick = exercises.find(
        (e) => e.unilateral && e.muscle === muscle && !exclusionReason(e, flags) && !items.some((i) => i.exerciseId === e.id),
      );
      if (pick) {
        target = { ...toItem(pick), sets: 2 };
        items.push(target);
        priority.set(pick.id, 2);
      }
    }
    if (!target) continue;
    const side = SIDE_LABEL[a.smaller];
    target.weakSide = a.smaller;
    target.extraSet = a.level === 'act';
    target.note = `${a.label}: Δ ${fmtNum(a.diffCm)} cm (${fmtNum(a.diffPct)}%). Comece pelo lado ${side}${target.extraSet ? ' e faça 1 série extra só nele' : ''}.`;
    notes.push(`${a.label.toLowerCase()} ${side} ${fmtNum(a.diffPct)}% menor`);
  }
  if (notes.length) {
    rules.push({
      id: 'asymmetry',
      tone: 'info',
      title: 'Correção de assimetria',
      detail: `Pela última avaliação: ${notes.join(', ')}. Os unilaterais do plano começam pelo lado mais fraco.`,
    });
  }

  // Ordem estável por prioridade (inseridos por assimetria entram como prioridade 2)
  items = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (priority.get(a.it.exerciseId) ?? 2) - (priority.get(b.it.exerciseId) ?? 2) || a.i - b.i)
    .map(({ it }) => it);

  // 3. Encaixe no tempo disponível (descontando o aquecimento corretivo)
  const corrective = correctiveBlock(profile);
  const budget = (checkIn.timeAvailMin - (corrective?.minutes ?? 0)) * 60;
  if (estimateSeconds(items) > budget) {
    let pairs = 0;
    for (const it of items) {
      if (it.supersetWith || it.perSide) continue;
      const ant = byId.get(it.exerciseId)?.antagonist;
      const partner = ant ? items.find((p) => p.exerciseId === ant && !p.supersetWith && !p.perSide) : undefined;
      if (partner) {
        it.supersetWith = partner.exerciseId;
        partner.supersetWith = it.exerciseId;
        pairs++;
      }
    }
    const ordered: PlannedExercise[] = [];
    for (const it of items) {
      if (ordered.includes(it)) continue;
      ordered.push(it);
      const partner = it.supersetWith ? items.find((p) => p.exerciseId === it.supersetWith) : undefined;
      if (partner && !ordered.includes(partner)) ordered.push(partner);
    }
    items = ordered;

    // Corte em camadas: acessórios perdem séries, depois saem; só então a base encolhe.
    const prio = (it: PlannedExercise) => priority.get(it.exerciseId) ?? 2;
    const over = () => estimateSeconds(items) > budget;
    let setsCut = 0;
    let exCut = 0;
    const trimSets = (eligible: (it: PlannedExercise) => boolean) => {
      for (let i = items.length - 1; i >= 0 && over(); i--) {
        while (eligible(items[i]) && items[i].sets > 2 && over()) {
          items[i].sets--;
          setsCut++;
        }
      }
    };
    // Super-série sai inteira: não deixa bíceps sem tríceps.
    const dropWhere = (eligible: (it: PlannedExercise) => boolean) => {
      for (let i = items.length - 1; i >= 0 && over() && items.length > 2; i--) {
        if (!items[i] || !eligible(items[i])) continue;
        const removed = items[i];
        const out = new Set([removed.exerciseId, ...(removed.supersetWith ? [removed.supersetWith] : [])]);
        if (items.length - out.size < 2) continue;
        items = items.filter((it) => !out.has(it.exerciseId));
        for (const id of out) dropped.push({ exerciseId: id, reason: 'não cabe no tempo' });
        exCut += out.size;
      }
    };
    trimSets((it) => prio(it) === 3);
    dropWhere((it) => prio(it) === 3);
    trimSets(() => true);
    dropWhere(() => true);

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

  return {
    items,
    corrective,
    estimatedMin: Math.round(estimateSeconds(items) / 60) + (corrective?.minutes ?? 0),
    rules,
    dropped,
  };
}
