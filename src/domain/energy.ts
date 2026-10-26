import { round } from '../lib/format';
import type { DayLoad, Sex, WorkDay } from './types';

export type NutritionGoal = 'cut' | 'recomp' | 'bulk';

/** Acima do gasto sentado (~1,3 MET): diferença líquida por kg por hora. */
const STANDING_NET_MET = 3.0 - 1.3; // garçom/cozinha: em pé, andando, carregando
const TRAINING_NET_MET = 5.0 - 1.3; // musculação moderada a vigorosa
const WALK_NET_MET = 3.0 - 1.3; // caminhada leve
const BASE_FACTOR = 1.2; // dia sentado + termogênese dos alimentos

export interface EnergyInput {
  sex: Sex;
  age: number;
  weightKg: number;
  leanKg?: number;
  heightCm?: number;
  work?: WorkDay;
  trainingMin: number;
  walkMin?: number;
  /** Fator da calibração pelo peso real (1 = só fórmula). */
  calibration?: number;
}

export interface EnergyDay {
  bmr: number;
  method: 'Katch-McArdle' | 'Mifflin-St Jeor' | 'estimado';
  base: number;
  standing: number;
  training: number;
  walk: number;
  /** Soma da fórmula, antes da calibração. */
  formula: number;
  total: number;
}

export function bmr({ sex, age, weightKg, leanKg, heightCm }: EnergyInput): { kcal: number; method: EnergyDay['method'] } {
  if (leanKg) return { kcal: 370 + 21.6 * leanKg, method: 'Katch-McArdle' };
  if (heightCm) return { kcal: 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'M' ? 5 : -161), method: 'Mifflin-St Jeor' };
  return { kcal: weightKg * (sex === 'M' ? 24 : 22), method: 'estimado' };
}

/** Gasto do dia: basal × rotina + trabalho em pé + treino. */
export function dailyEnergy(input: EnergyInput): EnergyDay {
  const b = bmr(input);
  const base = b.kcal * BASE_FACTOR;
  const standing = STANDING_NET_MET * input.weightKg * (input.work?.standingH ?? 0);
  const training = TRAINING_NET_MET * input.weightKg * (input.trainingMin / 60);
  const walk = WALK_NET_MET * input.weightKg * ((input.walkMin ?? 0) / 60);
  const formula = base + standing + training + walk;
  return {
    bmr: Math.round(b.kcal),
    method: b.method,
    base: Math.round(base),
    standing: Math.round(standing),
    training: Math.round(training),
    walk: Math.round(walk),
    formula: Math.round(formula),
    total: Math.round(formula * (input.calibration ?? 1)),
  };
}

/**
 * Calibração pelo peso: se o peso ficou estável comendo `observedKcal` por dia em média,
 * o gasto real é esse. Fator = observado / fórmula (limitado a 0,6–1,3 contra erros de registro).
 */
export function calibrationFactor(observedKcal: number, formulaAvgKcal: number): number {
  return Math.min(1.3, Math.max(0.6, observedKcal / formulaAvgKcal));
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  waterL: number;
}

/**
 * Proteína fixa pela massa magra, gordura fixa pelo peso e carboidrato
 * acompanhando o gasto do dia (sobe em dia de treino/restaurante).
 */
export function macroTargets(energy: EnergyDay, goal: NutritionGoal, weightKg: number, leanKg: number | undefined, trained: boolean, standingH = 0): MacroTargets {
  const adj = goal === 'cut' ? -0.15 : goal === 'bulk' ? 0.1 : trained ? 0 : -0.05;
  const kcal = Math.round((energy.total * (1 + adj)) / 10) * 10;
  const protein = Math.round(leanKg ? 2.2 * leanKg : 1.8 * weightKg);
  const fat = Math.round(0.9 * weightKg);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const waterL = round(0.035 * weightKg + 0.5 * standingH + (trained ? 0.75 : 0), 1);
  return { kcal, protein, fat, carbs, waterL };
}

/** Demanda física do dia a partir da agenda de trabalho. */
export function dayLoadFromWork(work: WorkDay | undefined): DayLoad {
  if (!work || (work.sittingH === 0 && work.standingH === 0)) return 'off';
  if (work.standingH >= 6 || (work.standingH >= 4 && work.sittingH >= 6)) return 'double';
  if (work.standingH >= 2.5) return 'standing';
  return 'light';
}

/** Horas entre dois horários "HH:MM" (atravessa a meia-noite). */
export function hoursBetween(start: string, end: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  let d = toMin(end) - toMin(start);
  if (d < 0) d += 24 * 60;
  return round(d / 60, 2);
}
