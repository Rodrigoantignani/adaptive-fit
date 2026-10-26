import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { restFinishedFeedback, unlockAudio } from '../lib/device';
import { fmtDuration } from '../lib/format';

interface Rest {
  endAt: number;
  total: number;
  label: string;
}

/** Baseado em timestamp: não atrasa com a tela bloqueada nem com o app em segundo plano. */
export const rest = signal<Rest | null>(null);

export function startRest(sec: number, label = 'Descanso') {
  unlockAudio();
  rest.value = { endAt: Date.now() + sec * 1000, total: sec, label };
}

export function adjustRest(deltaSec: number) {
  const r = rest.value;
  if (r) rest.value = { ...r, endAt: r.endAt + deltaSec * 1000, total: Math.max(1, r.total + deltaSec) };
}

export const stopRest = () => (rest.value = null);

export function RestTimer() {
  const r = rest.value;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!r) return;
    let fired = false;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (!fired && t >= r.endAt) {
        fired = true;
        restFinishedFeedback();
      }
      if (t >= r.endAt + 8000) stopRest();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [r?.endAt]);

  if (!r) return null;
  const left = r.endAt - now;
  const done = left <= 0;
  const pct = done ? 100 : Math.min(100, ((r.total * 1000 - left) / (r.total * 1000)) * 100);

  return (
    <div class={`rest-timer ${done ? 'done' : ''}`} role="timer" aria-live="polite">
      <div class="rest-progress" style={{ width: `${pct}%` }} />
      <div class="rest-body">
        <div>
          <div class="rest-label">{done ? 'Próxima série!' : r.label}</div>
          <div class="rest-clock">{done ? 'BORA' : fmtDuration(left + 999)}</div>
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

export function RestPresets() {
  return (
    <div class="rest-presets">
      <span>Descanso</span>
      {[60, 90, 120, 180].map((s) => (
        <button key={s} onClick={() => startRest(s)}>
          {s < 120 ? `${s}s` : `${s / 60}min`}
        </button>
      ))}
    </div>
  );
}
