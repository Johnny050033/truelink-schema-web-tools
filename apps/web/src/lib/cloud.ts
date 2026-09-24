import {
  CloudError,
  compareVersions,
  createHostClient,
  windowTransport,
  type CloudDraft,
  type CloudErrorCode,
  type HostAccount,
  type HostClient,
  type PublishedSchema,
  type PublishResult,
} from 'truelink-schema-cloud';
import { CORE_VERSION, LEGACY_MAIN_TEMPLATES } from 'truelink-schema-document';
import { CLOUD_HOST_PATH } from '../config';
import { browserStorage, type KeyValueStorage } from './persistence';
import { createSignal } from './signals';
import { getStore } from './store';
import { contentHash, readSyncMeta, recordFromDoc, syncState, writeSyncMeta, type SyncMeta } from './sync';

export type CloudState =
  | { readonly phase: 'off' }
  | { readonly phase: 'idle' }
  | { readonly phase: 'connecting' }
  | { readonly phase: 'unavailable'; readonly reason: CloudErrorCode }
  | { readonly phase: 'signed-out' }
  /** TrueLink moved to a newer shared core; this tab must reload before syncing. */
  | { readonly phase: 'outdated'; readonly required: string }
  | {
      readonly phase: 'ready';
      readonly account: HostAccount;
      readonly drafts: readonly CloudDraft[];
      readonly published: PublishedSchema | null;
      readonly canScore: boolean;
    };

/** How the Studio reaches a TrueLink host; replaced in tests. */
export interface CloudEnvironment {
  createClient(): HostClient;
  navigate(url: string): void;
  makeKey(): string;
  readonly storage: KeyValueStorage | null;
}

function browserEnvironment(path: string): CloudEnvironment {
  return {
    createClient() {
      const url = new URL(path, window.location.href);
      const frame = document.createElement('iframe');
      frame.src = url.toString();
      frame.hidden = true;
      frame.tabIndex = -1;
      frame.title = 'TrueLink';
      frame.setAttribute('aria-hidden', 'true');
      document.body.append(frame);
      const peer = frame.contentWindow;
      if (!peer) throw new CloudError('unavailable', 'The TrueLink host could not be opened.');
      const client = createHostClient(windowTransport({ receiver: window, peer, peerOrigin: url.origin }), { hostOrigin: url.origin });
      return {
        ...client,
        close() {
          client.close();
          frame.remove();
        },
      };
    },
    navigate: (url) => window.location.assign(url),
    makeKey: () => crypto.randomUUID().replaceAll('-', ''),
    storage: browserStorage(),
  };
}

let environment: CloudEnvironment | null = CLOUD_HOST_PATH && typeof window !== 'undefined' ? browserEnvironment(CLOUD_HOST_PATH) : null;
let client: HostClient | null = null;
let connecting: Promise<void> | null = null;

export const cloudSignal = createSignal<CloudState>(environment ? { phase: 'idle' } : { phase: 'off' });
export const syncMetaSignal = createSignal<SyncMeta>(readSyncMeta(environment?.storage ?? null));
/** Raised when linked documents were updated from TrueLink automatically. */
export const cloudUpdatesSignal = createSignal<{ readonly count: number; readonly at: number } | null>(null);

/** Test hook: swaps the host environment and resets the connection. */
export function configureCloud(next: CloudEnvironment | null): void {
  client?.close();
  client = null;
  connecting = null;
  environment = next;
  cloudSignal.set(next ? { phase: 'idle' } : { phase: 'off' });
  syncMetaSignal.set(readSyncMeta(next?.storage ?? null));
}

function errorCode(error: unknown): CloudErrorCode {
  return error instanceof CloudError ? error.code : 'unavailable';
}

function setMeta(update: (meta: SyncMeta) => SyncMeta): void {
  const next = update(syncMetaSignal.get());
  syncMetaSignal.set(next);
  writeSyncMeta(environment?.storage ?? null, next);
}

function withoutEntry(meta: SyncMeta, id: string): SyncMeta {
  const next = { ...meta };
  delete next[id];
  return next;
}

