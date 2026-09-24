import { describe, expect, it } from 'vitest';
import {
  classifyProfile,
  describeDocument,
  getTemplate,
  LIMITS,
  parseJsonLdText,
  parseJsonLdTexts,
  readField,
  summarizeHours,
  writeField,
  type ScalarField,
} from '../src/index.js';

describe('JSON-LD import', () => {
  it('splits @graph nodes, inherits context and picks templates', () => {
    const result = parseJsonLdText(JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Synthetic Org' },
        { '@type': 'WebSite', name: 'Synthetic Site', url: 'https://example.com/' },
        { name: 'no type' },
      ],
    }));
    expect(result.candidates.map((item) => item.templateId)).toEqual(['organization', 'website']);
    expect(result.candidates[0]?.node['@context']).toBe('https://schema.org');
    expect(result.issues.map((item) => item.code)).toEqual(['missing_type']);
  });

  it('accepts arrays and multiple script blocks', () => {
    const result = parseJsonLdTexts([
      JSON.stringify([{ '@type': 'Product', name: 'P' }, { '@type': 'FAQPage' }]),
      JSON.stringify({ '@type': 'Course', name: 'C' }),
    ]);
    expect(result.candidates.map((item) => item.templateId)).toEqual(['product', 'faq', 'thing']);
  });

  it('rejects invalid, oversized and prototype-polluting input without partial candidates', () => {
    expect(parseJsonLdText('{ not json').issues[0]?.code).toBe('invalid_json');
    expect(parseJsonLdText('   ').issues[0]?.code).toBe('empty');
    expect(parseJsonLdText(JSON.stringify({ '@type': 'Thing', text: 'x'.repeat(LIMITS.importBytes) })).issues[0]?.code).toBe('too_large');
    const polluted = parseJsonLdText('{"@type":"Thing","__proto__":{"polluted":true}}');
    expect(polluted.candidates).toHaveLength(0);
    expect(polluted.issues[0]?.code).toBe('forbidden_key');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('caps the number of imported items', () => {
    const many = Array.from({ length: LIMITS.maxImportBlocks + 5 }, (_, index) => ({ '@type': 'Thing', name: `T${index}` }));
    const result = parseJsonLdText(JSON.stringify(many));
    expect(result.candidates).toHaveLength(LIMITS.maxImportBlocks);
    expect(result.issues.map((item) => item.code)).toContain('too_many_blocks');
  });

  it('notes a non-schema.org context but keeps the data', () => {
    const result = parseJsonLdText(JSON.stringify({ '@context': 'https://example.com/vocab', '@type': 'Thing', name: 'X' }));
    expect(result.candidates).toHaveLength(1);
    expect(result.issues.map((item) => item.code)).toContain('non_schema_context');
  });
});

describe('describeDocument', () => {
  const business = {
    '@type': 'Restaurant',
    name: '晨光示範餐館',
    url: 'https://www.example.com/',
    telephone: '+886-2-2345-6789',
    address: { '@type': 'PostalAddress', streetAddress: '示範路 1 號', addressLocality: '大安區', addressRegion: '臺北市', addressCountry: 'TW' },
    servesCuisine: ['台式早午餐'],
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday'], opens: '10:00', closes: '16:00' },
    ],
    sameAs: ['https://www.facebook.com/example', 'https://maps.app.goo.gl/example'],
  };

  it('writes a natural zh-TW reading of a local business', () => {
    const description = describeDocument(getTemplate('local-business'), business, 'zh-TW');
    expect(description.name).toBe('晨光示範餐館');
    expect(description.typeLabel).toBe('餐廳');
    expect(description.sentences[0]).toBe('晨光示範餐館是位於臺北市大安區的餐廳。');
    expect(description.sentences).toContain('營業時間：週一至週五 09:00–18:00；週六 10:00–16:00。');
    expect(description.sentences.at(-1)).toBe('官方網站為 example.com，並在 Facebook、Google Maps 設有官方頁面。');
    expect(description.facts[0]).toMatchObject({ label: '地址', value: '臺北市大安區示範路 1 號' });
  });

  it('writes an English reading and escapes nothing (rendering is the caller’s job)', () => {
    const description = describeDocument(getTemplate('local-business'), { ...business, name: '<b>Cafe</b>' }, 'en');
    expect(description.sentences[0]).toBe('<b>Cafe</b> is a restaurant based in 大安區, 臺北市.');
    expect(summarizeHours(business, 'en')).toBe('Mon–Fri 09:00–18:00; Sat 10:00–16:00');
  });

  it('uses natural fallbacks when only a name is known', () => {
    expect(describeDocument(getTemplate('event'), { name: '示範講座' }, 'zh-TW').sentences[0]).toBe('「示範講座」是一場活動。');
    expect(describeDocument(getTemplate('event'), { name: 'Demo Talk' }, 'en').sentences[0]).toBe('Demo Talk is an event.');
    expect(describeDocument(getTemplate('organization'), { '@type': 'Organization', name: '示範組織' }, 'zh-TW').sentences[0]).toBe('示範組織是組織。');
    expect(describeDocument(getTemplate('faq'), { '@type': 'FAQPage' }, 'zh-TW').sentences).toEqual([]);
  });

  it('describes events without converting time zones', () => {
    const description = describeDocument(getTemplate('event'), { name: 'Synthetic Workshop', startDate: '2026-10-01T19:00+08:00', location: { '@type': 'Place', name: 'Demo Hall' }, organizer: { name: 'Demo Org' } }, 'zh-TW');
    expect(description.sentences[0]).toBe('「Synthetic Workshop」將於 2026/10/01 19:00 在Demo Hall舉行，由Demo Org主辦。');
  });

  it('classifies common profile hosts', () => {
    expect(classifyProfile('https://www.instagram.com/example')).toBe('instagram');
    expect(classifyProfile('https://m.facebook.com/example')).toBe('facebook');
    expect(classifyProfile('https://www.google.com/maps/place/x')).toBe('google-business');
    expect(classifyProfile('https://zh.wikipedia.org/wiki/x')).toBe('wikipedia');
    expect(classifyProfile('https://notfacebook.com/x')).toBe('other');
    expect(classifyProfile('not a url')).toBe('other');
  });
});

describe('form field helpers', () => {
  const template = getTemplate('product');
  const price = template.sections[1]!.fields[0] as ScalarField;

  it('fills a companion currency the first time a price is entered', () => {
    const data = writeField({ '@type': 'Product' }, price, '1200', template.nodeTypes);
    expect(data).toEqual({ '@type': 'Product', offers: { '@type': 'Offer', price: '1200', priceCurrency: 'TWD' } });
    const usd = writeField({ offers: { '@type': 'Offer', priceCurrency: 'USD' } }, price, '10', template.nodeTypes);
    expect(usd).toMatchObject({ offers: { priceCurrency: 'USD' } });
  });

  it('reports complex values instead of flattening them', () => {
    const logoField = getTemplate('organization').sections[0]!.fields.find((item) => item.id === 'logo') as ScalarField;
    expect(readField({ logo: { '@type': 'ImageObject', url: 'https://example.com/l.png' } }, logoField).kind).toBe('complex');
    expect(readField({ logo: 'https://example.com/l.png' }, logoField)).toEqual({ kind: 'value', values: ['https://example.com/l.png'] });
    const sameAs = getTemplate('organization').sections[3]!.fields[0] as ScalarField;
    expect(readField({ sameAs: 'https://example.com/p' }, sameAs)).toEqual({ kind: 'value', values: ['https://example.com/p'] });
  });
});
