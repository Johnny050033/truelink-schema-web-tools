import type { SchemaDocumentRecord } from 'truelink-schema-document';
import {
  CloudError,
  envelope,
  isCloudErrorCode,
  isHostMethod,
  parseAccount,
  parseDraft,
  parseDraftList,
  parseIssuedApiKey,
  parsePublished,
  parsePublishResult,
  parseScore,
  parseSignInUrl,
  parseVerification,
  parseVerificationUrl,
  isChangeScope,
  readMessage,
  type ChangeScope,
  type CloudDraft,
  type DeleteDraftInput,
  type HostAccount,
  type HostMethod,
  type IssueApiKeyInput,
  type IssuedApiKey,
  type OfficialScore,
  type PublishedSchema,
  type PublishInput,
  type PublishResult,
  type SaveDraftInput,
  type VerificationStatus,
} from './protocol.js';
import type { Transport } from './transport.js';

export interface HostClientOptions {
  /** Origin of the host page; sign-in URLs must stay on it. */
  readonly hostOrigin: string;
  /** Per-request timeout. */
  readonly timeoutMs?: number;
  /** How long to wait for the host to announce itself. */
  readonly readyTimeoutMs?: number;
  readonly makeId?: () => string;
}

export interface HostClient {
  /** Resolves with the host's supported methods; rejects with "unavailable" if it never answers. */
  ready(): Promise<readonly HostMethod[]>;
  supports(method: HostMethod): boolean;
  getAccount(): Promise<HostAccount | null>;
  signInUrl(): Promise<string>;
  listDrafts(): Promise<CloudDraft[]>;
  saveDraft(input: SaveDraftInput): Promise<CloudDraft>;
  deleteDraft(input: DeleteDraftInput): Promise<void>;
  getPublished(): Promise<PublishedSchema | null>;
  publish(input: PublishInput): Promise<PublishResult>;
  score(record: SchemaDocumentRecord): Promise<OfficialScore>;
  /** Verified Schema: KYC state, verified domains, hosted script and API key state (never the key). */
  getVerification(): Promise<VerificationStatus>;
  /** TrueLink's KYC page on the host origin; identity documents are uploaded there. */
  verificationUrl(): Promise<string>;
  /** Issues or rotates the keyed-API credential. The returned key is shown once and must not be stored. */
  issueApiKey(input: IssueApiKeyInput): Promise<IssuedApiKey>;
  revokeApiKey(): Promise<void>;
  /** Called when the host reports a sign-in or sign-out. */
  onAccountChange(listener: (account: HostAccount | null) => void): () => void;
  /** Called when drafts or the published schema changed on the host (another tool, tab or device). */
  onChange(listener: (scope: ChangeScope) => void): () => void;
  /** The oldest shared-core version the host accepts, once ready. */
  minCoreVersion(): string | undefined;
  close(): void;
}

interface Pending {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: CloudError) => void;
  readonly parse: (value: unknown) => unknown;
  readonly timer: ReturnType<typeof setTimeout>;
}

function defaultId(): string {
  return globalThis.crypto.randomUUID().replaceAll('-', '');
}

