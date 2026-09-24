import { createRecord, RECORD_ID_PATTERN, type SchemaDocumentRecord } from 'truelink-schema-document';
import type { CloudDraft } from 'truelink-schema-cloud';
import type { KeyValueStorage, SchemaDoc } from './persistence';

/**
 * Explicit, per-document sync between this device and TrueLink cloud drafts. Nothing
 * uploads or downloads on its own: these states only describe what the user can do.
 */
export type SyncState = 'local-only' | 'cloud-only' | 'synced' | 'local-changes' | 'cloud-changes' | 'conflict';

/** What this device last confirmed with the host, per document id. */
export interface SyncEntry {
  readonly revision: number;
  readonly hash: string;
}

export type SyncMeta = Readonly<Record<string, SyncEntry>>;

export interface SyncRow {
  readonly id: string;
  readonly state: SyncState;
  readonly doc: SchemaDoc | undefined;
  readonly draft: CloudDraft | undefined;
}

export const SYNC_STORAGE_KEY = 'truelink-schema-studio:v1:sync';
const MAX_ENTRIES = 500;

/** FNV-1a over the synced content; only used to notice local edits, never for security. */
export function contentHash(content: { readonly title: string; readonly templateId: string; readonly data: unknown }): string {
  const text = JSON.stringify([content.title, content.templateId, content.data]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function recordFromDoc(doc: SchemaDoc): SchemaDocumentRecord | undefined {
  const result = createRecord({ id: doc.id, title: doc.title, templateId: doc.templateId, data: doc.data, updatedAt: doc.updatedAt });
  return result.ok ? result.record : undefined;
}

export function syncState(doc: SchemaDoc | undefined, draft: CloudDraft | undefined, entry: SyncEntry | undefined): SyncState {
  if (doc && !draft) return 'local-only';
  if (!doc && draft) return 'cloud-only';
  if (!doc || !draft) return 'local-only';
  const localHash = contentHash(doc);
  if (localHash === contentHash(draft.record)) return 'synced';
  if (!entry) return 'conflict';
  const localChanged = localHash !== entry.hash;
  const cloudChanged = draft.revision !== entry.revision;
  if (localChanged && cloudChanged) return 'conflict';
  if (localChanged) return 'local-changes';
  if (cloudChanged) return 'cloud-changes';
  // Unchanged on both sides yet different content means the entry is stale.
  return 'conflict';
}

/** Local documents first (in library order), then cloud-only drafts (newest first). */
export function syncRows(docs: readonly SchemaDoc[], drafts: readonly CloudDraft[], meta: SyncMeta): SyncRow[] {
  const byId = new Map(drafts.map((draft) => [draft.record.id, draft]));
  const rows: SyncRow[] = docs.map((doc) => {
    const draft = byId.get(doc.id);
    return { id: doc.id, state: syncState(doc, draft, meta[doc.id]), doc, draft };
  });
  const local = new Set(docs.map((doc) => doc.id));
  for (const draft of drafts) {
    if (!local.has(draft.record.id)) rows.push({ id: draft.record.id, state: 'cloud-only', doc: undefined, draft });
  }
  return rows;
}

export function parseSyncMeta(raw: string | null): SyncMeta {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const meta: Record<string, SyncEntry> = Object.create(null) as Record<string, SyncEntry>;
    for (const [id, value] of Object.entries(parsed).slice(0, MAX_ENTRIES)) {
      if (!RECORD_ID_PATTERN.test(id) || !value || typeof value !== 'object') continue;
      const { revision, hash } = value as Record<string, unknown>;
      if (typeof revision === 'number' && Number.isSafeInteger(revision) && revision > 0 && typeof hash === 'string' && /^[0-9a-f]{8}$/.test(hash)) {
        meta[id] = { revision, hash };
      }
    }
    return meta;
  } catch {
    return {};
  }
}

export function readSyncMeta(storage: KeyValueStorage | null): SyncMeta {
  try {
    return parseSyncMeta(storage?.getItem(SYNC_STORAGE_KEY) ?? null);
  } catch {
    return {};
  }
}

export function writeSyncMeta(storage: KeyValueStorage | null, meta: SyncMeta): void {
  try {
    storage?.setItem(SYNC_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* sync bookkeeping is best effort; states fall back to comparing content */
  }
}
