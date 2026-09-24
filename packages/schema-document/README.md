# truelink-schema-document

The shared core of every TrueLink Schema tool: the Schema.org JSON-LD authoring layer used
by Schema Studio (`apps/web`), the host-bridge protocol and, through its browser build, the
TrueLink web tool. Pure TypeScript, no DOM and no network. MIT licensed; tests use synthetic
data only. `CORE_VERSION` reports the version a tool bundles.

This is **not** a complete Schema.org or Google rich-result validator. Its checks are
advisory: a completeness score measures how many known required/recommended fields are
present and well formed, and never promises rankings, rich results or AI citations.

## What it provides

| Module | API |
| --- | --- |
| Templates | `TEMPLATES`, `getTemplate`, `templateForTypes`, `typeLabel` — 11 bilingual (zh-TW/en) templates with field help, examples and conditional fields |
| Documents | `createDocumentData` (brand-profile auto-fill), `readField`/`writeField`, `readList`/`writeList`, `setAt`/`getAt` (prototype-safe, immutable) |
| Output | `buildOutput` (prunes empty values and type-only nodes, keeps unknown properties), `toJsonLdScript` (escapes `<`, `>`, `&`, U+2028/9), `combineGraph` |
| Import | `parseJsonLdText(s)` — splits arrays and `@graph`, bounds bytes/depth/nodes/blocks, rejects `__proto__`/`constructor`/`prototype` keys |
| Audit | `auditDocument` — required/recommended coverage, format checks (URL, ISO 8601, E.164-style phone, ISO codes, Taiwan business-ID checksum), cross-field checks, score and grade |
| Description | `describeDocument` — deterministic natural-language reading of the markup, facts and classified `sameAs` profiles |
| Contract | `SchemaDocumentRecord`, `createRecord`, `parseRecord` — the portable, client-authored document every TrueLink surface exchanges (owner, revisions and publication state stay server-side) |
| TrueLink web tool format | `fromLegacyStoreObj`, `toLegacyStoreObj`, `parseDomainList`, `LEGACY_LIMITS` — lossless conversion to and from `{ mainSchema, faqs, type, whitelistedDomains }`; `parseJsonLdText` also recognises that object |

## Builds for other TrueLink tools

| File | For |
| --- | --- |
| `dist/index.js` (+ `.d.ts`) | bundlers and Node.js (`import … from 'truelink-schema-document'`) |
| `dist/browser/truelink-schema-document.global.js` | pages without a bundler: `<script src="…global.js"></script>` exposes `window.TrueLinkSchema` |
| `dist/browser/truelink-schema-document.browser.mjs` | `<script type="module">` imports |
| `conformance/legacy-store.json` | cases every consumer should pass after upgrading (web tool format round trips) |

Tagged releases (`vX.Y.Z`, equal to this package's version) publish these files with
checksums, so the TrueLink web tool, its backend and Schema Studio can move to a new core
together. See [the platform strategy](../../docs/PLATFORM_STRATEGY.zh-TW.md), section 4.

## Limits (from the product plan)

Per document 100 KiB, per import 300 KiB, depth 20, 2,000 values, 20 import blocks,
20,000 characters per string. A limit hit is reported; data is never silently truncated.

## Develop

```sh
pnpm --filter truelink-schema-document check   # typecheck, tests, declaration + browser builds, browser smoke test
```
