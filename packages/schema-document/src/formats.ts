import type { Locale, LocalizedText } from './types.js';

/** Builds localized text from one function, keeping both languages side by side. */
export function localized(build: (locale: Locale) => string): LocalizedText {
  return { 'zh-TW': build('zh-TW'), en: build('en') };
}

export function t(zh: string, en: string): LocalizedText {
  return { 'zh-TW': zh, en };
}

export function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\/[^\s]+$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function isHttpsUrl(value: string): boolean {
  return isHttpUrl(value) && value.slice(0, 8).toLowerCase() === 'https://';
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:".]{2,}$/.test(value);
}

export function isTelephone(value: string): boolean {
  if (!/^\+?[0-9][0-9\s\-().]*$/.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= 6 && digits <= 17;
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days;
}

/** ISO 8601 calendar date with year, year-month or full precision. */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  const month = match[2] === undefined ? 1 : Number(match[2]);
  const day = match[3] === undefined ? 1 : Number(match[3]);
  return isCalendarDate(Number(match[1]), month, day);
}

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))?)?$/;

/** ISO 8601 date or date-time (seconds and a time-zone designator are optional). */
export function isIsoDateTime(value: string): boolean {
  const match = DATE_TIME.exec(value);
  if (!match) return false;
  if (!isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) return false;
  if (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59)) return false;
  if (match[6] !== undefined && Number(match[6]) > 59) return false;
  if (match[8] !== undefined && (Number(match[8]) > 14 || Number(match[9]) > 59)) return false;
  return true;
}

/** True when a date-time includes a time but no zone designator. */
export function lacksTimeZone(value: string): boolean {
  const match = DATE_TIME.exec(value);
  return Boolean(match && match[4] !== undefined && match[7] === undefined);
}

export function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

export function isNumberText(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}

/** Schema.org price: digits with an optional decimal point, no symbols or separators. */
export function isPrice(value: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(value);
}

export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

export function isLanguageTag(value: string): boolean {
  return /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(value);
}

export function isLatitude(value: string): boolean {
  return isNumberText(value) && Math.abs(Number(value)) <= 90;
}

export function isLongitude(value: string): boolean {
  return isNumberText(value) && Math.abs(Number(value)) <= 180;
}

/**
 * Taiwan Unified Business Number (統一編號) checksum, using the divisible-by-5
 * rule in effect since 2023 (which also accepts older divisible-by-10 numbers).
 */
export function isTaiwanBusinessId(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false;
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  let sum = 0;
  for (let index = 0; index < 8; index += 1) {
    const product = Number(value[index]) * weights[index]!;
    sum += Math.floor(product / 10) + (product % 10);
  }
  if (sum % 5 === 0) return true;
  return value[6] === '7' && (sum + 1) % 5 === 0;
}

/** Displays an ISO date/date-time wall clock without converting time zones. */
export function formatWallClock(value: string, locale: Locale): string {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2}))?)?)?/.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const time = hour !== undefined ? ` ${hour}:${minute}` : '';
  if (month === undefined) return locale === 'zh-TW' ? `${year} 年` : String(year);
  if (day === undefined) return locale === 'zh-TW' ? `${year} 年 ${Number(month)} 月` : `${year}-${month}`;
  return locale === 'zh-TW' ? `${year}/${month}/${day}${time}` : `${year}-${month}-${day}${time}`;
}
