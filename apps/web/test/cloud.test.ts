import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHostClient, createLinkedTransports, createMemoryHost, serveHost, type MemoryHost } from 'truelink-schema-cloud';
import { createRecord } from 'truelink-schema-document';
import { hostPath } from '../src/config';
import {
  cloudSignal,
  cloudUpdatesSignal,
  configureCloud,
  connectCloud,
  deleteCloudDraft,
  downloadDraft,
  publishDocuments,
  signInToTrueLink,
  syncMetaSignal,
  uploadDocument,
} from '../src/lib/cloud';
import type { KeyValueStorage } from '../src/lib/persistence';
import { createAppStore, initStore, type AppStore } from '../src/lib/store';
import { contentHash, parseSyncMeta, SYNC_STORAGE_KEY, syncRows, syncState } from '../src/lib/sync';

class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

const ORIGIN = 'https://app.truelink-group.com';
let host: MemoryHost;
let store: AppStore;
let storage: MemoryStorage;
let navigated: string[];

function makeStore(): AppStore {
  let id = 0;
  let time = 1_000;
  return createAppStore({ storage, locale: 'zh-TW', now: () => (time += 10), makeId: () => `doc${String(++id).padStart(8, '0')}`, writeDelayMs: 60_000 });
}

let servers: ReturnType<typeof serveHost>[] = [];

function useHost(options: Parameters<typeof createMemoryHost>[0] = { account: { displayName: 'Synthetic User' } }, minCoreVersion?: string) {
  host = createMemoryHost({ now: () => new Date('2026-09-24T00:00:00.000Z'), score: () => ({ score: 88, grade: 'A' }), ...options });
  servers = [];
  let keys = 0;
  configureCloud({
    createClient() {
      const { client, host: hostSide } = createLinkedTransports();
      servers.push(serveHost(host, hostSide, minCoreVersion ? { minCoreVersion } : {}));
      return createHostClient(client, { hostOrigin: ORIGIN, timeoutMs: 500, readyTimeoutMs: 500 });
    },
    navigate: (url) => navigated.push(url),
    makeKey: () => `key_${String(++keys).padStart(16, '0')}`,
    storage,
  });
}

function ready() {
  const state = cloudSignal.get();
  if (state.phase !== 'ready') throw new Error(`expected ready, got ${state.phase}`);
  return state;
}

function stateOf(id: string) {
  const state = ready();
  return syncRows(store.getState().docs, state.drafts, syncMetaSignal.get()).find((row) => row.id === id)?.state;
}

/** Simulates an edit saved from another device. */
async function editElsewhere(id: string, name: string) {
  const draft = host.snapshot().drafts.find((item) => item.record.id === id)!;
  const record = createRecord({ ...draft.record, data: { ...draft.record.data, name } });
  if (!record.ok) throw new Error(record.code);
  await host.saveDraft({ record: record.record, expectedRevision: draft.revision, idempotencyKey: `other_${String(draft.revision).padStart(16, '0')}` });
}

beforeEach(() => {
  storage = new MemoryStorage();
  navigated = [];
  store = initStore(makeStore());
});

afterEach(() => configureCloud(null));

describe('cloud configuration', () => {
  it('only accepts same-origin host paths', () => {
    expect(hostPath('/studio/host.html')).toBe('/studio/host.html');
    expect(hostPath('./host.html')).toBe('./host.html');
    expect(hostPath('//evil.example/host.html')).toBeUndefined();
    expect(hostPath('https://evil.example/host.html')).toBeUndefined();
    expect(hostPath('javascript:alert(1)')).toBeUndefined();
    expect(hostPath(undefined)).toBeUndefined();
  });

  it('stays off without a host and never connects', async () => {
    configureCloud(null);
    await connectCloud();
    expect(cloudSignal.get()).toEqual({ phase: 'off' });
  });
});

describe('connecting', () => {
  it('shows signed-out and sends the user to the host sign-in page after saving local work', async () => {
    useHost({ account: null, signInUrl: '/login.html?next=%2Fstudio%2F' });
    await connectCloud();
    expect(cloudSignal.get()).toEqual({ phase: 'signed-out' });
    store.createDocument('organization');
    await signInToTrueLink();
    expect(navigated).toEqual([`${ORIGIN}/login.html?next=%2Fstudio%2F`]);
    expect(store.hasPendingWrites()).toBe(false);
  });

  it('reports an unreachable host', async () => {
    configureCloud({
      createClient: () => createHostClient({ send: () => undefined, subscribe: () => () => undefined }, { hostOrigin: ORIGIN, readyTimeoutMs: 20 }),
      navigate: () => undefined,
      makeKey: () => 'key_0000000000000001',
      storage,
    });
    await connectCloud();
    expect(cloudSignal.get()).toEqual({ phase: 'unavailable', reason: 'unavailable' });
  });

  it('loads drafts without uploading anything', async () => {
    useHost();
    store.createDocument('organization');
    await connectCloud();
    expect(ready()).toMatchObject({ account: { displayName: 'Synthetic User' }, drafts: [], published: null, canScore: true });
    expect(host.snapshot().drafts).toEqual([]);
  });
});

