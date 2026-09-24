import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_LOCALES, checkCatalog, coreSources, extract, LOCALES_DIR, readCatalog, referenceCatalogs, serialize, sourceEntry } from '../scripts/i18n.mjs';
import { auditDocument, describeDocument, LOCALE_INFO, localize, registerCatalog, TEMPLATES, type Catalog } from '../src/index.js';
import { sampleDocuments } from './sample-documents.js';

const { entries } = extract();
const sources = coreSources(entries);

describe('locale files', () => {
  it('keeps the generated reference catalogs current', () => {
    const references = referenceCatalogs(entries);
    expect(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'), 'run: pnpm --filter truelink-schema-document i18n').toBe(serialize(references.en));
    expect(readFileSync(join(LOCALES_DIR, 'zh-TW.json'), 'utf8'), 'run: pnpm --filter truelink-schema-document i18n').toBe(serialize(references['zh-TW']));
  });

  it.each(CATALOG_LOCALES)('%s catalog is valid', (locale) => {
    const result = checkCatalog(locale, sources[locale], readCatalog(locale) ?? {});
    expect(result.errors).toEqual([]);
    expect(result.unknown).toEqual([]);
  });

  it('describes every catalog locale', () => {
    for (const locale of CATALOG_LOCALES) expect(LOCALE_INFO[locale].status).not.toBe('source');
  });
});

describe('catalog checks', () => {
  const source = { '{label} is required.': sourceEntry('{label} is required.', ['{label}是必填欄位。']), 'Saved.': sourceEntry('Saved.') };

  it('accepts translations that keep the slots', () => {
    expect(checkCatalog('es', source, { '{label} is required.': '{label} es obligatorio.', 'Saved.': 'Guardado.' })).toEqual({ errors: [], missing: [], unknown: [] });
  });

  it('rejects lost or invented slots, empty values, HTML and promises', () => {
    const { errors, missing, unknown } = checkCatalog('es', source, { '{label} is required.': 'Obligatorio {field}.', 'Saved.': ' ', Old: 'Viejo' });
    expect(errors).toHaveLength(2);
    expect(missing).toEqual(['Saved.']);
    expect(unknown).toEqual(['Old']);
    expect(checkCatalog('es', source, { 'Saved.': '<b>Guardado</b>' }).errors).toHaveLength(1);
    expect(checkCatalog('es', source, { 'Saved.': 'Guardado: garantiza el primer puesto.' }).errors).toHaveLength(1);
  });

  it('lets templates pick either source language\'s slots, except English articles', () => {
    const entry = sourceEntry('{name} is {aLabel}.', ['{name}是{label}。']);
    expect(entry).toEqual({ text: '{name} is {aLabel}.', required: ['name'], allowed: ['label', 'name'] });
    expect(checkCatalog('es', { k: entry }, { k: '{name} es un {label}.' }).errors).toEqual([]);
    expect(checkCatalog('es', { k: entry }, { k: '{name} es {aLabel}.' }).errors).toHaveLength(1);
  });
});

describe('translated output', () => {
  for (const locale of CATALOG_LOCALES) {
    const catalog = readCatalog(locale) as Catalog | undefined;
    if (catalog) registerCatalog(locale, catalog);
  }

  it.each(CATALOG_LOCALES)('fills every slot and keeps sentences non-empty (%s)', (locale) => {
    for (const template of TEMPLATES) {
      for (const data of sampleDocuments(template, 12)) {
        for (const issue of auditDocument(template, data).issues) expect(localize(issue.message, locale)).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
        for (const sentence of describeDocument(template, data, locale).sentences) {
          expect(sentence.trim().length).toBeGreaterThan(0);
          expect(sentence).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
        }
      }
    }
  });
});
