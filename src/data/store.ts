import { effect, signal } from '@preact/signals';
import { del, get, set } from 'idb-keyval';
import { setUserExercises } from '../domain/exercises';
import { emptyState, migrate, SCHEMA_VERSION, type AppState } from './schema';

const KEY = 'adaptive-fit:state';
const SNAPSHOT_KEY = 'adaptive-fit:snapshot';

export const app = signal<AppState>(emptyState());
export const loaded = signal(false);
export const storageError = signal<string | null>(null);
export const hasSnapshot = signal(false);

// Mantém o catálogo de exercícios do domínio em sincronia com as máquinas cadastradas.
effect(() => setUserExercises(app.value.customExercises));

export async function loadState() {
  try {
    const raw = await get(KEY);
    app.value = migrate(raw);
    // Grava já no formato novo para backups e próximas leituras.
    if (raw != null && (raw as { schemaVersion?: number }).schemaVersion !== SCHEMA_VERSION) await set(KEY, app.value);
    hasSnapshot.value = (await get(SNAPSHOT_KEY)) != null;
  } catch (e) {
    storageError.value = `Não consegui ler os dados salvos: ${(e as Error).message}`;
  }
  loaded.value = true;
  // Pede ao navegador para não apagar o IndexedDB sob pressão de espaço.
  void navigator.storage?.persist?.();
}

export function commit(next: AppState) {
  app.value = next;
  set(KEY, next).catch((e: Error) => {
    storageError.value = `Falha ao salvar: ${e.message}`;
  });
}

export const mutate = (fn: (s: AppState) => AppState) => commit(fn(app.value));

/** Guarda o estado atual antes de operações destrutivas (importar, apagar). */
export async function takeSnapshot() {
  await set(SNAPSHOT_KEY, app.value);
  hasSnapshot.value = true;
}

export async function restoreSnapshot(): Promise<boolean> {
  const snap = await get(SNAPSHOT_KEY);
  if (!snap) return false;
  commit(migrate(snap));
  await del(SNAPSHOT_KEY);
  hasSnapshot.value = false;
  return true;
}
