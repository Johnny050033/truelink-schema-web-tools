import { defineValue, FORBIDDEN_KEYS, isJsonObject } from './json.js';
import type { JsonObject, JsonValue, SchemaTemplate } from './types.js';

export const SCHEMA_CONTEXT = 'https://schema.org';

/**
 * Removes empty strings, empty arrays and nested objects that carry nothing but
 * an `@type`, and trims strings. Other values (including unknown properties) are kept.
 */
export function pruneValue(value: JsonValue): JsonValue | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (Array.isArray(value)) {
    const items = value.map(pruneValue).filter((item): item is JsonValue => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (isJsonObject(value)) {
    const pruned = pruneEntries(value);
    return Object.keys(pruned).some((key) => key !== '@type') ? pruned : undefined;
  }
  return value;
}

function pruneEntries(node: JsonObject): JsonObject {
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(node)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const pruned = pruneValue(value);
    if (pruned !== undefined) defineValue(out, key, pruned);
  }
  return out;
}

/** The exact node that export, preview and audit use: pruned, `@context` first. */
export function buildOutput(data: JsonObject, template?: SchemaTemplate): JsonObject {
  const pruned = pruneEntries(data);
  const out: JsonObject = {};
  defineValue(out, '@context', pruned['@context'] ?? SCHEMA_CONTEXT);
  if (pruned['@type'] !== undefined) defineValue(out, '@type', pruned['@type']);
  if (pruned['@id'] !== undefined) defineValue(out, '@id', pruned['@id']);
  for (const [key, value] of Object.entries(pruned)) {
    if (key !== '@context' && key !== '@type' && key !== '@id') defineValue(out, key, value);
  }
  return template?.finalize ? template.finalize(out) : out;
}

/** Combines several nodes into one `@graph` document with a single context. */
export function combineGraph(nodes: readonly JsonObject[]): JsonObject {
  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': nodes.map((node) => {
      const copy: JsonObject = {};
      for (const [key, value] of Object.entries(node)) if (key !== '@context') defineValue(copy, key, value);
      return copy;
    }),
  };
}

/**
 * JSON text safe to place inside an HTML `<script>` element: `<`, `>` and `&`
 * (plus U+2028/2029) are escaped, so no string value can close the script tag.
 */
export function toJsonLdJson(value: JsonValue, indent = 2): string {
  return JSON.stringify(value, null, indent).replace(/[<>&\u2028\u2029]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function toJsonLdScript(value: JsonValue, indent = 2): string {
  return `<script type="application/ld+json">\n${toJsonLdJson(value, indent)}\n</script>`;
}
