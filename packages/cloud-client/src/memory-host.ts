import {
  certStatusUrl,
  cloneJson,
  hostedSchemaScriptUrl,
  maskApiKey,
  normalizeDomainList,
  toLegacyStoreObj,
  type JsonObject,
  type LegacyStoreObj,
  type SchemaDocumentRecord,
} from 'truelink-schema-document';
import {
  CloudError,
  type ApiKeyState,
  type CloudDraft,
  type DeleteDraftInput,
  type HostAccount,
  type HostImplementation,
  type OfficialScore,
  type PublishedSchema,
  type PublishInput,
  type PublishResult,
  type SaveDraftInput,
  type IssueApiKeyInput,
  type IssuedApiKey,
  type KycState,
  type VerificationStatus,
} from './protocol.js';

/** Verified Schema state of the signed-in account in the reference host. */
export interface MemoryVerificationOptions {
  readonly kyc: KycState;
  readonly membershipActive: boolean;
  readonly verifiedDomains: readonly string[];
  /** Account id used in the hosted script URL once a schema is published. */
  readonly accountId?: string;
  /** Same-origin KYC page. */
  readonly kycUrl?: string;
  /** Deterministic keys for tests. */
  readonly makeApiKey?: () => string;
}

export interface MemoryHostOptions {
  readonly account?: HostAccount | null;
  readonly signInUrl?: string;
  /** Draft quota per account. */
  readonly maxDrafts?: number;
  readonly now?: () => Date;
  /** Server-side scoring stand-in; without it published schemas carry no official score. */
  readonly score?: (storeObj: LegacyStoreObj) => OfficialScore;
  /** Starting public schema, e.g. one saved earlier by the TrueLink web tool. */
  readonly published?: PublishedSchema | null;
  /** Enables the Verified Schema methods (KYC status, verified domains, keyed API credential). */
  readonly verification?: MemoryVerificationOptions;
}

export interface MemoryHost extends HostImplementation {
  signIn(account: HostAccount): void;
  signOut(): void;
  /** Test control: e.g. approve KYC or end the membership, as TrueLink staff or billing would. */
  setVerification(patch: Partial<Pick<MemoryVerificationOptions, 'kyc' | 'membershipActive' | 'verifiedDomains'>>): void;
  /** Read-only view for tests. */
  snapshot(): { readonly drafts: readonly CloudDraft[]; readonly published: PublishedSchema | null };
}

/**
 * In-memory reference host. It defines the behaviour every TrueLink host must match:
 * owner-scoped drafts, revision checks instead of last-writer-wins, idempotent retries,
 * quotas, and publishing only saved drafts at the revisions the user reviewed. A real host
 * keeps the same semantics with server-side storage (see docs/PLATFORM_STRATEGY.zh-TW.md).
 */
