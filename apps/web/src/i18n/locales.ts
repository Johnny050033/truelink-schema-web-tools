import { isSourceLocale, registerCatalog, type Catalog, type Locale, type SourceLocale } from 'truelink-schema-document';
import type { MessageKey } from './messages';

type TranslatedLocale = Exclude<Locale, SourceLocale>;
type Translation = Partial<Record<MessageKey, string>>;

// Each translation (interface messages plus the shared core's catalog) downloads on first use;
// the service worker precaches the chunks, so a chosen language also works offline.
const LOADERS: Readonly<Record<TranslatedLocale, () => Promise<readonly [Translation, Catalog]>>> = {
  'zh-CN': () => Promise.all([import('./locales/zh-CN.json'), import('truelink-schema-document/locales/zh-CN.json')]).then(([app, core]) => [app.default, core.default]),
  ja: () => Promise.all([import('./locales/ja.json'), import('truelink-schema-document/locales/ja.json')]).then(([app, core]) => [app.default, core.default]),
  es: () => Promise.all([import('./locales/es.json'), import('truelink-schema-document/locales/es.json')]).then(([app, core]) => [app.default, core.default]),
  'pt-BR': () => Promise.all([import('./locales/pt-BR.json'), import('truelink-schema-document/locales/pt-BR.json')]).then(([app, core]) => [app.default, core.default]),
  id: () => Promise.all([import('./locales/id.json'), import('truelink-schema-document/locales/id.json')]).then(([app, core]) => [app.default, core.default]),
};

const loaded = new Map<Locale, Translation>();
const pending = new Map<Locale, Promise<void>>();

export function isLocaleReady(locale: Locale): boolean {
  return isSourceLocale(locale) || loaded.has(locale);
}

/** Loads a translation once. Missing strings (or a failed download) fall back to the source language. */
export function ensureLocale(locale: Locale): Promise<void> {
  if (isSourceLocale(locale) || loaded.has(locale)) return Promise.resolve();
  let promise = pending.get(locale);
  if (!promise) {
    promise = LOADERS[locale]()
      .then(([messages, core]) => {
        registerCatalog(locale, core);
        loaded.set(locale, messages);
      })
      .finally(() => pending.delete(locale));
    pending.set(locale, promise);
  }
  return promise;
}

export function translatedMessage(locale: Locale, key: MessageKey): string | undefined {
  return loaded.get(locale)?.[key] || undefined;
}
