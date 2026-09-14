# Contributing

Thank you for helping improve `truelink-schema-web-tools`. This is an MIT-licensed,
local-first project: contribution, local use, forks, and self-hosting do not require
a TrueLink account, Google account, attribution link, telemetry, or cloud sync.
MIT does still require preservation of applicable copyright and license notices; that
legal notice is different from requiring a public attribution link.

## Scope and safe contributions

- Keep the core dependency-light and preserve its stated boundaries: the flat-object
  validator is not complete JSON Schema or Schema.org validation; the embed profile is
  deliberately restrictive.
- Use only synthetic fixtures. Do not submit customer Schema documents, account data,
  production exports, secrets, tokens, cookies, screenshots containing personal data,
  or private-system URLs.
- Add a focused test for changed behavior and run `pnpm check` before opening a pull
  request. Keep tests deterministic and offline unless a maintainer explicitly agrees
  to a separately reviewed integration test.
- Keep cloud, browser-extension, installer, store, and public-publishing work clearly
  marked as planned until its own source, security review, and acceptance evidence
  exist. Do not add service credentials or privileged backend code to this repository.

## Pull requests and issues

Open a GitHub issue first for a substantial API or security-boundary proposal, then
link it from the pull request. Small, self-contained fixes may go directly to a PR.
Describe the user-visible contract, limits, tests run, and any intentionally
unverified behavior. The initial product-direction discussion is in
[PR #1](https://github.com/Johnny050033/truelink-schema-web-tools/pull/1).

## Reporting security issues

Please do not publish exploit details, credentials, customer data, or a private target
URL in a public issue. Contact the repository owner privately with a minimal synthetic
reproduction, affected version/commit, impact, and suggested mitigation. Wait for a
coordinated response before disclosing a confirmed vulnerability.

Cloud account authorization, future private draft APIs, and any official public
snapshot service are not implemented here. Reports about those future surfaces should
describe the proposed boundary without probing real accounts or production services.
