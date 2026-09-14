import { parseFragment, serialize, Tokenizer, type DefaultTreeAdapterTypes } from 'parse5';
import { generate, lexer, parse, walk, type CssNode, type Selector } from 'css-tree';

export interface EmbedInput { html: string; css?: string }
export interface EmbedIssue { code: string; message: string }
export interface EmbedValidation { valid: boolean; issues: EmbedIssue[] }

const ROOT = 'embed-root';
const MAX_HTML = 50_000;
const MAX_CSS = 20_000;
const MAX_NODES = 2_000;
const MAX_DEPTH = 40;
const TAGS = new Set(['div', 'section', 'article', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'small', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'br', 'hr',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption']);
const ATTRS = new Set(['class', 'title', 'lang', 'dir']);
const PROPERTIES = new Set(['color', 'background-color', 'font-size', 'font-weight', 'font-style',
  'font-family', 'line-height', 'text-align', 'text-decoration', 'white-space', 'overflow-wrap',
  'display', 'position', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border',
  'border-color', 'border-width', 'border-style', 'border-radius', 'box-sizing', 'width',
  'max-width', 'min-width', 'height', 'max-height', 'gap', 'flex-direction', 'flex-wrap',
  'align-items', 'justify-content', 'list-style-type', 'border-collapse']);
const FUNCTIONS = new Set(['rgb', 'rgba', 'hsl', 'hsla']);

function scopedSelector(selector: Selector): boolean {
  const nodes = selector.children.toArray();
  if (nodes[0]?.type !== 'ClassSelector' || nodes[0].name !== ROOT) return false;
  return nodes.every((node) => {
    if (node.type === 'ClassSelector') return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(node.name);
    if (node.type === 'TypeSelector') return /^[a-z][a-z0-9-]*$/.test(node.name) && !['html', 'body'].includes(node.name);
    return node.type === 'Combinator' && (node.name === ' ' || node.name === '>');
  });
}

function inspect(input: unknown): EmbedValidation & { html: string; css: string } {
  const issues: EmbedIssue[] = [];
  const issue = (code: string, message: string) => {
    if (issues.length < 64) issues.push({ code, message });
  };
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    return { valid: false, issues: [{ code: 'invalid_input', message: 'Expected a plain embed object.' }], html: '', css: '' };
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(descriptors).some((key) => typeof key !== 'string' || !['html', 'css'].includes(key)) ||
      Object.values(descriptors).some((entry) => !('value' in entry))) {
    return { valid: false, issues: [{ code: 'invalid_input', message: 'Only own html/css data fields are accepted.' }], html: '', css: '' };
  }
  const html: unknown = descriptors.html?.value;
  const css: unknown = descriptors.css ? descriptors.css.value : '';
  if (typeof html !== 'string' || typeof css !== 'string' || html.length > MAX_HTML || css.length > MAX_CSS) {
    return { valid: false, issues: [{ code: 'input_limit', message: 'Expected HTML ≤ 50000 and CSS ≤ 20000 UTF-16 code units.' }], html: '', css: '' };
  }
  const checkTag = (tag: string, attrs: { name: string }[]) => {
    if (!TAGS.has(tag)) issue('forbidden_tag', 'Only static HTML text/table containers are allowed.');
    for (const attr of attrs) {
      if (attr.name.startsWith('on')) issue('inline_handler', 'Inline event handlers are forbidden.');
      else if (!ATTRS.has(attr.name)) issue('forbidden_attribute', 'Attribute is outside the static allowlist.');
    }
  };
  // Tree construction can silently discard document tags (e.g. body onload).
  // Inspect tokens too so rejected source cannot disappear before validation.
  new Tokenizer({}, {
    onStartTag: (token) => checkTag(token.tagName, token.attrs),
    onEndTag: (token) => checkTag(token.tagName, token.attrs),
    onDoctype: () => issue('forbidden_tag', 'Only HTML fragments are accepted.'),
    onParseError: () => issue('html_parse', 'Malformed HTML is not accepted.'),
    onNullCharacter: () => issue('html_parse', 'NUL is forbidden.'),
    onComment: () => {}, onCharacter: () => {}, onWhitespaceCharacter: () => {}, onEof: () => {},
  }).write(html, true);
  if (issues.length) return { valid: false, issues, html: '', css: '' };
  const fragment = parseFragment(html, { onParseError: () => issue('html_parse', 'Malformed HTML is not accepted.') });
  const stack: { node: DefaultTreeAdapterTypes.Node; depth: number }[] = [{ node: fragment, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++count > MAX_NODES || item.depth > MAX_DEPTH) { issue('html_limit', 'HTML node/depth limit exceeded.'); break; }
    const node = item.node;
    if ('tagName' in node) {
      if (node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || !TAGS.has(node.tagName)) {
        issue('forbidden_tag', 'Only static HTML text/table containers are allowed.');
      }
      for (const attr of node.attrs) {
        if (attr.name.toLowerCase().startsWith('on')) issue('inline_handler', 'Inline event handlers are forbidden.');
        else if (attr.namespace || !ATTRS.has(attr.name)) issue('forbidden_attribute', 'Attribute is outside the static allowlist.');
        else if (attr.name === 'dir' && !['ltr', 'rtl', 'auto'].includes(attr.value)) issue('invalid_attribute', 'Invalid direction.');
      }
    }
    if ('childNodes' in node) for (const child of node.childNodes) stack.push({ node: child, depth: item.depth + 1 });
    if ('content' in node) issue('forbidden_tag', 'Template content is forbidden.');
  }

  let cssAst: CssNode | undefined;
  // Reject raw style-tag boundaries and escapes up front; do not regex-sanitize them.
  if (/[<\\\u0000]/.test(css)) issue('css_encoding', 'HTML opening delimiters, CSS escapes and NUL are outside this restricted profile.');
  try {
    cssAst = parse(css, { context: 'stylesheet', onParseError: () => issue('css_parse', 'Malformed CSS is not accepted.') });
    let cssNodes = 0;
    walk(cssAst, (node) => {
      if (++cssNodes > MAX_NODES) { issue('css_limit', 'CSS node limit exceeded.'); return; }
      if (node.type === 'Atrule') issue('css_at_rule', 'All at-rules, including @import, are forbidden.');
      if (node.type === 'Raw') issue('css_parse', 'Unparsed CSS is forbidden.');
      if (node.type === 'Selector' && !scopedSelector(node)) issue('global_css', 'Every selector must start with .embed-root and stay inside it.');
      if (node.type === 'Rule' && node.prelude?.type !== 'SelectorList') issue('global_css', 'Nested or unknown selectors are forbidden.');
      if (node.type === 'Url') issue('css_url', 'CSS resource URLs are forbidden.');
      if (node.type === 'Function' && !FUNCTIONS.has(node.name.toLowerCase())) issue('css_function', 'CSS function is outside the allowlist.');
      if (node.type === 'Declaration') {
        const property = node.property.toLowerCase();
        if (!PROPERTIES.has(property)) issue('css_property', 'CSS property is outside the allowlist.');
        if (node.important) issue('css_important', '!important is forbidden.');
        const value = generate(node.value).trim().toLowerCase();
        if (property === 'position' && !['static', 'relative'].includes(value)) issue('css_position', 'Only static/relative positioning is allowed.');
        if (PROPERTIES.has(property) && !lexer.matchProperty(property, node.value).matched) issue('css_value', 'Invalid or unsupported CSS value.');
      }
    });
  } catch { issue('css_parse', 'CSS could not be parsed safely.'); }
  return { valid: issues.length === 0, issues, html: issues.length ? '' : serialize(fragment), css: cssAst && !issues.length ? generate(cssAst) : '' };
}

/** Strict validator, not a general HTML sanitizer. Never inserts caller input into the host DOM. */
export function validateEmbed(input: unknown): EmbedValidation {
  const { valid, issues } = inspect(input);
  return { valid, issues };
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Returns an iframe with an opaque origin, no script/forms/popups/navigation capability and no network. */
export function createSandboxedEmbed(input: EmbedInput): string {
  const result = inspect(input);
  if (!result.valid) throw new TypeError(`Unsafe embed: ${[...new Set(result.issues.map((entry) => entry.code))].join(', ')}`);
  const csp = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${result.css}</style></head><body><div class="${ROOT}">${result.html}</div></body></html>`;
  return `<iframe title="Static content preview" sandbox="" referrerpolicy="no-referrer" loading="lazy" width="640" height="360" srcdoc="${escapeAttribute(document)}"></iframe>`;
}
