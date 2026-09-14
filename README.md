# truelink-schema-web-tools

Independent TypeScript utilities for strict object validation and isolated static
web embeds. MIT licensed; all fixtures are synthetic. No SaaS source, credentials,
customer data, deployment wiring, or paid services are included.

## Develop

Requires Node.js **22.13+** and **pnpm 11.19.0** (pinned in `package.json`).

```sh
git clone https://github.com/Johnny050033/truelink-schema-web-tools.git
cd truelink-schema-web-tools
pnpm install --frozen-lockfile
pnpm check
```

`check` runs TypeScript checks, Vitest tests, and a declaration-producing ESM build.
Use `pnpm test:watch` while developing. Checks run locally; no hosted CI or automatic
deployment is configured. This initial package is deliberately `private: true` to
prevent accidental npm publication; the source repository is public.

To create a locally installable library archive after checking:

```sh
pnpm pack --pack-destination artifacts
# In a consuming project, install the resulting .tgz with pnpm add <archive-path>.
```

This is a developer library, not yet a graphical Schema.org editor or desktop installer.

## Community and product direction

Contributions are welcome under this repository's MIT license. You do **not** need a
TrueLink account, cloud account, attribution link, or telemetry opt-in to use,
contribute to, fork, or self-host the local tools. See
[CONTRIBUTING.md](CONTRIBUTING.md) and the [product vision (繁體中文)](docs/PRODUCT_VISION.zh-TW.md).

The long-term direction is a local-first Schema document editor, optional
Google-linked TrueLink private cloud storage, and separately confirmed public
snapshots. These are plans, not current product capabilities. The design work is
tracked in [PR #1](https://github.com/Johnny050033/truelink-schema-web-tools/pull/1);
community discussion and proposed work belong in [GitHub Issues](https://github.com/Johnny050033/truelink-schema-web-tools/issues).

An official multilingual download and documentation landing page is **PLANNED** at
`https://truelink-group.com/schema-tools/`. It remains owned by the TrueLink site
project and is not delivered by this repository or an extension store today.

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

## Optional cloud storage direction (planned, not connected)

The intended product direction is an open-source, local-first Schema editor with
optional signed-in TrueLink cloud sync. Local import/export remains available;
cloud data would be private by default, with explicit publishing and access controls.
This repository currently makes **no network requests to a storage API** and does
not contain server credentials. No storage service or upload endpoint is implemented.
See the [cloud sync roadmap](docs/CLOUD_SYNC_ROADMAP.md) for boundaries and acceptance.

## Browser extension integration (design phase)

The planned extension combines local website identity / structured-data inspection
with management of the user's own Schema documents. The existing TrueLink Trust
Check extension has been inspected read-only; it has **not** been copied, migrated,
or released from this repository. No extension ZIP, store submission, or cloud
integration is available here yet. The original SaaS repository remains unchanged.

- [Integration blueprint and source findings (繁體中文)](docs/EXTENSION_INTEGRATION_PLAN.zh-TW.md)
- [Editor / account UX specification (繁體中文)](docs/EXTENSION_UX_SPEC.zh-TW.md)
- [Chrome, Edge, Firefox and Safari release checklist (繁體中文)](docs/EXTENSION_STORE_MATRIX.zh-TW.md)

Important: the existing website's save-to-cloud flow also deploys public Schema
assets. A future private draft sync adapter must not reuse that combined operation.

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
