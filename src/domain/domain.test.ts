import { describe, expect, it } from 'vitest';
import { ageOn, localISODate, weekStart } from '../lib/date';
import { parseNum } from '../lib/format';
import { plannedIntake } from '../data/nutrition';
import { fromLegacy, mergeAssessments, mergeSeed, migrate, parseBackup } from '../data/schema';
import { analyzeDiet, dailyTopUps } from './dietCoach';
import { calibrationFactor, dailyEnergy, dayLoadFromWork, hoursBetween, macroTargets } from './energy';
import { equivalentGrams, foodById, planMacros, type Meal } from './foods';
import { analyzeAsymmetry } from './asymmetry';
import { bodyDensity, computeBodyComp, siri } from './bodycomp';
import { activeLibrary, EXERCISES, newExercise } from './exercises';
import { analyzeFunctional, functionalFlags, reassessDue } from './functional';
import { lastSideStrength, nextInRotation, suggestSplit, weeklySetsByMuscle } from './history';
import { buildDailyNote, obsidianNewUri } from './obsidian';
import { buildPlan, estimateSeconds, isAmrapNext, nextSide, setCount } from './planner';
import { nextTarget } from './progression';
import { assessReadiness } from './readiness';
import { dayDefaults, sleepGuess, workFor } from './routine';
import type { CheckIn, PlannedExercise, Session, SetLog } from './types';

const checkIn = (over: Partial<CheckIn> = {}): CheckIn => ({
  id: 'c1',
  date: '2026-10-26',
  sleepHours: 8,
  sleepQuality: 4,
  energy: 4,
  dayLoad: 'light',
  timeAvailMin: 90,
  soreness: [],
  spineAlert: false,
  split: 'upper',
  ...over,
});

const plan = (c: CheckIn, spineCare = false, extra: Partial<Parameters<typeof buildPlan>[0]> = {}) => {
  const readiness = assessReadiness(c, { spineCare });
  return buildPlan({ checkIn: c, readiness, exercises: EXERCISES, historyFor: () => [], refLoads: {}, ...extra });
};

const FOREARM_GAP = { forearmR: 31, forearmL: 29, bicepsR: 38.5, bicepsL: 38.2 };

describe('composição corporal', () => {
  it('JP3 masculino bate com a equação publicada', () => {
    const r = computeBodyComp({ sex: 'M', age: 38, weightKg: 79.5, skinfolds: { chest: 7, abdominal: 12, thigh: 10 } });
    expect(r?.protocol).toBe('JP3');
    // D = 1,10938 − 0,0008267·29 + 0,0000016·29² − 0,0002574·38 = 1,07697 → Siri 9,6%
    expect(r?.density).toBeCloseTo(1.07697, 5);
    expect(r?.bfPercent).toBe(9.6);
    expect(r?.leanKg).toBe(71.9);
  });

  it('JP7 tem prioridade quando as 7 dobras existem', () => {
    const folds = { chest: 10, midaxillary: 12, triceps: 12, subscapular: 16, abdominal: 20, suprailiac: 15, thigh: 15 };
    const r = computeBodyComp({ sex: 'M', age: 30, weightKg: 80, skinfolds: folds });
    expect(r?.protocol).toBe('JP7');
    expect(r?.bfPercent).toBeCloseTo(siri(bodyDensity('JP7', 'M', 100, 30)), 1);
  });

  it('usa os sítios femininos no JP3', () => {
    expect(computeBodyComp({ sex: 'F', age: 30, weightKg: 60, skinfolds: { chest: 7, abdominal: 12, thigh: 10 } })).toBeNull();
    expect(computeBodyComp({ sex: 'F', age: 30, weightKg: 60, skinfolds: { triceps: 15, suprailiac: 12, thigh: 20 } })?.protocol).toBe('JP3');
  });
});

describe('assimetria', () => {
  it('sinaliza antebraço 31 × 29 cm e aponta o lado menor', () => {
    const [bic, fore] = analyzeAsymmetry({ bicepsR: 38.5, bicepsL: 38.2, forearmR: 31, forearmL: 29 });
    expect(bic.level).toBe('ok');
    expect(fore.level).toBe('act');
    expect(fore.smaller).toBe('L');
  });
});

describe('prontidão', () => {
  it('dia bom libera progressão', () => {
    const r = assessReadiness(checkIn(), null);
    expect(r.tier).toBe('push');
    expect(r.flags.machinesOnly).toBe(false);
  });

  it('sono curto nunca deixa progredir e força máquinas', () => {
    const r = assessReadiness(checkIn({ sleepHours: 5.5, energy: 5, sleepQuality: 5 }), null);
    expect(r.tier).not.toBe('push');
    expect(r.flags.machinesOnly).toBe(true);
    expect(r.rules.some((x) => x.id === 'cns')).toBe(true);
  });

  it('dor lombar bloqueia carga axial e core', () => {
    const r = assessReadiness(checkIn({ soreness: ['lower_back'] }), null);
    expect(r.flags.noAxial).toBe(true);
    expect(r.flags.noHighCore).toBe(true);
  });

  it('score fica entre 0 e 100', () => {
    const r = assessReadiness(checkIn({ sleepHours: 2, sleepQuality: 1, energy: 1, dayLoad: 'double', soreness: ['lower_back', 'core', 'legs'] }), null);
    expect(r.score).toBe(0);
    expect(r.tier).toBe('recover');
  });
});

