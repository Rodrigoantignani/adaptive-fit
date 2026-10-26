import { fmtNum } from '../lib/format';
import { analyzeAsymmetry } from './asymmetry';
import { correctiveBlock } from './correctives';
import { exerciseById } from './exercises';
import type { FunctionalFlags } from './functional';
import { SIDE_LABEL } from './labels';
import { nextTarget, type Performance } from './progression';
import { suggestTechniques } from './techniques';
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
  SorenessArea,
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

/** Em super-série, estes vêm primeiro (puxar antes de empurrar; flexores antes de extensores). */
const PULL_MUSCLES: Muscle[] = ['back', 'rear_delt', 'biceps', 'hamstrings'];

const splitTrains = (split: SplitId, m: Muscle) => SPLIT_MUSCLES[split] === 'all' || (SPLIT_MUSCLES[split] as Muscle[]).includes(m);

const SORE_MUSCLES: Partial<Record<SorenessArea, Muscle[]>> = {
  chest: ['chest'],
  back: ['back', 'rear_delt'],
  shoulders: ['front_delt', 'side_delt', 'rear_delt'],
  arms: ['biceps', 'triceps', 'forearm'],
  legs: ['quads', 'hamstrings', 'calves'],
};

export function exclusionReason(e: Exercise, flags: ReadinessFlags): string | null {
  if (flags.ankleLevel >= 1 && e.ankleLoad === 'high') return 'carga alta no tendão de Aquiles';
  if (flags.ankleLevel === 2 && e.ankleLoad === 'moderate') return 'dorsiflexão com carga (tendão dolorido)';
  if (flags.noAxial && e.axialLoad) return 'carga axial na coluna';
  if (flags.noHighCore && e.coreDemand === 'high') return 'exige muito do core';
  if (flags.machinesOnly && (e.equipment === 'free' || e.equipment === 'bodyweight')) return 'dia de máquinas guiadas';
  return null;
}

const addNote = (it: PlannedExercise, note: string) => {
  it.notes = [...(it.notes ?? []), note];
};

/** Segura a progressão: nada de subir carga hoje (volta ao degrau anterior). */
const holdLoad = (it: PlannedExercise, reason: string) => {
  if (it.target.action !== 'increase') return;
  const ex = exerciseById(it.exerciseId);
  const step = (ex?.increment ?? 0) * (ex?.loadMode === 'assisted' ? -1 : 1);
  it.target = {
    ...it.target,
    load: it.target.load === null ? null : Math.max(0, it.target.load - step),
    reps: ex?.repMax ?? it.target.reps,
    action: 'hold',
    reason,
  };
};

/** Total de séries executadas (unilateral conta os dois lados + a extra). */
export const setCount = (it: PlannedExercise) => (it.perSide ? it.sets * 2 : it.sets) + (it.extraSet ? 1 : 0);

/** A próxima série é a extra do lado fraco (máximo de reps)? */
export function isAmrapNext(sets: SetLog[], item: PlannedExercise): boolean {
  if (!item.perSide || !item.extraSet || !item.weakSide) return false;
  const weak = item.weakSide;
  const count = (s: Side) => sets.filter((x) => x.side === s).length;
  return count(weak) === item.sets && count(weak === 'L' ? 'R' : 'L') >= item.sets;
}

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
  profile?: Pick<Profile, 'scoliosis' | 'achilles'> | null;
  /** Perímetros da avaliação mais recente com medidas bilaterais. */
  perimeters?: Partial<Record<PerimeterSite, number>>;
  /** Melhor 1RM estimado de cada lado na última sessão unilateral. */
  sideStrength?: (exerciseId: string) => { L: number; R: number } | null;
  /** Descanso que o usuário ajustou no cronômetro e o app aprendeu. */
  learnedRest?: Record<string, number>;
  /** Achados da última avaliação funcional. */
  functional?: FunctionalFlags;
  reassess?: { due: boolean; days: number | null };
}

