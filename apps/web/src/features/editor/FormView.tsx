import { useMemo, useRef, useState } from 'react';
import {
  getAt,
  isFieldVisible,
  newListItem,
  readList,
  setAt,
  writeList,
  type AuditIssue,
  type AuditResult,
  type JsonObject,
  type ListField,
  type ScalarField,
  type SchemaTemplate,
  type TemplateField,
} from 'truelink-schema-document';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/ui';
import { useI18n } from '../../i18n';
import { FieldControl } from './FieldControl';

/** Missing-field notices live in the checks panel; inline messages cover malformed values. */
const PANEL_ONLY = new Set(['missing_required', 'missing_recommended', 'missing_item_field', 'too_few_items', 'unverified_properties', 'complex_value']);

export function fieldDomId(fieldId: string): string {
  return `field-${fieldId.replace(/[^\w-]/g, '_')}`;
}

function samePath(a: readonly (string | number)[] | undefined, b: readonly (string | number)[]): boolean {
  return a !== undefined && a.length === b.length && a.every((part, index) => part === b[index]);
}

interface ControlContext {
  readonly template: SchemaTemplate;
  readonly root: JsonObject;
  readonly issues: readonly AuditIssue[];
  readonly touched: ReadonlySet<string>;
  readonly initiallyFilled: ReadonlySet<string>;
  readonly touch: (id: string) => void;
  readonly onEditJson: () => void;
}

function ListControl({ field, context, onChange }: { field: ListField; context: ControlContext; onChange: (next: JsonObject) => void }) {
  const { t, l } = useI18n();
  const state = readList(context.root, field);
  const domId = fieldDomId(field.id);
  if (state.kind === 'complex') {
    return (
      <div className="field field-wide" id={domId}>
        <span className="field-label">{l(field.label)}</span>
        <div className="complex">
          <p>{t('field.complex')}</p>
          <button type="button" className="link-btn" onClick={context.onEditJson}>
            <Icon name="code" size={16} />
            {t('field.editJson')}
          </button>
        </div>
      </div>
    );
  }
  const items = state.items;
  const nodeTypes = field.nodeTypes ?? {};
  const write = (next: readonly JsonObject[]) => onChange(writeList(context.root, field, next, context.template.nodeTypes));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    write(next);
  };
  const atMax = field.maxItems !== undefined && items.length >= field.maxItems;
  return (
    <fieldset className="field field-wide list-field" id={domId}>
      <legend className="field-label-row">
        <span className="field-label">{l(field.label)}</span>
        {field.importance !== 'optional' ? <span className={`importance importance-${field.importance}`}>{t(field.importance === 'required' ? 'common.required' : 'common.recommended')}</span> : null}
        <span className="list-count">{t('field.itemCount', { count: items.length })}</span>
      </legend>
      {field.help ? <p className="field-help field-help-static">{l(field.help)}</p> : null}
      <ol className="list-items">
        {items.map((item, index) => (
          <li key={index} className="list-item">
            <div className="list-item-head">
              <span className="list-item-title">
                {l(field.itemLabel)} {index + 1}
              </span>
              <span className="list-item-tools">
                <IconButton icon="arrow-up" size="sm" label={t('field.moveUp')} disabled={index === 0} onClick={() => move(index, -1)} />
                <IconButton icon="arrow-down" size="sm" label={t('field.moveDown')} disabled={index === items.length - 1} onClick={() => move(index, 1)} />
                <IconButton icon="trash" size="sm" label={t('field.removeItem', { index: index + 1 })} onClick={() => write(items.filter((_, i) => i !== index))} />
              </span>
            </div>
            <div className="form-grid">
              {field.fields
                .filter((child) => isFieldVisible(child, item))
                .map((child) => {
                  const id = `${field.id}.${index}.${child.id}`;
                  const path = [...field.path, index, ...child.path];
                  const issues = context.issues.filter((entry) => entry.fieldId === field.id && samePath(entry.path, path) && !PANEL_ONLY.has(entry.code));
                  return (
                    <FieldControl
                      key={child.id}
                      field={child}
                      node={item}
                      root={context.root}
                      nodeTypes={nodeTypes}
                      domId={fieldDomId(id)}
                      issues={issues}
                      showIssues={context.touched.has(id) || context.initiallyFilled.has(id)}
                      onTouched={() => context.touch(id)}
                      onChange={(nextItem) => write(items.map((entry, i) => (i === index ? nextItem : entry)))}
                      onEditJson={context.onEditJson}
                      wide={child.kind === 'textarea' || child.kind === 'days' ? true : undefined}
                    />
                  );
                })}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-secondary btn-sm add-item" onClick={() => write([...items, newListItem(field)])} disabled={atMax}>
        <Icon name="plus" size={16} />
        <span className="btn-label">{l(field.addLabel)}</span>
      </button>
    </fieldset>
  );
}

function controllerKey(path: readonly string[]): string {
  return path.join('.');
}

/** Removes values of fields that a type change just hid, returning the cleaned node. */
export function clearHiddenFields(template: SchemaTemplate, before: JsonObject, after: JsonObject): { node: JsonObject; cleared: number } {
  let node = after;
  let cleared = 0;
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.kind === 'list' || !field.visibleWhen) continue;
      if (isFieldVisible(field, before) && !isFieldVisible(field, node) && getAt(node, field.path) !== undefined) {
        node = setAt(node, field.path, undefined);
        cleared += 1;
      }
    }
  }
  return { node, cleared };
}

