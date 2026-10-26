import { useEffect } from 'preact/hooks';

let audio: AudioContext | null = null;

/** Precisa rodar dentro de um gesto do usuário (iOS/Chrome bloqueiam áudio automático). */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    /* sem áudio: segue só com vibração */
  }
}

function tone(freq: number, delay: number, dur: number, vol = 0.25) {
  if (!audio) return;
  const ctx = audio;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Bipe curto da contagem 3-2-1. */
export function countdownTick() {
  tone(660, 0, 0.12, 0.18);
  navigator.vibrate?.(60);
}

export function restFinishedFeedback() {
  navigator.vibrate?.([250, 120, 250, 120, 400]);
  tone(880, 0, 0.18);
  tone(880, 0.22, 0.18);
  tone(1320, 0.44, 0.45, 0.3);
}

/** Mantém a tela acesa durante o treino e readquire ao voltar para o app. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        /* bateria fraca ou permissão negada */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
