import { fmtNum } from '../lib/format';
import { WEEKLY_SETS_HIGH } from './templates';

/** Teto para um grupo em especialização (prioridade do ciclo). */
export const WEEKLY_SETS_PRIORITY = 26;

/**
 * Horas em pé "de graça" na semana (sexta + sábado). O custo real das noites de turno é o sono,
 * que já entra pela média dos check-ins; aqui fica só um desconto leve pelas horas extras.
 */
const STANDING_BASE_H = 8.5;
const PER_EXTRA_HOUR = 0.015;
const MAX_STANDING_CUT = 0.2;

export interface WeekLoad {
  /** Dias com turno em pé na semana (agenda real). */
  shiftDays: number;
  /** Total de horas em pé na semana: turnos curtos pesam menos que turnos longos. */
  standingHours: number;
  /** Média de sono dos check-ins da semana (h); undefined = sem dados. */
  avgSleep?: number;
  /** Média de prontidão dos check-ins da semana; undefined = sem dados. */
  avgReadiness?: number;
}

export interface WeeklyBudget {
  factor: number;
  normal: number;
  priority: number;
  reasons: string[];
  label: 'pesada' | 'normal' | 'leve';
}

/**
 * Recuperação é um orçamento só: treino + trabalho em pé + sono.
 * Semana pesada baixa o teto de séries por grupo; semana leve permite mais.
 */
export function weeklyBudget({ shiftDays, standingHours, avgSleep, avgReadiness }: WeekLoad): WeeklyBudget {
  let factor = 1;
  const reasons: string[] = [];
  const extra = standingHours - STANDING_BASE_H;
  if (extra > 0) {
    factor -= Math.min(MAX_STANDING_CUT, PER_EXTRA_HOUR * extra);
    reasons.push(`${fmtNum(standingHours)} h em pé em ${shiftDays} turnos`);
  }
  if (avgSleep !== undefined && avgSleep < 7) {
    factor -= 0.1;
    reasons.push(`sono médio de ${fmtNum(Math.round(avgSleep * 10) / 10)} h`);
  }
  if (avgReadiness !== undefined && avgReadiness < 55) {
    factor -= 0.1;
    reasons.push(`prontidão média ${Math.round(avgReadiness)}`);
  }
  const light = standingHours <= STANDING_BASE_H && (avgSleep ?? 0) >= 7.5 && (avgReadiness ?? 0) >= 70;
  if (light) {
    factor += 0.1;
    reasons.push('poucos turnos, sono e prontidão bons');
  }
  factor = Math.min(1.15, Math.max(0.7, Math.round(factor * 100) / 100));
  return {
    factor,
    normal: Math.round(WEEKLY_SETS_HIGH * factor),
    priority: Math.round(WEEKLY_SETS_PRIORITY * factor),
    reasons,
    label: factor < 1 ? 'pesada' : factor > 1 ? 'leve' : 'normal',
  };
}