describe('explicit sync', () => {
  it('uploads, notices local and remote edits, and resolves conflicts only on request', async () => {
    useHost();
    const doc = store.createDocument('organization')!;
    store.updateDocument(doc.id, { ...doc.data, name: '晨光示範咖啡' });
    await connectCloud();
    expect(stateOf(doc.id)).toBe('local-only');

    await uploadDocument(doc.id);
    expect(stateOf(doc.id)).toBe('synced');
    expect(JSON.parse(storage.getItem(SYNC_STORAGE_KEY)!)).toEqual({ [doc.id]: { revision: 1, hash: expect.stringMatching(/^[0-9a-f]{8}$/) } });

    const current = store.getState().docs[0]!;
    store.updateDocument(doc.id, { ...current.data, description: '本機修改' });
    expect(stateOf(doc.id)).toBe('local-changes');
    await uploadDocument(doc.id);
    expect(stateOf(doc.id)).toBe('synced');

    // An unchanged local copy follows the cloud automatically.
    await editElsewhere(doc.id, '另一台裝置的名稱');
    await connectCloud();
    expect(store.getState().docs.find((item) => item.id === doc.id)?.data['name']).toBe('另一台裝置的名稱');
    expect(stateOf(doc.id)).toBe('synced');
    expect(cloudUpdatesSignal.get()?.count).toBe(1);

    // Both sides change: a plain upload is refused by the host instead of overwriting.
    await editElsewhere(doc.id, '雲端版本');
    const local = store.getState().docs.find((item) => item.id === doc.id)!;
    store.updateDocument(doc.id, { ...local.data, name: '本機版本' });
    await connectCloud();
    expect(stateOf(doc.id)).toBe('conflict');
    await expect(uploadDocument(doc.id)).rejects.toMatchObject({ code: 'conflict' });
    expect(host.snapshot().drafts[0]?.record.data['name']).toBe('雲端版本');

    // Keeping both: the cloud copy becomes a new local document; the local edit stays.
    const copyId = downloadDraft(doc.id, 'copy');
    expect(copyId).not.toBe(doc.id);
    expect(store.getState().docs.find((item) => item.id === copyId)?.data['name']).toBe('雲端版本');
    // Keeping local: an explicit overwrite.
    await uploadDocument(doc.id, { overwrite: true });
    expect(host.snapshot().drafts.find((item) => item.record.id === doc.id)?.record.data['name']).toBe('本機版本');
    expect(stateOf(doc.id)).toBe('synced');
  });

  it('downloads cloud-only drafts under the same id and deletes cloud copies with a revision check', async () => {
    useHost();
    const record = createRecord({ id: 'fromother01', title: '', templateId: 'faq', data: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] }, updatedAt: 5 });
    if (!record.ok) throw new Error(record.code);
    await host.saveDraft({ record: record.record, expectedRevision: null, idempotencyKey: 'seed_000000000000001' });
    await connectCloud();
    expect(stateOf('fromother01')).toBe('cloud-only');
    expect(downloadDraft('fromother01', 'replace')).toBe('fromother01');
    expect(stateOf('fromother01')).toBe('synced');
    await deleteCloudDraft('fromother01');
    expect(host.snapshot().drafts).toEqual([]);
    expect(stateOf('fromother01')).toBe('local-only');
    expect(syncMetaSignal.get()['fromother01']).toBeUndefined();
  });

  it('adopts matching copies found on refresh so later edits read as local changes', async () => {
    useHost();
    const doc = store.createDocument('organization')!;
    const record = createRecord({ id: doc.id, title: doc.title, templateId: doc.templateId, data: doc.data, updatedAt: doc.updatedAt });
    if (!record.ok) throw new Error(record.code);
    await host.saveDraft({ record: record.record, expectedRevision: null, idempotencyKey: 'seed_000000000000002' });
    await connectCloud();
    expect(stateOf(doc.id)).toBe('synced');
    store.updateDocument(doc.id, { ...doc.data, name: 'Edited' });
    expect(stateOf(doc.id)).toBe('local-changes');
  });
});

