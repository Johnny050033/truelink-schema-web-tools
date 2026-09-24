import { t } from './formats.js';
import { cloneJson, defineValue, FORBIDDEN_KEYS, isJsonObject, typesOf } from './json.js';
import { LIMITS, utf8Bytes } from './limits.js';
import { templateForTypes } from './templates/index.js';
import type { JsonObject, JsonValue, LocalizedText, TemplateId } from './types.js';

export type JsonCheckCode = 'not_json' | 'too_deep' | 'too_many_nodes' | 'forbidden_key' | 'string_too_long' | 'too_large';

export interface JsonCheckOptions {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly maxStringLength?: number;
  readonly maxBytes?: number;
}

/**
 * Verifies that an untrusted value is plain JSON within the configured bounds
 * without invoking accessors, and without prototype-sensitive keys.
 */
export function checkJsonValue(value: unknown, options: JsonCheckOptions = {}): { ok: true } | { ok: false; code: JsonCheckCode } {
  const maxDepth = options.maxDepth ?? LIMITS.maxDepth;
  const maxNodes = options.maxNodes ?? LIMITS.maxNodes;
  const maxStringLength = options.maxStringLength ?? LIMITS.maxStringLength;
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  let nodes = 0;
  while (stack.length > 0) {
    const item = stack.pop()!;
    nodes += 1;
    if (nodes > maxNodes) return { ok: false, code: 'too_many_nodes' };
    if (item.depth > maxDepth) return { ok: false, code: 'too_deep' };
    const current = item.value;
    if (current === null || typeof current === 'boolean') continue;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) return { ok: false, code: 'not_json' };
      continue;
    }
    if (typeof current === 'string') {
      if (current.length > maxStringLength) return { ok: false, code: 'string_too_long' };
      continue;
    }
    if (Array.isArray(current)) {
      if (Object.getPrototypeOf(current) !== Array.prototype) return { ok: false, code: 'not_json' };
      for (let index = 0; index < current.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
        if (!descriptor || !('value' in descriptor)) return { ok: false, code: 'not_json' };
        stack.push({ value: descriptor.value, depth: item.depth + 1 });
      }
      continue;
    }
    if (!isJsonObject(current)) return { ok: false, code: 'not_json' };
    for (const key of Reflect.ownKeys(current)) {
      if (typeof key !== 'string') return { ok: false, code: 'not_json' };
      if (FORBIDDEN_KEYS.has(key)) return { ok: false, code: 'forbidden_key' };
      const descriptor = Object.getOwnPropertyDescriptor(current, key)!;
      if (!('value' in descriptor)) return { ok: false, code: 'not_json' };
      stack.push({ value: descriptor.value, depth: item.depth + 1 });
    }
  }
  if (options.maxBytes !== undefined && utf8Bytes(JSON.stringify(value)) > options.maxBytes) return { ok: false, code: 'too_large' };
  return { ok: true };
}

export interface ImportCandidate {
  readonly index: number;
  readonly node: JsonObject;
  readonly types: readonly string[];
  readonly templateId: TemplateId;
}

export type ImportIssueCode =
  | 'empty'
  | 'too_large'
  | 'invalid_json'
  | 'too_deep'
  | 'too_many_nodes'
  | 'forbidden_key'
  | 'string_too_long'
  | 'not_json'
  | 'no_nodes'
  | 'missing_type'
  | 'too_many_blocks'
  | 'document_too_large'
  | 'non_schema_context'
  | 'legacy_store';

export interface ImportIssue {
  readonly code: ImportIssueCode;
  readonly message: LocalizedText;
  readonly block?: number;
}

export interface ImportResult {
  readonly candidates: readonly ImportCandidate[];
  readonly issues: readonly ImportIssue[];
}

const messages: Record<ImportIssueCode, LocalizedText> = {
  empty: t('沒有可匯入的內容。', 'There is nothing to import.'),
  too_large: t(`內容超過 ${LIMITS.importBytes / 1024} KiB 上限，未匯入任何資料。`, `Input exceeds the ${LIMITS.importBytes / 1024} KiB limit; nothing was imported.`),
  invalid_json: t('不是有效的 JSON，請確認括號與引號是否完整。', 'This is not valid JSON; check brackets and quotes.'),
  too_deep: t(`巢狀層級超過 ${LIMITS.maxDepth} 層。`, `Nesting exceeds ${LIMITS.maxDepth} levels.`),
  too_many_nodes: t(`資料節點超過 ${LIMITS.maxNodes} 個。`, `More than ${LIMITS.maxNodes} values.`),
  forbidden_key: t('含有不允許的屬性名稱（__proto__、constructor 或 prototype）。', 'Contains a forbidden property name (__proto__, constructor or prototype).'),
  string_too_long: t(`單一文字值超過 ${LIMITS.maxStringLength} 個字元。`, `A string exceeds ${LIMITS.maxStringLength} characters.`),
  not_json: t('含有非 JSON 資料。', 'Contains non-JSON data.'),
  no_nodes: t('沒有找到 JSON-LD 物件。', 'No JSON-LD objects were found.'),
  missing_type: t('有物件缺少 @type，已略過。', 'An object without @type was skipped.'),
  too_many_blocks: t(`一次最多匯入 ${LIMITS.maxImportBlocks} 個項目，其餘未匯入。`, `At most ${LIMITS.maxImportBlocks} items are imported at once; the rest were skipped.`),
  document_too_large: t(`有項目超過單份文件 ${LIMITS.documentBytes / 1024} KiB 上限，已略過。`, `An item exceeds the ${LIMITS.documentBytes / 1024} KiB document limit and was skipped.`),
  non_schema_context: t('@context 不是 https://schema.org；資料會原樣保留，但請確認來源。', '@context is not https://schema.org; data is kept as-is, but check its origin.'),
  legacy_store: t(
    '已辨識為 TrueLink 網頁工具儲存的資料：主要實體與常見問答會分成兩份文件；網域白名單是部署設定，不會匯入。',
    'Recognised as data saved by the TrueLink web tool: the main entity and FAQ become separate documents; the domain whitelist is a deployment setting and is not imported.',
  ),
};

