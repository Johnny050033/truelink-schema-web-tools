import { describe, expect, it } from 'vitest';
import {
  auditDocument,
  buildOutput,
  createDocumentData,
  getTemplate,
  localize,
  LOCALES,
  SOURCE_LOCALES,
  templateFields,
  templateForTypes,
  TEMPLATES,
  typeLabel,
  type LocalizedText,
  type TemplateField,
} from '../src/index.js';

function texts(field: TemplateField): LocalizedText[] {
  const own = [field.label, field.help, 'placeholder' in field ? field.placeholder : undefined, field.why].filter((item): item is LocalizedText => item !== undefined);
  if (field.kind === 'list') return [...own, field.itemLabel, field.addLabel, ...field.fields.flatMap(texts)];
  return [...own, ...(field.options ?? []).map((option) => option.label)];
}

describe('template catalogue', () => {
  it.each(TEMPLATES.map((template) => [template.id, template] as const))('%s has unique field ids and complete bilingual copy', (_id, template) => {
    const ids = templateFields(template).map(({ field }) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
    const copy = [template.name, template.summary, ...template.sections.flatMap((section) => [section.title, ...(section.description ? [section.description] : [])]), ...templateFields(template).flatMap(({ field }) => texts(field))];
    for (const text of copy) for (const locale of SOURCE_LOCALES) expect(text[locale].trim().length).toBeGreaterThan(0);
    for (const text of copy) for (const locale of LOCALES) expect(localize(text, locale).trim().length).toBeGreaterThan(0);
    for (const link of template.learnMore ?? []) expect(link.url.startsWith('https://')).toBe(true);
  });

  it.each(TEMPLATES.map((template) => [template.id] as const))('%s declares a node type for every nested object path', (id) => {
    const template = getTemplate(id);
    for (const { field } of templateFields(template)) {
      if (field.kind === 'list' || field.path.length < 2) continue;
      const parents = field.path.slice(0, -1).map((_, index) => field.path.slice(0, index + 1).join('.'));
      for (const parent of parents) expect(template.nodeTypes[parent], `${id}: ${field.id} needs nodeTypes[${parent}]`).toBeTruthy();
    }
  });

  it.each(TEMPLATES.map((template) => [template.id] as const))('%s starter documents are exportable and audited without throwing', (id) => {
    for (const locale of LOCALES) {
      const data = createDocumentData(id, { locale });
      const output = buildOutput(data, getTemplate(id));
      expect(output['@context']).toBe('https://schema.org');
      expect(output['@type']).toBeTruthy();
      const result = auditDocument(getTemplate(id), data);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('maps @type values to templates and falls back to the generic template', () => {
    expect(templateForTypes(['Restaurant']).id).toBe('local-business');
    expect(templateForTypes(['Corporation']).id).toBe('organization');
    expect(templateForTypes(['BlogPosting']).id).toBe('article');
    expect(templateForTypes(['Course']).id).toBe('thing');
    expect(templateForTypes(['Thing', 'Product']).id).toBe('product');
  });

  it('labels subtypes in both languages', () => {
    const template = getTemplate('local-business');
    expect(typeLabel(template, { '@type': 'Restaurant' }, 'zh-TW')).toBe('餐廳');
    expect(typeLabel(template, { '@type': 'Restaurant' }, 'en')).toBe('Restaurant');
    expect(typeLabel(template, { '@type': 'HairSalon' }, 'en')).toBe('HairSalon');
  });
});

describe('brand profile fill', () => {
  const brand = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '晨光示範咖啡',
    url: 'https://example.com/',
    logo: 'https://example.com/logo.png',
    telephone: '+886-2-2345-6789',
    address: { '@type': 'PostalAddress', addressLocality: '大安區', addressRegion: '臺北市', addressCountry: 'TW' },
    sameAs: ['https://www.facebook.com/example'],
  };

  it('copies the brand into a new organization document', () => {
    const data = createDocumentData('organization', { locale: 'zh-TW', brand });
    expect(data).toEqual(brand);
    (data['address'] as Record<string, unknown>)['addressLocality'] = 'changed';
    expect(brand.address.addressLocality).toBe('大安區');
  });

  it('fills related templates from brand values', () => {
    expect(createDocumentData('local-business', { locale: 'zh-TW', brand })).toMatchObject({ '@type': 'LocalBusiness', name: '晨光示範咖啡', address: { addressLocality: '大安區' }, sameAs: ['https://www.facebook.com/example'] });
    expect(createDocumentData('article', { locale: 'zh-TW', brand })).toMatchObject({ publisher: { '@type': 'Organization', name: '晨光示範咖啡', logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' } } });
    expect(createDocumentData('website', { locale: 'en', brand })).toMatchObject({ name: '晨光示範咖啡', url: 'https://example.com/', inLanguage: 'en', publisher: { name: '晨光示範咖啡' } });
    const crumbs = buildOutput(createDocumentData('breadcrumb', { locale: 'zh-TW', brand }), getTemplate('breadcrumb'));
    expect(crumbs['itemListElement']).toEqual([{ '@type': 'ListItem', name: '首頁', item: 'https://example.com/', position: 1 }]);
  });

  it('ignores an empty brand profile', () => {
    expect(createDocumentData('organization', { locale: 'en', brand: { '@type': 'Organization' } })).toEqual({ '@context': 'https://schema.org', '@type': 'Organization' });
  });
});
