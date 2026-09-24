/**
 * Proves the catalogs can translate everything the core shows: with a marker "translation" for
 * every extracted source text, every string produced for a catalog locale must come from the
 * catalog. A string built some other way (and so missing from the catalogs) fails here.
 */
import { describe, expect, it } from 'vitest';
import { coreSources, extract } from '../scripts/i18n.mjs';
import {
  auditDocument,
  describeDocument,
  localize,
  PLATFORMS,
  registerCatalog,
  templateFields,
  TEMPLATES,
  type Locale,
  type LocalizedText,
  type TemplateField,
} from '../src/index.js';
import { sampleDocuments } from './sample-documents.js';

const { entries, problems } = extract();
const sources = coreSources(entries);
const LOCALES_UNDER_TEST = ['es', 'zh-CN'] as const satisfies readonly Locale[];
for (const locale of LOCALES_UNDER_TEST) registerCatalog(locale, Object.fromEntries(Object.keys(sources[locale]).map((key) => [key, `⟦${key}⟧`])));

const neutral = (text: LocalizedText) => text['zh-TW'] === text.en;
const fromCatalog = (value: string) => value.startsWith('⟦') && value.endsWith('⟧');

function fieldTexts(field: TemplateField): LocalizedText[] {
  const own = [field.label, field.help, 'placeholder' in field ? field.placeholder : undefined, field.why].filter((item): item is LocalizedText => item !== undefined);
  if (field.kind === 'list') return [...own, field.itemLabel, field.addLabel, ...field.fields.flatMap(fieldTexts)];
  return [...own, ...(field.options ?? []).map((option) => option.label)];
}

describe('catalog coverage', () => {
  it('finds no text built outside the catalog helpers', () => {
    expect(problems).toEqual([]);
  });

  it.each(LOCALES_UNDER_TEST)('translates all template copy (%s)', (locale) => {
    for (const template of TEMPLATES) {
      const copy = [
        template.name,
        template.summary,
        ...(template.richResult ? [template.richResult] : []),
        ...template.sections.flatMap((section) => [section.title, ...(section.description ? [section.description] : [])]),
        ...templateFields(template).flatMap(({ field }) => fieldTexts(field)),
        ...(template.learnMore ?? []).map((link) => link.label),
      ];
      for (const text of copy) if (!neutral(text)) expect(localize(text, locale), `${template.id}: ${text.en}`).toSatisfy(fromCatalog);
    }
    for (const platform of PLATFORMS) if (!neutral(platform.label)) expect(localize(platform.label, locale)).toSatisfy(fromCatalog);
  });

  it.each(LOCALES_UNDER_TEST)('translates every audit message and description sentence (%s)', (locale) => {
    let checked = 0;
    for (const template of TEMPLATES) {
      for (const data of sampleDocuments(template)) {
        const audit = auditDocument(template, data);
        for (const issue of audit.issues) {
          expect(localize(issue.message, locale), `${template.id} ${issue.code}: ${issue.message.en}`).toSatisfy(fromCatalog);
          checked++;
        }
        for (const gap of audit.missing) {
          expect(localize(gap.label, locale)).toSatisfy(fromCatalog);
          if (gap.why) expect(localize(gap.why, locale)).toSatisfy(fromCatalog);
        }
        const description = describeDocument(template, data, locale);
        for (const sentence of description.sentences) {
          expect(sentence.trim().startsWith('⟦'), `${template.id}: ${sentence}`).toBe(true);
          checked++;
        }
        for (const fact of description.facts) expect(fact.label, `${template.id}: ${fact.fieldId}`).toSatisfy(fromCatalog);
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});