describe('dupla progressão', () => {
  const ex = { repMin: 8, repMax: 10, increment: 2.5 };
  const sets = (load: number, ...reps: number[]) => reps.map((r) => ({ load, reps: r, at: 0 }));

  it('sem histórico usa a carga de referência', () => {
    expect(nextTarget(ex, [], 'push', 35)).toMatchObject({ load: 35, action: 'start' });
  });

  it('todas as séries no topo → sobe a carga', () => {
    expect(nextTarget(ex, [{ date: 'd', sets: sets(35, 10, 10, 10) }], 'push')).toMatchObject({ load: 37.5, reps: 8, action: 'increase' });
  });

  it('em recuperação segura a subida', () => {
    expect(nextTarget(ex, [{ date: 'd', sets: sets(35, 10, 10, 10) }], 'recover').action).toBe('hold');
  });

  it('duas sessões abaixo da faixa → reduz', () => {
    const h = [{ date: 'd2', sets: sets(40, 7, 6) }, { date: 'd1', sets: sets(40, 7, 7) }];
    expect(nextTarget(ex, h, 'maintain')).toMatchObject({ load: 37.5, action: 'decrease' });
  });

  it('dentro da faixa → mesma carga, +1 rep', () => {
    expect(nextTarget(ex, [{ date: 'd', sets: sets(35, 9, 8, 8) }], 'push')).toMatchObject({ load: 35, reps: 9, action: 'hold' });
  });
});

describe('planejador', () => {
  it('coluna protegida troca agachamento e stiff por variações seguras', () => {
    const p = plan(checkIn({ split: 'lower' }), true);
    const ids = p.items.map((i) => i.exerciseId);
    expect(ids).not.toContain('back_squat');
    expect(ids).not.toContain('romanian_deadlift');
    expect(p.items.find((i) => i.exerciseId === 'split_squat_db')?.substitutedFor).toBe('back_squat');
    expect(p.items.find((i) => i.exerciseId === 'seated_leg_curl')?.substitutedFor).toBe('romanian_deadlift');
  });

  it('dia de máquinas mantém a barra assistida, troca halteres por máquina e tira a roda abdominal', () => {
    const p = plan(checkIn({ sleepHours: 5.5 }));
    const ids = p.items.map((i) => i.exerciseId);
    expect(ids[0]).toBe('pullup_assisted');
    expect(ids).toContain('reverse_pec_deck');
    expect(ids).not.toContain('rear_delt_incline');
    expect(p.dropped.map((d) => d.exerciseId)).toContain('ab_wheel');
    expect(p.items.every((i) => i.sets <= 2)).toBe(true);
  });

  it('janela curta gera super-séries e respeita o tempo', () => {
    const p = plan(checkIn({ timeAvailMin: 40 }));
    expect(p.items.some((i) => i.supersetWith)).toBe(true);
    expect(estimateSeconds(p.items)).toBeLessThanOrEqual(40 * 60);
    expect(p.rules.some((r) => r.id === 'time')).toBe(true);
  });

  it('super-séries ficam lado a lado', () => {
    const p = plan(checkIn({ timeAvailMin: 45 }));
    p.items.forEach((it, i) => {
      if (!it.supersetWith) return;
      const j = p.items.findIndex((x) => x.exerciseId === it.supersetWith);
      expect(Math.abs(i - j)).toBe(1);
    });
  });

  it('sem tempo, acessórios saem antes de a base perder séries', () => {
    const p = plan(checkIn({ timeAvailMin: 45 }));
    const base = p.items.filter((i) => EXERCISES.find((e) => e.id === i.exerciseId)!.priority === 1);
    expect(base.length).toBeGreaterThan(0);
    expect(base.every((i) => i.sets === 3)).toBe(true);
    expect(p.dropped.some((d) => EXERCISES.find((e) => e.id === d.exerciseId)!.priority === 3)).toBe(true);
  });

  it('super-série cortada sai em par', () => {
    for (const t of [30, 40, 45, 50, 55]) {
      const p = plan(checkIn({ timeAvailMin: t }));
      const ids = p.items.map((i) => i.exerciseId);
      expect(ids.includes('scott_curl_machine')).toBe(ids.includes('french_press_machine'));
    }
  });

  it('prioridade 1 vem antes de acessórios', () => {
    const p = plan(checkIn({ split: 'full_body' }));
    const prio = p.items.map((i) => EXERCISES.find((e) => e.id === i.exerciseId)!.priority);
    expect([...prio].sort()).toEqual(prio);
  });
});

