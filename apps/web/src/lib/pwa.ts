import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  readonly canPrompt: boolean;
  readonly installed: boolean;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installState: InstallState = { canPrompt: false, installed: false };
const installListeners = new Set<() => void>();

function setInstallState(next: InstallState): void {
  installState = next;
  for (const listener of installListeners) listener();
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** Captures the install prompt early so it is not missed before React mounts. */
export function listenForInstallPrompt(onInstalled: () => void): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    setInstallState({ canPrompt: true, installed: false });
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setInstallState({ canPrompt: false, installed: true });
    onInstalled();
  });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable';
  deferredPrompt = null;
  setInstallState({ ...installState, canPrompt: false });
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome;
}

export function useInstallState(): InstallState & { readonly standalone: boolean; readonly ios: boolean } {
  const state = useSyncExternalStore(
    (listener) => {
      installListeners.add(listener);
      return () => installListeners.delete(listener);
    },
    () => installState,
    () => installState,
  );
  return { ...state, standalone: isStandalone(), ios: isIosSafari() };
}

/**
 * Registers the generated service worker in production builds. A new version
 * waits until the user chooses to reload, so an open editor is never swapped
 * out from under them.
 */
export function registerServiceWorker(onUpdateReady: (activate: () => void) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  let userRequestedReload = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (userRequestedReload) window.location.reload();
  });
  const offer = (worker: ServiceWorker) =>
    onUpdateReady(() => {
      userRequestedReload = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) offer(installing);
          });
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  });
}

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
