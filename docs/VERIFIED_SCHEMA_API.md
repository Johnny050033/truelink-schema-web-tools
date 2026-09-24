# TrueLink Verified Schema API

English | [繁體中文](VERIFIED_SCHEMA_API.zh-TW.md)

**Your complete structured data, served only on your real website, and verifiable by anyone.**

Structured data (Schema.org JSON-LD) tells search engines and AI assistants who you are. Anyone
can copy it, though. A phishing site can paste your company name, logo, phone number and
official profiles into its own page, and a crawler has no way to tell which copy is genuine.

TrueLink Verified Schema closes that gap by combining three things:

1. **Verified identity.** You pass KYC on TrueLink as a company, expert or individual.
2. **Domain-bound delivery.** TrueLink serves your schema from its API, but only to your
   verified official domains. A copy on any other site gets nothing, and you are alerted.
3. **Public verification.** Anyone can ask TrueLink whether a domain is a verified official
   site: people, crawlers, AI assistants and the TrueLink browser extension.

> **[Create a free TrueLink account →](https://truelink-group.com/)** ·
> **[Start KYC →](https://app.truelink-group.com/kyc/)**
>
> Schema Studio (this repository) stays free and works without an account. Verified Schema is
> part of the TrueLink platform.

## How it works

```text
 Brand                         TrueLink                                  Crawler / AI assistant
 ─────                         ────────                                  ──────────────────────
 1. KYC (company, expert,  ──▶ review; the identity is recorded
    or individual)             as verified
 2. Bind official domains  ──▶ verified domain list (subdomains included)
 3. Put one line on the
    official site          ─────────────────────────────────────────────▶  4. loads the page
                               5. request for the schema arrives,     ◀──     and the TrueLink line
                                  carrying the page's origin
                               6. origin ∈ verified domains?
                                  ✓ yes → complete, current JSON-LD   ──▶  7. reads the verified schema
                                  ✗ no  → nothing served; the attempt
                                          is recorded and the brand
                                          is alerted (phishing copy)
                               8. public checks: cert-status,         ◀──  (optional) confirm which
                                  verified-entities registry                 site is the real one
```

## Delivery options

| | Hosted schema script | Verified Schema API (keyed) |
| --- | --- | --- |
| Setup | one `<script>` line in `<head>` | your server fetches the schema and prints it into the page |
| Who reads it | crawlers that run JavaScript (e.g. Google) | every crawler, including ones that don't run JavaScript |
| Domain binding | yes: only verified domains are served | the API key authenticates your server; browser requests are also checked against your verified domains |
| Requirements | a published schema on TrueLink | approved KYC **and** an active membership; access stops at once if either lapses |
| Updates | publish on TrueLink; the site updates without code changes | the same, on the next fetch |

### Hosted schema script

The TrueLink web tool and Schema Studio show your line after you publish:

```html
<script src="https://app.truelink-group.com/schema_apis/YOUR_ACCOUNT_ID.js" defer></script>
```

The script adds your JSON-LD to the page. Requests from domains outside your verified list are
refused.

### Keyed server-side API

For the widest coverage, fetch the schema on your server and include it in the HTML, so crawlers
that don't run JavaScript read it too. The response is a ready
`<script type="application/ld+json">` block (your main entity plus your FAQ) with `<`, `>` and
`&` escaped.

```sh
curl -H "X-TrueLink-Api-Key: $TRUELINK_API_KEY" "<endpoint shown in your TrueLink dashboard>"
```

- Keys look like `tl_` followed by 48 hex characters.
- TrueLink stores only a hash, and shows a key once, when it is created or rotated.
- The key goes in the `X-TrueLink-Api-Key` header. Requests that put it in a URL are rejected.
- Keep the key in your server's secret settings, never in page code.
- Responses are not cached (`no-store`), so rotating or revoking a key takes effect immediately.

## Public verification (for crawlers, AI assistants and developers)

| Endpoint | Returns |
| --- | --- |
| `GET https://app.truelink-group.com/api/public/cert-status?domain=example.com` | whether the domain belongs to a TrueLink-verified entity, with its verification level and date |
| `GET https://app.truelink-group.com/api/public/verified-entities.jsonld` | a Schema.org `ItemList` of currently verified entities; each credential is issued by TrueLink as a third-party verifier, and revoked entities are removed |

The shared core ([`truelink-schema-document`](../packages/schema-document/README.md)) builds
these URLs and applies the same domain rules as the platform:

```ts
import { certStatusUrl, hostedSchemaEmbed, hostedSchemaScriptUrl, isAllowedHost, verifiedEntitiesUrl } from 'truelink-schema-document';

isAllowedHost('https://shop.example.com/page', ['example.com']);   // true: subdomains are included
isAllowedHost('https://example.com.evil.net/', ['example.com']);   // false: look-alikes never match
certStatusUrl('https://www.example.com/');                          // …/api/public/cert-status?domain=example.com
verifiedEntitiesUrl();                                              // …/api/public/verified-entities.jsonld
hostedSchemaEmbed(hostedSchemaScriptUrl('YOUR_ACCOUNT_ID')!);       // <script src="…/schema_apis/YOUR_ACCOUNT_ID.js" defer></script>
```

**Domain rules:**

- A domain matches itself and all its subdomains. A leading `www.` is ignored.
- Ports, credentials, paths and a trailing dot are removed before comparing.
- Internationalized domains are compared in punycode.
- Anything that isn't a registrable host name matches nothing.
- A brand can bind up to 12 domains.

## In Schema Studio

When the Studio is served by TrueLink and you are signed in, **Account → Verified Schema API**
shows:

- your KYC and membership status
- your verified domains, with a warning when your brand URL isn't one of them
- the public verification page
- your embed line
- API key creation, rotation and revocation (each key is shown once)

"Open KYC" takes you to TrueLink's KYC page. **Identity documents are uploaded there, never
through the Studio.**

Everywhere else, including the public demo, the Studio explains the service and links to
TrueLink. The bridge methods behind this (`verification.get`, `verification.startUrl`,
`apiKey.issue`, `apiKey.revoke`, and the `verification` change notice) are specified in
[`packages/cloud-client`](../packages/cloud-client/README.md).

## What it does and doesn't do

- **It helps machines verify authenticity.** A copy of your schema on another site isn't served
  by TrueLink, and anyone can check which domains are verified.
- **It can't stop someone from typing your details by hand** onto a fake page. That page simply
  won't carry your verified schema, and lookalike domains can be reported through the TrueLink
  extension.
- **JavaScript matters.** The hosted script needs a crawler that runs JavaScript. Use the keyed
  server-side API when you want every crawler to see the data.
- **No guarantees.** Verification makes your identity easier to confirm. It does not guarantee
  rankings, rich results or AI citations.

## Get verified

1. [Create a free TrueLink account](https://truelink-group.com/).
2. [Complete KYC](https://app.truelink-group.com/kyc/) as a company, expert or individual.
3. Bind your official domains and publish your schema, from the TrueLink web tool or Schema Studio.
4. Add the one-line embed, or set up the keyed API on your server.

Questions? Open a [discussion or issue](https://github.com/Johnny050033/truelink-schema-web-tools/issues/new/choose), or contact TrueLink through
[truelink-group.com](https://truelink-group.com/).