describe('assimetria no plano', () => {
  it('antebraço E 6,5% menor → unilateral com série extra no esquerdo', () => {
    const p = plan(checkIn(), false, { perimeters: FOREARM_GAP });
    const uni = p.items.find((i) => i.perSide && EXERCISES.find((e) => e.id === i.exerciseId)!.muscle === 'forearm');
    expect(uni).toBeDefined();
    expect(uni!.weakSide).toBe('L');
    expect(uni!.extraSet).toBe(true);
    expect(setCount(uni!)).toBe(uni!.sets * 2 + 1);
    expect(p.rules.some((r) => r.id === 'asymmetry')).toBe(true);
  });

  it('dia de inferior não injeta antebraço', () => {
    const p = plan(checkIn({ split: 'lower' }), false, { perimeters: FOREARM_GAP });
    expect(p.items.some((i) => EXERCISES.find((e) => e.id === i.exerciseId)!.muscle === 'forearm')).toBe(false);
  });

  it('em dia só de máquinas usa a versão na polia', () => {
    const p = plan(checkIn({ sleepHours: 5.5 }), false, { perimeters: FOREARM_GAP });
    expect(p.items.map((i) => i.exerciseId)).toContain('cable_reverse_curl_uni');
  });
});

describe('escoliose', () => {
  it('lado esquerdo encurtado gera aquecimento e desconta o tempo', () => {
    const p = plan(checkIn({ timeAvailMin: 45 }), true, { profile: { scoliosis: { shortSide: 'L' } } });
    expect(p.corrective?.items.map((i) => i.id)).toContain('side_stretch');
    expect(p.corrective?.items[0].title).toContain('esquerdo');
    expect(estimateSeconds(p.items)).toBeLessThanOrEqual((45 - p.corrective!.minutes) * 60);
    expect(p.estimatedMin).toBeLessThanOrEqual(45);
  });

  it('sem escoliose não há bloco corretivo', () => {
    expect(plan(checkIn()).corrective).toBeNull();
  });
});

describe('unilateral', () => {
  const item: PlannedExercise = { exerciseId: 'x', sets: 2, restSec: 45, target: { load: 5, reps: 12, action: 'hold', reason: '' }, perSide: true, weakSide: 'L', extraSet: true };
  const s = (...sides: ('L' | 'R')[]): SetLog[] => sides.map((side, i) => ({ load: 5, reps: 12, at: i, side }));

  it('começa pelo fraco, alterna e deixa a extra para o fim', () => {
    expect(nextSide([], item)).toBe('L');
    expect(nextSide(s('L'), item)).toBe('R');
    expect(nextSide(s('L', 'R'), item)).toBe('L');
    expect(nextSide(s('L', 'R', 'L', 'R'), item)).toBe('L');
  });
});

describe('rotina e biblioteca', () => {
  it('segunda-feira com rotina de superior preenche o check-in', () => {
    const d = dayDefaults('2026-10-26', { '1': { split: 'upper', timeAvailMin: 45, dayLoad: 'double' } }, undefined, [], ['full_body', 'upper', 'lower']);
    expect(d).toMatchObject({ split: 'upper', timeAvailMin: 45, dayLoad: 'double', source: 'routine', restDay: false });
  });

  it('máquina nova entra, padrão oculto sai, edição sobrescreve', () => {
    const mine = newExercise({ id: 'gt_hack', name: 'Hack articulado GT', muscle: 'quads', splits: ['lower'] });
    const edited = { ...EXERCISES[0], name: 'Supino inclinado Hammer' };
    const lib = activeLibrary([mine, edited], ['back_squat']);
    expect(lib.find((e) => e.id === 'gt_hack')).toBeDefined();
    expect(lib.find((e) => e.id === 'back_squat')).toBeUndefined();
    expect(lib.find((e) => e.id === EXERCISES[0].id)?.name).toBe('Supino inclinado Hammer');
  });
});

describe('barra assistida (contrapeso)', () => {
  const ex = { repMin: 6, repMax: 10, increment: 5, loadMode: 'assisted' as const };
  const sets = (help: number, ...reps: number[]) => reps.map((r) => ({ load: help, reps: r, at: 0 }));

  it('topo das reps → tira ajuda', () => {
    expect(nextTarget(ex, [{ date: 'd', sets: sets(30, 10, 10, 10) }], 'push')).toMatchObject({ load: 25, action: 'increase' });
  });

  it('a melhor série é a de menor ajuda', () => {
    const t = nextTarget(ex, [{ date: 'd', sets: [...sets(30, 10), ...sets(25, 8, 7)] }], 'push');
    expect(t).toMatchObject({ load: 25, action: 'hold' });
    expect(t.reason).toContain('ajuda');
  });

  it('duas sessões abaixo → coloca mais ajuda', () => {
    const h = [{ date: 'd2', sets: sets(20, 5, 4) }, { date: 'd1', sets: sets(20, 5, 5) }];
    expect(nextTarget(ex, h, 'maintain')).toMatchObject({ load: 25, action: 'decrease' });
  });

  it('ajuda zerada sugere a barra livre', () => {
    const t = nextTarget(ex, [{ date: 'd', sets: sets(5, 10, 10, 10) }], 'push');
    expect(t.load).toBe(0);
    expect(t.reason).toContain('barra fixa livre');
  });
});

