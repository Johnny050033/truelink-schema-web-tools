# truelink-schema-web-tools

Independent TypeScript utilities for strict object validation and isolated static
web embeds, plus **TrueLink Schema Studio**, an installable local-first Schema.org
editor. MIT licensed; all fixtures are synthetic. No SaaS source, credentials,
customer data, deployment wiring, or paid services are included.

| Workspace | What it is |
| --- | --- |
| `/` (`truelink-schema-web-tools`) | Core library: flat-object validation and the sandboxed static embed (below) |
| [`packages/schema-document`](packages/schema-document/README.md) | The shared core: Schema.org JSON-LD templates, bounded import, safe script output, advisory checks, the `SchemaDocumentRecord` contract and conversion to/from the TrueLink web tool's stored format; also ships browser builds and conformance cases |
| [`packages/cloud-client`](packages/cloud-client/README.md) | `truelink-schema-cloud`: the host-bridge protocol (client, host dispatcher, in-memory reference host) for TrueLink cloud drafts |
| [`apps/web`](apps/web/README.md) | **Schema Studio** PWA: brand-profile wizard, form/JSON-LD editor, live previews, import/export, TrueLink sign-up funnel and, when served by TrueLink, cloud drafts and publishing |

How these pieces serve every TrueLink surface (web tool, Studio, app, extension, plugins,
developer and AI tools), and how one update reaches all of them, is described in the
[platform strategy](docs/PLATFORM_STRATEGY.zh-TW.md) (Traditional Chinese).

Try the app locally with `pnpm install --frozen-lockfile && pnpm dev`, then open
<http://localhost:5173>. It works offline once loaded and sends no data to any server.

The code is MIT licensed. The TrueLink name, shield logo and app icons used by the
official Schema Studio build are **not** covered by the MIT License; see
[TRADEMARKS.md](TRADEMARKS.md) before redistributing a fork.

## Develop

Requires Node.js **22.13+** and **pnpm 11.19.0** (pinned in `package.json`).

```sh
git clone https://github.com/Johnny050033/truelink-schema-web-tools.git
cd truelink-schema-web-tools
pnpm install --frozen-lockfile
pnpm check
```

`check` runs TypeScript checks, Vitest tests and builds for the core library, then the
same for every workspace (`packages/*`, `apps/*`); `check:core` covers only the library.
Use `pnpm test:watch` while developing. Checks run locally; no hosted CI or automatic
deployment is configured. Packages are deliberately `private: true` to prevent
accidental npm publication; the source repository is public.

To create a locally installable library archive after checking:

```sh
pnpm pack --pack-destination artifacts
# In a consuming project, install the resulting .tgz with pnpm add <archive-path>.
```

The library also exposes `truelink-schema-web-tools/schema` and
`truelink-schema-web-tools/embed` subpaths, so a consumer that only validates objects
does not bundle the HTML/CSS parsers.

Schema Studio is installable as a PWA on desktop and mobile browsers. Native store
packages (App Store, Google Play), desktop installers and the browser extension are
**not** included; see [apps/web/README.md](apps/web/README.md) for the packaging path.

## Object schema validation

```ts
import { validateSchema, type FieldRule } from 'truelink-schema-web-tools';

const schema = {
  title: { type: 'string', required: true, minLength: 1, maxLength: 80 },
  status: { type: 'string', enum: ['draft', 'review'] },
  publishedAt: { type: 'string', serverManaged: true },
} satisfies Record<string, FieldRule>;

validateSchema({ title: 'Synthetic example', status: 'draft' }, schema);
// { valid: true, issues: [] }
validateSchema({ title: 'Example', publishedAt: 'not-client-controlled' }, schema);
// invalid: a server-managed field was supplied
```

Unknown fields are rejected. There is no coercion, mutation or silent stripping.
String lengths count Unicode code points (not bytes or grapheme clusters). Number
fields must be finite; booleans must really be booleans. Invalid trusted schema
definitions throw `TypeError`. This is **flat application-object validation**, not
a complete JSON Schema / Schema.org validator. See [SECURITY.md](SECURITY.md).
At most 100 own input/schema fields are accepted, including non-enumerable fields;
symbol and prototype-sensitive keys cannot bypass validation. Server-managed fields
are never required from the client even if the server's schema marks them required.

## Optional TrueLink cloud drafts (client side ready, host side pending)

Schema Studio is local-first: editing, import/export and backups work without an account.
When TrueLink serves the Studio on its own origin and configures `VITE_TRUELINK_HOST_URL`,
the Studio talks to a TrueLink host page over `postMessage` (`truelink-schema-cloud`):
explicit per-document uploads, private drafts with revision checks, linked documents that
follow newer cloud versions when unchanged locally, and confirmed publishing. The host page,
storage and backend functions belong to the private TrueLink SaaS and are **not** in this
repository. This repository still makes **no network requests to a storage API** and
contains no server credentials; without a host the sign-up buttons are plain links that
carry no data. See the [cloud sync roadmap](docs/CLOUD_SYNC_ROADMAP.md) for boundaries and
acceptance criteria.

## Safe static embed profile

```ts
import { validateEmbed, createSandboxedEmbed } from 'truelink-schema-web-tools';

const input = {
  html: '<section class="card"><h2>Synthetic demo</h2><p>Hello</p></section>',
  css: '.embed-root { color: #17324d } .embed-root .card { padding: 16px }',
};

validateEmbed(input); // { valid: true, issues: [] }
const iframeHtml = createSandboxedEmbed(input);
```

The renderer throws on invalid content and returns one escaped, sandboxed iframe.
The input is parsed with **parse5** and **CSS Tree** rather than sanitized by regex.
The iframe is network-disabled and isolated from the host origin. Its fixed initial
dimensions are 640 × 360; a trusted host may style the **iframe element** responsively
without changing its sandbox, CSP, or srcdoc. Content itself may scroll.

Supported HTML is static text/container/list/table markup. Only `class`, `title`,
`lang`, and validated `dir` attributes are accepted. Scripts, inline event handlers,
inline styles, SVG/MathML, links, images, forms, nested iframes and resource attributes
are rejected in v0.1. This intentionally trades flexibility for a small attack surface.

Every CSS selector must begin with `.embed-root` and use only simple class/tag
selectors with descendant or child combinators. Global selectors, `@import` (all
at-rules), fixed/sticky/absolute positioning and unsafe CSS features are blocked.
HTML is capped at 50,000 UTF-16 code units, CSS at 20,000, parsed nodes at 2,000 and
HTML depth at 40; at most 64 diagnostic issues are returned.

## Tests and limitations

`test/fixtures/` contains invented examples and attack strings only. Tests cover
unknown/server-managed fields, enum/type/length/number bounds, prototype-related
keys, malformed schemas, script/handler injection, scoped CSS, escaped fixed
position, at-rules, resource URLs, size bounds and iframe attribute/CSP serialization.
These are unit tests, not a claim of production deployment or browser security certification.

## References

- [parse5](https://parse5.js.org/)
- [CSS Tree](https://github.com/csstree/csstree)
- [Vitest](https://vitest.dev/guide/)
- [iframe sandbox](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox)

Contributions should include a synthetic failing fixture, a minimal fix, and a
passing `pnpm check`. Keep this repository independent of private platform data.
