import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CloudError, createHostClient, createLinkedTransports, createMemoryHost, serveHost, type MemoryHost } from 'truelink-schema-cloud';
import { createRecord, type SchemaDocumentRecord } from 'truelink-schema-document';
import { cloudSignal, configureCloud, connectCloud, refreshCloud } from '../src/lib/cloud';
import {
  configurePendingStorage,
  handoffOrigins,
  HANDOFF_CHANNEL,
  HANDOFF_VERSION,
  importPending,
  loadPendingImport,
  PENDING_IMPORT_KEY,
  PENDING_TTL_MS,
  pendingImportSignal,
  readPending,
  receiveHandoff,
  sendToCloud,
  validateRecords,
  writePending,
  type HandoffPeer,
  type HandoffWindow,
} from '../src/lib/handoff';
import type { KeyValueStorage } from '../src/lib/persistence';
import { createAppStore, initStore, type AppStore } from '../src/lib/store';

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

const PAGES = 'https://johnny050033.github.io';
const APP = 'https://app.truelink-group.com';
const NOW = 1_800_000_000_000;

function record(id: string, name: string): SchemaDocumentRecord {
  const result = createRecord({ id, title: name, templateId: 'organization', data: { name }, updatedAt: 1 });
  if (!result.ok) throw new Error(result.code);
  return result.record;
}

/** A tiny event-bus window: tests drive message delivery explicitly. */
function fakeWindow(extra: Partial<HandoffWindow> = {}) {
  const listeners = new Set<(event: MessageEvent) => void>();
  const timers: (() => void)[] = [];
  const win: HandoffWindow & { dispatch(data: unknown, origin: string, source: unknown): void; fireTimers(): void } = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    setTimeout: (handler) => {
      timers.push(handler);
      return timers.length;
    },
    clearTimeout: () => undefined,
    dispatch(data, origin, source) {
      for (const listener of [...listeners]) listener({ data, origin, source } as MessageEvent);
    },
    fireTimers() {
      for (const timer of timers.splice(0)) timer();
    },
    ...extra,
  };
  return win;
}

function peer(): HandoffPeer & { sent: { message: any; origin: string }[]; closed: boolean } {
  const sent: { message: any; origin: string }[] = [];
  return { sent, closed: false, postMessage: (message, origin) => sent.push({ message, origin }) };
}

let storage: MemoryStorage;
let store: AppStore;
let host: MemoryHost;

function useHost(account: { displayName: string } | null = { displayName: 'Synthetic Member' }, target?: MemoryHost) {
  host = target ?? createMemoryHost({ now: () => new Date('2026-10-11T00:00:00.000Z'), account });
  let keys = 0;
  configureCloud({
    createClient() {
      const { client, host: hostSide } = createLinkedTransports();
      serveHost(host, hostSide);
      return createHostClient(client, { hostOrigin: APP, timeoutMs: 500, readyTimeoutMs: 500 });
    },
    navigate: () => undefined,
    makeKey: () => `key_${String(++keys).padStart(16, '0')}`,
    storage,
  });
}

beforeEach(() => {
  storage = new MemoryStorage();
  let id = 0;
  store = initStore(createAppStore({ storage, locale: 'zh-TW', makeId: () => `doc${String(++id).padStart(8, '0')}`, writeDelayMs: 60_000 }));
  configurePendingStorage(storage);
});

afterEach(() => {
  configureCloud(null);
  configurePendingStorage(null);
});

describe('validation and pending storage', () => {
  it('accepts valid records, drops duplicate ids and rejects empty, oversized or malformed input', () => {
    const ok = validateRecords([record('pagesDoc0001', 'A'), record('pagesDoc0001', 'A again'), record('pagesDoc0002', 'B')]);
    expect(ok.ok && ok.records.map((r) => r.id)).toEqual(['pagesDoc0001', 'pagesDoc0002']);
    expect(validateRecords([])).toEqual({ ok: false, reason: 'empty' });
    expect(validateRecords('nope')).toEqual({ ok: false, reason: 'empty' });
    expect(validateRecords(Array.from({ length: 21 }, (_, i) => record(`pagesDoc${String(i).padStart(4, '0')}`, 'x')))).toEqual({ ok: false, reason: 'too-many' });
    expect(validateRecords([{ ...record('pagesDoc0003', 'C'), __proto__: { evil: 1 }, extra: 1 }])).toEqual({ ok: false, reason: 'invalid-record' });
  });

  it('only allows exact https origins for the handoff', () => {
    expect(handoffOrigins(undefined)).toEqual([PAGES]);
    expect(handoffOrigins('https://a.example, http://b.example, https://c.example/path, https://u:p@d.example')).toEqual(['https://a.example']);
  });

  it('keeps a pending import across reloads, expires it after a day and clears corrupt data', () => {
    writePending(storage, { records: [record('pagesDoc0001', 'A')], sourceOrigin: PAGES, receivedAt: NOW });
    expect(readPending(storage, NOW + 1000)?.records).toHaveLength(1);
    expect(readPending(storage, NOW + PENDING_TTL_MS + 1)).toBeNull();
    expect(storage.getItem(PENDING_IMPORT_KEY)).toBeNull();
    storage.setItem(PENDING_IMPORT_KEY, '{not json');
    expect(readPending(storage, NOW)).toBeNull();
    expect(storage.getItem(PENDING_IMPORT_KEY)).toBeNull();
  });
});