describe('tendão de Aquiles (Haglund)', () => {
  const lower = (pain: number) => {
    const c = checkIn({ split: 'lower', tendonPain: pain });
    const profile = { spineCare: true, achilles: { side: 'L' as const } };
    const readiness = assessReadiness(c, profile);
    return buildPlan({ checkIn: c, readiness, exercises: EXERCISES, historyFor: () => [], refLoads: {}, profile });
  };

  it('sem dor: tira só o que é carga alta e avisa nos moderados', () => {
    const p = lower(0);
    expect(p.items.map((i) => i.exerciseId)).toContain('leg_press_45');
    expect(p.items.find((i) => i.exerciseId === 'leg_press_45')?.notes?.join(' ')).toContain('Tendão');
    expect(p.corrective?.items.map((i) => i.id)).toContain('calf_iso_flat');
  });

  it('dor ≥ 5: sai dorsiflexão com carga, panturrilha vira amplitude curta', () => {
    const p = lower(6);
    const ids = p.items.map((i) => i.exerciseId);
    expect(ids).not.toContain('leg_press_45');
    expect(ids).not.toContain('seated_calf');
    expect(ids).toContain('calf_press_flat');
    expect(p.rules.find((r) => r.id === 'achilles')?.tone).toBe('warn');
    expect(p.corrective?.items.map((i) => i.id)).toContain('calf_iso_seated');
  });
});

describe('ajustes do dia', () => {
  it('músculo dolorido entra em manutenção sem subir carga', () => {
    const c = checkIn({ soreness: ['arms'] });
    const readiness = assessReadiness(c, null);
    const history = () => [{ date: 'd', sets: [10, 10, 10].map((r) => ({ load: 30, reps: r, at: 0 })) }];
    const p = buildPlan({ checkIn: c, readiness, exercises: EXERCISES, historyFor: history, refLoads: {} });
    const scott = p.items.find((i) => i.exerciseId === 'scott_curl_machine');
    if (scott) {
      expect(scott.target.action).not.toBe('increase');
      expect(scott.sets).toBe(2);
    }
    expect(p.rules.some((r) => r.id === 'recovery')).toBe(true);
  });

  it('força desigual nos unilaterais define o lado fraco', () => {
    const c = checkIn({ split: 'lower' });
    const readiness = assessReadiness(c, null);
    const lib = EXERCISES.map((e) => (e.id === 'leg_extension' ? { ...e, unilateral: true } : e));
    const p = buildPlan({ checkIn: c, readiness, exercises: lib, historyFor: () => [], refLoads: {}, sideStrength: (id) => (id === 'leg_extension' ? { L: 40, R: 46 } : null) });
    const it = p.items.find((i) => i.exerciseId === 'leg_extension')!;
    expect(it.weakSide).toBe('L');
    expect(it.extraSet).toBe(true);
  });

  it('descanso aprendido substitui o padrão', () => {
    const p = plan(checkIn(), false, { learnedRest: { pullup_assisted: 105 } });
    expect(p.items.find((i) => i.exerciseId === 'pullup_assisted')?.restSec).toBe(105);
  });

  it('técnicas: progredir sugere drop-set em máquina; recuperar sugere superlento; nunca em peso livre', () => {
    const push = plan(checkIn());
    const techs = push.items.filter((i) => i.technique);
    expect(techs.length).toBeGreaterThan(0);
    expect(techs.length).toBeLessThanOrEqual(2);
    for (const t of techs) expect(['machine', 'cable']).toContain(EXERCISES.find((e) => e.id === t.exerciseId)!.equipment);
    const rec = plan(checkIn({ sleepHours: 4, energy: 1, sleepQuality: 1 }));
    expect(rec.items.filter((i) => i.technique).map((i) => i.technique)).toEqual(['super_slow']);
  });
});

describe('avaliação funcional', () => {
  const test = { id: 't', date: '2026-10-26', dorsiflexionL: 7, dorsiflexionR: 11, calfRaiseL: 14, calfRaiseR: 22, overheadL: 'limited' as const, latWeak: 'L' as const, adamsHump: 'R' as const };

  it('traduz testes em achados com conduta', () => {
    const f = functionalFlags(test);
    expect(f).toMatchObject({ latWeak: 'L', dorsiflexionDeficit: 'L', calfDeficit: 'L', overheadLimited: ['L'] });
    const ids = analyzeFunctional(test, { achilles: { side: 'L' }, scoliosis: { shortSide: 'L' } }).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['dorsiflexion', 'calf', 'overhead_L', 'lat', 'adams']));
  });

  it('dorsal fraco entra no plano: puxada unilateral, lado fraco primeiro, série máxima', () => {
    const p = plan(checkIn(), false, { functional: functionalFlags(test) });
    const uni = p.items.find((i) => i.exerciseId === 'single_arm_pulldown');
    expect(uni).toMatchObject({ weakSide: 'L', extraSet: true, perSide: true });
    expect(uni!.notes!.join(' ')).toContain('mesmas reps');
  });

  it('ombro limitado põe alongamento do dorsal e ativação no aquecimento', () => {
    const p = plan(checkIn(), false, { functional: functionalFlags(test) });
    expect(p.corrective?.items.map((i) => i.id)).toEqual(expect.arrayContaining(['lat_stretch_L', 'lat_activation']));
  });

  it('pede reavaliação quando vence', () => {
    expect(reassessDue([], '2026-10-26')).toEqual({ due: true, days: null });
    expect(reassessDue([test], '2026-11-01').due).toBe(false);
    expect(reassessDue([test], '2026-12-10').due).toBe(true);
    expect(plan(checkIn(), false, { reassess: { due: true, days: null } }).rules.some((r) => r.id === 'reassess')).toBe(true);
  });
});

