import type { Exercise } from './types';

type Base = Omit<Exercise, 'id' | 'name' | 'muscle'>;

const BASE: Base = {
  splits: [],
  priority: 2,
  unilateral: false,
  equipment: 'machine',
  loadUnit: 'kg',
  increment: 2.5,
  repMin: 8,
  repMax: 12,
  sets: 3,
  restSec: 90,
  axialLoad: false,
  coreDemand: 'low',
  ankleLoad: 'none',
  loadMode: 'normal',
};

export const newExercise = (e: Pick<Exercise, 'id' | 'name' | 'muscle'> & Partial<Base>): Exercise => ({ ...BASE, ...e });

/** Completa campos que não existiam quando a máquina foi cadastrada. */
const normalize = (e: Exercise): Exercise => ({ ...BASE, ...e });
const ex = newExercise;

/**
 * Biblioteca padrão. Dentro da mesma prioridade, a ordem do array decide.
 * Exercícios com `splits: []` existem como substitutos seguros ou para corrigir assimetrias.
 */
export const DEFAULT_EXERCISES: Exercise[] = [
  // Prioridade 1: base do treino. Superior abre com costas.
  ex({ id: 'pullup_assisted', name: 'Barra fixa assistida (contrapeso)', muscle: 'back', splits: ['upper'], priority: 1, loadMode: 'assisted', increment: 5, repMin: 6, repMax: 10, restSec: 90, cue: 'Carga = ajuda do contrapeso. Progredir é tirar ajuda; zerou, passe para a barra livre.' }),
  ex({ id: 'incline_chest_machine', name: 'Supino inclinado máquina', muscle: 'chest', splits: ['full_body', 'upper'], priority: 1, loadUnit: 'kg/lado', repMax: 10, restSec: 120, antagonist: 'seated_row_machine' }),
  ex({ id: 'seated_row_machine', name: 'Remada sentada máquina', muscle: 'back', splits: ['full_body', 'upper'], priority: 1, increment: 5, antagonist: 'incline_chest_machine', cue: 'Peito apoiado, puxe com os cotovelos.' }),
  ex({ id: 'leg_press_45', name: 'Leg press 45°', muscle: 'quads', splits: ['full_body', 'lower'], priority: 1, increment: 10, repMin: 10, restSec: 120, ankleLoad: 'moderate', cue: 'Quadril colado no banco do início ao fim.' }),
  ex({ id: 'back_squat', name: 'Agachamento livre', muscle: 'quads', splits: ['lower'], priority: 1, equipment: 'free', repMin: 6, repMax: 10, restSec: 150, axialLoad: true, coreDemand: 'high', ankleLoad: 'moderate' }),
  ex({ id: 'pullup', name: 'Barra fixa livre', muscle: 'back', priority: 1, equipment: 'bodyweight', repMin: 6, repMax: 10, restSec: 90, coreDemand: 'high', cue: 'Desça controlando pelas escápulas, sem balanço. Carga = lastro.' }),

  // Prioridade 2
  ex({ id: 'lat_pulldown', name: 'Puxada alta', muscle: 'back', splits: ['full_body'], equipment: 'cable', increment: 5 }),
  ex({ id: 'shoulder_press_machine', name: 'Desenvolvimento máquina', muscle: 'front_delt', splits: ['full_body', 'upper'], loadUnit: 'kg/lado', repMax: 10, restSec: 120, cue: 'Costas coladas no encosto.' }),
  ex({ id: 'romanian_deadlift', name: 'Stiff (barra)', muscle: 'hamstrings', splits: ['lower'], equipment: 'free', repMax: 10, restSec: 120, axialLoad: true, coreDemand: 'high' }),
  ex({ id: 'lying_leg_curl', name: 'Mesa flexora', muscle: 'hamstrings', splits: ['full_body', 'lower'], increment: 5, repMin: 10, restSec: 75, antagonist: 'leg_extension' }),
  ex({ id: 'leg_extension', name: 'Cadeira extensora', muscle: 'quads', splits: ['lower'], increment: 5, repMin: 10, repMax: 15, restSec: 60, antagonist: 'lying_leg_curl' }),
  ex({ id: 'incline_fly_machine', name: 'Crucifixo inclinado máquina', muscle: 'chest', splits: ['upper'], loadUnit: 'kg/lado', repMin: 10, restSec: 75 }),

  // Prioridade 3: acessórios
  ex({ id: 'rear_delt_incline', name: 'Posterior de ombro, banco 45°', muscle: 'rear_delt', splits: ['upper'], priority: 3, equipment: 'free', increment: 1, repMin: 10, repMax: 15, restSec: 60, cue: 'Testa apoiada no banco: zero tensão lombar.' }),
  ex({ id: 'lateral_raise_db', name: 'Elevação lateral (halteres)', muscle: 'side_delt', splits: ['upper'], priority: 3, equipment: 'free', increment: 1, repMin: 12, repMax: 15, restSec: 60 }),
  ex({ id: 'scott_curl_machine', name: 'Rosca Scott máquina', muscle: 'biceps', splits: ['full_body', 'upper'], priority: 3, restSec: 75, antagonist: 'french_press_machine' }),
  ex({ id: 'french_press_machine', name: 'Tríceps francês máquina', muscle: 'triceps', splits: ['full_body', 'upper'], priority: 3, restSec: 75, antagonist: 'scott_curl_machine' }),
  ex({ id: 'hammer_rope', name: 'Rosca martelo na corda', muscle: 'forearm', priority: 3, equipment: 'cable', repMin: 10, restSec: 60, antagonist: 'triceps_rope' }),
  ex({ id: 'triceps_rope', name: 'Tríceps na corda', muscle: 'triceps', priority: 3, equipment: 'cable', repMin: 10, restSec: 60, antagonist: 'hammer_rope' }),
  ex({ id: 'seated_calf', name: 'Panturrilha sentado', muscle: 'calves', splits: ['lower'], priority: 3, increment: 5, repMin: 12, repMax: 15, restSec: 60, ankleLoad: 'moderate' }),
  ex({ id: 'pallof_press', name: 'Pallof press (anti-rotação)', muscle: 'core', splits: ['full_body', 'upper'], priority: 3, unilateral: true, equipment: 'cable', increment: 2.5, repMin: 10, repMax: 12, restSec: 45, cue: 'De lado para a polia, braços estendidos à frente do peito; o tronco não gira. Expire ao estender.' }),
  ex({ id: 'ab_wheel', name: 'Roda abdominal', muscle: 'core', splits: ['full_body', 'upper'], priority: 3, equipment: 'bodyweight', increment: 0, repMin: 8, repMax: 15, restSec: 60, coreDemand: 'high', cue: 'Pare antes de a lombar arquear.' }),

  // Substitutos seguros
  ex({ id: 'lateral_raise_machine', name: 'Elevação lateral máquina', muscle: 'side_delt', priority: 3, repMin: 12, repMax: 15, restSec: 60 }),
  ex({ id: 'reverse_pec_deck', name: 'Crucifixo inverso máquina', muscle: 'rear_delt', priority: 3, repMin: 12, repMax: 15, restSec: 60 }),
  ex({ id: 'seated_leg_curl', name: 'Cadeira flexora', muscle: 'hamstrings', increment: 5, repMin: 10, restSec: 75 }),

  // Unilaterais: substitutos e correção de assimetria
  ex({ id: 'split_squat_db', name: 'Afundo búlgaro (halteres)', muscle: 'quads', unilateral: true, equipment: 'free', increment: 2, ankleLoad: 'moderate' }),
  ex({ id: 'leg_extension_uni', name: 'Cadeira extensora unilateral', muscle: 'quads', priority: 3, unilateral: true, repMin: 10, repMax: 15, restSec: 45 }),
  ex({ id: 'calf_raise_uni', name: 'Panturrilha unilateral em pé (degrau)', muscle: 'calves', priority: 3, unilateral: true, equipment: 'bodyweight', increment: 2, repMin: 12, repMax: 20, restSec: 45, ankleLoad: 'high' }),
  ex({ id: 'calf_press_flat', name: 'Panturrilha no leg press (amplitude curta)', muscle: 'calves', priority: 3, increment: 10, repMin: 12, repMax: 20, restSec: 45, cue: 'Só da posição neutra para cima: o calcanhar não passa da linha da plataforma.' }),
  ex({ id: 'single_arm_pulldown', name: 'Puxada unilateral na polia (ajoelhado)', muscle: 'back', priority: 2, unilateral: true, equipment: 'cable', increment: 2.5, repMin: 10, repMax: 12, restSec: 45, cue: 'Puxe o cotovelo em direção ao bolso da calça, pausa de 2 s embaixo. Sinta o dorsal, não o bíceps.' }),
  ex({ id: 'db_row_uni', name: 'Remada unilateral apoiada (halter)', muscle: 'back', unilateral: true, equipment: 'free', increment: 2, cue: 'Mão e joelho no banco, tronco paralelo ao chão.' }),
  ex({ id: 'concentration_curl', name: 'Rosca concentrada unilateral', muscle: 'biceps', priority: 3, unilateral: true, equipment: 'free', increment: 1, repMin: 10, repMax: 15, restSec: 45 }),
  ex({ id: 'cable_reverse_curl_uni', name: 'Rosca inversa unilateral na polia', muscle: 'forearm', priority: 3, unilateral: true, equipment: 'cable', increment: 2.5, repMin: 12, repMax: 15, restSec: 45, cue: 'Pegada pronada, punho firme, sem balançar o tronco.' }),
  ex({ id: 'wrist_curl_db', name: 'Rosca de punho unilateral (halter)', muscle: 'forearm', priority: 3, unilateral: true, equipment: 'free', increment: 1, repMin: 12, repMax: 20, restSec: 45, cue: 'Antebraço apoiado na coxa ou no banco, só o punho se move.' }),
];

