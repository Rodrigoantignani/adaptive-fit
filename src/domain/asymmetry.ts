import { round } from '../lib/format';
import type { PerimeterSite } from './types';

export const BILATERAL_PAIRS: { key: string; label: string; r: PerimeterSite; l: PerimeterSite }[] = [
  { key: 'biceps', label: 'Bíceps', r: 'bicepsR', l: 'bicepsL' },
  { key: 'forearm', label: 'Antebraço', r: 'forearmR', l: 'forearmL' },
  { key: 'thigh', label: 'Coxa', r: 'thighR', l: 'thighL' },
  { key: 'calf', label: 'Panturrilha', r: 'calfR', l: 'calfL' },
];

export interface AsymmetryItem {
  key: string;
  label: string;
  right: number;
  left: number;
  diffCm: number;
  diffPct: number;
  smaller: 'R' | 'L' | null;
  /** ok < 3% (normal pelo lado dominante) · watch 3–5% · act ≥ 5% */
  level: 'ok' | 'watch' | 'act';
}

export function analyzeAsymmetry(perimeters: Partial<Record<PerimeterSite, number>>): AsymmetryItem[] {
  return BILATERAL_PAIRS.flatMap(({ key, label, r, l }) => {
    const right = perimeters[r];
    const left = perimeters[l];
    if (!right || !left) return [];
    const diffCm = round(Math.abs(right - left));
    const diffPct = round((diffCm / Math.max(right, left)) * 100);
    const level: AsymmetryItem['level'] = diffPct >= 5 ? 'act' : diffPct >= 3 ? 'watch' : 'ok';
    const smaller = right === left ? null : right < left ? 'R' : 'L';
    return [{ key, label, right, left, diffCm, diffPct, smaller, level }];
  });
}

export function asymmetryAdvice(item: AsymmetryItem): string | null {
  if (item.level === 'ok' || !item.smaller) return null;
  const side = item.smaller === 'L' ? 'esquerdo' : 'direito';
  return item.level === 'act'
    ? `Comece os unilaterais pelo lado ${side}, iguale as reps do lado mais fraco e considere 1 série extra só para ele.`
    : `Fique de olho: comece os unilaterais pelo lado ${side}.`;
}
