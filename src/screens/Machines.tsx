import { useMemo, useState } from 'preact/hooks';
import { removeCustomExercise, saveExercise, saveSettings, setExerciseHidden, setRefLoad } from '../data/actions';import { app } from '../data/store';
import { DEFAULT_EXERCISES, isDefaultExercise, newExercise } from '../domain/exercises';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, SPLIT_LABEL, SPLIT_ORDER } from '../domain/labels';
import type { Equipment, Exercise, Muscle, SplitId } from '../domain/types';
import { uid } from '../lib/id';
import { compressImage } from '../lib/image';
import { Card, Choice, Chips, Notice, NumField, Toggle } from '../ui/kit';

type Filter = SplitId | 'all' | 'mine' | 'hidden';

/** Padrões (com edições) + criados, incluindo ocultos, para gerenciar. */
function useCatalog() {
  const { customExercises } = app.value;
  return useMemo(() => {
    const overrides = new Map(customExercises.map((e) => [e.id, e]));
    return [...DEFAULT_EXERCISES.map((e) => overrides.get(e.id) ?? e), ...customExercises.filter((e) => !isDefaultExercise(e.id))];
  }, [customExercises]);
}

export function Machines() {
  const { settings, customExercises } = app.value;
  const catalog = useCatalog();
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const hidden = new Set(settings.hiddenExercises);
  const edited = new Set(customExercises.map((e) => e.id));

  if (editing) return <ExerciseEditor initial={editing} onClose={() => setEditing(null)} />;

  const list = catalog.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'hidden') return hidden.has(e.id);
    if (hidden.has(e.id)) return false;
    if (filter === 'mine') return !isDefaultExercise(e.id);
    if (filter === 'all') return true;
    return e.splits.includes(filter);
  });

  return (
    <>
      <Card title="Academia">
        <label class="field">
          <span>Onde você treina</span>
          <input value={settings.gymName} placeholder="Ex.: Green Theory" onInput={(e) => saveSettings({ gymName: e.currentTarget.value })} />
        </label>
        <button class="btn" onClick={() => setEditing(newExercise({ id: uid(), name: '', muscle: 'chest', custom: true, splits: ['full_body'] }))}>
          + Cadastrar máquina nova
        </button>
        <p class="muted small">Achou uma máquina que não conhece? Tire uma foto, dê um nome e diga em quais dias ela entra. O planejador passa a usá-la.</p>
      </Card>

      <div class="filter-bar">
        <input class="search" placeholder="Buscar exercício" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <div class="chips">
          {(
            [
              ['all', 'Todos'],
              ['full_body', 'Full body'],
              ['upper', 'Superior'],
              ['lower', 'Inferior'],
              ['mine', 'Minhas'],
              ['hidden', 'Ocultos'],
            ] as [Filter, string][]
          ).map(([v, l]) => (
            <button key={v} class={`chip accent ${filter === v ? 'on' : ''}`} aria-pressed={filter === v} onClick={() => setFilter(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <ul class="machine-list">
        {list.map((e) => (
          <li key={e.id}>
            <button class="machine" onClick={() => setEditing(e)}>
              {e.photo ? <img class="thumb lg" src={e.photo} alt="" /> : <span class="thumb lg placeholder">{e.name.slice(0, 1)}</span>}
              <span class="grow">
                <strong>{e.name}</strong>
                <small>
                  {MUSCLE_LABEL[e.muscle]} · {EQUIPMENT_LABEL[e.equipment]}
                  {e.unilateral && ' · unilateral'}
                </small>
                <small>{e.splits.length ? e.splits.map((s) => SPLIT_LABEL[s]).join(', ') : 'Só como substituto'}</small>
              </span>
              {!isDefaultExercise(e.id) ? <i class="badge">minha</i> : edited.has(e.id) ? <i class="badge">editado</i> : null}
            </button>
          </li>
        ))}
        {list.length === 0 && <p class="empty">Nada por aqui.</p>}
      </ul>
    </>
  );
}

function ExerciseEditor({ initial, onClose }: { initial: Exercise; onClose: () => void }) {
  const { settings, customExercises } = app.value;
  const catalog = useCatalog();
  const [e, setE] = useState<Exercise>(initial);
  const [refLoad, setRef] = useState<number | undefined>(settings.refLoads[initial.id]);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Exercise>(k: K, v: Exercise[K]) => setE((x) => ({ ...x, [k]: v }));
  const isDefault = isDefaultExercise(e.id);
  const isEdited = customExercises.some((x) => x.id === e.id);
  const isHidden = settings.hiddenExercises.includes(e.id);
  const valid = e.name.trim().length > 1 && e.repMin > 0 && e.repMax >= e.repMin && e.sets > 0;

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      set('photo', await compressImage(file));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    saveExercise({ ...e, name: e.name.trim(), custom: !isDefault });
    setRefLoad(e.id, refLoad);
    onClose();
  };

  return (
    <>
      <button class="link back" onClick={onClose}>
        ← Voltar para máquinas
      </button>
      <Card title={isDefault ? 'Editar exercício' : initial.name ? 'Editar máquina' : 'Nova máquina'}>
        <div class="photo-field">
          {e.photo ? <img src={e.photo} alt="Foto da máquina" /> : <div class="photo-empty">Sem foto</div>}
          <div class="photo-actions">
            <label class="btn btn-ghost file-btn">
              {busy ? 'Processando…' : e.photo ? 'Trocar foto' : 'Tirar / escolher foto'}
              <input type="file" accept="image/*" capture="environment" onChange={(ev) => void onPhoto(ev.currentTarget.files?.[0])} />
            </label>
            {e.photo && (
              <button class="link danger" onClick={() => set('photo', undefined)}>
                remover foto
              </button>
            )}
          </div>
        </div>
        <label class="field">
          <span>Nome</span>
          <input value={e.name} placeholder="Ex.: Remada articulada Hammer" onInput={(ev) => set('name', ev.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Músculo principal</span>
          <select value={e.muscle} onChange={(ev) => set('muscle', ev.currentTarget.value as Muscle)}>
            {(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <Chips<SplitId>
          label="Entra em quais treinos"
          accent
          values={e.splits}
          onChange={(v) => set('splits', v)}
          options={SPLIT_ORDER.map((s) => ({ value: s, label: SPLIT_LABEL[s] }))}
        />
        {e.splits.length === 0 && <p class="muted small">Sem treino marcado, ele só aparece como substituto de outro exercício do mesmo músculo.</p>}
        <Choice<'1' | '2' | '3'>
          label="Prioridade"
          cols={3}
          value={String(e.priority) as '1' | '2' | '3'}
          onChange={(v) => set('priority', Number(v) as 1 | 2 | 3)}
          options={[
            { value: '1', label: 'Base', hint: 'Sai por último' },
            { value: '2', label: 'Média' },
            { value: '3', label: 'Acessório', hint: 'Primeiro a cortar' },
          ]}
        />
        <Choice<Equipment>
          label="Tipo"
          value={e.equipment}
          onChange={(v) => set('equipment', v)}
          options={(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => ({ value: k, label: EQUIPMENT_LABEL[k] }))}
        />
        <Choice<Exercise['loadUnit']>
          label="Como a carga é marcada"
          value={e.loadUnit}
          onChange={(v) => set('loadUnit', v)}
          options={[
            { value: 'kg', label: 'kg total' },
            { value: 'kg/lado', label: 'kg por lado', hint: 'Anilhas dos dois lados' },
          ]}
        />
        <Toggle label="Unilateral" hint="Um lado por vez: o app registra E/D e começa pelo lado mais fraco." checked={e.unilateral} onChange={(v) => set('unilateral', v)} />
        <div class="grid-3">
          <NumField label="Séries" value={e.sets} onChange={(v) => set('sets', Math.round(v ?? 0))} />
          <NumField label="Reps mín." value={e.repMin} onChange={(v) => set('repMin', Math.round(v ?? 0))} />
          <NumField label="Reps máx." value={e.repMax} onChange={(v) => set('repMax', Math.round(v ?? 0))} />
          <NumField label="Descanso" suffix="s" value={e.restSec} onChange={(v) => set('restSec', Math.round(v ?? 0))} />
          <NumField label="Degrau" suffix="kg" value={e.increment} onChange={(v) => set('increment', v ?? 0)} />
          <NumField label="Carga inicial" suffix="kg" value={refLoad} onChange={setRef} />
        </div>
        <Toggle label="Carga sobre a coluna" hint="Barra nas costas, carga axial: sai em dias de proteção lombar." checked={e.axialLoad} onChange={(v) => set('axialLoad', v)} />
        <Toggle
          label="Exige muito do core"
          hint="Sai quando o abdômen ou a lombar estão doloridos."
          checked={e.coreDemand === 'high'}
          onChange={(v) => set('coreDemand', v ? 'high' : 'low')}
        />
        <label class="field">
          <span>Antagonista (para super-série)</span>
          <select value={e.antagonist ?? ''} onChange={(ev) => set('antagonist', ev.currentTarget.value || undefined)}>
            <option value="">Nenhum</option>
            {catalog
              .filter((x) => x.id !== e.id)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </label>
        <label class="field">
          <span>Dica de execução / ajuste da máquina</span>
          <input value={e.cue ?? ''} placeholder="Ex.: banco na posição 4, pegada neutra" onInput={(ev) => set('cue', ev.currentTarget.value || undefined)} />
        </label>
        {!valid && <Notice tone="warn">Dê um nome e confira séries e faixa de reps (mín. ≤ máx.).</Notice>}
        <button class="btn" disabled={!valid} onClick={save}>
          Salvar
        </button>
        <div class="grid-2">
          {isDefault ? (
            <>
              <button
                class="btn btn-ghost"
                onClick={() => {
                  setExerciseHidden(e.id, !isHidden);
                  onClose();
                }}
              >
                {isHidden ? 'Mostrar na biblioteca' : 'Ocultar (não tenho)'}
              </button>
              <button
                class="btn btn-ghost"
                disabled={!isEdited}
                onClick={() => {
                  removeCustomExercise(e.id);
                  onClose();
                }}
              >
                Restaurar padrão
              </button>
            </>
          ) : (
            initial.name &&
            customExercises.some((x) => x.id === e.id) && (
              // Só oculta: o histórico continua resolvendo o nome da máquina.
              <button
                class="btn btn-ghost danger"
                onClick={() => {
                  setExerciseHidden(e.id, !isHidden);
                  onClose();
                }}
              >
                {isHidden ? 'Voltar para a biblioteca' : 'Tirar da biblioteca'}
              </button>
            )
          )}
        </div>
      </Card>
    </>
  );
}
