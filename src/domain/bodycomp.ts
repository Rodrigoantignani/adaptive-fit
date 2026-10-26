import { clamp, round } from '../lib/format';
import type { BodyCompResult, Sex, SkinfoldSite } from './types';

/** Jackson & Pollock 7 dobras (ambos os sexos). */
export const JP7_SITES: SkinfoldSite[] = [
  'chest',
  'midaxillary',
  'triceps',
  'subscapular',
  'abdominal',
  'suprailiac',
  'thigh',
];

/** Jackson & Pollock 3 dobras: sítios diferentes por sexo. */
export const JP3_SITES: Record<Sex, SkinfoldSite[]> = {
  M: ['chest', 'abdominal', 'thigh'],
  F: ['triceps', 'suprailiac', 'thigh'],
};

type Folds = Partial<Record<SkinfoldSite, number>>;

const hasAll = (f: Folds, sites: SkinfoldSite[]) => sites.every((s) => (f[s] ?? 0) > 0);
const sumOf = (f: Folds, sites: SkinfoldSite[]) => sites.reduce((acc, s) => acc + (f[s] ?? 0), 0);

export function bodyDensity(protocol: 'JP7' | 'JP3', sex: Sex, sum: number, age: number): number {
  const s2 = sum * sum;
  if (protocol === 'JP7') {
    return sex === 'M'
      ? 1.112 - 0.00043499 * sum + 0.00000055 * s2 - 0.00028826 * age
      : 1.097 - 0.00046971 * sum + 0.00000056 * s2 - 0.00012828 * age;
  }
  return sex === 'M'
    ? 1.10938 - 0.0008267 * sum + 0.0000016 * s2 - 0.0002574 * age
    : 1.0994921 - 0.0009929 * sum + 0.0000023 * s2 - 0.0001392 * age;
}

/** Equação de Siri (1961). */
export const siri = (density: number) => 495 / density - 450;

/** Protocolo que será usado com as dobras preenchidas (JP7 tem prioridade). */
export function pickProtocol(sex: Sex, folds: Folds): 'JP7' | 'JP3' | null {
  if (hasAll(folds, JP7_SITES)) return 'JP7';
  if (hasAll(folds, JP3_SITES[sex])) return 'JP3';
  return null;
}

export function computeBodyComp(input: {
  sex: Sex;
  age: number;
  weightKg: number;
  skinfolds: Folds;
}): BodyCompResult | null {
  const { sex, age, weightKg, skinfolds } = input;
  const protocol = pickProtocol(sex, skinfolds);
  if (!protocol || weightKg <= 0) return null;

  const sites = protocol === 'JP7' ? JP7_SITES : JP3_SITES[sex];
  const density = bodyDensity(protocol, sex, sumOf(skinfolds, sites), age);
  const bfPercent = round(clamp(siri(density), 2, 60));
  const fatKg = round((weightKg * bfPercent) / 100);
  const allSites = Object.keys(skinfolds) as SkinfoldSite[];

  return {
    protocol,
    bfPercent,
    fatKg,
    leanKg: round(weightKg - fatKg),
    sumFolds: round(sumOf(skinfolds, allSites)),
    density: round(density, 5),
  };
}