describe('postura e segurança', () => {
  it('super-série sai com a puxada primeiro', () => {
    const p = plan(checkIn({ timeAvailMin: 40 }));
    const row = p.items.findIndex((i) => i.exerciseId === 'seated_row_machine');
    const chest = p.items.findIndex((i) => i.exerciseId === 'incline_chest_machine');
    if (row >= 0 && chest >= 0 && p.items[row].supersetWith) expect(row).toBeLessThan(chest);
  });

  it('regra das 24 h: piorou → proteção do tendão mesmo com dor baixa', () => {
    const r = assessReadiness(checkIn({ tendonPain: 1, tendonWorse: true }), { spineCare: false, achilles: { side: 'L' } });
    expect(r.flags.ankleLevel).toBe(2);
    expect(r.rules.find((x) => x.id === 'achilles')?.detail).toContain('24 h');
  });

  it('formigamento ou dor que irradia: sessão leve, sem coluna, com alerta', () => {
    const r = assessReadiness(checkIn({ radiating: true }), null);
    expect(r.tier).toBe('recover');
    expect(r.flags.noAxial).toBe(true);
    expect(r.rules[0].id).toBe('red_flag');
  });

  it('série máxima: só depois das séries normais dos dois lados', () => {
    const item: PlannedExercise = { exerciseId: 'x', sets: 2, restSec: 45, target: { load: 5, reps: 12, action: 'hold', reason: '' }, perSide: true, weakSide: 'L', extraSet: true };
    const s = (...sides: ('L' | 'R')[]): SetLog[] => sides.map((side, i) => ({ load: 5, reps: 10, at: i, side }));
    expect(isAmrapNext(s('L', 'R', 'L'), item)).toBe(false);
    expect(isAmrapNext(s('L', 'R', 'L', 'R'), item)).toBe(true);
  });

  it('série máxima fica fora da comparação de força entre lados', () => {
    const sess = {
      id: 's', split: 'upper', date: '2026-10-26', startedAt: 1, endedAt: 2,
      entries: [{ exerciseId: 'x', sets: [{ load: 20, reps: 10, at: 1, side: 'L' }, { load: 20, reps: 10, at: 2, side: 'R' }, { load: 20, reps: 20, at: 3, side: 'L', amrap: true }] }],
    } as unknown as Session;
    const s = lastSideStrength([sess], 'x')!;
    expect(s.L).toBeCloseTo(s.R);
  });

  it('volume semanal: unilateral E + D conta 1 série', () => {
    const sess = {
      id: 's', split: 'upper', date: '2026-10-27', startedAt: 1, endedAt: 2,
      entries: [
        { exerciseId: 'seated_row_machine', sets: [1, 2, 3].map((at) => ({ load: 40, reps: 10, at })) },
        { exerciseId: 'single_arm_pulldown', sets: ['L', 'R', 'L', 'R'].map((side, at) => ({ load: 20, reps: 10, at, side })) },
      ],
    } as unknown as Session;
    expect(weeklySetsByMuscle([sess], '2026-10-26').get('back')).toBe(5);
  });
});

