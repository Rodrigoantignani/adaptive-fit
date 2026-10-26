import type { ChartConfiguration } from 'chart.js';
import { useMemo, useState } from 'preact/hooks';
import { deleteAssessment } from '../data/actions';
import { app } from '../data/store';
import { analyzeAsymmetry } from '../domain/asymmetry';
import { exerciseById } from '../domain/exercises';
import { performanceHistory, sessionTotals } from '../domain/history';
import { CONDITION_LABEL, PERIMETER_LABEL } from '../domain/labels';
import { bestE1rm } from '../domain/progression';
import type { PerimeterSite } from '../domain/types';
import { formatBR, localISODate, parseISO, shortBR, weekStart } from '../lib/date';
import { fmtNum, round } from '../lib/format';
import { ChartCanvas, COLORS } from '../ui/ChartCanvas';
import { Card } from '../ui/kit';

const PERIMETERS = Object.keys(PERIMETER_LABEL) as PerimeterSite[];

export function Progress() {
  const { assessments, sessions } = app.value;
  const [site, setSite] = useState<PerimeterSite>('chest');
  const trained = useMemo(
    () => [...new Set(sessions.filter((s) => s.endedAt).flatMap((s) => s.entries.filter((e) => e.sets.length).map((e) => e.exerciseId)))],
    [sessions],
  );
  const [exId, setExId] = useState('');
  const selectedEx = trained.includes(exId) ? exId : trained[0];

  const composition = useMemo((): ChartConfiguration<'line'> | null => {
    const rows = assessments.filter((a) => a.result);
    if (!rows.length) return null;
    const styles = rows.map((a) => (a.condition === 'fasted' ? 'circle' : 'triangle'));
    return {
      type: 'line',
      data: {
        labels: rows.map((a) => shortBR(a.date)),
        datasets: [
          { label: 'Peso (kg)', data: rows.map((a) => a.weightKg), borderColor: COLORS.muted, pointStyle: styles, pointRadius: 5, tension: 0.3, yAxisID: 'y' },
          { label: 'Massa magra (kg)', data: rows.map((a) => a.result!.leanKg), borderColor: COLORS.info, pointStyle: styles, pointRadius: 5, tension: 0.3, yAxisID: 'y' },
          { label: 'Gordura (%)', data: rows.map((a) => a.result!.bfPercent), borderColor: COLORS.primary, pointStyle: styles, pointRadius: 5, tension: 0.3, yAxisID: 'y1' },
        ],
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { y: { position: 'left' }, y1: { position: 'right', grid: { drawOnChartArea: false } } },
      },
    };
  }, [assessments]);

  const perimeter = useMemo((): ChartConfiguration<'line'> | null => {
    const rows = assessments.filter((a) => a.perimeters[site] !== undefined);
    if (!rows.length) return null;
    return {
      type: 'line',
      data: {
        labels: rows.map((a) => shortBR(a.date)),
        datasets: [{ label: `${PERIMETER_LABEL[site]} (cm)`, data: rows.map((a) => a.perimeters[site]!), borderColor: COLORS.primary, backgroundColor: 'rgba(255,152,0,.12)', fill: true, tension: 0.3 }],
      },
    };
  }, [assessments, site]);

  const strength = useMemo((): ChartConfiguration<'line'> | null => {
    if (!selectedEx) return null;
    const hist = performanceHistory(sessions, selectedEx).reverse();
    return {
      type: 'line',
      data: {
        labels: hist.map((h) => shortBR(h.date)),
        datasets: [{ label: '1RM estimado', data: hist.map((h) => round(bestE1rm(h.sets))), borderColor: COLORS.success, tension: 0.3 }],
      },
    };
  }, [sessions, selectedEx]);

  const weekly = useMemo((): ChartConfiguration<'bar'> | null => {
    const finished = sessions.filter((s) => s.endedAt);
    if (!finished.length) return null;
    const weeks: string[] = [];
    const start = parseISO(weekStart(localISODate()));
    for (let i = 11; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(d.getDate() - i * 7);
      weeks.push(localISODate(d));
    }
    const vol = new Map(weeks.map((w) => [w, 0]));
    for (const s of finished) {
      const w = weekStart(s.date);
      if (vol.has(w)) vol.set(w, vol.get(w)! + sessionTotals(s).volume);
    }
    return {
      type: 'bar',
      data: { labels: weeks.map(shortBR), datasets: [{ label: 'Volume semanal (kg)', data: weeks.map((w) => vol.get(w)!), backgroundColor: COLORS.primary, borderRadius: 4 }] },
    };
  }, [sessions]);

  const symmetry = useMemo((): ChartConfiguration<'bar'> | null => {
    const last = assessments.findLast((a) => analyzeAsymmetry(a.perimeters).length > 0);
    if (!last) return null;
    const items = analyzeAsymmetry(last.perimeters);
    return {
      type: 'bar',
      data: {
        labels: items.map((i) => i.label),
        datasets: [
          { label: 'Direito', data: items.map((i) => i.right), backgroundColor: COLORS.primary, borderRadius: 4 },
          { label: 'Esquerdo', data: items.map((i) => i.left), backgroundColor: COLORS.info, borderRadius: 4 },
        ],
      },
      options: { scales: { y: { beginAtZero: false } } },
    };
  }, [assessments]);

  return (
    <>
      <Card title="Composição corporal">
        {composition ? <ChartCanvas config={composition} /> : <Empty text="Salve uma avaliação com dobras para ver a curva." />}
        <p class="muted small">● em jejum · ▲ pós-treino. Compare pontos do mesmo formato.</p>
      </Card>

      <Card
        title="Perímetros"
        aside={
          <select value={site} onChange={(e) => setSite(e.currentTarget.value as PerimeterSite)}>
            {PERIMETERS.map((p) => (
              <option key={p} value={p}>
                {PERIMETER_LABEL[p]}
              </option>
            ))}
          </select>
        }
      >
        {perimeter ? <ChartCanvas config={perimeter} /> : <Empty text="Sem medidas desse perímetro ainda." />}
      </Card>

      <Card
        title="Força"
        aside={
          trained.length > 0 && (
            <select value={selectedEx} onChange={(e) => setExId(e.currentTarget.value)}>
              {trained.map((id) => (
                <option key={id} value={id}>
                  {exerciseById(id)?.name ?? id}
                </option>
              ))}
            </select>
          )
        }
      >
        {strength ? <ChartCanvas config={strength} /> : <Empty text="Finalize um treino para acompanhar o 1RM estimado." />}
      </Card>

      <Card title="Volume semanal">{weekly ? <ChartCanvas config={weekly} height={180} /> : <Empty text="Sem treinos registrados." />}</Card>

      <Card title="Simetria bilateral">{symmetry ? <ChartCanvas config={symmetry} height={200} /> : <Empty text="Meça os dois lados para comparar." />}</Card>

      <Card title="Histórico de avaliações">
        {assessments.length === 0 && <Empty text="Nenhuma avaliação." />}
        <ul class="history">
          {[...assessments].reverse().map((a) => (
            <li key={a.id}>
              <div>
                <strong>{formatBR(a.date)}</strong> <span class="muted small">{CONDITION_LABEL[a.condition]}</span>
              </div>
              <div class="small">
                {fmtNum(a.weightKg)} kg
                {a.result && ` · ${fmtNum(a.result.bfPercent)}% (${a.result.protocol === 'recorded' ? 'importado' : a.result.protocol})`}
                {a.perimeters.chest && ` · tórax ${fmtNum(a.perimeters.chest)} cm`}
              </div>
              <button class="link danger" onClick={() => confirm(`Apagar a avaliação de ${formatBR(a.date)}?`) && deleteAssessment(a.id)}>
                apagar
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

const Empty = ({ text }: { text: string }) => <p class="empty">{text}</p>;
