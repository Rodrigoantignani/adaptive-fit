import { useEffect, useMemo, useState } from 'preact/hooks';
import { discardSession, finishSession, logSet, removeSet, startSession, upsertCheckIn } from '../data/actions';
import { app } from '../data/store';
import { EXERCISES, exerciseById } from '../domain/exercises';
import { performanceHistory, sessionRecords, sessionTotals, suggestSplit } from '../domain/history';
import { ACTION_LABEL, DAY_LOAD_LABEL, SORENESS_LABEL, SPLIT_HINT, SPLIT_LABEL, SPLIT_ORDER, TIER_LABEL } from '../domain/labels';
import { buildPlan } from '../domain/planner';
import { assessReadiness } from '../domain/readiness';
import type { CheckIn, DayLoad, Exercise, PlannedExercise, Readiness, Session, SorenessArea, SplitId } from '../domain/types';
import { formatBR, localISODate } from '../lib/date';
import { useWakeLock } from '../lib/device';
import { fmtDuration, fmtNum } from '../lib/format';
import { uid } from '../lib/id';
import { Card, Choice, Chips, Notice, NumField, Rating, Stepper, Toggle } from '../ui/kit';
import { ObsidianActions } from '../ui/ObsidianActions';
import { RestPresets, startRest } from '../ui/timer';
import { ProfileForm } from './Settings';

const fmtLoad = (load: number | null, ex: Exercise) => {
  if (load === null) return ex.equipment === 'bodyweight' ? 'peso corporal' : 'carga a definir';
  if (ex.equipment === 'bodyweight') return load > 0 ? `lastro ${fmtNum(load)} kg` : 'peso corporal';
  return `${fmtNum(load)} ${ex.loadUnit}`;
};

export function Today() {
  const s = app.value;
  const today = localISODate();
  const [editing, setEditing] = useState(false);
  const checkIn = s.checkIns.find((c) => c.date === today) ?? null;
  const active = s.sessions.find((x) => !x.endedAt) ?? null;
  const doneToday = s.sessions.findLast((x) => x.date === today && x.endedAt) ?? null;

  if (!s.profile) {
    return (
      <>
        <Notice tone="info" title="Bem-vindo ao Adaptive Fit">
          Preencha o perfil uma vez: sexo e idade alimentam as fórmulas de composição corporal, e o cuidado com a coluna filtra exercícios automaticamente.
        </Notice>
        <ProfileForm />
      </>
    );
  }
  if (active) return <ActiveSession session={active} />;

  return (
    <>
      {!checkIn || editing ? (
        <CheckInForm key={checkIn?.id ?? 'new'} initial={checkIn ?? newCheckIn(today)} onDone={() => setEditing(false)} />
      ) : (
        <PlanView checkIn={checkIn} onEdit={() => setEditing(true)} trainedToday={!!doneToday} />
      )}
      {doneToday && <SessionSummary session={doneToday} />}
    </>
  );
}

function newCheckIn(date: string): CheckIn {
  const { checkIns, sessions } = app.value;
  const last = checkIns.at(-1);
  return {
    id: uid(),
    date,
    sleepHours: last?.sleepHours ?? 7,
    sleepQuality: 3,
    energy: 3,
    dayLoad: last?.dayLoad ?? 'light',
    timeAvailMin: last?.timeAvailMin ?? 60,
    soreness: [],
    spineAlert: false,
    split: suggestSplit(sessions, date, SPLIT_ORDER).split,
  };
}

function CheckInForm({ initial, onDone }: { initial: CheckIn; onDone: () => void }) {
  const [c, setC] = useState(initial);
  const set = <K extends keyof CheckIn>(k: K, v: CheckIn[K]) => setC((prev) => ({ ...prev, [k]: v }));
  const profile = app.value.profile;
  const preview = assessReadiness(c, profile);
  const suggestion = suggestSplit(app.value.sessions, c.date, SPLIT_ORDER);

  return (
    <Card title="Check-in de prontidão" aside={formatBR(c.date)}>
      <div class="grid-2">
        <NumField label="Horas de sono" suffix="h" value={c.sleepHours} onChange={(v) => set('sleepHours', v ?? 0)} />
        <NumField label="Tempo para treinar" suffix="min" value={c.timeAvailMin} onChange={(v) => set('timeAvailMin', v ?? 0)} />
      </div>
      <Rating label="Qualidade do sono" low="péssimo" high="perfeito" value={c.sleepQuality} onChange={(v) => set('sleepQuality', v)} />
      <Rating label="Energia agora" low="esgotado" high="elétrico" value={c.energy} onChange={(v) => set('energy', v)} />
      <Choice<DayLoad>
        label="Demanda física do dia"
        value={c.dayLoad}
        onChange={(v) => set('dayLoad', v)}
        options={(Object.keys(DAY_LOAD_LABEL) as DayLoad[]).map((k) => ({ value: k, ...DAY_LOAD_LABEL[k] }))}
      />
      <Chips<SorenessArea>
        label="Dor ou desconforto"
        values={c.soreness}
        onChange={(v) => set('soreness', v)}
        options={(Object.keys(SORENESS_LABEL) as SorenessArea[]).map((k) => ({ value: k, label: SORENESS_LABEL[k] }))}
      />
      {!profile?.spineCare && (
        <Toggle label="Alerta lombar hoje" hint="Bloqueia carga axial só nesta sessão." checked={c.spineAlert} onChange={(v) => set('spineAlert', v)} />
      )}
      <Choice<SplitId>
        label="Foco da sessão"
        value={c.split}
        onChange={(v) => set('split', v)}
        options={SPLIT_ORDER.map((k) => ({
          value: k,
          label: SPLIT_LABEL[k],
          hint: SPLIT_HINT[k],
          badge: k === suggestion.split ? 'sugerido' : undefined,
        }))}
      />
      <div class={`live-score tier-${preview.tier}`}>
        <span>Prontidão prevista</span>
        <strong>{preview.score}</strong>
        <em>{TIER_LABEL[preview.tier]}</em>
      </div>
      <button
        class="btn"
        onClick={() => {
          upsertCheckIn(c);
          onDone();
        }}
      >
        Gerar treino do dia
      </button>
    </Card>
  );
}

