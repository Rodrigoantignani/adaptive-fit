import { useState } from 'preact/hooks';
import { deleteFunctionalTest, saveFunctionalTest } from '../data/actions';
import { app } from '../data/store';
import { analyzeFunctional, latestFunctional, REASSESS_DAYS, reassessDue } from '../domain/functional';
import type { FunctionalTest, Side } from '../domain/types';
import { formatBR, localISODate } from '../lib/date';
import { fmtNum } from '../lib/format';
import { uid } from '../lib/id';
import { compressImage } from '../lib/image';
import { Card, Choice, Notice, NumField } from '../ui/kit';

type PhotoKey = 'front' | 'back' | 'side';
const PHOTO_LABEL: Record<PhotoKey, string> = { front: 'Frente', back: 'Costas', side: 'Lado' };

const SIDE_OPTIONS = [
  { value: 'none', label: 'Nenhum' },
  { value: 'L', label: 'Esquerdo' },
  { value: 'R', label: 'Direito' },
] as const;

const OVERHEAD_OPTIONS = [
  { value: 'ok', label: 'Encosta' },
  { value: 'limited', label: 'Não encosta' },
] as const;

export function Functional() {
  const { functionalTests, profile } = app.value;
  const today = localISODate();
  const prev = latestFunctional(functionalTests.filter((t) => t.date !== today));
  const savedToday = functionalTests.find((t) => t.date === today);
  const [t, setT] = useState<FunctionalTest>(() => savedToday ?? { id: uid(), date: today });
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof FunctionalTest>(k: K, v: FunctionalTest[K]) => {
    setSaved(false);
    setT((x) => ({ ...x, [k]: v }));
  };
  const due = reassessDue(functionalTests, today);
  const findings = analyzeFunctional(t, profile);
  const hint = (v: number | undefined) => (v === undefined ? undefined : `ant. ${fmtNum(v)}`);

  const onPhoto = async (key: PhotoKey, file?: File) => {
    if (!file) return;
    const data = await compressImage(file, 900, 0.75);
    set('photos', { ...t.photos, [key]: data });
  };

  return (
    <>
      <Notice tone={due.due ? 'warn' : 'good'} title={due.days === null ? 'Primeira avaliação funcional' : due.due ? 'Hora de reavaliar' : 'Avaliação em dia'}>
        {due.days === null
          ? '10 minutos, uma vez a cada 6 semanas. O plano de treino passa a corrigir o que os testes mostrarem.'
          : `Última há ${due.days} dias. Repita a cada ${REASSESS_DAYS} dias, sempre do mesmo jeito.`}
      </Notice>

      <Card title="1. Tornozelo · joelho na parede" aside="cm">
        <p class="muted small">
          De frente para a parede, pé descalço. Leve o joelho até tocar a parede sem tirar o calcanhar do chão e afaste o pé até o limite. Meça do dedão até a
          parede. Abaixo de ~9 cm ou diferença ≥ 2 cm entre os lados chama atenção.
          {profile?.achilles && ' Com Haglund: só até onde não doer.'}
        </p>
        <div class="grid-2">
          <NumField label="Esquerdo" suffix="cm" value={t.dorsiflexionL} placeholder={hint(prev?.dorsiflexionL)} onChange={(v) => set('dorsiflexionL', v)} />
          <NumField label="Direito" suffix="cm" value={t.dorsiflexionR} placeholder={hint(prev?.dorsiflexionR)} onChange={(v) => set('dorsiflexionR', v)} />
        </div>
      </Card>

      <Card title="2. Ombro · braço acima da cabeça">
        <p class="muted small">
          Costas, lombar e cabeça encostadas na parede, joelhos levemente flexionados. Suba um braço estendido, polegar para trás. Ele encosta na parede sem a
          lombar sair?
        </p>
        <Choice<'ok' | 'limited'> label="Esquerdo" value={t.overheadL ?? 'ok'} onChange={(v) => set('overheadL', v)} options={[...OVERHEAD_OPTIONS]} />
        <Choice<'ok' | 'limited'> label="Direito" value={t.overheadR ?? 'ok'} onChange={(v) => set('overheadR', v)} options={[...OVERHEAD_OPTIONS]} />
      </Card>

      <Card title="3. Panturrilha unilateral" aside="reps">
        <p class="muted small">
          Em pé no chão plano (nunca no degrau), apoio leve na parede. Suba na ponta de um pé só, ritmo de 1 s para subir e 1 s para descer, até não conseguir mais
          a altura completa.
        </p>
        {profile?.achilles && (
          <Notice tone="warn">Só faça este teste se a dor do tendão estiver em 3/10 ou menos hoje. Se doer mais, pule.</Notice>
        )}
        <div class="grid-2">
          <NumField label="Esquerdo" suffix="reps" value={t.calfRaiseL} placeholder={hint(prev?.calfRaiseL)} onChange={(v) => set('calfRaiseL', v === undefined ? undefined : Math.round(v))} />
          <NumField label="Direito" suffix="reps" value={t.calfRaiseR} placeholder={hint(prev?.calfRaiseR)} onChange={(v) => set('calfRaiseR', v === undefined ? undefined : Math.round(v))} />
        </div>
      </Card>

      <Card title="4. Coluna · teste de Adams">
        <p class="muted small">
          Em pé, pés juntos, incline o tronco à frente com os braços soltos. Alguém olha de trás: um lado das costas (costelas) fica mais alto?
        </p>
        <Choice<Side | 'none'> label="Lado mais alto" cols={3} value={t.adamsHump ?? 'none'} onChange={(v) => set('adamsHump', v)} options={[...SIDE_OPTIONS]} />
      </Card>

      <Card title="5. Dorsal">
        <p class="muted small">Nas puxadas, de que lado você não sente o dorsal trabalhar (ou ele não "aparece" no espelho)?</p>
        <Choice<Side | 'none'> label="Lado que não ativa" cols={3} value={t.latWeak ?? 'none'} onChange={(v) => set('latWeak', v)} options={[...SIDE_OPTIONS]} />
      </Card>

      <Card title="6. Fotos posturais">
        <p class="muted small">
          Mesmo lugar, mesma luz, celular na altura do umbigo a ~2,5 m, corpo inteiro na foto. A grade ajuda a comparar a altura de ombros e quadril.
        </p>
        <div class="photo-grid-row">
          {(['front', 'back', 'side'] as PhotoKey[]).map((k) => (
            <div key={k} class="posture-photo">
              <span>{PHOTO_LABEL[k]}</span>
              {t.photos?.[k] ? (
                <div class="grid-overlay">
                  <img src={t.photos[k]} alt={`Foto ${PHOTO_LABEL[k]}`} />
                </div>
              ) : prev?.photos?.[k] ? (
                <div class="grid-overlay ghost">
                  <img src={prev.photos[k]} alt={`Anterior ${PHOTO_LABEL[k]}`} />
                </div>
              ) : (
                <div class="photo-empty">sem foto</div>
              )}
              <label class="btn btn-ghost file-btn small-btn">
                {t.photos?.[k] ? 'Trocar' : 'Tirar'}
                <input type="file" accept="image/*" capture="environment" onChange={(e) => void onPhoto(k, e.currentTarget.files?.[0])} />
              </label>
            </div>
          ))}
        </div>
        {prev?.photos && <p class="muted small">Fotos apagadas são da avaliação de {formatBR(prev.date)}, para comparar.</p>}
      </Card>

      <Card title="Achados e conduta">
        {findings.map((f) => (
          <Notice key={f.id} tone={f.tone} title={f.title}>
            {f.detail}
          </Notice>
        ))}
        <label class="field">
          <span>Observações</span>
          <input value={t.notes ?? ''} placeholder="Ex.: dor no ombro esquerdo no teste" onInput={(e) => set('notes', e.currentTarget.value || undefined)} />
        </label>
        <button
          class="btn"
          onClick={() => {
            saveFunctionalTest(t);
            setSaved(true);
          }}
        >
          {savedToday ? 'Atualizar avaliação de hoje' : 'Salvar avaliação funcional'}
        </button>
        {saved && <p class="flash">Salva. O próximo plano de treino já usa estes achados.</p>}
      </Card>

      {functionalTests.length > 0 && (
        <Card title="Histórico">
          <ul class="history">
            {[...functionalTests].reverse().map((x) => (
              <li key={x.id}>
                <div>
                  <strong>{formatBR(x.date)}</strong>
                </div>
                <div class="small">
                  Tornozelo {x.dorsiflexionL ?? '–'}/{x.dorsiflexionR ?? '–'} cm · Panturrilha {x.calfRaiseL ?? '–'}/{x.calfRaiseR ?? '–'} · Dorsal{' '}
                  {x.latWeak && x.latWeak !== 'none' ? (x.latWeak === 'L' ? 'E fraco' : 'D fraco') : 'ok'}
                </div>
                <button class="link danger" onClick={() => confirm(`Apagar a avaliação de ${formatBR(x.date)}?`) && deleteFunctionalTest(x.id)}>
                  apagar
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
