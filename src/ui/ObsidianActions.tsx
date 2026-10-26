import { useState } from 'preact/hooks';
import { app } from '../data/store';
import { buildDailyNote, notePath, obsidianNewUri } from '../domain/obsidian';
import { assessReadiness } from '../domain/readiness';
import { latestWeight } from '../domain/routine';
import { copyText, downloadText } from '../lib/device';

/** Monta a nota do dia a partir do que existir: check-in, treino e/ou avaliação. */
export function noteForDate(date: string): string {
  const s = app.value;
  const checkIn = s.checkIns.find((c) => c.date === date) ?? null;
  return buildDailyNote({
    date,
    checkIn,
    readiness: checkIn ? assessReadiness(checkIn, s.profile) : null,
    session: s.sessions.findLast((x) => x.date === date && x.endedAt) ?? null,
    assessment: s.assessments.find((a) => a.date === date) ?? null,
    bodyweightKg: latestWeight(s.assessments),
  });
}

export function ObsidianActions({ date }: { date: string }) {
  const { obsidianVault, obsidianFolder } = app.value.settings;
  const [msg, setMsg] = useState('');
  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div class="obsidian-actions">
      {obsidianVault ? (
        <a class="btn" href={obsidianNewUri(obsidianVault, notePath(obsidianFolder, date), noteForDate(date))}>
          Enviar ao Obsidian
        </a>
      ) : (
        <p class="muted small">Configure o nome do seu vault em Ajustes para enviar ao Obsidian com um toque.</p>
      )}
      <div class="grid-2">
        <button class="btn btn-ghost" onClick={async () => flash((await copyText(noteForDate(date))) ? 'Nota copiada' : 'Não consegui copiar')}>
          Copiar Markdown
        </button>
        <button class="btn btn-ghost" onClick={() => downloadText(`${date} Adaptive Fit.md`, noteForDate(date), 'text/markdown')}>
          Baixar .md
        </button>
      </div>
      {msg && <p class="flash">{msg}</p>}
    </div>
  );
}
