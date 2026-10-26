import { useState } from 'preact/hooks';
import { saveProfile, saveSettings, setShiftDate, setWeekDay } from '../data/actions';
import { emptyState, mergeAssessments, mergeSeed, parseBackup } from '../data/schema';
import { app, commit, hasSnapshot, mutate, restoreSnapshot, takeSnapshot } from '../data/store';
import { DAY_LOAD_LABEL, SPLIT_LABEL, SPLIT_ORDER, WEEKDAY_LABEL } from '../domain/labels';
import { dataviewSnippet } from '../domain/obsidian';
import { dayLoadFromWork, hoursBetween } from '../domain/energy';
import { workFor } from '../domain/routine';
import type { Profile, Sex, Side, SplitId, WeekDay, WorkDay } from '../domain/types';
import { TechniqueGlossary } from '../ui/TechniqueSheet';
import { formatBR, localISODate, parseISO } from '../lib/date';
import { copyText, downloadText } from '../lib/device';
import { fmtNum } from '../lib/format';
import { Card, Choice, Notice, NumField, Toggle } from '../ui/kit';

export function ProfileForm() {
  const current = app.value.profile;
  const [f, setF] = useState<Profile>(current ?? { name: '', sex: 'M', birthDate: '', spineCare: false });
  const [ok, setOk] = useState(false);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setOk(false);
    setF((p) => ({ ...p, [k]: v }));
  };
  return (
    <Card title="Perfil">
      <label class="field">
        <span>Nome</span>
        <input value={f.name} onInput={(e) => set('name', e.currentTarget.value)} placeholder="Como quer ser chamado" />
      </label>
      <Choice<Sex>
        label="Sexo biológico (usado nas fórmulas)"
        value={f.sex}
        onChange={(v) => set('sex', v)}
        options={[
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Feminino' },
        ]}
      />
      <div class="grid-2">
        <label class="field">
          <span>Nascimento</span>
          <input type="date" value={f.birthDate} max={localISODate()} onInput={(e) => set('birthDate', e.currentTarget.value)} />
        </label>
        <NumField label="Altura" suffix="cm" value={f.heightCm} onChange={(v) => set('heightCm', v)} />
      </div>
      <Toggle
        label="Cuidado permanente com a coluna"
        hint="Escoliose, hérnia, lombalgia crônica: nunca prescreve carga axial."
        checked={f.spineCare}
        onChange={(v) => set('spineCare', v)}
      />
      <Toggle
        label="Escoliose"
        hint="Adiciona um aquecimento corretivo de ~5 min a todo treino."
        checked={!!f.scoliosis}
        onChange={(v) => set('scoliosis', v ? { shortSide: f.scoliosis?.shortSide ?? 'L' } : null)}
      />
      {f.scoliosis && (
        <Choice<Side>
          label="Lado do tronco encurtado"
          value={f.scoliosis.shortSide}
          onChange={(v) => set('scoliosis', { shortSide: v })}
          options={[
            { value: 'L', label: 'Esquerdo' },
            { value: 'R', label: 'Direito' },
          ]}
        />
      )}
      <Toggle
        label="Haglund / tendinite de Aquiles"
        hint="Tira panturrilha no degrau, pergunta a dor no check-in e ajusta o treino de pernas."
        checked={!!f.achilles}
        onChange={(v) => set('achilles', v ? { side: f.achilles?.side ?? 'L' } : null)}
      />
      {f.achilles && (
        <Choice<Side>
          label="Qual pé"
          value={f.achilles.side}
          onChange={(v) => set('achilles', { side: v })}
          options={[
            { value: 'L', label: 'Esquerdo' },
            { value: 'R', label: 'Direito' },
          ]}
        />
      )}
      <button
        class="btn"
        disabled={!f.birthDate}
        onClick={() => {
          saveProfile(f);
          setOk(true);
        }}
      >
        Salvar perfil
      </button>
      {ok && <p class="flash">Perfil salvo</p>}
    </Card>
  );
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Trabalho sob chamada: marca os turnos das próximas 2 semanas.
 * A data marcada vale mais que o padrão da rotina semanal.
 */
