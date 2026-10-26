const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const fmtNum = (n: number) => nf.format(n);
export const fmtKg = (n: number) => `${fmtNum(n)} kg`;

export function fmtDuration(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Aceita vírgula decimal (teclado pt-BR). */
export function parseNum(text: string): number | undefined {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export const round = (v: number, digits = 1) => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
