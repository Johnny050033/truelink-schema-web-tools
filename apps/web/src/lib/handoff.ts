import { CloudError, type CloudDraft } from 'truelink-schema-cloud';
import { LIMITS, parseRecord, utf8Bytes, type SchemaDocumentRecord } from 'truelink-schema-document';
import { CLOUD_HOST_PATH, httpsOr, LOCAL_LIMITS } from '../config';
import { cloudSignal, uploadDocument } from './cloud';
import { browserStorage, type KeyValueStorage, type SchemaDoc } from './persistence';
import { createSignal } from './signals';
import { getStore } from './store';
import { contentHash, recordFromDoc } from './sync';

/**
 * "Try on GitHub Pages, continue in TrueLink": the public Studio (local-only) hands selected
 * documents to the TrueLink-hosted Studio, which keeps them as a pending import until the
 * member signs in and confirms. Nothing travels in a URL (query or hash): the documents go
 * through postMessage between the two exact origins, and the receiving window must be the
 * one this page opened. Signing in, cancelling the login or closing the tab never uploads
 * anything; only the explicit "import" action does.
 */

export const HANDOFF_CHANNEL = 'truelink.studio.handoff';
export const HANDOFF_VERSION = 1;
export const PENDING_IMPORT_KEY = 'truelink-schema-studio:v1:pending-import';
/** A pending import that was never confirmed is dropped after a day. */
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
export const HANDOFF_MAX_BYTES = 1024 * 1024;
const READY_TIMEOUT_MS = 60_000;

const env = import.meta.env;

/** Where the public build sends documents (the TrueLink-hosted Studio). */
export const CLOUD_STUDIO_URL = httpsOr(env.VITE_TRUELINK_CLOUD_STUDIO_URL, 'https://app.truelink-group.com/studio/');

/** Origins allowed to hand documents to the hosted build. Exact origins only. */
export function handoffOrigins(value: string | undefined): readonly string[] {
  const list = (value ?? 'https://johnny050033.github.io').split(',').map((item) => item.trim());
  return list.filter((origin) => {
    try {
      const url = new URL(origin);
      return url.protocol === 'https:' && url.origin === origin && !url.username && !url.password;
    } catch {
      return false;
    }
  });
}

export const HANDOFF_SOURCE_ORIGINS = handoffOrigins(env.VITE_TRUELINK_HANDOFF_ORIGINS);

export type HandoffFailure =
  | 'empty'
  | 'too-many'
  | 'too-large'
  | 'invalid-record'
  | 'popup-blocked'
  | 'timeout'
  | 'closed';

export interface PendingImport {
  readonly records: readonly SchemaDocumentRecord[];
  readonly sourceOrigin: string;
  readonly receivedAt: number;
}

export const pendingImportSignal = createSignal<PendingImport | null>(null);

// ---------------------------------------------------------------------------
// Validation (shared by both sides)
// ---------------------------------------------------------------------------

export function validateRecords(input: unknown): { ok: true; records: SchemaDocumentRecord[] } | { ok: false; reason: HandoffFailure } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, reason: 'empty' };
  if (input.length > LOCAL_LIMITS.maxDocuments) return { ok: false, reason: 'too-many' };
  const seen = new Set<string>();
  const records: SchemaDocumentRecord[] = [];
  let bytes = 0;
  for (const item of input) {
    const parsed = parseRecord(item);
    if (!parsed.ok) return { ok: false, reason: 'invalid-record' };
    if (seen.has(parsed.record.id)) continue;
    seen.add(parsed.record.id);
    bytes += utf8Bytes(JSON.stringify(parsed.record));
    if (bytes > HANDOFF_MAX_BYTES) return { ok: false, reason: 'too-large' };
    records.push(parsed.record);
  }
  return { ok: true, records };
}

export function buildHandoff(docs: readonly SchemaDoc[]): { ok: true; records: SchemaDocumentRecord[] } | { ok: false; reason: HandoffFailure } {
  const records: unknown[] = [];
  for (const doc of docs) {
    const record = recordFromDoc(doc);
    if (!record) return { ok: false, reason: 'invalid-record' };
    records.push(record);
  }
  return validateRecords(records);
}

