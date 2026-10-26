import { clamp, fmtNum } from '../lib/format';
import type { CheckIn, DayLoad, Profile, Readiness, ReadinessFlags, Rule, Tier, Tone } from './types';

const DAY_LOAD_ADJ: Record<DayLoad, number> = { off: 5, light: 0, standing: -10, double: -20 };

/**
 * Prontidão 0–100: média ponderada de sono e energia percebida,
 * ajustada pela demanda física do dia e por dores.
 */
export function assessReadiness(c: CheckIn, profile: Pick<Profile, 'spineCare' | 'achilles'> | null): Readiness {
  const hoursScore = clamp((c.sleepHours - 4) / 4, 0, 1) * 100;
  const qualityScore = ((c.sleepQuality - 1) / 4) * 100;
  const sleepScore = 0.7 * hoursScore + 0.3 * qualityScore;
  const energyScore = ((c.energy - 1) / 4) * 100;
  const loadAdj = DAY_LOAD_ADJ[c.dayLoad];
  const soreAdj = c.soreness.reduce((acc, s) => acc + (s === 'lower_back' ? -15 : -5), 0);
  const tendon = profile?.achilles ? (c.tendonPain ?? 0) : 0;
  const tendonAdj = tendon >= 5 ? -10 : 0;

  const score = Math.round(clamp(0.55 * sleepScore + 0.45 * energyScore + loadAdj + soreAdj + tendonAdj, 0, 100));
  const toneOf = (v: number): Tone => (v >= 70 ? 'good' : v >= 45 ? 'info' : 'warn');
  const factors: Readiness['factors'] = [
    { label: `Sono ${fmtNum(c.sleepHours)} h · qualidade ${c.sleepQuality}/5`, value: `${Math.round(sleepScore)}`, tone: toneOf(sleepScore) },
    { label: `Energia ${c.energy}/5`, value: `${Math.round(energyScore)}`, tone: toneOf(energyScore) },
  ];
  if (loadAdj) factors.push({ label: 'Demanda do dia', value: loadAdj > 0 ? `+${loadAdj}` : `${loadAdj}`, tone: loadAdj > 0 ? 'good' : 'warn' });
  if (soreAdj) factors.push({ label: 'Dores', value: `${soreAdj}`, tone: 'warn' });
  if (profile?.achilles) {
    factors.push({ label: 'Tendão de Aquiles', value: `${tendon}/10`, tone: tendon >= 5 ? 'warn' : tendon >= 3 ? 'info' : 'good' });
  }

  let tier: Tier = score >= 70 ? 'push' : score >= 45 ? 'maintain' : 'recover';
  const cns = c.sleepHours < 6.5 || c.dayLoad === 'double';
  if (cns && tier === 'push') tier = 'maintain';

  const noAxial = Boolean(profile?.spineCare) || c.spineAlert || c.soreness.includes('lower_back');
  const noHighCore = c.soreness.includes('core') || c.soreness.includes('lower_back');

  const rules: Rule[] = [];
  if (tier === 'push') {
    rules.push({ id: 'progress', tone: 'good', title: 'Janela de progressão', detail: 'Prontidão alta: suba carga onde a progressão indicar e busque +1 rep nas demais.' });
  }
  if (tier === 'recover') {
    rules.push({ id: 'recover', tone: 'warn', title: 'Sessão de recuperação', detail: 'Uma série a menos por exercício, sem subir carga e +30 s de descanso. Hoje, treinar leve rende mais que forçar.' });
  }
  if (cns) {
    const why = c.sleepHours < 6.5 ? 'Sono curto' : 'Turno duplo';
    rules.push({ id: 'cns', tone: 'warn', title: 'Proteção do sistema nervoso', detail: `${why}: volume reduzido, só máquinas guiadas e 5 min de alongamento de descompressão antes de dormir.` });
  }
  if (noAxial) {
    rules.push({ id: 'spine', tone: 'info', title: 'Anti-compressão axial', detail: 'Nada de carga apoiada na coluna (agachamento livre, stiff, desenvolvimento em pé). Prefira apoio dorsal ou peitoral.' });
  }
  if (noHighCore) {
    rules.push({ id: 'core', tone: 'info', title: 'Core em recuperação', detail: 'Sem exercícios que exijam estabilização intensa do abdômen.' });
  }

  const ankleLevel: ReadinessFlags['ankleLevel'] = !profile?.achilles ? 0 : tendon >= 5 ? 2 : 1;
  if (ankleLevel === 2) {
    rules.push({
      id: 'achilles',
      tone: 'warn',
      title: 'Proteção do tendão de Aquiles',
      detail: `Dor ${tendon}/10: hoje saem panturrilha e exercícios com dorsiflexão sob carga. Isometria leve no aquecimento ajuda na dor. Se não melhorar em alguns dias, procure avaliação.`,
    });
  } else if (ankleLevel === 1) {
    rules.push({
      id: 'achilles',
      tone: 'info',
      title: 'Tendão de Aquiles monitorado',
      detail: 'Sem panturrilha no degrau (alongar o tendão sob carga irrita o Haglund). Dor até 3/10 durante o treino é aceitável se passar até a manhã seguinte.',
    });
  }

  return {
    score,
    tier,
    factors,
    flags: { machinesOnly: cns, noAxial, noHighCore, reducedVolume: cns, ankleLevel },
    rules,
  };
}
