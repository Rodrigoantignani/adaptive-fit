import { useEffect, useMemo, useState } from 'preact/hooks';
import { discardSession, finishSession, logSet, removeSet, saveSettings, startSession, upsertCheckIn } from '../data/actions';
import { nutritionFor } from '../data/nutrition';
import { app } from '../data/store';
import { activeLibrary, exerciseById } from '../domain/exercises';
import { functionalFlags, latestFunctional, reassessDue } from '../domain/functional';
import { lastSideStrength, performanceHistory, sessionRecords, sessionTotals, weeklySetsByMuscle } from '../domain/history';
import { ACTION_LABEL, DAY_LOAD_LABEL, SIDE_LABEL, SORENESS_LABEL, SPLIT_HINT, SPLIT_LABEL, SPLIT_ORDER, TIER_LABEL } from '../domain/labels';
import { buildPlan, isAmrapNext, nextSide, setCount } from '../domain/planner';
import { CYCLE_WEEKS, PHASE_INFO, programWeek } from '../domain/periodization';
import { assessReadiness } from '../domain/readiness';
import { DEFAULT_TEMPLATES } from '../domain/templates';
import { dayDefaults, latestBilateral, latestWeight, workFor } from '../domain/routine';
import type { CheckIn, CorrectiveBlock, DayLoad, Exercise, PlannedExercise, Readiness, Session, SetLog, Side, SorenessArea, SplitId } from '../domain/types';
import { formatBR, localISODate, weekStart } from '../lib/date';
import { useWakeLock } from '../lib/device';
import { fmtDuration, fmtNum } from '../lib/format';
import { uid } from '../lib/id';
import { Card, Choice, Chips, Notice, NumField, Presets, Rating, Stepper, Toggle } from '../ui/kit';
import { ObsidianActions } from '../ui/ObsidianActions';
import { TechniqueTag } from '../ui/TechniqueSheet';
import { startRest } from '../ui/timer';
import { ProfileForm } from './Settings';

export const fmtLoad = (load: number | null, ex: Exercise) => {
  if (ex.loadMode === 'assisted') return load === null ? 'ajuda a definir' : load === 0 ? 'sem ajuda' : `ajuda ${fmtNum(load)} kg`;
  if (load === null) return ex.equipment === 'bodyweight' ? 'peso corporal' : 'carga a definir';
  if (ex.equipment === 'bodyweight') return load > 0 ? `lastro ${fmtNum(load)} kg` : 'peso corporal';
  return `${fmtNum(load)} ${ex.loadUnit}`;
};

const sideTag = (s?: Side) => (s ? (s === 'L' ? 'E' : 'D') : '');

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
          Preencha o perfil uma vez: sexo e idade alimentam as fórmulas de composição corporal; coluna e escoliose ajustam os exercícios e o aquecimento.
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
  const { checkIns, sessions, settings } = app.value;
  const last = checkIns.at(-1);
  const d = dayDefaults(date, settings.week, last, sessions, settings.rotation, settings.shiftDates);
  return {
    id: uid(),
    date,
    sleepHours: d.sleepGuess,
    sleepQuality: 3,
    energy: 3,
    dayLoad: d.dayLoad,
    timeAvailMin: d.timeAvailMin,
    soreness: [],
    spineAlert: false,
    split: d.split,
  };
}

