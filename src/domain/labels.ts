import type { DayLoad, Equipment, MeasureCondition, Muscle, PerimeterSite, SkinfoldSite, SorenessArea, SplitId, Target, Tier } from './types';

export const SPLIT_ORDER: SplitId[] = ['full_body', 'upper', 'lower', 'arms_core'];

export const SPLIT_LABEL: Record<SplitId, string> = {
  full_body: 'Full body',
  upper: 'Superior',
  lower: 'Inferior',
  arms_core: 'Braços e core',
};

export const SPLIT_HINT: Record<SplitId, string> = {
  full_body: 'Corpo todo, básicos',
  upper: 'Peito, costas, ombros, braços',
  lower: 'Quadríceps, posteriores, panturrilha',
  arms_core: 'Bíceps, tríceps, antebraço, abdômen',
};

export const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Peito',
  back: 'Costas',
  front_delt: 'Ombro (frontal)',
  side_delt: 'Ombro (lateral)',
  rear_delt: 'Ombro (posterior)',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearm: 'Antebraço',
  quads: 'Quadríceps',
  hamstrings: 'Posteriores',
  calves: 'Panturrilha',
  glutes: 'Glúteos',
  adductors: 'Adutores',
  abductors: 'Abdutores',
  lower_back: 'Lombar (eretores)',
  core: 'Core',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  machine: 'Máquina',
  cable: 'Polia / cabo',
  free: 'Peso livre',
  bodyweight: 'Peso corporal',
};

export const SIDE_LABEL = { L: 'esquerdo', R: 'direito' } as const;

export const DAY_LOAD_LABEL: Record<DayLoad, { label: string; hint: string }> = {
  light: { label: 'Leve', hint: 'Escritório / sentado' },
  standing: { label: 'Em pé', hint: 'Muitas horas em pé' },
  double: { label: 'Turno duplo', hint: 'Dois turnos, 8h+ em pé' },
  off: { label: 'Folga', hint: 'Dia livre' },
};

export const SORENESS_LABEL: Record<SorenessArea, string> = {
  core: 'Abdômen',
  lower_back: 'Lombar',
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  arms: 'Braços',
  legs: 'Pernas',
};

export const TIER_LABEL: Record<Tier, string> = { push: 'Progredir', maintain: 'Manter', recover: 'Recuperar' };

export const CONDITION_LABEL: Record<MeasureCondition, string> = {
  fasted: 'Em jejum / frio',
  post_workout: 'Pós-treino (pump)',
  other: 'Outra',
};

export const SKINFOLD_LABEL: Record<SkinfoldSite, string> = {
  chest: 'Peitoral',
  midaxillary: 'Axilar média',
  triceps: 'Tríceps',
  subscapular: 'Subescapular',
  abdominal: 'Abdominal',
  suprailiac: 'Suprailíaca',
  thigh: 'Coxa',
  calf: 'Panturrilha',
};

export const PERIMETER_LABEL: Record<PerimeterSite, string> = {
  shoulders: 'Ombros',
  chest: 'Tórax',
  absUpper: 'Abdômen sup.',
  absLower: 'Abdômen inf.',
  hips: 'Quadril',
  bicepsR: 'Bíceps D',
  bicepsL: 'Bíceps E',
  forearmR: 'Antebraço D',
  forearmL: 'Antebraço E',
  thighR: 'Coxa D',
  thighL: 'Coxa E',
  calfR: 'Panturrilha D',
  calfL: 'Panturrilha E',
};

export const ACTION_LABEL: Record<Target['action'], string> = {
  start: 'novo',
  increase: '↑ subir',
  hold: '= manter',
  decrease: '↓ reduzir',
};
