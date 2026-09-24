import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fallbackLocale, isSourceLocale, LOCALE_INFO, localize, type Locale, type LocalizedText } from 'truelink-schema-document';
import { ensureLocale, isLocaleReady, translatedMessage } from './locales';
import { sourceMessages, type BaseKey, type MessageKey } from './messages';

export type { BaseKey as MessageKey };
export { ensureLocale, isLocaleReady };

type Params = Record<string, string | number>;

export function formatMessage(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

function pluralCategory(locale: Locale, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_INFO[locale].htmlLang);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

/** A message in one language only (no fallback). */
function ownMessage(locale: Locale, key: MessageKey): string | undefined {
  return isSourceLocale(locale) ? (sourceMessages[locale] as Readonly<Partial<Record<MessageKey, string>>>)[key] : translatedMessage(locale, key);
}

/**
 * Looks up a message, preferring a plural form (`key.one` …) when `count` selects one, then the
 * language's own base message, then the fallback language's.
 */
export function translate(locale: Locale, key: BaseKey, params?: Params): string {
  const count = params?.['count'];
  const variant = typeof count === 'number' ? (`${key}.${pluralCategory(locale, count)}` as MessageKey) : undefined;
  const fallback = fallbackLocale(locale);
  const text =
    (variant && ownMessage(locale, variant)) ||
    ownMessage(locale, key) ||
    (variant && ownMessage(fallback, variant)) ||
    sourceMessages[fallback][key];
  return formatMessage(text, params);
}

/** Maps one BCP 47 language tag to a supported locale. */
export function matchLocale(tag: string): Locale | undefined {
  const [language = '', ...rest] = tag.toLowerCase().split(/[-_]/);
  switch (language) {
    case 'en':
      return 'en';
    case 'zh':
      // Traditional script or a Traditional-Chinese region; plain "zh" usually means Simplified.
      return rest.some((part) => part === 'hant' || part === 'tw' || part === 'hk' || part === 'mo') ? 'zh-TW' : 'zh-CN';
    case 'ja':
      return 'ja';
    case 'es':
      return 'es';
    case 'pt':
      return 'pt-BR';
    case 'id':
    case 'in':
      return 'id';
    default:
      return undefined;
  }
}

/** The first supported browser language; English otherwise. */
export function detectLocale(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Locale {
  for (const language of languages) {
    const locale = matchLocale(language);
    if (locale) return locale;
  }
  return 'en';
}

/** The locale to render: the preferred one once its translation has loaded, the previous one until then. */
export function useReadyLocale(preferred: Locale): Locale {
  const [shown, setShown] = useState<Locale>(() => (isLocaleReady(preferred) ? preferred : 'en'));
  useEffect(() => {
    if (isLocaleReady(preferred)) {
      setShown(preferred);
      return;
    }
    let active = true;
    ensureLocale(preferred)
      .catch(() => undefined)
      .then(() => {
        if (active) setShown(preferred);
      });
    return () => {
      active = false;
    };
  }, [preferred]);
  return isLocaleReady(preferred) ? preferred : shown;
}

export interface I18n {
  readonly locale: Locale;
  readonly t: (key: BaseKey, params?: Params) => string;
  /** Picks the current language from template copy. */
  readonly l: (text: LocalizedText) => string;
  readonly relativeTime: (timestamp: number) => string;
  readonly dateTime: (timestamp: number) => string;
  readonly bytes: (value: number) => string;
}

export function createI18n(locale: Locale, now: () => number = Date.now): I18n {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const absolute = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return {
    locale,
    t: (key, params) => translate(locale, key, params),
    l: (text) => localize(text, locale),
    relativeTime(timestamp) {
      const seconds = Math.round((timestamp - now()) / 1000);
      const abs = Math.abs(seconds);
      if (abs < 45) return translate(locale, 'time.justNow');
      if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
      if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
      if (abs < 86_400 * 30) return relative.format(Math.round(seconds / 86_400), 'day');
      return absolute.format(timestamp);
    },
    dateTime: (timestamp) => absolute.format(timestamp),
    bytes(value) {
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
      return `${(value / 1024 / 1024).toFixed(2)} MiB`;
    },
  };
}

const I18nContext = createContext<I18n>(createI18n('en'));

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
