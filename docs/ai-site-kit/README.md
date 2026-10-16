# AI-readable site resource kit

Use this small resource pack with the person or AI helping you build a website. It connects
your approved brand facts to the existing Schema Studio libraries, templates and review
criteria. It contains documentation and synthetic JSON fixtures; it does not generate or
host a website, call a backend, or publish anything for you.

## Start here

1. Read [resources.json](resources.json), the versioned resource index. It points to the
   existing libraries and the files in this kit; it is not JSON Schema or OpenAPI.
2. Complete the [brand interview](brand-interview.md) in your own private workspace. Keep
   unknown facts unresolved. Ask the content owner to approve each fact intended for the site.
3. Read [contracts.md](contracts.md). Choose an existing Schema template that matches the
   content and use the shared core for checks and safe output. Build the actual site with
   your own framework and assets.
4. Start from [synthetic-organization.json](examples/synthetic-organization.json) to understand
   the portable record format. It is invented demonstration data, not a real business or a
   ready-to-publish customer page. Only its `data` is JSON-LD; the envelope is an editing record.
5. Use [mock-scenarios.json](mock-scenarios.json) to discuss failure states with your developer.
   These are static descriptions of the existing in-memory host, not runnable requests or a
   new mock server. Keep site creation separate from optional account integrations.
6. Review the actual website with [acceptance.md](acceptance.md) and record what was checked,
   what failed and what is still unknown before publishing.

### 繁中快速開始

先把這份導覽和 `resources.json` 交給協助建站的 AI，再於自己的私有工作空間回答
[品牌訪談](brand-interview.md)。AI 應將未確認的事實列成待補，不編造認證、評價、數據或品牌故事。
選用現有 Schema 模板，使用自己的網站框架及素材；本包沒有自動建站或發布功能。
範例都是虛構資料，公開前須由內容擁有人核對實際頁面與 JSON-LD。

## What already exists

| Resource | Use |
| --- | --- |
| [Shared core](../../packages/schema-document/README.md) | Create records, use 11 templates, import bounded JSON-LD, audit, describe and export safely |
| [Document contract](../../packages/schema-document/src/contract.ts) | Portable client-authored `SchemaDocumentRecord`, validated by `parseRecord` |
| [Template index](../../packages/schema-document/src/templates/index.ts) | Organization, LocalBusiness, Person, WebSite, Service, Product, Article, FAQPage, Event, BreadcrumbList and Thing |
| [Brand wizard](../../apps/web/src/features/brand/BrandPage.tsx) | Existing basic identity, contact, official-profile and authority field groups |
| [Host protocol](../../packages/cloud-client/README.md) | Optional same-origin bridge, separate from local editing |
| [Memory host](../../packages/cloud-client/src/memory-host.ts) | Synthetic in-process reference for revisions, retries and failure states |

These are Schema authoring templates, not complete website layouts. The checks are advisory,
not complete Schema.org or search-engine eligibility validation. Keep visible page content
and structured data consistent; a high completeness score cannot prove a business claim.

## Source, release and service status

The manifest's reference commit `da9ffb5200523a62939d365cf95c43315641ff2a` identifies the
existing library/protocol definitions used to prepare this kit. It does **not** mean these
new kit files were already present in that commit. Review the kit's own Git history separately.

The GitHub Releases list was empty when checked on **2026-10-16**. The configured release
workflow and local package versions are not shipped artifacts. Consult the
[current Releases list](https://github.com/Johnny050033/truelink-schema-web-tools/releases)
before referring to an installer, bundle or checksum. This pack has no independent release
or runtime acceptance claim; it does not verify hosted APIs, accounts, deployment or device support.

Existing [Verified Schema documentation](../VERIFIED_SCHEMA_API.md) describes optional
platform services. It is further reading, not a dependency of this kit or proof that a
service is currently available. This kit supplies no HTTP client, token flow or callable
endpoint configuration. Its default examples work as local data without a TrueLink account.

## Sharing and license

Use invented names and reserved example domains in public examples. Never put completed
customer interviews, credentials, private drafts, identity documents, analytics exports or
unpublished material into issues or this repository. A business fact being readable somewhere
does not make its owner approve every reuse. Keep only the approved public subset on a site.

The code is [MIT licensed](../../LICENSE); retain its notice when reusing it. The TrueLink
name, shield and icons have separate [trademark terms](../../TRADEMARKS.md). Use your own
branding for a customer site or unofficial fork. Follow [SECURITY.md](../../SECURITY.md) for
private vulnerability reporting. Nothing here guarantees rankings, rich results, traffic or AI citations.
