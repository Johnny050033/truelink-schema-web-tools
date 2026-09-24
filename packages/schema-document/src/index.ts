/**
 * Version of this shared core. Every TrueLink tool that bundles it reports this value, and a
 * TrueLink host can require a minimum so all linked tools move to a new core together.
 * Kept equal to package.json by a test.
 */
export const CORE_VERSION = '0.3.0';

export * from './types.js';
export { LIMITS, utf8Bytes } from './limits.js';
export {
  fallbackLocale,
  fill,
  fmt,
  hasCatalog,
  isCjk,
  isLocale,
  isSourceLocale,
  joinList,
  lazyText,
  LOCALE_INFO,
  localize,
  registerCatalog,
  sentenceSeparator,
} from './i18n.js';
export type { Catalog, LocaleInfo } from './i18n.js';
export {
  formatWallClock,
  isCountryCode,
  isCurrencyCode,
  isEmail,
  isHttpUrl,
  isHttpsUrl,
  isIsoDate,
  isIsoDateTime,
  isLanguageTag,
  isPrice,
  isTaiwanBusinessId,
  isTelephone,
  isTime,
  lacksTimeZone,
  localized,
} from './formats.js';
export { canWriteAt, cloneJson, FORBIDDEN_KEYS, getAt, isJsonObject, isScalar, listAt, removeAt, setAt, textOf, textsOf, typesOf } from './json.js';
export { buildOutput, combineGraph, pruneValue, SCHEMA_CONTEXT, toJsonLdJson, toJsonLdScript } from './output.js';
export { checkJsonValue, isSchemaOrgContext, legacyStoreNodes, parseJsonLdText, parseJsonLdTexts } from './parse.js';
export type { ImportCandidate, ImportIssue, ImportIssueCode, ImportResult, JsonCheckCode, JsonCheckOptions } from './parse.js';
export { auditDocument, checkScalar, gradeFor, resolvePath } from './audit.js';
export { describeDocument, domainOf, formatAddress, summarizeHours } from './describe.js';
export type { EntityDescription, EntityFact, EntityProfile } from './describe.js';
export { classifyProfile, platformName, PLATFORMS } from './platforms.js';
export type { Platform, PlatformId } from './platforms.js';
export { createDocumentData, displayName, newListItem, readField, readList, writeField, writeList } from './document.js';
export type { FieldValueState } from './document.js';
export { countryOptions, currencyOptions, dayOptions, languageOptions } from './templates/common.js';
export { findField, getTemplate, isFieldVisible, isTemplateId, TEMPLATE_IDS, templateFields, templateForTypes, TEMPLATES, typeLabel } from './templates/index.js';
export type { FieldEntry } from './templates/index.js';
export {
  createRecord,
  fromLegacyStoreObj,
  LEGACY_LIMITS,
  LEGACY_MAIN_TEMPLATES,
  parseDomainList,
  parseRecord,
  RECORD_FORMAT,
  RECORD_ID_PATTERN,
  RECORD_TITLE_MAX,
  RECORD_VERSION,
  toLegacyStoreObj,
} from './contract.js';
export type { LegacyErrorCode, LegacyExportResult, LegacyImportResult, LegacyStoreObj, RecordErrorCode, RecordResult, SchemaDocumentRecord } from './contract.js';
export {
  API_KEY_HEADER,
  API_KEY_PATTERN,
  certStatusUrl,
  domainCoverage,
  hostedSchemaEmbed,
  hostedSchemaScriptUrl,
  isAllowedHost,
  isApiKey,
  maskApiKey,
  MAX_VERIFIED_DOMAINS,
  normalizeDomain,
  normalizeDomainList,
  TRUELINK_ORIGIN,
  VERIFIED_PATHS,
  verifiedEntitiesUrl,
} from './verification.js';
export type { AllowedHostOptions, DomainCoverage } from './verification.js';
