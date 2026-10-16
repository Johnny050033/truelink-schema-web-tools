# Website and structured-data review

Use this checklist on the website you actually built. It is a review aid, not a certificate,
security audit or proof that a service is deployed. Record **pass**, **fail** or **not checked**
with the page/version, date and concrete evidence. “Not checked” is not a pass. Resolve
failures or keep the affected feature out of the public version.

這是實際網站的檢查輔助，不是認證。每項記錄通過、失敗或未檢查，以及版本、日期與證據；
未檢查不能算通過。資源包或範例能讀取，不代表網站已驗收或已發布。

## Content and ownership

- The content owner approved the exact public facts, business contacts and images.
- Unknown facts, sample values and unsupported claims are absent from the customer site.
- Prices, events, reviews, expertise and awards have appropriate sources and permission.
- Visible content and JSON-LD describe the same entity and facts; FAQ answers are visible.
- The site uses assets it may redistribute. MIT notices are retained where required;
  [TrueLink trademark terms](../../TRADEMARKS.md) are respected.
- Private drafts, completed interviews, credentials, identity documents and private analytics
  are absent from source, URLs, public exports, logs and screenshots shared for review.

## Record and output

- Validate portable editing records with the existing `parseRecord`; refer to
  [contracts.md](contracts.md). Do not treat the resource manifest as a validator.
- Check malformed, unsupported-version and unknown-field records, not only a valid sample.
  Reject invalid input visibly rather than silently inventing a replacement.
- Select the existing template that fits the content. Review the explained issues from
  `auditDocument`; its advisory score does not establish eligibility or truth.
- Keep within the current [core limits](../../packages/schema-document/src/limits.ts).
  A size/depth/node limit must produce an understandable failure, not truncated content.
- Use `buildOutput` and `toJsonLdScript` for JSON-LD output. Do not publish the portable
  record envelope as JSON-LD or inject pasted customer HTML into the host document.
- Verify the exported markup in the actual rendered page. Inspect safe script output and
  absence of executable customer content; do not infer safety from a screenshot.

## Website experience

- Review desktop and the actual supported mobile widths, including long names and URLs.
  There is no clipped primary action, accidental horizontal scrolling or hidden content.
- Check keyboard navigation, visible focus, meaningful labels, contrast and text resizing.
- The most important visitor task works; links, images, downloads and forms have clear states.
- Test missing content, blocked storage, failed requests and recovery where applicable.
  Preserve unsaved work and explain unresolved state; an empty result is not an error-free success.
- Record the browsers/devices checked and any unsupported combinations. Inspect console and
  network errors and what the visitor sees, rather than using historical library test counts.

## Optional account integrations

The default kit needs no account or network calls. If you later add an integration, review
its current published contract, authentication, permissions, limits and availability first.
The [public host protocol](../../packages/cloud-client/README.md) and its
[reference mock](../../packages/cloud-client/src/memory-host.ts) are separate from a live service.

- A user sees and approves uploads and publication separately; a save never implies publish.
- Account changes, expired/revoked access, concurrent edits and retry conflicts are visible
  and do not overwrite local work without a deliberate decision.
- No owner/role supplied in content grants access; credentials do not enter page code, Git or URLs.
- The deployed integration is checked separately with permitted evidence. Local mocks or
  a published protocol do not prove production behavior, KYC status, privacy or availability.

This kit does not provide an HTTP adapter or operate these integrations. For safe local
discussion of expected states, see [mock-scenarios.json](mock-scenarios.json).

## Handoff

Keep an evidence list with the checked version/pages, results, unresolved items and the
person responsible for follow-up. Separate local checks, shipped artifacts and deployed
behavior. An empty Release list or a workflow definition is not a downloadable product.
No check here guarantees ranking, rich results, traffic or AI citations. Security reports
follow the private channel in [SECURITY.md](../../SECURITY.md).