describe('publishing', () => {
  it('publishes only synced main entities and FAQ drafts', async () => {
    useHost({ account: { displayName: 'A' } });
    const main = store.createDocument('organization')!;
    store.updateDocument(main.id, { ...main.data, name: 'Synthetic Co', url: 'https://example.com/' });
    const faq = store.createDocument('faq')!;
    await connectCloud();
    await expect(publishDocuments(main.id, null)).rejects.toMatchObject({ code: 'conflict' });
    await uploadDocument(main.id);
    await uploadDocument(faq.id);
    const result = await publishDocuments(main.id, faq.id);
    expect(result).toEqual({ publishedAt: '2026-09-24T00:00:00.000Z', officialScore: { score: 88, grade: 'A' } });
    expect(ready().published?.storeObj.mainSchema['name']).toBe('Synthetic Co');
    // A local edit after syncing blocks publishing until it is uploaded.
    const edited = store.getState().docs.find((item) => item.id === main.id)!;
    store.updateDocument(main.id, { ...edited.data, name: 'Unsynced' });
    await expect(publishDocuments(main.id, null)).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('sync bookkeeping', () => {
  it('computes states from content and last confirmed revision', () => {
    const doc = { id: 'doc00000001', title: '', templateId: 'organization' as const, data: { '@type': 'Organization', name: 'A' }, createdAt: 1, updatedAt: 1, revision: 0 };
    const record = { format: 'truelink.schema-document' as const, version: 1 as const, id: doc.id, title: '', templateId: doc.templateId, data: doc.data, updatedAt: 1 };
    const draft = { record, revision: 2, savedAt: '2026-09-24T00:00:00.000Z' };
    const hash = contentHash(doc);
    expect(syncState(doc, draft, undefined)).toBe('synced');
    const changed = { ...doc, data: { '@type': 'Organization', name: 'B' } };
    expect(syncState(changed, draft, { revision: 2, hash })).toBe('local-changes');
    expect(syncState(changed, draft, undefined)).toBe('conflict');
    expect(syncState(doc, { ...draft, revision: 3, record: { ...record, data: { '@type': 'Organization', name: 'C' } } }, { revision: 2, hash })).toBe('cloud-changes');
    expect(syncState(doc, undefined, undefined)).toBe('local-only');
    expect(syncState(undefined, draft, undefined)).toBe('cloud-only');
  });

  it('ignores malformed stored bookkeeping', () => {
    expect(parseSyncMeta('not json')).toEqual({});
    expect(parseSyncMeta(JSON.stringify({ 'bad/id': { revision: 1, hash: '00000000' }, doc00000001: { revision: 0, hash: 'zz' }, doc00000002: { revision: 3, hash: '0123abcd' } }))).toEqual({
      doc00000002: { revision: 3, hash: '0123abcd' },
    });
    expect(parseSyncMeta(JSON.stringify({ __proto__: { revision: 1, hash: '00000000' } }))).toEqual({});
  });
});

describe('staying in step with TrueLink', () => {
  it('refreshes on change notices and applies updates to unchanged linked documents', async () => {
    useHost();
    const doc = store.createDocument('organization')!;
    await connectCloud();
    await uploadDocument(doc.id);
    // Another TrueLink tool saves a newer version and the host announces it.
    await editElsewhere(doc.id, '網頁工具更新的名稱');
    servers.at(-1)!.notifyChanged('drafts');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().docs.find((item) => item.id === doc.id)?.data['name']).toBe('網頁工具更新的名稱');
    expect(stateOf(doc.id)).toBe('synced');
  });

  it('never overwrites local edits when the cloud moves on', async () => {
    useHost();
    const doc = store.createDocument('organization')!;
    await connectCloud();
    await uploadDocument(doc.id);
    const current = store.getState().docs.find((item) => item.id === doc.id)!;
    store.updateDocument(doc.id, { ...current.data, name: '本機尚未上傳的修改' });
    await editElsewhere(doc.id, '雲端的新名稱');
    servers.at(-1)!.notifyChanged('drafts');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().docs.find((item) => item.id === doc.id)?.data['name']).toBe('本機尚未上傳的修改');
    expect(stateOf(doc.id)).toBe('conflict');
  });

  it('asks an outdated tab to reload before it can sync', async () => {
    useHost({ account: { displayName: 'A' } }, '99.0.0');
    await connectCloud();
    expect(cloudSignal.get()).toEqual({ phase: 'outdated', required: '99.0.0' });
    await expect(uploadDocument('doc00000001')).rejects.toMatchObject({ code: 'unavailable' });
  });
});
