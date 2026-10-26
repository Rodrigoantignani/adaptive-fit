import { formatBR } from '../lib/date';
import { fmtNum, round } from '../lib/format';
import { analyzeAsymmetry } from './asymmetry';
import { exerciseById } from './exercises';
import { sessionTotals, setVolume } from './history';
import { CONDITION_LABEL, PERIMETER_LABEL, SPLIT_LABEL, TIER_LABEL } from './labels';
import { bestE1rm } from './progression';
import type { BodyAssessment, CheckIn, PerimeterSite, Readiness, Session } from './types';

export interface NoteInput {
  date: string;
  checkIn?: CheckIn | null;
  readiness?: Readiness | null;
  session?: Session | null;
  assessment?: BodyAssessment | null;
}

type Yaml = string | number | boolean | string[];

const yamlValue = (v: Yaml): string => {
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (typeof v === 'string' && !/^[\w.-]+$/.test(v)) return JSON.stringify(v);
  return String(v);
};

const snake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();

/** Nota diária em Markdown com frontmatter YAML pronto para Dataview. */
export function buildDailyNote({ date, checkIn, readiness, session, assessment }: NoteInput): string {
  const fm: [string, Yaml][] = [
    ['date', date],
    ['type', 'adaptive-fit'],
  ];
  const body: string[] = [];
  const title = session ? `Treino · ${SPLIT_LABEL[session.split]}` : assessment ? 'Avaliação corporal' : 'Check-in';
  body.push(`# ${title} (${formatBR(date)})`, '');

  if (checkIn && readiness) {
    fm.push(
      ['readiness', readiness.score],
      ['tier', readiness.tier],
      ['sleep_hours', checkIn.sleepHours],
      ['sleep_quality', checkIn.sleepQuality],
      ['energy', checkIn.energy],
      ['day_load', checkIn.dayLoad],
      ['split', checkIn.split],
    );
    body.push(
      `> Prontidão **${readiness.score}/100** · ${TIER_LABEL[readiness.tier]} · Sono ${fmtNum(checkIn.sleepHours)} h · Energia ${checkIn.energy}/5`,
      '',
    );
  }

  const rules = session?.rules ?? readiness?.rules ?? [];
  if (rules.length) {
    body.push('## Diretrizes do dia');
    for (const r of rules) body.push(`- **${r.title}:** ${r.detail}`);
    body.push('');
  }

  if (session?.corrective) {
    body.push(`## ${session.corrective.title}`);
    for (const c of session.corrective.items) body.push(`- [ ] **${c.title}** (${c.dose})`);
    body.push('');
  }

  if (session) {
    const t = sessionTotals(session);
    fm.push(['session_sets', t.sets], ['session_volume_kg', t.volume], ['session_minutes', t.minutes]);
    body.push('## Execução', '', '| Exercício | Séries (carga × reps) | Volume | 1RM est. |', '|---|---|---|---|');
    for (const entry of session.entries) {
      if (!entry.sets.length) continue;
      const ex = exerciseById(entry.exerciseId);
      const sets = entry.sets.map((s) => `${s.side ? (s.side === 'L' ? 'E ' : 'D ') : ''}${fmtNum(s.load)}×${s.reps}`).join(' · ');
      const vol = Math.round(entry.sets.reduce((a, s) => a + setVolume(s, ex), 0));
      body.push(`| ${ex?.name ?? entry.exerciseId} | ${sets} ${ex?.loadUnit ?? 'kg'} | ${fmtNum(vol)} kg | ${fmtNum(round(bestE1rm(entry.sets)))} |`);
    }
    body.push('', `**Total:** ${t.sets} séries · ${fmtNum(t.volume)} kg · ${t.minutes} min`, '');
  }

  if (assessment) {
    const a = assessment;
    fm.push(['weight_kg', a.weightKg], ['measure_condition', a.condition]);
    body.push('## Avaliação corporal', `- **Peso:** ${fmtNum(a.weightKg)} kg · ${CONDITION_LABEL[a.condition]}`);
    if (a.result) {
      fm.push(['bf_percent', a.result.bfPercent], ['lean_kg', a.result.leanKg], ['fat_kg', a.result.fatKg], ['sum_skinfolds_mm', a.result.sumFolds]);
      body.push(
        `- **Gordura:** ${fmtNum(a.result.bfPercent)}% (${a.result.protocol}) · **Massa magra:** ${fmtNum(a.result.leanKg)} kg · **Soma de dobras:** ${fmtNum(a.result.sumFolds)} mm`,
      );
    }
    const per = Object.entries(a.perimeters) as [PerimeterSite, number][];
    for (const [site, v] of per) fm.push([`${snake(site)}_cm`, v]);
    if (per.length) body.push(`- **Perímetros:** ${per.map(([s, v]) => `${PERIMETER_LABEL[s]} ${fmtNum(v)}`).join(' · ')} cm`);
    for (const item of analyzeAsymmetry(a.perimeters)) {
      if (item.level !== 'ok') body.push(`- **Assimetria ${item.label}:** Δ ${fmtNum(item.diffCm)} cm (${fmtNum(item.diffPct)}%)`);
    }
    body.push('');
  }

  fm.push(['tags', ['treino', 'adaptive-fit']]);
  const yaml = fm.map(([k, v]) => `${k}: ${yamlValue(v)}`).join('\n');
  return `---\n${yaml}\n---\n\n${body.join('\n').trimEnd()}\n`;
}

export function notePath(folder: string, date: string): string {
  const clean = folder.trim().replace(/^\/+|\/+$/g, '');
  return `${clean ? clean + '/' : ''}${date} Adaptive Fit`;
}

/** Cria/sobrescreve a nota direto no Obsidian (desktop e mobile). */
export function obsidianNewUri(vault: string, path: string, content: string): string {
  const enc = encodeURIComponent;
  return `obsidian://new?vault=${enc(vault)}&file=${enc(path)}&content=${enc(content)}&overwrite=true`;
}

export function dataviewSnippet(folder: string): string {
  return [
    '```dataview',
    'TABLE readiness AS "Prontidão", tier AS "Modo", session_volume_kg AS "Volume (kg)", weight_kg AS "Peso", bf_percent AS "BF %"',
    `FROM "${folder.trim() || '/'}"`,
    'WHERE type = "adaptive-fit"',
    'SORT date DESC',
    '```',
  ].join('\n');
}
