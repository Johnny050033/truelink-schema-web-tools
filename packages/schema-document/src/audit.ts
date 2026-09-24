import {
  isCountryCode,
  isCurrencyCode,
  isEmail,
  isHttpUrl,
  isHttpsUrl,
  isIsoDate,
  isIsoDateTime,
  isLanguageTag,
  isLatitude,
  isLongitude,
  isNumberText,
  isPrice,
  isTelephone,
  isTime,
  lacksTimeZone,
  t,
} from './formats.js';
import { fmt } from './i18n.js';
import { issue } from './issues.js';
import { isJsonObject, isScalar } from './json.js';
import { buildOutput } from './output.js';
import { isSchemaOrgContext } from './parse.js';
import { dayOptions } from './templates/common.js';
import { isFieldVisible, templateFields } from './templates/index.js';
import type {
  AuditIssue,
  AuditResult,
  Grade,
  JsonObject,
  JsonValue,
  ListField,
  LocalizedText,
  MissingField,
  ScalarField,
  SchemaTemplate,
  Severity,
} from './types.js';

type Resolved = { state: 'missing' } | { state: 'blocked' } | { state: 'value'; value: JsonValue };

/** Distinguishes an absent value from one hidden behind an imported non-object structure. */
export function resolvePath(node: JsonObject, path: readonly string[]): Resolved {
  let current: JsonValue = node;
  for (const key of path) {
    if (!isJsonObject(current)) return { state: 'blocked' };
    if (!Object.hasOwn(current, key)) return { state: 'missing' };
    current = current[key]!;
  }
  return { state: 'value', value: current };
}

const DAY_VALUES = new Set(dayOptions.flatMap((option) => [option.value, `https://schema.org/${option.value}`, `http://schema.org/${option.value}`]));
const URL_KINDS = new Set(['url', 'id']);

interface Finding {
  readonly severity: Severity;
  readonly code: string;
  readonly message: LocalizedText;
  /** Whether the value still counts as a usable, filled field. */
  readonly counts: boolean;
}

function quote(label: LocalizedText): LocalizedText {
  return fmt('「{label}」', '"{label}"', { label });
}

/** A finding whose message is a template with `{label}` (the quoted field label) and optional slots. */
function finding(severity: Severity, code: string, counts: boolean, label: LocalizedText, zh: string, en: string, vars: Readonly<Record<string, string | number>> = {}): Finding {
  return { severity, code, counts, message: fmt(zh, en, { ...vars, label }) };
}

/** Validates one scalar according to its field kind. Returns undefined when it is fine. */
export function checkScalar(field: ScalarField, raw: string | number | boolean): Finding | undefined {
  const value = typeof raw === 'string' ? raw.trim() : String(raw);
  const label = quote(field.label);
  switch (field.kind) {
    case 'url':
      if (!isHttpUrl(value)) return finding('error', 'invalid_url', false, label, '{label}需要完整網址，例如 https://example.com。', '{label} needs a full URL such as https://example.com.');
      if (!isHttpsUrl(value)) return finding('info', 'insecure_url', true, label, '{label}建議使用 https:// 網址。', '{label} should use https://.');
      return undefined;
    case 'id':
      if (!isHttpUrl(value)) return finding('warning', 'id_not_absolute', true, label, '{label}建議使用完整網址，例如 https://example.com/#organization。', '{label} should be an absolute URL such as https://example.com/#organization.');
      return undefined;
    case 'email':
      return isEmail(value) ? undefined : finding('error', 'invalid_email', false, label, '{label}不是有效的電子郵件格式。', '{label} is not a valid email address.');
    case 'tel':
      if (!isTelephone(value)) return finding('error', 'invalid_tel', false, label, '{label}格式不正確，只能包含數字、空格、+、- 與括號。', '{label} may only contain digits, spaces, +, - and parentheses.');
      if (!value.startsWith('+')) return finding('info', 'phone_not_international', true, label, '{label}建議使用含國碼的格式，例如 +886-2-2345-6789。', '{label} works best in international format, e.g. +1-555-010-0199.');
      return undefined;
    case 'date':
      return isIsoDate(value) ? undefined : finding('error', 'invalid_date', false, label, '{label}請使用 YYYY-MM-DD（或 YYYY、YYYY-MM）格式。', '{label} must use YYYY-MM-DD (or YYYY, YYYY-MM).');
    case 'datetime':
      if (!isIsoDateTime(value)) return finding('error', 'invalid_datetime', false, label, '{label}請使用 ISO 8601 格式，例如 2026-10-01T19:00+08:00。', '{label} must be ISO 8601, e.g. 2026-10-01T19:00-05:00.');
      if (lacksTimeZone(value)) return finding('warning', 'missing_timezone', true, label, '{label}建議加上時區，例如 +08:00。', '{label} should include a time-zone offset such as -05:00.');
      return undefined;
    case 'time':
      return isTime(value) ? undefined : finding('error', 'invalid_time', false, label, '{label}請使用 24 小時制 HH:MM。', '{label} must use 24-hour HH:MM.');
    case 'number': {
      if (!isNumberText(value)) return finding('error', 'invalid_number', false, label, '{label}需要是數字。', '{label} must be a number.');
      const last = field.path[field.path.length - 1];
      if ((last === 'latitude' && !isLatitude(value)) || (last === 'longitude' && !isLongitude(value))) {
        return finding('error', 'out_of_range', false, label, '{label}超出有效範圍。', '{label} is out of range.');
      }
      return undefined;
    }
    case 'price':
      return isPrice(value) ? undefined : finding('error', 'invalid_price', false, label, '{label}只能包含數字與小數點，不要加幣別符號或逗號。', '{label} may only contain digits and a decimal point.');
    case 'currency':
      return isCurrencyCode(value) ? undefined : finding('error', 'invalid_currency', false, label, '{label}請使用三碼幣別代碼，例如 TWD。', '{label} must be a three-letter code such as USD.');
    case 'country':
      return isCountryCode(value) ? undefined : finding('warning', 'country_not_code', true, label, '{label}建議使用兩碼國家代碼，例如 TW。', '{label} should be a two-letter code such as US.');
    case 'language':
      return isLanguageTag(value) ? undefined : finding('warning', 'invalid_language', true, label, '{label}建議使用語言代碼，例如 zh-TW。', '{label} should be a language tag such as en or zh-TW.');
    case 'days':
      return DAY_VALUES.has(value) ? undefined : finding('error', 'invalid_day', false, label, '{label}含有無法辨識的星期「{value}」。', '{label} contains an unknown day "{value}".', { value });
    case 'select':
      if (field.options && !field.options.some((option) => option.value === value)) {
        return finding('info', 'custom_option', true, label, '{label}使用自訂值「{value}」，已保留但未驗證。', '{label} uses the custom value "{value}"; kept but not verified.', { value });
      }
      return undefined;
    case 'text':
    case 'textarea':
      if (field.maxLength !== undefined && [...value].length > field.maxLength) {
        return finding('warning', 'too_long', true, label, '{label}超過建議長度 {max} 字元。', '{label} is longer than the suggested {max} characters.', { max: field.maxLength });
      }
      return undefined;
    default:
      return undefined;
  }
}