describe('energia e dieta', () => {
  const user = { sex: 'M' as const, age: 38, weightKg: 79.5, leanKg: 71.9 };
  const PLAN: Meal[] = [
    { id: 'a', name: 'Café', time: '09:00', items: [{ foodId: 'chicken_breast', grams: 100 }, { foodId: 'egg', grams: 200 }, { foodId: 'mozzarella', grams: 20 }, { foodId: 'parmesan', grams: 20 }] },
    { id: 'b', name: 'Almoço', time: '13:00', items: [{ foodId: 'chicken_breast', grams: 200 }, { foodId: 'spinach', grams: 200 }, { foodId: 'white_rice', grams: 100 }] },
    { id: 'c', name: 'Tarde', time: '16:30', items: [{ foodId: 'yogurt_plain', grams: 200 }, { foodId: 'almonds', grams: 20 }, { foodId: 'chia', grams: 10 }] },
    { id: 'd', name: 'Jantar', time: '19:00', items: [{ foodId: 'egg', grams: 200 }, { foodId: 'parmesan', grams: 10 }, { foodId: 'mozzarella', grams: 10 }, { foodId: 'banana', grams: 100 }] },
  ];

  it('Katch-McArdle e componentes do gasto', () => {
    const rest = dailyEnergy({ ...user, trainingMin: 0 });
    expect(rest.method).toBe('Katch-McArdle');
    expect(rest.bmr).toBe(Math.round(370 + 21.6 * 71.9));
    const hard = dailyEnergy({ ...user, trainingMin: 70, work: { sittingH: 8, standingH: 3.5 } });
    expect(hard.standing).toBe(Math.round(1.7 * 79.5 * 3.5));
    expect(hard.total).toBeGreaterThan(rest.total + 700);
  });

  it('agenda vira demanda do dia', () => {
    expect(dayLoadFromWork({ sittingH: 8, standingH: 0 })).toBe('light');
    expect(dayLoadFromWork({ sittingH: 8, standingH: 3.5 })).toBe('standing');
    expect(dayLoadFromWork({ sittingH: 0, standingH: 4.5 })).toBe('standing');
    expect(dayLoadFromWork({ sittingH: 8, standingH: 5 })).toBe('double');
    expect(hoursBetween('19:30', '23:00')).toBe(3.5);
    expect(hoursBetween('22:00', '01:00')).toBe(3);
  });

  it('carboidrato acompanha o dia; proteína e gordura fixas', () => {
    const rest = macroTargets(dailyEnergy({ ...user, trainingMin: 0 }), 'recomp', 79.5, 71.9, false);
    const hard = macroTargets(dailyEnergy({ ...user, trainingMin: 70, work: { sittingH: 8, standingH: 3.5 } }), 'recomp', 79.5, 71.9, true, 3.5);
    expect(hard.protein).toBe(rest.protein);
    expect(hard.fat).toBe(rest.fat);
    expect(hard.carbs).toBeGreaterThan(rest.carbs + 150);
    expect(hard.waterL).toBeGreaterThan(rest.waterL);
  });

  it('plano base atual: ~1.850 kcal, proteína alta, carbo baixo', () => {
    const m = planMacros(PLAN);
    expect(m.kcal).toBeGreaterThan(1650);
    expect(m.kcal).toBeLessThan(1950);
    expect(m.protein).toBeGreaterThan(155);
    expect(m.carbs).toBeLessThan(90);
  });

  it('leitura aponta déficit e carbo baixo; complemento fecha o carboidrato', () => {
    const m = planMacros(PLAN);
    const rest = macroTargets(dailyEnergy({ ...user, trainingMin: 0 }), 'recomp', 79.5, 71.9, false);
    const hard = macroTargets(dailyEnergy({ ...user, trainingMin: 70, work: { sittingH: 8, standingH: 3.5 } }), 'recomp', 79.5, 71.9, true, 3.5);
    const ids = analyzeDiet(m, rest, hard, { weightKg: 79.5, meals: PLAN, achilles: true, shiftDays: 2 }).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['deficit', 'carbs', 'protein', 'collagen', 'caffeine']));
    const tops = dailyTopUps(m, hard, { trained: true, standing: true });
    const added = tops.reduce((a, t) => a + t.carbs, 0);
    expect(m.carbs + added).toBeGreaterThan(hard.carbs * 0.85);
    expect(tops.some((t) => t.when.includes('turno'))).toBe(true);
  });
});

describe('dados reais vencem a fórmula', () => {
  it('peso estável comendo menos que a fórmula ⇒ fator < 1, com limites', () => {
    expect(calibrationFactor(1900, 2600)).toBeCloseTo(0.73, 2);
    expect(calibrationFactor(800, 2600)).toBe(0.6);
    expect(calibrationFactor(4000, 2600)).toBe(1.3);
    const e = dailyEnergy({ sex: 'M', age: 38, weightKg: 79.5, leanKg: 71.9, trainingMin: 70, walkMin: 15, calibration: 0.75 });
    expect(e.walk).toBeGreaterThan(0);
    expect(Math.abs(e.total - e.formula * 0.75)).toBeLessThanOrEqual(1);
  });

  it('jejum + carbo só no almoço: nada antes do treino nem no café', () => {
    const base = { kcal: 1850, protein: 180, carbs: 80, fat: 85, fiber: 15 };
    const target = { kcal: 2600, protein: 158, fat: 72, carbs: 400, waterL: 4 };
    const tops = dailyTopUps(base, target, { trained: true, standing: true, fasted: true, allowed: ['lunch', 'preShift'] });
    expect(tops.length).toBeGreaterThan(0);
    for (const t of tops) expect(t.when).toMatch(/Almoço|turno/);
  });

  it('6 h de sono após turno: treino normal sem recorde; < 6 h: proteção', () => {
    const six = assessReadiness(checkIn({ sleepHours: 6, energy: 4 }), null);
    expect(six.tier).not.toBe('push');
    expect(six.flags.machinesOnly).toBe(false);
    expect(six.rules.some((r) => r.id === 'short_sleep')).toBe(true);
    expect(assessReadiness(checkIn({ sleepHours: 5.5 }), null).flags.machinesOnly).toBe(true);
  });

  it('check-in já vem com ~6 h depois de noite de turno até tarde', () => {
    const week = { '5': { split: 'auto' as const, timeAvailMin: 70, dayLoad: 'standing' as const, work: { sittingH: 8, standingH: 3.5, standingStart: '19:30', standingEnd: '23:00' } } };
    expect(sleepGuess('2026-10-31', week)).toBe(6); // sábado, depois da sexta de turno
    expect(sleepGuess('2026-10-28', week)).toBe(7.5);
  });
});

