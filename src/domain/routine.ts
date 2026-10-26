import { localISODate, parseISO } from '../lib/date';
import { analyzeAsymmetry } from './asymmetry';
import { dayLoadFromWork, hoursBetween } from './energy';
import { nextInRotation } from './history';
import type { BodyAssessment, CheckIn, Session, ShiftDates, SplitId, WeekDay, WorkDay } from './types';

export interface DayDefaults {
  split: SplitId;
  timeAvailMin: number;
  dayLoad: CheckIn['dayLoad'];
  /** De onde veio o split sugerido. */
  source: 'routine' | 'rotation';
  restDay: boolean;
  /** Palpite de sono: noite de turno até tarde costuma render ~6 h. */
  sleepGuess: number;
}

/**
 * Agenda real de um dia: o padrão do dia da semana, com o turno da data por cima.
 * Trabalho sob chamada: a data marcada vale mais que o padrão; `null` cancela o turno padrão.
 */
export function workFor(date: string, week: Record<string, WeekDay>, shiftDates: ShiftDates = {}): WorkDay | undefined {
  const base = week[String(parseISO(date).getDay())]?.work;
  if (!(date in shiftDates)) return base;
  const shift = shiftDates[date];
  const sittingH = base?.sittingH ?? 0;
  if (!shift) return { sittingH, standingH: 0 };
  return { sittingH, standingH: hoursBetween(shift.start, shift.end), standingStart: shift.start, standingEnd: shift.end };
}

/** Turno em pé ontem terminando 22h ou mais tarde ⇒ ~6 h de sono; senão o padrão. */
export function sleepGuess(date: string, week: Record<string, WeekDay>, usual = 7.5, shiftDates: ShiftDates = {}): number {
  const y = parseISO(date);
  y.setDate(y.getDate() - 1);
  const end = workFor(localISODate(y), week, shiftDates)?.standingEnd;
  return end && end >= '22:00' ? 6 : usual;
}

/**
 * Valores iniciais do check-in: a rotina semanal manda no tempo; a demanda vem da agenda real
 * do dia (com turnos avulsos); o treino vem da rotina do dia ou, sem ela, da rotação.
 */
export function dayDefaults(
  date: string,
  week: Record<string, WeekDay>,
  last: CheckIn | undefined,
  sessions: Session[],
  rotationOrder: SplitId[],
  shiftDates: ShiftDates = {},
): DayDefaults {
  const day = week[String(parseISO(date).getDay())];
  const rotation = nextInRotation(sessions, rotationOrder);
  const work = workFor(date, week, shiftDates);
  const sleep = sleepGuess(date, week, 7.5, shiftDates);
  if (day) {
    const fixed = day.split !== 'rest' && day.split !== 'auto';
    return {
      split: fixed ? (day.split as SplitId) : rotation,
      timeAvailMin: day.timeAvailMin,
      dayLoad: work ? dayLoadFromWork(work) : day.dayLoad,
      source: fixed ? 'routine' : 'rotation',
      restDay: day.split === 'rest',
      sleepGuess: sleep,
    };
  }
  return {
    split: rotation,
    timeAvailMin: last?.timeAvailMin ?? 60,
    dayLoad: work ? dayLoadFromWork(work) : (last?.dayLoad ?? 'light'),
    source: 'rotation',
    restDay: false,
    sleepGuess: sleep,
  };
}

/** Peso da avaliação mais recente (para o volume de exercícios assistidos). */
export const latestWeight = (assessments: BodyAssessment[]) =>
  [...assessments].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.weightKg;

/** Avaliação mais recente que tenha ao menos um par bilateral medido. */
export function latestBilateral(assessments: BodyAssessment[]): BodyAssessment | undefined {
  return [...assessments].sort((a, b) => a.date.localeCompare(b.date)).findLast((a) => analyzeAsymmetry(a.perimeters).length > 0);
}
