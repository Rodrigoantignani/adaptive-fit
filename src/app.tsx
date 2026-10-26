import { useState } from 'preact/hooks';
import { app, loaded, storageError } from './data/store';
import { applyUpdate, updateAvailable } from './pwa';
import { Body } from './screens/Body';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';
import { RestTimer } from './ui/timer';

type Tab = 'today' | 'body' | 'progress' | 'settings';

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'today', icon: '⚡', label: 'Hoje' },
  { id: 'body', icon: '📐', label: 'Corpo' },
  { id: 'progress', icon: '📈', label: 'Evolução' },
  { id: 'settings', icon: '⚙️', label: 'Ajustes' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('today');
  if (!loaded.value) return <div class="splash">⚡</div>;
  const training = app.value.sessions.some((s) => !s.endedAt);

  return (
    <>
      <header class="topbar">
        <div class="brand">⚡ Adaptive Fit</div>
        {training && <span class="badge live">treino em andamento</span>}
      </header>
      {updateAvailable.value && (
        <div class="banner">
          Nova versão disponível
          <button onClick={applyUpdate}>Atualizar</button>
        </div>
      )}
      {storageError.value && <div class="banner danger">{storageError.value}</div>}
      <main class="container">
        {tab === 'today' && <Today />}
        {tab === 'body' && <Body />}
        {tab === 'progress' && <Progress />}
        {tab === 'settings' && <Settings />}
      </main>
      <RestTimer />
      <nav class="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            class={`nav-item ${tab === t.id ? 'active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id);
              window.scrollTo({ top: 0 });
            }}
          >
            <span class="nav-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