function importIssue(code: ImportIssueCode, block?: number): ImportIssue {
  return block === undefined ? { code, message: messages[code] } : { code, message: messages[code], block };
}

export function isSchemaOrgContext(context: JsonValue | undefined): boolean {
  if (context === undefined) return true;
  if (typeof context === 'string') return /^https?:\/\/schema\.org\/?$/.test(context.trim());
  if (Array.isArray(context)) return context.some((item) => typeof item === 'string' && isSchemaOrgContext(item));
  if (isJsonObject(context)) return typeof context['@vocab'] === 'string' && isSchemaOrgContext(context['@vocab']);
  return false;
}

function withContext(context: JsonValue | undefined, node: JsonObject): JsonObject {
  const copy: JsonObject = {};
  if (context !== undefined && node['@context'] === undefined) defineValue(copy, '@context', cloneJson(context));
  for (const [key, value] of Object.entries(node)) defineValue(copy, key, value);
  return copy;
}

/**
 * Recognises the object the TrueLink web tool saves, `{ mainSchema, faqs, type, whitelistedDomains }`,
 * and returns its JSON-LD nodes: the main entity and, when there are questions, an FAQPage.
 */
export function legacyStoreNodes(value: JsonValue): JsonObject[] | undefined {
  if (!isJsonObject(value) || value['@type'] !== undefined || value['@graph'] !== undefined) return undefined;
  const main = value['mainSchema'];
  if (!isJsonObject(main)) return undefined;
  const node = cloneJson(main);
  if (node['@type'] === undefined && typeof value['type'] === 'string' && value['type'].trim()) node['@type'] = value['type'].trim();
  const nodes = [node];
  const faqs = value['faqs'];
  if (Array.isArray(faqs) && faqs.length > 0 && faqs.every(isJsonObject)) {
    nodes.push({ '@context': node['@context'] ?? 'https://schema.org', '@type': 'FAQPage', mainEntity: cloneJson(faqs) });
  }
  return nodes;
}

function collectNodes(value: JsonValue, inherited: JsonValue | undefined, out: JsonObject[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, inherited, out);
    return;
  }
  if (!isJsonObject(value)) return;
  const context = value['@context'] ?? inherited;
  const graph = value['@graph'];
  if (Array.isArray(graph)) {
    for (const item of graph) collectNodes(item, context, out);
    return;
  }
  out.push(withContext(context, value));
}

/** Parses one or more JSON-LD texts (for example extracted script blocks) into import candidates. */
export function parseJsonLdTexts(texts: readonly string[]): ImportResult {
  const issues: ImportIssue[] = [];
  const nonEmpty = texts.map((text) => text.trim()).filter((text) => text.length > 0);
  if (nonEmpty.length === 0) return { candidates: [], issues: [importIssue('empty')] };
  const total = nonEmpty.reduce((sum, text) => sum + utf8Bytes(text), 0);
  if (total > LIMITS.importBytes) return { candidates: [], issues: [importIssue('too_large')] };

  const nodes: { node: JsonObject; block: number }[] = [];
  let legacyStore = false;
  nonEmpty.forEach((text, block) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      issues.push(importIssue('invalid_json', nonEmpty.length > 1 ? block : undefined));
      return;
    }
    const check = checkJsonValue(parsed);
    if (!check.ok) {
      issues.push(importIssue(check.code === 'too_large' ? 'document_too_large' : check.code, nonEmpty.length > 1 ? block : undefined));
      return;
    }
    const legacy = legacyStoreNodes(parsed as JsonValue);
    if (legacy) legacyStore = true;
    const collected: JsonObject[] = [];
    if (legacy) collected.push(...legacy);
    else collectNodes(parsed as JsonValue, undefined, collected);
    for (const node of collected) nodes.push({ node, block });
  });

  const candidates: ImportCandidate[] = [];
  let skippedType = false;
  let skippedSize = false;
  let foreignContext = false;
  for (const { node } of nodes) {
    const types = typesOf(node);
    if (types.length === 0) {
      skippedType = true;
      continue;
    }
    if (utf8Bytes(JSON.stringify(node)) > LIMITS.documentBytes) {
      skippedSize = true;
      continue;
    }
    if (candidates.length >= LIMITS.maxImportBlocks) {
      issues.push(importIssue('too_many_blocks'));
      break;
    }
    if (!isSchemaOrgContext(node['@context'])) foreignContext = true;
    candidates.push({ index: candidates.length, node, types, templateId: templateForTypes(types).id });
  }
  if (legacyStore && candidates.length > 0) issues.push(importIssue('legacy_store'));
  if (skippedType) issues.push(importIssue('missing_type'));
  if (skippedSize) issues.push(importIssue('document_too_large'));
  if (foreignContext) issues.push(importIssue('non_schema_context'));
  if (candidates.length === 0 && !issues.some((item) => item.code !== 'missing_type')) issues.push(importIssue('no_nodes'));
  return { candidates, issues };
}

export function parseJsonLdText(text: string): ImportResult {
  return parseJsonLdTexts([text]);
}