function usePlan(checkIn: CheckIn) {
  const { profile, sessions, settings } = app.value;
  const readiness = useMemo(() => assessReadiness(checkIn, profile), [checkIn, profile]);
  const plan = useMemo(
    () =>
      buildPlan({
        checkIn,
        readiness,
        exercises: EXERCISES,
        historyFor: (id) => performanceHistory(sessions, id),
        refLoads: settings.refLoads,
      }),
    [checkIn, readiness, sessions, settings.refLoads],
  );
  return { readiness, plan };
}

function ScoreRing({ readiness }: { readiness: Readiness }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div class={`score-ring tier-${readiness.tier}`}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r={r} class="track" />
        <circle cx="40" cy="40" r={r} class="value" stroke-dasharray={`${(readiness.score / 100) * c} ${c}`} />
      </svg>
      <div>
        <strong>{readiness.score}</strong>
        <small>{TIER_LABEL[readiness.tier]}</small>
      </div>
    </div>
  );
}

function PlanView({ checkIn, onEdit, trainedToday }: { checkIn: CheckIn; onEdit: () => void; trainedToday: boolean }) {
  const { readiness, plan } = usePlan(checkIn);
  return (
    <>
      <Card
        title="Prontidão"
        aside={
          <button class="link" onClick={onEdit}>
            Refazer check-in
          </button>
        }
      >
        <div class="readiness">
          <ScoreRing readiness={readiness} />
          <ul class="factors">
            {readiness.factors.map((f) => (
              <li key={f.label} class={f.tone}>
                <span>{f.label}</span>
                <b>{f.value}</b>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {plan.rules.length > 0 && (
        <Card title="Diretrizes do dia">
          {plan.rules.map((r) => (
            <Notice key={r.id} tone={r.tone} title={r.title}>
              {r.detail}
            </Notice>
          ))}
        </Card>
      )}

      <Card title={`Plano · ${SPLIT_LABEL[checkIn.split]}`} aside={`~${plan.estimatedMin} min`}>
        <ol class="plan-list">
          {plan.items.map((it) => (
            <PlanRow key={it.exerciseId} item={it} />
          ))}
        </ol>
        {plan.dropped.length > 0 && (
          <p class="muted small">
            Fora hoje: {plan.dropped.map((d) => `${exerciseById(d.exerciseId)?.name} (${d.reason})`).join(' · ')}
          </p>
        )}
        <button
          class="btn"
          onClick={() => {
            startSession(checkIn, readiness, plan);
            window.scrollTo({ top: 0 });
          }}
        >
          {trainedToday ? 'Treinar de novo' : 'Iniciar treino'}
        </button>
      </Card>
    </>
  );
}

function PlanRow({ item }: { item: PlannedExercise }) {
  const ex = exerciseById(item.exerciseId)!;
  const partner = item.supersetWith ? exerciseById(item.supersetWith) : undefined;
  const replaced = item.substitutedFor ? exerciseById(item.substitutedFor) : undefined;
  return (
    <li class="plan-row">
      <div class="plan-main">
        <strong>{ex.name}</strong>
        <span class={`action ${item.target.action}`}>{ACTION_LABEL[item.target.action]}</span>
      </div>
      <div class="plan-meta">
        {item.sets} × {ex.repMin}–{ex.repMax} · {fmtLoad(item.target.load, ex)} · descanso {item.restSec}s
      </div>
      {(partner || replaced) && (
        <div class="tags">
          {partner && <span class="tag">super-série com {partner.name}</span>}
          {replaced && <span class="tag">no lugar de {replaced.name}</span>}
        </div>
      )}
      <div class="plan-reason">{item.target.reason}</div>
    </li>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function ActiveSession({ session }: { session: Session }) {
  useWakeLock(true);
  const now = useNow(1000);
  const done = session.entries.reduce((a, e) => a + e.sets.length, 0);
  const planned = session.plan.reduce((a, p) => a + p.sets, 0);

  return (
    <>
      <div class="session-head">
        <div>
          <small>{SPLIT_LABEL[session.split]} · {TIER_LABEL[session.tier]}</small>
          <strong>{fmtDuration(now - session.startedAt)}</strong>
        </div>
        <div class="session-progress">
          <span>
            {done}/{planned} séries
          </span>
          <div class="bar">
            <div style={{ width: `${Math.min(100, (done / Math.max(1, planned)) * 100)}%` }} />
          </div>
        </div>
      </div>
      <RestPresets />
      {session.rules.length > 0 && (
        <details class="card rules-collapsed">
          <summary>Diretrizes do dia ({session.rules.length})</summary>
          {session.rules.map((r) => (
            <Notice key={r.id} tone={r.tone} title={r.title}>
              {r.detail}
            </Notice>
          ))}
        </details>
      )}
      {session.plan.map((it) => (
        <ExerciseLogger key={it.exerciseId} session={session} item={it} />
      ))}
      <div class="grid-2">
        <button
          class="btn btn-ghost danger"
          onClick={() => {
            if (confirm('Descartar este treino? As séries registradas serão perdidas.')) discardSession(session.id);
          }}
        >
          Descartar
        </button>
        <button
          class="btn"
          onClick={() => {
            if (done === 0 && !confirm('Nenhuma série registrada. Finalizar mesmo assim?')) return;
            finishSession(session.id);
          }}
        >
          Finalizar treino
        </button>
      </div>
    </>
  );
}

function ExerciseLogger({ session, item }: { session: Session; item: PlannedExercise }) {
  const ex = exerciseById(item.exerciseId)!;
  const sets = session.entries.find((e) => e.exerciseId === ex.id)?.sets ?? [];
  const last = sets.at(-1);
  const [load, setLoad] = useState<number | undefined>(last?.load ?? item.target.load ?? undefined);
  const [reps, setReps] = useState<number | undefined>(last?.reps ?? item.target.reps);
  const complete = sets.length >= item.sets;
  const order = session.plan.map((p) => p.exerciseId);
  const firstOfPair = item.supersetWith !== undefined && order.indexOf(ex.id) < order.indexOf(item.supersetWith);
  const partner = item.supersetWith ? exerciseById(item.supersetWith) : undefined;

  const log = () => {
    if (!reps || reps <= 0) return;
    logSet(session.id, ex.id, { load: load ?? 0, reps, at: Date.now() });
    if (!firstOfPair) startRest(item.restSec, `Descanso · ${ex.name}`);
  };

  return (
    <section class={`card logger ${complete ? 'complete' : ''}`}>
      <div class="logger-head">
        <div>
          <strong>{ex.name}</strong>
          <div class="muted small">
            Alvo: {item.sets} × {item.target.reps}–{ex.repMax} · {fmtLoad(item.target.load, ex)}
          </div>
        </div>
        <span class="count">
          {sets.length}/{item.sets}
        </span>
      </div>
      {partner && <div class="tag">{firstOfPair ? `Super-série: vá direto para ${partner.name}` : `Super-série com ${partner.name}: descanse agora`}</div>}
      {ex.cue && <div class="cue">{ex.cue}</div>}
      {sets.length > 0 && (
        <div class="set-pills">
          {sets.map((st, i) => (
            <button
              key={st.at}
              class={`set-pill ${st.reps >= ex.repMin ? 'ok' : 'low'}`}
              title="Toque para remover"
              onClick={() => confirm(`Remover série ${i + 1} (${fmtNum(st.load)} × ${st.reps})?`) && removeSet(session.id, ex.id, i)}
            >
              {fmtNum(st.load)}×{st.reps}
            </button>
          ))}
        </div>
      )}
      <div class="log-row">
        <Stepper label={ex.loadUnit} value={load} step={ex.increment || 1} onChange={setLoad} />
        <Stepper label="reps" value={reps} step={1} onChange={setReps} />
        <button class="btn btn-log" onClick={log} aria-label={`Registrar série de ${ex.name}`}>
          ✓
        </button>
      </div>
    </section>
  );
}

function SessionSummary({ session }: { session: Session }) {
  const all = app.value.sessions;
  const totals = sessionTotals(session);
  const records = sessionRecords(session, all);
  return (
    <Card title="Treino concluído" aside={`${totals.minutes} min`}>
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-val">{totals.sets}</div>
          <div class="kpi-lbl">Séries</div>
        </div>
        <div class="kpi">
          <div class="kpi-val">{fmtNum(totals.volume)}</div>
          <div class="kpi-lbl">Volume kg</div>
        </div>
        <div class="kpi">
          <div class="kpi-val">{records.length}</div>
          <div class="kpi-lbl">Recordes</div>
        </div>
      </div>
      {records.map((r) => (
        <Notice key={r.exerciseId} tone="good" title={`Recorde: ${exerciseById(r.exerciseId)?.name}`}>
          1RM estimado {fmtNum(r.e1rm)} (antes {fmtNum(r.previous)})
        </Notice>
      ))}
      <ObsidianActions date={session.date} />
    </Card>
  );
}
