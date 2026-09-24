import { createDocumentData, type JsonObject, type ScalarField, type SchemaTemplate, type TemplateField } from '../src/index.js';

/** Valid, invalid and edge-case values per field kind, so audits and descriptions take many paths. */
const SAMPLES: Readonly<Record<string, readonly unknown[]>> = {
  text: ['Morning Light Demo', '晨光示範', '  ', 'a'.repeat(300), 42],
  textarea: ['A long description of the business.', '短'],
  url: ['https://example.com/a', 'http://example.com', 'example.com/x', 'https://www.facebook.com/demo', 'https://www.linkedin.com/company/demo'],
  id: ['https://example.com/#org', '#org'],
  email: ['hi@example.com', 'bad@'],
  tel: ['+886-2-2345-6789', '(02) 2345-6789', 'abc'],
  date: ['2026-10-01', '2026-13-40', '2026', '2026-05'],
  datetime: ['2026-10-01T19:00', '2026-10-01T19:00:00+08:00', '2026-10-01', 'tomorrow'],
  time: ['09:00', '25:00'],
  number: [3, '4.5', 'x', -1],
  price: ['100', '1,000', '0'],
  currency: ['TWD', 'USD', 'XXXX'],
  country: ['TW', 'US', 'ZZZ'],
  language: ['zh-TW', 'en', 'es', 'not a tag!'],
  days: [['Monday', 'Tuesday', 'Wednesday'], ['Saturday'], 'Sunday', ['Funday']],
  taxId: ['12345675', '12345678'],
};

function sample(field: ScalarField, pick: number): unknown {
  if (field.kind === 'select') {
    const options = field.options ?? [];
    return pick % 5 === 4 || options.length === 0 ? 'CustomValue' : options[pick % options.length]!.value;
  }
  const pool = SAMPLES[field.kind] ?? ['sample'];
  const value = pool[pick % pool.length];
  if (field.multiple && !Array.isArray(value)) return pick % 3 === 0 ? [value, pool[(pick + 1) % pool.length]] : [value];
  return value;
}

function setPath(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let node = target;
  for (const key of path.slice(0, -1)) node = (node[key] ??= {}) as Record<string, unknown>;
  node[path[path.length - 1]!] = value;
}

function fill(template: SchemaTemplate, pick: number, density: number): JsonObject {
  const data = createDocumentData(template.id, { locale: 'en' }) as Record<string, unknown>;
  let index = 0;
  const fields: TemplateField[] = template.sections.flatMap((section) => [...section.fields]);
  for (const field of fields) {
    index++;
    if ((index * 7 + pick * 3) % 10 >= density) continue;
    if (field.kind === 'list') {
      const items = Array.from({ length: (pick + index) % 4 }, (_, n) => {
        const item: Record<string, unknown> = { '@type': field.itemType };
        field.fields.forEach((sub, k) => {
          if ((k + n + pick) % 3 !== 0) setPath(item, sub.path, sample(sub, pick + n + k));
        });
        return item;
      });
      setPath(data, field.path, items);
    } else setPath(data, field.path, sample(field, pick + index));
  }
  return data as JsonObject;
}

/** Deterministic documents covering empty, sparse, dense and invalid input for a template. */
export function sampleDocuments(template: SchemaTemplate, count = 24): JsonObject[] {
  const documents: JsonObject[] = [createDocumentData(template.id, { locale: 'en' })];
  for (let pick = 0; pick < count; pick++) for (const density of [3, 6, 10]) documents.push(fill(template, pick, density));
  return documents;
}
