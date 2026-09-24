import { describe, expect, it } from 'vitest';
import {
  buildOutput,
  canWriteAt,
  checkJsonValue,
  combineGraph,
  getAt,
  isHttpUrl,
  isIsoDate,
  isIsoDateTime,
  isTaiwanBusinessId,
  isTelephone,
  lacksTimeZone,
  LIMITS,
  setAt,
  toJsonLdJson,
  toJsonLdScript,
  utf8Bytes,
} from '../src/index.js';

describe('safe JSON paths', () => {
  it('creates typed intermediate nodes and never mutates the input', () => {
    const input = { '@type': 'Organization', name: 'Synthetic Co' };
    const output = setAt(input, ['address', 'addressLocality'], '大安區', { address: 'PostalAddress' });
    expect(output).toEqual({ '@type': 'Organization', name: 'Synthetic Co', address: { '@type': 'PostalAddress', addressLocality: '大安區' } });
    expect(input).toEqual({ '@type': 'Organization', name: 'Synthetic Co' });
  });

  it('removes a leaf for empty values but keeps explicit parent choices', () => {
    const node = { author: { '@type': 'Organization', name: 'Synthetic' } };
    expect(setAt(node, ['author', 'name'], '')).toEqual({ author: { '@type': 'Organization' } });
    expect(setAt({}, ['address', 'streetAddress'], '')).toEqual({});
  });

  it('refuses prototype-sensitive keys and writes below non-objects', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) {
      expect(() => setAt({}, [key, 'polluted'], 'x')).toThrow(TypeError);
    }
    expect(() => setAt({ author: 'Jane' }, ['author', 'name'], 'x')).toThrow(TypeError);
    expect(canWriteAt({ author: 'Jane' }, ['author', 'name'])).toBe(false);
    expect(canWriteAt({ author: { name: 'Jane' } }, ['author', 'name'])).toBe(true);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('reads own properties only', () => {
    expect(getAt({ a: { b: 1 } }, ['a', 'b'])).toBe(1);
    expect(getAt({ a: 1 }, ['a', 'b'])).toBeUndefined();
    expect(getAt({}, ['toString'])).toBeUndefined();
  });
});

describe('output', () => {
  it('prunes empty values and type-only nodes, keeps unknown properties and orders JSON-LD keywords first', () => {
    const output = buildOutput({
      name: '  Synthetic  ',
      address: { '@type': 'PostalAddress' },
      sameAs: ['', 'https://example.com/profile'],
      customProperty: { nested: true },
      '@type': 'Organization',
      '@id': 'https://example.com/#organization',
    });
    expect(Object.keys(output)).toEqual(['@context', '@type', '@id', 'name', 'sameAs', 'customProperty']);
    expect(output).toMatchObject({ '@context': 'https://schema.org', name: 'Synthetic', sameAs: ['https://example.com/profile'], customProperty: { nested: true } });
  });

  it('escapes script-breaking characters in JSON-LD script output', () => {
    const script = toJsonLdScript({ name: '</script><script>alert(1)</script> & \u2028' });
    expect(script.startsWith('<script type="application/ld+json">')).toBe(true);
    const body = script.slice(script.indexOf('\n') + 1, script.lastIndexOf('\n'));
    expect(body).not.toMatch(/[<>&\u2028]/);
    expect(JSON.parse(body)).toEqual({ name: '</script><script>alert(1)</script> & \u2028' });
    expect(script.match(/<\/script>/g)).toHaveLength(1);
  });

  it('combines nodes into a single @graph without nested contexts', () => {
    const graph = combineGraph([{ '@context': 'https://schema.org', '@type': 'Organization', name: 'A' }, { '@type': 'WebSite', name: 'B' }]);
    expect(graph).toEqual({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'A' }, { '@type': 'WebSite', name: 'B' }] });
    expect(JSON.parse(toJsonLdJson(graph))).toEqual(graph);
  });
});

describe('bounded JSON checks', () => {
  it('accepts plain JSON and rejects depth, size, accessor and prototype keys', () => {
    expect(checkJsonValue({ a: [1, 'x', null, true] })).toEqual({ ok: true });
    let deep: unknown = 'leaf';
    for (let index = 0; index <= LIMITS.maxDepth; index += 1) deep = [deep];
    expect(checkJsonValue(deep)).toEqual({ ok: false, code: 'too_deep' });
    expect(checkJsonValue(Array.from({ length: LIMITS.maxNodes + 1 }, () => 1))).toEqual({ ok: false, code: 'too_many_nodes' });
    expect(checkJsonValue(JSON.parse('{"__proto__": {"x": 1}}'))).toEqual({ ok: false, code: 'forbidden_key' });
    expect(checkJsonValue({ x: 'y'.repeat(LIMITS.maxStringLength + 1) })).toEqual({ ok: false, code: 'string_too_long' });
    let invoked = false;
    expect(checkJsonValue({ get value() { invoked = true; return 1; } })).toEqual({ ok: false, code: 'not_json' });
    expect(invoked).toBe(false);
    expect(checkJsonValue(new Date())).toEqual({ ok: false, code: 'not_json' });
    expect(checkJsonValue({ n: Number.NaN })).toEqual({ ok: false, code: 'not_json' });
    expect(checkJsonValue({ text: 'x'.repeat(200) }, { maxBytes: 100 })).toEqual({ ok: false, code: 'too_large' });
  });

  it('counts UTF-8 bytes including surrogate pairs', () => {
    expect(utf8Bytes('a')).toBe(1);
    expect(utf8Bytes('é')).toBe(2);
    expect(utf8Bytes('台')).toBe(3);
    expect(utf8Bytes('😀')).toBe(4);
  });
});

describe('formats', () => {
  it('validates URLs, dates and phones strictly', () => {
    expect(isHttpUrl('https://example.com/a?b=c')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('example.com')).toBe(false);
    expect(isHttpUrl('https://exa mple.com')).toBe(false);
    expect(isIsoDate('2015')).toBe(true);
    expect(isIsoDate('2015-06')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2023-02-29')).toBe(false);
    expect(isIsoDateTime('2026-10-01T19:00+08:00')).toBe(true);
    expect(isIsoDateTime('2026-10-01T25:00')).toBe(false);
    expect(lacksTimeZone('2026-10-01T19:00')).toBe(true);
    expect(lacksTimeZone('2026-10-01')).toBe(false);
    expect(isTelephone('+886-2-2345-6789')).toBe(true);
    expect(isTelephone('call me')).toBe(false);
  });

  it('checks the Taiwan business ID checksum, including the seventh-digit rule', () => {
    expect(isTaiwanBusinessId('10000009')).toBe(true);
    expect(isTaiwanBusinessId('12345675')).toBe(true);
    expect(isTaiwanBusinessId('10000001')).toBe(false);
    expect(isTaiwanBusinessId('1234567')).toBe(false);
  });
});
