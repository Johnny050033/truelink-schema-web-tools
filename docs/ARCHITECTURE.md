# Architecture

Schema Studio is one of several TrueLink surfaces built on a single shared core. This page
explains the pieces in this repository and how they connect. The product and distribution
strategy is in [PLATFORM_STRATEGY.zh-TW.md](PLATFORM_STRATEGY.zh-TW.md) (Traditional Chinese).

```text
                      ┌────────────────────────────────────────────┐
                      │ truelink-schema-document  (shared core)    │
                      │ templates · checks · descriptions · import │
                      │ document contract · translations           │
                      └─────────────────────┬──────────────────────┘
          ESM / CommonJS / browser bundles, locales/*.json, conformance cases
        ┌──────────────────┬────────────────┴───────┬─────────────────────┐
  Schema Studio      TrueLink web tool       other TrueLink tools     your project
  (apps/web, PWA)    (tools/schema, SaaS)    (extension, plugins)     (npm package)
        │
        │ postMessage · truelink-schema-cloud protocol v1 (optional)
        ▼
  TrueLink host page (same origin, private) ──▶ TrueLink backend (private)
```

Everything above the host page is in this repository and MIT licensed. The host page,
storage and backend belong to the private TrueLink platform.

## Workspaces

| Workspace | Role |
| --- | --- |
| `packages/schema-document` | **Shared core.** Template definitions (organization, local business, person, website, service, product, article, FAQ, event, breadcrumb, generic), JSON-LD output and parsing, bounded import, advisory checks (`auditDocument`), readable summaries (`describeDocument`), the `SchemaDocumentRecord` contract and conversion from the TrueLink web tool's stored format, translations. |
| `packages/cloud-client` | **Host bridge.** The typed `postMessage` protocol between the Studio and a TrueLink host page: client, host dispatcher and an in-memory reference host that defines required behaviour. |
| `apps/web` | **Schema Studio.** React 19 PWA: brand-profile wizard, form and JSON-LD editors, previews, import/export, optional cloud drafts. |
| `/` (root) | Low-level library: strict flat-object validation and a sandboxed static-embed renderer ([LIBRARY.md](LIBRARY.md)). |

The Studio resolves workspace packages from TypeScript sources (a custom `source` export
condition), so a change in the core shows up in the Studio without a separate build.

## Local-first data

- Documents, the brand profile and preferences live in `localStorage` slices
  (`truelink-schema-studio:v1:*`).
- Every read is validated: envelopes with `validateSchema`, and JSON-LD bodies with a bounded
  `checkJsonValue` (depth, node count, string length, forbidden keys). Unreadable data is
  kept under a `:corrupt` key, never silently deleted.
- Budgets (20 documents, 3 MiB total, 100 KiB per document) block writes instead of
  dropping data.
- The service worker precaches the app shell and every chunk, including translations, so
  the Studio works offline. It answers only for the Studio's own files.

## Checks and descriptions

`auditDocument(template, data)` scores completeness from the template's `required` and
`recommended` fields and validates values by kind (URLs, dates, phone numbers, currencies,
languages, opening hours …). Scores and grades are advisory: they describe how complete
and machine-readable the data is, not a search-engine outcome.

`describeDocument(template, data, locale)` turns the same data into plain sentences, key
facts and official profiles. It is the "what machines can read about you" preview.

## Internationalization

- **Locales:** `en`, `zh-TW`, `zh-CN`, `ja`, `es`, `pt-BR` and `id`
  (`LOCALES` and `LOCALE_INFO` in the core).
- **Source languages:** English and Traditional Chinese. Every bundled text is written as
  `t('中文', 'English')`. Messages with values use templates with `{slots}`
  (`fmt()`), so each language can choose its own word order.
- **Catalogs:** other locales resolve through flat JSON catalogs.
  - Core catalogs (`packages/schema-document/locales/`) are keyed by the English text,
    except `zh-CN`, which is keyed by the Traditional Chinese text.
  - Studio catalogs (`apps/web/src/i18n/locales/`) are keyed by message id.
  - A missing translation falls back to English, or to Traditional Chinese for `zh-CN`.
- **Loading:** the Studio bundles English and Traditional Chinese. Other locales download
  on first use, and before the first render when saved as the preference.
- **Guarantees, enforced by `pnpm check`:**
  - An extractor rejects text built outside the catalog helpers.
  - A coverage test proves every template label, check message and description sentence
    resolves through a catalog.
  - Catalog checks keep slots intact and reject promise wording ("guaranteed ranking"
    and its equivalents) in every language.
- **Translation status:** translated locales carry `status: 'beta'` until a native speaker
  reviews them. The Studio shows a Beta tag and links to [CONTRIBUTING.md](../CONTRIBUTING.md#translations).

## One update, every tool

The core exports `CORE_VERSION`, kept equal to its package version by a test.

- A TrueLink host announces `minCoreVersion` in its `ready` message. An older Studio stops
  syncing and asks the user to reload.
- Tags `v*` run [release.yml](../.github/workflows/release.yml):
  - browser, ESM and CommonJS builds of the core
  - the host-bridge bundles
  - conformance cases
  - npm tarballs
  - a standalone Studio build
  - `SHA256SUMS`

  Every TrueLink tool pins the same version.
- Linked documents follow newer cloud versions automatically when they have no local
  edits. Conflicts are always the user's choice: keep this device, use the cloud copy or
  keep both.

## Cloud drafts (optional)

Enabled only when the Studio is served by TrueLink with `VITE_TRUELINK_HOST_URL`
pointing to a same-origin host page. The Studio never holds tokens or calls a database.

It asks the host page, over the versioned protocol, to:

- list, save or delete drafts (with revision checks and idempotency keys)
- publish (explicitly confirmed)

The protocol, and what every host must implement, is documented in
[packages/cloud-client/README.md](../packages/cloud-client/README.md).

## Builds, CI and releases

| Workflow | When | What |
| --- | --- | --- |
| [ci.yml](../.github/workflows/ci.yml) | pull requests, pushes to `main` | `pnpm check`: typecheck, translation checks, tests, builds, bundle smoke tests |
| [pages.yml](../.github/workflows/pages.yml) | pushes to `main` | deploys the standalone Studio to GitHub Pages (the public demo) |
| [release.yml](../.github/workflows/release.yml) | tags `v*` | versioned artifacts for every TrueLink tool |

Security boundaries (CSP, input limits, what the service worker may answer) are listed in
[SECURITY.md](../SECURITY.md).
