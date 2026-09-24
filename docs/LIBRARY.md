# Library: object validation and sandboxed embeds

The repository root package, `truelink-schema-web-tools`, holds two small independent
TypeScript utilities that Schema Studio and TrueLink tools build on. They're exposed as
`truelink-schema-web-tools/schema` and `truelink-schema-web-tools/embed` subpaths, so a
consumer that only validates objects doesn't bundle the HTML/CSS parsers.

To create a locally installable archive after `pnpm check`:

```sh
pnpm pack --pack-destination artifacts
# In a consuming project: pnpm add <archive-path>
```

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
a complete JSON Schema / Schema.org validator. See [SECURITY.md](../SECURITY.md).
At most 100 own input/schema fields are accepted, including non-enumerable fields;
symbol and prototype-sensitive keys cannot bypass validation. Server-managed fields
are never required from the client even if the server's schema marks them required.

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
passing `pnpm check`. See [CONTRIBUTING.md](../CONTRIBUTING.md).
