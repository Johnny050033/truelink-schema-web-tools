import {
  assertNoParams,
  CloudError,
  envelope,
  HOST_METHODS,
  isHostMethod,
  parseDeleteInput,
  parseIssueApiKeyInput,
  parsePublishInput,
  parseRevokeApiKeyInput,
  parseSaveInput,
  parseScoreInput,
  readMessage,
  type ChangeScope,
  type HostAccount,
  type HostImplementation,
  type HostMethod,
} from './protocol.js';
import type { Transport } from './transport.js';

export interface HostServer {
  /** Tells the client that the signed-in account changed (sign-in, sign-out, switch). */
  notifyAccount(account: HostAccount | null): void;
  /**
   * Tells the client that drafts, the published schema or the verification status changed,
   * for example after a save in the TrueLink web tool, a KYC decision or a key rotation on
   * another device, so it can refresh right away.
   */
  notifyChanged(scope: ChangeScope): void;
  close(): void;
}

export interface ServeHostOptions {
  /** Oldest shared-core version this host accepts; older clients are asked to reload. */
  readonly minCoreVersion?: string;
}

/**
 * Runs the host side of the bridge: validates every request, calls the implementation and
 * answers with a result or a typed error. Unexpected exceptions become "unavailable" with a
 * generic message, so internal details never reach the client.
 */
export function serveHost(implementation: HostImplementation, transport: Transport, options: ServeHostOptions = {}): HostServer {
  const optional: Partial<Record<HostMethod, unknown>> = {
    score: implementation.score,
    'verification.get': implementation.getVerification,
    'verification.startUrl': implementation.verificationUrl,
    'apiKey.issue': implementation.issueApiKey,
    'apiKey.revoke': implementation.revokeApiKey,
  };
  const methods: HostMethod[] = HOST_METHODS.filter((method) => !(method in optional) || typeof optional[method] === 'function');
  const unavailable = (): never => {
    throw new CloudError('unavailable', 'Verified Schema is not available on this host.');
  };

  const handlers: Record<HostMethod, (params: unknown) => Promise<unknown>> = {
    'account.get': async (params) => {
      assertNoParams(params);
      return implementation.getAccount();
    },
    'account.signInUrl': async (params) => {
      assertNoParams(params);
      return implementation.signInUrl();
    },
    'drafts.list': async (params) => {
      assertNoParams(params);
      return implementation.listDrafts();
    },
    'drafts.save': async (params) => implementation.saveDraft(parseSaveInput(params)),
    'drafts.delete': async (params) => {
      await implementation.deleteDraft(parseDeleteInput(params));
      return null;
    },
    'published.get': async (params) => {
      assertNoParams(params);
      return implementation.getPublished();
    },
    publish: async (params) => implementation.publish(parsePublishInput(params)),
    score: async (params) => {
      if (!implementation.score) throw new CloudError('unavailable', 'Scoring is not available.');
      return implementation.score(parseScoreInput(params));
    },
    'verification.get': async (params) => {
      assertNoParams(params);
      return implementation.getVerification ? implementation.getVerification() : unavailable();
    },
    'verification.startUrl': async (params) => {
      assertNoParams(params);
      return implementation.verificationUrl ? implementation.verificationUrl() : unavailable();
    },
    'apiKey.issue': async (params) => (implementation.issueApiKey ? implementation.issueApiKey(parseIssueApiKeyInput(params)) : unavailable()),
    'apiKey.revoke': async (params) => {
      parseRevokeApiKeyInput(params);
      if (!implementation.revokeApiKey) return unavailable();
      await implementation.revokeApiKey();
      return null;
    },
  };

  const announce = () =>
    transport.send({ ...envelope(), kind: 'ready', methods, ...(options.minCoreVersion ? { minCoreVersion: options.minCoreVersion } : {}) });

  const unsubscribe = transport.subscribe((raw) => {
    const message = readMessage(raw);
    if (!message) return;
    if (message.kind === 'hello') {
      announce();
      return;
    }
    if (message.kind !== 'request' || typeof message['id'] !== 'string' || message['id'].length > 64) return;
    const id = message['id'];
    const method = message['method'];
    const reply = (body: object) => transport.send({ ...envelope(), kind: 'response', id, ...body });
    if (!isHostMethod(method) || !methods.includes(method)) {
      reply({ ok: false, error: { code: 'unavailable', message: 'Unsupported method.' } });
      return;
    }
    handlers[method](message['params']).then(
      (result) => reply({ ok: true, result: result ?? null }),
      (error: unknown) => {
        if (error instanceof CloudError) {
          const body: { code: string; message: string; current?: unknown } = { code: error.code, message: error.message.slice(0, 400) };
          if (error.current) body.current = error.current;
          reply({ ok: false, error: body });
        } else {
          reply({ ok: false, error: { code: 'unavailable', message: 'TrueLink could not complete the request.' } });
        }
      },
    );
  });

  announce();

  return {
    notifyAccount(account) {
      transport.send({ ...envelope(), kind: 'account', account });
    },
    notifyChanged(scope) {
      transport.send({ ...envelope(), kind: 'changed', scope });
    },
    close() {
      unsubscribe();
    },
  };
}
