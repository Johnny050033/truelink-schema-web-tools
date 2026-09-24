/**
 * Interface copy lives in ./locales: en.json is the source, zh-TW.json the other source
 * language, and every other locale a translation keyed by message id (scripts/i18n.mjs checks
 * them). Claims stay advisory: structured data can help machines understand a brand, but nothing
 * here promises rankings, rich results or AI citations, and planned features are labelled as planned.
 */
import type { SourceLocale } from 'truelink-schema-document';
import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';

export type MessageKey = keyof typeof en;
export type Messages = Readonly<Record<MessageKey, string>>;

/** The two languages bundled with the app; other locales download on first use. */
export const sourceMessages: Readonly<Record<SourceLocale, Messages>> = { en, 'zh-TW': zhTW satisfies Messages };
