import { describe, expect, it } from 'vitest';
import {
  certStatusUrl,
  domainCoverage,
  hostedSchemaEmbed,
  hostedSchemaScriptUrl,
  isAllowedHost,
  isApiKey,
  maskApiKey,
  MAX_VERIFIED_DOMAINS,
  normalizeDomain,
  normalizeDomainList,
  verifiedEntitiesUrl,
} from '../src/index.js';

describe('normalizeDomain', () => {
  it('reduces URLs, Origin and Referer values to a comparable host', () => {
    expect(normalizeDomain('https://www.Example.com/path?q=1#x')).toBe('example.com');
    expect(normalizeDomain('example.com:8443')).toBe('example.com');
    expect(normalizeDomain('http://shop.example.com.')).toBe('shop.example.com');
    expect(normalizeDomain('https://user:secret@example.com/')).toBe('example.com');
    expect(normalizeDomain('https://example.com@evil.net/')).toBe('evil.net');
    expect(normalizeDomain('bücher.de')).toBe('xn--bcher-kva.de');
  });

  it('fails closed on anything that is not a registrable host', () => {
    for (const value of ['', '   ', 'localhost', '127.0.0.1', 'https://[::1]/', 'not a domain', 'javascript:alert(1)', 'ftp://example.com', 'example', '.com', 'exa_mple.com']) {
      expect(normalizeDomain(value), value).toBe('');
    }
  });
});

describe('isAllowedHost', () => {
  const verified = ['example.com', 'brand.com.tw'];

  it('accepts the verified domains, www and subdomains', () => {
    for (const request of ['example.com', 'https://www.example.com/page', 'https://shop.example.com', 'https://a.b.example.com:443/', 'https://brand.com.tw/']) {
      expect(isAllowedHost(request, verified), request).toBe(true);
    }
  });

  it('rejects look-alikes and copies on other sites', () => {
    for (const request of ['https://evil-example.com', 'https://example.com.evil.net', 'https://notexample.com', 'https://example.co', 'https://example.com@evil.net', 'https://brand.com', '', 'null']) {
      expect(isAllowedHost(request, verified), request).toBe(false);
    }
  });

  it('accepts localhost only in development', () => {
    expect(isAllowedHost('http://localhost:5173/', verified)).toBe(false);
    expect(isAllowedHost('http://localhost:5173/', verified, { allowLocalDev: true })).toBe(true);
    expect(isAllowedHost('http://127.0.0.1/', verified, { allowLocalDev: true })).toBe(true);
  });

  it('reads domain lists written as text and honours the limit', () => {
    expect(normalizeDomainList('https://www.example.com/\nshop.example.com, example.com，brand.com.tw')).toEqual(['example.com', 'shop.example.com', 'brand.com.tw']);
    const many = Array.from({ length: 20 }, (_, index) => `site${index}.com`);
    expect(normalizeDomainList(many)).toHaveLength(MAX_VERIFIED_DOMAINS);
    expect(isAllowedHost('https://site19.com', many)).toBe(false);
    expect(isAllowedHost('https://site0.com', 'site0.com\nsite1.com')).toBe(true);
  });

  it('reports whether a document URL is served by the verified domains', () => {
    expect(domainCoverage('https://www.example.com/', verified)).toBe('covered');
    expect(domainCoverage('https://other.com/', verified)).toBe('not-covered');
    expect(domainCoverage(undefined, verified)).toBe('no-url');
    expect(domainCoverage('not a url', verified)).toBe('no-url');
  });
});

describe('public endpoints', () => {
  it('builds the hosted script URL and the embed line the web tool shows', () => {
    const url = hostedSchemaScriptUrl('Ab3_uid-9');
    expect(url).toBe('https://app.truelink-group.com/schema_apis/Ab3_uid-9.js');
    expect(hostedSchemaEmbed(url!)).toBe('<script src="https://app.truelink-group.com/schema_apis/Ab3_uid-9.js" defer></script>');
    expect(hostedSchemaScriptUrl('../etc/passwd')).toBeUndefined();
    expect(hostedSchemaScriptUrl('uid', 'http://insecure.example')).toBeUndefined();
    expect(() => hostedSchemaEmbed('http://example.com/x.js')).toThrow(TypeError);
    expect(hostedSchemaEmbed('https://example.com/x.js?a="b"&c=<d>')).toBe('<script src="https://example.com/x.js?a=%22b%22&amp;c=%3Cd%3E" defer></script>');
  });

  it('builds the public verification URLs', () => {
    expect(certStatusUrl('https://www.Example.com/about')).toBe('https://app.truelink-group.com/api/public/cert-status?domain=example.com');
    expect(certStatusUrl('not a domain')).toBeUndefined();
    expect(verifiedEntitiesUrl()).toBe('https://app.truelink-group.com/api/public/verified-entities.jsonld');
  });

  it('recognises and masks API keys without revealing them', () => {
    const key = `tl_${'0123456789abcdef'.repeat(3)}`;
    expect(isApiKey(key)).toBe(true);
    expect(isApiKey('tl_short')).toBe(false);
    expect(isApiKey(`sk_${'a'.repeat(48)}`)).toBe(false);
    expect(maskApiKey(key)).toBe('tl_…cdef');
    expect(maskApiKey('nope')).toBe('');
  });
});
