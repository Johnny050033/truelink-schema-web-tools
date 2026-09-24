# truelink-schema-document

Local-first Schema.org JSON-LD authoring layer used by Schema Studio (`apps/web`).
Pure TypeScript, no DOM and no network. MIT licensed; tests use synthetic data only.

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

## Limits (from the product plan)

Per document 100 KiB, per import 300 KiB, depth 20, 2,000 values, 20 import blocks,
20,000 characters per string. A limit hit is reported; data is never silently truncated.

## Develop

```sh
pnpm --filter truelink-schema-document check   # typecheck, tests, declaration build
```
