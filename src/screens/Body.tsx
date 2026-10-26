import { useState } from 'preact/hooks';
import { saveAssessment } from '../data/actions';
import { app } from '../data/store';
import { analyzeAsymmetry, asymmetryAdvice } from '../domain/asymmetry';
import { computeBodyComp, JP3_SITES, JP7_SITES, pickProtocol } from '../domain/bodycomp';
import { CONDITION_LABEL, PERIMETER_LABEL, SKINFOLD_LABEL } from '../domain/labels';
import type { BodyAssessment, MeasureCondition, PerimeterSite, SkinfoldSite } from '../domain/types';
import { ageOn, formatBR, localISODate } from '../lib/date';
import { fmtNum } from '../lib/format';
import { uid } from '../lib/id';
import { Card, Choice, Kpi, Notice, NumField } from '../ui/kit';
import { ObsidianActions } from '../ui/ObsidianActions';

const SKINFOLDS: SkinfoldSite[] = ['chest', 'abdominal', 'thigh', 'triceps', 'suprailiac', 'subscapular', 'midaxillary', 'calf'];
const TRUNK: PerimeterSite[] = ['shoulders', 'chest', 'absUpper', 'absLower', 'hips'];
const PAIRS: [PerimeterSite, PerimeterSite][] = [
  ['bicepsR', 'bicepsL'],
  ['forearmR', 'forearmL'],
  ['thighR', 'thighL'],
  ['calfR', 'calfL'],
];

interface Draft {
  date: string;
  weightKg?: number;
  condition: MeasureCondition;
  skinfolds: BodyAssessment['skinfolds'];
  perimeters: BodyAssessment['perimeters'];
}

const hint = (v: number | undefined) => (v === undefined ? undefined : `ant. ${fmtNum(v)}`);

export function Body() {
  const { profile, assessments } = app.value;
  const today = localISODate();
  const last = assessments.filter((a) => a.date !== today).at(-1);
  const savedToday = assessments.find((a) => a.date === today);
  const [d, setD] = useState<Draft>(() => ({
    date: today,
    weightKg: savedToday?.weightKg,
    condition: savedToday?.condition ?? last?.condition ?? 'fasted',
    skinfolds: { ...savedToday?.skinfolds },
    perimeters: { ...savedToday?.perimeters },
  }));
  const [saved, setSaved] = useState(false);

  const age = profile?.birthDate ? ageOn(profile.birthDate, d.date) : null;
  const result =
    profile && age !== null && d.weightKg ? computeBodyComp({ sex: profile.sex, age, weightKg: d.weightKg, skinfolds: d.skinfolds }) : null;
  const protocol = profile ? pickProtocol(profile.sex, d.skinfolds) : null;
  const asym = analyzeAsymmetry(d.perimeters);
  const prev = last?.result;

  const setFold = (k: SkinfoldSite, v: number | undefined) => setD((x) => ({ ...x, skinfolds: { ...x.skinfolds, [k]: v } }));
  const setPer = (k: PerimeterSite, v: number | undefined) => setD((x) => ({ ...x, perimeters: { ...x.perimeters, [k]: v } }));

  const save = () => {
    if (!d.weightKg) return alert('Informe o peso.');
    const clean = <T extends string>(o: Partial<Record<T, number>>) =>
      Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'number' && v > 0)) as Partial<Record<T, number>>;
    saveAssessment({
      id: savedToday?.id ?? uid(),
      date: d.date,
      weightKg: d.weightKg,
      condition: d.condition,
      skinfolds: clean(d.skinfolds),
      perimeters: clean(d.perimeters),
      result,
      source: 'app',
    });
    setSaved(true);
  };

  return (
    <>
      <div class="kpi-grid">
        <Kpi value={result ? `${fmtNum(result.bfPercent)}%` : '—'} label="Gordura" delta={result && prev ? result.bfPercent - prev.bfPercent : undefined} goodWhen="down" />
        <Kpi value={result ? `${fmtNum(result.leanKg)}` : '—'} label="Massa magra kg" delta={result && prev ? result.leanKg - prev.leanKg : undefined} goodWhen="up" />
        <Kpi value={result ? `${fmtNum(result.sumFolds)}` : '—'} label="Soma dobras mm" delta={result && prev ? result.sumFolds - prev.sumFolds : undefined} goodWhen="down" />
      </div>

      <Card title="Biometria" aside={formatBR(d.date)}>
        {!profile?.birthDate && <Notice tone="warn">Preencha data de nascimento e sexo em Ajustes para calcular a gordura.</Notice>}
        <NumField label="Peso" suffix="kg" value={d.weightKg} placeholder={hint(last?.weightKg)} onChange={(v) => setD((x) => ({ ...x, weightKg: v }))} />
        <Choice<MeasureCondition>
          label="Condição da medida"
          cols={3}
          value={d.condition}
          onChange={(v) => setD((x) => ({ ...x, condition: v }))}
          options={(Object.keys(CONDITION_LABEL) as MeasureCondition[]).map((k) => ({ value: k, label: CONDITION_LABEL[k] }))}
        />
        {last && last.condition !== d.condition && (
          <Notice tone="warn" title="Condições diferentes">
            A última avaliação foi "{CONDITION_LABEL[last.condition]}". O pump infla perímetros e a hidratação mexe nas dobras: compare sempre na mesma condição.
          </Notice>
        )}
      </Card>

      <Card title="Dobras cutâneas (mm)" aside={protocol ? `Protocolo ${protocol}` : 'Jackson & Pollock'}>
        <p class="muted small">
          Mínimo para JP3: {profile ? JP3_SITES[profile.sex].map((s) => SKINFOLD_LABEL[s]).join(', ') : '—'}. Com as {JP7_SITES.length} dobras do JP7 (todas menos
          panturrilha), o cálculo fica mais preciso. Panturrilha é só para acompanhamento.
        </p>
        <div class="grid-3">
          {SKINFOLDS.map((k) => (
            <NumField key={k} label={SKINFOLD_LABEL[k]} value={d.skinfolds[k]} placeholder={hint(last?.skinfolds[k])} onChange={(v) => setFold(k, v)} />
          ))}
        </div>
      </Card>

      <Card title="Perímetros (cm)">
        <div class="grid-3">
          {TRUNK.map((k) => (
            <NumField key={k} label={PERIMETER_LABEL[k]} value={d.perimeters[k]} placeholder={hint(last?.perimeters[k])} onChange={(v) => setPer(k, v)} />
          ))}
        </div>
        <div class="grid-2">
          {PAIRS.flat().map((k) => (
            <NumField key={k} label={PERIMETER_LABEL[k]} value={d.perimeters[k]} placeholder={hint(last?.perimeters[k])} onChange={(v) => setPer(k, v)} />
          ))}
        </div>
        {asym.map((a) => (
          <div key={a.key} class={`asym ${a.level}`}>
            <strong>
              {a.label}: Δ {fmtNum(a.diffCm)} cm ({fmtNum(a.diffPct)}%)
            </strong>
            {asymmetryAdvice(a) && <span>{asymmetryAdvice(a)}</span>}
          </div>
        ))}
      </Card>

      <button class="btn" onClick={save}>
        {savedToday ? 'Atualizar avaliação de hoje' : 'Salvar avaliação'}
      </button>
      {saved && (
        <Card title="Avaliação salva">
          <ObsidianActions date={d.date} />
        </Card>
      )}
    </>
  );
}