function readyState(): Extract<CloudState, { phase: 'ready' }> {
  const state = cloudSignal.get();
  if (state.phase !== 'ready') throw new CloudError(state.phase === 'signed-out' ? 'signed-out' : 'unavailable');
  return state;
}

function requireClient(): HostClient {
  if (!client) throw new CloudError('unavailable');
  return client;
}

function replaceDraft(draft: CloudDraft): void {
  const state = readyState();
  const drafts = [draft, ...state.drafts.filter((item) => item.record.id !== draft.record.id)];
  cloudSignal.set({ ...state, drafts });
}

/** Records drafts whose content already matches this device, so later edits read as local changes. */
function reconcileMeta(drafts: readonly CloudDraft[]): void {
  const docs = new Map(getStore().getState().docs.map((doc) => [doc.id, doc]));
  const meta = syncMetaSignal.get();
  let next: SyncMeta | undefined;
  for (const draft of drafts) {
    const doc = docs.get(draft.record.id);
    if (!doc) continue;
    const hash = contentHash(draft.record);
    const entry = meta[draft.record.id];
    if (contentHash(doc) === hash && (entry?.revision !== draft.revision || entry.hash !== hash)) {
      next = { ...(next ?? meta), [draft.record.id]: { revision: draft.revision, hash } };
    }
  }
  if (next) setMeta(() => next);
}

/**
 * Linked documents follow TrueLink automatically: when the cloud copy moved on (another tool,
 * tab or device) and this device has no unsynced edits, the new version is applied locally.
 * Local edits are never overwritten; those rows show a choice instead.
 */
function applyCloudUpdates(drafts: readonly CloudDraft[]): void {
  const store = getStore();
  let applied = 0;
  for (const draft of drafts) {
    const { record } = draft;
    const doc = store.getState().docs.find((item) => item.id === record.id);
    if (!doc || syncState(doc, draft, syncMetaSignal.get()[record.id]) !== 'cloud-changes') continue;
    if (!store.putDocument({ id: record.id, title: record.title, templateId: record.templateId, data: record.data })) continue;
    setMeta((meta) => ({ ...meta, [record.id]: { revision: draft.revision, hash: contentHash(record) } }));
    applied += 1;
  }
  if (applied > 0) cloudUpdatesSignal.set({ count: applied, at: Date.now() });
}

/** Loads account, drafts and the published schema. Sign-out and host failures become states. */
export async function refreshCloud(): Promise<void> {
  if (!client) return;
  try {
    const account = await client.getAccount();
    if (!account) {
      cloudSignal.set({ phase: 'signed-out' });
      return;
    }
    const [drafts, published] = await Promise.all([client.listDrafts(), client.getPublished()]);
    reconcileMeta(drafts);
    applyCloudUpdates(drafts);
    cloudSignal.set({ phase: 'ready', account, drafts, published, canScore: client.supports('score') });
  } catch (error) {
    const code = errorCode(error);
    cloudSignal.set(code === 'signed-out' ? { phase: 'signed-out' } : { phase: 'unavailable', reason: code });
  }
}

