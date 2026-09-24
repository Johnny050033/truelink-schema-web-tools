import { useSyncExternalStore } from 'react';
import { cloneJson, createDocumentData, LIMITS, utf8Bytes, type JsonObject, type Locale, type TemplateId } from 'truelink-schema-document';
import { LOCAL_LIMITS } from '../config';
import {
  defaultPreferences,
  emptyBrand,
  isQuotaError,
  parseBrand,
  parseDocs,
  parsePreferences,
  STORAGE_KEYS,
  type BrandProfile,
  type KeyValueStorage,
  type Preferences,
  type SchemaDoc,
  type SliceName,
} from './persistence';

export type StorageProblem = 'quota' | 'limit' | 'document-too-large';

export interface StorageStatus {
  readonly available: boolean;
  readonly problem: StorageProblem | undefined;
  readonly savedAt: number | undefined;
  /** Some stored data was unreadable; the raw text was preserved under a `:corrupt` key. */
  readonly recovered: boolean;
}

export interface AppState {
  readonly docs: readonly SchemaDoc[];
  readonly brand: BrandProfile;
  readonly prefs: Preferences;
  readonly storage: StorageStatus;
}

export interface NewDocumentInput {
  readonly templateId: TemplateId;
  readonly data: JsonObject;
  readonly title?: string;
}

function randomId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface StoreOptions {
  readonly storage: KeyValueStorage | null;
  readonly locale: Locale;
  readonly now?: () => number;
  readonly makeId?: () => string;
  /** Debounce for writes; flush() writes immediately. */
  readonly writeDelayMs?: number;
}

