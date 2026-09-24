export interface SourceEntry {
  readonly text: string;
  readonly required: readonly string[];
  readonly allowed: readonly string[];
}
export interface ExtractedEntry {
  readonly zh: readonly string[];
  readonly where: readonly string[];
}
export interface CatalogCheck {
  readonly errors: readonly string[];
  readonly missing: readonly string[];
  readonly unknown: readonly string[];
}
export declare const SOURCE_DIR: string;
export declare const LOCALES_DIR: string;
export declare const CATALOG_LOCALES: readonly ('zh-CN' | 'ja' | 'es' | 'pt-BR' | 'id')[];
export declare const TEXT_CALLS: Readonly<Record<string, readonly [number, number]>>;
export declare function extract(directory?: string): { entries: Map<string, ExtractedEntry>; problems: string[] };
export declare function slotsOf(text: string): string[];
export declare function sourceEntry(text: string, alternatives?: readonly string[]): SourceEntry;
export declare function checkCatalog(locale: string, source: Readonly<Record<string, SourceEntry>>, catalog: unknown): CatalogCheck;
export declare function coreSources(entries: Map<string, ExtractedEntry>): Record<'zh-CN' | 'ja' | 'es' | 'pt-BR' | 'id', Record<string, SourceEntry>>;
export declare function referenceCatalogs(entries: Map<string, ExtractedEntry>): { en: Record<string, string>; 'zh-TW': Record<string, string> };
export declare function readCatalog(locale: string): unknown;
export declare function tidy(source: Readonly<Record<string, unknown>>, catalog: unknown): Record<string, string>;
export declare const serialize: (object: unknown) => string;
