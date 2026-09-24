import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { detectLocale } from './i18n';
import { browserStorage, readSharedTheme } from './lib/persistence';
import { listenForInstallPrompt, registerServiceWorker } from './lib/pwa';
import { installedSignal, updateSignal } from './lib/signals';
import { createAppStore, initStore } from './lib/store';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

const storage = browserStorage();
const store = initStore(createAppStore({ storage, locale: detectLocale(), theme: readSharedTheme(storage) }));

window.addEventListener('storage', (event) => store.applyExternal(event.key, event.newValue));
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.flush();
});

listenForInstallPrompt(() => installedSignal.set(installedSignal.get() + 1));
registerServiceWorker((activate) => updateSignal.set(activate));

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
