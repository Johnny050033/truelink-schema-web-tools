import { isHttpUrl, t } from './formats.js';
import { getAt, textsOf } from './json.js';
import type { AuditIssue, JsonObject, LocalizedText, Severity } from './types.js';

export function issue(
  severity: Severity,
  code: string,
  message: LocalizedText,
  extra: { fieldId?: string; path?: readonly (string | number)[] } = {},
): AuditIssue {
  return { severity, code, message, ...extra };
}

/** Advisory checks shared by entity templates that publish `sameAs` profiles. */
export function profileChecks(node: JsonObject): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const links = textsOf(getAt(node, ['sameAs']));
  const normalized = links.map((link) => link.replace(/\/+$/, '').toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    issues.push(issue('warning', 'duplicate_profile', t('官方連結中有重複的網址。', 'The profile list contains duplicate URLs.'), { fieldId: 'sameAs', path: ['sameAs'] }));
  }
  const valid = links.filter((link) => isHttpUrl(link));
  if (valid.length > 0 && valid.length < 2) {
    issues.push(issue('info', 'few_profiles', t('建議至少提供 2 個官方社群或權威網站連結，方便交叉確認品牌身分。', 'Add at least two official profiles so engines can cross-check your identity.'), { fieldId: 'sameAs', path: ['sameAs'] }));
  }
  const own = getAt(node, ['url']);
  if (typeof own === 'string' && normalized.includes(own.replace(/\/+$/, '').toLowerCase())) {
    issues.push(issue('info', 'self_profile', t('sameAs 通常放「其他平台」的官方頁面，不需要重複官網網址。', 'sameAs usually lists other platforms; your own URL is already in "url".'), { fieldId: 'sameAs', path: ['sameAs'] }));
  }
  return issues;
}

/** Comparable timestamp for ISO values; missing zones are treated as the same wall clock. */
export function comparableTime(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const hasZone = /(Z|[+-]\d{2}:\d{2})$/.test(value);
  const text = /T\d{2}:\d{2}/.test(value) ? (hasZone ? value : `${value}Z`) : `${value.slice(0, 10)}T00:00:00Z`;
  const time = Date.parse(text);
  return Number.isFinite(time) ? time : undefined;
}
