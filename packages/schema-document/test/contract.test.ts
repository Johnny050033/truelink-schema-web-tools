import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CORE_VERSION,
  createDocumentData,
  createRecord,
  fromLegacyStoreObj,
  LEGACY_LIMITS,
  parseDomainList,
  parseJsonLdText,
  parseRecord,
  RECORD_FORMAT,
  setAt,
  toLegacyStoreObj,
  type JsonObject,
  type SchemaDocumentRecord,
} from '../src/index.js';

const base = { id: 'doc_12345678', title: '', templateId: 'organization' as const, data: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Synthetic Co' }, updatedAt: 1 };

function ids(): () => string {
  let next = 0;
  return () => `rec_${String((next += 1)).padStart(8, '0')}`;
}

/** Shape the TrueLink web tool builds in schema-engine.js (synthetic values). */
const legacyStoreObj = {
  mainSchema: {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://example.com/#organization',
    name: '晨光示範咖啡',
    url: 'https://example.com',
    description: '示範用的咖啡工作室。',
    telephone: '+886-2-2345-6789',
    address: { '@type': 'PostalAddress', streetAddress: '示範路 1 號', addressLocality: '大安區', addressRegion: '臺北市', addressCountry: 'TW' },
    sameAs: ['https://www.facebook.com/example'],
  },
  faqs: [
    { '@type': 'Question', name: '可以開立統一發票嗎？', acceptedAnswer: { '@type': 'Answer', text: '可以。' } },
    { '@type': 'Question', name: '有停車位嗎？', acceptedAnswer: { '@type': 'Answer', text: '附近有公有停車場。' } },
  ],
  type: 'LocalBusiness',
  whitelistedDomains: 'example.com, WWW.example.com\nshop.example.com，example.com',
};

describe('shared document records', () => {
  it('validates and copies client-authored fields only', () => {
    const result = createRecord(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record).toEqual({ format: RECORD_FORMAT, version: 1, ...base });
    expect(result.record.data).not.toBe(base.data);
    expect(parseRecord(JSON.parse(JSON.stringify(result.record)))).toEqual(result);
  });

  it('rejects server-managed or unknown fields, unsupported versions and malformed values', () => {
    const record = { format: RECORD_FORMAT, version: 1, ...base };
    expect(parseRecord({ ...record, owner: 'uid-b' })).toEqual({ ok: false, code: 'unknown_field' });
    expect(parseRecord({ ...record, revision: 3 })).toEqual({ ok: false, code: 'unknown_field' });
    expect(parseRecord({ ...record, version: 2 })).toEqual({ ok: false, code: 'unsupported_version' });
    expect(parseRecord({ ...record, format: 'other' })).toEqual({ ok: false, code: 'unsupported_format' });
    expect(parseRecord({ ...record, id: 'a/b/../c' })).toEqual({ ok: false, code: 'invalid_id' });
    expect(parseRecord({ ...record, id: 'short' })).toEqual({ ok: false, code: 'invalid_id' });
    expect(parseRecord({ ...record, templateId: 'recipe' })).toEqual({ ok: false, code: 'invalid_template' });
    expect(parseRecord({ ...record, updatedAt: -1 })).toEqual({ ok: false, code: 'invalid_timestamp' });
    expect(parseRecord({ ...record, data: [] })).toEqual({ ok: false, code: 'invalid_data' });
    expect(parseRecord({ ...record, data: { '@context': 'https://schema.org', '@graph': [] } })).toEqual({ ok: false, code: 'graph_not_allowed' });
    expect(parseRecord('record')).toEqual({ ok: false, code: 'not_object' });
  });

  it('counts titles in code points and rejects prototype keys, accessors and oversized data', () => {
    const record = { format: RECORD_FORMAT, version: 1, ...base };
    expect(parseRecord({ ...record, title: '😀'.repeat(120) }).ok).toBe(true);
    expect(parseRecord({ ...record, title: 'a'.repeat(121) })).toEqual({ ok: false, code: 'invalid_title' });
    expect(parseRecord(JSON.parse(`{"format":"${RECORD_FORMAT}","version":1,"id":"doc_12345678","title":"","templateId":"thing","updatedAt":1,"data":{"__proto__":{"x":1}}}`))).toEqual({
      ok: false,
      code: 'forbidden_key',
    });
    const withGetter = { ...record };
    Object.defineProperty(withGetter, 'title', { enumerable: true, get: () => 'computed' });
    expect(parseRecord(withGetter)).toEqual({ ok: false, code: 'not_json' });
    expect(parseRecord({ ...record, data: { '@type': 'Thing', description: 'x'.repeat(19_000), a: 'x'.repeat(19_000), b: 'x'.repeat(19_000), c: 'x'.repeat(19_000), d: 'x'.repeat(19_000), e: 'x'.repeat(19_000) } })).toEqual({
      ok: false,
      code: 'too_large',
    });
  });
});

describe('TrueLink web tool stored object', () => {
  it('reads the main entity, FAQ questions and domain whitelist without inventing data', () => {
    const result = fromLegacyStoreObj(legacyStoreObj, { now: 5, makeId: ids() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.main).toMatchObject({ id: 'rec_00000001', templateId: 'local-business', title: '', updatedAt: 5 });
    expect(result.main.data).toEqual(legacyStoreObj.mainSchema);
    expect(result.faq).toMatchObject({ id: 'rec_00000002', templateId: 'faq' });
    expect(result.faq?.data).toEqual({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: legacyStoreObj.faqs });
    expect(result.whitelistedDomains).toEqual(['example.com', 'www.example.com', 'shop.example.com']);
  });

  it('maps every identity type the web tool offers to a Studio template', () => {
    const templateFor = (type: string) => {
      const result = fromLegacyStoreObj({ mainSchema: { '@context': 'https://schema.org', '@type': type, name: 'X' }, faqs: [], type, whitelistedDomains: '' }, { now: 0, makeId: ids() });
      return result.ok ? result.main.templateId : result.code;
    };
    expect(templateFor('Organization')).toBe('organization');
    expect(templateFor('NGO')).toBe('organization');
    expect(templateFor('LocalBusiness')).toBe('local-business');
    expect(templateFor('Person')).toBe('person');
  });

  it('uses the stored type when the entity lacks one and reports unusable objects', () => {
    const typed = fromLegacyStoreObj({ mainSchema: { name: 'X' }, type: 'Organization' }, { now: 0, makeId: ids() });
    expect(typed.ok && typed.main.data['@type']).toBe('Organization');
    expect(typed.ok && typed.faq).toBeUndefined();
    const make = { now: 0, makeId: ids() };
    expect(fromLegacyStoreObj(null, make)).toEqual({ ok: false, code: 'not_object' });
    expect(fromLegacyStoreObj({ faqs: [] }, make)).toEqual({ ok: false, code: 'missing_main_schema' });
    expect(fromLegacyStoreObj({ mainSchema: { name: 'X' } }, make)).toEqual({ ok: false, code: 'missing_type' });
    expect(fromLegacyStoreObj({ mainSchema: { '@type': 'Organization' }, faqs: 'no' }, make)).toEqual({ ok: false, code: 'invalid_faqs' });
    const tooMany = Array.from({ length: LEGACY_LIMITS.maxFaqs + 1 }, () => ({ '@type': 'Question', name: 'Q' }));
    expect(fromLegacyStoreObj({ mainSchema: { '@type': 'Organization' }, faqs: tooMany }, make)).toEqual({ ok: false, code: 'too_many_faqs' });
  });

  it('writes the exact stored-object shape from Studio documents', () => {
    const template = 'organization' as const;
    let data = createDocumentData(template, { locale: 'zh-TW' });
    data = setAt(data, ['name'], 'Synthetic Co');
    data = setAt(data, ['url'], 'https://example.org/');
    const main = createRecord({ id: 'doc_main0001', title: '', templateId: template, data, updatedAt: 1 });
    const faq = createRecord({
      id: 'doc_faq00001',
      title: '',
      templateId: 'faq',
      data: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: ' Q? ', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }, { '@type': 'Question', acceptedAnswer: { '@type': 'Answer' } }] },
      updatedAt: 1,
    });
    if (!main.ok || !faq.ok) throw new Error('fixture');
    const result = toLegacyStoreObj(main.record, { faq: faq.record, whitelistedDomains: ['Example.org', 'example.org', 'www.example.org'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.storeObj)).toEqual(['mainSchema', 'faqs', 'type', 'whitelistedDomains']);
    expect(Object.keys(result.storeObj.mainSchema)[0]).toBe('@context');
    expect(result.storeObj.mainSchema).toMatchObject({ '@type': 'Organization', name: 'Synthetic Co', url: 'https://example.org/' });
    // Empty starter questions are pruned, text is trimmed, and questions carry no context of their own.
    expect(result.storeObj.faqs).toEqual([{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }]);
    expect(result.storeObj.type).toBe('Organization');
    expect(result.storeObj.whitelistedDomains).toBe('example.org, www.example.org');
  });

  it('round-trips a stored object through records', () => {
    const imported = fromLegacyStoreObj(legacyStoreObj, { now: 0, makeId: ids() });
    if (!imported.ok) throw new Error(imported.code);
    const exported = toLegacyStoreObj(imported.main, { faq: imported.faq, whitelistedDomains: imported.whitelistedDomains });
    expect(exported).toEqual({
      ok: true,
      storeObj: { ...legacyStoreObj, whitelistedDomains: 'example.com, www.example.com, shop.example.com' },
    });
  });

  it('refuses documents the hosted schema cannot carry', () => {
    const article = createRecord({ ...base, templateId: 'article', data: { '@type': 'Article', headline: 'X' } });
    if (!article.ok) throw new Error('fixture');
    expect(toLegacyStoreObj(article.record)).toEqual({ ok: false, code: 'unsupported_template' });
    const main = createRecord(base);
    if (!main.ok) throw new Error('fixture');
    expect(toLegacyStoreObj(main.record, { faq: main.record })).toEqual({ ok: false, code: 'not_faq' });
    expect(toLegacyStoreObj(main.record, { whitelistedDomains: Array.from({ length: 400 }, (_, i) => `site-${i}.example.com`) })).toEqual({ ok: false, code: 'whitelist_too_long' });
    const untyped: SchemaDocumentRecord = { ...main.record, data: { name: 'No type' } as JsonObject };
    expect(toLegacyStoreObj(untyped)).toEqual({ ok: false, code: 'missing_type' });
    const huge: SchemaDocumentRecord = { ...main.record, data: { '@type': 'Organization', description: 'x'.repeat(LEGACY_LIMITS.maxBytes) } };
    expect(toLegacyStoreObj(huge)).toEqual({ ok: false, code: 'too_large' });
  });

  it('normalises free-text domain lists', () => {
    expect(parseDomainList(' A.com ,b.com；c.com、a.com\n\n')).toEqual(['a.com', 'b.com', 'c.com']);
    expect(parseDomainList('')).toEqual([]);
  });
});

