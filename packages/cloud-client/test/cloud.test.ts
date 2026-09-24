import { afterEach, describe, expect, it } from 'vitest';
import { createRecord, type SchemaDocumentRecord } from 'truelink-schema-document';
import {
  CHANNEL,
  CloudError,
  compareVersions,
  createHostClient,
  createLinkedTransports,
  createMemoryHost,
  parsePublishInput,
  parseSaveInput,
  parseSignInUrl,
  PROTOCOL_VERSION,
  serveHost,
  windowTransport,
  type HostClient,
  type MemoryHostOptions,
  type Transport,
} from '../src/index.js';

const ORIGIN = 'https://app.truelink-group.com';

function record(id: string, fields: Partial<SchemaDocumentRecord> = {}): SchemaDocumentRecord {
  const result = createRecord({
    id,
    title: '',
    templateId: fields.templateId ?? 'organization',
    data: fields.data ?? { '@context': 'https://schema.org', '@type': 'Organization', name: `Synthetic ${id}`, url: 'https://example.com/' },
    updatedAt: fields.updatedAt ?? 1,
  });
  if (!result.ok) throw new Error(result.code);
  return result.record;
}

let keyCounter = 0;
const key = () => `key_${String((keyCounter += 1)).padStart(16, '0')}`;

const open: HostClient[] = [];
afterEach(() => {
  for (const client of open.splice(0)) client.close();
});

function connect(options: MemoryHostOptions = { account: { displayName: 'Synthetic User' } }) {
  const host = createMemoryHost({ now: () => new Date('2026-09-24T00:00:00.000Z'), ...options });
  const { client: clientSide, host: hostSide } = createLinkedTransports();
  const server = serveHost(host, hostSide);
  const client = createHostClient(clientSide, { hostOrigin: ORIGIN, timeoutMs: 500, readyTimeoutMs: 500 });
  open.push(client);
  return { host, server, client };
}

async function rejection(promise: Promise<unknown>): Promise<CloudError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CloudError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}

describe('host bridge handshake', () => {
  it('announces the supported methods, including optional scoring only when implemented', async () => {
    const plain = connect();
    expect(await plain.client.ready()).not.toContain('score');
    const scored = connect({ account: { displayName: 'A' }, score: () => ({ score: 80, grade: 'B' }) });
    expect(await scored.client.ready()).toContain('score');
    expect(scored.client.supports('publish')).toBe(true);
  });

  it('reports an unavailable host instead of hanging', async () => {
    const silent: Transport = { send: () => undefined, subscribe: () => () => undefined };
    const client = createHostClient(silent, { hostOrigin: ORIGIN, readyTimeoutMs: 20 });
    open.push(client);
    expect((await rejection(client.getAccount())).code).toBe('unavailable');
  });

  it('times out requests the host never answers', async () => {
    const { client: clientSide, host: hostSide } = createLinkedTransports();
    hostSide.subscribe(() => undefined);
    hostSide.send({ channel: CHANNEL, version: PROTOCOL_VERSION, kind: 'ready', methods: ['account.get'] });
    const client = createHostClient(clientSide, { hostOrigin: ORIGIN, timeoutMs: 20 });
    open.push(client);
    expect((await rejection(client.getAccount())).code).toBe('timeout');
  });
});