export function FormView({ template, data, audit, onChange, onEditJson, onFieldsCleared }: {
  template: SchemaTemplate;
  data: JsonObject;
  audit: AuditResult;
  onChange: (next: JsonObject) => void;
  onEditJson: () => void;
  onFieldsCleared: (previous: JsonObject) => void;
}) {
  const { t, l } = useI18n();
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const initialData = useRef(data);
  const initiallyFilled = useMemo(() => {
    const filled = new Set<string>();
    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.kind !== 'list') {
          if (getAt(initialData.current, field.path) !== undefined) filled.add(field.id);
          continue;
        }
        const items = getAt(initialData.current, field.path);
        (Array.isArray(items) ? items : []).forEach((item, index) => {
          for (const child of field.fields) if (getAt(item as JsonObject, child.path) !== undefined) filled.add(`${field.id}.${index}.${child.id}`);
        });
      }
    }
    return filled;
  }, [template]);

  const controllers = useMemo(() => {
    const keys = new Set<string>();
    for (const section of template.sections) for (const field of section.fields) if (field.kind !== 'list' && field.visibleWhen) keys.add(controllerKey(field.visibleWhen.path));
    return keys;
  }, [template]);

  const context: ControlContext = {
    template,
    root: data,
    issues: audit.issues,
    touched,
    initiallyFilled,
    touch: (id) => setTouched((current) => (current.has(id) ? current : new Set(current).add(id))),
    onEditJson,
  };

  const handleScalar = (field: ScalarField, next: JsonObject) => {
    if (controllers.has(controllerKey(field.path))) {
      const { node, cleared } = clearHiddenFields(template, data, next);
      onChange(node);
      if (cleared > 0) onFieldsCleared(data);
      return;
    }
    onChange(next);
  };

  const missing = new Set(audit.missing.map((item) => item.fieldId));
  const broken = new Set(audit.issues.filter((item) => item.severity === 'error' && item.fieldId).map((item) => item.fieldId!));

  return (
    <div className="form-view">
      {template.sections.map((section) => {
        const visible = section.fields.filter((field) => isFieldVisible(field, data));
        if (visible.length === 0) return null;
        const counted = visible.filter((field: TemplateField) => field.importance !== 'optional');
        const filled = counted.filter((field) => !missing.has(field.id) && !broken.has(field.id)).length;
        const headingId = `section-${section.id}-title`;
        return (
          <section key={section.id} className="card form-section" aria-labelledby={headingId}>
            <header className="form-section-head">
              <div>
                <h2 id={headingId}>{l(section.title)}</h2>
                {section.description ? <p>{l(section.description)}</p> : null}
              </div>
              {counted.length > 0 ? (
                <span className={`section-progress${filled === counted.length ? ' is-complete' : ''}`}>
                  {filled === counted.length ? <Icon name="check" size={14} /> : null}
                  {t('editor.sectionProgress', { filled, total: counted.length })}
                </span>
              ) : null}
            </header>
            <div className="form-grid">
              {visible.map((field) =>
                field.kind === 'list' ? (
                  <ListControl key={field.id} field={field} context={context} onChange={onChange} />
                ) : (
                  <FieldControl
                    key={field.id}
                    field={field}
                    node={data}
                    root={data}
                    nodeTypes={template.nodeTypes}
                    domId={fieldDomId(field.id)}
                    issues={audit.issues.filter((issue) => issue.fieldId === field.id && !PANEL_ONLY.has(issue.code))}
                    showIssues={touched.has(field.id) || initiallyFilled.has(field.id)}
                    onTouched={() => context.touch(field.id)}
                    onChange={(next) => handleScalar(field, next)}
                    onEditJson={onEditJson}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Scrolls to a field and focuses its first control. */
export function focusField(fieldId: string): void {
  const element = document.getElementById(fieldDomId(fieldId));
  if (!element) return;
  element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  const control = element.querySelector<HTMLElement>('input, select, textarea, button');
  window.setTimeout(() => control?.focus({ preventScroll: true }), 250);
  element.classList.add('is-highlighted');
  window.setTimeout(() => element.classList.remove('is-highlighted'), 1600);
}
