import { parseISO } from '../lib/date';
import { analyzeAsymmetry } from './asymmetry';
import { suggestSplit } from './history';
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
 * Valores iniciais do check-in: a rotina semanal manda; sem rotina para o dia,
 * usa o último check-in e o split treinado há mais tempo.
 */
export function dayDefaults(
  date: string,
  week: Record<string, WeekDay>,
  last: CheckIn | undefined,
  sessions: Session[],
  order: SplitId[],
): DayDefaults {
  const day = week[String(parseISO(date).getDay())];
  const rotation = suggestSplit(sessions, date, order).split;
  if (day) {
    return {
      split: day.split === 'rest' ? rotation : day.split,
      timeAvailMin: day.timeAvailMin,
      dayLoad: day.dayLoad,
      source: day.split === 'rest' ? 'rotation' : 'routine',
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

/** Avaliação mais recente que tenha ao menos um par bilateral medido. */
export function latestBilateral(assessments: BodyAssessment[]): BodyAssessment | undefined {
  return [...assessments].sort((a, b) => a.date.localeCompare(b.date)).findLast((a) => analyzeAsymmetry(a.perimeters).length > 0);
}
