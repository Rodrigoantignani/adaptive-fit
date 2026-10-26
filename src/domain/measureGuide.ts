import type { PerimeterSite, SkinfoldSite } from './types';

/** Regras que tornam uma avaliação comparável com a próxima. */
export const MEASURE_RULES = [
  'Mesma condição sempre (de preferência em jejum, antes do treino) e mesma pessoa medindo.',
  'Dobras do lado direito do corpo, como nos protocolos de Jackson & Pollock.',
  'Pince a pele com polegar e indicador ~1 cm acima do ponto, encaixe o adipômetro no ponto e leia 2 s depois.',
  'Meça cada ponto 2–3 vezes em rodízio. Se as leituras diferirem mais de 1–2 mm, meça de novo e use a média.',
  'Pele seca, sem creme. Fita métrica justa, sem apertar, paralela ao chão.',
  'Assimetria: marque o ponto com caneta medindo a mesma distância de uma referência óssea nos dois lados.',
];

export const SKINFOLD_GUIDE: Record<SkinfoldSite, string> = {
  chest: 'Diagonal, na metade da distância entre a frente da axila e o mamilo.',
  midaxillary: 'Vertical, na linha do meio da axila, na altura da ponta do esterno.',
  triceps: 'Vertical, atrás do braço, no meio entre o ombro (acrômio) e o cotovelo, braço solto.',
  subscapular: 'Diagonal (45°), 1–2 cm abaixo da ponta inferior da escápula.',
  abdominal: 'Vertical, 2 cm à direita do umbigo.',
  suprailiac: 'Diagonal, logo acima do osso do quadril (crista ilíaca), na linha da frente da axila.',
  thigh: 'Vertical, na frente da coxa, no meio entre a dobra do quadril e a patela, peso na outra perna.',
  calf: 'Vertical, na face interna, no ponto mais grosso da panturrilha.',
};

export const PERIMETER_GUIDE: Partial<Record<PerimeterSite, string>> = {
  shoulders: 'Maior volta sobre os deltoides, braços relaxados ao lado do corpo.',
  chest: 'Na linha dos mamilos, no fim de uma expiração normal.',
  absUpper: 'Ponto fixo acima do umbigo (ex.: 3 dedos acima). Anote a referência e repita sempre.',
  absLower: 'Ponto fixo na linha ou abaixo do umbigo. Abdômen relaxado, sem encolher.',
  hips: 'Maior volta dos glúteos, pés juntos.',
  bicepsR: 'Escolha um padrão e mantenha: contraído a 90° no ponto mais alto, ou relaxado no meio do braço.',
  forearmR: '5 cm abaixo da dobra do cotovelo, mão aberta e relaxada, braço estendido.',
  thighR: 'Distância fixa acima da patela (ex.: 15 cm), em pé, peso nas duas pernas.',
  calfR: 'Ponto mais grosso, em pé, peso distribuído.',
};
