import { validateSchema, type FieldRule } from 'truelink-schema-web-tools/schema';
import { checkJsonValue, isJsonObject, isTemplateId, LIMITS, TEMPLATE_IDS, type JsonObject, type Locale, type TemplateId } from 'truelink-schema-document';
import { LOCAL_LIMITS } from '../config';

export interface SchemaDoc {
  readonly id: string;
  /** Empty means "use the entity name from the data". */
  readonly title: string;
  readonly templateId: TemplateId;
  readonly data: JsonObject;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly revision: number;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  readonly theme: ThemePreference;
  readonly locale: Locale;
  readonly exportCount: number;
  readonly nudgeDismissedAt: number;
  readonly installDismissedAt: number;
}

export interface BrandProfile {
  readonly data: JsonObject;
  readonly updatedAt: number;
}

export const STORAGE_KEYS = {
  docs: 'truelink-schema-studio:v1:docs',
  brand: 'truelink-schema-studio:v1:brand',
  prefs: 'truelink-schema-studio:v1:prefs',
} as const;

export type SliceName = keyof typeof STORAGE_KEYS;

/** Envelope rules are strict: unknown or client-invented fields are rejected. */
const docEnvelopeSchema = {
  id: { type: 'string', required: true, minLength: 1, maxLength: 64 },
  title: { type: 'string', required: true, maxLength: 120 },
  templateId: { type: 'string', required: true, enum: TEMPLATE_IDS },
  createdAt: { type: 'number', required: true, min: 0 },
  updatedAt: { type: 'number', required: true, min: 0 },
  revision: { type: 'number', required: true, min: 0 },
} satisfies Record<string, FieldRule>;

const prefsSchema = {
  theme: { type: 'string', required: true, enum: ['system', 'light', 'dark'] },
  locale: { type: 'string', required: true, enum: ['zh-TW', 'en'] },
  exportCount: { type: 'number', required: true, min: 0, max: 1_000_000 },
  nudgeDismissedAt: { type: 'number', required: true, min: 0 },
  installDismissedAt: { type: 'number', required: true, min: 0 },
} satisfies Record<string, FieldRule>;

/**
 * Light is the default, as on the TrueLink site (tl-theme.js deliberately ignores
 * prefers-color-scheme until the user chooses). "system" stays available as an explicit choice.
 */
export function defaultPreferences(locale: Locale, theme: ThemePreference = 'light'): Preferences {
  return { theme, locale, exportCount: 0, nudgeDismissedAt: 0, installDismissedAt: 0 };
}

export function emptyBrand(): BrandProfile {
  return { data: { '@type': 'Organization' }, updatedAt: 0 };
}

export function isValidDocumentData(value: unknown): value is JsonObject {
  return isJsonObject(value) && checkJsonValue(value, { maxBytes: LIMITS.documentBytes }).ok;
}

/** Validates one stored or imported document, returning undefined when unusable. */
export function toSchemaDoc(value: unknown): SchemaDoc | undefined {
  if (!isJsonObject(value)) return undefined;
  const { data, ...envelope } = value;
  if (!validateSchema(envelope, docEnvelopeSchema).valid || !isValidDocumentData(data)) return undefined;
  if (!isTemplateId(envelope['templateId'])) return undefined;
  return value as unknown as SchemaDoc;
}

export interface ParsedDocs {
  readonly docs: SchemaDoc[];
  readonly dropped: number;
  readonly corrupt: boolean;
}

export function parseDocs(raw: string | null): ParsedDocs {
  if (raw === null) return { docs: [], dropped: 0, corrupt: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { docs: [], dropped: 0, corrupt: true };
  }
  if (!Array.isArray(parsed)) return { docs: [], dropped: 0, corrupt: true };
  const docs: SchemaDoc[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const item of parsed.slice(0, LOCAL_LIMITS.maxDocuments)) {
    const doc = toSchemaDoc(item);
    if (!doc || seen.has(doc.id)) dropped += 1;
    else {
      seen.add(doc.id);
      docs.push(doc);
    }
  }
  dropped += Math.max(0, parsed.length - LOCAL_LIMITS.maxDocuments);
  return { docs, dropped, corrupt: false };
}

