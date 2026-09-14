import { describe, expect, it } from 'vitest';
import { parseFragment } from 'parse5';
import { createSandboxedEmbed, validateEmbed } from '../src/embed.js';
import { forbiddenCss, forbiddenHtml, safeEmbed } from './fixtures/embed.js';

describe('restricted static embed', () => {
  it('accepts synthetic scoped HTML/CSS without mutating input', () => {
    const input = Object.freeze({ ...safeEmbed });
    expect(validateEmbed(input)).toEqual({ valid: true, issues: [] });
  });
  it.each(forbiddenHtml)('rejects forbidden HTML: %s', (html) => {
    expect(validateEmbed({ html }).valid).toBe(false);
    expect(() => createSandboxedEmbed({ html })).toThrow(TypeError);
  });
  it.each(forbiddenCss)('rejects forbidden CSS: %s', (css) => {
    expect(validateEmbed({ html: '<p>Demo</p>', css }).valid).toBe(false);
  });
  it.each([null, [], 'html', {}, { html: 1 }, { html: '', css: null }, { html: '', other: true }])('rejects invalid shape: %j', (input) => {
    expect(validateEmbed(input).valid).toBe(false);
  });
  it('does not invoke accessors', () => {
    let invoked = false;
    expect(validateEmbed({ get html() { invoked = true; return ''; } }).valid).toBe(false);
    expect(invoked).toBe(false);
  });
  it('bounds size, depth, nodes and diagnostics', () => {
    expect(validateEmbed({ html: 'x'.repeat(50_001) }).valid).toBe(false);
    expect(validateEmbed({ html: '', css: ' '.repeat(20_001) }).valid).toBe(false);
    expect(validateEmbed({ html: '<div>'.repeat(45) + '</div>'.repeat(45) }).valid).toBe(false);
    expect(validateEmbed({ html: '<br>'.repeat(2_001) }).valid).toBe(false);
    const result = validateEmbed({ html: '<script>x</script>'.repeat(100) });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeLessThanOrEqual(64);
  });
  it('returns one escaped sandboxed iframe with a restrictive CSP', () => {
    const output = createSandboxedEmbed({ ...safeEmbed, html: '<p title="&quot; &amp; &lt;">Text &amp; demo</p>' });
    const fragment = parseFragment(output);
    expect(fragment.childNodes).toHaveLength(1);
    const iframe = fragment.childNodes[0]!;
    if (!('tagName' in iframe)) throw new Error('Missing iframe');
    expect(iframe.tagName).toBe('iframe');
    const attrs = Object.fromEntries(iframe.attrs.map(({ name, value }) => [name, value]));
    expect(attrs.sandbox).toBe('');
    expect(attrs.referrerpolicy).toBe('no-referrer');
    expect(attrs.srcdoc).toContain("default-src 'none'; script-src 'none'");
    expect(attrs.srcdoc).toContain('<div class="embed-root">');
    expect(attrs.srcdoc).toContain('Text &amp; demo');
    expect(attrs).not.toHaveProperty('src');
    expect(output).not.toContain('allow-scripts');
    expect(output).not.toContain('allow-same-origin');
  });
});
