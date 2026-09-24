import { localize } from '../i18n.js';
import { getAt } from '../json.js';
import type { FieldOption, JsonObject, Locale, ScalarField, SchemaTemplate, TemplateField, TemplateId, TemplateSection } from '../types.js';
import { article, breadcrumb, event, faq, thing } from './content.js';
import { localBusiness, organization, person, website } from './entities.js';
import { product, service } from './offerings.js';

export const TEMPLATES: readonly SchemaTemplate[] = [organization, localBusiness, person, website, service, product, article, faq, event, breadcrumb, thing];

const byId = new Map<string, SchemaTemplate>(TEMPLATES.map((template) => [template.id, template]));

export const TEMPLATE_IDS: readonly TemplateId[] = TEMPLATES.map((template) => template.id);

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && byId.has(value);
}

export function getTemplate(id: TemplateId): SchemaTemplate {
  const template = byId.get(id);
  if (!template) throw new TypeError(`Unknown template "${id}".`);
  return template;
}

/** Picks the template whose `@type` list matches first; unknown types use the generic template. */
export function templateForTypes(types: readonly string[]): SchemaTemplate {
  for (const type of types) {
    const match = TEMPLATES.find((template) => template.type === type || template.matchTypes?.includes(type));
    if (match && match.id !== 'thing') return match;
  }
  return thing;
}

export interface FieldEntry {
  readonly field: TemplateField;
  readonly section: TemplateSection;
}

export function templateFields(template: SchemaTemplate): FieldEntry[] {
  return template.sections.flatMap((section) => section.fields.map((field) => ({ field, section })));
}

export function findField(template: SchemaTemplate, fieldId: string): FieldEntry | undefined {
  return templateFields(template).find((entry) => entry.field.id === fieldId);
}

/** Evaluates `visibleWhen` against a node (the document root or a list item). */
export function isFieldVisible(field: TemplateField, node: JsonObject): boolean {
  if (field.kind === 'list' || !field.visibleWhen) return true;
  const rule = field.visibleWhen;
  const raw = getAt(node, rule.path);
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.find((item): item is string => typeof item === 'string') : undefined;
  return rule.in.includes(value ?? rule.default ?? '');
}

function typeOption(template: SchemaTemplate): readonly FieldOption[] | undefined {
  const typeField = templateFields(template).find((entry) => entry.field.kind === 'select' && entry.field.path.length === 1 && entry.field.path[0] === '@type');
  return typeField ? (typeField.field as ScalarField).options : undefined;
}

/** Localized label for a node's `@type` (falls back to the raw type or template name). */
export function typeLabel(template: SchemaTemplate, node: JsonObject, locale: Locale): string {
  const raw = node['@type'];
  const type = typeof raw === 'string' ? raw : Array.isArray(raw) && typeof raw[0] === 'string' ? raw[0] : template.type;
  const option = typeOption(template)?.find((item) => item.value === type);
  if (option) return localize(option.label, locale);
  return type === template.type ? localize(template.name, locale) : type;
}

export { article, breadcrumb, event, faq, localBusiness, organization, person, product, service, thing, website };