const DEFAULT_BY_ID = new Map(DEFAULT_EXERCISES.map((e) => [e.id, e]));

/**
 * Exercícios do usuário (máquinas novas e edições de padrão), registrados pelo store.
 * Mantido aqui para que histórico, notas e gráficos resolvam qualquer id.
 */
let userById = new Map<string, Exercise>();

export function setUserExercises(list: Exercise[]) {
  userById = new Map(list.map((e) => [e.id, normalize(e)]));
}

export const exerciseById = (id: string): Exercise | undefined => userById.get(id) ?? DEFAULT_BY_ID.get(id);

export const isDefaultExercise = (id: string) => DEFAULT_BY_ID.has(id);

/** Biblioteca ativa: padrões (com edições do usuário) + criados, menos os ocultos. */
export function activeLibrary(custom: Exercise[], hidden: string[]): Exercise[] {
  const overrides = new Map(custom.map((e) => [e.id, normalize(e)]));
  const merged = [...DEFAULT_EXERCISES.map((e) => overrides.get(e.id) ?? e), ...custom.filter((e) => !DEFAULT_BY_ID.has(e.id)).map(normalize)];
  const hide = new Set(hidden);
  return merged.filter((e) => !hide.has(e.id));
}

/** Para testes e para quem não tem estado: só os padrões. */
export const EXERCISES = DEFAULT_EXERCISES;
