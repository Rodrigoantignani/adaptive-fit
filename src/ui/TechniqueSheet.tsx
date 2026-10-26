import { signal } from '@preact/signals';
import { techniqueById, TECHNIQUES, type Technique } from '../domain/techniques';

/** Técnica aberta na ficha explicativa (qualquer tela pode abrir). */
export const openTechnique = signal<string | null>(null);

export function TechniqueTag({ id, prefix = '' }: { id: string; prefix?: string }) {
  const t = techniqueById(id);
  if (!t) return null;
  return (
    <button class="tag technique" onClick={() => (openTechnique.value = id)} aria-label={`O que é ${t.name}`}>
      {prefix}
      {t.name} <span aria-hidden="true">ⓘ</span>
    </button>
  );
}

function TechniqueBody({ t }: { t: Technique }) {
  return (
    <>
      <p>{t.summary}</p>
      <strong class="small">Como fazer</strong>
      <ol>
        {t.how.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ol>
      <p class="small">
        <b>Quando usar:</b> {t.when}
      </p>
      <p class="small warn-text">
        <b>Cuidado:</b> {t.caution}
      </p>
    </>
  );
}

export function TechniqueSheet() {
  const t = openTechnique.value ? techniqueById(openTechnique.value) : undefined;
  if (!t) return null;
  return (
    <div class="sheet-backdrop" onClick={() => (openTechnique.value = null)}>
      <div class="sheet" role="dialog" aria-label={t.name} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <div>
            <small class="muted">{t.group}</small>
            <h2>{t.name}</h2>
          </div>
          <button class="link" onClick={() => (openTechnique.value = null)}>
            fechar
          </button>
        </div>
        <TechniqueBody t={t} />
      </div>
    </div>
  );
}

/** Glossário completo, agrupado. */
export function TechniqueGlossary() {
  const groups = [...new Set(TECHNIQUES.map((t) => t.group))];
  return (
    <div class="glossary">
      {groups.map((g) => (
        <div key={g}>
          <small class="muted">{g}</small>
          <div class="tags">
            {TECHNIQUES.filter((t) => t.group === g).map((t) => (
              <TechniqueTag key={t.id} id={t.id} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
