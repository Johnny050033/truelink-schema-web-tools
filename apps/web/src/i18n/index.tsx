import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Locale, LocalizedText } from 'truelink-schema-document';
import { messages, type MessageKey } from './messages';

export type { MessageKey };

type Params = Record<string, string | number>;

export function formatMessage(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  return formatMessage(messages[locale][key], params);
}

export function detectLocale(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Locale {
  for (const language of languages) {
    const lower = language.toLowerCase();
    if (lower.startsWith('zh')) return 'zh-TW';
    if (lower.startsWith('en')) return 'en';
  }
  return 'zh-TW';
}

export interface I18n {
  readonly locale: Locale;
  readonly t: (key: MessageKey, params?: Params) => string;
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
    l: (text) => text[locale],
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

const I18nContext = createContext<I18n>(createI18n('zh-TW'));

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