describe('accounts', () => {
  it('requires sign-in for drafts and forwards account changes', async () => {
    const { client, host, server } = connect({ account: null });
    expect(await client.getAccount()).toBeNull();
    expect((await rejection(client.listDrafts())).code).toBe('signed-out');
    const seen: unknown[] = [];
    client.onAccountChange((account) => seen.push(account));
    host.signIn({ displayName: 'Synthetic User' });
    server.notifyAccount({ displayName: 'Synthetic User' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen).toEqual([{ displayName: 'Synthetic User' }]);
    expect(await client.listDrafts()).toEqual([]);
  });

  it('only accepts sign-in URLs on the host origin', async () => {
    const { client } = connect({ account: null, signInUrl: '/login.html?next=%2Fstudio%2F' });
    expect(await client.signInUrl()).toBe(`${ORIGIN}/login.html?next=%2Fstudio%2F`);
    expect(() => parseSignInUrl('https://evil.example/login', ORIGIN)).toThrow(CloudError);
    expect(() => parseSignInUrl('//evil.example/login', ORIGIN)).toThrow(CloudError);
    const hostile = connect({ account: null, signInUrl: 'javascript:alert(1)' });
    expect((await rejection(hostile.client.signInUrl())).code).toBe('protocol');
  });
});

describe('drafts', () => {
  it('creates, updates with the expected revision and lists drafts', async () => {
    const { client } = connect();
    const created = await client.saveDraft({ record: record('doc_00000001'), expectedRevision: null, idempotencyKey: key() });
    expect(created).toMatchObject({ revision: 1, savedAt: '2026-09-24T00:00:00.000Z' });
    const updated = await client.saveDraft({ record: record('doc_00000001', { updatedAt: 2 }), expectedRevision: 1, idempotencyKey: key() });
    expect(updated.revision).toBe(2);
    expect((await client.listDrafts()).map((draft) => [draft.record.id, draft.revision])).toEqual([['doc_00000001', 2]]);
  });

  it('refuses stale writes and returns the current copy instead of overwriting', async () => {
    const { client } = connect();
    await client.saveDraft({ record: record('doc_00000001'), expectedRevision: null, idempotencyKey: key() });
    await client.saveDraft({ record: record('doc_00000001', { updatedAt: 5 }), expectedRevision: 1, idempotencyKey: key() });
    const stale = await rejection(client.saveDraft({ record: record('doc_00000001', { updatedAt: 9 }), expectedRevision: 1, idempotencyKey: key() }));
    expect(stale.code).toBe('conflict');
    expect(stale.current?.revision).toBe(2);
    expect(stale.current?.record.updatedAt).toBe(5);
    const duplicate = await rejection(client.saveDraft({ record: record('doc_00000001'), expectedRevision: null, idempotencyKey: key() }));
    expect(duplicate.code).toBe('conflict');
    expect((await rejection(client.saveDraft({ record: record('doc_00000009'), expectedRevision: 3, idempotencyKey: key() }))).code).toBe('not-found');
  });

  it('replays retried requests instead of saving twice', async () => {
    const { client, host } = connect();
    const retry = key();
    const first = await client.saveDraft({ record: record('doc_00000001'), expectedRevision: null, idempotencyKey: retry });
    const again = await client.saveDraft({ record: record('doc_00000001'), expectedRevision: null, idempotencyKey: retry });
    expect(again).toEqual(first);
    expect(host.snapshot().drafts).toHaveLength(1);
    const misuse = await rejection(client.saveDraft({ record: record('doc_00000002'), expectedRevision: null, idempotencyKey: retry }));
    expect(misuse.code).toBe('invalid');
  });

  it('enforces the draft quota and deletes with a revision check', async () => {
    const { client } = connect({ account: { displayName: 'A' }, maxDrafts: 1 });
    await client.saveDraft({ record: record('doc_00000001'), expectedRevision: null, idempotencyKey: key() });
    expect((await rejection(client.saveDraft({ record: record('doc_00000002'), expectedRevision: null, idempotencyKey: key() }))).code).toBe('quota');
    expect((await rejection(client.deleteDraft({ id: 'doc_00000001', expectedRevision: 7 }))).code).toBe('conflict');
    await client.deleteDraft({ id: 'doc_00000001', expectedRevision: 1 });
    expect(await client.listDrafts()).toEqual([]);
  });
});

describe('request validation on the host', () => {
  it('rejects owner fields, invalid records and malformed keys', () => {
    const valid = { record: record('doc_00000001'), expectedRevision: null, idempotencyKey: key() };
    expect(parseSaveInput(valid).record.id).toBe('doc_00000001');
    expect(() => parseSaveInput({ ...valid, targetUid: 'someone-else' })).toThrow(/unexpected field "targetUid"/);
    expect(() => parseSaveInput({ ...valid, record: { ...valid.record, owner: 'x' } })).toThrow(/record rejected/);
    expect(() => parseSaveInput({ ...valid, idempotencyKey: 'short' })).toThrow(CloudError);
    expect(() => parseSaveInput({ ...valid, expectedRevision: 0 })).toThrow(CloudError);
  });

  it('answers invalid requests with typed errors', async () => {
    const { client } = connect();
    await client.ready();
    const error = await rejection(client.saveDraft({ record: { ...record('doc_00000001'), id: '../x' } as SchemaDocumentRecord, expectedRevision: null, idempotencyKey: key() }));
    expect(error.code).toBe('invalid');
  });

  it('hides unexpected host failures behind a generic error', async () => {
    const host = createMemoryHost({ account: { displayName: 'A' } });
    const broken = { ...host, listDrafts: async () => Promise.reject(new Error('database password is hunter2')) };
    const { client: clientSide, host: hostSide } = createLinkedTransports();
    serveHost(broken, hostSide);
    const client = createHostClient(clientSide, { hostOrigin: ORIGIN, timeoutMs: 500 });
    open.push(client);
    const error = await rejection(client.listDrafts());
    expect(error.code).toBe('unavailable');
    expect(error.message).not.toContain('hunter2');
  });

  it('rejects host responses that do not match the protocol', async () => {
    const host = createMemoryHost({ account: { displayName: 'A' } });
    const lying = { ...host, listDrafts: async () => [{ record: { owner: 'x' }, revision: 1, savedAt: 'now' }] as never };
    const { client: clientSide, host: hostSide } = createLinkedTransports();
    serveHost(lying, hostSide);
    const client = createHostClient(clientSide, { hostOrigin: ORIGIN, timeoutMs: 500 });
    open.push(client);
    expect((await rejection(client.listDrafts())).code).toBe('protocol');
  });
});

describe('publishing', () => {
  const faqRecord = () =>
    record('doc_faq00001', {
      templateId: 'faq',
      data: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }] },
    });

  it('publishes saved drafts at the reviewed revisions and keeps the domain whitelist', async () => {
    const { client, host } = connect({
      account: { displayName: 'A' },
      score: (storeObj) => ({ score: storeObj.faqs.length > 0 ? 90 : 70, grade: 'A' }),
      published: { storeObj: { mainSchema: { '@type': 'Organization', name: 'Old' }, faqs: [], type: 'Organization', whitelistedDomains: 'example.com' }, publishedAt: null, officialScore: null },
    });
    const main = await client.saveDraft({ record: record('doc_main0001'), expectedRevision: null, idempotencyKey: key() });
    const faq = await client.saveDraft({ record: faqRecord(), expectedRevision: null, idempotencyKey: key() });
    const result = await client.publish({ mainId: main.record.id, mainRevision: main.revision, faqId: faq.record.id, faqRevision: faq.revision, idempotencyKey: key(), confirmed: true });
    expect(result).toEqual({ publishedAt: '2026-09-24T00:00:00.000Z', officialScore: { score: 90, grade: 'A' } });
    const published = await client.getPublished();
    expect(published?.storeObj).toMatchObject({ type: 'Organization', whitelistedDomains: 'example.com', faqs: [{ '@type': 'Question', name: 'Q?' }] });
    expect(published?.storeObj.mainSchema['name']).toBe('Synthetic doc_main0001');
    expect(host.snapshot().published?.officialScore?.score).toBe(90);
  });

  it('refuses to publish unconfirmed, changed or unsupported documents', async () => {
    const { client } = connect();
    const main = await client.saveDraft({ record: record('doc_main0001'), expectedRevision: null, idempotencyKey: key() });
    expect(() => parsePublishInput({ mainId: main.record.id, mainRevision: 1, faqId: null, faqRevision: null, idempotencyKey: key(), confirmed: false })).toThrow(/confirmation/);
    await client.saveDraft({ record: record('doc_main0001', { updatedAt: 3 }), expectedRevision: 1, idempotencyKey: key() });
    const changed = await rejection(client.publish({ mainId: main.record.id, mainRevision: 1, faqId: null, faqRevision: null, idempotencyKey: key(), confirmed: true }));
    expect(changed.code).toBe('conflict');
    const article = await client.saveDraft({ record: record('doc_art00001', { templateId: 'article', data: { '@type': 'Article', headline: 'X' } }), expectedRevision: null, idempotencyKey: key() });
    const unsupported = await rejection(client.publish({ mainId: article.record.id, mainRevision: 1, faqId: null, faqRevision: null, idempotencyKey: key(), confirmed: true }));
    expect(unsupported.code).toBe('invalid');
    expect(await client.getPublished()).toBeNull();
  });
});

