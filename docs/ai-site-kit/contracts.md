# Existing contracts and limits

This kit links the existing library contracts; it does not define a new validation engine,
JSON Schema, OpenAPI document or HTTP API. The reference definitions are from commit
`da9ffb5200523a62939d365cf95c43315641ff2a`. When upgrading the library, review the current
definitions and its version together; do not assume the kit overrides them.

## Three different JSON files

| File | Meaning | How to use it |
| --- | --- | --- |
| [resources.json](resources.json) | Version 1 resource index: paths, provenance and availability notes | Discover documents; it is not a schema for customer data |
| [examples/synthetic-organization.json](examples/synthetic-organization.json) | One synthetic `SchemaDocumentRecord`, format `truelink.schema-document`, version 1 | Pass the record to the existing `parseRecord`; build JSON-LD from its `data` |
| [mock-scenarios.json](mock-scenarios.json) | Version 1 descriptive scenario catalog | Discuss expected local behavior; it is not a request body, runnable test suite or mock server |

Neither metadata format changes the portable record contract or grants an action to an AI.
Do not send a whole resource index or scenario object to a record parser or host method.

## Portable document

The authoritative [contract.ts](../../packages/schema-document/src/contract.ts) defines
`SchemaDocumentRecord` and `parseRecord`. Its top-level fields are exactly:

| Field | Meaning |
| --- | --- |
| `format` | `truelink.schema-document` |
| `version` | Number `1` |
| `id` | Client-generated stable ID, 8–64 letters/digits/underscores/hyphens |
| `title` | User title, including an empty title; at most 120 Unicode code points |
| `templateId` | One existing template ID |
| `data` | A bounded JSON object containing one JSON-LD node, not a top-level `@graph` |
| `updatedAt` | Finite non-negative client epoch milliseconds; informational, not a server revision |

Unknown envelope fields are rejected. Owner, workspace, role, server revision, official score
and publication state are not client-authored record fields. The shared parser validates the
envelope and JSON bounds; it does not establish business truth, account permissions or complete
Schema.org correctness. A valid record can still need content review and advisory audit fixes.

Only `data` is the authoring payload for JSON-LD. Use the existing `getTemplate`, `buildOutput`
and `toJsonLdScript` APIs to produce safe script output. The example's fixed timestamp and ID
are synthetic, not a provenance claim; replace them appropriately for a real local document.

## Existing templates

Use the [template index](../../packages/schema-document/src/templates/index.ts), not a second
catalog of copied field definitions:

| ID | Schema type |
| --- | --- |
| `organization` | Organization |
| `local-business` | LocalBusiness and supported subtypes |
| `person` | Person |
| `website` | WebSite |
| `service` | Service |
| `product` | Product |
| `article` | Article |
| `faq` | FAQPage |
| `event` | Event |
| `breadcrumb` | BreadcrumbList |
| `thing` | Generic Thing / other types |

These are 11 authoring templates, not HTML page designs or a complete catalog of Schema.org
types. Refer to each field's help and `learnMore` sources. `auditDocument` and
`describeDocument` are advisory views of supplied data; neither proves an external fact.

The existing [limits.ts](../../packages/schema-document/src/limits.ts) bounds a document at
100 KiB, an import at 300 KiB, depth at 20, values at 2,000, import blocks at 20 and an individual
string at 20,000 UTF-16 code units. Keep the library as the authority instead of treating this
summary as configurable service quota. A private/hosted service may impose separate limits.

## Optional host bridge and synthetic mock

The [cloud-client README](../../packages/cloud-client/README.md) and
[protocol.ts](../../packages/cloud-client/src/protocol.ts) specify the version 1
`truelink.host` message protocol. It is a typed same-origin bridge, not REST. It pins the peer
window/origin, validates both directions and keeps account ownership in the host session.
It is not a token exchange or a way for an arbitrary external site to access an account.

The [memory host](../../packages/cloud-client/src/memory-host.ts) supplies an in-process
reference implementation. Its draft operations demonstrate signed-out failures, revision
conflicts, idempotent retries and quotas without a backend. The
[scenario catalog](mock-scenarios.json) describes those cases using invented state. It adds
no HTTP listener or executable runner and does not issue credentials or publish to a real site.
It is a single simulated session; its output is not evidence of production account isolation.

A `CloudDraft` wraps a record with host-managed `revision` and `savedAt`; those fields do not
belong inside `SchemaDocumentRecord`. In this protocol, `expectedRevision: null` creates and a
matching current revision updates. Same-key identical retries reuse the first result;
different content with that key is invalid. A stale revision is a conflict, not permission
to overwrite a newer draft. This behavior is independent of the record's client clock.

## HTTP integrations are further reading

[Verified Schema API](../VERIFIED_SCHEMA_API.md) is the existing public description of
optional platform services, including public verification and authenticated schema delivery.
Read its actual requirements, including the distinction between public reads, domain-bound
embeds and server-side credentials. This kit provides no callable endpoint configuration,
API keys, OAuth flow, network adapter or service-availability guarantee. The manifest does
not list HTTP services as executable resources.

Before a separate integration, establish its current contract, authentication, owner consent,
quota and deployed behavior. Keep secrets out of client code and URLs. A library or in-memory
mock cannot prove that a hosted implementation exists or matches it. The first site can use
local structured data without that integration.
