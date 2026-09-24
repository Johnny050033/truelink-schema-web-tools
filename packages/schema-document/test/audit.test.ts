import { describe, expect, it } from 'vitest';
import { auditDocument, getTemplate, gradeFor, type JsonObject } from '../src/index.js';

const codes = (templateId: Parameters<typeof getTemplate>[0], data: JsonObject) => auditDocument(getTemplate(templateId), data).issues.map((issue) => issue.code);

describe('auditDocument', () => {
  it('reports missing required fields and caps the score', () => {
    const result = auditDocument(getTemplate('organization'), { '@type': 'Organization', url: 'https://example.com', logo: 'https://example.com/logo.png' });
    expect(result.errors).toBeGreaterThan(0);
    expect(result.issues[0]).toMatchObject({ severity: 'error', code: 'missing_required', fieldId: 'name' });
    expect(result.score).toBeLessThanOrEqual(49);
    expect(result.grade).toBe('needs-work');
  });

  it('scores a complete organization as excellent with no errors', () => {
    const result = auditDocument(getTemplate('organization'), {
      '@type': 'Organization',
      '@id': 'https://example.com/#organization',
      name: 'Synthetic Studio',
      url: 'https://example.com/',
      logo: 'https://example.com/logo.png',
      description: 'A synthetic organization used for tests.',
      telephone: '+886-2-2345-6789',
      address: { '@type': 'PostalAddress', addressLocality: 'Da’an', addressRegion: 'Taipei', addressCountry: 'TW' },
      sameAs: ['https://www.facebook.com/example', 'https://www.linkedin.com/company/example'],
      knowsAbout: ['structured data'],
    });
    expect(result.errors).toBe(0);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('excellent');
    expect(result.missing).toEqual([]);
  });

  it('flags malformed values and does not count them as filled', () => {
    const result = auditDocument(getTemplate('organization'), { name: 'X', url: 'example.com', telephone: 'call us', email: 'nope' });
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['invalid_url', 'invalid_tel', 'invalid_email']));
    expect(result.recommended.filled).toBe(0);
  });

  it('treats imported complex values as unknown instead of empty or complete', () => {
    const result = auditDocument(getTemplate('article'), { '@type': 'Article', headline: 'Synthetic', author: [{ '@type': 'Person', name: 'A' }, { '@type': 'Person', name: 'B' }] });
    expect(result.unknown).toBeGreaterThan(0);
    expect(result.missing.map((item) => item.fieldId)).not.toContain('author.name');
  });

  it('accepts ImageObject-style logos for URL fields', () => {
    const result = auditDocument(getTemplate('organization'), { name: 'X', logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' } });
    expect(result.missing.map((item) => item.fieldId)).not.toContain('logo');
    expect(result.issues.map((issue) => issue.code)).not.toContain('complex_value');
  });

  it('keeps and reports properties outside the template', () => {
    expect(codes('organization', { name: 'X', numberOfEmployees: 12 })).toContain('unverified_properties');
  });

  it('checks list items, minimum counts and field formats inside items', () => {
    expect(codes('faq', { '@type': 'FAQPage' })).toContain('missing_required');
    const faq = codes('faq', { mainEntity: [{ '@type': 'Question', name: 'Q1' }, { '@type': 'Question', name: 'q1', acceptedAnswer: { '@type': 'Answer', text: 'A' } }] });
    expect(faq).toEqual(expect.arrayContaining(['missing_item_field', 'duplicate_question']));
    const hours = auditDocument(getTemplate('local-business'), { openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Funday'], opens: '9am', closes: '18:00' }] });
    expect(hours.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['invalid_day', 'invalid_time']));
    expect(hours.issues.find((issue) => issue.code === 'invalid_time')?.path).toEqual(['openingHoursSpecification', 0, 'opens']);
  });

  it('runs template cross-field checks', () => {
    expect(codes('event', { name: 'E', startDate: '2026-10-02T10:00+08:00', endDate: '2026-10-01T10:00+08:00' })).toContain('end_before_start');
    expect(codes('product', { name: 'P', offers: { '@type': 'Offer', price: '100' } })).toContain('currency_missing');
    expect(codes('organization', { name: 'X', taxID: '10000001' })).toContain('tax_id_checksum');
    expect(codes('organization', { name: 'X', taxID: '10000009' })).not.toContain('tax_id_checksum');
    expect(codes('breadcrumb', { itemListElement: [{ name: 'Home' }, { name: 'Page' }] })).toContain('breadcrumb_missing_url');
    expect(codes('breadcrumb', { itemListElement: [{ name: 'Home', item: 'https://example.com/' }] })).toContain('too_few_items');
    expect(codes('local-business', { name: 'X', geo: { latitude: '25.03' } })).toContain('geo_incomplete');
  });

  it('respects conditional visibility', () => {
    const online = auditDocument(getTemplate('event'), { name: 'E', startDate: '2026-10-01T10:00+08:00', location: { '@type': 'VirtualLocation' } });
    expect(online.missing.map((item) => item.fieldId)).toContain('location.url');
    expect(online.missing.map((item) => item.fieldId)).not.toContain('location.address.addressLocality');
    const dining = auditDocument(getTemplate('local-business'), { '@type': 'Restaurant', name: 'R' });
    expect(dining.missing.map((item) => item.fieldId)).toContain('servesCuisine');
    const store = auditDocument(getTemplate('local-business'), { '@type': 'Store', name: 'S' });
    expect(store.missing.map((item) => item.fieldId)).not.toContain('servesCuisine');
  });

  it('localizes every issue message', () => {
    const result = auditDocument(getTemplate('event'), { name: 'E', startDate: 'soon', url: 'x' });
    for (const issue of result.issues) {
      expect(issue.message['zh-TW'].length).toBeGreaterThan(0);
      expect(issue.message.en.length).toBeGreaterThan(0);
    }
  });

  it('grades by score thresholds', () => {
    expect(gradeFor(49)).toBe('needs-work');
    expect(gradeFor(50)).toBe('good');
    expect(gradeFor(80)).toBe('excellent');
  });
});
