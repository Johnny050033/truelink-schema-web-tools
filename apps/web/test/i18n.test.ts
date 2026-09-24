import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { getTemplate, LOCALE_INFO, LOCALES, localize, type Locale } from 'truelink-schema-document';
import { CATALOG_LOCALES, messageSources, readMessages } from '../scripts/i18n.mjs';
import { checkCatalog } from '../../../packages/schema-document/scripts/i18n.mjs';
import { createI18n, detectLocale, ensureLocale, isLocaleReady, matchLocale, translate } from '../src/i18n';
import { sourceMessages } from '../src/i18n/messages';

describe('locale detection', () => {
  it('maps browser languages to supported locales, English otherwise', () => {
    expect(detectLocale(['en-GB'])).toBe('en');
    expect(detectLocale(['zh-TW'])).toBe('zh-TW');
    expect(detectLocale(['zh-Hant-HK'])).toBe('zh-TW');
    expect(detectLocale(['zh-HK', 'en'])).toBe('zh-TW');
    expect(detectLocale(['zh-CN'])).toBe('zh-CN');
    expect(detectLocale(['zh-Hans-SG'])).toBe('zh-CN');
    expect(detectLocale(['zh'])).toBe('zh-CN');
    expect(detectLocale(['ja-JP'])).toBe('ja');
    expect(detectLocale(['es-419'])).toBe('es');
    expect(detectLocale(['pt-PT'])).toBe('pt-BR');
    expect(detectLocale(['in-ID'])).toBe('id');
    expect(detectLocale(['fr-FR', 'de', 'es-MX'])).toBe('es');
    expect(detectLocale(['fr-FR'])).toBe('en');
    expect(detectLocale([])).toBe('en');
    expect(matchLocale('ko-KR')).toBeUndefined();
  });

  it('keeps the pre-render language script in step with LOCALE_INFO', () => {
    const script = readFileSync(join(import.meta.dirname, '../public/theme-init.js'), 'utf8');
    for (const locale of LOCALES) {
      const root = { lang: 'en', attributes: {} as Record<string, string>, setAttribute(name: string, value: string) { this.attributes[name] = value; } };
      const storage = { getItem: (key: string) => (key === 'truelink-schema-studio:v1:prefs' ? JSON.stringify({ theme: 'dark', locale }) : null) };
      runInNewContext(script, { document: { documentElement: root }, localStorage: storage, window: {} });
      expect(root.lang, locale).toBe(LOCALE_INFO[locale].htmlLang);
      expect(root.attributes['data-tl-theme']).toBe('dark');
    }
  });
});

describe('message catalogs', () => {
  it('uses the same ids in both source languages', () => {
    expect(Object.keys(sourceMessages['zh-TW'])).toEqual(Object.keys(sourceMessages.en));
  });

  it.each(CATALOG_LOCALES)('%s is valid', (locale) => {
    const result = checkCatalog(locale, messageSources(locale), readMessages(locale) ?? {});
    expect(result.errors).toEqual([]);
    expect(result.unknown).toEqual([]);
  });
});

describe('loading a translation', () => {
  it('falls back to the source language until a translation is loaded', async () => {
    expect(isLocaleReady('en')).toBe(true);
    expect(isLocaleReady('zh-TW')).toBe(true);
    expect(translate('zh-CN', 'nav.home')).toBe(sourceMessages['zh-TW']['nav.home']);
    expect(translate('ja', 'nav.home')).toBe(sourceMessages.en['nav.home']);
    await ensureLocale('ja');
    expect(isLocaleReady('ja')).toBe(true);
    const translated = readMessages('ja')?.['nav.home'];
    expect(translate('ja', 'nav.home')).toBe(translated ?? sourceMessages.en['nav.home']);
  });

  it('localizes template copy and dates through the shared core', async () => {
    const locales: Locale[] = ['es', 'zh-CN'];
    for (const locale of locales) await ensureLocale(locale);
    const i18n = createI18n('es', () => 0);
    const name = getTemplate('event').name;
    expect(i18n.l(name)).toBe(localize(name, 'es'));
    expect(createI18n('zh-CN').l(name)).toBe(localize(name, 'zh-CN'));
    expect(i18n.relativeTime(0)).toBe(translate('es', 'time.justNow'));
  });
});
