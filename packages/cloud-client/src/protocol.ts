/**
 * TrueLink host-bridge protocol, version 1.
 *
 * A client (Schema Studio or another surface) never talks to a database or holds tokens.
 * It exchanges messages with a *host*: a page served by TrueLink on the same origin that
 * already knows the signed-in user and calls TrueLink's backend. The host derives the owner
 * from its own session; a client can only name documents, never accounts.
 *
 * Every value crossing the bridge is validated on arrival, in both directions.
 */
import {
  isApiKey,
  isJsonObject,
  maskApiKey,
  MAX_VERIFIED_DOMAINS,
  normalizeDomain,
  parseRecord,
  RECORD_ID_PATTERN,
  type JsonObject,
  type LegacyStoreObj,
  type SchemaDocumentRecord,
} from 'truelink-schema-document';

export const CHANNEL = 'truelink.host';
export const PROTOCOL_VERSION = 1;

export const HOST_METHODS = [
  'account.get',
  'account.signInUrl',
  'drafts.list',
  'drafts.save',
  'drafts.delete',
  'published.get',
  'publish',
  'score',
  'verification.get',
  'verification.startUrl',
  'apiKey.issue',
  'apiKey.revoke',
] as const;
export type HostMethod = (typeof HOST_METHODS)[number];

export const CLOUD_ERROR_CODES = ['signed-out', 'conflict', 'not-found', 'quota', 'invalid', 'forbidden', 'rate-limited', 'unavailable', 'timeout', 'protocol'] as const;
export type CloudErrorCode = (typeof CLOUD_ERROR_CODES)[number];

/** Upper bounds shared by both sides. Hosts may enforce lower quotas. */
export const PROTOCOL_LIMITS = Object.freeze({
  maxDrafts: 500,
  maxMessageLength: 400,
  maxDisplayName: 120,
  idempotencyKey: /^[A-Za-z0-9_-]{16,64}$/,
});

export interface HostAccount {
  readonly displayName: string;
}

export interface CloudDraft {
  readonly record: SchemaDocumentRecord;
  /** Server revision, starting at 1 and incremented by every accepted save. */
  readonly revision: number;
  /** Server time of the last accepted save (ISO 8601). */
  readonly savedAt: string;
}

export interface SaveDraftInput {
  readonly record: SchemaDocumentRecord;
  /** null creates the draft; a number must equal the host's current revision. */
  readonly expectedRevision: number | null;
  /** Repeating a request with the same key returns the first result instead of saving twice. */
  readonly idempotencyKey: string;
}

export interface DeleteDraftInput {
  readonly id: string;
  readonly expectedRevision: number;
}

export interface OfficialScore {
  /** Score computed by the TrueLink server, 0–100. */
  readonly score: number;
  readonly grade: string;
}

export interface PublishedSchema {
  /** What the TrueLink hosted script currently serves. */
  readonly storeObj: LegacyStoreObj;
  readonly publishedAt: string | null;
  readonly officialScore: OfficialScore | null;
}

export interface PublishInput {
  /** Saved drafts to publish, pinned to the revisions the user reviewed. */
  readonly mainId: string;
  readonly mainRevision: number;
  readonly faqId: string | null;
  readonly faqRevision: number | null;
  readonly idempotencyKey: string;
  /** The user explicitly confirmed replacing their public schema. */
  readonly confirmed: true;
}

export interface PublishResult {
  readonly publishedAt: string;
  readonly officialScore: OfficialScore | null;
}

/** KYC state of the account (company, expert or individual verification on TrueLink). */
export const KYC_STATES = ['none', 'pending', 'approved', 'rejected'] as const;
export type KycState = (typeof KYC_STATES)[number];

export const API_KEY_STATES = ['none', 'active', 'revoked'] as const;
export type ApiKeyState = (typeof API_KEY_STATES)[number];

/**
 * Where the account stands with TrueLink Verified Schema. The platform serves the schema only on
 * `verifiedDomains`; the keyed API additionally requires approved KYC and an active membership.
 * Never contains an API key: only its state and masked form.
 */
