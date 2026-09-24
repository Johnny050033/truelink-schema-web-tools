# truelink-schema-cloud

The **TrueLink host-bridge protocol**: how a client such as Schema Studio exchanges
Schema documents with a TrueLink account, without ever holding tokens or talking to a
database itself.

```text
Schema Studio (open source, this repo)          TrueLink host page (TrueLink site, same origin)
┌──────────────────────────────┐   postMessage   ┌───────────────────────────────────────────┐
│ createHostClient()           │ ◀────────────▶ │ serveHost(implementation)                 │
│ validates every response     │                 │ validates every request                   │
│ (records, revisions, URLs)   │                 │ uses the site's own sign-in session and    │
└──────────────────────────────┘                 │ calls TrueLink backend functions           │
                                                 └───────────────────────────────────────────┘
```

The package contains no network code, credentials or TrueLink backend logic. It provides:

| Export | Purpose |
| --- | --- |
| `createHostClient(transport, options)` | Client side: typed methods, timeouts, response validation |
| `serveHost(implementation, transport)` | Host side: request validation, dispatch, typed errors |
| `createMemoryHost(options)` | In-memory reference host that defines the required behaviour; used by tests and demos |
| `windowTransport({ receiver, peer, peerOrigin })` | `postMessage` transport pinned to one window and one origin |
| `createLinkedTransports()` | In-process transport pair for tests |
| `parse*` validators, `CloudError`, `PROTOCOL_LIMITS` | Shared validation, so both sides reject the same things |

Documents travel as `SchemaDocumentRecord` from
[`truelink-schema-document`](../schema-document/README.md): client-authored content only.
Owner, server revision, timestamps, official score and publication state stay server-side.

## Protocol v1

Every message is plain data: `{ channel: 'truelink.host', version: 1, kind, … }`.

| Kind | Direction | Body |
| --- | --- | --- |
| `hello` | client → host | asks the host to announce itself |
| `ready` | host → client | `methods`: the methods this host supports; optional `minCoreVersion` |
| `request` | client → host | `id`, `method`, `params` |
| `response` | host → client | `id`, then `ok: true, result` or `ok: false, error: { code, message, current? }` |
| `account` | host → client | `account`: the new account (or `null`) after a sign-in or sign-out |
| `changed` | host → client | `scope`: `drafts`, `published` or `verification` changed (another TrueLink tool, tab or device, a KYC decision, a key rotation) |

| Method | Params | Result |
| --- | --- | --- |
| `account.get` | none | `{ displayName }` or `null` |
| `account.signInUrl` | none | a URL **on the host origin** (the client rejects any other) |
| `drafts.list` | none | `CloudDraft[]` (`{ record, revision, savedAt }`) |
| `drafts.save` | `{ record, expectedRevision, idempotencyKey }` | the saved `CloudDraft` |
| `drafts.delete` | `{ id, expectedRevision }` | `null` |
| `published.get` | none | `{ storeObj, publishedAt, officialScore }` or `null` |
| `publish` | `{ mainId, mainRevision, faqId, faqRevision, idempotencyKey, confirmed: true }` | `{ publishedAt, officialScore }` |
| `score` (optional) | `{ record }` | `{ score, grade }` computed by the server, nothing saved |
| `verification.get` (optional) | none | `{ kyc, membershipActive, verifiedDomains, hostedScriptUrl, certificateUrl, apiKey: { state, masked } }`, never the key itself |
| `verification.startUrl` (optional) | none | TrueLink's KYC page, **on the host origin** (identity documents are uploaded there, never through the bridge) |
| `apiKey.issue` (optional) | `{ operation: 'provision' \| 'rotate', idempotencyKey, confirmed: true }` | `{ apiKey, masked }`: the key is shown once and the client must not store it |
| `apiKey.revoke` (optional) | `{ confirmed: true }` | `null` |

The Verified Schema methods expose TrueLink's KYC-bound schema delivery: see
[docs/VERIFIED_SCHEMA_API.md](../../docs/VERIFIED_SCHEMA_API.md).

