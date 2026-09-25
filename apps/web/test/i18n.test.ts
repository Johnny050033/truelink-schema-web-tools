import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTemplate, LOCALE_INFO, LOCALES, localize, type Locale } from 'truelink-schema-document';
import { CATALOG_LOCALES, messageSources, PLURAL_VARIANT, readMessages } from '../scripts/i18n.mjs';
import { checkCatalog } from '../../../packages/schema-document/scripts/i18n.mjs';
import { createI18n, detectLocale, ensureLocale, isLocaleReady, matchLocale, preferredLanguages, translate } from '../src/i18n';
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

describe('first-run language source', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const onTrueLink = () => vi.stubEnv('VITE_TRUELINK_HOST_URL', '/studio/host.html');
  const browserOffLimits = () =>
    vi.stubGlobal('navigator', {
      get languages(): never {
        throw new Error('the TrueLink-hosted Studio must not read navigator.languages');
      },
    });

  it('uses the browser languages outside TrueLink', () => {
    vi.stubGlobal('navigator', { languages: ['ja-JP', 'en'] });
    expect(preferredLanguages()).toEqual(['ja-JP', 'en']);
    expect(detectLocale()).toBe('ja');
  });

  it("on TrueLink, TrueLink's saved language wins, then its suggestion, and the browser is never read directly", () => {
    onTrueLink();
    browserOffLimits();
    const asked: unknown[] = [];
    vi.stubGlobal('TLLocale', {
      pref: () => 'zh-TW',
      suggest: (candidates: readonly string[]) => {
        asked.push(candidates);
        return 'ja';
      },
    });
    expect(preferredLanguages()).toEqual(['zh-TW', 'ja']);
    expect(asked).toEqual([LOCALES]);
    expect(detectLocale()).toBe('zh-TW');
  });

  it("on TrueLink, TrueLink's suggestion applies without a saved language; English without TLLocale", () => {
    onTrueLink();
    browserOffLimits();
    vi.stubGlobal('TLLocale', { pref: () => null, suggest: () => 'es' });
    expect(detectLocale()).toBe('es');
    vi.stubGlobal('TLLocale', undefined);
    expect(preferredLanguages()).toEqual([]);
    expect(detectLocale()).toBe('en');
  });

  it('a failing TLLocale never breaks start-up', () => {
    onTrueLink();
    browserOffLimits();
    vi.stubGlobal('TLLocale', {
      pref: () => {
        throw new Error('storage blocked');
      },
    });
    expect(detectLocale()).toBe('en');
  });
});

describe('message catalogs', () => {
  it('uses the same ids in both source languages (plural forms are optional)', () => {
    expect(Object.keys(sourceMessages['zh-TW'])).toEqual(Object.keys(sourceMessages.en).filter((key) => !PLURAL_VARIANT.test(key)));
  });

  it('picks singular forms by plural rules and falls back within the language', async () => {
    expect(translate('en', 'common.documents', { count: 1 })).toBe('1 document');
    expect(translate('en', 'common.documents', { count: 2 })).toBe('2 documents');
    expect(translate('en', 'common.documents', { count: 0 })).toBe('0 documents');
    expect(translate('zh-TW', 'common.documents', { count: 1 })).toBe(sourceMessages['zh-TW']['common.documents'].replace('{count}', '1'));
    await ensureLocale('es');
    await ensureLocale('ja');
    expect(translate('es', 'common.documents', { count: 1 })).toBe(readMessages('es')?.['common.documents.one']?.replace('{count}', '1'));
    expect(translate('es', 'field.itemCount', { count: 1 })).toBe(readMessages('es')?.['field.itemCount']?.replace('{count}', '1'));
    expect(translate('ja', 'common.documents', { count: 1 })).toBe(readMessages('ja')?.['common.documents']?.replace('{count}', '1'));
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
    expect(isLocaleReady('pt-BR')).toBe(false);
    expect(translate('pt-BR', 'nav.home')).toBe(sourceMessages.en['nav.home']);
    await ensureLocale('pt-BR');
    expect(isLocaleReady('pt-BR')).toBe(true);
    const translated = readMessages('pt-BR')?.['nav.home'];
    expect(translate('pt-BR', 'nav.home')).toBe(translated ?? sourceMessages.en['nav.home']);
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
