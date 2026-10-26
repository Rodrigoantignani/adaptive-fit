import type { ChartConfiguration } from 'chart.js';
import { useMemo, useState } from 'preact/hooks';
import { deleteAssessment } from '../data/actions';
import { app } from '../data/store';
import { analyzeAsymmetry, BILATERAL_PAIRS } from '../domain/asymmetry';
import { exerciseById } from '../domain/exercises';
import { amrapHistory, lastSideStrength, performanceHistory, sessionTotals, weeklySetsByMuscle } from '../domain/history';
import { CONDITION_LABEL, MUSCLE_LABEL, PERIMETER_LABEL } from '../domain/labels';
import { bestE1rm } from '../domain/progression';
import { latestWeight } from '../domain/routine';
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
    const assisted = exerciseById(selectedEx)?.loadMode === 'assisted';
    return {
      type: 'line',
      data: {
        labels: hist.map((h) => shortBR(h.date)),
        datasets: [
          assisted
            ? { label: 'Menor ajuda usada (kg) · quanto menor, melhor', data: hist.map((h) => Math.min(...h.sets.map((s) => s.load))), borderColor: COLORS.info, tension: 0.3 }
            : { label: '1RM estimado', data: hist.map((h) => round(bestE1rm(h.sets))), borderColor: COLORS.success, tension: 0.3 },
        ],
      },
    };
  }, [sessions, selectedEx]);

  /** E − D em % do maior lado: negativo = esquerdo menor. Mostra se a correção está funcionando. */
  const asymTrend = useMemo((): ChartConfiguration<'line'> | null => {
    const rows = assessments.filter((a) => analyzeAsymmetry(a.perimeters).length > 0);
    if (rows.length < 1) return null;
    const palette = [COLORS.primary, COLORS.info, COLORS.success, COLORS.danger];
    return {
      type: 'line',
      data: {
        labels: rows.map((a) => shortBR(a.date)),
        datasets: BILATERAL_PAIRS.map((p, i) => ({
          label: p.label,
          data: rows.map((a) => {
            const r = a.perimeters[p.r];
            const l = a.perimeters[p.l];
            return r && l ? round(((l - r) / Math.max(l, r)) * 100) : null;
          }),
          borderColor: palette[i],
          spanGaps: true,
          tension: 0.3,
        })).filter((d) => d.data.some((v) => v !== null)),
      },
      options: { scales: { y: { title: { display: true, text: 'E − D (%)' } } } },
    };
  }, [assessments]);

  const muscleVolume = useMemo((): ChartConfiguration<'bar'> | null => {
    const sets = weeklySetsByMuscle(sessions, weekStart(localISODate()));
    if (!sets.size) return null;
    const rows = [...sets.entries()].sort((a, b) => b[1] - a[1]);
    const color = (n: number) => (n < 10 ? COLORS.info : n <= 20 ? COLORS.success : COLORS.primary);
    return {
      type: 'bar',
      data: {
        labels: rows.map(([m]) => MUSCLE_LABEL[m]),
        datasets: [{ label: 'Séries nesta semana', data: rows.map(([, n]) => n), backgroundColor: rows.map(([, n]) => color(n)), borderRadius: 4 }],
      },
      options: { indexAxis: 'y', plugins: { legend: { display: false } } },
    };
  }, [sessions]);

  const amraps = useMemo(() => [...amrapHistory(sessions).entries()], [sessions]);

  /** Último 1RM estimado por lado nos unilaterais. */
  const sideBars = useMemo((): ChartConfiguration<'bar'> | null => {
    const rows = trained
      .map((id) => ({ id, s: lastSideStrength(sessions, id) }))
      .filter((r): r is { id: string; s: { L: number; R: number } } => !!r.s && r.s.L > 0 && r.s.R > 0);
    if (!rows.length) return null;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => exerciseById(r.id)?.name ?? r.id),
        datasets: [
          { label: 'Esquerdo', data: rows.map((r) => round(r.s.L)), backgroundColor: COLORS.info, borderRadius: 4 },
          { label: 'Direito', data: rows.map((r) => round(r.s.R)), backgroundColor: COLORS.primary, borderRadius: 4 },
        ],
      },
      options: { indexAxis: 'y' },
    };
  }, [sessions, trained]);

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
      if (vol.has(w)) vol.set(w, vol.get(w)! + sessionTotals(s, latestWeight(assessments)).volume);
    }
    return {
      type: 'bar',
      data: { labels: weeks.map(shortBR), datasets: [{ label: 'Volume semanal (kg)', data: weeks.map((w) => vol.get(w)!), backgroundColor: COLORS.primary, borderRadius: 4 }] },
    };
  }, [sessions, assessments]);

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

      <Card title="Assimetria ao longo do tempo">
        {asymTrend ? <ChartCanvas config={asymTrend} height={200} /> : <Empty text="Meça os dois lados em mais de uma avaliação." />}
        <p class="muted small">Abaixo de zero = lado esquerdo menor. A meta é a linha subir até perto de 0.</p>
      </Card>

      <Card title="Volume por músculo · esta semana">
        {muscleVolume ? (
          <ChartCanvas config={muscleVolume} height={Math.max(140, 40 + 28 * (muscleVolume.data.labels?.length ?? 1))} />
        ) : (
          <Empty text="Finalize treinos nesta semana para ver o volume por músculo." />
        )}
        <p class="muted small">Referência para hipertrofia: ~10–20 séries por músculo na semana. Azul abaixo, verde na faixa, laranja acima.</p>
      </Card>

      <Card title="Série máxima do lado fraco">
        {amraps.length === 0 && <Empty text="Quando o plano pedir a série extra no máximo de reps, o resultado aparece aqui." />}
        <ul class="history">
          {amraps.map(([id, list]) => {
            const last = list.at(-1)!;
            const first = list[0];
            return (
              <li key={id}>
                <div>
                  <strong>{exerciseById(id)?.name ?? id}</strong>{' '}
                  <span class="muted small">{last.side === 'L' ? 'esquerdo' : last.side === 'R' ? 'direito' : ''}</span>
                </div>
                <div class="small">
                  {list.length > 1 ? `${first.reps} → ${last.reps} reps` : `${last.reps} reps`} com {fmtNum(last.load)} kg · {list.length} registro(s)
                </div>
              </li>
            );
          })}
        </ul>
        <p class="muted small">Se as reps da série máxima sobem com a mesma carga, o lado fraco está alcançando o forte.</p>
      </Card>

      <Card title="Força por lado (unilaterais)">
        {sideBars ? <ChartCanvas config={sideBars} height={Math.max(140, 60 + 40 * (sideBars.data.labels?.length ?? 1))} /> : <Empty text="Registre séries de exercícios unilaterais (E/D) para comparar." />}
      </Card>

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
