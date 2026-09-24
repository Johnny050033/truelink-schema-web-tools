import { useSyncExternalStore } from 'react';

export type Route =
  | { readonly name: 'home' }
  | { readonly name: 'templates' }
  | { readonly name: 'library' }
  | { readonly name: 'doc'; readonly id: string }
  | { readonly name: 'brand' }
  | { readonly name: 'transfer' }
  | { readonly name: 'account' }
  | { readonly name: 'settings' }
  | { readonly name: 'not-found' };

const SIMPLE = new Set(['templates', 'library', 'brand', 'transfer', 'account', 'settings']);

/** Hash routing keeps deep links working on any static host and inside an installed app. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (path === '') return { name: 'home' };
  const [head, id, ...rest] = path.split('/');
  if (head && SIMPLE.has(head) && id === undefined) return { name: head } as Route;
  if (head === 'doc' && id && rest.length === 0 && /^[\w-]{1,64}$/.test(id)) return { name: 'doc', id };
  return { name: 'not-found' };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'doc':
      return `#/doc/${encodeURIComponent(route.id)}`;
    case 'not-found':
      return '#/';
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const href = hrefFor(route);
  if (options.replace) window.location.replace(href);
  else window.location.hash = href;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseHash(hash);
}