export function createAppStore(options: StoreOptions) {
  const storage = options.storage;
  const now = options.now ?? Date.now;
  const makeId = options.makeId ?? randomId;
  const delay = options.writeDelayMs ?? 300;
  const listeners = new Set<() => void>();
  const dirty = new Set<SliceName>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function read(key: string): string | null {
    try {
      return storage ? storage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  function preserveCorrupt(key: string, raw: string | null): void {
    if (!storage || raw === null) return;
    try {
      storage.setItem(`${key}:corrupt`, raw);
    } catch {
      /* best effort */
    }
  }

  const rawDocs = read(STORAGE_KEYS.docs);
  const docsResult = parseDocs(rawDocs);
  if (docsResult.corrupt || docsResult.dropped > 0) preserveCorrupt(STORAGE_KEYS.docs, rawDocs);
  const rawBrand = read(STORAGE_KEYS.brand);
  const brandResult = parseBrand(rawBrand);
  if (brandResult.corrupt) preserveCorrupt(STORAGE_KEYS.brand, rawBrand);

  let state: AppState = {
    docs: docsResult.docs,
    brand: brandResult.brand,
    prefs: parsePreferences(read(STORAGE_KEYS.prefs), options.locale),
    storage: {
      available: storage !== null,
      problem: undefined,
      savedAt: undefined,
      recovered: docsResult.corrupt || docsResult.dropped > 0 || brandResult.corrupt,
    },
  };

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function setState(next: AppState, changed: readonly SliceName[] = []): void {
    state = next;
    for (const slice of changed) dirty.add(slice);
    if (changed.length > 0) schedule();
    emit();
  }

  function schedule(): void {
    if (!storage) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }

  function serialized(slice: SliceName): string {
    if (slice === 'docs') return JSON.stringify(state.docs);
    if (slice === 'brand') return JSON.stringify(state.brand);
    return JSON.stringify(state.prefs);
  }

  /** Writes pending slices. Limits block the write and keep the in-memory edits. */
  function flush(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!storage || dirty.size === 0) return;
    let problem: StorageProblem | undefined;
    const texts = { docs: serialized('docs'), brand: serialized('brand'), prefs: serialized('prefs') };
    const total = utf8Bytes(texts.docs) + utf8Bytes(texts.brand) + utf8Bytes(texts.prefs);
    for (const slice of [...dirty]) {
      if (slice === 'docs' && state.docs.some((doc) => utf8Bytes(JSON.stringify(doc.data)) > LIMITS.documentBytes)) {
        problem = 'document-too-large';
        continue;
      }
      if (slice !== 'prefs' && total > LOCAL_LIMITS.maxTotalBytes) {
        problem = 'limit';
        continue;
      }
      try {
        storage.setItem(STORAGE_KEYS[slice], texts[slice]);
        dirty.delete(slice);
      } catch (error) {
        // Quota errors are the expected failure; any other storage error is
        // reported the same way because the remedy (export, free space) is too.
        if (!isQuotaError(error)) console.warn('Local save failed', error);
        problem = 'quota';
      }
    }
    state = { ...state, storage: { ...state.storage, problem, savedAt: problem ? state.storage.savedAt : now() } };
    emit();
  }

  function touch(doc: SchemaDoc, patch: Partial<Omit<SchemaDoc, 'id' | 'createdAt' | 'revision' | 'updatedAt'>>): SchemaDoc {
    return { ...doc, ...patch, updatedAt: now(), revision: doc.revision + 1 };
  }

  function replaceDoc(id: string, update: (doc: SchemaDoc) => SchemaDoc): void {
    let changed = false;
    const docs = state.docs.map((doc) => {
      if (doc.id !== id) return doc;
      changed = true;
      return update(doc);
    });
    if (changed) setState({ ...state, docs }, ['docs']);
  }

  function makeDoc(input: NewDocumentInput): SchemaDoc {
    const time = now();
    return { id: makeId(), title: (input.title ?? '').slice(0, 120), templateId: input.templateId, data: cloneJson(input.data), createdAt: time, updatedAt: time, revision: 0 };
  }

  const actions = {
    canCreate(count = 1): boolean {
      return state.docs.length + count <= LOCAL_LIMITS.maxDocuments;
    },
    createDocument(templateId: TemplateId): SchemaDoc | undefined {
      if (!actions.canCreate()) return undefined;
      const data = createDocumentData(templateId, { locale: state.prefs.locale, brand: state.brand.data });
      const doc = makeDoc({ templateId, data });
      setState({ ...state, docs: [doc, ...state.docs] }, ['docs']);
      return doc;
    },
    importDocuments(items: readonly NewDocumentInput[]): SchemaDoc[] {
      const room = Math.max(0, LOCAL_LIMITS.maxDocuments - state.docs.length);
      const created = items.slice(0, room).map(makeDoc);
      if (created.length > 0) setState({ ...state, docs: [...created, ...state.docs] }, ['docs']);
      return created;
    },
    updateDocument(id: string, data: JsonObject): void {
      replaceDoc(id, (doc) => (doc.data === data ? doc : touch(doc, { data })));
    },
    renameDocument(id: string, title: string): void {
      replaceDoc(id, (doc) => touch(doc, { title: title.slice(0, 120) }));
    },
    changeTemplate(id: string, templateId: TemplateId): void {
      replaceDoc(id, (doc) => touch(doc, { templateId }));
    },
    duplicateDocument(id: string, suffix: string): SchemaDoc | undefined {
      const source = state.docs.find((doc) => doc.id === id);
      if (!source || !actions.canCreate()) return undefined;
      const copy = makeDoc({ templateId: source.templateId, data: source.data, title: source.title ? `${source.title}${suffix}` : '' });
      setState({ ...state, docs: [copy, ...state.docs] }, ['docs']);
      return copy;
    },
    deleteDocument(id: string): SchemaDoc | undefined {
      const doc = state.docs.find((item) => item.id === id);
      if (!doc) return undefined;
      setState({ ...state, docs: state.docs.filter((item) => item.id !== id) }, ['docs']);
      return doc;
    },
    restoreDocument(doc: SchemaDoc): boolean {
      if (state.docs.some((item) => item.id === doc.id) || !actions.canCreate()) return false;
      const docs = [...state.docs, doc].sort((a, b) => b.updatedAt - a.updatedAt);
      setState({ ...state, docs }, ['docs']);
      return true;
    },
    setBrand(data: JsonObject): void {
      if (data === state.brand.data) return;
      setState({ ...state, brand: { data, updatedAt: now() } }, ['brand']);
    },
    setPreferences(patch: Partial<Preferences>): void {
      setState({ ...state, prefs: { ...state.prefs, ...patch } }, ['prefs']);
    },
    recordExport(): number {
      const exportCount = state.prefs.exportCount + 1;
      setState({ ...state, prefs: { ...state.prefs, exportCount } }, ['prefs']);
      return exportCount;
    },
    clearAll(): void {
      setState({ ...state, docs: [], brand: emptyBrand(), prefs: { ...defaultPreferences(state.prefs.locale), theme: state.prefs.theme } }, ['docs', 'brand', 'prefs']);
      flush();
    },
    dismissRecovered(): void {
      setState({ ...state, storage: { ...state.storage, recovered: false } });
    },
  };

  /** Applies a change another tab wrote to the same storage key. */
  function applyExternal(key: string | null, value: string | null): void {
    if (key === STORAGE_KEYS.docs) {
      const incoming = parseDocs(value).docs;
      if (!dirty.has('docs')) {
        state = { ...state, docs: incoming };
      } else {
        const merged = new Map(state.docs.map((doc) => [doc.id, doc]));
        for (const doc of incoming) {
          const local = merged.get(doc.id);
          if (!local || local.updatedAt < doc.updatedAt) merged.set(doc.id, doc);
        }
        state = { ...state, docs: [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, LOCAL_LIMITS.maxDocuments) };
      }
      emit();
    } else if (key === STORAGE_KEYS.brand && !dirty.has('brand')) {
      state = { ...state, brand: parseBrand(value).brand };
      emit();
    } else if (key === STORAGE_KEYS.prefs && !dirty.has('prefs')) {
      state = { ...state, prefs: parsePreferences(value, state.prefs.locale) };
      emit();
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    flush,
    applyExternal,
    hasPendingWrites: () => dirty.size > 0,
    ...actions,
  };
}

export type AppStore = ReturnType<typeof createAppStore>;

let singleton: AppStore | undefined;

export function initStore(store: AppStore): AppStore {
  singleton = store;
  return store;
}

export function getStore(): AppStore {
  if (!singleton) throw new Error('Store has not been initialised.');
  return singleton;
}

/** Subscribes to a slice of state. Selectors must return stable references. */
export function useAppState<T>(selector: (state: AppState) => T): T {
  const store = getStore();
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}