function ShiftCalendar() {
  const { week, shiftDates } = app.value.settings;
  const today = localISODate();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = parseISO(today);
    d.setDate(d.getDate() + i);
    return localISODate(d);
  });
  // Horário sugerido ao marcar: o do padrão do dia ou o último turno avulso usado.
  const lastShift = Object.entries(shiftDates)
    .filter(([, v]) => v)
    .sort(([a], [b]) => a.localeCompare(b))
    .at(-1)?.[1] ?? { start: '19:30', end: '22:30' };
  return (
    <Card title="Turnos em pé (próximos 14 dias)">
      <p class="muted small">
        Trabalho sob chamada: marque os dias de turno. Eles mudam a demanda do check-in, o gasto e a comida do dia e o sono esperado da manhã seguinte. Dias
        com turno fixo vêm da rotina semanal.
      </p>
      <div class="shift-list">
        {days.map((date) => {
          const base = week[String(parseISO(date).getDay())]?.work;
          const baseHas = (base?.standingH ?? 0) > 0;
          const work = workFor(date, week, shiftDates);
          const on = (work?.standingH ?? 0) > 0;
          const fromRoutine = on && !(date in shiftDates);
          const toggle = () => {
            if (on) setShiftDate(date, baseHas ? null : undefined);
            else if (baseHas && date in shiftDates) setShiftDate(date, undefined);
            else setShiftDate(date, { start: base?.standingStart ?? lastShift.start, end: base?.standingEnd ?? lastShift.end });
          };
          const setTime = (k: 'start' | 'end', v: string) => {
            if (!work?.standingStart || !work.standingEnd || !v) return;
            setShiftDate(date, { start: work.standingStart, end: work.standingEnd, [k]: v });
          };
          return (
            <div key={date} class={`shift-row ${on ? 'on' : ''}`}>
              <label class="shift-day">
                <input type="checkbox" checked={on} onChange={toggle} />
                <span>
                  {WEEKDAY_LABEL[parseISO(date).getDay()].slice(0, 3)} {formatBR(date).slice(0, 5)}
                  {date === today && <i> hoje</i>}
                </span>
              </label>
              {on ? (
                <>
                  <input type="time" aria-label="Início do turno" value={work!.standingStart ?? ''} onInput={(e) => setTime('start', e.currentTarget.value)} />
                  <input type="time" aria-label="Fim do turno" value={work!.standingEnd ?? ''} onInput={(e) => setTime('end', e.currentTarget.value)} />
                  <small class="muted">{fromRoutine ? 'rotina' : `${fmtNum(work!.standingH)} h`}</small>
                </>
              ) : (
                <small class="muted span-3">{baseHas ? 'sem turno (cancelado)' : 'sem turno'}</small>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Rotina semanal: preenche o check-in de cada dia (split, tempo e demanda). */
function WeekCard() {
  const week = app.value.settings.week;
  const update = (dow: number, patch: Partial<WeekDay>) => {
    const cur = week[dow] ?? { split: 'full_body', timeAvailMin: 60, dayLoad: 'light' };
    setWeekDay(dow, { ...cur, ...patch });
  };
  const rotation = app.value.settings.rotation;
  const ROTATIONS: { value: string; label: string; hint: string; splits: SplitId[] }[] = [
    { value: 'upper,lower', label: 'Sup ↔ Inf', hint: 'Alterna todo dia', splits: ['upper', 'lower'] },
    { value: 'full_body', label: 'Full body', hint: 'Sempre corpo todo', splits: ['full_body'] },
    { value: 'full_body,upper,lower', label: 'Full → Sup → Inf', hint: 'Ciclo de 3', splits: ['full_body', 'upper', 'lower'] },
  ];
  return (
    <Card title="Rotina semanal">
      <Choice<string>
        label="Alternância (quando o dia está como Livre)"
        cols={3}
        value={rotation.join(',')}
        onChange={(v) => saveSettings({ rotation: ROTATIONS.find((r) => r.value === v)!.splits })}
        options={ROTATIONS.map(({ value, label, hint }) => ({ value, label, hint }))}
      />
      <p class="muted small">
        Por dia: treino, tempo e agenda de trabalho. A agenda define a demanda física do check-in e o gasto calórico da aba Dieta. "Livre" segue a alternância a
        partir do último treino feito.
      </p>
      <div class="week">
        {WEEK_ORDER.map((dow) => {
          const d = week[dow];
          const work = d?.work ?? { sittingH: 0, standingH: 0 };
          const setWork = (patch: Partial<WorkDay>) => {
            const next = { ...work, ...patch };
            if (next.standingStart && next.standingEnd) next.standingH = hoursBetween(next.standingStart, next.standingEnd);
            if (!next.standingStart || !next.standingEnd) next.standingH = 0;
            update(dow, { work: next, dayLoad: dayLoadFromWork(next) });
          };
          const load = d?.work ? dayLoadFromWork(d.work) : d?.dayLoad;
          return (
            <div key={dow} class="week-day">
              <div class="week-row">
                <strong>{WEEKDAY_LABEL[dow].slice(0, 3)}</strong>
                <select
                  aria-label={`Treino de ${WEEKDAY_LABEL[dow]}`}
                  value={d?.split ?? ''}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (!v) setWeekDay(dow, null);
                    else update(dow, { split: v as WeekDay['split'] });
                  }}
                >
                  <option value="">Sem padrão</option>
                  <option value="auto">Livre (alterna)</option>
                  <option value="rest">Descanso</option>
                  {SPLIT_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {SPLIT_LABEL[s]}
                    </option>
                  ))}
                </select>
                {d && d.split !== 'rest' ? (
                  <NumField label="" suffix="min" value={d.timeAvailMin} onChange={(v) => update(dow, { timeAvailMin: v ?? 0 })} />
                ) : (
                  <span class="muted small">{d ? 'sem treino' : ''}</span>
                )}
                <span class="muted small">{load ? DAY_LOAD_LABEL[load].label : ''}</span>
              </div>
              {d && (
                <div class="work-row">
                  <NumField label="Sentado" suffix="h" value={work.sittingH || undefined} onChange={(v) => setWork({ sittingH: v ?? 0 })} />
                  <label class="field">
                    <span>Em pé de</span>
                    <input type="time" value={work.standingStart ?? ''} onInput={(e) => setWork({ standingStart: e.currentTarget.value || undefined })} />
                  </label>
                  <label class="field">
                    <span>até</span>
                    <input type="time" value={work.standingEnd ?? ''} onInput={(e) => setWork({ standingEnd: e.currentTarget.value || undefined })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function Settings() {
  const { settings } = app.value;
  const [msg, setMsg] = useState('');
  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 3000);
  };

  const importFile = async (file: File) => {
    try {
      const parsed = parseBackup(await file.text());
      if (parsed.kind === 'legacy') {
        const before = app.value.assessments.length;
        mutate((s) => ({ ...s, assessments: mergeAssessments(s.assessments, parsed.assessments) }));
        const added = app.value.assessments.length - before;
        flash(added ? `${added} avaliação(ões) do protótipo importadas` : 'Essas avaliações já estavam aqui');
        return;
      }
      await takeSnapshot();
      // Sem treinos = arquivo de dados iniciais (ex.: dados-pessoais.json): mescla sem apagar nada.
      if (parsed.state.sessions.length === 0) {
        commit(mergeSeed(app.value, parsed.state));
        flash('Dados mesclados (nada foi apagado)');
        return;
      }
      if (!confirm('Substituir TODOS os dados atuais pelo backup? Dá para desfazer logo em seguida.')) return;
      commit({ ...parsed.state, profile: parsed.state.profile ?? app.value.profile });
      flash('Backup restaurado');
    } catch (e) {
      flash(`Arquivo inválido: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <ProfileForm />

      <Card title="Obsidian">
        <p class="muted small">Com o nome do vault, o botão "Enviar ao Obsidian" cria a nota do dia direto no app (desktop ou celular), sem copiar e colar.</p>
        <div class="grid-2">
          <label class="field">
            <span>Nome do vault</span>
            <input value={settings.obsidianVault} placeholder="Ex.: Segundo Cérebro" onInput={(e) => saveSettings({ obsidianVault: e.currentTarget.value })} />
          </label>
          <label class="field">
            <span>Pasta</span>
            <input value={settings.obsidianFolder} placeholder="Treino" onInput={(e) => saveSettings({ obsidianFolder: e.currentTarget.value })} />
          </label>
        </div>
        <details>
          <summary>Painel Dataview para o seu vault</summary>
          <pre class="code">{dataviewSnippet(settings.obsidianFolder)}</pre>
          <button class="btn btn-ghost" onClick={async () => flash((await copyText(dataviewSnippet(settings.obsidianFolder))) ? 'Consulta copiada' : 'Não consegui copiar')}>
            Copiar consulta
          </button>
        </details>
      </Card>

      <ShiftCalendar />

      <WeekCard />

      <Card title="Técnicas de treino">
        <p class="muted small">Toque para ver como fazer. O plano sugere algumas sozinho (drop-set, rest-pause, superlento) conforme a prontidão e o tempo.</p>
        <TechniqueGlossary />
      </Card>

      <Card title="Seus dados">
        <Notice tone="info">
          Tudo fica só neste aparelho (IndexedDB). Nada vai para servidor nenhum. Exporte um backup de vez em quando.
        </Notice>
        <div class="grid-2">
          <button class="btn btn-ghost" onClick={() => downloadText(`adaptive-fit-backup-${localISODate()}.json`, JSON.stringify(app.value, null, 2))}>
            Exportar backup
          </button>
          <label class="btn btn-ghost file-btn">
            Importar arquivo
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) void importFile(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        <p class="muted small">Também aceita o backup do protótipo antigo (adaptive_fit_backup.json).</p>
        <div class="grid-2">
          <button
            class="btn btn-ghost"
            disabled={!hasSnapshot.value}
            onClick={async () => flash((await restoreSnapshot()) ? 'Estado anterior restaurado' : 'Nada para desfazer')}
          >
            Desfazer última troca
          </button>
          <button
            class="btn btn-ghost danger"
            onClick={async () => {
              if (!confirm('Apagar todos os treinos, check-ins e avaliações? O perfil e os ajustes ficam.')) return;
              await takeSnapshot();
              const s = app.value;
              commit({ ...emptyState(), profile: s.profile, settings: s.settings });
              flash('Dados apagados (dá para desfazer)');
            }}
          >
            Apagar histórico
          </button>
        </div>
      </Card>

      <Card title="Sobre">
        <p class="small">
          Adaptive Fit v{__APP_VERSION__}. As recomendações seguem regras de autorregulação e dupla progressão e não substituem orientação médica ou de um
          profissional de educação física.
        </p>
      </Card>
      {msg && <div class="toast">{msg}</div>}
    </>
  );
}