/** URL-typed fields also accept objects such as ImageObject that carry a `url`. */
function scalarOf(field: ScalarField, value: JsonValue): string | number | boolean | undefined {
  if (isScalar(value)) return value;
  if (URL_KINDS.has(field.kind) && isJsonObject(value)) {
    const nested = value['url'] ?? value['@id'];
    if (typeof nested === 'string') return nested;
  }
  return undefined;
}

type FieldOutcome = 'filled' | 'empty' | 'invalid' | 'unknown';

function evaluateScalar(field: ScalarField, node: JsonObject, basePath: readonly (string | number)[], prefix: LocalizedText | undefined, issues: AuditIssue[]): FieldOutcome {
  const resolved = resolvePath(node, field.path);
  if (resolved.state === 'blocked') return 'unknown';
  if (resolved.state === 'missing') return 'empty';
  const values = field.multiple && Array.isArray(resolved.value) ? resolved.value : [resolved.value];
  if (!field.multiple && Array.isArray(resolved.value)) return pushComplex(field, basePath, issues);
  let invalid = false;
  let counted = 0;
  values.forEach((item, index) => {
    const scalar = scalarOf(field, item);
    if (scalar === undefined) {
      invalid = true;
      return;
    }
    const result = checkScalar(field, scalar);
    const path = [...basePath, ...field.path, ...(field.multiple && Array.isArray(resolved.value) ? [index] : [])];
    if (result) {
      const message = prefix ? fmt('{prefix}{message}', '{prefix}{message}', { prefix, message: result.message }) : result.message;
      issues.push(issue(result.severity, result.code, message, { fieldId: field.id, path }));
    }
    if (!result || result.counts) counted += 1;
    else invalid = true;
  });
  if (invalid && counted === 0 && values.every((item) => scalarOf(field, item) === undefined)) return pushComplex(field, basePath, issues);
  if (invalid) return 'invalid';
  return counted > 0 ? 'filled' : 'empty';
}

function pushComplex(field: ScalarField, basePath: readonly (string | number)[], issues: AuditIssue[]): FieldOutcome {
  const label = quote(field.label);
  issues.push(issue('info', 'complex_value', fmt('{label}使用進階結構，已保留但未逐項檢查。', '{label} uses an advanced structure; kept but not checked.', { label }), { fieldId: field.id, path: [...basePath, ...field.path] }));
  return 'unknown';
}