describe('cross-origin handoff', () => {
  it('hosted side accepts one records message only from the opener, the allowed origin and its own nonce', () => {
    const opener = peer();
    const win = fakeWindow({ opener });
    let received = 0;
    receiveHandoff({ win, origins: [PAGES], storage, now: () => NOW, onReceived: () => (received += 1) });
    const ready = opener.sent[0]!;
    expect(ready.origin).toBe(PAGES);
    expect(ready.message).toMatchObject({ channel: HANDOFF_CHANNEL, type: 'ready' });
    const nonce = ready.message.nonce as string;
    const records = [record('pagesDoc0001', 'A')];
    const message = { channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'records', nonce, records };
    win.dispatch(message, 'https://evil.example', opener);
    win.dispatch(message, PAGES, peer());
    win.dispatch({ ...message, nonce: 'x'.repeat(32) }, PAGES, opener);
    expect(storage.getItem(PENDING_IMPORT_KEY)).toBeNull();
    win.dispatch(message, PAGES, opener);
    expect(received).toBe(1);
    expect(readPending(storage, NOW)?.records.map((r) => r.id)).toEqual(['pagesDoc0001']);
    expect(opener.sent.at(-1)).toEqual({ origin: PAGES, message: { channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'ack', nonce, count: 1 } });
    // A second records message (replay) is ignored.
    win.dispatch({ ...message, records: [record('pagesDoc0009', 'Z')] }, PAGES, opener);
    expect(received).toBe(1);
    expect(readPending(storage, NOW)?.records.map((r) => r.id)).toEqual(['pagesDoc0001']);
  });

  it('hosted side does nothing without an opener', () => {
    const win = fakeWindow({ opener: null });
    receiveHandoff({ win, origins: [PAGES], storage });
    expect(storage.getItem(PENDING_IMPORT_KEY)).toBeNull();
  });

  it('public side sends records only after the exact TrueLink window says ready, and resolves on ack', async () => {
    const popup = peer();
    const win = fakeWindow({ open: () => popup });
    const records = [record('pagesDoc0001', 'A')];
    const sending = sendToCloud(records, { win, targetUrl: `${APP}/studio/` });
    win.dispatch({ channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'ready', nonce: 'n'.repeat(32) }, 'https://evil.example', popup);
    expect(popup.sent).toHaveLength(0);
    win.dispatch({ channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'ready', nonce: 'n'.repeat(32) }, APP, popup);
    expect(popup.sent[0]).toEqual({ origin: APP, message: { channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'records', nonce: 'n'.repeat(32), records } });
    win.dispatch({ channel: HANDOFF_CHANNEL, version: HANDOFF_VERSION, type: 'ack', nonce: 'n'.repeat(32), count: 1 }, APP, popup);
    await expect(sending).resolves.toBe(1);
  });

  it('public side reports a blocked pop-up and a timeout without losing local documents', async () => {
    await expect(sendToCloud([record('pagesDoc0001', 'A')], { win: fakeWindow({ open: () => null }) })).rejects.toThrow('popup-blocked');
    const win = fakeWindow({ open: () => peer() });
    const sending = sendToCloud([record('pagesDoc0001', 'A')], { win, targetUrl: `${APP}/studio/` });
    win.fireTimers();
    await expect(sending).rejects.toThrow('timeout');
  });
});