describe('window transport', () => {
  it('only accepts messages from the peer window and origin', () => {
    const listeners = new Set<(event: { origin: string; source: unknown; data: unknown }) => void>();
    const receiver = { addEventListener: (_: 'message', listener: (event: { origin: string; source: unknown; data: unknown }) => void) => listeners.add(listener), removeEventListener: (_: 'message', listener: (event: { origin: string; source: unknown; data: unknown }) => void) => listeners.delete(listener) };
    const sent: [unknown, string][] = [];
    const peer = { postMessage: (message: unknown, origin: string) => sent.push([message, origin]) };
    const transport = windowTransport({ receiver, peer, peerOrigin: ORIGIN });
    const received: unknown[] = [];
    const stop = transport.subscribe((message) => received.push(message));
    const dispatch = (event: { origin: string; source: unknown; data: unknown }) => listeners.forEach((listener) => listener(event));
    dispatch({ origin: ORIGIN, source: peer, data: 'ok' });
    dispatch({ origin: 'https://evil.example', source: peer, data: 'wrong origin' });
    dispatch({ origin: ORIGIN, source: {}, data: 'wrong window' });
    transport.send('hello');
    stop();
    dispatch({ origin: ORIGIN, source: peer, data: 'after stop' });
    expect(received).toEqual(['ok']);
    expect(sent).toEqual([['hello', ORIGIN]]);
    expect(() => windowTransport({ receiver, peer, peerOrigin: '*' })).toThrow(TypeError);
  });
});

describe('keeping linked tools in step', () => {
  it('forwards change notices from other tools, tabs and devices', async () => {
    const { client, server } = connect();
    await client.ready();
    const scopes: string[] = [];
    client.onChange((scope) => scopes.push(scope));
    server.notifyChanged('published');
    server.notifyChanged('drafts');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scopes).toEqual(['published', 'drafts']);
  });

  it('announces the minimum shared-core version the host accepts', async () => {
    const host = createMemoryHost({ account: { displayName: 'A' } });
    const { client: clientSide, host: hostSide } = createLinkedTransports();
    serveHost(host, hostSide, { minCoreVersion: '0.3.0' });
    const client = createHostClient(clientSide, { hostOrigin: ORIGIN });
    open.push(client);
    await client.ready();
    expect(client.minCoreVersion()).toBe('0.3.0');
    const plain = connect();
    await plain.client.ready();
    expect(plain.client.minCoreVersion()).toBeUndefined();
  });

  it('compares dotted versions numerically', () => {
    expect(compareVersions('0.2.0', '0.10.0')).toBe(-1);
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.3.1', '0.3.0')).toBe(1);
    expect(compareVersions('0.3.0-beta.1', '0.3.0')).toBe(0);
  });
});
