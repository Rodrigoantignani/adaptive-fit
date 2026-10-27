import type { Muscle, SplitId } from './types';

/** Grupos como o treinador conta exercícios ("2 de ombro" = qualquer porção do deltoide). */
export type GroupId = 'back' | 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'forearm' | 'core' | 'quads' | 'hamstrings' | 'glutes' | 'hips' | 'calves';

export const GROUPS: Record<GroupId, { label: string; muscles: Muscle[] }> = {
  back: { label: 'Costas', muscles: ['back'] },
  chest: { label: 'Peito', muscles: ['chest'] },
  shoulders: { label: 'Ombros', muscles: ['front_delt', 'side_delt', 'rear_delt'] },
  biceps: { label: 'Bíceps', muscles: ['biceps'] },
  triceps: { label: 'Tríceps', muscles: ['triceps'] },
  forearm: { label: 'Antebraço', muscles: ['forearm'] },
  core: { label: 'Abdômen / core', muscles: ['core'] },
  quads: { label: 'Quadríceps', muscles: ['quads'] },
  hamstrings: { label: 'Posteriores', muscles: ['hamstrings'] },
  glutes: { label: 'Glúteos', muscles: ['glutes'] },
  hips: { label: 'Adutores / abdutores', muscles: ['adductors', 'abductors'] },
  calves: { label: 'Panturrilha', muscles: ['calves'] },
};

export const GROUP_ORDER = Object.keys(GROUPS) as GroupId[];

/** Quantos exercícios de cada grupo, na ordem de prioridade (o primeiro sai por último). */
export interface TemplateSlot {
  group: GroupId;
  count: number;
}

export const DEFAULT_TEMPLATES: Record<SplitId, TemplateSlot[]> = {
  upper: [
    { group: 'back', count: 3 },
    { group: 'chest', count: 2 },
    { group: 'shoulders', count: 2 },
    { group: 'triceps', count: 2 },
  ],
  lower: [
    { group: 'quads', count: 2 },
    { group: 'glutes', count: 1 },
    { group: 'hamstrings', count: 2 },
    { group: 'hips', count: 2 },
    { group: 'calves', count: 1 },
  ],
  arms_core: [
    { group: 'biceps', count: 2 },
    { group: 'triceps', count: 2 },
    { group: 'forearm', count: 2 },
    { group: 'core', count: 2 },
    { group: 'calves', count: 1 },
  ],
  full_body: [
    { group: 'back', count: 1 },
    { group: 'chest', count: 1 },
    { group: 'quads', count: 1 },
    { group: 'hamstrings', count: 1 },
    { group: 'shoulders', count: 1 },
    { group: 'glutes', count: 1 },
    { group: 'core', count: 1 },
  ],
};

/** Acima disso, mais séries na semana rendem pouco e cobram recuperação. */
export const WEEKLY_SETS_HIGH = 20;

/** Prioridade de corte pela posição do grupo na montagem. */
export const slotPriority = (index: number): 1 | 2 | 3 => (index < 2 ? 1 : index < 4 ? 2 : 3);
