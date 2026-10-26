import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

export const updateAvailable = signal(false);

let update: ((reload?: boolean) => Promise<void>) | null = null;

/** Nova versão só entra quando o usuário aceita: nunca recarrega no meio de um treino. */
export function setupPwa() {
  update = registerSW({
    onNeedRefresh() {
      updateAvailable.value = true;
    },
  });
}

export const applyUpdate = () => void update?.(true);
