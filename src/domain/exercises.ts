import type { Exercise } from './types';

type Base = Omit<Exercise, 'id' | 'name' | 'muscle'>;

const BASE: Base = {
  splits: [],
  equipment: 'machine',
  loadUnit: 'kg',
  increment: 2.5,
  repMin: 8,
  repMax: 12,
  sets: 3,
  restSec: 90,
  axialLoad: false,
  coreDemand: 'low',
};

const ex = (e: Pick<Exercise, 'id' | 'name' | 'muscle'> & Partial<Base>): Exercise => ({ ...BASE, ...e });

/**
 * Biblioteca padrão. A ordem define a prioridade dentro de cada split.
 * Exercícios com `splits: []` existem só como substitutos seguros.
 */
export const EXERCISES: Exercise[] = [
  ex({ id: 'incline_chest_machine', name: 'Supino inclinado máquina', muscle: 'chest', splits: ['upper_full', 'push'], loadUnit: 'kg/lado', repMax: 10, restSec: 120, antagonist: 'seated_row_machine' }),
  ex({ id: 'pullup', name: 'Barra fixa', muscle: 'back', splits: ['upper_full', 'pull'], equipment: 'bodyweight', repMin: 6, repMax: 10, restSec: 120, coreDemand: 'high', cue: 'Desça controlando pelas escápulas, sem balanço. Carga = lastro.' }),
  ex({ id: 'lat_pulldown', name: 'Puxada alta', muscle: 'back', splits: ['pull'], equipment: 'cable', increment: 5 }),
  ex({ id: 'seated_row_machine', name: 'Remada sentada máquina', muscle: 'back', splits: ['upper_full', 'pull'], increment: 5, antagonist: 'incline_chest_machine' }),
  ex({ id: 'shoulder_press_machine', name: 'Desenvolvimento máquina', muscle: 'front_delt', splits: ['upper_full', 'push'], loadUnit: 'kg/lado', repMax: 10, restSec: 120, cue: 'Costas coladas no encosto.' }),
  ex({ id: 'incline_fly_machine', name: 'Crucifixo inclinado máquina', muscle: 'chest', splits: ['upper_full', 'push'], loadUnit: 'kg/lado', repMin: 10, restSec: 75 }),
  ex({ id: 'lateral_raise_db', name: 'Elevação lateral (halteres)', muscle: 'side_delt', splits: ['push'], equipment: 'free', increment: 1, repMin: 12, repMax: 15, restSec: 60 }),
  ex({ id: 'lateral_raise_machine', name: 'Elevação lateral máquina', muscle: 'side_delt', repMin: 12, repMax: 15, restSec: 60 }),
  ex({ id: 'rear_delt_incline', name: 'Posterior de ombro, banco 45°', muscle: 'rear_delt', splits: ['upper_full', 'pull'], equipment: 'free', increment: 1, repMin: 10, repMax: 15, restSec: 60, cue: 'Testa apoiada no banco: zero tensão lombar.' }),
  ex({ id: 'reverse_pec_deck', name: 'Crucifixo inverso máquina', muscle: 'rear_delt', repMin: 12, repMax: 15, restSec: 60 }),
  ex({ id: 'scott_curl_machine', name: 'Rosca Scott máquina', muscle: 'biceps', splits: ['upper_full', 'pull'], restSec: 75, antagonist: 'french_press_machine' }),
  ex({ id: 'french_press_machine', name: 'Tríceps francês máquina', muscle: 'triceps', splits: ['upper_full', 'push'], restSec: 75, antagonist: 'scott_curl_machine' }),
  ex({ id: 'hammer_rope', name: 'Rosca martelo na corda', muscle: 'forearm', splits: ['pull'], equipment: 'cable', repMin: 10, restSec: 60, antagonist: 'triceps_rope' }),
  ex({ id: 'triceps_rope', name: 'Tríceps na corda', muscle: 'triceps', splits: ['push'], equipment: 'cable', repMin: 10, restSec: 60, antagonist: 'hammer_rope' }),
  ex({ id: 'ab_wheel', name: 'Roda abdominal', muscle: 'core', splits: ['upper_full'], equipment: 'bodyweight', increment: 0, repMin: 8, repMax: 15, restSec: 60, coreDemand: 'high', cue: 'Pare antes de a lombar arquear.' }),

  ex({ id: 'back_squat', name: 'Agachamento livre', muscle: 'quads', splits: ['legs'], equipment: 'free', repMin: 6, repMax: 10, restSec: 150, axialLoad: true, coreDemand: 'high' }),
  ex({ id: 'leg_press_45', name: 'Leg press 45°', muscle: 'quads', splits: ['legs'], increment: 10, repMin: 10, restSec: 120, cue: 'Quadril colado no banco do início ao fim.' }),
  ex({ id: 'split_squat_db', name: 'Afundo búlgaro (halteres)', muscle: 'quads', equipment: 'free', increment: 2 }),
  ex({ id: 'leg_extension', name: 'Cadeira extensora', muscle: 'quads', splits: ['legs'], increment: 5, repMin: 10, repMax: 15, restSec: 60, antagonist: 'lying_leg_curl' }),
  ex({ id: 'romanian_deadlift', name: 'Stiff (barra)', muscle: 'hamstrings', splits: ['legs'], equipment: 'free', repMax: 10, restSec: 120, axialLoad: true, coreDemand: 'high' }),
  ex({ id: 'lying_leg_curl', name: 'Mesa flexora', muscle: 'hamstrings', splits: ['legs'], increment: 5, repMin: 10, restSec: 75, antagonist: 'leg_extension' }),
  ex({ id: 'seated_leg_curl', name: 'Cadeira flexora', muscle: 'hamstrings', increment: 5, repMin: 10, restSec: 75 }),
  ex({ id: 'seated_calf', name: 'Panturrilha sentado', muscle: 'calves', splits: ['legs'], increment: 5, repMin: 12, repMax: 15, restSec: 60 }),
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export const exerciseById = (id: string): Exercise | undefined => BY_ID.get(id);
