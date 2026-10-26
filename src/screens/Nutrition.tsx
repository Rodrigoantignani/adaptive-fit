import { useState } from 'preact/hooks';
import { saveSettings } from '../data/actions';
import { calibrateFromPlan, nextDays, nutritionFor, type DayNutrition } from '../data/nutrition';
import { app } from '../data/store';
import { ALL_CARB_SLOTS, analyzeDiet, CARB_SLOT_LABEL, dailyTopUps, type CarbSlot } from '../domain/dietCoach';
import type { NutritionGoal } from '../domain/energy';
import { equivalentGrams, foodById, FOODS, GI_LABEL, itemMacros, mealMacros, planMacros, sumMacros, type Meal } from '../domain/foods';
import { WEEKDAY_LABEL } from '../domain/labels';
import { latestWeight } from '../domain/routine';
import { localISODate, parseISO } from '../lib/date';
import { fmtNum } from '../lib/format';
import { uid } from '../lib/id';
import { Card, Chips, Choice, Notice, NumField, Toggle } from '../ui/kit';

const GOALS: { value: NutritionGoal; label: string; hint: string }[] = [
  { value: 'cut', label: 'Secar', hint: '−15% do gasto' },
  { value: 'recomp', label: 'Recompor', hint: 'Manutenção; −5% sem treino' },
  { value: 'bulk', label: 'Ganhar', hint: '+10% do gasto' },
];

const SOURCE_LABEL: Record<DayNutrition['trainingSource'], string> = {
  feito: 'treino feito',
  planejado: 'treino do check-in',
  rotina: 'treino da rotina',
  nenhum: 'sem treino',
};

export function MacroBar({ n }: { n: DayNutrition }) {
  const { protein, carbs, fat, kcal } = n.macros;
  const pct = (g: number, k: number) => `${Math.round(((g * k) / kcal) * 100)}%`;
  return (
    <div class="macro-bar" aria-label="Divisão de macronutrientes">
      <span class="p" style={{ width: pct(protein, 4) }} />
      <span class="c" style={{ width: pct(carbs, 4) }} />
      <span class="f" style={{ width: pct(fat, 9) }} />
    </div>
  );
}