function CheckInForm({ initial, onDone }: { initial: CheckIn; onDone: () => void }) {
  const [c, setC] = useState(initial);
  const set = <K extends keyof CheckIn>(k: K, v: CheckIn[K]) => setC((prev) => ({ ...prev, [k]: v }));
  const { profile, settings, checkIns, sessions } = app.value;
  const preview = assessReadiness(c, profile);
  const defaults = dayDefaults(c.date, settings.week, checkIns.at(-1), sessions, settings.rotation, settings.shiftDates);
  const work = workFor(c.date, settings.week, settings.shiftDates);
  const shiftToday = (work?.standingH ?? 0) > 0 ? work : undefined;

  return (
    <Card title="Check-in de prontidão" aside={formatBR(c.date)}>
      {shiftToday && (
        <Notice tone="info" title={`Turno em pé hoje: ${shiftToday.standingStart}–${shiftToday.standingEnd}`}>
          A demanda do dia já considera o turno. Mudou a escala? Ajuste em Ajustes → Turnos.
        </Notice>
      )}
      {defaults.restDay && (
        <Notice tone="info" title="Dia de descanso na sua rotina">
          Se quiser treinar mesmo assim, o plano se ajusta à sua prontidão.
        </Notice>
      )}
      <div class="grid-2">
        <NumField label="Sono (noite passada)" suffix="h" value={c.sleepHours} onChange={(v) => set('sleepHours', v ?? 0)} />
        <NumField label="Tempo para treinar" suffix="min" value={c.timeAvailMin} onChange={(v) => set('timeAvailMin', v ?? 0)} />
      </div>
      <Presets values={[45, 60, 70, 90]} suffix=" min" value={c.timeAvailMin} onPick={(v) => set('timeAvailMin', v)} />
      {profile?.achilles && (
        <div class="field">
          <span>
            Dor no tendão de Aquiles agora
            <small class="muted"> · 0 = nada, 10 = muita</small>
          </span>
          <div class="rating pain" role="radiogroup">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={(c.tendonPain ?? 0) === n}
                class={`${(c.tendonPain ?? 0) === n ? 'on' : ''} ${n >= 5 ? 'hi' : n >= 3 ? 'mid' : ''}`}
                onClick={() => set('tendonPain', n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
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
      {profile?.achilles && (
        <Toggle
          label="A dor do tendão piorou depois do último treino?"
          hint="Regra das 24 h: se na manhã seguinte doeu mais que antes, a carga passou do ponto."
          checked={!!c.tendonWorse}
          onChange={(v) => set('tendonWorse', v)}
        />
      )}
      <Toggle
        label="Formigamento ou dor que irradia"
        hint="Sinal de alerta: o treino fica leve e sem carga na coluna."
        checked={!!c.radiating}
        onChange={(v) => set('radiating', v)}
      />
      <Choice<SplitId>
        label="Treino do dia"
        cols={2}
        value={c.split}
        onChange={(v) => set('split', v)}
        options={SPLIT_ORDER.map((k) => ({
          value: k,
          label: SPLIT_LABEL[k],
          hint: SPLIT_HINT[k],
          badge: k === defaults.split ? (defaults.source === 'routine' ? 'rotina' : 'sugerido') : undefined,
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
  const { profile, sessions, settings, customExercises, assessments, functionalTests } = app.value;
  const readiness = useMemo(() => assessReadiness(checkIn, profile), [checkIn, profile]);
  const plan = useMemo(
    () =>
      buildPlan({
        checkIn,
        readiness,
        exercises: activeLibrary(customExercises, settings.hiddenExercises),
        historyFor: (id) => performanceHistory(sessions, id),
        refLoads: settings.refLoads,
        profile,
        perimeters: latestBilateral(assessments)?.perimeters,
        sideStrength: (id) => lastSideStrength(sessions, id),
        learnedRest: settings.learnedRest,
        functional: functionalFlags(latestFunctional(functionalTests)),
        reassess: reassessDue(functionalTests, checkIn.date),
        program: settings.programStart ? programWeek(settings.programStart, checkIn.date) : undefined,
        template: settings.splitTemplates[checkIn.split] ?? DEFAULT_TEMPLATES[checkIn.split],
        weekSets: weeklySetsByMuscle(sessions, weekStart(checkIn.date)),
      }),
    [checkIn, readiness, sessions, settings, customExercises, assessments, profile, functionalTests],
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

function CorrectiveCard({ block, checkable }: { block: CorrectiveBlock; checkable?: boolean }) {
  const [done, setDone] = useState<string[]>([]);
  return (
    <Card title={block.title} aside={`~${block.minutes} min`} class="corrective">
      <ul class="corrective-list">
        {block.items.map((it) => (
          <li key={it.id} class={done.includes(it.id) ? 'done' : ''}>
            {checkable && (
              <input
                type="checkbox"
                aria-label={`Feito: ${it.title}`}
                checked={done.includes(it.id)}
                onChange={(e) => setDone((d) => (e.currentTarget.checked ? [...d, it.id] : d.filter((x) => x !== it.id)))}
              />
            )}
            <div>
              <strong>{it.title}</strong> <span class="dose">{it.dose}</span>
              <p>{it.how}</p>
            </div>
          </li>
        ))}
      </ul>
      <p class="muted small">{block.disclaimer}</p>
    </Card>
  );
}

/** Onde você está no programa: ciclo, fase, reserva alvo e a técnica nova da semana. */
function ProgramCard({ date }: { date: string }) {
  const start = app.value.settings.programStart;
  if (!start) {
    return (
      <Card title="Programa periodizado">
        <p class="small">
          Ciclos de 6 semanas: adaptação → acumulação → intensificação → deload. A cada ciclo, novas técnicas avançadas são liberadas, uma de cada vez,
          com explicação.
        </p>
        <button class="btn btn-ghost" onClick={() => saveSettings({ programStart: weekStart(date) })}>
          Começar nesta semana
        </button>
      </Card>
    );
  }
  const p = programWeek(start, date);
  const info = PHASE_INFO[p.phase];
  return (
    <Card title={`Ciclo ${p.cycle} · ${info.label}`} aside={`semana ${p.week}/${CYCLE_WEEKS}`} class={`program phase-${p.phase}`}>
      <div class="cycle-dots" aria-hidden="true">
        {Array.from({ length: CYCLE_WEEKS }, (_, i) => (
          <span key={i} class={i + 1 < p.week ? 'done' : i + 1 === p.week ? 'now' : ''} />
        ))}
      </div>
      <p class="small">{info.detail}</p>
      <div class="program-meta">
        <span>
          Reserva alvo: <b>{info.rir} reps</b>
        </span>
        <span>
          Técnicas por treino: <b>{info.maxTechniques || 'nenhuma'}</b>
        </span>
      </div>
      {p.newThisWeek.length > 0 && (
        <div class="novelty">
          <strong>Novidade da semana</strong>
          <div class="tags">
            {p.newThisWeek.map((id) => (
              <TechniqueTag key={id} id={id} />
            ))}
          </div>
        </div>
      )}
      {p.unlocked.length > 0 && p.newThisWeek.length !== p.unlocked.length && (
        <div class="tags">
          <small class="muted">Liberadas:</small>
          {p.unlocked.filter((id) => !p.newThisWeek.includes(id)).map((id) => (
            <TechniqueTag key={id} id={id} />
          ))}
        </div>
      )}
    </Card>
  );
}

function PlanView({ checkIn, onEdit, trainedToday }: { checkIn: CheckIn; onEdit: () => void; trainedToday: boolean }) {
  const { readiness, plan } = usePlan(checkIn);
  const fuel = nutritionFor(app.value, checkIn.date);
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

      <ProgramCard date={checkIn.date} />

      {fuel && (
        <div class="fuel-line">
          <span>Hoje</span>
          <b>{fmtNum(fuel.macros.kcal)} kcal</b>
          <span>
            P {fuel.macros.protein} · C {fuel.macros.carbs} · G {fuel.macros.fat} g
          </span>
          {fuel.energy.standing > 0 && <i>turno em pé</i>}
        </div>
      )}

      {plan.rules.length > 0 && (
        <Card title="Diretrizes do dia">
          {plan.rules.map((r) => (
            <Notice key={r.id} tone={r.tone} title={r.title}>
              {r.detail}
            </Notice>
          ))}
        </Card>
      )}

      {plan.corrective && <CorrectiveCard block={plan.corrective} />}

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

function setsLabel(item: PlannedExercise, ex: Exercise) {
  const reps = `${ex.repMin}–${ex.repMax}`;
  if (!item.perSide) return `${item.sets} × ${reps}`;
  const extra = item.extraSet && item.weakSide ? ` + 1 máx. de reps no ${SIDE_LABEL[item.weakSide]}` : '';
  return `${item.sets} × ${reps} por lado${extra}`;
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
        {setsLabel(item, ex)} · {fmtLoad(item.target.load, ex)} · descanso {item.restSec}s
      </div>
      {(partner || replaced || ex.photo || item.technique) && (
        <div class="tags">
          {ex.photo && <img class="thumb" src={ex.photo} alt="" />}
          {partner && <TechniqueTag id="superset" prefix={`${partner.name} · `} />}
          {item.technique && <TechniqueTag id={item.technique} prefix="Última série: " />}
          {replaced && <span class="tag">no lugar de {replaced.name}</span>}
        </div>
      )}
      {(item.notes ?? []).map((n) => (
        <div key={n} class="tag warn">
          {n}
        </div>
      ))}
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
  const planned = session.plan.reduce((a, p) => a + setCount(p), 0);

  return (
    <>
      <div class="session-head">
        <div>
          <small>
            {SPLIT_LABEL[session.split]} · {TIER_LABEL[session.tier]}
          </small>
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
      {session.corrective && <CorrectiveCard block={session.corrective} checkable />}
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
            window.scrollTo({ top: 0 });
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
  const [sideOverride, setSideOverride] = useState<Side | null>(null);
  const side = item.perSide ? (sideOverride ?? nextSide(sets, item)) : undefined;
  const amrapNow = side !== undefined && side === item.weakSide && isAmrapNext(sets, item);
  const total = setCount(item);
  const complete = sets.length >= total;
  const order = session.plan.map((p) => p.exerciseId);
  const firstOfPair = item.supersetWith !== undefined && order.indexOf(ex.id) < order.indexOf(item.supersetWith);
  const partner = item.supersetWith ? exerciseById(item.supersetWith) : undefined;

  const log = () => {
    if (!reps || reps <= 0) return;
    const set: SetLog = { load: load ?? 0, reps, at: Date.now(), ...(side ? { side } : {}), ...(amrapNow ? { amrap: true } : {}) };
    logSet(session.id, ex.id, set);
    setSideOverride(null);
    if (firstOfPair) return;
    if (side) {
      const after = [...sets, set];
      const n = (s: Side) => after.filter((x) => x.side === s).length;
      // descansa quando os dois lados estão empatados ou o outro lado já terminou
      if (n('L') !== n('R') && nextSide(after, item) !== side) return;
    }
    startRest(app.value.settings.learnedRest[ex.id] ?? item.restSec, `Descanso · ${ex.name}`, ex.id);
  };

  return (
    <section class={`card logger ${complete ? 'complete' : ''}`}>
      <div class="logger-head">
        {ex.photo && <img class="thumb lg" src={ex.photo} alt={`Foto: ${ex.name}`} />}
        <div class="grow">
          <strong>{ex.name}</strong>
          <div class="muted small">
            Alvo: {setsLabel(item, ex)} · {item.target.reps}+ reps · {fmtLoad(item.target.load, ex)}
          </div>
        </div>
        <span class="count">
          {sets.length}/{total}
        </span>
      </div>
      {partner && <div class="tag">{firstOfPair ? `Super-série: vá direto para ${partner.name}` : `Super-série com ${partner.name}: descanse agora`}</div>}
      {item.technique && (
        <div class="tags">
          <TechniqueTag id={item.technique} prefix="Na última série: " />
        </div>
      )}
      {(item.notes ?? []).map((n) => (
        <div key={n} class="tag warn">
          {n}
        </div>
      ))}
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
              {sideTag(st.side) && <i>{sideTag(st.side)}</i>}
              {fmtNum(st.load)}×{st.reps}
              {st.amrap && <i> máx</i>}
            </button>
          ))}
        </div>
      )}
      {amrapNow && (
        <Notice tone="warn" title={`Série final no ${SIDE_LABEL[item.weakSide!]}: máximo de reps`}>
          Mesma carga, sem parar, até a falha técnica (a última rep com boa forma). Registre quantas saíram.
        </Notice>
      )}
      {side && (
        <div class="side-toggle" role="radiogroup" aria-label="Lado">
          {(['L', 'R'] as Side[]).map((sd) => (
            <button key={sd} role="radio" aria-checked={side === sd} class={side === sd ? 'on' : ''} onClick={() => setSideOverride(sd)}>
              {sd === 'L' ? 'Esquerdo' : 'Direito'}
              {item.weakSide === sd && <small> · mais fraco</small>}
            </button>
          ))}
        </div>
      )}
      <div class="log-row">
        <Stepper label={ex.loadMode === 'assisted' ? 'ajuda kg' : ex.loadUnit} value={load} step={ex.increment || 1} onChange={setLoad} />
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
  const totals = sessionTotals(session, latestWeight(app.value.assessments));
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