describe('carboidrato sem sono', () => {
  it('troca equivalente mantém o macro principal', () => {
    expect(equivalentGrams('white_rice', 100, 'sweet_potato')).toBe(140);
    expect(equivalentGrams('white_rice', 200, 'sweet_potato')).toBe(280);
    expect(equivalentGrams('chicken_breast', 200, 'salmon')).toBe(310);
  });

  it('evitar picos: IG baixo no almoço e porção maior no jantar', () => {
    const base = { kcal: 1850, protein: 180, carbs: 80, fat: 85, fiber: 15 };
    const target = { kcal: 2400, protein: 158, fat: 72, carbs: 260, waterL: 4 };
    const tops = dailyTopUps(base, target, { trained: true, standing: false, fasted: true, avoidSpikes: true });
    const lunch = tops.find((t) => t.when === 'Almoço')!;
    const dinner = tops.find((t) => t.when === 'Jantar')!;
    expect(foodById(lunch.foodId)?.gi).toBe('low');
    expect(dinner.carbs).toBeGreaterThan(lunch.carbs);
  });

  it('leitura: low-carb não é cetogênica e sugere troca do arroz', () => {
    const meals: Meal[] = [{ id: 'x', name: 'Almoço', time: '13:00', items: [{ foodId: 'chicken_breast', grams: 200 }, { foodId: 'white_rice', grams: 100 }] }];
    const t = { kcal: 2400, protein: 158, fat: 72, carbs: 260, waterL: 4 };
    const f = analyzeDiet(planMacros(meals), t, t, { weightKg: 79.5, meals, achilles: false, shiftDays: 0, avoidSpikes: true });
    expect(f.find((x) => x.id === 'lowcarb')?.title).toContain('não cetogênica');
    expect(f.find((x) => x.id === 'gi')?.detail).toContain('140 g de batata-doce cozida');
  });
});

describe('ingestão planejada por dia', () => {
  it('soma extras do turno e extras fixos do dia (pizza de domingo)', () => {
    const s = migrate(null);
    s.settings.mealPlan = [{ id: 'm', name: 'Almoço', time: '13:00', items: [{ foodId: 'chicken_breast', grams: 200 }] }];
    s.settings.shiftExtras = [{ foodId: 'banana', grams: 100 }];
    s.settings.dayExtras = { '0': [{ foodId: 'pizza_margherita', grams: 220 }] };
    s.settings.week = { '5': { split: 'auto', timeAvailMin: 70, dayLoad: 'standing', work: { sittingH: 8, standingH: 3.5 } } };
    const base = plannedIntake(s, '2026-10-28')!.kcal; // quarta
    expect(plannedIntake(s, '2026-10-30')!.kcal).toBeCloseTo(base + 89, 0); // sexta: turno
    expect(plannedIntake(s, '2026-11-01')!.kcal).toBeCloseTo(base + 517, 0); // domingo: pizza
  });
});

describe('turnos sob chamada', () => {
  const week = {
    '3': { split: 'auto' as const, timeAvailMin: 70, dayLoad: 'light' as const, work: { sittingH: 8, standingH: 0 } },
    '6': { split: 'auto' as const, timeAvailMin: 90, dayLoad: 'standing' as const, work: { sittingH: 0, standingH: 4.5, standingStart: '18:30', standingEnd: '23:00' } },
  };

  it('data marcada vale mais que o padrão; null cancela o turno fixo', () => {
    const dates = { '2026-10-28': { start: '19:30', end: '22:30' }, '2026-11-07': null };
    expect(workFor('2026-10-28', week, dates)).toMatchObject({ sittingH: 8, standingH: 3, standingEnd: '22:30' }); // quarta avulsa
    expect(workFor('2026-11-04', week, dates)?.standingH).toBe(0); // quarta sem turno
    expect(workFor('2026-10-31', week, dates)?.standingH).toBe(4.5); // sábado padrão
    expect(workFor('2026-11-07', week, dates)?.standingH).toBe(0); // sábado cancelado
  });

  it('turno avulso muda demanda do check-in e o sono da manhã seguinte', () => {
    const dates = { '2026-10-28': { start: '19:30', end: '22:30' } };
    expect(dayDefaults('2026-10-28', week, undefined, [], ['upper', 'lower'], dates).dayLoad).toBe('standing');
    expect(dayDefaults('2026-10-29', week, undefined, [], ['upper', 'lower'], dates).sleepGuess).toBe(6);
    expect(dayDefaults('2026-11-05', week, undefined, [], ['upper', 'lower'], dates).sleepGuess).toBe(7.5);
  });

  it('extras de turno entram só nos dias com turno de verdade', () => {
    const s = migrate(null);
    s.settings.mealPlan = [{ id: 'm', name: 'Almoço', time: '13:00', items: [{ foodId: 'chicken_breast', grams: 200 }] }];
    s.settings.shiftExtras = [{ foodId: 'banana', grams: 100 }];
    s.settings.week = week;
    s.settings.shiftDates = { '2026-10-28': { start: '19:30', end: '22:30' } };
    const plain = plannedIntake(s, '2026-11-04')!.kcal;
    expect(plannedIntake(s, '2026-10-28')!.kcal).toBeCloseTo(plain + 89, 0);
  });
});

