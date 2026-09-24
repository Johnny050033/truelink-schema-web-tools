import { auditDocument, buildOutput, displayName, getTemplate, toJsonLdScript, type AuditResult, type JsonObject, type Locale } from 'truelink-schema-document';
import { translate } from '../i18n';
import { dateStamp, downloadText, fileSlug } from './files';
import { createBackup, type BrandProfile, type SchemaDoc } from './persistence';

export function docTitle(doc: SchemaDoc, locale: Locale): string {
  const template = getTemplate(doc.templateId);
  return doc.title.trim() || displayName(template, doc.data) || translate(locale, 'common.untitled', { type: template.name[locale] });
}

const auditCache = new WeakMap<JsonObject, Map<string, AuditResult>>();

/** Audits are memoized per immutable data object, so lists stay cheap to render. */
export function auditFor(templateId: SchemaDoc['templateId'], data: JsonObject): AuditResult {
  let byTemplate = auditCache.get(data);
  if (!byTemplate) {
    byTemplate = new Map();
    auditCache.set(data, byTemplate);
  }
  let result = byTemplate.get(templateId);
  if (!result) {
    result = auditDocument(getTemplate(templateId), data);
    byTemplate.set(templateId, result);
  }
  return result;
}

export function isBrandStarted(brand: BrandProfile): boolean {
  return Object.keys(brand.data).some((key) => !key.startsWith('@'));
}

export function brandAudit(brand: BrandProfile): AuditResult {
  return auditFor('organization', brand.data);
}

export function scriptFor(doc: SchemaDoc): string {
  return toJsonLdScript(buildOutput(doc.data, getTemplate(doc.templateId)));
}

export function exportBaseName(doc: SchemaDoc, locale: Locale): string {
  return `${fileSlug(docTitle(doc, locale))}-${doc.templateId}`;
}

export function downloadBackup(docs: readonly SchemaDoc[], brand: BrandProfile): void {
  downloadText(`schema-studio-backup-${dateStamp()}.json`, JSON.stringify(createBackup(docs, brand), null, 2));
}
