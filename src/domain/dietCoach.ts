import { fmtNum } from '../lib/format';
import type { MacroTargets } from './energy';
import { equivalentGrams, foodById, type Macros, type Meal } from './foods';
import type { Finding } from './types';

export interface TopUp {
  when: string;
  foodId: string;
  grams: number;
  label: string;
  carbs: number;
  kcal: number;
}

/** Porção para `carbs` g de carboidrato, em unidades quando o alimento tem unidade. */
const portion = (foodId: string, carbs: number, step = 10) => {
  const f = foodById(foodId)!;
  if (f.unit) {
    const units = Math.max(1, Math.round(carbs / ((f.carbs * f.unit.grams) / 100)));
    const unit = units > 1 ? f.unit.plural : f.unit.label;
    const label = `${units} ${unit}${f.unit.generic ? ` de ${f.name.toLowerCase()}` : ''}`;
    return { grams: units * f.unit.grams, label };
  }
  const grams = Math.max(step, Math.round((carbs / f.carbs) * 100 / step) * step);
  return { grams, label: `${grams} g de ${f.name.toLowerCase()}` };
};

const make = (when: string, foodId: string, carbs: number): TopUp => {
  const f = foodById(foodId)!;
  const { grams, label } = portion(foodId, carbs);
  return { when, foodId, grams, label, carbs: Math.round((f.carbs * grams) / 100), kcal: Math.round((f.kcal * grams) / 100) };
};

/** Momentos em que o usuário aceita carboidrato (respeitar preferência = aderência). */
export type CarbSlot = 'preWorkout' | 'breakfast' | 'lunch' | 'preShift' | 'dinner';

export const CARB_SLOT_LABEL: Record<CarbSlot, string> = {
  preWorkout: 'Antes do treino',
  breakfast: 'Café da manhã',
  lunch: 'Almoço',
  preShift: 'Antes do turno',
  dinner: 'Jantar',
};

export const ALL_CARB_SLOTS: CarbSlot[] = ['preWorkout', 'breakfast', 'lunch', 'preShift', 'dinner'];

/**
 * Completa o carboidrato que falta no dia, só nos momentos que o usuário aceita,
 * priorizando perto do treino e antes do turno em pé. Proteína só se faltar.
 */
export function dailyTopUps(
  base: Macros,
  target: MacroTargets,
  ctx: { trained: boolean; standing: boolean; fasted?: boolean; allowed?: CarbSlot[]; avoidSpikes?: boolean },
): TopUp[] {
  const out: TopUp[] = [];
  const allowed = new Set(ctx.allowed?.length ? ctx.allowed : ALL_CARB_SLOTS);
  // Sem pico no horário sentado: IG baixo e porções menores de dia; o grosso vai para o jantar.
  const calm = !!ctx.avoidSpikes;
  let gap = target.carbs - base.carbs;
  if (gap > 15) {
    const slots: [CarbSlot, string, string, number][] = [
      ['preWorkout', '1–2 h antes do treino', 'oats', ctx.trained && !ctx.fasted ? 0.3 : 0],
      ['breakfast', ctx.trained && ctx.fasted ? 'Café pós-treino' : 'Café da manhã', calm ? 'apple' : 'oats', calm ? 0.15 : ctx.trained ? 0.3 : 0.15],
      ['lunch', 'Almoço', calm ? 'sweet_potato' : 'white_rice', calm ? 0.25 : 0.4],
      ['preShift', '~1 h antes do turno', 'banana', ctx.standing ? 0.3 : 0],
      ['dinner', 'Jantar', calm ? 'white_rice' : 'sweet_potato', calm && !ctx.standing ? 0.45 : 0.2],
    ];
    const usable = slots.filter(([slot, , , w]) => w > 0 && allowed.has(slot));
    if (!usable.length) usable.push(['lunch', 'Almoço', 'white_rice', 1]);
    const total = usable.reduce((a, [, , , w]) => a + w, 0);
    for (const [, when, foodId, w] of usable) {
      const c = (gap * w) / total;
      if (c < 10) continue;
      out.push(make(when, foodId, c));
    }
    gap -= out.reduce((a, t) => a + t.carbs, 0);
    const [, when, foodId] = usable[0];
    if (gap > 25) out.push(make(when, foodId, gap));
  }
  if (target.protein - base.protein > 20) {
    const f = foodById('whey')!;
    out.push({ when: 'Depois do treino', foodId: 'whey', grams: 30, label: '1 dose de whey', carbs: Math.round(f.carbs * 0.3), kcal: Math.round(f.kcal * 0.3) });
  }
  return out;
}

