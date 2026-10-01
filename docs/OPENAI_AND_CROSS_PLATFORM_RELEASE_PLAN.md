# OpenAI integration and coordinated core releases

Status: design only, 2026-10-01. This PR does not implement an MCP endpoint, optimize runtime code, publish packages, submit a listing or enable Dots. Baseline: `da9ffb5200523a62939d365cf95c43315641ff2a`. It extends [the existing platform strategy](PLATFORM_STRATEGY.zh-TW.md), including its shared-core and host-bridge boundaries.

## Use the existing core

`packages/schema-document` is the single source for templates, bounded imports, serialization, advisory checks and portable records. The core currently declares `0.3.0`; `RECORD_VERSION` is a separate document-format version. Studio, browser bundles, server consumers, CLI and MCP adapters must reference the same accepted release. Authentication, official scores and publication decisions remain with the service host, not this MIT core.

Before optimizing, measure parse/validate/audit/serialize over 30 synthetic documents and three size tiers. Preserve round-trip data, issue codes, limits and script escaping. Compare cold/warm latency and memory with nonzero samples and malicious/oversized controls. No speed claim based on skipped validation or a smaller input. Optimization belongs in this core, not copied into a platform adapter.

## OpenAI entry point

The proposed first listing is **TrueLink Schema Tools**, a thin MCP adapter using this package. Start with read-only templates, validation and JSON-LD preview. Each tool returns structured content with an output schema, stable issue codes, advisory limitations and `coreVersion`. Preview does not save or publish content, fabricate qualifications or award an official score.

Keep existing limits: 100 KiB/document, depth 20 and 2,000 nodes. Template pages contain at most 20 summaries. Explicit annotations: readOnlyHint=true, destructiveHint=false and openWorldHint=false. No arbitrary URL fetching in this first release; introducing a network scanner requires a separately reviewed URL-security and resource budget.

Private draft access is a subsequent authenticated adapter: OAuth 2.1/PKCE, verified issuer/audience/scope, expiring/revocable credentials, host-side owner authorization, expected revision and retry-safe request ID. Same-origin browser bridge authentication is not a substitute for external OAuth. Do not put Firebase cookies, secrets, customer documents or reviewer credentials in packages or repository fixtures. Saving a private draft must never implicitly publish it.

Prepare HTTPS hosting, developer/domain verification, privacy/terms/support, accurate metadata, a demo video and five positive plus three negative review cases. Positive cases cover template paging, valid entity validation, missing-field guidance, safe preview and a supported locale. Negative cases cover oversized input, malicious keys/content and attempted unauthorized publication. Authenticated releases additionally test tenant isolation, revoked/wrong scopes and conflicts.

Discovery is not a promised recommendation or signup volume. Provide useful results first; preserve optional account use and the contribution route. Follow current OpenAI restrictions on advertising and digital-service/subscription promotion; do not add a checkout funnel to the tools. Offline MIT use remains possible without registration or analytics.

## Dots is an optional consumer

As checked on 2026-10-01, eligible OpenAI plans include Dots, subject to rollout and account requirements. Conversations with a dot do not consume ChatGPT usage limits; Work/Codex tasks it starts or manages consume those products' limits. Included does not mean unlimited free generation.

Integrate through a supported, installed and enabled MCP/plugin connection with the user's account permissions. No separate public Dots API is assumed. Account eligibility, permissions and allowance need verification before use. This public Schema plugin exposes neither private operational controls nor arbitrary shell execution. It must work independently of Dots; do not start scheduled Dots jobs or paid delegated tasks as part of installation.

## Coordinate every platform update

Extend the existing tag-based `.github/workflows/release.yml`, not a second publisher. It already checks core/tag alignment and collects browser bundles, package tarballs, locales, conformance data, Studio and SHA256SUMS. Its presence does not prove a release or store listing exists.

Proposed release manifest fields:

| Field | Purpose |
|---|---|
| manifestVersion, sourceCommit, coreVersion | Bind all artifacts to the reviewed source/release |
| recordVersion, protocolVersion | Separate stored-data and bridge compatibility from package versions |
| conformanceDigest | Bind acceptance tests to the same release |
| artifacts[]: path, target, bytes, sha256 | Exact artifact inventory; safe relative paths only |

Proposed release sequence:

1. Improve the core and run existing checks plus old/new conformance and resource-bound tests.
2. Build twice in a clean locked-dependency checkout; explain any nondeterministic bytes.
3. Create the verified tag/release manifest and artifacts through the existing release workflow.
4. Update all service consumers in one reviewable integration PR: web browser core, host, server core and rebuilt Studio. Extend the existing service-side importer instead of creating a second sync utility.
5. Rebuild MCP/CLI/extensions from the same release. Verify actual versions and hashes at each target.
6. Submit store builds as needed. Record expected, built, submitted and live versions separately, with observedAt and evidence links. A pending store review is not a synchronized live release.

Patch/minor updates may automatically propose an update PR; they must not automatically merge or deploy without acceptance. Reject missing artifacts, path traversal, invalid hashes, unverified sources and incompatible formats. Retain the previous complete release for rollback. Major changes need bounded compatibility and migration; an incompatible old client must not write, while retaining its local export path.

Web/PWA, service browser/server, MCP, CLI/npm/CDN, App/LIFF and store extensions each have their own actual-version receipt. Platforms not yet implemented are marked unavailable, never counted as upgraded. A shared package version alone is insufficient: source SHA and artifact identity must agree. Hook drift checks into the existing release/monitoring flow rather than adding continuous polling.

## Delivery stages and tradeoffs

| Stage | Benefit | Cost / acceptance |
|---|---|---|
| Core baseline and compatible optimization | Every consumer benefits from one change | Benchmark and unchanged conformance; no promised speedup |
| Manifest and importer integration | Prevents partial upgrades and enables grouped rollback | Paired core/service PRs and wrong-version/hash negative tests |
| Read-only MCP and listing packet | Accessible trials and developer collaboration | Hosting, security review and platform review; no guaranteed discovery |
| Authenticated draft access and optional Dots | User-chosen continuity across entry points | OAuth, tenant tests, usage/permission verification; no unlimited-free claim |

Current: documentation only. Next: core/service implementers inventory actual consumers and build the baseline before performance changes. Future: accepted shared release, read-only listing, then scoped private draft access. Blocked on: independent review, implementation evidence, public endpoint/developer verification and any account-specific Dots eligibility. Do not treat this design as shipped capability.

Official sources checked 2026-10-01: [Dots access and usage](https://learn.chatgpt.com/docs/dots#access), [Dots computers/apps](https://learn.chatgpt.com/docs/dots/computers-and-apps), [OpenAI submission](https://developers.openai.com/plugins/deploy/submission), [tool design](https://developers.openai.com/plugins/plan/tools), [authentication](https://developers.openai.com/plugins/build/auth), [plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines). Recheck before submission; platform rules and account access can change.
