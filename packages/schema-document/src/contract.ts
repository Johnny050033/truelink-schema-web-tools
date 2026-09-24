/**
 * The shared document contract between TrueLink surfaces: Schema Studio (local-first PWA),
 * the TrueLink web tool (tools/schema) and any future client (extension, plugin, CLI).
 *
 * - `SchemaDocumentRecord` is the portable unit a client may send to or receive from a host.
 *   It carries only client-authored content. Owner, server revision, timestamps, official
 *   score and publication state are server-managed and never part of a record.
 * - `LegacyStoreObj` is the object the TrueLink web tool already saves (`schemas/{uid}`):
 *   one main entity (`mainSchema`), optional FAQ questions, the entity type and the domain
 *   whitelist of the hosted script. The converters below map between the two without
 *   inventing data, so both surfaces can read and write the same stored schema.
 */
import { cloneJson, isJsonObject, typesOf } from './json.js';
import { LIMITS, utf8Bytes } from './limits.js';
import { buildOutput, SCHEMA_CONTEXT } from './output.js';
import { checkJsonValue, type JsonCheckCode } from './parse.js';
import { getTemplate, isTemplateId, templateForTypes } from './templates/index.js';
import type { JsonObject, JsonValue, TemplateId } from './types.js';

export const RECORD_FORMAT = 'truelink.schema-document';
export const RECORD_VERSION = 1;

/** Record IDs double as storage document IDs: letters, digits, `_` and `-` only. */
export const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
export const RECORD_TITLE_MAX = 120;

export interface SchemaDocumentRecord {
  readonly format: typeof RECORD_FORMAT;
  readonly version: typeof RECORD_VERSION;
  /** Stable client-generated ID, kept across devices and surfaces. */
  readonly id: string;
  /** Optional user title; empty means "derive from the data". */
  readonly title: string;
  readonly templateId: TemplateId;
  /** One JSON-LD node (no `@graph`), unpruned so partially filled forms survive a round trip. */
  readonly data: JsonObject;
  /** Client clock at the last edit (ms). Informational; hosts keep their own timestamps. */
  readonly updatedAt: number;
}

export type RecordErrorCode =
  | 'not_object'
  | 'unknown_field'
  | 'unsupported_format'
  | 'unsupported_version'
  | 'invalid_id'
  | 'invalid_title'
  | 'invalid_template'
  | 'invalid_data'
  | 'graph_not_allowed'
  | 'invalid_timestamp'
  | JsonCheckCode;

export type RecordResult = { readonly ok: true; readonly record: SchemaDocumentRecord } | { readonly ok: false; readonly code: RecordErrorCode };

const RECORD_KEYS: ReadonlySet<string> = new Set(['format', 'version', 'id', 'title', 'templateId', 'data', 'updatedAt']);

function codePoints(text: string): number {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

/** Strictly validates an untrusted value (from a host, file or message) as a record. */
export function parseRecord(value: unknown): RecordResult {
  if (!isJsonObject(value)) return { ok: false, code: 'not_object' };
  // Plain data only: rejects accessors, prototype-sensitive keys and oversized input before any field is read.
  const envelope = checkJsonValue(value, { maxDepth: LIMITS.maxDepth + 1, maxNodes: LIMITS.maxNodes + 16, maxBytes: LIMITS.documentBytes + 1024 });
  if (!envelope.ok) return { ok: false, code: envelope.code };
  for (const key of Object.keys(value)) if (!RECORD_KEYS.has(key)) return { ok: false, code: 'unknown_field' };
  if (value['format'] !== RECORD_FORMAT) return { ok: false, code: 'unsupported_format' };
  if (value['version'] !== RECORD_VERSION) return { ok: false, code: 'unsupported_version' };
  const { id, title, templateId, data, updatedAt } = value;
  if (typeof id !== 'string' || !RECORD_ID_PATTERN.test(id)) return { ok: false, code: 'invalid_id' };
  if (typeof title !== 'string' || codePoints(title) > RECORD_TITLE_MAX) return { ok: false, code: 'invalid_title' };
  if (typeof templateId !== 'string' || !isTemplateId(templateId)) return { ok: false, code: 'invalid_template' };
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt < 0) return { ok: false, code: 'invalid_timestamp' };
  if (!isJsonObject(data)) return { ok: false, code: 'invalid_data' };
  const check = checkJsonValue(data, { maxBytes: LIMITS.documentBytes });
  if (!check.ok) return { ok: false, code: check.code };
  if (Object.hasOwn(data, '@graph')) return { ok: false, code: 'graph_not_allowed' };
  return {
    ok: true,
    record: { format: RECORD_FORMAT, version: RECORD_VERSION, id, title, templateId, data: cloneJson(data), updatedAt },
  };
}

/** Builds a validated record from a client's document fields. */
export function createRecord(fields: { id: string; title: string; templateId: TemplateId; data: JsonObject; updatedAt: number }): RecordResult {
  return parseRecord({ format: RECORD_FORMAT, version: RECORD_VERSION, ...fields });
}

// ---------------------------------------------------------------------------
// TrueLink web tool (tools/schema) stored object
// ---------------------------------------------------------------------------

export interface LegacyStoreObj {
  readonly mainSchema: JsonObject;
  readonly faqs: JsonObject[];
  readonly type: string;
  readonly whitelistedDomains: string;
}

/** Bounds the TrueLink backend enforces when it accepts a stored object. */
export const LEGACY_LIMITS = Object.freeze({
  maxBytes: 500 * 1024,
  maxFaqs: 100,
  maxTypeLength: 80,
  maxWhitelistLength: 4000,
});

