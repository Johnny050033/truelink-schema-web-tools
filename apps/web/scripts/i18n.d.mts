import type { SourceEntry } from '../../../packages/schema-document/scripts/i18n.mjs';
export declare const MESSAGES_DIR: string;
export declare const CATALOG_LOCALES: readonly ('zh-CN' | 'ja' | 'es' | 'pt-BR' | 'id')[];
export declare function readMessages(locale: string): Record<string, string> | undefined;
export declare function messageSources(locale: string): Record<string, SourceEntry>;
