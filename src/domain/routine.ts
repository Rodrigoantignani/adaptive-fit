import { parseISO } from '../lib/date';
import { analyzeAsymmetry } from './asymmetry';
import { nextInRotation } from './history';
import type { BodyAssessment, CheckIn, Session, SplitId, WeekDay } from './types';

export interface DayDefaults {
  split: SplitId;
  timeAvailMin: number;
  dayLoad: CheckIn['dayLoad'];
  /** De onde veio o split sugerido. */
  source: 'routine' | 'rotation';
  restDay: boolean;
}

/**
 * Valores iniciais do check-in: a rotina semanal manda no tempo e na demanda;
 * o treino vem da rotina do dia ou, sem ela, da rotação (ex.: Superior ↔ Inferior).
 */
export function dayDefaults(
  date: string,
  week: Record<string, WeekDay>,
  last: CheckIn | undefined,
  sessions: Session[],
  rotationOrder: SplitId[],
): DayDefaults {
  const day = week[String(parseISO(date).getDay())];
  const rotation = nextInRotation(sessions, rotationOrder);
  if (day) {
    const fixed = day.split !== 'rest' && day.split !== 'auto';
    return {
      split: fixed ? (day.split as SplitId) : rotation,
      timeAvailMin: day.timeAvailMin,
      dayLoad: day.dayLoad,
      source: fixed ? 'routine' : 'rotation',
      restDay: day.split === 'rest',
    };
  }
  return {
    split: rotation,
    timeAvailMin: last?.timeAvailMin ?? 60,
    dayLoad: last?.dayLoad ?? 'light',
    source: 'rotation',
    restDay: false,
  };
}

/** Peso da avaliação mais recente (para o volume de exercícios assistidos). */
export const latestWeight = (assessments: BodyAssessment[]) =>
  [...assessments].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.weightKg;

/** Avaliação mais recente que tenha ao menos um par bilateral medido. */
export function latestBilateral(assessments: BodyAssessment[]): BodyAssessment | undefined {
  return [...assessments].sort((a, b) => a.date.localeCompare(b.date)).findLast((a) => analyzeAsymmetry(a.perimeters).length > 0);
}
