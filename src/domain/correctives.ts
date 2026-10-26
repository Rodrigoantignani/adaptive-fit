import { SIDE_LABEL } from './labels';
import type { CorrectiveBlock, Profile } from './types';

/**
 * Aquecimento corretivo para escoliose leve, orientado pelo lado encurtado (côncavo).
 * Exercícios de baixo risco e amplamente usados em reeducação postural; não substituem fisioterapia.
 */
export function correctiveBlock(profile: Pick<Profile, 'scoliosis'> | null | undefined): CorrectiveBlock | null {
  const sc = profile?.scoliosis;
  if (!sc) return null;
  const short = SIDE_LABEL[sc.shortSide];
  const other = SIDE_LABEL[sc.shortSide === 'L' ? 'R' : 'L'];
  return {
    title: 'Aquecimento corretivo · escoliose',
    minutes: 5,
    disclaimer: 'Complementar ao treino. A ênfase ideal depende do tipo de curva: valide com um fisioterapeuta.',
    items: [
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
    ],
  };
}
