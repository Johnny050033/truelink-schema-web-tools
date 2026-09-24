import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { auditDocument, getTemplate, toJsonLdJson } from 'truelink-schema-document';
import { httpsOr, sameOriginPath } from '../src/config';
import { CodeBlock } from '../src/components/CodeBlock';
import { AiDescription, EntityCard, SearchPreview } from '../src/features/editor/Previews';
import { clearHiddenFields } from '../src/features/editor/FormView';
import { detectLocale, formatMessage } from '../src/i18n';
import { messages } from '../src/i18n/messages';
import { hrefFor, parseHash } from '../src/lib/router';

const attack = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

describe('rendering untrusted Schema data', () => {
  const template = getTemplate('local-business');
  const data = { '@type': 'Restaurant', name: attack, description: attack, url: 'https://example.com/', sameAs: ['javascript:alert(3)'] };

  it('escapes names, descriptions and profiles in previews', () => {
    const html = renderToStaticMarkup(
      <>
        <AiDescription template={template} data={data} audit={auditDocument(template, data)} />
        <EntityCard template={template} data={data} />
        <SearchPreview template={template} data={data} />
      </>,
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img');
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it('highlights JSON-LD as text nodes only', () => {
    const html = renderToStaticMarkup(<CodeBlock json={toJsonLdJson({ name: attack })} wrapScript label="code" />);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script type=&quot;application/ld+json&quot;&gt;');
  });
});

describe('outbound link configuration', () => {
  it('only accepts credential-free HTTPS URLs', () => {
    expect(httpsOr('https://truelink-group.com/signup', 'fallback')).toBe('https://truelink-group.com/signup');
    expect(httpsOr('http://truelink-group.com/', 'fallback')).toBe('fallback');
    expect(httpsOr('javascript:alert(1)', 'fallback')).toBe('fallback');
    expect(httpsOr('https://user:pass@example.com/', 'fallback')).toBe('fallback');
    expect(httpsOr(undefined, 'fallback')).toBe('fallback');
  });

  it('only accepts same-origin logo paths', () => {
    expect(sameOriginPath('./brand/truelink-logo.svg')).toBe('./brand/truelink-logo.svg');
    expect(sameOriginPath('/brand/logo.png')).toBe('/brand/logo.png');
    expect(sameOriginPath('https://evil.example/logo.svg')).toBeUndefined();
    expect(sameOriginPath('//evil.example/logo.svg')).toBeUndefined();
    expect(sameOriginPath('data:image/svg+xml,<svg/>')).toBeUndefined();
    expect(sameOriginPath('./logo.js')).toBeUndefined();
  });
});

describe('routing', () => {
  it('parses and builds hash routes', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/library')).toEqual({ name: 'library' });
    expect(parseHash('#/doc/abc-123')).toEqual({ name: 'doc', id: 'abc-123' });
    expect(parseHash('#/doc/../../etc')).toEqual({ name: 'not-found' });
    expect(parseHash('#/doc/<script>')).toEqual({ name: 'not-found' });
    expect(parseHash('#/unknown')).toEqual({ name: 'not-found' });
    for (const route of [{ name: 'home' }, { name: 'brand' }, { name: 'doc', id: 'x1' }] as const) expect(parseHash(hrefFor(route))).toEqual(route);
  });
});

describe('interface copy', () => {
  it('has matching placeholders in both languages', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const key of Object.keys(messages['zh-TW']) as (keyof (typeof messages)['zh-TW'])[]) {
      expect(placeholders(messages.en[key]), key).toEqual(placeholders(messages['zh-TW'][key]));
      expect(messages.en[key].trim().length, key).toBeGreaterThan(0);
    }
  });

  it('never promises rankings, rich results or AI citations', () => {
    const all = [...Object.values(messages['zh-TW']), ...Object.values(messages.en)].join('\n');
    // Negated statements ("不保證…", "not guaranteed") are the intended disclaimers.
    expect(all).not.toMatch(/(?<!不)保證(被|收錄|排名|引用|出現)|(?<!not |never )guarantee[sd]? (to|ranking|citation|you)|will rank/i);
    expect(all).toContain('不保證出現複合式結果');
  });

  it('formats messages and detects locale', () => {
    expect(formatMessage('{count}/{max}', { count: 1, max: 20 })).toBe('1/20');
    expect(formatMessage('{missing}', {})).toBe('{missing}');
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale(['zh-HK', 'en'])).toBe('zh-TW');
    expect(detectLocale(['fr-FR'])).toBe('zh-TW');
  });
});

describe('type changes', () => {
  it('clears fields hidden by a new @type and reports how many', () => {
    const template = getTemplate('local-business');
    const before = { '@type': 'Restaurant', name: 'R', servesCuisine: ['Brunch'], menu: 'https://example.com/menu' };
    const after = { ...before, '@type': 'Store' };
    expect(clearHiddenFields(template, before, after)).toEqual({ node: { '@type': 'Store', name: 'R' }, cleared: 2 });
    expect(clearHiddenFields(template, before, { ...before, name: 'R2' }).cleared).toBe(0);
  });
});