export interface VerificationStatus {
  readonly kyc: KycState;
  readonly membershipActive: boolean;
  readonly verifiedDomains: readonly string[];
  /** The domain-bound hosted schema script, once a schema has been published. */
  readonly hostedScriptUrl: string | null;
  /** Public page where anyone can confirm the verification. */
  readonly certificateUrl: string | null;
  readonly apiKey: { readonly state: ApiKeyState; readonly masked: string | null };
}

export interface IssueApiKeyInput {
  /** "provision" creates the first key; "rotate" replaces the active key, which stops working at once. */
  readonly operation: 'provision' | 'rotate';
  readonly idempotencyKey: string;
  /** The user explicitly confirmed (rotation breaks integrations that use the old key). */
  readonly confirmed: true;
}

export interface IssuedApiKey {
  /** Shown to the user once. Clients must not store it; the host keeps only a hash. */
  readonly apiKey: string;
  readonly masked: string;
}

/** What a TrueLink host implements; `serveHost` wires it to the bridge. */
export interface HostImplementation {
  getAccount(): Promise<HostAccount | null>;
  /** Same-origin URL of the sign-in page that returns to the client afterwards. */
  signInUrl(): Promise<string>;
  listDrafts(): Promise<CloudDraft[]>;
  saveDraft(input: SaveDraftInput): Promise<CloudDraft>;
  deleteDraft(input: DeleteDraftInput): Promise<void>;
  getPublished(): Promise<PublishedSchema | null>;
  publish(input: PublishInput): Promise<PublishResult>;
  /** Official server score without saving anything (optional capability). */
  score?(record: SchemaDocumentRecord): Promise<OfficialScore>;
  /** Verified Schema status (optional capability, with the three methods below). */
  getVerification?(): Promise<VerificationStatus>;
  /** Same-origin URL of TrueLink's KYC page. Identity documents are uploaded there, never through the bridge. */
  verificationUrl?(): Promise<string>;
  issueApiKey?(input: IssueApiKeyInput): Promise<IssuedApiKey>;
  revokeApiKey?(): Promise<void>;
}

export class CloudError extends Error {
  readonly code: CloudErrorCode;
  /** For "conflict": the host's current copy, when it shares one. */
  readonly current: CloudDraft | undefined;

  constructor(code: CloudErrorCode, message?: string, current?: CloudDraft) {
    super(message ?? code);
    this.name = 'CloudError';
    this.code = code;
    this.current = current;
  }
}

export function isCloudErrorCode(value: unknown): value is CloudErrorCode {
  return typeof value === 'string' && (CLOUD_ERROR_CODES as readonly string[]).includes(value);
}

