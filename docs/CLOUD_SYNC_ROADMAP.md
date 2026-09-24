# Open-source editor + optional hosted schema storage

Status: proposal only. Step 1 (the local-first editor) now exists as the Schema Studio
PWA in `apps/web`; it is not a sync client, native desktop app or cloud storage service.
Its sign-up buttons only link to the TrueLink site. Nothing here deploys a backend,
sends customer data, or changes another repository.

## Product recommendation

1. **Local-first editor:** import, edit, validate and export JSON-LD without an account.
   Build a separately versioned Schema.org authoring/validation layer; the existing
   flat-object API validator must not be advertised as complete Schema.org validation.
2. **Optional TrueLink cloud sync:** sign in and explicitly choose synchronization.
   Store private documents under the authenticated owner or an authorized workspace.
   Do not automatically publish private drafts, import old files, or enroll telemetry.
3. **Explicit publishing:** create a separate public, revocable snapshot only when
   requested. Editing a private draft must not accidentally replace public output.

Benefits: easy open-source adoption, portable documents and a useful hosted service.
Costs: account support, abuse prevention, storage/version retention, recovery and
ongoing security maintenance. Open-source licensing does not imply unlimited free
cloud capacity. Quotas, retention and any paid plans need a separate product decision.

## Proposed trust boundary

```text
Local files / editor
   -> explicit sign-in and sync choice
   -> authenticated HTTPS API
   -> server verification + owner/workspace authorization + quotas
   -> private versioned document storage
   -> optional separately authorized public snapshot
```

Never embed a service-account key, server secret or privileged database credential
in the repository, installer or client. A user identity supplied in a request body
is not authority. Verify the actual session/token on the backend and derive ownership
there; enforce that identity for read, list, write, export and deletion, not only UI.

For a web app, use an approved existing authentication flow. If a native/desktop
client is later selected, use the system browser and a standards-compliant public
client flow (authorization code + PKCE where supported); do not invent a shared
client secret or assume the existing auth provider already exposes the required flow.

## Data and API design to decide before implementation

- Document: stable ID, schema format/version, JSON-LD payload, title and revision.
  Owner/workspace, creation/update timestamps, revision authority, quota counters and
  publication state are server-managed, never accepted as client-controlled fields.
- Conflict safety: expected revision / ETag comparison; preserve conflicting offline
  edits instead of last-writer-wins silent overwrite. Idempotent create/update retries.
- Limits: payload bytes, depth, nodes, documents per account, list page size, write
  rate and retained versions. Define deletion, export, backup retention and recovery.
- Avoid server-side URL fetching during save. JSON-LD external contexts or links must
  not become arbitrary backend fetches (SSRF) or unbounded remote dependency loading.
- Encrypt transport and use managed storage encryption; do not claim end-to-end
  encryption if servers must inspect, validate or publish plaintext documents.
- Keep audit events minimal: no tokens, whole schema documents, customer secrets or
  unnecessary PII in logs. Public schemas and private source drafts are distinct.
- Reuse existing SaaS identities and permissions only after its owner approves a
  separate integration change. No private backend code needs to enter this MIT repo.

## Minimum acceptance before cloud launch

- Account A cannot read/list/update/delete account B's documents; workspace membership
  revocation takes effect and expired/revoked sessions fail closed.
- Forged owner/server-managed fields, unknown input fields and malformed payloads fail.
- Duplicate requests, concurrent edits, offline reconnection, pagination, quota limits,
  token refresh, cancellation and partial upload failures have deterministic outcomes.
- Export and deletion work; private documents stay inaccessible to anonymous requests,
  embeds, search engines and public CDNs until separately published.
- Windows and iOS-supported client workflows are actually tested. No claim of a native
  mobile/desktop installer follows from an npm package or a repository ZIP.
- Storage costs, retention, region, user consent and support/recovery instructions are
  explicit before opening registration. Do not promise availability before measurement.

## Official implementation references

- [Firebase server-side ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firestore authorization conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [RFC 8252 — OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252)

These sources inform a future design; no production API or compatible OAuth server
has been configured or verified by this proposal.
