/**
 * Localization for the shared core.
 *
 * Every bundled string is written in the two source languages (`t(zh, en)`). Other locales
 * resolve through catalogs keyed by the text of their fallback language, so a translator only
 * needs a flat `{ "source text": "translation" }` file (see ../locales/*.json): Simplified
 * Chinese is keyed by the Traditional Chinese text, every other locale by the English text.
 * Messages that combine values use templates with `{name}` slots, which lets each language
 * choose its own word order and grammar.
 */
import { LOCALES, SOURCE_LOCALES, type Locale, type LocalizedText, type SourceLocale } from './types.js';

export type Catalog = Readonly<Record<string, string>>;

export interface LocaleInfo {
  readonly locale: Locale;
  /** Name of the language in that language. */
  readonly nativeName: string;
  /** BCP 47 tag for the HTML `lang` attribute. */
  readonly htmlLang: string;
  /** "reviewed" translations were checked by a fluent speaker; "beta" ones still need review. */
  readonly status: 'source' | 'reviewed' | 'beta';
}

export const LOCALE_INFO: Readonly<Record<Locale, LocaleInfo>> = {
  en: { locale: 'en', nativeName: 'English', htmlLang: 'en', status: 'source' },
  'zh-TW': { locale: 'zh-TW', nativeName: '繁體中文', htmlLang: 'zh-Hant-TW', status: 'source' },
  'zh-CN': { locale: 'zh-CN', nativeName: '简体中文', htmlLang: 'zh-Hans-CN', status: 'beta' },
  ja: { locale: 'ja', nativeName: '日本語', htmlLang: 'ja', status: 'beta' },
  es: { locale: 'es', nativeName: 'Español', htmlLang: 'es', status: 'beta' },
  'pt-BR': { locale: 'pt-BR', nativeName: 'Português (Brasil)', htmlLang: 'pt-BR', status: 'beta' },
  id: { locale: 'id', nativeName: 'Bahasa Indonesia', htmlLang: 'id', status: 'beta' },
};

const catalogs = new Map<Locale, Record<string, string>>();

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function isSourceLocale(locale: Locale): locale is SourceLocale {
  return (SOURCE_LOCALES as readonly string[]).includes(locale);
}

/** Adds translations for a locale (merged over any already registered). */
export function registerCatalog(locale: Locale, catalog: Catalog): void {
  if (isSourceLocale(locale)) return;
  const merged = Object.assign(Object.create(null) as Record<string, string>, catalogs.get(locale));
  for (const [source, translation] of Object.entries(catalog)) {
    if (typeof translation === 'string' && translation.trim()) merged[source] = translation;
  }
  catalogs.set(locale, merged);
}

export function hasCatalog(locale: Locale): boolean {
  return isSourceLocale(locale) || catalogs.has(locale);
}

/**
 * The source language a locale is translated from, whose text keys its catalog and is shown
 * when a translation is missing.
 */
export function fallbackLocale(locale: Locale): SourceLocale {
  return locale === 'zh-CN' ? 'zh-TW' : 'en';
}

/** Resolves text for a locale: its own value, then the catalog, then the fallback language. */
export function localize(text: LocalizedText, locale: Locale): string {
  if (isSourceLocale(locale)) return text[locale];
  const own = text[locale];
  if (own) return own;
  const source = text[fallbackLocale(locale)];
  return catalogs.get(locale)?.[source] || source;
}

/** Replaces `{name}` slots; unknown slots are left visible so gaps are noticed, not hidden. */
export function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));
}

type Var = string | number | LocalizedText | ((locale: Locale) => string);

function resolveVar(value: Var, locale: Locale): string {
  if (typeof value === 'function') return value(locale);
  if (typeof value === 'object') return localize(value, locale);
  return String(value);
}

/**
 * Text resolved separately for every locale (properties are computed on access, so catalogs
 * registered later still apply).
 */
export function lazyText(build: (locale: Locale) => string): LocalizedText {
  const text = {} as Record<Locale, string>;
  for (const locale of LOCALES) Object.defineProperty(text, locale, { enumerable: true, get: () => build(locale) });
  return text as unknown as LocalizedText;
}

/** A localized template with slots, e.g. `fmt('{label}是必填欄位。', '{label} is required.', { label })`. */
export function fmt(zh: string, en: string, vars: Readonly<Record<string, Var>> = {}): LocalizedText {
  const template: LocalizedText = { 'zh-TW': zh, en };
  return lazyText((locale) => {
    const resolved: Record<string, string> = {};
    for (const [name, value] of Object.entries(vars)) resolved[name] = resolveVar(value, locale);
    return fill(localize(template, locale), resolved);
  });
}

/** Chinese and Japanese write without spaces between sentences and list items. */
export function isCjk(locale: Locale): boolean {
  return locale === 'zh-TW' || locale === 'zh-CN' || locale === 'ja';
}

export function sentenceSeparator(locale: Locale): string {
  return isCjk(locale) ? '' : ' ';
}

/** Joins list items the way each language writes lists. */
export function joinList(items: readonly string[], locale: Locale): string {
  if (isCjk(locale)) return items.join('、');
  if (locale === 'en') {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  }
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}
