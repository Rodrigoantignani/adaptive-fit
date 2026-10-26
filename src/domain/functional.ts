import { daysBetween } from '../lib/date';
import { fmtNum } from '../lib/format';
import { SIDE_LABEL } from './labels';
import type { Finding, FunctionalTest, Profile, Side } from './types';

/** Reavaliar a cada ~6 semanas: o que não é medido de novo não é gerenciado. */
export const REASSESS_DAYS = 42;

/** Referências práticas usadas em clínica (não são diagnóstico). */
const DORSIFLEXION_MIN_CM = 9;
const DORSIFLEXION_ASYM_CM = 2;
const CALF_ASYM_PCT = 15;

export interface FunctionalFlags {
  /** Dorsal que não ativa: entra puxada unilateral + ativação no aquecimento. */
  latWeak?: Side;
  /** Lado com braço acima da cabeça limitado: alongamento de dorsal/torácica. */
  overheadLimited: Side[];
  /** Tornozelo com menos dorsiflexão. */
  dorsiflexionDeficit?: Side;
  /** Panturrilha mais fraca (reps unilaterais). */
  calfDeficit?: Side;
}

const other = (s: Side): Side => (s === 'L' ? 'R' : 'L');

export function latestFunctional(tests: FunctionalTest[]): FunctionalTest | undefined {
  return [...tests].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

export function functionalFlags(t: FunctionalTest | undefined): FunctionalFlags {
  const flags: FunctionalFlags = { overheadLimited: [] };
  if (!t) return flags;
  if (t.latWeak && t.latWeak !== 'none') flags.latWeak = t.latWeak;
  if (t.overheadL === 'limited') flags.overheadLimited.push('L');
  if (t.overheadR === 'limited') flags.overheadLimited.push('R');
  const { dorsiflexionL: dL, dorsiflexionR: dR, calfRaiseL: cL, calfRaiseR: cR } = t;
  if (dL !== undefined && dR !== undefined) {
    if (Math.abs(dL - dR) >= DORSIFLEXION_ASYM_CM) flags.dorsiflexionDeficit = dL < dR ? 'L' : 'R';
    else if (Math.min(dL, dR) < DORSIFLEXION_MIN_CM) flags.dorsiflexionDeficit = dL <= dR ? 'L' : 'R';
  }
  if (cL && cR && (Math.abs(cL - cR) / Math.max(cL, cR)) * 100 >= CALF_ASYM_PCT) flags.calfDeficit = cL < cR ? 'L' : 'R';
  return flags;
}

/** Tradução dos testes em achados com conduta, do jeito que um profissional explicaria. */
export function analyzeFunctional(t: FunctionalTest, profile: Pick<Profile, 'achilles' | 'scoliosis'> | null): Finding[] {
  const f = functionalFlags(t);
  const out: Finding[] = [];

  if (f.dorsiflexionDeficit) {
    const s = f.dorsiflexionDeficit;
    const ach = profile?.achilles?.side === s;
    out.push({
      id: 'dorsiflexion',
      tone: 'warn',
      title: `Tornozelo ${SIDE_LABEL[s]} com menos dorsiflexão`,
      detail: `${fmtNum(t.dorsiflexionL!)} cm E × ${fmtNum(t.dorsiflexionR!)} cm D. ${
        ach
          ? 'É o lado do Haglund: não force amplitude com carga. Ganhe mobilidade sem dor e mantenha calcanheira/tênis com salto.'
          : 'Limita agachamento e leg press profundos. Mobilidade de tornozelo antes dos treinos de perna.'
      }`,
    });
  }

  if (f.calfDeficit) {
    const s = f.calfDeficit;
    out.push({
      id: 'calf',
      tone: 'warn',
      title: `Panturrilha ${SIDE_LABEL[s]} mais fraca`,
      detail: `${t.calfRaiseL} reps E × ${t.calfRaiseR} reps D. ${
        profile?.achilles?.side === s
          ? 'Esperado com tendinite: força de panturrilha é o tratamento. Progrida isometria → elevação no chão plano, sempre com dor ≤ 3/10.'
          : `Comece os exercícios de panturrilha pelo ${SIDE_LABEL[s]} e iguale as reps.`
      }`,
    });
  }

  for (const s of f.overheadLimited) {
    out.push({
      id: `overhead_${s}`,
      tone: 'info',
      title: `Braço ${SIDE_LABEL[s]} não sobe completo`,
      detail: `Costas na parede, o braço ${SIDE_LABEL[s]} não encosta. Sinal de dorsal/torácica encurtados desse lado: alongamento do dorsal entra no aquecimento e o desenvolvimento fica na amplitude confortável.`,
    });
  }

  if (f.latWeak) {
    const s = f.latWeak;
    out.push({
      id: 'lat',
      tone: 'info',
      title: `Dorsal ${SIDE_LABEL[s]} pouco ativo`,
      detail: `Puxada unilateral começando pelo ${SIDE_LABEL[s]}, carga moderada, pausa de 2 s com o cotovelo junto ao corpo. O lado ${SIDE_LABEL[other(s)]} faz as mesmas reps, não mais. Ativação com braço estendido no aquecimento.`,
    });
  }

  if (t.adamsHump && t.adamsHump !== 'none') {
    out.push({
      id: 'adams',
      tone: 'info',
      title: `Gibosidade à ${t.adamsHump === 'L' ? 'esquerda' : 'direita'} no teste de Adams`,
      detail: `Indica a rotação das costelas da escoliose. ${
        profile?.scoliosis ? '' : 'Ative "Escoliose" no perfil para o aquecimento corretivo. '
      }Compare nas próximas avaliações e nas fotos de costas.`,
    });
  }

  if (!out.length) {
    out.push({ id: 'ok', tone: 'good', title: 'Sem achados relevantes', detail: 'Testes simétricos e dentro do esperado. Reavalie em ~6 semanas.' });
  }
  return out;
}

export function reassessDue(tests: FunctionalTest[], today: string): { due: boolean; days: number | null } {
  const last = latestFunctional(tests);
  if (!last) return { due: true, days: null };
  const days = daysBetween(last.date, today);
  return { due: days >= REASSESS_DAYS, days };
}
