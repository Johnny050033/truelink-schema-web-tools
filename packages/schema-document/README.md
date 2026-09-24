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
| Templates | `TEMPLATES`, `getTemplate`, `templateForTypes`, `typeLabel` — 11 templates with field help, examples and conditional fields, in 7 languages |
| Documents | `createDocumentData` (brand-profile auto-fill), `readField`/`writeField`, `readList`/`writeList`, `setAt`/`getAt` (prototype-safe, immutable) |
| Output | `buildOutput` (prunes empty values and type-only nodes, keeps unknown properties), `toJsonLdScript` (escapes `<`, `>`, `&`, U+2028/9), `combineGraph` |
| Import | `parseJsonLdText(s)` — splits arrays and `@graph`, bounds bytes/depth/nodes/blocks, rejects `__proto__`/`constructor`/`prototype` keys |
| Audit | `auditDocument` — required/recommended coverage, format checks (URL, ISO 8601, E.164-style phone, ISO codes, Taiwan business-ID checksum), cross-field checks, score and grade |
| Description | `describeDocument` — deterministic natural-language reading of the markup, facts and classified `sameAs` profiles |
| Contract | `SchemaDocumentRecord`, `createRecord`, `parseRecord` — the portable, client-authored document every TrueLink surface exchanges (owner, revisions and publication state stay server-side) |
| TrueLink web tool format | `fromLegacyStoreObj`, `toLegacyStoreObj`, `parseDomainList`, `LEGACY_LIMITS` — lossless conversion to and from `{ mainSchema, faqs, type, whitelistedDomains }`; `parseJsonLdText` also recognises that object |
| Languages | `LOCALES`, `LOCALE_INFO`, `localize`, `registerCatalog`, `fmt`, `joinList`, `sentenceSeparator` — see below |

## Languages

Every text is a `LocalizedText`, written in the two source languages (`en`, `zh-TW`). The
other locales (`zh-CN`, `ja`, `es`, `pt-BR`, `id`) come from JSON catalogs shipped in
`locales/` (package export `truelink-schema-document/locales/<locale>.json`):

```ts
import { describeDocument, getTemplate, localize, registerCatalog } from 'truelink-schema-document';
import ja from 'truelink-schema-document/locales/ja.json' with { type: 'json' };

registerCatalog('ja', ja);                        // once, before rendering Japanese
localize(getTemplate('event').name, 'ja');        // template labels, help and check messages
describeDocument(template, data, 'ja').sentences; // sentences and facts in Japanese
```

Missing translations fall back to English (Traditional Chinese for `zh-CN`). Catalogs are keyed
by the English text, or the Traditional Chinese text for `zh-CN`. `LOCALE_INFO[locale].status`
is `beta` until a native speaker has reviewed a language. `pnpm i18n` refreshes the reference
files; `pnpm i18n:check` validates slots and wording; see
[CONTRIBUTING.md](../../CONTRIBUTING.md#translations).

## Builds for other TrueLink tools

| File | For |
| --- | --- |
| `dist/index.js` (+ `.d.ts`) | bundlers and Node.js ES modules (`import … from 'truelink-schema-document'`) |
| `dist/bundles/truelink-schema-document.cjs` | Node.js CommonJS, e.g. Cloud Functions (`require('truelink-schema-document')` resolves here) |
| `dist/bundles/truelink-schema-document.global.js` | pages without a bundler: `<script src="…global.js"></script>` exposes `window.TrueLinkSchema` |
| `dist/bundles/truelink-schema-document.mjs` | self-contained `<script type="module">` imports |
| `conformance/legacy-store.json` | cases every consumer should pass after upgrading (web tool format round trips) |
| `locales/<locale>.json` | translation catalogs for `registerCatalog` |

Tagged releases (`vX.Y.Z`, equal to this package's version) publish these files with
checksums, so the TrueLink web tool, its backend and Schema Studio can move to a new core
together. See [the platform strategy](../../docs/PLATFORM_STRATEGY.zh-TW.md), section 4.

## Limits (from the product plan)

Per document 100 KiB, per import 300 KiB, depth 20, 2,000 values, 20 import blocks,
20,000 characters per string. A limit hit is reported; data is never silently truncated.

## Develop

```sh
pnpm --filter truelink-schema-document check   # typecheck, translation checks, tests, declarations + bundles, bundle smoke test
pnpm --filter truelink-schema-document i18n    # refresh locales/en.json and locales/zh-TW.json after changing text
```