describe('importing web tool data as JSON-LD', () => {
  it('turns a pasted stored object into entity and FAQ candidates', () => {
    const result = parseJsonLdText(JSON.stringify(legacyStoreObj));
    expect(result.candidates.map((candidate) => candidate.templateId)).toEqual(['local-business', 'faq']);
    expect(result.candidates[1]?.node).toEqual({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: legacyStoreObj.faqs });
    expect(result.issues.map((issue) => issue.code)).toEqual(['legacy_store']);
    // Ordinary JSON-LD is unaffected.
    expect(parseJsonLdText(JSON.stringify(legacyStoreObj.mainSchema)).issues).toEqual([]);
  });
});

describe('core version', () => {
  it('matches the package version that consumers pin', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(CORE_VERSION).toBe(pkg.version);
  });
});

describe('conformance cases shared with other TrueLink tools', () => {
  const suite = JSON.parse(readFileSync(new URL('../conformance/legacy-store.json', import.meta.url), 'utf8')) as {
    coreVersion: string;
    cases: { name: string; storeObj: Record<string, unknown>; expect: { mainTemplate: string; faqTemplate: string | null; whitelistedDomains: string[]; roundTripWhitelist: string } }[];
  };

  it('is written for this core version', () => {
    expect(suite.coreVersion).toBe(CORE_VERSION);
  });

  for (const testCase of suite.cases) {
    it(testCase.name, () => {
      const imported = fromLegacyStoreObj(testCase.storeObj, { now: 0, makeId: ids() });
      if (!imported.ok) throw new Error(imported.code);
      expect(imported.main.templateId).toBe(testCase.expect.mainTemplate);
      expect(imported.faq?.templateId ?? null).toBe(testCase.expect.faqTemplate);
      expect(imported.whitelistedDomains).toEqual(testCase.expect.whitelistedDomains);
      const exported = toLegacyStoreObj(imported.main, { faq: imported.faq, whitelistedDomains: imported.whitelistedDomains });
      if (!exported.ok) throw new Error(exported.code);
      const main = testCase.storeObj['mainSchema'] as Record<string, unknown>;
      expect(exported.storeObj.mainSchema).toEqual(main['@type'] ? main : { ...main, '@type': testCase.storeObj['type'] });
      expect(exported.storeObj.faqs).toEqual(testCase.storeObj['faqs'] ?? []);
      expect(exported.storeObj.whitelistedDomains).toBe(testCase.expect.roundTripWhitelist);
    });
  }
});
