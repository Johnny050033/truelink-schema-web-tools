import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { detectLocale, ensureLocale } from './i18n';
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

// A saved non-bundled language loads before the first render, so the page never flashes English.
void ensureLocale(store.getState().prefs.locale)
  .catch(() => undefined)
  .then(() => {
    const root = document.getElementById('root');
    if (!root) return;
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
