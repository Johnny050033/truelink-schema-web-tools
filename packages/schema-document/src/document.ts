import { canWriteAt, cloneJson, copyObject, defineValue, getAt, isJsonObject, isScalar, setAt, textOf } from './json.js';
import { SCHEMA_CONTEXT } from './output.js';
import { getTemplate } from './templates/index.js';
import type { JsonObject, JsonValue, ListField, Locale, ScalarField, SchemaTemplate, TemplateId } from './types.js';

/**
 * Starter JSON-LD for a template. When a brand profile is supplied, its values are
 * copied (never referenced) into the fields listed in the template's `brandFill`.
 */
export function createDocumentData(templateId: TemplateId, options: { locale: Locale; brand?: JsonObject } ): JsonObject {
  const template = getTemplate(templateId);
  const brand = options.brand && Object.keys(options.brand).some((key) => !key.startsWith('@')) ? options.brand : undefined;
  if (templateId === 'organization' && brand) {
    const copy = cloneJson(brand);
    const node: JsonObject = { '@context': SCHEMA_CONTEXT };
    for (const [key, value] of Object.entries(copy)) if (key !== '@context') defineValue(node, key, value);
    if (node['@type'] === undefined) defineValue(node, '@type', template.type);
    return node;
  }
  let node: JsonObject = { '@context': SCHEMA_CONTEXT, '@type': template.type };
  if (template.starter) {
    for (const [key, value] of Object.entries(template.starter(options.locale, brand))) defineValue(node, key, cloneJson(value));
  }
  if (brand && template.brandFill) {
    for (const fill of template.brandFill) {
      const value = getAt(brand, fill.from);
      if (value === undefined || getAt(node, fill.to) !== undefined || !canWriteAt(node, fill.to)) continue;
      node = setAt(node, fill.to, cloneJson(value), template.nodeTypes);
    }
  }
  return node;
}

export function displayName(template: SchemaTemplate, node: JsonObject): string | undefined {
  for (const path of template.titlePaths) {
    const value = textOf(getAt(node, path));
    if (value) return value;
  }
  if (template.id === 'faq') {
    const first = getAt(node, ['mainEntity']);
    const item = Array.isArray(first) ? first[0] : first;
    if (isJsonObject(item)) return textOf(item['name']);
  }
  if (template.id === 'breadcrumb') {
    const items = getAt(node, ['itemListElement']);
    if (Array.isArray(items)) {
      const names = items.map((item) => (isJsonObject(item) ? textOf(item['name']) : undefined)).filter(Boolean);
      if (names.length > 0) return names.join(' › ');
    }
  }
  return undefined;
}

export type FieldValueState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'value'; readonly values: readonly string[] }
  | { readonly kind: 'complex'; readonly value: JsonValue };

/** Describes a field's current value for form rendering without losing data. */
export function readField(node: JsonObject, field: ScalarField): FieldValueState {
  if (!canWriteAt(node, field.path)) return { kind: 'complex', value: getAt(node, field.path.slice(0, 1)) ?? null };
  const value = getAt(node, field.path);
  if (value === undefined) return { kind: 'empty' };
  if (field.multiple) {
    const items = Array.isArray(value) ? value : [value];
    if (items.every(isScalar)) return { kind: 'value', values: items.map((item) => String(item)) };
    return { kind: 'complex', value };
  }
  if (isScalar(value)) return { kind: 'value', values: [String(value)] };
  return { kind: 'complex', value };
}

/** Writes a form value; an empty string or empty list removes the property. */
export function writeField(node: JsonObject, field: ScalarField, value: string | readonly string[], nodeTypes: Readonly<Record<string, string>>): JsonObject {
  const next: JsonValue | undefined = Array.isArray(value) ? [...value] : (value as string);
  let updated = setAt(node, field.path, next, nodeTypes);
  const filled = Array.isArray(value) ? value.some((item) => item.trim() !== '') : String(value).trim() !== '';
  if (filled && field.companion && getAt(updated, field.companion.path) === undefined && canWriteAt(updated, field.companion.path)) {
    updated = setAt(updated, field.companion.path, field.companion.value, nodeTypes);
  }
  return updated;
}

export function readList(node: JsonObject, field: ListField): { readonly kind: 'items'; readonly items: readonly JsonObject[] } | { readonly kind: 'complex' } {
  if (!canWriteAt(node, field.path)) return { kind: 'complex' };
  const value = getAt(node, field.path);
  if (value === undefined) return { kind: 'items', items: [] };
  const items = Array.isArray(value) ? value : [value];
  if (!items.every(isJsonObject)) return { kind: 'complex' };
  return { kind: 'items', items: items as JsonObject[] };
}

export function writeList(node: JsonObject, field: ListField, items: readonly JsonObject[], nodeTypes: Readonly<Record<string, string>>): JsonObject {
  return setAt(node, field.path, items.length > 0 ? items.map((item) => copyObject(item)) : undefined, nodeTypes);
}

export function newListItem(field: ListField): JsonObject {
  return { '@type': field.itemType };
}
