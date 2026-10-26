/**
 * Tabela de alimentos por 100 g (valores médios de tabelas nutricionais, ex.: TACO/USDA).
 * `unit` permite lançar em unidades (1 ovo grande ≈ 50 g).
 */
export interface Food {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** `generic`: o rótulo não nomeia o alimento ("fatia", "dose") e precisa de "de <alimento>". */
  unit?: { label: string; plural: string; grams: number; generic?: boolean };
  /** Bom para completar carboidrato no dia (pré-treino / pré-turno). */
  carbTopUp?: boolean;
  /** Índice glicêmico aproximado da forma de preparo indicada. */
  gi?: 'low' | 'medium' | 'high';
}

export const GI_LABEL = { low: 'IG baixo', medium: 'IG médio', high: 'IG alto' } as const;

export const FOODS: Food[] = [
  { id: 'chicken_breast', name: 'Filé de frango grelhado', kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
  { id: 'egg', name: 'Ovo inteiro', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, fiber: 0, unit: { label: 'ovo grande', plural: 'ovos grandes', grams: 50 } },
  { id: 'mozzarella', name: 'Mussarela', kcal: 300, protein: 22, carbs: 3, fat: 22.5, fiber: 0 },
  { id: 'parmesan', name: 'Parmesão', kcal: 392, protein: 35, carbs: 3.2, fat: 26, fiber: 0 },
  { id: 'spinach', name: 'Espinafre cozido', kcal: 23, protein: 3, carbs: 3.8, fat: 0.3, fiber: 2.4 },
  { id: 'white_rice', name: 'Arroz branco cozido', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, carbTopUp: true, gi: 'high' },
  { id: 'yogurt_plain', name: 'Iogurte natural integral', kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0 },
  { id: 'almonds', name: 'Amêndoas', kcal: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5 },
  { id: 'walnuts', name: 'Nozes', kcal: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7 },
  { id: 'chia', name: 'Chia', kcal: 486, protein: 17, carbs: 42, fat: 31, fiber: 34 },
  { id: 'sunflower_seeds', name: 'Semente de girassol', kcal: 584, protein: 21, carbs: 20, fat: 51, fiber: 8.6 },
  { id: 'pumpkin_seeds', name: 'Semente de abóbora', kcal: 559, protein: 30, carbs: 11, fat: 49, fiber: 6 },
  { id: 'banana', name: 'Banana', kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, unit: { label: 'banana média', plural: 'bananas médias', grams: 100 }, carbTopUp: true, gi: 'medium' },
  { id: 'apple', name: 'Maçã', kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, unit: { label: 'maçã média', plural: 'maçãs médias', grams: 130 }, gi: 'low' },
  { id: 'orange', name: 'Laranja', kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, unit: { label: 'laranja média', plural: 'laranjas médias', grams: 140 }, gi: 'low' },
  { id: 'oats', name: 'Aveia em flocos', kcal: 389, protein: 17, carbs: 66, fat: 7, fiber: 10.6, carbTopUp: true, gi: 'medium' },
  { id: 'sweet_potato', name: 'Batata-doce cozida', kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, carbTopUp: true, gi: 'low' },
  { id: 'whole_bread', name: 'Pão integral', kcal: 247, protein: 13, carbs: 41, fat: 3.4, fiber: 7, unit: { label: 'fatia', plural: 'fatias', grams: 25, generic: true }, carbTopUp: true, gi: 'medium' },
  { id: 'tapioca', name: 'Tapioca (goma)', kcal: 240, protein: 0, carbs: 60, fat: 0, fiber: 0, carbTopUp: true, gi: 'high' },
  { id: 'beans', name: 'Feijão cozido', kcal: 76, protein: 4.8, carbs: 14, fat: 0.5, fiber: 8.5, carbTopUp: true, gi: 'low' },
  { id: 'honey', name: 'Mel', kcal: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0, gi: 'medium' },
  { id: 'sweet_potato_baked', name: 'Batata-doce assada', kcal: 90, protein: 2, carbs: 21, fat: 0.2, fiber: 3.3, gi: 'high' },
  { id: 'brown_rice', name: 'Arroz integral cozido', kcal: 123, protein: 2.7, carbs: 26, fat: 1, fiber: 1.6, carbTopUp: true, gi: 'medium' },
  { id: 'lentils', name: 'Lentilha cozida', kcal: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, carbTopUp: true, gi: 'low' },
  { id: 'chickpeas', name: 'Grão-de-bico cozido', kcal: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, carbTopUp: true, gi: 'low' },
  { id: 'quinoa', name: 'Quinoa cozida', kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8, carbTopUp: true, gi: 'medium' },
  { id: 'salmon', name: 'Salmão grelhado', kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
  { id: 'olive_oil', name: 'Azeite', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 },
  { id: 'whey', name: 'Whey protein', kcal: 400, protein: 80, carbs: 8, fat: 6, fiber: 0, unit: { label: 'dose', plural: 'doses', grams: 30, generic: true } },
];

const BY_ID = new Map(FOODS.map((f) => [f.id, f]));
export const foodById = (id: string) => BY_ID.get(id);

export interface MealItem {
  foodId: string;
  grams: number;
}

export interface Meal {
  id: string;
  name: string;
  /** "09:00" */
  time: string;
  items: MealItem[];
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function itemMacros({ foodId, grams }: MealItem): Macros {
  const f = foodById(foodId);
  if (!f) return ZERO;
  const k = grams / 100;
  return { kcal: f.kcal * k, protein: f.protein * k, carbs: f.carbs * k, fat: f.fat * k, fiber: f.fiber * k };
}

export const sumMacros = (list: Macros[]): Macros =>
  list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat, fiber: a.fiber + m.fiber }), ZERO);

/** Macro que define o alimento (o que ele "entrega" no prato). */
export function dominantMacro(f: Food): 'protein' | 'carbs' | 'fat' {
  const kcal = { protein: f.protein * 4, carbs: f.carbs * 4, fat: f.fat * 9 };
  return (Object.keys(kcal) as (keyof typeof kcal)[]).reduce((a, b) => (kcal[b] > kcal[a] ? b : a));
}

/**
 * Troca equivalente: mantém o macro dominante do alimento original.
 * Ex.: 100 g de arroz branco (28 g carbo) → 140 g de batata-doce cozida.
 */
export function equivalentGrams(fromId: string, grams: number, toId: string): number {
  const from = foodById(fromId);
  const to = foodById(toId);
  if (!from || !to) return grams;
  const m = dominantMacro(from);
  if (!to[m]) return grams;
  return Math.max(5, Math.round((grams * from[m]) / to[m] / 5) * 5);
}

export const mealMacros = (m: Meal) => sumMacros(m.items.map(itemMacros));
export const planMacros = (meals: Meal[]) => sumMacros(meals.map(mealMacros));
