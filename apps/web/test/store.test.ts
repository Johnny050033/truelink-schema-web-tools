import { describe, expect, it } from 'vitest';
import { LOCAL_LIMITS } from '../src/config';
import { STORAGE_KEYS, type KeyValueStorage } from '../src/lib/persistence';
import { createAppStore } from '../src/lib/store';

class MemoryStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('full', 'QuotaExceededError');
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

function setup(storage = new MemoryStorage()) {
  let id = 0;
  let time = 1_000;
  const store = createAppStore({ storage, locale: 'zh-TW', now: () => (time += 10), makeId: () => `id-${++id}`, writeDelayMs: 60_000 });
  return { store, storage };
}

describe('app store', () => {
  it('creates documents prefilled from the brand profile and persists on flush', () => {
    const { store, storage } = setup();
    store.setBrand({ '@type': 'Organization', name: '示範品牌', url: 'https://example.com/' });
    const doc = store.createDocument('website');
    expect(doc?.data).toMatchObject({ name: '示範品牌', url: 'https://example.com/', publisher: { name: '示範品牌' } });
    expect(storage.map.has(STORAGE_KEYS.docs)).toBe(false);
    store.flush();
    expect(JSON.parse(storage.map.get(STORAGE_KEYS.docs)!)).toHaveLength(1);
    expect(store.getState().storage.savedAt).toBeDefined();
  });

  it('reloads saved state into a new store', () => {
    const { store, storage } = setup();
    const doc = store.createDocument('faq')!;
    store.renameDocument(doc.id, '常見問題');
    store.setPreferences({ theme: 'dark' });
    store.flush();
    const reloaded = setup(storage).store.getState();
    expect(reloaded.docs.map((item) => item.title)).toEqual(['常見問題']);
    expect(reloaded.prefs.theme).toBe('dark');
  });

  it('tracks revisions and supports delete with restore', () => {
    const { store } = setup();
    const doc = store.createDocument('organization')!;
    store.updateDocument(doc.id, { ...doc.data, name: 'A' });
    store.updateDocument(doc.id, { ...doc.data, name: 'B' });
    expect(store.getState().docs[0]?.revision).toBe(2);
    const removed = store.deleteDocument(doc.id)!;
    expect(store.getState().docs).toHaveLength(0);
    expect(store.restoreDocument(removed)).toBe(true);
    expect(store.restoreDocument(removed)).toBe(false);
  });

  it('never exceeds the local document limit', () => {
    const { store } = setup();
    for (let index = 0; index < LOCAL_LIMITS.maxDocuments; index += 1) expect(store.createDocument('thing')).toBeDefined();
    expect(store.createDocument('thing')).toBeUndefined();
    expect(store.importDocuments([{ templateId: 'thing', data: { '@type': 'Thing' } }])).toHaveLength(0);
    expect(store.duplicateDocument(store.getState().docs[0]!.id, ' copy')).toBeUndefined();
  });

  it('keeps edits in memory and reports quota failures instead of losing data', () => {
    const { store, storage } = setup();
    const doc = store.createDocument('organization')!;
    storage.failWrites = true;
    store.updateDocument(doc.id, { ...doc.data, name: 'Unsaved but kept' });
    store.flush();
    expect(store.getState().storage.problem).toBe('quota');
    expect(store.getState().docs[0]?.data['name']).toBe('Unsaved but kept');
    expect(store.hasPendingWrites()).toBe(true);
    storage.failWrites = false;
    store.flush();
    expect(store.getState().storage.problem).toBeUndefined();
    expect(JSON.parse(storage.map.get(STORAGE_KEYS.docs)!)[0].data.name).toBe('Unsaved but kept');
  });

  it('refuses to save an oversized document but keeps it in memory', () => {
    const { store, storage } = setup();
    const doc = store.createDocument('thing')!;
    store.flush();
    store.updateDocument(doc.id, { ...doc.data, description: 'x'.repeat(19_000), alternateName: 'y'.repeat(19_000), disambiguatingDescription: 'z'.repeat(19_000), slogan: 'w'.repeat(19_000), keywords: ['v'.repeat(19_000), 'u'.repeat(19_000)] });
    store.flush();
    expect(store.getState().storage.problem).toBe('document-too-large');
    expect(JSON.parse(storage.map.get(STORAGE_KEYS.docs)!)[0].data.description).toBeUndefined();
  });

  it('preserves unreadable stored data under a separate key', () => {
    const storage = new MemoryStorage();
    storage.map.set(STORAGE_KEYS.docs, '{broken');
    const { store } = setup(storage);
    expect(store.getState().storage.recovered).toBe(true);
    expect(storage.map.get(`${STORAGE_KEYS.docs}:corrupt`)).toBe('{broken');
    expect(store.getState().docs).toEqual([]);
  });

  it('merges changes written by another tab', () => {
    const { store } = setup();
    const doc = store.createDocument('organization')!;
    store.flush();
    const other = { ...doc, id: 'other-tab', updatedAt: doc.updatedAt + 1_000 };
    store.applyExternal(STORAGE_KEYS.docs, JSON.stringify([other, doc]));
    expect(store.getState().docs.map((item) => item.id).sort()).toEqual([doc.id, 'other-tab'].sort());
    store.applyExternal(STORAGE_KEYS.prefs, JSON.stringify({ theme: 'light', locale: 'en', exportCount: 0, nudgeDismissedAt: 0, installDismissedAt: 0 }));
    expect(store.getState().prefs.locale).toBe('en');
  });

  it('works without storage (private mode) and says so', () => {
    const store = createAppStore({ storage: null, locale: 'en' });
    expect(store.getState().storage.available).toBe(false);
    expect(store.createDocument('faq')).toBeDefined();
    store.flush();
    expect(store.getState().docs).toHaveLength(1);
  });
});
