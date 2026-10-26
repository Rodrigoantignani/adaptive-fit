import type { Exercise, PlannedExercise, Readiness } from './types';

export type TechniqueId =
  | 'rest_pause'
  | 'drop_set'
  | 'bi_set'
  | 'superset'
  | 'tri_set'
  | 'giant_set'
  | 'pre_exhaustion'
  | 'pyramid'
  | 'cluster'
  | 'forced_reps'
  | 'partials'
  | 'negatives'
  | 'isometric'
  | 'super_slow'
  | 'cheating'
  | 'fst7'
  | 'gvt'
  | 'method_21';

export interface Technique {
  id: TechniqueId;
  name: string;
  group: 'Intensidade' | 'Combinação' | 'Tempo sob tensão' | 'Volume';
  summary: string;
  how: string[];
  when: string;
  caution: string;
  /** Precisa de parceiro ou de carga livre para ser feita com segurança. */
  needsPartner?: boolean;
}

export const TECHNIQUES: Technique[] = [
  {
    id: 'rest_pause',
    name: 'Rest-pause',
    group: 'Intensidade',
    summary: 'Série até perto da falha, pausa curtíssima e mais repetições com a mesma carga.',
    how: ['Faça a série até 0–1 repetição na reserva.', 'Descanse 10–20 s sem soltar a máquina.', 'Faça mais repetições com a mesma carga; repita 1–2 vezes.'],
    when: 'Para ganhar volume quando o tempo está curto, em máquinas e isoladores.',
    caution: 'Evite em exercícios com carga na coluna ou técnica complexa.',
  },
  {
    id: 'drop_set',
    name: 'Drop-set',
    group: 'Intensidade',
    summary: 'Chegou na falha, tira 20–30% da carga e continua sem descanso.',
    how: ['Última série até a falha técnica.', 'Reduza 20–30% da carga na hora (pino da máquina facilita).', 'Continue até a falha; faça 2–3 quedas.'],
    when: 'Fim do exercício, em máquinas ou polias, em dias de prontidão alta.',
    caution: 'Muito fatigante: no máximo 1–2 exercícios por treino.',
  },
  {
    id: 'bi_set',
    name: 'Bi-set',
    group: 'Combinação',
    summary: 'Dois exercícios do mesmo músculo em sequência, sem descanso entre eles.',
    how: ['Faça o exercício A.', 'Vá direto para o B do mesmo grupo.', 'Descanse só depois do B.'],
    when: 'Para aumentar o estímulo de um músculo prioritário em pouco tempo.',
    caution: 'Use cargas um pouco menores no segundo exercício.',
  },
  {
    id: 'superset',
    name: 'Super-série',
    group: 'Combinação',
    summary: 'Dois exercícios de músculos opostos (agonista e antagonista) em sequência.',
    how: ['Faça o exercício A (ex.: bíceps).', 'Vá direto para o B do músculo oposto (ex.: tríceps).', 'Descanse só depois do B.'],
    when: 'Quando o tempo é curto: o app monta sozinho quando o treino não cabe.',
    caution: 'Pouco impacto no desempenho, porque um músculo descansa enquanto o outro trabalha.',
  },
  {
    id: 'tri_set',
    name: 'Tri-set',
    group: 'Combinação',
    summary: 'Três exercícios do mesmo músculo seguidos, sem intervalo.',
    how: ['Escolha três ângulos diferentes do mesmo músculo.', 'Execute em sequência.', 'Descanse ao final do terceiro.'],
    when: 'Acessórios e músculos pequenos, em dias de boa energia.',
    caution: 'Alta fadiga local; não use em exercícios base.',
  },
  {
    id: 'giant_set',
    name: 'Série gigante',
    group: 'Combinação',
    summary: 'Quatro ou mais exercícios do mesmo grupo, com intervalo mínimo.',
    how: ['Monte 4+ exercícios do mesmo grupo.', 'Faça em sequência com 0–15 s entre eles.', 'Descanse 2–3 min entre as rodadas.'],
    when: 'Ocasionalmente, para quebrar a rotina ou num treino curto.',
    caution: 'Volume muito alto: só com boa recuperação.',
  },
  {
    id: 'pre_exhaustion',
    name: 'Pré-exaustão',
    group: 'Combinação',
    summary: 'Isolador primeiro, depois o multiarticular do mesmo músculo.',
    how: ['Faça o isolador (ex.: cadeira extensora).', 'Em seguida, o multiarticular (ex.: leg press).'],
    when: 'Quando articulação ou coluna limitam a carga no multiarticular: dá estímulo com menos peso.',
    caution: 'A carga do multiarticular cai; não é para buscar recorde de força.',
  },
  {
    id: 'pyramid',
    name: 'Pirâmide',
    group: 'Volume',
    summary: 'Carga e repetições variam ao longo das séries, crescendo ou decrescendo.',
    how: ['Crescente: sobe a carga e baixa as reps a cada série.', 'Decrescente: começa pesado e alivia.'],
    when: 'Exercícios base, para trabalhar força e volume no mesmo exercício.',
    caution: 'Aqueça bem antes das séries mais pesadas.',
  },
  {
    id: 'cluster',
    name: 'Cluster set',
    group: 'Intensidade',
    summary: 'Série pesada dividida em blocos com pausas de 10–20 s.',
    how: ['Planeje o total de reps (ex.: 8).', 'Faça 2–3 reps, pause 15 s, repita até completar.'],
    when: 'Para levantar carga mais alta com técnica limpa.',
    caution: 'Aumenta o tempo da série; conte isso no tempo do treino.',
  },
  {
    id: 'forced_reps',
    name: 'Repetições forçadas',
    group: 'Intensidade',
    summary: 'Após a falha, um parceiro ajuda o mínimo para mais 2–3 reps.',
    how: ['Vá até a falha concêntrica.', 'O parceiro ajuda só no ponto difícil.', 'Faça 2–3 reps extras.'],
    when: 'Raramente, no último exercício de um grupo.',
    caution: 'Precisa de parceiro atento. Nunca em exercício com carga na coluna.',
    needsPartner: true,
  },
  {
    id: 'partials',
    name: 'Repetições parciais',
    group: 'Intensidade',
    summary: 'Após a falha na amplitude completa, continua numa parte curta do movimento.',
    how: ['Falha na amplitude completa.', 'Continue com 3–6 reps na faixa mais forte.'],
    when: 'Em máquinas, para estender a série sem trocar a carga.',
    caution: 'Não substitui a amplitude completa no resto da série.',
  },
  {
    id: 'negatives',
    name: 'Negativa (excêntrico)',
    group: 'Intensidade',
    summary: 'Foco na descida com carga acima do que você sobe sozinho.',
    how: ['Alguém (ou você, com as duas pernas/braços) ajuda a subir.', 'Desça em 3–5 s controlando.'],
    when: 'Para destravar exercícios em que você ainda não completa a amplitude (ex.: barra fixa).',
    caution: 'Gera muita dor tardia; use pouco volume.',
    needsPartner: true,
  },
  {
    id: 'isometric',
    name: 'Isometria',
    group: 'Tempo sob tensão',
    summary: 'Segurar a carga parada num ponto do movimento por alguns segundos.',
    how: ['Pare no ponto escolhido (geralmente no pico de contração).', 'Segure 3–10 s e continue a série.'],
    when: 'Para controle motor, conexão mente-músculo e em reabilitação de tendão.',
    caution: 'Respire: não prenda o ar por muito tempo.',
  },
  {
    id: 'super_slow',
    name: 'Superlento',
    group: 'Tempo sob tensão',
    summary: 'Repetições muito lentas (5–10 s para subir e para descer).',
    how: ['Reduza a carga em ~30%.', 'Conte 5 s subindo e 5 s descendo, sem pausa no topo.'],
    when: 'Dias de recuperação: muito estímulo com pouca carga nas articulações.',
    caution: 'Menos repetições por série (4–6) é o normal aqui.',
  },
  {
    id: 'cheating',
    name: 'Roubada',
    group: 'Intensidade',
    summary: 'Leve impulso do corpo para passar do ponto difícil nas últimas reps.',
    how: ['Faça as reps limpas até a falha.', 'Use um impulso mínimo para mais 1–2 reps, descendo devagar.'],
    when: 'Raramente, em isoladores de braço.',
    caution: 'Não recomendado com escoliose ou dor lombar: o impulso vem da coluna.',
  },
  {
    id: 'fst7',
    name: 'FST-7',
    group: 'Volume',
    summary: '7 séries de um isolador no fim do treino, com 30–45 s de descanso.',
    how: ['Escolha um isolador em máquina.', 'Faça 7 séries de 8–12 reps.', 'Descanse 30–45 s entre elas.'],
    when: 'Músculo prioritário ou atrasado, ao final do treino.',
    caution: 'Gasta ~8 min: só quando o tempo sobra.',
  },
  {
    id: 'gvt',
    name: 'GVT (10 × 10)',
    group: 'Volume',
    summary: '10 séries de 10 repetições com ~60% de 1RM num exercício base.',
    how: ['Carga que você faria ~20 reps.', '10 × 10 com 60–90 s de descanso.'],
    when: 'Blocos curtos de hipertrofia (3–6 semanas).',
    caution: 'Volume altíssimo; prefira máquinas por causa da coluna.',
  },
  {
    id: 'method_21',
    name: 'Método 21',
    group: 'Tempo sob tensão',
    summary: '7 reps na metade de baixo, 7 na metade de cima e 7 completas.',
    how: ['7 parciais da posição inicial até a metade.', '7 parciais da metade até o topo.', '7 completas.'],
    when: 'Clássico na rosca; bom para variar o estímulo de braço.',
    caution: 'Use ~70% da carga habitual.',
  },
];