describe('importação de dados iniciais', () => {
  it('mescla sem apagar o que já existe', () => {
    const cur = { ...migrate(null), settings: { ...migrate(null).settings, refLoads: { a: 50 } } };
    cur.sessions = [{ id: 's' } as unknown as Session];
    const seed = { ...migrate(null), settings: { ...migrate(null).settings, refLoads: { a: 10, b: 20 }, mealPlan: [{ id: 'm', name: 'x', time: '09:00', items: [] }] } };
    seed.settings.trainsFasted = true;
    seed.settings.carbSlots = ['lunch'];
    const out = mergeSeed(cur, seed);
    expect(out.sessions).toHaveLength(1);
    expect(out.settings.refLoads).toEqual({ a: 50, b: 20 });
    expect(out.settings.mealPlan).toHaveLength(1);
    expect(out.settings.trainsFasted).toBe(true);
    expect(out.settings.carbSlots).toEqual(['lunch']);
  });
});

describe('alternância', () => {
  const sess = (split: string, t: number) => ({ split, date: '2026-10-25', startedAt: t, endedAt: t + 1, entries: [] }) as unknown as Session;

  it('Superior ↔ Inferior a partir do último treino', () => {
    expect(nextInRotation([], ['upper', 'lower'])).toBe('upper');
    expect(nextInRotation([sess('upper', 1)], ['upper', 'lower'])).toBe('lower');
    expect(nextInRotation([sess('upper', 1), sess('lower', 2)], ['upper', 'lower'])).toBe('upper');
  });

  it('dia "Livre (alterna)" usa a rotação com o tempo do dia', () => {
    const d = dayDefaults('2026-10-26', { '1': { split: 'auto', timeAvailMin: 90, dayLoad: 'light' } }, undefined, [sess('upper', 1)], ['upper', 'lower']);
    expect(d).toMatchObject({ split: 'lower', timeAvailMin: 90, source: 'rotation' });
  });
});

describe('histórico', () => {
  it('sugere o split nunca treinado', () => {
    const s = { split: 'upper', date: '2026-10-25', startedAt: 1, endedAt: 2, entries: [] } as unknown as Session;
    expect(suggestSplit([s], '2026-10-26', ['upper', 'lower']).split).toBe('lower');
  });
});

describe('Obsidian', () => {
  it('gera frontmatter compatível com Dataview', () => {
    const c = checkIn();
    const md = buildDailyNote({ date: c.date, checkIn: c, readiness: assessReadiness(c, null) });
    expect(md.startsWith('---\ndate: 2026-10-26\ntype: adaptive-fit\n')).toBe(true);
    expect(md).toContain('readiness: ');
    expect(md).toContain('tags: [treino, adaptive-fit]');
  });

  it('codifica o URI sem "+" para espaços', () => {
    const uri = obsidianNewUri('Meu Vault', 'Treino/2026-10-26 Adaptive Fit', '# Olá mundo');
    expect(uri).toContain('vault=Meu%20Vault');
    expect(uri).not.toContain('+');
  });
});

describe('dados', () => {
  it('importa o backup do protótipo antigo', () => {
    const [a] = fromLegacy([{ date: '2026-10-19', weight: 79.2, condition: 'Pos-Treino (Pump)', bf: 10.4, sumFolds: 56, foreR: 30.8, foreL: 28.8 }]);
    expect(a.condition).toBe('post_workout');
    expect(a.perimeters.forearmL).toBe(28.8);
    expect(a.result?.protocol).toBe('recorded');
  });

  it('parseBackup reconhece os dois formatos e migra estado vazio', () => {
    expect(parseBackup('[{"date":"2026-01-01","weight":80}]').kind).toBe('legacy');
    expect(parseBackup(JSON.stringify(migrate(null))).kind).toBe('full');
    expect(() => migrate({ schemaVersion: 99 })).toThrow();
  });

  it('migra v1 → atual convertendo os splits antigos', () => {
    const v1 = { schemaVersion: 1, profile: null, settings: { obsidianVault: '', obsidianFolder: 'Treino', refLoads: { a: 1 } }, checkIns: [{ split: 'legs' }], sessions: [{ split: 'upper_full' }, { split: 'pull' }], assessments: [] };
    const s = migrate(v1);
    expect(s.schemaVersion).toBe(3);
    expect(s.functionalTests).toEqual([]);
    expect(s.checkIns[0].split).toBe('lower');
    expect(s.sessions.map((x) => x.split)).toEqual(['upper', 'upper']);
    expect(s.settings).toMatchObject({ refLoads: { a: 1 }, hiddenExercises: [], week: {} });
    expect(s.customExercises).toEqual([]);
  });

  it('merge não duplica datas', () => {
    const [a] = fromLegacy([{ date: '2026-01-01', weight: 80 }]);
    expect(mergeAssessments([a], [a])).toHaveLength(1);
  });
});

describe('utilitários', () => {
  it('data local e idade', () => {
    expect(localISODate(new Date(2026, 9, 26, 23, 30))).toBe('2026-10-26');
    expect(ageOn('1988-10-27', '2026-10-26')).toBe(37);
    expect(ageOn('1988-10-26', '2026-10-26')).toBe(38);
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(weekStart('2026-11-01')).toBe('2026-10-26');
  });

  it('aceita vírgula decimal', () => {
    expect(parseNum('37,5')).toBe(37.5);
    expect(parseNum('')).toBeUndefined();
  });
});
