import { fallbackLocale, type Locale, type SourceLocale } from 'truelink-schema-document';

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

const env = import.meta.env;

export const APP_VERSION = __APP_VERSION__;

/** A value per locale: both source languages are required; other locales fall back to theirs. */
export type PerLocale = Readonly<Record<SourceLocale, string>> & Readonly<Partial<Record<Locale, string>>>;

export function forLocale(values: PerLocale, locale: Locale): string {
  return values[locale] ?? values[fallbackLocale(locale)];
}

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
} as const satisfies Record<string, string | PerLocale>;

const REPOSITORY = TRUELINK_LINKS.source;

/** Google Search Central serves its documentation in these languages (`hl`). */
const GOOGLE_DOCS_LANGUAGE: Readonly<Partial<Record<Locale, string>>> = { 'zh-TW': 'zh-tw', 'zh-CN': 'zh-cn', ja: 'ja', es: 'es-419', 'pt-BR': 'pt-br', id: 'id' };

/** Opens Google documentation in the interface language; other links are unchanged. Only the language is added. */
export function documentationUrl(url: string, publisher: string, locale: Locale): string {
  const language = publisher === 'google' ? GOOGLE_DOCS_LANGUAGE[locale] : undefined;
  if (!language) return url;
  const target = new URL(url);
  target.searchParams.set('hl', language);
  return target.toString();
}

/** Public feedback channels. Issue forms remind people not to paste private data. */
export const COMMUNITY_LINKS = {
  bug: `${REPOSITORY}/issues/new?template=bug_report.yml`,
  idea: `${REPOSITORY}/issues/new?template=feature_request.yml`,
  translate: `${REPOSITORY}/blob/main/CONTRIBUTING.md#translations`,
  star: REPOSITORY,
} as const;

/**
 * Same-origin path of the TrueLink host page that bridges cloud drafts (for example
 * /studio/host.html when the Studio is served by TrueLink). Unset means local-only.
 */
export function hostPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^(?:\.\/|\/(?!\/))[A-Za-z0-9._~/-]*$/.test(value) ? value : undefined;
}

export const CLOUD_HOST_PATH = hostPath(env.VITE_TRUELINK_HOST_URL);

export const VALIDATORS = {
  richResults: 'https://search.google.com/test/rich-results',
  schemaMarkup: 'https://validator.schema.org/',
} as const;

/** Local storage budget from the product plan; hitting it blocks writes, never deletes. */
export const LOCAL_LIMITS = {
  maxDocuments: 20,
  maxTotalBytes: 3 * 1024 * 1024,
  maxImportTextBytes: 2 * 1024 * 1024,
  maxBackupDocuments: 200,
} as const;

/** Days to wait before showing another sign-up suggestion after one was dismissed. */
export const NUDGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
