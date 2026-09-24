import { t } from './formats.js';
import type { LocalizedText } from './types.js';

export type PlatformId =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'youtube'
  | 'x'
  | 'threads'
  | 'line'
  | 'google-business'
  | 'wikipedia'
  | 'wikidata'
  | 'github'
  | 'tiktok'
  | '104'
  | 'other';

export interface Platform {
  readonly id: Exclude<PlatformId, 'other'>;
  readonly label: LocalizedText;
  readonly placeholder: string;
  /** Authority sources that are independent of the brand's own channels. */
  readonly authority?: boolean;
}

/** Profile slots offered in the brand wizard, in display order. */
export const PLATFORMS: readonly Platform[] = [
  { id: 'facebook', label: t('Facebook 粉絲專頁', 'Facebook page'), placeholder: 'https://www.facebook.com/your-page' },
  { id: 'instagram', label: t('Instagram', 'Instagram'), placeholder: 'https://www.instagram.com/your-account' },
  { id: 'linkedin', label: t('LinkedIn', 'LinkedIn'), placeholder: 'https://www.linkedin.com/company/your-company' },
  { id: 'youtube', label: t('YouTube 頻道', 'YouTube channel'), placeholder: 'https://www.youtube.com/@your-channel' },
  { id: 'google-business', label: t('Google 商家檔案／地圖', 'Google Business Profile / Maps'), placeholder: 'https://maps.app.goo.gl/…' },
  { id: 'line', label: t('LINE 官方帳號', 'LINE official account'), placeholder: 'https://lin.ee/…' },
  { id: 'x', label: t('X（Twitter）', 'X (Twitter)'), placeholder: 'https://x.com/your-account' },
  { id: 'threads', label: t('Threads', 'Threads'), placeholder: 'https://www.threads.net/@your-account' },
  { id: 'wikipedia', label: t('維基百科條目', 'Wikipedia article'), placeholder: 'https://zh.wikipedia.org/wiki/…', authority: true },
  { id: 'wikidata', label: t('Wikidata 項目', 'Wikidata item'), placeholder: 'https://www.wikidata.org/wiki/Q…', authority: true },
];

const HOSTS: readonly (readonly [Exclude<PlatformId, 'other'>, readonly string[]])[] = [
  ['facebook', ['facebook.com', 'fb.com', 'fb.me']],
  ['instagram', ['instagram.com']],
  ['linkedin', ['linkedin.com']],
  ['youtube', ['youtube.com', 'youtu.be']],
  ['x', ['x.com', 'twitter.com']],
  ['threads', ['threads.net', 'threads.com']],
  ['line', ['line.me', 'lin.ee']],
  ['google-business', ['g.page', 'maps.app.goo.gl', 'business.google.com', 'maps.google.com']],
  ['wikipedia', ['wikipedia.org']],
  ['wikidata', ['wikidata.org']],
  ['github', ['github.com']],
  ['tiktok', ['tiktok.com']],
  ['104', ['104.com.tw']],
];

const LABELS: Record<Exclude<PlatformId, 'other'>, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  threads: 'Threads',
  line: 'LINE',
  'google-business': 'Google Maps',
  wikipedia: 'Wikipedia',
  wikidata: 'Wikidata',
  github: 'GitHub',
  tiktok: 'TikTok',
  '104': '104',
};

export function classifyProfile(url: string): PlatformId {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return 'other';
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if ((host === 'google.com' || host.endsWith('.google.com')) && parsed.pathname.startsWith('/maps')) return 'google-business';
  if (host === 'goo.gl' && parsed.pathname.startsWith('/maps')) return 'google-business';
  for (const [id, hosts] of HOSTS) {
    if (hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) return id;
  }
  return 'other';
}

export function platformName(id: PlatformId, url?: string): string {
  if (id !== 'other') return LABELS[id];
  if (!url) return 'Web';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Web';
  }
}
