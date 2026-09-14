# Initial skeleton verification — 2026-09-15

Scope: this independent repository only. No private SaaS source, production data,
cloud integration, credentials, deployment configuration or auth-repair files copied.

Environment: Node.js 24.14.0, pnpm 11.19.0, TypeScript 7.0.2, Vitest 5.0.0.
Dependencies and transitive versions are pinned by pnpm-lock.yaml.

| Check | Actual result |
| --- | --- |
| Frozen lockfile installation, lifecycle scripts disabled | PASS |
| Strict TypeScript check | PASS |
| Vitest synthetic tests | 67/67 passed; 2/2 suites |
| ESM + declaration build | PASS |
| Built-package export smoke | 2/2 passed |
| pnpm pack | Installable local .tgz produced |
| pnpm audit, including development dependencies | No known advisories reported at this check |
| Bounded independent embed review | No P0/P1 bypass found in tested scope |

Negative cases include parser-discarded body handlers, scripts, CSS scope escapes,
comment/escape-obfuscated fixed positioning and style-tag breakout attempts. The
validator inspects HTML tokens before tree construction so silently discarded source
does not bypass rejection. Invalid/deep trees are never passed to the serializer.

Not verified: real-browser matrix, native installers, full Schema.org validation,
production security certification, npm registry publication or cloud synchronization.
The public repository and locally packed library are not claims of those capabilities.
