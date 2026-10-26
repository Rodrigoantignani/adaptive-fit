import { describe, expect, it } from 'vitest';
import { ageOn, localISODate, weekStart } from '../lib/date';
import { parseNum } from '../lib/format';
import { fromLegacy, mergeAssessments, migrate, parseBackup } from '../data/schema';
import { analyzeAsymmetry } from './asymmetry';
import { bodyDensity, computeBodyComp, siri } from './bodycomp';
import { activeLibrary, EXERCISES, newExercise } from './exercises';
import { suggestSplit } from './history';
import { buildDailyNote, obsidianNewUri } from './obsidian';
import { buildPlan, estimateSeconds, nextSide, setCount } from './planner';
import { nextTarget } from './progression';
import { assessReadiness } from './readiness';
import { dayDefaults } from './routine';
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
    const r = assessReadiness(checkIn({ sleepHours: 6, energy: 5, sleepQuality: 5 }), null);
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

  it('dia de máquinas troca barra fixa por puxada e tira a roda abdominal', () => {
    const p = plan(checkIn({ sleepHours: 5.5 }));
    const ids = p.items.map((i) => i.exerciseId);
    expect(ids).toContain('lat_pulldown');
    expect(ids).not.toContain('pullup');
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

  it('migra v1 → v2 convertendo os splits antigos', () => {
    const v1 = { schemaVersion: 1, profile: null, settings: { obsidianVault: '', obsidianFolder: 'Treino', refLoads: { a: 1 } }, checkIns: [{ split: 'legs' }], sessions: [{ split: 'upper_full' }, { split: 'pull' }], assessments: [] };
    const s = migrate(v1);
    expect(s.schemaVersion).toBe(2);
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