export function createHostClient(transport: Transport, options: HostClientOptions): HostClient {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const readyTimeoutMs = options.readyTimeoutMs ?? 10_000;
  const makeId = options.makeId ?? defaultId;
  const pending = new Map<string, Pending>();
  const accountListeners = new Set<(account: HostAccount | null) => void>();
  const changeListeners = new Set<(scope: ChangeScope) => void>();
  let methods: readonly HostMethod[] | undefined;
  let minCore: string | undefined;
  let closed = false;

  let settleReady: { resolve: (methods: readonly HostMethod[]) => void; reject: (error: CloudError) => void } | undefined;
  const readyPromise = new Promise<readonly HostMethod[]>((resolve, reject) => {
    settleReady = { resolve, reject };
  });
  // Avoid unhandled-rejection noise when nobody awaits ready() before it fails.
  readyPromise.catch(() => undefined);
  const readyTimer = setTimeout(() => settleReady?.reject(new CloudError('unavailable', 'The TrueLink host did not respond.')), readyTimeoutMs);

  const unsubscribe = transport.subscribe((raw) => {
    const message = readMessage(raw);
    if (!message) return;
    if (message.kind === 'ready') {
      if (methods) return;
      const list = Array.isArray(message['methods']) ? message['methods'].filter(isHostMethod) : [];
      methods = [...new Set(list)];
      const required = message['minCoreVersion'];
      minCore = typeof required === 'string' && /^\d+(\.\d+){0,2}$/.test(required) ? required : undefined;
      clearTimeout(readyTimer);
      settleReady?.resolve(methods);
      return;
    }
    if (message.kind === 'changed') {
      if (!isChangeScope(message['scope'])) return;
      const scope = message['scope'];
      for (const listener of [...changeListeners]) listener(scope);
      return;
    }
    if (message.kind === 'account') {
      let account: HostAccount | null;
      try {
        account = parseAccount(message['account']);
      } catch {
        return;
      }
      for (const listener of [...accountListeners]) listener(account);
      return;
    }
    if (message.kind !== 'response' || typeof message['id'] !== 'string') return;
    const entry = pending.get(message['id']);
    if (!entry) return;
    pending.delete(message['id']);
    clearTimeout(entry.timer);
    if (message['ok'] === true) {
      try {
        entry.resolve(entry.parse(message['result']));
      } catch (error) {
        entry.reject(error instanceof CloudError ? error : new CloudError('protocol', 'The host sent an unreadable response.'));
      }
      return;
    }
    const error = message['error'];
    const code = error && typeof error === 'object' && !Array.isArray(error) && isCloudErrorCode(error['code']) ? error['code'] : 'protocol';
    const text = error && typeof error === 'object' && !Array.isArray(error) && typeof error['message'] === 'string' ? error['message'].slice(0, 400) : code;
    let current: CloudDraft | undefined;
    if (code === 'conflict' && error && typeof error === 'object' && !Array.isArray(error) && error['current'] !== undefined) {
      try {
        current = parseDraft(error['current']);
      } catch {
        current = undefined;
      }
    }
    entry.reject(new CloudError(code, text, current));
  });

  transport.send({ ...envelope(), kind: 'hello' });

  async function call<T>(method: HostMethod, params: unknown, parse: (value: unknown) => T): Promise<T> {
    if (closed) throw new CloudError('unavailable', 'The connection to TrueLink is closed.');
    const supported = await readyPromise;
    if (!supported.includes(method)) throw new CloudError('unavailable', `The TrueLink host does not support ${method}.`);
    const id = makeId();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new CloudError('timeout', 'TrueLink did not answer in time.'));
      }, timeoutMs);
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, parse, timer });
      transport.send({ ...envelope(), kind: 'request', id, method, params });
    });
  }

  return {
    ready: () => readyPromise,
    supports: (method) => methods?.includes(method) ?? false,
    getAccount: () => call('account.get', {}, parseAccount),
    signInUrl: () => call('account.signInUrl', {}, (value) => parseSignInUrl(value, options.hostOrigin)),
    listDrafts: () => call('drafts.list', {}, parseDraftList),
    saveDraft: (input) => call('drafts.save', input, parseDraft),
    deleteDraft: (input) => call('drafts.delete', input, () => undefined),
    getPublished: () => call('published.get', {}, parsePublished),
    publish: (input) => call('publish', input, parsePublishResult),
    score: (record) => call('score', { record }, parseScore),
    getVerification: () => call('verification.get', {}, parseVerification),
    verificationUrl: () => call('verification.startUrl', {}, (value) => parseVerificationUrl(value, options.hostOrigin)),
    issueApiKey: (input) => call('apiKey.issue', input, parseIssuedApiKey),
    revokeApiKey: () => call('apiKey.revoke', { confirmed: true }, () => undefined),
    onAccountChange(listener) {
      accountListeners.add(listener);
      return () => accountListeners.delete(listener);
    },
    onChange(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
    minCoreVersion: () => minCore,
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(readyTimer);
      settleReady?.reject(new CloudError('unavailable', 'The connection to TrueLink is closed.'));
      unsubscribe();
      for (const [id, entry] of pending) {
        clearTimeout(entry.timer);
        entry.reject(new CloudError('unavailable', 'The connection to TrueLink is closed.'));
        pending.delete(id);
      }
      accountListeners.clear();
      changeListeners.clear();
    },
  };
}
