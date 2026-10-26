import { useState } from 'preact/hooks';
import { saveProfile, saveSettings, setRefLoad } from '../data/actions';
import { emptyState, mergeAssessments, parseBackup } from '../data/schema';
import { app, commit, hasSnapshot, mutate, restoreSnapshot, takeSnapshot } from '../data/store';
import { EXERCISES } from '../domain/exercises';
import { dataviewSnippet } from '../domain/obsidian';
import type { Profile, Sex } from '../domain/types';
import { localISODate } from '../lib/date';
import { copyText, downloadText } from '../lib/device';
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
      if (!confirm('Substituir TODOS os dados atuais pelo backup? Dá para desfazer logo em seguida.')) return;
      await takeSnapshot();
      // Arquivo sem perfil (ex.: dados-pessoais.json) não apaga o perfil já preenchido.
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

      <Card title="Cargas de referência">
        <p class="muted small">Ponto de partida de cada exercício. Depois do primeiro treino, a progressão usa o seu histórico.</p>
        <div class="grid-2">
          {EXERCISES.map((ex) => (
            <NumField key={ex.id} label={ex.name} suffix={ex.loadUnit} value={settings.refLoads[ex.id]} onChange={(v) => setRefLoad(ex.id, v)} />
          ))}
        </div>
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