export function parseBrand(raw: string | null): { brand: BrandProfile; corrupt: boolean } {
  if (raw === null) return { brand: emptyBrand(), corrupt: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isJsonObject(parsed) && typeof parsed['updatedAt'] === 'number' && Number.isFinite(parsed['updatedAt']) && isValidDocumentData(parsed['data']) && Object.keys(parsed).length === 2) {
      return { brand: { data: parsed['data'], updatedAt: parsed['updatedAt'] }, corrupt: false };
    }
  } catch {
    /* fall through */
  }
  return { brand: emptyBrand(), corrupt: true };
}

export function parsePreferences(raw: string | null, fallbackLocale: Locale, fallbackTheme: ThemePreference = 'light'): Preferences {
  const defaults = defaultPreferences(fallbackLocale, fallbackTheme);
  if (raw === null) return defaults;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed)) return defaults;
    // Keep only known settings so a newer app version's extra keys do not reset everything.
    const known = Object.keys(prefsSchema).filter((key) => Object.hasOwn(parsed, key));
    const merged = { ...defaults, ...Object.fromEntries(known.map((key) => [key, parsed[key]])) };
    return validateSchema(merged, prefsSchema).valid ? (merged as unknown as Preferences) : defaults;
  } catch {
    return defaults;
  }
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Returns localStorage when usable (it can throw in private modes or when blocked). */
export function browserStorage(): KeyValueStorage | null {
  try {
    const storage = globalThis.localStorage;
    const probe = 'truelink-schema-studio:probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** localStorage key and values used by the TrueLink site's tl-theme.js for its light/dark choice. */
export const SHARED_THEME_KEY = 'tl_theme';

/**
 * Reads the theme chosen on the TrueLink site. It only exists when the Studio is served from
 * the same origin; it seeds a first run and is never written, so tl-theme.js stays its owner.
 */
export function readSharedTheme(storage: KeyValueStorage | null): 'light' | 'dark' | undefined {
  try {
    const value = storage?.getItem(SHARED_THEME_KEY);
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    return undefined;
  }
}

export function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22);
}

export interface BackupFile {
  readonly format: 'truelink-schema-studio-backup';
  readonly version: 1;
  readonly exportedAt: string;
  readonly brand: JsonObject;
  readonly documents: readonly Omit<SchemaDoc, 'id' | 'revision'>[];
}

export function createBackup(docs: readonly SchemaDoc[], brand: BrandProfile, now = new Date()): BackupFile {
  return {
    format: 'truelink-schema-studio-backup',
    version: 1,
    exportedAt: now.toISOString(),
    brand: brand.data,
    documents: docs.map(({ title, templateId, data, createdAt, updatedAt }) => ({ title, templateId, data, createdAt, updatedAt })),
  };
}

export interface ParsedBackup {
  readonly brand: JsonObject | undefined;
  readonly documents: readonly Pick<SchemaDoc, 'title' | 'templateId' | 'data'>[];
  readonly skipped: number;
}

/** Parses a backup file. Documents are later added as copies; nothing is overwritten. */
export function parseBackup(text: string): ParsedBackup | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isJsonObject(parsed) || parsed['format'] !== 'truelink-schema-studio-backup' || parsed['version'] !== 1) return undefined;
  const list = parsed['documents'];
  if (!Array.isArray(list)) return undefined;
  const documents: Pick<SchemaDoc, 'title' | 'templateId' | 'data'>[] = [];
  let skipped = 0;
  for (const item of list.slice(0, LOCAL_LIMITS.maxBackupDocuments)) {
    const doc = toSchemaDoc(isJsonObject(item) ? { id: 'backup', revision: 0, ...item } : item);
    if (doc) documents.push({ title: doc.title, templateId: doc.templateId, data: doc.data });
    else skipped += 1;
  }
  skipped += Math.max(0, list.length - LOCAL_LIMITS.maxBackupDocuments);
  const brand = isValidDocumentData(parsed['brand']) ? parsed['brand'] : undefined;
  return { brand, documents, skipped };
}