export function isHostMethod(value: unknown): value is HostMethod {
  return typeof value === 'string' && (HOST_METHODS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

interface Envelope {
  readonly channel: typeof CHANNEL;
  readonly version: typeof PROTOCOL_VERSION;
}

export interface HelloMessage extends Envelope {
  readonly kind: 'hello';
}

export interface ReadyMessage extends Envelope {
  readonly kind: 'ready';
  readonly methods: readonly HostMethod[];
  /**
   * Oldest `truelink-schema-document` version the host accepts. When TrueLink upgrades the
   * shared core, older clients learn they must reload before writing anything.
   */
  readonly minCoreVersion?: string;
}

export interface RequestMessage extends Envelope {
  readonly kind: 'request';
  readonly id: string;
  readonly method: HostMethod;
  readonly params: unknown;
}

export type ResponseMessage =
  | (Envelope & { readonly kind: 'response'; readonly id: string; readonly ok: true; readonly result: unknown })
  | (Envelope & { readonly kind: 'response'; readonly id: string; readonly ok: false; readonly error: { readonly code: CloudErrorCode; readonly message: string; readonly current?: unknown } });

export interface AccountMessage extends Envelope {
  readonly kind: 'account';
  readonly account: unknown;
}

/** What changed on the host, from any TrueLink tool or device. */
export const CHANGE_SCOPES = ['drafts', 'published', 'verification'] as const;
export type ChangeScope = (typeof CHANGE_SCOPES)[number];

export interface ChangedMessage extends Envelope {
  readonly kind: 'changed';
  readonly scope: ChangeScope;
}

export type BridgeMessage = HelloMessage | ReadyMessage | RequestMessage | ResponseMessage | AccountMessage | ChangedMessage;

export function isChangeScope(value: unknown): value is ChangeScope {
  return typeof value === 'string' && (CHANGE_SCOPES as readonly string[]).includes(value);
}

/** Compares dotted numeric versions ("0.2.10" > "0.2.9"); pre-release tags are ignored. */
export function compareVersions(a: string, b: string): number {
  const parts = (version: string) => version.split('-')[0]!.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

export function envelope(): Envelope {
  return { channel: CHANNEL, version: PROTOCOL_VERSION };
}

/** Returns the message when it belongs to this protocol version, otherwise undefined. */
export function readMessage(value: unknown): (JsonObject & { kind: string }) | undefined {
  if (!isJsonObject(value) || value['channel'] !== CHANNEL || value['version'] !== PROTOCOL_VERSION) return undefined;
  return typeof value['kind'] === 'string' ? (value as JsonObject & { kind: string }) : undefined;
}

// ---------------------------------------------------------------------------
// Validators (throw CloudError "protocol" for hosts, "invalid" for clients)
// ---------------------------------------------------------------------------

type Fail = (message: string) => never;

const protocolFail: Fail = (message) => {
  throw new CloudError('protocol', message);
};

const invalidFail: Fail = (message) => {
  throw new CloudError('invalid', message);
};

function object(value: unknown, fail: Fail, what: string): JsonObject {
  if (!isJsonObject(value)) fail(`${what} must be an object`);
  return value as JsonObject;
}

function exactKeys(value: JsonObject, keys: readonly string[], fail: Fail, what: string): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${what} has unexpected field "${key}"`);
}

function revision(value: unknown, fail: Fail, what: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) fail(`${what} must be a positive integer`);
  return value as number;
}

function documentId(value: unknown, fail: Fail, what: string): string {
  if (typeof value !== 'string' || !RECORD_ID_PATTERN.test(value)) fail(`${what} is not a valid document id`);
  return value as string;
}

function isoTime(value: unknown, fail: Fail, what: string): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) fail(`${what} must be an ISO time`);
  return value as string;
}

function idempotencyKey(value: unknown, fail: Fail): string {
  if (typeof value !== 'string' || !PROTOCOL_LIMITS.idempotencyKey.test(value)) fail('idempotencyKey must be 16-64 letters, digits, "_" or "-"');
  return value as string;
}

function record(value: unknown, fail: Fail): SchemaDocumentRecord {
  const result = parseRecord(value);
  if (!result.ok) fail(`record rejected: ${result.code}`);
  return (result as { ok: true; record: SchemaDocumentRecord }).record;
}

export function parseAccount(value: unknown): HostAccount | null {
  if (value === null) return null;
  const account = object(value, protocolFail, 'account');
  const name = account['displayName'];
  if (typeof name !== 'string' || name.length > PROTOCOL_LIMITS.maxDisplayName) protocolFail('account.displayName must be a short string');
  return { displayName: name as string };
}

export function parseDraft(value: unknown): CloudDraft {
  const draft = object(value, protocolFail, 'draft');
  return {
    record: record(draft['record'], protocolFail),
    revision: revision(draft['revision'], protocolFail, 'draft.revision'),
    savedAt: isoTime(draft['savedAt'], protocolFail, 'draft.savedAt'),
  };
}

export function parseDraftList(value: unknown): CloudDraft[] {
  if (!Array.isArray(value) || value.length > PROTOCOL_LIMITS.maxDrafts) protocolFail('drafts must be a bounded array');
  const drafts = (value as unknown[]).map(parseDraft);
  if (new Set(drafts.map((draft) => draft.record.id)).size !== drafts.length) protocolFail('draft ids must be unique');
  return drafts;
}

export function parseScore(value: unknown): OfficialScore {
  const score = object(value, protocolFail, 'score');
  const points = score['score'];
  const grade = score['grade'];
  if (typeof points !== 'number' || !Number.isFinite(points) || points < 0 || points > 100) protocolFail('score must be 0-100');
  if (typeof grade !== 'string' || grade.length > 32) protocolFail('grade must be a short string');
  return { score: points as number, grade: grade as string };
}

function optionalScore(value: unknown): OfficialScore | null {
  return value === null || value === undefined ? null : parseScore(value);
}

function parseStoreObj(value: unknown): LegacyStoreObj {
  const store = object(value, protocolFail, 'storeObj');
  const mainSchema = store['mainSchema'];
  const faqs = store['faqs'];
  if (!isJsonObject(mainSchema)) protocolFail('storeObj.mainSchema must be an object');
  if (!Array.isArray(faqs) || !faqs.every(isJsonObject)) protocolFail('storeObj.faqs must be an array of objects');
  if (typeof store['type'] !== 'string' || typeof store['whitelistedDomains'] !== 'string') protocolFail('storeObj.type and whitelistedDomains must be strings');
  return { mainSchema: mainSchema as JsonObject, faqs: faqs as JsonObject[], type: store['type'] as string, whitelistedDomains: store['whitelistedDomains'] as string };
}

export function parsePublished(value: unknown): PublishedSchema | null {
  if (value === null) return null;
  const published = object(value, protocolFail, 'published');
  const at = published['publishedAt'];
  return {
    storeObj: parseStoreObj(published['storeObj']),
    publishedAt: at === null || at === undefined ? null : isoTime(at, protocolFail, 'publishedAt'),
    officialScore: optionalScore(published['officialScore']),
  };
}

export function parsePublishResult(value: unknown): PublishResult {
  const result = object(value, protocolFail, 'publish result');
  return { publishedAt: isoTime(result['publishedAt'], protocolFail, 'publishedAt'), officialScore: optionalScore(result['officialScore']) };
}

function hostPageUrl(value: unknown, hostOrigin: string, what: string): string {
  if (typeof value !== 'string' || value.length > 2048) protocolFail(`${what} must be a string`);
  let url: URL;
  try {
    url = new URL(value as string, hostOrigin);
  } catch {
    return protocolFail(`${what} is invalid`);
  }
  if (url.origin !== new URL(hostOrigin).origin) protocolFail(`${what} must stay on the host origin`);
  return url.toString();
}

/** Accepts only a URL on the host's own origin, so a host cannot redirect the user elsewhere. */
export function parseSignInUrl(value: unknown, hostOrigin: string): string {
  return hostPageUrl(value, hostOrigin, 'sign-in URL');
}

/** The KYC page must also stay on the host origin: users upload identity documents there. */
export function parseVerificationUrl(value: unknown, hostOrigin: string): string {
  return hostPageUrl(value, hostOrigin, 'verification URL');
}

function httpsUrl(value: unknown, what: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > 2048) protocolFail(`${what} must be a URL`);
  let url: URL;
  try {
    url = new URL(value as string);
  } catch {
    return protocolFail(`${what} is invalid`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) protocolFail(`${what} must be an HTTPS URL without credentials`);
  return url.toString();
}

export function parseVerification(value: unknown): VerificationStatus {
  const status = object(value, protocolFail, 'verification');
  const kyc = status['kyc'];
  if (typeof kyc !== 'string' || !(KYC_STATES as readonly string[]).includes(kyc)) protocolFail('verification.kyc is not a known state');
  if (typeof status['membershipActive'] !== 'boolean') protocolFail('verification.membershipActive must be a boolean');
  const domains = status['verifiedDomains'];
  if (!Array.isArray(domains) || domains.length > MAX_VERIFIED_DOMAINS) protocolFail('verification.verifiedDomains must be a bounded array');
  for (const domain of domains as unknown[]) {
    if (typeof domain !== 'string' || normalizeDomain(domain) !== domain) protocolFail('verification.verifiedDomains must hold normalized domains');
  }
  const key = object(status['apiKey'], protocolFail, 'verification.apiKey');
  const state = key['state'];
  const masked = key['masked'];
  if (typeof state !== 'string' || !(API_KEY_STATES as readonly string[]).includes(state)) protocolFail('verification.apiKey.state is not a known state');
  if (masked !== null && masked !== undefined && (typeof masked !== 'string' || !/^tl_…[a-f0-9]{4}$/i.test(masked))) protocolFail('verification.apiKey.masked must be a masked key');
  return {
    kyc: kyc as KycState,
    membershipActive: status['membershipActive'] as boolean,
    verifiedDomains: [...new Set(domains as string[])],
    hostedScriptUrl: httpsUrl(status['hostedScriptUrl'], 'verification.hostedScriptUrl'),
    certificateUrl: httpsUrl(status['certificateUrl'], 'verification.certificateUrl'),
    apiKey: { state: state as ApiKeyState, masked: typeof masked === 'string' ? masked : null },
  };
}

export function parseIssuedApiKey(value: unknown): IssuedApiKey {
  const issued = object(value, protocolFail, 'issued key');
  const apiKey = issued['apiKey'];
  if (!isApiKey(apiKey)) protocolFail('issued key is not a TrueLink API key');
  return { apiKey: apiKey as string, masked: maskApiKey(apiKey as string) };
}

// Client → host parameters: unknown fields are rejected so no account or owner can be smuggled in.

export function parseSaveInput(value: unknown): SaveDraftInput {
  const input = object(value, invalidFail, 'save input');
  exactKeys(input, ['record', 'expectedRevision', 'idempotencyKey'], invalidFail, 'save input');
  const expected = input['expectedRevision'];
  return {
    record: record(input['record'], invalidFail),
    expectedRevision: expected === null ? null : revision(expected, invalidFail, 'expectedRevision'),
    idempotencyKey: idempotencyKey(input['idempotencyKey'], invalidFail),
  };
}

export function parseDeleteInput(value: unknown): DeleteDraftInput {
  const input = object(value, invalidFail, 'delete input');
  exactKeys(input, ['id', 'expectedRevision'], invalidFail, 'delete input');
  return { id: documentId(input['id'], invalidFail, 'id'), expectedRevision: revision(input['expectedRevision'], invalidFail, 'expectedRevision') };
}

export function parsePublishInput(value: unknown): PublishInput {
  const input = object(value, invalidFail, 'publish input');
  exactKeys(input, ['mainId', 'mainRevision', 'faqId', 'faqRevision', 'idempotencyKey', 'confirmed'], invalidFail, 'publish input');
  if (input['confirmed'] !== true) invalidFail('publishing requires explicit confirmation');
  const faqId = input['faqId'];
  const faqRevision = input['faqRevision'];
  if ((faqId === null) !== (faqRevision === null)) invalidFail('faqId and faqRevision go together');
  return {
    mainId: documentId(input['mainId'], invalidFail, 'mainId'),
    mainRevision: revision(input['mainRevision'], invalidFail, 'mainRevision'),
    faqId: faqId === null ? null : documentId(faqId, invalidFail, 'faqId'),
    faqRevision: faqRevision === null ? null : revision(faqRevision, invalidFail, 'faqRevision'),
    idempotencyKey: idempotencyKey(input['idempotencyKey'], invalidFail),
    confirmed: true,
  };
}

export function parseIssueApiKeyInput(value: unknown): IssueApiKeyInput {
  const input = object(value, invalidFail, 'API key input');
  exactKeys(input, ['operation', 'idempotencyKey', 'confirmed'], invalidFail, 'API key input');
  if (input['confirmed'] !== true) invalidFail('issuing an API key requires explicit confirmation');
  const operation = input['operation'];
  if (operation !== 'provision' && operation !== 'rotate') invalidFail('operation must be "provision" or "rotate"');
  return { operation: operation as 'provision' | 'rotate', idempotencyKey: idempotencyKey(input['idempotencyKey'], invalidFail), confirmed: true };
}

export function parseRevokeApiKeyInput(value: unknown): void {
  const input = object(value, invalidFail, 'revoke input');
  exactKeys(input, ['confirmed'], invalidFail, 'revoke input');
  if (input['confirmed'] !== true) invalidFail('revoking the API key requires explicit confirmation');
}

export function parseScoreInput(value: unknown): SchemaDocumentRecord {
  const input = object(value, invalidFail, 'score input');
  exactKeys(input, ['record'], invalidFail, 'score input');
  return record(input['record'], invalidFail);
}

export function assertNoParams(value: unknown): void {
  if (value !== undefined && value !== null && !(isJsonObject(value) && Object.keys(value).length === 0)) invalidFail('this method takes no parameters');
}
