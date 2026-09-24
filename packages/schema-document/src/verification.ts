/**
 * TrueLink Verified Schema: shared rules that bind a brand's structured data to its
 * KYC-verified official domains. The TrueLink platform, Schema Studio and other tools use
 * the same functions, so a domain is judged the same way everywhere.
 *
 * How the platform applies them (docs/VERIFIED_SCHEMA_API.md):
 * - A brand's schema is served by TrueLink, either through a hosted script embedded in the
 *   official site or, after KYC with an active membership, through a keyed server-side API.
 * - Every request's page origin is checked with `isAllowedHost` against the brand's verified
 *   domains. A copy on any other site (for example a phishing clone) is refused and reported.
 * - Anyone (people, crawlers, AI assistants, the TrueLink extension) can check whether a domain
 *   is a verified official site at `certStatusUrl(domain)`, and read the registry of verified
 *   entities at `verifiedEntitiesUrl()`.
 *
 * Pure functions: no network access, no DOM.
 */

export const TRUELINK_ORIGIN = 'https://app.truelink-group.com';

/** A brand can bind at most this many official domains (subdomains are included automatically). */
export const MAX_VERIFIED_DOMAINS = 12;

/** Keyed API requests send the key in this header; keys never appear in URLs. */
export const API_KEY_HEADER = 'X-TrueLink-Api-Key';
export const API_KEY_PATTERN = /^tl_[a-f0-9]{48}$/i;

/** Public paths on the TrueLink origin. */
export const VERIFIED_PATHS = Object.freeze({
  hostedScript: '/schema_apis/',
  certStatus: '/api/public/cert-status',
  verifiedEntities: '/api/public/verified-entities.jsonld',
});

const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,128}$/;
// A registrable host name (at least one dot, letters/digits/hyphens, IDN as punycode). IPs and "localhost" never match.
const HOST_NAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

function hostnameOf(value: string): string | undefined {
  const raw = value.trim().toLowerCase();
  if (!raw || /\s/.test(raw)) return undefined;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.hostname.replace(/\.$/, '');
  } catch {
    return undefined;
  }
}

/**
 * The comparable form of a domain, URL or Origin/Referer value: its host name in lower case
 * (IDN as punycode), without port, credentials, path, a trailing dot or a leading "www.".
 * Anything that is not a registrable host name becomes "" (fail closed).
 */
export function normalizeDomain(value: string): string {
  const host = hostnameOf(value);
  if (!host) return '';
  const domain = host.replace(/^www\./, '');
  return HOST_NAME.test(domain) ? domain : '';
}

/** Parses a list (array, or text separated by newlines, commas or spaces) into unique verified domains. */
export function normalizeDomainList(input: string | readonly string[]): string[] {
  const items = typeof input === 'string' ? input.split(/[\s,，、;；]+/) : input;
  const domains: string[] = [];
  for (const item of items) {
    const domain = normalizeDomain(String(item));
    if (domain && !domains.includes(domain)) domains.push(domain);
    if (domains.length === MAX_VERIFIED_DOMAINS) break;
  }
  return domains;
}

export interface AllowedHostOptions {
  /** Development only: also accept localhost and 127.0.0.1. */
  readonly allowLocalDev?: boolean;
}

/**
 * Whether a request's host (or Origin/Referer URL) belongs to one of the verified domains:
 * the domain itself or any of its subdomains. Look-alikes such as "example.com.evil.net" or
 * "evil-example.com" never match.
 */
export function isAllowedHost(request: string, allowedDomains: string | readonly string[], options: AllowedHostOptions = {}): boolean {
  if (options.allowLocalDev) {
    const local = hostnameOf(request);
    if (local === 'localhost' || local === '127.0.0.1') return true;
  }
  const host = normalizeDomain(request);
  if (!host) return false;
  return normalizeDomainList(allowedDomains).some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export type DomainCoverage = 'covered' | 'not-covered' | 'no-url';

/** Whether a page URL (for example the document's official URL) is served by the verified domains. */
export function domainCoverage(url: string | undefined, allowedDomains: string | readonly string[]): DomainCoverage {
  if (!url || !normalizeDomain(url)) return 'no-url';
  return isAllowedHost(url, allowedDomains) ? 'covered' : 'not-covered';
}

export function isApiKey(value: unknown): value is string {
  return typeof value === 'string' && API_KEY_PATTERN.test(value);
}

/** "tl_…1a2b": enough to recognise a key, never enough to use it. */
export function maskApiKey(key: string): string {
  return isApiKey(key) ? `tl_…${key.slice(-4)}` : '';
}

function originOf(origin: string): string | undefined {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && !url.username && !url.password ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/** URL of an account's hosted schema script (domain-bound by the platform). */
export function hostedSchemaScriptUrl(accountId: string, origin: string = TRUELINK_ORIGIN): string | undefined {
  const base = originOf(origin);
  if (!base || !ACCOUNT_ID.test(accountId)) return undefined;
  return `${base}${VERIFIED_PATHS.hostedScript}${accountId}.js`;
}

const ATTRIBUTE_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };

/** The line a brand adds to its official site's <head>, exactly as the TrueLink web tool shows it. */
export function hostedSchemaEmbed(scriptUrl: string): string {
  const url = new URL(scriptUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw new TypeError('The hosted schema script must be an HTTPS URL.');
  const src = url.toString().replace(/[&"<>]/g, (char) => ATTRIBUTE_ESCAPES[char]!);
  return `<script src="${src}" defer></script>`;
}

/** Public check: is this domain a verified official site, and of whom? */
export function certStatusUrl(domain: string, origin: string = TRUELINK_ORIGIN): string | undefined {
  const base = originOf(origin);
  const host = normalizeDomain(domain);
  if (!base || !host) return undefined;
  return `${base}${VERIFIED_PATHS.certStatus}?domain=${encodeURIComponent(host)}`;
}

/** Public JSON-LD registry of currently verified entities (revoked ones are removed). */
export function verifiedEntitiesUrl(origin: string = TRUELINK_ORIGIN): string | undefined {
  const base = originOf(origin);
  return base ? `${base}${VERIFIED_PATHS.verifiedEntities}` : undefined;
}