/** Opens the host bridge once; later calls refresh. Never uploads anything. */
export function connectCloud(): Promise<void> {
  if (!environment) return Promise.resolve();
  if (connecting) return connecting;
  const env = environment;
  connecting = (async () => {
    if (!client) {
      cloudSignal.set({ phase: 'connecting' });
      try {
        client = env.createClient();
        client.onAccountChange(() => void refreshCloud());
        // Saves in the TrueLink web tool, another tab or another device arrive as change events.
        client.onChange(() => void refreshCloud());
        await client.ready();
      } catch (error) {
        client?.close();
        client = null;
        cloudSignal.set({ phase: 'unavailable', reason: errorCode(error) });
        return;
      }
      const required = client.minCoreVersion();
      if (required && compareVersions(CORE_VERSION, required) < 0) {
        client.close();
        client = null;
        cloudSignal.set({ phase: 'outdated', required });
        return;
      }
    }
    await refreshCloud();
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}

/** Retries after the host was unavailable. */
export function reconnectCloud(): Promise<void> {
  client?.close();
  client = null;
  return connectCloud();
}

export async function signInToTrueLink(): Promise<void> {
  const url = await requireClient().signInUrl();
  getStore().flush();
  environment?.navigate(url);
}

/**
 * Saves one local document as a cloud draft. Without `overwrite`, the host refuses the save
 * if the cloud copy changed since this device last synced it.
 */
export async function uploadDocument(docId: string, options: { readonly overwrite?: boolean } = {}): Promise<CloudDraft> {
  const state = readyState();
  const doc = getStore()
    .getState()
    .docs.find((item) => item.id === docId);
  const record = doc ? recordFromDoc(doc) : undefined;
  if (!record) throw new CloudError('invalid', 'This document cannot be uploaded.');
  const current = state.drafts.find((draft) => draft.record.id === docId);
  const entry = syncMetaSignal.get()[docId];
  const expectedRevision = current ? (options.overwrite ? current.revision : (entry?.revision ?? null)) : null;
  try {
    const saved = await requireClient().saveDraft({ record, expectedRevision, idempotencyKey: environment!.makeKey() });
    replaceDraft(saved);
    setMeta((meta) => ({ ...meta, [docId]: { revision: saved.revision, hash: contentHash(saved.record) } }));
    return saved;
  } catch (error) {
    if (error instanceof CloudError && error.code === 'conflict' && error.current) replaceDraft(error.current);
    throw error;
  }
}

/**
 * Copies a cloud draft to this device: "replace" writes it under the same id (overwriting
 * local edits the user chose to discard); "copy" keeps local edits and adds a new document.
 */
export function downloadDraft(draftId: string, mode: 'replace' | 'copy'): string | undefined {
  const draft = readyState().drafts.find((item) => item.record.id === draftId);
  if (!draft) throw new CloudError('not-found');
  const store = getStore();
  const { record } = draft;
  if (mode === 'copy') {
    const [created] = store.importDocuments([{ templateId: record.templateId, data: record.data, title: record.title }]);
    return created?.id;
  }
  const doc = store.putDocument({ id: record.id, title: record.title, templateId: record.templateId, data: record.data });
  if (!doc) return undefined;
  setMeta((meta) => ({ ...meta, [record.id]: { revision: draft.revision, hash: contentHash(record) } }));
  return doc.id;
}

export async function deleteCloudDraft(draftId: string): Promise<void> {
  const state = readyState();
  const draft = state.drafts.find((item) => item.record.id === draftId);
  if (!draft) throw new CloudError('not-found');
  await requireClient().deleteDraft({ id: draftId, expectedRevision: draft.revision });
  cloudSignal.set({ ...readyState(), drafts: readyState().drafts.filter((item) => item.record.id !== draftId) });
  setMeta((meta) => withoutEntry(meta, draftId));
}

/** Documents that can become the one main entity of the TrueLink hosted schema. */
export function isPublishableMain(templateId: string): boolean {
  return (LEGACY_MAIN_TEMPLATES as readonly string[]).includes(templateId);
}

/**
 * Publishes synced drafts, pinned to their current revisions. The caller must have shown
 * the user what will change and received an explicit confirmation.
 */
export async function publishDocuments(mainId: string, faqId: string | null): Promise<PublishResult> {
  const state = readyState();
  const docs = getStore().getState().docs;
  const pinned = (id: string) => {
    const draft = state.drafts.find((item) => item.record.id === id);
    const doc = docs.find((item) => item.id === id);
    if (!draft || syncState(doc, draft, syncMetaSignal.get()[id]) !== 'synced') throw new CloudError('conflict', 'Upload your latest changes before publishing.');
    return draft;
  };
  const main = pinned(mainId);
  const faq = faqId ? pinned(faqId) : null;
  const result = await requireClient().publish({
    mainId,
    mainRevision: main.revision,
    faqId: faq ? faq.record.id : null,
    faqRevision: faq ? faq.revision : null,
    idempotencyKey: environment!.makeKey(),
    confirmed: true,
  });
  try {
    const published = await requireClient().getPublished();
    cloudSignal.set({ ...readyState(), published });
  } catch {
    /* the publish succeeded; the summary refreshes on the next visit */
  }
  return result;
}