/** Templates that can be the one main entity of a TrueLink hosted schema. */
export const LEGACY_MAIN_TEMPLATES: readonly TemplateId[] = ['organization', 'local-business', 'person'];

export type LegacyErrorCode =
  | 'not_object'
  | 'missing_main_schema'
  | 'invalid_faqs'
  | 'too_many_faqs'
  | 'unsupported_template'
  | 'not_faq'
  | 'missing_type'
  | 'whitelist_too_long'
  | 'too_large'
  | RecordErrorCode;

export type LegacyImportResult =
  | {
      readonly ok: true;
      readonly main: SchemaDocumentRecord;
      readonly faq: SchemaDocumentRecord | undefined;
      readonly whitelistedDomains: string[];
    }
  | { readonly ok: false; readonly code: LegacyErrorCode };

export type LegacyExportResult = { readonly ok: true; readonly storeObj: LegacyStoreObj } | { readonly ok: false; readonly code: LegacyErrorCode };

/** Splits the web tool's free-text domain whitelist into distinct lowercase entries. */
export function parseDomainList(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,，、;；]+/)) {
    const domain = part.trim().toLowerCase();
    if (domain) seen.add(domain);
  }
  return [...seen];
}

function isQuestionList(value: JsonValue | undefined): value is JsonObject[] {
  return Array.isArray(value) && value.every(isJsonObject);
}

/**
 * Reads a stored object from the TrueLink web tool into records: the main entity, plus an
 * FAQPage record when it has questions. Content is copied as-is (no fields are invented).
 */
export function fromLegacyStoreObj(value: unknown, options: { readonly now: number; readonly makeId: () => string }): LegacyImportResult {
  if (!isJsonObject(value)) return { ok: false, code: 'not_object' };
  const check = checkJsonValue(value, { maxBytes: LEGACY_LIMITS.maxBytes, maxNodes: 20_000 });
  if (!check.ok) return { ok: false, code: check.code };
  const mainSchema = value['mainSchema'];
  if (!isJsonObject(mainSchema)) return { ok: false, code: 'missing_main_schema' };
  const faqs = value['faqs'] ?? [];
  if (!isQuestionList(faqs)) return { ok: false, code: 'invalid_faqs' };
  if (faqs.length > LEGACY_LIMITS.maxFaqs) return { ok: false, code: 'too_many_faqs' };

  const data = cloneJson(mainSchema);
  const storedType = typeof value['type'] === 'string' ? value['type'].trim() : '';
  if (typesOf(data).length === 0 && storedType) data['@type'] = storedType;
  const types = typesOf(data);
  if (types.length === 0) return { ok: false, code: 'missing_type' };
  const template = templateForTypes(types);
  const main = createRecord({ id: options.makeId(), title: '', templateId: template.id, data, updatedAt: options.now });
  if (!main.ok) return main;

  let faq: SchemaDocumentRecord | undefined;
  if (faqs.length > 0) {
    const result = createRecord({
      id: options.makeId(),
      title: '',
      templateId: 'faq',
      data: { '@context': SCHEMA_CONTEXT, '@type': 'FAQPage', mainEntity: cloneJson(faqs) },
      updatedAt: options.now,
    });
    if (!result.ok) return result;
    faq = result.record;
  }
  const whitelist = typeof value['whitelistedDomains'] === 'string' ? value['whitelistedDomains'] : '';
  return { ok: true, main: main.record, faq, whitelistedDomains: parseDomainList(whitelist) };
}

/**
 * Produces the object the TrueLink web tool stores and publishes, from a main-entity record
 * and an optional FAQ record. Output is the same pruned node the Studio exports.
 */
export function toLegacyStoreObj(
  main: SchemaDocumentRecord,
  options: { readonly faq?: SchemaDocumentRecord | undefined; readonly whitelistedDomains?: readonly string[] | string | undefined } = {},
): LegacyExportResult {
  if (!LEGACY_MAIN_TEMPLATES.includes(main.templateId)) return { ok: false, code: 'unsupported_template' };
  const mainSchema = buildOutput(main.data, getTemplate(main.templateId));
  const type = typesOf(mainSchema)[0];
  if (!type) return { ok: false, code: 'missing_type' };

  let faqs: JsonObject[] = [];
  if (options.faq) {
    if (options.faq.templateId !== 'faq') return { ok: false, code: 'not_faq' };
    const entity = buildOutput(options.faq.data, getTemplate('faq'))['mainEntity'];
    const list = entity === undefined ? [] : Array.isArray(entity) ? entity : [entity];
    if (!isQuestionList(list)) return { ok: false, code: 'invalid_faqs' };
    if (list.length > LEGACY_LIMITS.maxFaqs) return { ok: false, code: 'too_many_faqs' };
    faqs = list.map((question) => {
      const copy = cloneJson(question);
      delete copy['@context'];
      return copy;
    });
  }

  const domains = options.whitelistedDomains ?? '';
  const whitelistedDomains = typeof domains === 'string' ? parseDomainList(domains).join(', ') : parseDomainList(domains.join(',')).join(', ');
  if (whitelistedDomains.length > LEGACY_LIMITS.maxWhitelistLength) return { ok: false, code: 'whitelist_too_long' };

  const storeObj: LegacyStoreObj = { mainSchema, faqs, type: type.slice(0, LEGACY_LIMITS.maxTypeLength), whitelistedDomains };
  if (utf8Bytes(JSON.stringify(storeObj)) > LEGACY_LIMITS.maxBytes) return { ok: false, code: 'too_large' };
  return { ok: true, storeObj };
}