const BY_ID = new Map(TECHNIQUES.map((t) => [t.id, t]));
export const techniqueById = (id: string) => BY_ID.get(id as TechniqueId);

const isMachineIsolation = (e: Exercise) => (e.equipment === 'machine' || e.equipment === 'cable') && e.loadMode !== 'assisted' && !e.axialLoad;

/**
 * Sugere no máximo 2 técnicas para o dia, sempre na última série e só em máquina/polia.
 * Progredir → drop-set e rest-pause · pouco tempo → rest-pause · recuperar → superlento.
 */
export function suggestTechniques(items: PlannedExercise[], byId: Map<string, Exercise>, readiness: Readiness, timeTight: boolean) {
  const pick = (filter: (e: Exercise, it: PlannedExercise) => boolean) =>
    [...items].reverse().find((it) => {
      const e = byId.get(it.exerciseId);
      return e && !it.technique && !it.perSide && isMachineIsolation(e) && filter(e, it);
    });

  if (readiness.tier === 'recover') {
    const it = pick((e) => e.priority >= 2);
    if (it) it.technique = 'super_slow';
    return;
  }
  if (readiness.flags.reducedVolume) return;

  let count = 0;
  if (readiness.tier === 'push') {
    const drop = pick((e) => e.priority === 3);
    if (drop) {
      drop.technique = 'drop_set';
      count++;
    }
  }
  if (timeTight || readiness.tier === 'push') {
    const rp = pick((e) => e.priority >= 2);
    if (rp && count < 2) rp.technique = 'rest_pause';
  }
}
