/** Languages every bundled string is written in. */
export type SourceLocale = 'zh-TW' | 'en';
export const SOURCE_LOCALES: readonly SourceLocale[] = ['zh-TW', 'en'];

/**
 * UI locales. Locales other than the two source languages resolve through translation
 * catalogs (see `registerCatalog`) and fall back to English, or to zh-TW for zh-CN.
 */
export type Locale = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'es' | 'pt-BR' | 'id';
export const LOCALES: readonly Locale[] = ['en', 'zh-TW', 'zh-CN', 'ja', 'es', 'pt-BR', 'id'];

/** Text in both source languages, optionally with explicit translations for other locales. */
export type LocalizedText = Readonly<Record<SourceLocale, string>> & Readonly<Partial<Record<Exclude<Locale, SourceLocale>, string>>>;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }

/** Editing widgets for a single value (or a list of values when `multiple`). */
export type ScalarKind =
  | 'text'
  | 'textarea'
  | 'url'
  | 'id'
  | 'email'
  | 'tel'
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'price'
  | 'select'
  | 'currency'
  | 'country'
  | 'language'
  | 'days'
  | 'taxId';

/**
 * `required` mirrors a documented search-engine requirement or the minimum this
 * tool needs to describe the entity; `recommended` fields improve understanding.
 * Neither is a promise of rich results, ranking or AI citation.
 */
export type Importance = 'required' | 'recommended' | 'optional';

export interface FieldOption {
  readonly value: string;
  readonly label: LocalizedText;
}

export interface VisibleWhen {
  readonly path: readonly string[];
  readonly in: readonly string[];
  /** Value assumed when the controlling path is empty. */
  readonly default?: string;
}

export interface ScalarField {
  readonly id: string;
  readonly kind: ScalarKind;
  /** Path relative to the owning node (the document root, or a list item). */
  readonly path: readonly string[];
  readonly label: LocalizedText;
  readonly help?: LocalizedText;
  readonly placeholder?: LocalizedText;
  readonly importance: Importance;
  /** Stores an array of scalar values, e.g. `sameAs`. */
  readonly multiple?: boolean;
  readonly options?: readonly FieldOption[];
  readonly maxLength?: number;
  readonly visibleWhen?: VisibleWhen;
  /** Benefit shown when a recommended field is missing. */
  readonly why?: LocalizedText;
  /** When this field is first filled and `path` is empty, the editor fills `value` (computed from the document and interface language when a function). */
  readonly companion?: { readonly path: readonly string[]; readonly value: string | ((node: JsonObject, locale?: Locale) => string) };
  /** Suggests a value (for example an `@id` derived from the site URL). */
  readonly suggest?: (node: JsonObject) => string | undefined;
}

export interface ListField {
  readonly id: string;
  readonly kind: 'list';
  readonly path: readonly string[];
  readonly itemType: string;
  /** Intermediate node types relative to each item, keyed by dotted path. */
  readonly nodeTypes?: Readonly<Record<string, string>>;
  readonly label: LocalizedText;
  readonly itemLabel: LocalizedText;
  readonly addLabel: LocalizedText;
  readonly help?: LocalizedText;
  readonly importance: Importance;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly fields: readonly ScalarField[];
  readonly why?: LocalizedText;
}

export type TemplateField = ScalarField | ListField;

export interface TemplateSection {
  readonly id: string;
  readonly title: LocalizedText;
  readonly description?: LocalizedText;
  readonly fields: readonly TemplateField[];
}

export type TemplateId =
  | 'organization'
  | 'local-business'
  | 'person'
  | 'website'
  | 'service'
  | 'product'
  | 'article'
  | 'faq'
  | 'event'
  | 'breadcrumb'
  | 'thing';

export type TemplateCategory = 'entity' | 'offering' | 'content' | 'navigation' | 'other';

export interface LearnMoreLink {
  readonly label: LocalizedText;
  readonly url: string;
  /** Language of the linked page when it differs from the UI. */
  readonly lang?: Locale;
  readonly publisher: 'truelink' | 'google' | 'schema.org';
}

/** Copies a value from the brand profile into a new document. */
export interface BrandFill {
  readonly from: readonly string[];
  readonly to: readonly string[];
}

export type Severity = 'error' | 'warning' | 'info';

export interface AuditIssue {
  readonly severity: Severity;
  readonly code: string;
  readonly fieldId?: string;
  readonly path?: readonly (string | number)[];
  readonly message: LocalizedText;
}

export interface SchemaTemplate {
  readonly id: TemplateId;
  /** Default `@type` for new documents. */
  readonly type: string;
  /** Additional `@type` values that should open with this template. */
  readonly matchTypes?: readonly string[];
  readonly name: LocalizedText;
  readonly summary: LocalizedText;
  readonly category: TemplateCategory;
  readonly icon: string;
  readonly richResult?: LocalizedText;
  /** Intermediate node types keyed by dotted path from the document root. */
  readonly nodeTypes: Readonly<Record<string, string>>;
  readonly sections: readonly TemplateSection[];
  readonly brandFill?: readonly BrandFill[];
  /** Extra starter values (besides `@context` and `@type`); `brand` is the saved brand profile. */
  readonly starter?: (locale: Locale, brand?: JsonObject) => JsonObject;
  readonly learnMore?: readonly LearnMoreLink[];
  /** Normalization applied to exported output, e.g. breadcrumb positions. */
  readonly finalize?: (node: JsonObject) => JsonObject;
  /** Cross-field advisory checks evaluated on exported output. */
  readonly checks?: (node: JsonObject) => AuditIssue[];
  /** Paths tried in order to derive a display name. */
  readonly titlePaths: readonly (readonly string[])[];
}

export type Grade = 'needs-work' | 'good' | 'excellent';

export interface MissingField {
  readonly fieldId: string;
  readonly sectionId: string;
  readonly label: LocalizedText;
  readonly importance: Importance;
  readonly why?: LocalizedText;
}

export interface AuditResult {
  /** 0–100 completeness of known fields; advisory only. */
  readonly score: number;
  readonly grade: Grade;
  readonly issues: readonly AuditIssue[];
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly required: { readonly filled: number; readonly total: number };
  readonly recommended: { readonly filled: number; readonly total: number };
  readonly missing: readonly MissingField[];
  /** Fields whose state could not be judged (e.g. complex imported values). */
  readonly unknown: number;
}
