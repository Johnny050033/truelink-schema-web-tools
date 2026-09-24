import { describe, expect, it } from 'vitest';
import { LOCAL_LIMITS } from '../src/config';
import { createBackup, emptyBrand, parseBackup, parseBrand, parseDocs, parsePreferences, readSharedTheme, toSchemaDoc } from '../src/lib/persistence';

const validDoc = {
  id: 'doc-1',
  title: '',
  templateId: 'organization',
  data: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Synthetic' },
  createdAt: 1,
  updatedAt: 2,
  revision: 0,
};

describe('stored documents', () => {
  it('accepts valid documents and rejects unknown envelope fields', () => {
    expect(toSchemaDoc(validDoc)).toEqual(validDoc);
    expect(toSchemaDoc({ ...validDoc, owner: 'someone-else' })).toBeUndefined();
    expect(toSchemaDoc({ ...validDoc, templateId: 'unknown' })).toBeUndefined();
    expect(toSchemaDoc({ ...validDoc, data: 'not an object' })).toBeUndefined();
    expect(toSchemaDoc({ ...validDoc, data: JSON.parse('{"__proto__": {"x": 1}}') })).toBeUndefined();
    expect(toSchemaDoc(JSON.parse(`{"__proto__": 1, ${JSON.stringify(validDoc).slice(1)}`))).toBeUndefined();
  });

  it('drops invalid and duplicate entries but keeps the rest', () => {
    const raw = JSON.stringify([validDoc, { ...validDoc }, { ...validDoc, id: 'doc-2', revision: -1 }, { ...validDoc, id: 'doc-3' }]);
    const result = parseDocs(raw);
    expect(result.docs.map((doc) => doc.id)).toEqual(['doc-1', 'doc-3']);
    expect(result.dropped).toBe(2);
    expect(result.corrupt).toBe(false);
  });

  it('flags unreadable storage as corrupt and enforces the document limit', () => {
    expect(parseDocs('{oops')).toEqual({ docs: [], dropped: 0, corrupt: true });
    expect(parseDocs('{}').corrupt).toBe(true);
    const many = Array.from({ length: LOCAL_LIMITS.maxDocuments + 3 }, (_, index) => ({ ...validDoc, id: `doc-${index}` }));
    const result = parseDocs(JSON.stringify(many));
    expect(result.docs).toHaveLength(LOCAL_LIMITS.maxDocuments);
    expect(result.dropped).toBe(3);
  });
});

describe('brand and preferences', () => {
  it('parses the brand profile strictly', () => {
    expect(parseBrand(null)).toEqual({ brand: emptyBrand(), corrupt: false });
    expect(parseBrand(JSON.stringify({ data: { name: 'X' }, updatedAt: 5 }))).toEqual({ brand: { data: { name: 'X' }, updatedAt: 5 }, corrupt: false });
    expect(parseBrand(JSON.stringify({ data: { name: 'X' }, updatedAt: 5, extra: true })).corrupt).toBe(true);
    expect(parseBrand('nope').corrupt).toBe(true);
  });

  it('keeps known preferences, ignores unknown ones and resets invalid values', () => {
    expect(parsePreferences(null, 'en').locale).toBe('en');
    expect(parsePreferences(JSON.stringify({ theme: 'dark', locale: 'zh-TW', futureSetting: 1 }), 'en')).toMatchObject({ theme: 'dark', locale: 'zh-TW' });
    expect(parsePreferences(JSON.stringify({ theme: 'neon' }), 'en').theme).toBe('light');
    expect(parsePreferences('[', 'zh-TW').theme).toBe('light');
  });

  it('defaults to the light theme like the TrueLink site and can be seeded by its tl_theme choice', () => {
    expect(parsePreferences(null, 'zh-TW').theme).toBe('light');
    expect(parsePreferences(null, 'zh-TW', 'dark').theme).toBe('dark');
    // A saved Studio choice wins over the seed.
    expect(parsePreferences(JSON.stringify({ theme: 'system' }), 'zh-TW', 'dark').theme).toBe('system');
    const storage = (value: string | null) => ({ getItem: () => value, setItem: () => undefined, removeItem: () => undefined });
    expect(readSharedTheme(storage('dark'))).toBe('dark');
    expect(readSharedTheme(storage('light'))).toBe('light');
    expect(readSharedTheme(storage('system'))).toBeUndefined();
    expect(readSharedTheme(storage(null))).toBeUndefined();
    expect(readSharedTheme(null)).toBeUndefined();
  });
});

describe('backups', () => {
  it('round-trips documents and brand data', () => {
    const backup = createBackup([toSchemaDoc(validDoc)!], { data: { '@type': 'Organization', name: 'Brand' }, updatedAt: 1 }, new Date('2026-01-01T00:00:00Z'));
    expect(backup.exportedAt).toBe('2026-01-01T00:00:00.000Z');
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed?.documents).toEqual([{ title: '', templateId: 'organization', data: validDoc.data }]);
    expect(parsed?.brand).toEqual({ '@type': 'Organization', name: 'Brand' });
    expect(parsed?.skipped).toBe(0);
  });

  it('rejects other files and skips malformed documents', () => {
    expect(parseBackup('{}')).toBeUndefined();
    expect(parseBackup('not json')).toBeUndefined();
    const text = JSON.stringify({ format: 'truelink-schema-studio-backup', version: 1, exportedAt: '', brand: null, documents: [{ title: 'ok', templateId: 'faq', data: {}, createdAt: 1, updatedAt: 1 }, { title: 'bad', templateId: 'faq', data: {}, createdAt: 1, updatedAt: 1, id: 'x', owner: 'y' }] });
    const parsed = parseBackup(text);
    expect(parsed?.documents).toHaveLength(1);
    expect(parsed?.skipped).toBe(1);
    expect(parsed?.brand).toBeUndefined();
  });
});