export function createMemoryHost(options: MemoryHostOptions = {}): MemoryHost {
  const now = options.now ?? (() => new Date());
  const maxDrafts = options.maxDrafts ?? 100;
  let account: HostAccount | null = options.account ?? null;
  const drafts = new Map<string, CloudDraft>();
  const replies = new Map<string, { readonly fingerprint: string; readonly result: unknown }>();
  let published: PublishedSchema | null = options.published ?? null;

  function requireAccount(): void {
    if (!account) throw new CloudError('signed-out', 'Sign in to TrueLink to use cloud drafts.');
  }

  /** Replays the stored result of a retried request; the same key with a different request is refused. */
  function idempotent<T>(key: string, request: unknown, run: () => T): T {
    const fingerprint = JSON.stringify(request);
    const previous = replies.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new CloudError('invalid', 'This idempotency key was used for a different request.');
      return cloneJson(previous.result as JsonObject) as T;
    }
    const result = run();
    replies.set(key, { fingerprint, result: cloneJson(result as JsonObject) });
    return result;
  }

  function copy(draft: CloudDraft): CloudDraft {
    return cloneJson(draft as unknown as JsonObject) as unknown as CloudDraft;
  }

  let verification = options.verification ? { ...options.verification } : undefined;
  let apiKey: { state: ApiKeyState; masked: string | null } = { state: 'none', masked: null };
  const issuedRequests = new Set<string>();

  function randomApiKey(): string {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
    return `tl_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  function verificationStatus(): VerificationStatus {
    const current = verification!;
    const domains = normalizeDomainList(current.verifiedDomains);
    const approved = current.kyc === 'approved';
    return {
      kyc: current.kyc,
      membershipActive: current.membershipActive,
      verifiedDomains: domains,
      hostedScriptUrl: published && current.accountId ? (hostedSchemaScriptUrl(current.accountId) ?? null) : null,
      certificateUrl: approved && domains[0] ? (certStatusUrl(domains[0]) ?? null) : null,
      apiKey: { ...apiKey },
    };
  }

  function pinned(id: string, revision: number): CloudDraft {
    const draft = drafts.get(id);
    if (!draft) throw new CloudError('not-found', 'That draft no longer exists.');
    if (draft.revision !== revision) throw new CloudError('conflict', 'That draft changed since you reviewed it.', copy(draft));
    return draft;
  }

  return {
    async getAccount() {
      return account ? { ...account } : null;
    },
    async signInUrl() {
      return options.signInUrl ?? '/login.html';
    },
    async listDrafts() {
      requireAccount();
      return [...drafts.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map(copy);
    },
    async saveDraft(input: SaveDraftInput) {
      requireAccount();
      return idempotent(input.idempotencyKey, { save: input }, () => {
        const existing = drafts.get(input.record.id);
        if (input.expectedRevision === null) {
          if (existing) throw new CloudError('conflict', 'A draft with this id already exists.', copy(existing));
          if (drafts.size >= maxDrafts) throw new CloudError('quota', `You can keep up to ${maxDrafts} cloud drafts.`);
        } else {
          if (!existing) throw new CloudError('not-found', 'That draft no longer exists.');
          if (existing.revision !== input.expectedRevision) throw new CloudError('conflict', 'The cloud copy changed on another device.', copy(existing));
        }
        const draft: CloudDraft = {
          record: cloneJson(input.record as unknown as JsonObject) as unknown as SchemaDocumentRecord,
          revision: (existing?.revision ?? 0) + 1,
          savedAt: now().toISOString(),
        };
        drafts.set(draft.record.id, draft);
        return copy(draft);
      });
    },
    async deleteDraft(input: DeleteDraftInput) {
      requireAccount();
      pinned(input.id, input.expectedRevision);
      drafts.delete(input.id);
    },
    async getPublished() {
      requireAccount();
      return published ? (cloneJson(published as unknown as JsonObject) as unknown as PublishedSchema) : null;
    },
    async publish(input: PublishInput): Promise<PublishResult> {
      requireAccount();
      if (input.confirmed !== true) throw new CloudError('invalid', 'Publishing needs explicit confirmation.');
      return idempotent(input.idempotencyKey, { publish: input }, () => {
        const main = pinned(input.mainId, input.mainRevision);
        const faq = input.faqId === null || input.faqRevision === null ? undefined : pinned(input.faqId, input.faqRevision);
        // The domain whitelist is a deployment setting managed on TrueLink; publishing keeps it.
        const result = toLegacyStoreObj(main.record, { faq: faq?.record, whitelistedDomains: published?.storeObj.whitelistedDomains ?? '' });
        if (!result.ok) throw new CloudError('invalid', `This document cannot be published: ${result.code}.`);
        const publishedAt = now().toISOString();
        const officialScore = options.score ? options.score(result.storeObj) : null;
        published = { storeObj: result.storeObj, publishedAt, officialScore };
        return { publishedAt, officialScore };
      });
    },
    ...(options.score
      ? {
          async score(record: SchemaDocumentRecord) {
            requireAccount();
            const result = toLegacyStoreObj(record);
            if (!result.ok) throw new CloudError('invalid', `This document cannot be scored: ${result.code}.`);
            return options.score!(result.storeObj);
          },
        }
      : {}),
    ...(verification
      ? {
          async getVerification() {
            requireAccount();
            return verificationStatus();
          },
          async verificationUrl() {
            return verification!.kycUrl ?? '/kyc/';
          },
          async issueApiKey(input: IssueApiKeyInput): Promise<IssuedApiKey> {
            requireAccount();
            // A replay must not reveal the key again: the host keeps only a hash (here, only the mask).
            if (issuedRequests.has(input.idempotencyKey)) throw new CloudError('conflict', 'This key was already issued. Rotate it if it was not saved.');
            if (verification!.kyc !== 'approved') throw new CloudError('forbidden', 'Complete KYC on TrueLink before issuing an API key.');
            if (!verification!.membershipActive) throw new CloudError('forbidden', 'The Verified Schema API needs an active TrueLink membership.');
            if (input.operation === 'provision' && apiKey.state === 'active') throw new CloudError('invalid', 'An API key is already active; rotate it instead.');
            if (input.operation === 'rotate' && apiKey.state !== 'active') throw new CloudError('invalid', 'There is no active API key to rotate.');
            issuedRequests.add(input.idempotencyKey);
            const key = (verification!.makeApiKey ?? randomApiKey)();
            apiKey = { state: 'active', masked: maskApiKey(key) };
            return { apiKey: key, masked: maskApiKey(key) };
          },
          async revokeApiKey() {
            requireAccount();
            if (apiKey.state === 'active') apiKey = { state: 'revoked', masked: apiKey.masked };
          },
        }
      : {}),
    setVerification(patch) {
      if (!verification) throw new Error('This memory host was created without verification.');
      // As on the platform, a lapsed KYC or membership does not revoke the key: the keyed API
      // refuses requests until both are active again, and the status shows why.
      verification = { ...verification, ...patch };
    },
    signIn(next) {
      account = { ...next };
    },
    signOut() {
      account = null;
    },
    snapshot() {
      return { drafts: [...drafts.values()].map(copy), published: published ? (cloneJson(published as unknown as JsonObject) as unknown as PublishedSchema) : null };
    },
  };
}