describe('confirmed import', () => {
  function pend(records: SchemaDocumentRecord[]) {
    writePending(storage, { records, sourceOrigin: PAGES, receivedAt: Date.now() });
    loadPendingImport();
  }

  it('login interruption: signed out, nothing uploads and the pending import is kept; after sign-in it imports', async () => {
    useHost(null);
    pend([record('pagesDoc0001', 'A')]);
    await connectCloud();
    expect(cloudSignal.get().phase).toBe('signed-out');
    await expect(importPending()).rejects.toBeInstanceOf(CloudError);
    expect(host.snapshot().drafts).toHaveLength(0);
    expect(readPending(storage)?.records).toHaveLength(1);
    host.signIn({ displayName: 'Synthetic Member' });
    await refreshCloud();
    const results = await importPending();
    expect(results.map((r) => r.outcome)).toEqual(['imported']);
    expect(host.snapshot().drafts.map((d) => d.record.id)).toEqual(['pagesDoc0001']);
    expect(store.getState().docs.map((d) => d.id)).toContain('pagesDoc0001');
    expect(pendingImportSignal.get()).toBeNull();
    expect(storage.getItem(PENDING_IMPORT_KEY)).toBeNull();
  });

  it('duplicate import: handing the same document over again creates no second draft', async () => {
    useHost();
    await connectCloud();
    pend([record('pagesDoc0001', 'A')]);
    await importPending();
    pend([record('pagesDoc0001', 'A')]);
    const again = await importPending();
    expect(again.map((r) => r.outcome)).toEqual(['already-imported']);
    expect(host.snapshot().drafts).toHaveLength(1);
  });

  it('draft not lost: a local document with the same id but different content keeps its edits; the incoming one becomes a copy', async () => {
    useHost();
    await connectCloud();
    store.putDocument({ id: 'pagesDoc0001', title: 'Edited here', templateId: 'organization', data: { name: 'Edited here' } });
    pend([record('pagesDoc0001', 'From Pages')]);
    const results = await importPending();
    expect(results[0]?.outcome).toBe('kept-as-copy');
    const local = store.getState().docs.find((d) => d.id === 'pagesDoc0001');
    expect(local?.title).toBe('Edited here');
    expect(store.getState().docs.some((d) => d.id !== 'pagesDoc0001' && d.title === 'From Pages')).toBe(true);
    expect(host.snapshot().drafts.map((d) => d.record.title)).toEqual(['From Pages']);
  });

  it('a different cloud version is reported as a conflict, not overwritten', async () => {
    useHost();
    await host.saveDraft({ record: record('pagesDoc0001', 'Cloud version'), expectedRevision: null, idempotencyKey: 'seed_000000000001' });
    await connectCloud();
    pend([record('pagesDoc0001', 'From Pages')]);
    const results = await importPending();
    expect(results[0]?.outcome).toBe('conflict');
    expect(host.snapshot().drafts.map((d) => d.record.title)).toEqual(['Cloud version']);
  });

  it('account isolation: the import goes only to the signed-in account; another account sees nothing', async () => {
    const memberA = createMemoryHost({ account: { displayName: 'Member A' } });
    const memberB = createMemoryHost({ account: { displayName: 'Member B' } });
    useHost(undefined, memberA);
    await connectCloud();
    pend([record('pagesDoc0001', 'A')]);
    await importPending();
    configureCloud(null);
    useHost(undefined, memberB);
    await connectCloud();
    const state = cloudSignal.get();
    expect(state.phase === 'ready' && state.drafts).toEqual([]);
    expect(memberA.snapshot().drafts).toHaveLength(1);
    expect(memberB.snapshot().drafts).toHaveLength(0);
  });

  it('a failed upload stays pending and a retry finishes it', async () => {
    useHost();
    await connectCloud();
    const original = host.saveDraft.bind(host);
    let failOnce = true;
    host.saveDraft = async (input) => {
      if (failOnce) {
        failOnce = false;
        throw new CloudError('unavailable', 'synthetic outage');
      }
      return original(input);
    };
    pend([record('pagesDoc0001', 'A'), record('pagesDoc0002', 'B')]);
    const first = await importPending();
    expect(first.map((r) => r.outcome).sort()).toEqual(['failed', 'imported']);
    expect(readPending(storage)?.records).toHaveLength(1);
    const retry = await importPending();
    expect(retry.map((r) => r.outcome)).toEqual(['imported']);
    expect(host.snapshot().drafts).toHaveLength(2);
    expect(storage.getItem(PENDING_IMPORT_KEY)).toBeNull();
  });
});