Error codes: `signed-out`, `conflict`, `not-found`, `quota`, `invalid`, `forbidden`,
`rate-limited`, `unavailable`, `timeout`, `protocol`.

## Behaviour every host must implement

`createMemoryHost` is the executable specification; its tests (`test/cloud.test.ts`) are
the acceptance list.

1. **Owner from the session only.** The host derives the account (or active workspace)
   from its own sign-in state. Requests never carry an owner; `serveHost` rejects unknown
   fields such as `targetUid`, and records reject server-managed fields.
2. **Revisions, not last-writer-wins.** `expectedRevision: null` creates; a number must
   equal the current revision. A stale save fails with `conflict` and, where allowed, the
   current copy, so the client can offer "keep this / use cloud / keep both".
3. **Idempotent retries.** The same `idempotencyKey` returns the first result; reusing
   it for a different request fails with `invalid`.
4. **Private until published.** Drafts are readable only by the owner (and authorised
   workspace members). Saving never changes public output.
5. **Explicit publishing.** `publish` requires `confirmed: true` and publishes *saved*
   drafts at the revisions the user reviewed; a changed draft fails with `conflict`.
   The deployment-only domain whitelist is kept as it is.
6. **Quiet failures.** Unexpected host errors reach the client as `unavailable` with a
   generic message: no stack traces, tokens or internal identifiers.
7. **Same origin.** The host page is served from the client's origin, answers only
   `event.source === window.parent` with `event.origin === location.origin`, and is
   protected from being framed elsewhere (`frame-ancestors 'self'`).
8. **Announce changes.** When drafts or the published schema change anywhere (the TrueLink
   web tool, another tab or device), call `server.notifyChanged(scope)` so open clients
   refresh. Schema Studio then updates linked documents that have no local edits.
9. **Verified Schema (when offered).**
   - Keys are issued only with approved KYC and an active membership.
   - A replayed issue request never reveals the key again; answer it with `conflict`.
   - Store only a hash of each key.
   - A lapsed KYC or membership pauses the keyed API; it doesn't delete the key.
   - Call `notifyChanged('verification')` after KYC decisions, domain changes and key changes.
10. **Move versions together.** Pass `serveHost(…, { minCoreVersion })` when TrueLink
   upgrades `truelink-schema-document`; older clients are asked to reload before syncing.

## Minimal host page

```js
// host.js — loaded by /studio/host.html on the TrueLink site (sketch).
import { serveHost, windowTransport, CloudError } from 'truelink-schema-cloud';

const implementation = {
  async getAccount() { /* return { displayName } for the signed-in user, or null */ },
  async signInUrl() { return '/login.html?next=%2Fstudio%2F'; },
  async listDrafts() { /* call the backend's list function for the active workspace */ },
  async saveDraft(input) { /* call the backend's save function; map its errors to CloudError codes */ },
  async deleteDraft(input) { /* … */ },
  async getPublished() { /* … */ },
  async publish(input) { /* server-side publish of the pinned draft revisions */ },
};

if (window.parent !== window) {
  const server = serveHost(implementation, windowTransport({ receiver: window, peer: window.parent, peerOrigin: location.origin }));
  // Call server.notifyAccount(account) whenever the site's auth state changes, and
  // server.notifyChanged('drafts' | 'published') when a listener sees data change.
}
```

## Bundles for host pages

| File | For |
| --- | --- |
| `dist/index.js` (+ `.d.ts`) | bundlers (`import … from 'truelink-schema-cloud'`) |
| `dist/bundles/truelink-schema-cloud.global.js` | classic `<script>` host pages: exposes `window.TrueLinkCloud` (shared core included) |
| `dist/bundles/truelink-schema-cloud.mjs` | self-contained `<script type="module">` imports |

Tagged releases publish both bundles with checksums.

## Develop

```sh
pnpm --filter truelink-schema-cloud check   # typecheck, tests, build, bundle smoke test
```

MIT licensed. See the repository [TRADEMARKS.md](../../TRADEMARKS.md) for brand assets.
