# Security boundaries

This is an initial, conservative toolkit, not an independently security-audited
sanitizer or a replacement for authorization, database rules, CSP, or tenant isolation.

- Treat schema definitions as trusted application configuration. Validate untrusted
  **JSON-compatible** values at the server boundary. JavaScript proxies can execute
  traps and are outside the input contract; do not evaluate attacker-supplied code.
- The schema API handles flat objects; it does not implement JSON Schema or validate
  Schema.org graphs. Server-managed fields must also remain server-authoritative.
- The embed API accepts a limited static HTML/CSS profile. It rejects rather than
  silently removes unsafe features. Do not inject input or validated fragments into
  the host DOM; use the iframe returned by `createSandboxedEmbed` unchanged.
- Never add `allow-scripts` or `allow-same-origin` to that iframe. The srcdoc has a
  restrictive CSP, no resource URLs, no forms, and no interactive or foreign elements.
- CSS must stay below `.embed-root`. At-rules, pseudo/attribute selectors, sibling
  combinators, escapes, URLs, custom properties, `!important`, unsupported properties,
  and non-static/non-relative position values are intentionally unsupported.
- Application-level request limits still matter. Tests do not prove every browser
  implementation, resource exhaustion scenario, visual correctness, or future parser bug.

Use synthetic fixtures for reports. Do not post credentials, production exports,
customer records, or an exploitable private-system URL in public issues. Contact
the repository owner privately for sensitive vulnerability disclosure.
