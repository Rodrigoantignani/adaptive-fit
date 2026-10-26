import { SIDE_LABEL } from './labels';
import type { CorrectiveBlock, CorrectiveItem, Profile } from './types';

/**
 * Aquecimento corretivo montado a partir das condições do perfil.
 * Exercícios de baixo risco, usados em reabilitação; não substituem fisioterapia.
 */
export function correctiveBlock(profile: Pick<Profile, 'scoliosis' | 'achilles'> | null | undefined, tendonPain = 0): CorrectiveBlock | null {
  const items: CorrectiveItem[] = [];
  let minutes = 0;

  const sc = profile?.scoliosis;
  if (sc) {
    const short = SIDE_LABEL[sc.shortSide];
    const other = SIDE_LABEL[sc.shortSide === 'L' ? 'R' : 'L'];
    minutes += 5;
    items.push(
      {
        id: 'side_stretch',
        title: `Alongamento lateral do lado ${short}`,
        dose: `2 × 30 s, só no lado ${short}`,
        how: `Em pé, braço ${short} acima da cabeça. Incline o tronco para o lado ${other} até sentir o lado ${short} alongar e expire devagar.`,
      },
      {
        id: 'directed_breathing',
        title: 'Respiração dirigida ao lado encurtado',
        dose: '5 respirações lentas',
        how: `Mão nas costelas do lado ${short}. Inspire levando o ar para baixo da mão, expandindo esse lado.`,
      },
      {
        id: 'bird_dog',
        title: 'Bird dog',
        dose: '2 × 8 por lado, pausa de 2 s',
        how: 'Quatro apoios, estenda braço e perna opostos sem girar o quadril e com a coluna neutra.',
      },
      {
        id: 'side_plank',
        title: 'Prancha lateral',
        dose: '2 × 20–30 s por lado',
        how: 'Apoio no antebraço, corpo em linha reta. Comece com os joelhos no chão se precisar.',
      },
    );
  }

  const ach = profile?.achilles;
  if (ach) {
    const side = SIDE_LABEL[ach.side];
    minutes += 3;
    items.push(
      tendonPain >= 5
        ? {
            id: 'calf_iso_seated',
            title: 'Isometria de panturrilha sentado',
            dose: '4 × 30 s, dor até 3/10',
            how: `Sentado, pés no chão. Empurre a ponta do pé ${side} contra o chão sem tirar o calcanhar, com força moderada. Ajuda a baixar a dor.`,
          }
        : {
            id: 'calf_iso_flat',
            title: 'Isometria de panturrilha no chão plano',
            dose: '4 × 30–45 s, dor até 3/10',
            how: `Em pé no chão plano (nunca no degrau), suba na ponta dos pés e segure. Apoie as mãos na parede. Pode ser só no pé ${side}.`,
          },
    );
  }

  if (!items.length) return null;
  return {
    title: 'Aquecimento corretivo',
    minutes,
    disclaimer: 'Complementar ao treino. A dose e a ênfase ideais dependem da sua avaliação: valide com um fisioterapeuta.',
    items,
  };
}