// ---------------------------------------------------------------------------
// Pending import (hosted build, survives a login round trip)
// ---------------------------------------------------------------------------

export function readPending(storage: KeyValueStorage | null, now = Date.now()): PendingImport | null {
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_IMPORT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { records?: unknown; sourceOrigin?: unknown; receivedAt?: unknown };
    const receivedAt = typeof value.receivedAt === 'number' ? value.receivedAt : NaN;
    const sourceOrigin = typeof value.sourceOrigin === 'string' ? value.sourceOrigin : '';
    const checked = validateRecords(value.records);
    if (!checked.ok || !Number.isFinite(receivedAt) || now - receivedAt > PENDING_TTL_MS || receivedAt > now + 60_000) {
      clearPending(storage);
      return null;
    }
    return { records: checked.records, sourceOrigin, receivedAt };
  } catch {
    clearPending(storage);
    return null;
  }
}

export function writePending(storage: KeyValueStorage | null, pending: PendingImport): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PENDING_IMPORT_KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

export function clearPending(storage: KeyValueStorage | null): void {
  try {
    storage?.removeItem(PENDING_IMPORT_KEY);
  } catch {
    /* nothing to clear */
  }
}

let pendingStorage: KeyValueStorage | null = CLOUD_HOST_PATH && typeof window !== 'undefined' ? browserStorage() : null;

/** Test hook. */
export function configurePendingStorage(storage: KeyValueStorage | null): void {
  pendingStorage = storage;
  pendingImportSignal.set(readPending(storage));
}

export function loadPendingImport(now = Date.now()): PendingImport | null {
  const pending = readPending(pendingStorage, now);
  pendingImportSignal.set(pending);
  return pending;
}

export function discardPendingImport(): void {
  clearPending(pendingStorage);
  pendingImportSignal.set(null);
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

interface HandoffMessage {
  readonly channel: typeof HANDOFF_CHANNEL;
  readonly version: typeof HANDOFF_VERSION;
  readonly type: 'ready' | 'records' | 'ack';
  readonly nonce: string;
  readonly records?: unknown;
  readonly count?: number;
}

function asMessage(data: unknown): HandoffMessage | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  if (value['channel'] !== HANDOFF_CHANNEL || value['version'] !== HANDOFF_VERSION) return null;
  if (value['type'] !== 'ready' && value['type'] !== 'records' && value['type'] !== 'ack') return null;
  if (typeof value['nonce'] !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(value['nonce'])) return null;
  return value as unknown as HandoffMessage;
}

