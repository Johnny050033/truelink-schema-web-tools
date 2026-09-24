import type { Locale } from 'truelink-schema-document';

/** Accepts only absolute HTTPS URLs; anything else falls back to the default. */
export function httpsOr(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

/** Accepts only same-origin relative asset paths (the CSP blocks other image origins). */
export function sameOriginPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!/^\.{0,2}\/[\w./-]+\.(svg|png|webp)$/i.test(value) || value.includes('//')) return undefined;
  return value;
}

const env = import.meta.env;

export const APP_VERSION = __APP_VERSION__;

/**
 * Outbound TrueLink destinations. They are plain links opened in a new tab:
 * no Schema data, personal data, tokens or referral codes are appended.
 * Point the sign-up URLs at the real registration page with VITE_TRUELINK_SIGNUP_URL.
 */
export const TRUELINK_LINKS = {
  home: { 'zh-TW': 'https://truelink-group.com/', en: 'https://truelink-group.com/en/' },
  signup: {
    'zh-TW': httpsOr(env.VITE_TRUELINK_SIGNUP_URL, 'https://truelink-group.com/'),
    en: httpsOr(env.VITE_TRUELINK_SIGNUP_URL_EN ?? env.VITE_TRUELINK_SIGNUP_URL, 'https://truelink-group.com/en/'),
  },
  webTool: {
    'zh-TW': httpsOr(env.VITE_TRUELINK_APP_URL, 'https://truelink-group.com/'),
    en: httpsOr(env.VITE_TRUELINK_APP_URL, 'https://truelink-group.com/en/'),
  },
  eeatGuide: 'https://www.truelink-group.com/en/eeat-guide/',
  source: 'https://github.com/Johnny050033/truelink-schema-web-tools',
} as const satisfies Record<string, string | Record<Locale, string>>;

export const VALIDATORS = {
  richResults: 'https://search.google.com/test/rich-results',
  schemaMarkup: 'https://validator.schema.org/',
} as const;

export const BRAND_LOGO_URL = sameOriginPath(env.VITE_BRAND_LOGO_URL);

/** Local storage budget from the product plan; hitting it blocks writes, never deletes. */
export const LOCAL_LIMITS = {
  maxDocuments: 20,
  maxTotalBytes: 3 * 1024 * 1024,
  maxImportTextBytes: 2 * 1024 * 1024,
  maxBackupDocuments: 200,
} as const;

/** Days to wait before showing another sign-up suggestion after one was dismissed. */
export const NUDGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
