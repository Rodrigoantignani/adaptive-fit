import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { learnRest } from '../data/actions';
import { app } from '../data/store';
import { setCount } from '../domain/planner';
import { countdownTick, restFinishedFeedback, unlockAudio } from '../lib/device';
import { fmtDuration } from '../lib/format';

interface Rest {
  endAt: number;
  total: number;
  label: string;
  /** Exercício de origem: se o usuário ajustar o tempo, o app aprende. */
  exerciseId?: string;
  planned?: number;
}

/** Baseado em timestamp: não atrasa com a tela bloqueada nem com o app em segundo plano. */
export const rest = signal<Rest | null>(null);
const sheetOpen = signal(false);
const learnedMsg = signal<string | null>(null);

export function startRest(sec: number, label = 'Descanso', exerciseId?: string) {
  unlockAudio();
  sheetOpen.value = false;
  rest.value = { endAt: Date.now() + sec * 1000, total: sec, label, exerciseId, planned: sec };
}

export function adjustRest(deltaSec: number) {
  const r = rest.value;
  if (r) rest.value = { ...r, endAt: r.endAt + deltaSec * 1000, total: Math.max(5, r.total + deltaSec) };
}

/** Fecha o timer; se o descanso de um exercício foi ajustado, guarda o novo valor. */
export function stopRest() {
  const r = rest.value;
  if (r?.exerciseId && r.planned !== undefined && r.total !== r.planned) {
    learnRest(r.exerciseId, r.total);
    learnedMsg.value = `Descanso de ${r.total} s salvo para ${r.label.replace('Descanso · ', '')}`;
    setTimeout(() => (learnedMsg.value = null), 3500);
  }
  rest.value = null;
}

function useSessionCounter() {
  const s = app.value.sessions.find((x) => !x.endedAt);
  if (!s) return null;
  return { done: s.entries.reduce((a, e) => a + e.sets.length, 0), total: s.plan.reduce((a, p) => a + setCount(p), 0) };
}

export function RestTimer() {
  const r = rest.value;
  const [now, setNow] = useState(Date.now());
  const counter = useSessionCounter();

  useEffect(() => {
    if (!r) return;
    let fired = false;
    let lastTick = -1;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const secLeft = Math.ceil((r.endAt - t) / 1000);
      if (secLeft >= 1 && secLeft <= 3 && secLeft !== lastTick) {
        lastTick = secLeft;
        countdownTick();
      }
      if (!fired && t >= r.endAt) {
        fired = true;
        restFinishedFeedback();
      }
      if (t >= r.endAt + 8000) stopRest();
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [r?.endAt]);

  if (!r) {
    return (
      <>
        {learnedMsg.value && <div class="toast">{learnedMsg.value}</div>}
        {sheetOpen.value ? (
          <TimerSheet counter={counter} />
        ) : (
          <button
            class="timer-fab"
            aria-label="Abrir cronômetro de descanso"
            onClick={() => {
              unlockAudio();
              sheetOpen.value = true;
            }}
          >
            ⏱
          </button>
        )}
      </>
    );
  }

  const left = r.endAt - now;
  const done = left <= 0;
  const pct = done ? 100 : Math.min(100, ((r.total * 1000 - left) / (r.total * 1000)) * 100);
  const adjusted = r.exerciseId && r.planned !== undefined && r.total !== r.planned;

  return (
    <div class={`rest-timer ${done ? 'done' : ''} ${!done && left < 3500 ? 'final' : ''}`} role="timer" aria-live="polite">
      <div class="rest-progress" style={{ width: `${pct}%` }} />
      <div class="rest-body">
        <div class="grow">
          <div class="rest-label">{done ? 'Próxima série!' : r.label}</div>
          <div class="rest-clock">{done ? 'BORA' : fmtDuration(Math.ceil(left / 1000) * 1000)}</div>
          <div class="rest-meta">
            {counter && (
              <span>
                Séries {counter.done}/{counter.total}
              </span>
            )}
            {adjusted && <span class="learn">vou lembrar {r.total} s</span>}
          </div>
        </div>
        <div class="rest-actions">
          {!done && (
            <>
              <button onClick={() => adjustRest(-15)}>−15</button>
              <button onClick={() => adjustRest(15)}>+15</button>
            </>
          )}
          <button onClick={stopRest}>{done ? 'OK' : 'Pular'}</button>
        </div>
      </div>
    </div>
  );
}

const PRESETS = [30, 45, 60, 90, 120, 180];

function TimerSheet({ counter }: { counter: { done: number; total: number } | null }) {
  const [custom, setCustom] = useState(75);
  return (
    <div class="timer-sheet" role="dialog" aria-label="Cronômetro de descanso">
      <div class="timer-sheet-head">
        <strong>Cronômetro de descanso</strong>
        {counter && (
          <span class="muted small">
            Séries {counter.done}/{counter.total}
          </span>
        )}
        <button class="link" onClick={() => (sheetOpen.value = false)}>
          fechar
        </button>
      </div>
      <div class="timer-presets">
        {PRESETS.map((s) => (
          <button key={s} onClick={() => startRest(s)}>
            {s < 60 ? `${s}s` : s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60} min`}
          </button>
        ))}
      </div>
      <div class="timer-custom">
        <button onClick={() => setCustom((c) => Math.max(5, c - 5))}>−5</button>
        <strong>{fmtDuration(custom * 1000)}</strong>
        <button onClick={() => setCustom((c) => c + 5)}>+5</button>
        <button class="btn" onClick={() => startRest(custom)}>
          Iniciar
        </button>
      </div>
      <p class="muted small">Bipes nos 3 últimos segundos, som e vibração no fim. Ao registrar uma série, o descanso começa sozinho.</p>
    </div>
  );
}
