import { daysBetween } from '../lib/date';
import type { TechniqueId } from './techniques';

/** Ciclo (mesociclo) de 6 semanas: adaptação → acumulação → intensificação → deload. */
export const CYCLE_WEEKS = 6;

export type Phase = 'adaptation' | 'accumulation' | 'intensification' | 'deload';

export const PHASE_INFO: Record<Phase, { label: string; rir: string; maxTechniques: number; detail: string }> = {
  adaptation: {
    label: 'Adaptação',
    rir: '2–3',
    maxTechniques: 0,
    detail: 'Técnica, amplitude e cargas de referência. Termine cada série com 2–3 reps na reserva; sem técnicas avançadas.',
  },
  accumulation: {
    label: 'Acumulação',
    rir: '1–2',
    maxTechniques: 1,
    detail: 'Volume é o motor: séries perto da falha (1–2 na reserva) e até 1 técnica avançada por treino.',
  },
  intensification: {
    label: 'Intensificação',
    rir: '0–1',
    maxTechniques: 2,
    detail: 'Semana de pico: últimas séries até 0–1 na reserva e até 2 técnicas. Na semana que vem, o corpo descansa.',
  },
  deload: {
    label: 'Deload',
    rir: '3',
    maxTechniques: 0,
    detail: 'Uma série a menos, cargas mantidas e 3 reps na reserva. É aqui que a adaptação das semanas anteriores aparece.',
  },
};

const PHASE_BY_WEEK: Phase[] = ['adaptation', 'adaptation', 'accumulation', 'accumulation', 'intensification', 'deload'];

/**
 * Técnicas liberadas aos poucos: uma novidade de cada vez, sempre no começo da acumulação
 * ou da intensificação, para dar tempo de aprender antes da próxima.
 */
const UNLOCKS: { cycle: number; week: number; ids: TechniqueId[] }[] = [
  { cycle: 1, week: 3, ids: ['rest_pause'] },
  { cycle: 1, week: 5, ids: ['drop_set'] },
  { cycle: 2, week: 3, ids: ['cluster', 'isometric'] },
  { cycle: 2, week: 5, ids: ['super_slow'] },
  { cycle: 3, week: 3, ids: ['method_21'] },
  { cycle: 3, week: 5, ids: ['fst7'] },
  { cycle: 4, week: 3, ids: ['pyramid', 'partials'] },
];

export interface ProgramWeek {
  /** Semana desde o início do programa (1, 2, 3...). */
  absoluteWeek: number;
  cycle: number;
  /** 1..6 dentro do ciclo. */
  week: number;
  phase: Phase;
  unlocked: TechniqueId[];
  newThisWeek: TechniqueId[];
}

export function programWeek(start: string, today: string): ProgramWeek {
  const absoluteWeek = Math.floor(Math.max(0, daysBetween(start, today)) / 7) + 1;
  const cycle = Math.floor((absoluteWeek - 1) / CYCLE_WEEKS) + 1;
  const week = ((absoluteWeek - 1) % CYCLE_WEEKS) + 1;
  const reached = (u: { cycle: number; week: number }) => u.cycle < cycle || (u.cycle === cycle && u.week <= week);
  return {
    absoluteWeek,
    cycle,
    week,
    phase: PHASE_BY_WEEK[week - 1],
    unlocked: UNLOCKS.filter(reached).flatMap((u) => u.ids),
    newThisWeek: UNLOCKS.filter((u) => u.cycle === cycle && u.week === week).flatMap((u) => u.ids),
  };
}
