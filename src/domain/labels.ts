import type { DayLoad, MeasureCondition, PerimeterSite, SkinfoldSite, SorenessArea, SplitId, Target, Tier } from './types';

export const SPLIT_ORDER: SplitId[] = ['upper_full', 'pull', 'push', 'legs'];

export const SPLIT_LABEL: Record<SplitId, string> = {
  upper_full: 'Superior completo',
  push: 'Empurrar',
  pull: 'Puxar',
  legs: 'Inferiores',
};

export const SPLIT_HINT: Record<SplitId, string> = {
  upper_full: 'Costas, peito, ombros e braços',
  push: 'Peito, deltoides e tríceps',
  pull: 'Dorsais, posterior e bíceps',
  legs: 'Quadríceps, posteriores, panturrilha',
};

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