/** Leitura do plano base como um nutricionista esportivo faria (não substitui consulta). */
export function analyzeDiet(
  base: Macros,
  restDay: MacroTargets,
  hardDay: MacroTargets,
  ctx: { weightKg: number; meals: Meal[]; achilles: boolean; shiftDays: number; calibrated?: boolean; fasted?: boolean; avoidSpikes?: boolean },
): Finding[] {
  const out: Finding[] = [];
  const foods = new Set(ctx.meals.flatMap((m) => m.items.map((i) => i.foodId)));

  if (base.carbs < 100) {
    out.push({
      id: 'lowcarb',
      tone: 'info',
      title: `Low-carb (~${fmtNum(Math.round(base.carbs))} g/dia), não cetogênica`,
      detail: 'Cetogênica fica abaixo de ~50 g (na prática ~30 g). Low-carb funciona bem para você: o carboidrato vira alavanca nos dias de treino pesado e de turno.',
    });
  }
  if (ctx.avoidSpikes) {
    const highGi = ctx.meals.flatMap((m) => m.items).filter((i) => foodById(i.foodId)?.gi === 'high');
    const swaps = highGi.map((i) => {
      const to = i.foodId === 'white_rice' || i.foodId === 'sweet_potato_baked' ? 'sweet_potato' : 'beans';
      return `${i.grams} g de ${foodById(i.foodId)!.name.toLowerCase()} → ${equivalentGrams(i.foodId, i.grams, to)} g de ${foodById(to)!.name.toLowerCase()}`;
    });
    out.push({
      id: 'gi',
      tone: 'info',
      title: 'Para não dar sono depois de comer',
      detail: [
        swaps.length ? `Troca com o mesmo carboidrato: ${swaps.join('; ')}.` : '',
        'Batata-doce sempre cozida (assada tem IG alto). Arroz ou batata cozidos e resfriados formam amido resistente e sobem menos a glicose.',
        'Coma salada e proteína antes do carboidrato e caminhe 10 min depois do almoço. A porção maior de carboidrato rende melhor no jantar, quando o sono é bem-vindo.',
      ]
        .filter(Boolean)
        .join(' '),
    });
  }
  const deficitLow = restDay.kcal - base.kcal;
  const deficitHigh = hardDay.kcal - base.kcal;

  if (ctx.calibrated) {
    out.push({
      id: 'calibrated',
      tone: 'good',
      title: 'Gasto calibrado pelo seu peso real',
      detail: 'Peso estável com este plano: as metas usam o seu gasto observado, não só a fórmula. Recalibre se o peso começar a mudar por 2–3 semanas seguidas.',
    });
  } else if (deficitHigh >= 400) {
    out.push({
      id: 'deficit',
      tone: 'warn',
      title: `Plano com ~${fmtNum(Math.round(base.kcal))} kcal; a fórmula estima gasto de ${fmtNum(restDay.kcal)}–${fmtNum(hardDay.kcal)}`,
      detail: `Diferença de ${fmtNum(Math.max(0, deficitLow))} a ${fmtNum(deficitHigh)} kcal/dia. Se o seu peso está estável comendo assim, a fórmula está alta para você: use "Calibrar pelo meu peso". Se o peso está caindo, complete com carboidrato nos dias de treino e turno.`,
    });
  }
  const gPerKgCarb = base.carbs / ctx.weightKg;
  if (gPerKgCarb < 3) {
    out.push({
      id: 'carbs',
      tone: ctx.calibrated ? 'info' : 'warn',
      title: `Carboidrato baixo: ${fmtNum(Math.round(base.carbs))} g (${fmtNum(Math.round(gPerKgCarb * 10) / 10)} g/kg)`,
      detail: ctx.calibrated
        ? 'Abaixo do usual para 6 treinos (3–5 g/kg), mas se peso, medidas e cargas estão evoluindo, não mexa. É a primeira alavanca se o desempenho cair ou o sono piorar: aumente o carboidrato nas refeições em que você já come (ex.: almoço) e reduza um pouco a gordura.'
        : `Para 6 treinos por semana o usual é 3–5 g/kg (${fmtNum(Math.round(3 * ctx.weightKg))}–${fmtNum(Math.round(5 * ctx.weightKg))} g), concentrados perto do treino e antes do turno em pé.`,
    });
  }
  if (ctx.fasted) {
    out.push({
      id: 'fasted',
      tone: 'good',
      title: 'Treino em jejum',
      detail: 'Funciona para hipertrofia com proteína total alta. O essencial é comer logo depois: 30–40 g de proteína (seu café cumpre). Se os treinos de perna perderem força, teste uma banana ou um café antes.',
    });
  }
  const gPerKgProt = base.protein / ctx.weightKg;
  out.push(
    gPerKgProt >= 1.6
      ? { id: 'protein', tone: 'good', title: `Proteína ótima: ${fmtNum(Math.round(base.protein))} g (${fmtNum(Math.round(gPerKgProt * 10) / 10)} g/kg)`, detail: 'Mantenha, distribuída em 4 refeições com 30–60 g cada.' }
      : { id: 'protein', tone: 'warn', title: `Proteína abaixo do ideal: ${fmtNum(Math.round(base.protein))} g`, detail: 'Busque 1,6–2,2 g/kg, 30–40 g por refeição.' },
  );
  const fatPct = (base.fat * 9) / Math.max(1, base.kcal);
  if (fatPct > 0.4) {
    out.push({
      id: 'fat',
      tone: 'info',
      title: `Gordura em ${Math.round(fatPct * 100)}% das calorias`,
      detail: 'Não precisa cortar: a proporção cai sozinha quando o carboidrato subir. Prefira ovos, castanhas, azeite e peixe.',
    });
  }
  if (base.fiber < 25) {
    out.push({ id: 'fiber', tone: 'info', title: `Fibra baixa: ~${Math.round(base.fiber)} g`, detail: 'Meta de 25–35 g: feijão, aveia, frutas com casca e mais um vegetal no almoço e no jantar.' });
  }
  if (!foods.has('salmon')) {
    out.push({ id: 'omega3', tone: 'info', title: 'Sem peixe no plano', detail: 'Inclua peixe gordo (salmão, sardinha) 2× por semana pelo ômega-3, que ajuda na inflamação e na saúde do tendão.' });
  }
  if (ctx.achilles) {
    out.push({
      id: 'collagen',
      tone: 'info',
      title: 'Tendão: vitamina C e colágeno',
      detail: 'Fruta cítrica junto da proteína ajuda a formar colágeno. Há evidência de que 10–15 g de gelatina com vitamina C 30–60 min antes dos exercícios de panturrilha aumenta a síntese de colágeno: combine com seu nutricionista.',
    });
  }
  if (ctx.shiftDays > 0) {
    out.push({
      id: 'caffeine',
      tone: 'info',
      title: 'Café da tarde até 15–16 h nos dias de turno',
      detail: 'A cafeína dura 5–6 h no corpo. Com turno até 23 h, café tarde rouba o sono, que é o que mais pesa na sua prontidão.',
    });
  }
  return out;
}
