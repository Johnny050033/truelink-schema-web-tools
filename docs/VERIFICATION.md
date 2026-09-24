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

# Schema Studio app and schema-document package — 2026-09-24

Scope: new `packages/schema-document` and `apps/web` (PWA) workspaces, core library
subpath exports. No backend, credentials, analytics, deployment config or SaaS code.

Environment: Node.js 22.22.2, pnpm 11.19.0, TypeScript 7.0.2, Vitest 5.0.0, Vite 8.3.0,
React 19.3.0, headless Chromium (Playwright 1.56 browser build 1194) on Linux.

| Check | Actual result |
| --- | --- |
| `pnpm check` (core + all workspaces) | PASS |
| Core library tests / built-entry smoke | 67/67; 4/4 (now includes `./schema` and `./embed` subpaths) |
| `truelink-schema-document` tests | 72/72 (paths, pruning, script escaping, bounded import, audit, templates, descriptions) |
| `apps/web` tests | 25/25 (storage validation, store limits and quota handling, backups, routing, XSS rendering, link config, bilingual copy) |
| Production build | PASS; generated `sw.js` precaches every emitted and public file; CSP meta injected |
| Scripted browser walk-through (desktop 1440×900, mobile 390×844, dark mode) | Brand wizard, editor (form, JSON, checks, code, copy + suggestion card), import preview, library, account, settings and English UI: no console errors or CSP violations. Backup download/restore was covered by unit tests, not the browser script |
| Persistence | Documents survive reload |
| Offline | After the service worker activates, an offline reload renders the app |
| Dev server | Loads without console errors |

Not verified: installation prompts on real Android/iOS/desktop devices, Safari and
Firefox rendering, screen-reader passes, native store packaging, TrueLink sign-up URL
(defaults to the public homepage until configured), and the official brand colour codes
(tokens follow the CI brief's navy/green/gold direction and need confirmation).