export function Nutrition() {
  const s = app.value;
  const today = localISODate();
  const n = nutritionFor(s, today);
  const [diet, setDiet] = useState(s.settings.dietBase);

  if (!n) {
    return (
      <Notice tone="info" title="Faltam dados para calcular">
        Preencha a data de nascimento no perfil e salve uma avaliação em Corpo (peso e, de preferência, dobras: o gasto fica mais preciso com a massa magra).
      </Notice>
    );
  }
  const { energy, macros, work } = n;

  return (
    <>
      <Card title="Objetivo e rotina">
        <Choice<NutritionGoal> cols={3} value={s.settings.nutritionGoal} onChange={(v) => saveSettings({ nutritionGoal: v })} options={GOALS} />
        <Toggle
          label="Treino em jejum"
          hint="O carboidrato extra vai para o café pós-treino, não para antes."
          checked={s.settings.trainsFasted}
          onChange={(v) => saveSettings({ trainsFasted: v })}
        />
        <Toggle
          label="Carboidrato me dá sono (trabalho sentado)"
          hint="De dia, fontes de IG baixo e porções menores; a maior parte do carboidrato vai para o jantar."
          checked={s.settings.avoidSpikes}
          onChange={(v) => saveSettings({ avoidSpikes: v })}
        />
        <NumField label="Caminhada leve diária" suffix="min" value={s.settings.dailyWalkMin || undefined} onChange={(v) => saveSettings({ dailyWalkMin: v ?? 0 })} />
      </Card>

      <Card title="Hoje" aside={`${WEEKDAY_LABEL[parseISO(today).getDay()]} · ${SOURCE_LABEL[n.trainingSource]}`}>
        <div class="kcal-hero">
          <strong>{fmtNum(macros.kcal)}</strong>
          <span>kcal meta · gasto estimado {fmtNum(energy.total)}</span>
        </div>
        <MacroBar n={n} />
        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-val p">{macros.protein} g</div>
            <div class="kpi-lbl">Proteína</div>
          </div>
          <div class="kpi">
            <div class="kpi-val c">{macros.carbs} g</div>
            <div class="kpi-lbl">Carboidrato</div>
          </div>
          <div class="kpi">
            <div class="kpi-val f">{macros.fat} g</div>
            <div class="kpi-lbl">Gordura</div>
          </div>
        </div>
        <ul class="factors">
          <li class="info">
            <span>Metabolismo basal ({energy.method})</span>
            <b>{fmtNum(energy.bmr)}</b>
          </li>
          <li class="info">
            <span>Rotina sentado + digestão (×1,2)</span>
            <b>{fmtNum(energy.base)}</b>
          </li>
          {energy.standing > 0 && (
            <li class="warn">
              <span>
                Em pé no restaurante ({fmtNum(work!.standingH)} h{work?.standingStart ? `, ${work.standingStart}–${work.standingEnd}` : ''})
              </span>
              <b>+{fmtNum(energy.standing)}</b>
            </li>
          )}
          {n.trainingMin > 0 && (
            <li class="good">
              <span>Treino ({n.trainingMin} min)</span>
              <b>+{fmtNum(energy.training)}</b>
            </li>
          )}
          {energy.walk > 0 && (
            <li class="good">
              <span>Caminhada ({s.settings.dailyWalkMin} min)</span>
              <b>+{fmtNum(energy.walk)}</b>
            </li>
          )}
          {s.settings.calibration && (
            <li class="info">
              <span>Calibrado pelo seu peso (×{fmtNum(s.settings.calibration.factor)})</span>
              <b>{fmtNum(energy.total - energy.formula)}</b>
            </li>
          )}
          <li>
            <span>Água</span>
            <b>{fmtNum(macros.waterL)} L</b>
          </li>
        </ul>
        {energy.standing > 0 && (
          <Notice tone="info" title="Dia de turno em pé">
            Faça um lanche com carboidrato e proteína ~1 h antes do turno e uma refeição leve com proteína ao terminar, mesmo tarde: ajuda a recuperar e a dormir.
          </Notice>
        )}
      </Card>

      <Card title="Próximos 7 dias">
        <table class="week-table">
          <thead>
            <tr>
              <th>Dia</th>
              <th>kcal</th>
              <th>P</th>
              <th>C</th>
              <th>G</th>
            </tr>
          </thead>
          <tbody>
            {nextDays(today).map((d) => {
              const x = nutritionFor(s, d);
              if (!x) return null;
              const tags = [x.energy.standing > 0 ? 'turno' : '', x.trainingMin > 0 ? 'treino' : ''].filter(Boolean).join(' + ');
              return (
                <tr key={d}>
                  <td>
                    {WEEKDAY_LABEL[parseISO(d).getDay()].slice(0, 3)} <small class="muted">{tags || 'descanso'}</small>
                  </td>
                  <td>{fmtNum(x.macros.kcal)}</td>
                  <td>{x.macros.protein}</td>
                  <td>{x.macros.carbs}</td>
                  <td>{x.macros.fat}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p class="muted small">
          Proteína e gordura ficam fixas; o carboidrato acompanha o gasto do dia. Ajuste a agenda de trabalho em Ajustes → Rotina semanal. Estimativas: confira a
          tendência do peso e das dobras a cada 2–3 semanas e ajuste ±150 kcal.
        </p>
      </Card>

      <DietCoach today={today} target={n} />

      <MealPlanEditor />

      <CarbAndShiftCard />

      <Card title="Anotações">
        <textarea
          class="diet-text"
          rows={4}
          value={diet}
          placeholder="Ex.: café preto 2×/dia, 4 L de água, suplementos..."
          onInput={(e) => setDiet(e.currentTarget.value)}
          onBlur={() => saveSettings({ dietBase: diet })}
        />
      </Card>
    </>
  );
}

function DietCoach({ today, target }: { today: string; target: DayNutrition }) {
  const s = app.value;
  const meals = s.settings.mealPlan;
  if (!meals.length) {
    return (
      <Notice tone="info" title="Monte seu plano base">
        Adicione suas refeições abaixo. O app soma os macros, compara com o gasto de cada dia e diz o que acrescentar e quando.
      </Notice>
    );
  }
  const base = target.intake ?? planMacros(meals);
  const days = nextDays(today)
    .map((d) => nutritionFor(s, d))
    .filter((x): x is DayNutrition => !!x);
  const byKcal = [...days].sort((a, b) => a.macros.kcal - b.macros.kcal);
  const weightKg = latestWeight(s.assessments) ?? 75;
  const calibrated = !!s.settings.calibration;
  const findings = analyzeDiet(planMacros(meals), byKcal[0].macros, byKcal.at(-1)!.macros, {
    weightKg,
    meals,
    achilles: !!s.profile?.achilles,
    shiftDays: days.filter((d) => d.energy.standing > 0).length,
    calibrated,
    fasted: s.settings.trainsFasted,
    avoidSpikes: s.settings.avoidSpikes,
  });
  const tops = dailyTopUps(base, target.macros, {
    trained: target.trainingMin > 0,
    standing: target.energy.standing > 0,
    fasted: s.settings.trainsFasted,
    allowed: s.settings.carbSlots,
    avoidSpikes: s.settings.avoidSpikes,
  });
  const after = { kcal: base.kcal + tops.reduce((a, t) => a + t.kcal, 0), carbs: base.carbs + tops.reduce((a, t) => a + t.carbs, 0) };
  const row = (label: string, have: number, goal: number, unit: string) => (
    <li class={have >= goal * 0.9 ? 'good' : have >= goal * 0.7 ? 'info' : 'warn'}>
      <span>{label}</span>
      <b>
        {fmtNum(Math.round(have))} / {fmtNum(goal)} {unit}
      </b>
    </li>
  );

  return (
    <>
      <Card title="Plano base × meta de hoje">
        <ul class="factors">
          {row('Calorias', base.kcal, target.macros.kcal, 'kcal')}
          {row('Proteína', base.protein, target.macros.protein, 'g')}
          {row('Carboidrato', base.carbs, target.macros.carbs, 'g')}
          {row('Gordura', base.fat, target.macros.fat, 'g')}
          <li>
            <span>Fibra</span>
            <b>{fmtNum(Math.round(base.fiber))} g</b>
          </li>
        </ul>
      </Card>

      {tops.length > 0 && (
        <Card title="Complemento de hoje" aside={`+${fmtNum(tops.reduce((a, t) => a + t.kcal, 0))} kcal`}>
          <ul class="topups">
            {tops.map((t) => (
              <li key={t.when + t.foodId}>
                <small>{t.when}</small>
                <strong>{t.label}</strong>
                <span>
                  {t.carbs} g carbo · {t.kcal} kcal
                </span>
              </li>
            ))}
          </ul>
          <p class="muted small">
            Com o complemento: {fmtNum(Math.round(after.kcal))} kcal e {fmtNum(Math.round(after.carbs))} g de carboidrato. Troque por equivalentes que preferir
            (arroz ↔ batata-doce ↔ tapioca).
          </p>
        </Card>
      )}

      <Card title="Leitura do plano">
        {findings.map((f) => (
          <Notice key={f.id} tone={f.tone} title={f.title}>
            {f.detail}
          </Notice>
        ))}
        <p class="muted small">Estimativas baseadas em tabelas nutricionais. Para ajustes clínicos, valide com um nutricionista.</p>
      </Card>

      <CalibrationCard today={today} />
    </>
  );
}

/** O dado real vence a fórmula: peso estável = ingestão ≈ gasto. */
function CalibrationCard({ today }: { today: string }) {
  const s = app.value;
  const cal = s.settings.calibration;
  const preview = calibrateFromPlan(s, today);
  return (
    <Card title="Calibrar pelo meu peso">
      <p class="muted small">
        Fórmulas erram para mais ou para menos em 10–20%. Se o seu peso está estável há 2–3 semanas comendo este plano (com os extras dos dias de turno), o seu
        gasto real é o que você come: o app ajusta as metas a isso.
      </p>
      {cal ? (
        <Notice tone="good" title={`Calibrado em ${cal.date.split('-').reverse().join('/')}`}>
          Manutenção observada ≈ {fmtNum(cal.observedKcal)} kcal/dia (fator ×{fmtNum(cal.factor)} sobre a fórmula).
        </Notice>
      ) : (
        preview && (
          <p class="small">
            Seu plano entrega em média <b>{fmtNum(preview.observedKcal)} kcal/dia</b>; a fórmula diria ×{fmtNum(Math.round((1 / preview.factor) * 100) / 100)}{' '}
            disso.
          </p>
        )
      )}
      <div class="grid-2">
        <button class="btn" disabled={!preview} onClick={() => preview && saveSettings({ calibration: preview })}>
          {cal ? 'Recalibrar' : 'Peso estável: calibrar'}
        </button>
        <button class="btn btn-ghost" disabled={!cal} onClick={() => saveSettings({ calibration: null })}>
          Usar só a fórmula
        </button>
      </div>
    </Card>
  );
}

function CarbAndShiftCard() {
  const s = app.value;
  const extras = s.settings.shiftExtras;
  const setExtras = (next: typeof extras) => saveSettings({ shiftExtras: next });
  const em = sumMacros(extras.map(itemMacros));
  return (
    <Card title="Preferências de carboidrato">
      <Chips<CarbSlot>
        label="Onde você aceita carboidrato extra"
        accent
        values={s.settings.carbSlots}
        onChange={(v) => saveSettings({ carbSlots: v })}
        options={ALL_CARB_SLOTS.map((k) => ({ value: k, label: CARB_SLOT_LABEL[k] }))}
      />
      <div class="field">
        <span>A mais nos dias de turno em pé</span>
      </div>
      {extras.map((it, i) => (
        <div key={i} class="meal-item">
          <select value={it.foodId} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, foodId: e.currentTarget.value } : y)))}>
            {FOODS.map((food) => (
              <option key={food.id} value={food.id}>
                {food.name}
              </option>
            ))}
          </select>
          <NumField label="" suffix="g" value={it.grams} onChange={(v) => setExtras(extras.map((y, j) => (j === i ? { ...y, grams: v ?? 0 } : y)))} />
          <span class="muted small">{Math.round(itemMacros(it).kcal)} kcal</span>
          <button class="link danger" aria-label="Remover" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <div class="meal-foot">
        <button class="link" onClick={() => setExtras([...extras, { foodId: 'banana', grams: 100 }])}>
          + alimento
        </button>
        {extras.length > 0 && (
          <span class="muted small">
            +{Math.round(em.carbs)} g carbo · +{Math.round(em.kcal)} kcal
          </span>
        )}
      </div>
    </Card>
  );
}

function MealPlanEditor() {
  const meals = app.value.settings.mealPlan;
  const save = (next: Meal[]) => saveSettings({ mealPlan: next });
  const updateMeal = (id: string, fn: (m: Meal) => Meal) => save(meals.map((m) => (m.id === id ? fn(m) : m)));

  return (
    <Card title="Plano alimentar base" aside={meals.length ? `${fmtNum(Math.round(planMacros(meals).kcal))} kcal` : undefined}>
      {meals.map((m) => {
        const mm = mealMacros(m);
        return (
          <div key={m.id} class="meal">
            <div class="meal-head">
              <input class="meal-time" type="time" value={m.time} onInput={(e) => updateMeal(m.id, (x) => ({ ...x, time: e.currentTarget.value }))} />
              <input class="meal-name" value={m.name} onInput={(e) => updateMeal(m.id, (x) => ({ ...x, name: e.currentTarget.value }))} />
              <button class="link danger" aria-label={`Remover ${m.name}`} onClick={() => confirm(`Remover "${m.name}"?`) && save(meals.filter((x) => x.id !== m.id))}>
                ×
              </button>
            </div>
            {m.items.map((it, i) => {
              const f = foodById(it.foodId);
              const im = itemMacros(it);
              return (
                <div key={i} class="meal-item">
                  <select
                    value={it.foodId}
                    title={f?.gi ? GI_LABEL[f.gi] : undefined}
                    onChange={(e) => {
                      // Troca equivalente: ajusta as gramas para manter o macro principal.
                      const to = e.currentTarget.value;
                      updateMeal(m.id, (x) => ({
                        ...x,
                        items: x.items.map((y, j) => (j === i ? { foodId: to, grams: equivalentGrams(y.foodId, y.grams, to) } : y)),
                      }));
                    }}
                  >
                    {FOODS.map((food) => (
                      <option key={food.id} value={food.id}>
                        {food.name}
                        {food.gi ? ` · ${GI_LABEL[food.gi]}` : ''}
                      </option>
                    ))}
                  </select>
                  <NumField
                    label=""
                    suffix={f?.unit ? `g (${fmtNum(Math.round((it.grams / f.unit.grams) * 10) / 10)} un)` : 'g'}
                    value={it.grams}
                    onChange={(v) => updateMeal(m.id, (x) => ({ ...x, items: x.items.map((y, j) => (j === i ? { ...y, grams: v ?? 0 } : y)) }))}
                  />
                  <span class="muted small">{Math.round(im.kcal)} kcal</span>
                  <button class="link danger" aria-label="Remover alimento" onClick={() => updateMeal(m.id, (x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))}>
                    ×
                  </button>
                </div>
              );
            })}
            <div class="meal-foot">
              <button class="link" onClick={() => updateMeal(m.id, (x) => ({ ...x, items: [...x.items, { foodId: 'chicken_breast', grams: 100 }] }))}>
                + alimento
              </button>
              <span class="muted small">
                P {Math.round(mm.protein)} · C {Math.round(mm.carbs)} · G {Math.round(mm.fat)} · {Math.round(mm.kcal)} kcal
              </span>
            </div>
          </div>
        );
      })}
      <button class="btn btn-ghost" onClick={() => save([...meals, { id: uid(), name: 'Nova refeição', time: '12:00', items: [] }])}>
        + Refeição
      </button>
      <p class="muted small">
        Pesos de alimentos já preparados (frango grelhado, arroz cozido). Ovo: 50 g por unidade grande. Ao trocar um alimento, as gramas se ajustam para manter o
        mesmo macro principal (ex.: 100 g de arroz → 140 g de batata-doce).
      </p>
    </Card>
  );
}
