import { calibrationFactor, dailyEnergy, macroTargets, type EnergyDay, type MacroTargets } from '../domain/energy';
import { itemMacros, planMacros, sumMacros, type Macros } from '../domain/foods';
import type { WorkDay } from '../domain/types';
import { ageOn, localISODate, parseISO } from '../lib/date';
import type { AppState } from './schema';

export interface DayNutrition {
  energy: EnergyDay;
  macros: MacroTargets;
  work?: WorkDay;
  trainingMin: number;
  trainingSource: 'feito' | 'planejado' | 'rotina' | 'nenhum';
  /** O que o plano base (+ extras de turno) entrega neste dia. */
  intake: Macros | null;
}

export function nextDays(from: string, n = 7) {
  const d = parseISO(from);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return localISODate(x);
  });
}

const workOf = (s: AppState, date: string) => s.settings.week[String(parseISO(date).getDay())]?.work;

/** Plano base + extras do dia de turno em pé + extras fixos do dia da semana. */
export function plannedIntake(s: AppState, date: string): Macros | null {
  const { mealPlan, shiftExtras, dayExtras } = s.settings;
  if (!mealPlan.length) return null;
  const shift = (workOf(s, date)?.standingH ?? 0) > 0 ? shiftExtras : [];
  const weekday = dayExtras[String(parseISO(date).getDay())] ?? [];
  return sumMacros([planMacros(mealPlan), ...[...shift, ...weekday].map(itemMacros)]);
}

/**
 * Gasto e metas de um dia. Prioridade do minuto de treino:
 * treino finalizado > check-in do dia > rotina semanal.
 */
export function nutritionFor(s: AppState, date: string, opts: { ignoreCalibration?: boolean } = {}): DayNutrition | null {
  const p = s.profile;
  const last = [...s.assessments].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!p?.birthDate || !last) return null;

  const day = s.settings.week[String(parseISO(date).getDay())];
  const done = s.sessions.filter((x) => x.date === date && x.endedAt);
  const checkIn = s.checkIns.find((c) => c.date === date);
  let trainingMin = 0;
  let trainingSource: DayNutrition['trainingSource'] = 'nenhum';
  if (done.length) {
    trainingMin = done.reduce((a, x) => a + (x.endedAt! - x.startedAt) / 60_000, 0);
    trainingSource = 'feito';
  } else if (checkIn) {
    trainingMin = checkIn.timeAvailMin;
    trainingSource = 'planejado';
  } else if (day && day.split !== 'rest') {
    trainingMin = day.timeAvailMin;
    trainingSource = 'rotina';
  }

  const leanKg = last.result?.leanKg;
  const energy = dailyEnergy({
    sex: p.sex,
    age: ageOn(p.birthDate, date),
    weightKg: last.weightKg,
    leanKg,
    heightCm: p.heightCm,
    work: day?.work,
    trainingMin,
    walkMin: s.settings.dailyWalkMin,
    calibration: opts.ignoreCalibration ? 1 : (s.settings.calibration?.factor ?? 1),
  });
  const macros = macroTargets(energy, s.settings.nutritionGoal, last.weightKg, leanKg, trainingMin > 0, day?.work?.standingH ?? 0);
  return { energy, macros, work: day?.work, trainingMin: Math.round(trainingMin), trainingSource, intake: plannedIntake(s, date) };
}

/** "Peso estável comendo este plano": ingestão média da semana = gasto real. */
export function calibrateFromPlan(s: AppState, today: string) {
  const days = nextDays(today);
  const intakes = days.map((d) => plannedIntake(s, d)?.kcal ?? 0);
  const formulas = days.map((d) => nutritionFor(s, d, { ignoreCalibration: true })?.energy.formula ?? 0);
  const observedKcal = Math.round(intakes.reduce((a, b) => a + b, 0) / days.length);
  const formulaAvg = formulas.reduce((a, b) => a + b, 0) / days.length;
  if (!observedKcal || !formulaAvg) return null;
  return { factor: Math.round(calibrationFactor(observedKcal, formulaAvg) * 1000) / 1000, date: today, observedKcal };
}
