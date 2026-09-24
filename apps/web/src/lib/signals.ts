import { useSyncExternalStore } from 'react';

/** Minimal observable value for app-wide signals raised outside React (e.g. service worker updates). */
export function createSignal<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useSignal<T>(signal: ReturnType<typeof createSignal<T>>): T {
  return useSyncExternalStore(signal.subscribe, signal.get, signal.get);
}

/** Set when a new service worker is waiting; calling it reloads into the new version. */
export const updateSignal = createSignal<(() => void) | null>(null);

/** Raised after the app is installed so the shell can confirm it. */
export const installedSignal = createSignal(0);