function evaluateList(field: ListField, node: JsonObject, issues: AuditIssue[]): FieldOutcome {
  const resolved = resolvePath(node, field.path);
  if (resolved.state === 'blocked') return 'unknown';
  if (resolved.state === 'missing') return 'empty';
  const items = Array.isArray(resolved.value) ? resolved.value : [resolved.value];
  const objects = items.filter(isJsonObject);
  if (objects.length === 0) return 'unknown';
  let broken = false;
  items.forEach((item, index) => {
    if (!isJsonObject(item)) return;
    const prefix = fmt('第 {n} 個{item}：', '{item} {n}: ', { n: index + 1, item: field.itemLabel });
    for (const child of field.fields) {
      if (!isFieldVisible(child, item)) continue;
      const outcome = evaluateScalar(child, item, [...field.path, index], prefix, issues);
      if (outcome === 'invalid') broken = true;
      if (outcome === 'empty' && child.importance === 'required') {
        broken = true;
        const label = quote(child.label);
        issues.push(issue('error', 'missing_item_field', fmt('{prefix}缺少{label}。', '{prefix}{label} is missing.', { prefix, label }), { fieldId: field.id, path: [...field.path, index, ...child.path] }));
      }
    }
  });
  const minimum = field.minItems ?? 1;
  if (objects.length < minimum) {
    const label = quote(field.label);
    const message = minimum === 1
      ? fmt('{label}至少需要 {min} 項。', '{label} needs at least {min} item.', { label, min: minimum })
      : fmt('{label}至少需要 {min} 項。', '{label} needs at least {min} items.', { label, min: minimum });
    issues.push(issue('warning', 'too_few_items', message, { fieldId: field.id, path: [...field.path] }));
    return 'invalid';
  }
  return broken ? 'invalid' : 'filled';
}

const WEIGHTS = { required: 3, recommended: 1, optional: 0 } as const;

export function gradeFor(score: number): Grade {
  if (score >= 80) return 'excellent';
  if (score >= 50) return 'good';
  return 'needs-work';
}

/**
 * Advisory completeness check of the exported node. The score measures how many
 * known required/recommended fields are present and well-formed — it is not a
 * search-engine eligibility verdict, ranking signal or AI-citation guarantee.
 */
export function auditDocument(template: SchemaTemplate, data: JsonObject): AuditResult {
  const node = buildOutput(data, template);
  const issues: AuditIssue[] = [];
  const missing: MissingField[] = [];
  const required = { filled: 0, total: 0 };
  const recommended = { filled: 0, total: 0 };
  let unknown = 0;
  let requiredBroken = false;
  let earned = 0;
  let possible = 0;

  for (const { field, section } of templateFields(template)) {
    // Visibility follows the editor's data: an explicit type choice counts even
    // before the node has any other property (and would be pruned from output).
    if (!isFieldVisible(field, data)) continue;
    const outcome = field.kind === 'list' ? evaluateList(field, node, issues) : evaluateScalar(field, node, [], undefined, issues);
    if (field.importance === 'optional') continue;
    if (outcome === 'unknown') {
      unknown += 1;
      continue;
    }
    const bucket = field.importance === 'required' ? required : recommended;
    bucket.total += 1;
    possible += WEIGHTS[field.importance];
    if (outcome === 'filled') {
      bucket.filled += 1;
      earned += WEIGHTS[field.importance];
      continue;
    }
    if (field.importance === 'required') requiredBroken = true;
    if (outcome === 'empty') {
      missing.push({ fieldId: field.id, sectionId: section.id, label: field.label, importance: field.importance, ...(field.why ? { why: field.why } : {}) });
      const label = quote(field.label);
      if (field.importance === 'required') {
        issues.push(issue('error', 'missing_required', fmt('{label}是必填欄位。', '{label} is required.', { label }), { fieldId: field.id, path: [...field.path] }));
      } else {
        const why = field.why;
        const message = why
          ? fmt('建議填寫{label}。{why}', 'Consider adding {label}. {why}', { label, why })
          : fmt('建議填寫{label}。', 'Consider adding {label}.', { label });
        issues.push(issue('warning', 'missing_recommended', message, { fieldId: field.id, path: [...field.path] }));
      }
    }
  }

  const known = new Set(templateFields(template).map(({ field }) => field.path[0]));
  const extra = Object.keys(node).filter((key) => !key.startsWith('@') && !known.has(key));
  if (extra.length > 0) {
    const names = extra.slice(0, 12).join(', ') + (extra.length > 12 ? ' …' : '');
    issues.push(issue('info', 'unverified_properties', fmt('以下屬性不在範本中，已原樣保留但未驗證：{names}。', 'These properties are outside the template and kept as-is without verification: {names}.', { names })));
  }
  if (!isSchemaOrgContext(node['@context'])) {
    issues.push(issue('warning', 'non_schema_context', t('@context 建議使用 https://schema.org。', 'Use https://schema.org as @context.'), { path: ['@context'] }));
  }
  if (template.checks) issues.push(...template.checks(node));

  let score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  if (requiredBroken) score = Math.min(score, 49);
  const order: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return {
    score,
    grade: gradeFor(score),
    issues,
    errors: issues.filter((item) => item.severity === 'error').length,
    warnings: issues.filter((item) => item.severity === 'warning').length,
    infos: issues.filter((item) => item.severity === 'info').length,
    required,
    recommended,
    missing,
    unknown,
  };
}