export function buildPlan({
  checkIn,
  readiness,
  exercises,
  historyFor,
  refLoads,
  profile,
  perimeters,
  sideStrength,
  learnedRest,
  functional,
  reassess,
}: PlanInput): Plan {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const { flags, tier } = readiness;
  const rules: Rule[] = [...readiness.rules];
  const dropped: Plan['dropped'] = [];
  const lighter = tier === 'recover' || flags.reducedVolume;
  const priority = new Map<string, number>();

  const toItem = (ex: Exercise): PlannedExercise => ({
    exerciseId: ex.id,
    sets: lighter ? Math.max(2, ex.sets - 1) : ex.sets,
    restSec: (learnedRest?.[ex.id] ?? ex.restSec) + (tier === 'recover' ? 30 : 0),
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
    addNote(target, `${a.label}: Δ ${fmtNum(a.diffCm)} cm (${fmtNum(a.diffPct)}%). Comece pelo lado ${side}${target.extraSet ? ' e termine com 1 série extra só nele, no máximo de reps' : ''}.`);
    notes.push(`${a.label.toLowerCase()} ${side} ${fmtNum(a.diffPct)}% menor`);
  }

  // 2b. Força por lado nos unilaterais (quando a medida não definiu o lado)
  for (const it of items) {
    if (!it.perSide || it.weakSide) continue;
    const s = sideStrength?.(it.exerciseId);
    if (!s || !s.L || !s.R) continue;
    const pct = (Math.abs(s.L - s.R) / Math.max(s.L, s.R)) * 100;
    if (pct < 3) continue;
    it.weakSide = s.L < s.R ? 'L' : 'R';
    it.extraSet = pct >= 5;
    addNote(it, `Força: E ${fmtNum(Math.round(s.L))} × D ${fmtNum(Math.round(s.R))} (${fmtNum(Math.round(pct))}%). Comece pelo ${SIDE_LABEL[it.weakSide]}${it.extraSet ? ' e termine com 1 série extra nele, no máximo de reps' : ''}.`);
    notes.push(`força ${SIDE_LABEL[it.weakSide]} ${fmtNum(Math.round(pct))}% menor em ${byId.get(it.exerciseId)?.name.toLowerCase()}`);
  }

  // 2b'. Avaliação funcional: dorsal fraco, ombro limitado, panturrilha mais fraca
  if (functional?.latWeak && splitTrains(checkIn.split, 'back')) {
    const s = functional.latWeak;
    let target = items.find((it) => it.perSide && byId.get(it.exerciseId)?.muscle === 'back');
    if (!target) {
      const pick = exercises.find((e) => e.unilateral && e.muscle === 'back' && !exclusionReason(e, flags) && !items.some((i) => i.exerciseId === e.id));
      if (pick) {
        target = { ...toItem(pick), sets: 2 };
        items.push(target);
        priority.set(pick.id, 2);
      }
    }
    if (target) {
      target.weakSide = s;
      target.extraSet = true;
      addNote(target, `Dorsal ${SIDE_LABEL[s]} pouco ativo (avaliação funcional): comece por ele, pausa de 2 s na contração e, no fim, 1 série extra só nele no máximo de reps.`);
      notes.push(`dorsal ${SIDE_LABEL[s]} pouco ativo`);
    }
  }
  for (const it of items) {
    const ex = byId.get(it.exerciseId)!;
    if (ex.muscle === 'front_delt' && functional?.overheadLimited.length) {
      addNote(it, `Braço ${functional.overheadLimited.map((s) => SIDE_LABEL[s]).join(' e ')} não sobe completo: pare na amplitude confortável, sem arquear a lombar.`);
    }
    if (ex.muscle === 'calves' && functional?.calfDeficit) {
      if (it.perSide && !it.weakSide) it.weakSide = functional.calfDeficit;
      addNote(it, `Panturrilha ${SIDE_LABEL[functional.calfDeficit]} mais fraca: comece por ela e iguale as reps.`);
    }
  }
  // O lado forte não ganha volume: repete as reps que o fraco conseguiu.
  for (const it of items) if (it.weakSide) addNote(it, `O lado ${SIDE_LABEL[it.weakSide === 'L' ? 'R' : 'L']} faz as mesmas reps que o ${SIDE_LABEL[it.weakSide]} conseguiu, não mais.`);

  // 2c. Músculos doloridos e tendão
  const sore = new Set(checkIn.soreness.flatMap((a) => SORE_MUSCLES[a] ?? []));
  const tendon = profile?.achilles ? (checkIn.tendonPain ?? 0) : 0;
  const tendonWorse = Boolean(profile?.achilles && checkIn.tendonWorse);
  const maintenance: string[] = [];
  for (const it of items) {
    const ex = byId.get(it.exerciseId)!;
    if (sore.has(ex.muscle)) {
      if (!lighter) it.sets = Math.max(2, it.sets - 1);
      holdLoad(it, 'Músculo dolorido hoje: manutenção, sem subir carga.');
      addNote(it, 'Dolorido hoje: uma série a menos e carga mantida.');
      maintenance.push(ex.name);
    }
    if (flags.ankleLevel >= 1 && ex.ankleLoad === 'moderate') {
      addNote(it, 'Tendão: calcanhar nunca abaixo do neutro; no leg press, pés mais altos na plataforma.');
      if (tendon >= 3) holdLoad(it, `Tendão ${tendon}/10: carga mantida até a dor baixar.`);
    }
  }
  if (maintenance.length) {
    rules.push({
      id: 'recovery',
      tone: 'info',
      title: 'Músculos doloridos',
      detail: `Em manutenção hoje: ${maintenance.join(', ')}. Treinar dolorido no limite só acumula fadiga.`,
    });
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

  if (reassess?.due) {
    rules.push({
      id: 'reassess',
      tone: 'info',
      title: reassess.days === null ? 'Faça sua avaliação funcional' : 'Hora de reavaliar',
      detail:
        reassess.days === null
          ? 'Leva 10 minutos (Corpo → Avaliação funcional): tornozelos, ombros, panturrilhas, dorsal e fotos posturais. O plano passa a corrigir o que os testes mostrarem.'
          : `A última avaliação funcional foi há ${reassess.days} dias. Refaça os testes para ver se as correções estão funcionando.`,
    });
  }

  // 3. Encaixe no tempo disponível (descontando o aquecimento corretivo)
  const corrective = correctiveBlock(profile, tendonWorse ? Math.max(tendon, 5) : tendon, functional);
  const budget = (checkIn.timeAvailMin - (corrective?.minutes ?? 0)) * 60;
  let timeTight = false;
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
    // Par lado a lado, puxada primeiro: retrair a escápula antes de empurrar.
    const pullsFirst = (a: PlannedExercise, b: PlannedExercise) => {
      const pa = PULL_MUSCLES.includes(byId.get(a.exerciseId)!.muscle);
      const pb = PULL_MUSCLES.includes(byId.get(b.exerciseId)!.muscle);
      return pb && !pa ? [b, a] : [a, b];
    };
    const ordered: PlannedExercise[] = [];
    for (const it of items) {
      if (ordered.includes(it)) continue;
      const partner = it.supersetWith ? items.find((p) => p.exerciseId === it.supersetWith) : undefined;
      if (partner && !ordered.includes(partner)) ordered.push(...pullsFirst(it, partner));
      else ordered.push(it);
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

    timeTight = setsCut > 0 || exCut > 0;
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

  suggestTechniques(items, byId, readiness, timeTight);

  return {
    items,
    corrective,
    estimatedMin: Math.round(estimateSeconds(items) / 60) + (corrective?.minutes ?? 0),
    rules,
    dropped,
  };
}