/** The minimal window surface the handoff needs; replaced in tests. */
export interface HandoffWindow {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  open?(url: string, target: string): HandoffPeer | null;
  opener?: HandoffPeer | null;
  setTimeout(handler: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface HandoffPeer {
  postMessage(message: unknown, targetOrigin: string): void;
  readonly closed?: boolean;
}

/**
 * Public (local-only) build: opens the hosted Studio and, once it announces itself from the
 * exact TrueLink origin, sends the records. Resolves when the hosted Studio confirms it saved
 * them as a pending import (nothing is uploaded yet).
 */
export function sendToCloud(
  records: readonly SchemaDocumentRecord[],
  options: { readonly win?: HandoffWindow; readonly targetUrl?: string; readonly timeoutMs?: number } = {},
): Promise<number> {
  const win = options.win ?? (window as unknown as HandoffWindow);
  const targetUrl = options.targetUrl ?? CLOUD_STUDIO_URL;
  const targetOrigin = new URL(targetUrl).origin;
  return new Promise((resolve, reject) => {
    const popup = win.open?.(`${targetUrl}#/import`, '_blank') ?? null;
    if (!popup) {
      reject(new Error('popup-blocked'));
      return;
    }
    const nonces = new Set<string>();
    const finish = (error: Error | null, count = 0) => {
      win.removeEventListener('message', onMessage);
      win.clearTimeout(timer);
      if (error) reject(error);
      else resolve(count);
    };
    const timer = win.setTimeout(() => finish(new Error(popup.closed ? 'closed' : 'timeout')), options.timeoutMs ?? READY_TIMEOUT_MS);
    function onMessage(event: MessageEvent) {
      if (event.origin !== targetOrigin || event.source !== (popup as unknown)) return;
      const message = asMessage(event.data);
      if (!message) return;
      // Each announcement gets the records (a reload or a dev double-mount announces again with a new nonce);
      // the receiver still accepts only one message for its own current nonce.
      if (message.type === 'ready' && nonces.size < 4 && !nonces.has(message.nonce)) {
        nonces.add(message.nonce);
        popup!.postMessage({ channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'records', nonce: message.nonce, records }, targetOrigin);
      } else if (message.type === 'ack' && nonces.has(message.nonce)) {
        finish(null, typeof message.count === 'number' ? message.count : records.length);
      }
    }
    win.addEventListener('message', onMessage);
  });
}

function makeNonce(): string {
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hosted build, opened by the public Studio: announces itself to the allowed opener origins,
 * accepts one records message from the window that opened it, stores it as a pending import
 * and acknowledges. Returns a cleanup function.
 */
export function receiveHandoff(
  options: {
    readonly win?: HandoffWindow;
    readonly origins?: readonly string[];
    readonly storage?: KeyValueStorage | null;
    readonly now?: () => number;
    readonly onReceived?: (pending: PendingImport) => void;
    readonly onRejected?: (reason: HandoffFailure) => void;
  } = {},
): () => void {
  const win = options.win ?? (window as unknown as HandoffWindow);
  const opener = win.opener;
  if (!opener) return () => {};
  const origins = options.origins ?? HANDOFF_SOURCE_ORIGINS;
  const storage = options.storage === undefined ? pendingStorage : options.storage;
  const now = options.now ?? Date.now;
  const nonce = makeNonce();
  let done = false;
  const onMessage = (event: MessageEvent) => {
    if (done || event.source !== (opener as unknown) || !origins.includes(event.origin)) return;
    const message = asMessage(event.data);
    if (!message || message.type !== 'records' || message.nonce !== nonce) return;
    done = true;
    win.removeEventListener('message', onMessage);
    const checked = validateRecords(message.records);
    if (!checked.ok) {
      options.onRejected?.(checked.reason);
      return;
    }
    const pending: PendingImport = { records: checked.records, sourceOrigin: event.origin, receivedAt: now() };
    if (!writePending(storage, pending)) {
      options.onRejected?.('too-large');
      return;
    }
    pendingImportSignal.set(pending);
    opener.postMessage({ channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'ack', nonce, count: checked.records.length }, event.origin);
    try {
      (win as { opener?: unknown }).opener = null;
    } catch {
      /* read-only in some environments */
    }
    options.onReceived?.(pending);
  };
  win.addEventListener('message', onMessage);
  for (const origin of origins) opener.postMessage({ channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'ready', nonce }, origin);
  return () => {
    done = true;
    win.removeEventListener('message', onMessage);
  };
}

// ---------------------------------------------------------------------------
// Confirmed import (hosted build, signed in)
// ---------------------------------------------------------------------------

export type ImportOutcome = 'imported' | 'already-imported' | 'kept-as-copy' | 'conflict' | 'failed';

export interface ImportResult {
  readonly id: string;
  readonly title: string;
  readonly outcome: ImportOutcome;
}

function sameContent(a: { title: string; templateId: string; data: unknown }, b: { title: string; templateId: string; data: unknown }): boolean {
  return contentHash(a) === contentHash(b);
}

let importing: Promise<ImportResult[]> | null = null;

/**
 * Imports the pending records into the signed-in member's cloud drafts. Safety rules, in order:
 *   1. The cloud already has this exact content under the record id → "already imported" (no write).
 *   2. A cloud draft with this id exists but differs → never save under that id (a stale sync entry
 *      could otherwise overwrite newer cloud edits); the incoming version becomes a new copy.
 *   3. A local document with this id differs → keep the local edits; the incoming version becomes a copy.
 *   4. Otherwise save under the record id, which only happens when the cloud has no draft with it,
 *      so the save is a create (expectedRevision null) and a repeated import cannot add a second draft.
 * Copies are reused by content on retry, so retries never pile up extra copies. Unfinished records
 * stay pending. Concurrent calls share one run.
 */
export function importPending(): Promise<ImportResult[]> {
  if (!importing) importing = runImport().finally(() => { importing = null; });
  return importing;
}

async function runImport(): Promise<ImportResult[]> {
  const pending = pendingImportSignal.get() ?? loadPendingImport();
  if (!pending) return [];
  const state = cloudSignal.get();
  if (state.phase !== 'ready') throw new CloudError(state.phase === 'signed-out' ? 'signed-out' : 'unavailable');
  const store = getStore();
  const results: ImportResult[] = [];
  const remaining: SchemaDocumentRecord[] = [];
  const cloudDraft = (id: string): CloudDraft | undefined => {
    const current = cloudSignal.get();
    return current.phase === 'ready' ? current.drafts.find((draft) => draft.record.id === id) : undefined;
  };
  for (const record of pending.records) {
    const existing = cloudDraft(record.id);
    if (existing && sameContent(existing.record, record)) {
      results.push({ id: record.id, title: record.title, outcome: 'already-imported' });
      continue;
    }
    const local = store.getState().docs.find((doc) => doc.id === record.id);
    const needsCopy = !!existing || (!!local && !sameContent(local, record));
    let docId = record.id;
    if (needsCopy) {
      const reuse = store.getState().docs.find((doc) => doc.id !== record.id && sameContent(doc, record));
      const copy = reuse ?? store.importDocuments([{ templateId: record.templateId, data: record.data, title: record.title }])[0];
      if (!copy) {
        results.push({ id: record.id, title: record.title, outcome: 'failed' });
        remaining.push(record);
        continue;
      }
      docId = copy.id;
      const copyDraft = cloudDraft(docId);
      if (copyDraft && sameContent(copyDraft.record, record)) {
        results.push({ id: docId, title: record.title, outcome: 'kept-as-copy' });
        continue;
      }
    } else if (!local && !store.putDocument({ id: record.id, title: record.title, templateId: record.templateId, data: record.data })) {
      results.push({ id: record.id, title: record.title, outcome: 'failed' });
      remaining.push(record);
      continue;
    }
    try {
      await uploadDocument(docId);
      results.push({ id: docId, title: record.title, outcome: needsCopy ? 'kept-as-copy' : 'imported' });
    } catch (error) {
      if (error instanceof CloudError && error.code === 'conflict') {
        const current = error.current;
        if (current && sameContent(current.record, record)) results.push({ id: docId, title: record.title, outcome: 'already-imported' });
        else results.push({ id: docId, title: record.title, outcome: 'conflict' });
      } else {
        results.push({ id: docId, title: record.title, outcome: 'failed' });
        remaining.push(record);
      }
    }
  }
  store.flush();
  if (remaining.length === 0) discardPendingImport();
  else {
    const next: PendingImport = { ...pending, records: remaining };
    writePending(pendingStorage, next);
    pendingImportSignal.set(next);
  }
  return results;
}

/**
 * A pending import belongs to whoever is at this browser when it arrives. It is dropped when a
 * signed-in member signs out or the signed-in account changes, so a later user of a shared
 * device does not inherit it. (Signing in from signed-out keeps it: that is the login round trip.)
 */
export function watchAccountForPendingImport(): () => void {
  let lastAccount: string | null = null;
  const check = () => {
    const state = cloudSignal.get();
    if (state.phase === 'ready') {
      const name = state.account.displayName;
      if (lastAccount !== null && lastAccount !== name) discardPendingImport();
      lastAccount = name;
    } else if (state.phase === 'signed-out') {
      if (lastAccount !== null) discardPendingImport();
      lastAccount = null;
    }
  };
  check();
  return cloudSignal.subscribe(check);
}

export const HANDOFF_LIMITS = { maxDocuments: LOCAL_LIMITS.maxDocuments, maxBytes: HANDOFF_MAX_BYTES, documentBytes: LIMITS.documentBytes } as const;
