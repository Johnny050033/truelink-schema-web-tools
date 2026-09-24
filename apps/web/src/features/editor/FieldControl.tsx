import { useId, useState, type ReactNode } from 'react';
import {
  classifyProfile,
  dayOptions,
  getAt,
  isJsonObject,
  platformName,
  readField,
  setAt,
  writeField,
  type AuditIssue,
  type JsonObject,
  type ScalarField,
} from 'truelink-schema-document';
import { Icon } from '../../components/Icon';
import { IconButton } from '../../components/ui';
import { useI18n } from '../../i18n';

export interface FieldControlProps {
  readonly field: ScalarField;
  /** The node that owns the field: the document root or a list item. */
  readonly node: JsonObject;
  /** Document root, used for suggestions such as @id. */
  readonly root: JsonObject;
  readonly nodeTypes: Readonly<Record<string, string>>;
  readonly onChange: (next: JsonObject) => void;
  readonly issues: readonly AuditIssue[];
  readonly domId: string;
  readonly showIssues: boolean;
  readonly onTouched: () => void;
  readonly onEditJson?: () => void;
  readonly wide?: boolean;
}

const INPUT_TYPE: Partial<Record<ScalarField['kind'], string>> = { url: 'url', id: 'url', email: 'email', tel: 'tel' };
const INPUT_MODE: Partial<Record<ScalarField['kind'], 'decimal' | 'numeric' | 'url' | 'email' | 'tel'>> = { number: 'decimal', price: 'decimal', taxId: 'numeric' };

export function isWideField(field: ScalarField): boolean {
  return field.kind === 'textarea' || field.kind === 'days' || Boolean(field.multiple) || field.kind === 'datetime';
}

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function localOffset(date: string, time: string): string {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  const minutes = -parsed.getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function DateTimeInput({ id, value, onChange, onBlur, describedBy, invalid }: { id: string; value: string; onChange: (value: string) => void; onBlur: () => void; describedBy: string | undefined; invalid: boolean }) {
  const { t } = useI18n();
  const match = value ? DATE_TIME.exec(value) : null;
  if (value && !match) {
    return <input id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} aria-describedby={describedBy} aria-invalid={invalid || undefined} spellCheck={false} />;
  }
  const date = match?.[1] ?? '';
  const time = match?.[2] ?? '';
  const offset = match?.[3];
  const compose = (nextDate: string, nextTime: string) => {
    if (!nextDate) return onChange('');
    if (!nextTime) return onChange(nextDate);
    onChange(`${nextDate}T${nextTime}${offset ?? localOffset(nextDate, nextTime)}`);
  };
  const shownOffset = offset ?? (date && time ? localOffset(date, time) : '');
  return (
    <div className="datetime">
      <input id={id} type="date" className="input" value={date} onChange={(event) => compose(event.target.value, time)} onBlur={onBlur} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
      <input type="time" className="input" value={time} onChange={(event) => compose(date, event.target.value)} onBlur={onBlur} aria-label={t('field.time')} disabled={!date} />
      {shownOffset ? <span className="tz-chip">{t('field.timezone', { offset: shownOffset === 'Z' ? 'UTC' : shownOffset })}</span> : null}
    </div>
  );
}

function DaysInput({ id, values, onChange, describedBy }: { id: string; values: readonly string[]; onChange: (values: string[]) => void; describedBy: string | undefined }) {
  const { t, l } = useI18n();
  const normalized = new Set(values.map((value) => value.replace(/^https?:\/\/schema\.org\//, '')));
  const toggle = (day: string) => {
    const next = new Set(normalized);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(dayOptions.map((option) => option.value).filter((value) => next.has(value)));
  };
  const preset = (days: readonly string[]) => onChange([...days]);
  const all = dayOptions.map((option) => option.value);
  return (
    <div className="days" id={id} role="group" aria-describedby={describedBy}>
      <div className="day-chips">
        {dayOptions.map((option) => (
          <label key={option.value} className={`day-chip${normalized.has(option.value) ? ' is-on' : ''}`}>
            <input type="checkbox" checked={normalized.has(option.value)} onChange={() => toggle(option.value)} />
            <span>{l(option.label)}</span>
          </label>
        ))}
      </div>
      <div className="day-presets">
        <button type="button" className="link-btn" onClick={() => preset(all.slice(0, 5))}>
          {t('field.days.weekdays')}
        </button>
        <button type="button" className="link-btn" onClick={() => preset(all.slice(5))}>
          {t('field.days.weekend')}
        </button>
        <button type="button" className="link-btn" onClick={() => preset(all)}>
          {t('field.days.everyday')}
        </button>
      </div>
    </div>
  );
}

function MultiInput({ field, id, values, onChange, onBlur, describedBy, invalid }: { field: ScalarField; id: string; values: readonly string[]; onChange: (values: string[]) => void; onBlur: () => void; describedBy: string | undefined; invalid: boolean }) {
  const { t, l } = useI18n();
  const rows = values.length > 0 ? values : [''];
  const update = (index: number, value: string) => onChange(rows.map((row, i) => (i === index ? value : row)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const profiles = field.id === 'sameAs';
  return (
    <div className="multi">
      {rows.map((row, index) => {
        const platform = profiles && row ? classifyProfile(row) : undefined;
        return (
          <div className="multi-row" key={index}>
            <input
              id={index === 0 ? id : undefined}
              className="input"
              type={INPUT_TYPE[field.kind] ?? 'text'}
              inputMode={INPUT_MODE[field.kind]}
              value={row}
              placeholder={field.placeholder ? l(field.placeholder) : undefined}
              aria-label={index === 0 ? undefined : `${l(field.label)} ${index + 1}`}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={(event) => update(index, event.target.value)}
              onBlur={onBlur}
              spellCheck={field.kind === 'text'}
            />
            {platform && platform !== 'other' ? (
              <span className="platform-chip" title={t('field.profile', { platform: platformName(platform) })}>
                {platformName(platform)}
              </span>
            ) : null}
            {rows.length > 1 || row ? <IconButton icon="x" size="sm" label={t('field.removeItem', { index: index + 1 })} onClick={() => remove(index)} /> : null}
          </div>
        );
      })}
      <button type="button" className="link-btn add-row" onClick={() => onChange([...rows, ''])} disabled={rows.some((row) => row.trim() === '')}>
        <Icon name="plus" size={16} />
        {t('field.add')}
      </button>
    </div>
  );
}

function ComplexValue({ field, node, onChange, onEditJson }: { field: ScalarField; node: JsonObject; onChange: (next: JsonObject) => void; onEditJson: (() => void) | undefined }) {
  const { t } = useI18n();
  const value = getAt(node, field.path);
  const nestedUrl = (field.kind === 'url' || field.kind === 'id') && isJsonObject(value) && typeof value['url'] === 'string' ? value['url'] : undefined;
  const preview = JSON.stringify(value ?? getAt(node, field.path.slice(0, 1)));
  return (
    <div className="complex">
      <p>{nestedUrl ? t('field.complexUrl', { url: nestedUrl }) : t('field.complex')}</p>
      {!nestedUrl && preview ? <code className="complex-preview">{preview.length > 160 ? `${preview.slice(0, 159)}…` : preview}</code> : null}
      <div className="complex-actions">
        {nestedUrl ? (
          <button type="button" className="link-btn" onClick={() => onChange(setAt(node, field.path, nestedUrl))}>
            {t('field.simplify')}
          </button>
        ) : null}
        {onEditJson ? (
          <button type="button" className="link-btn" onClick={onEditJson}>
            <Icon name="code" size={16} />
            {t('field.editJson')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function FieldShell({ label, importance, help, htmlFor, helpId, errorId, issue, children, wide, domId, labelAs = 'label' }: {
  label: string;
  importance: ScalarField['importance'];
  help: string | undefined;
  htmlFor: string;
  helpId: string;
  errorId: string;
  issue: AuditIssue | undefined;
  children: ReactNode;
  wide: boolean | undefined;
  domId: string;
  labelAs?: 'label' | 'span';
}) {
  const { t, l } = useI18n();
  const [helpOpen, setHelpOpen] = useState(false);
  const LabelTag = labelAs;
  return (
    <div className={`field${wide ? ' field-wide' : ''}${issue ? ` has-${issue.severity}` : ''}`} id={domId}>
      <div className="field-label-row">
        <LabelTag {...(labelAs === 'label' ? { htmlFor } : { id: `${htmlFor}-label` })} className="field-label">
          {label}
        </LabelTag>
        {importance !== 'optional' ? <span className={`importance importance-${importance}`}>{t(importance === 'required' ? 'common.required' : 'common.recommended')}</span> : null}
        {help ? (
          <button type="button" className="help-toggle" aria-expanded={helpOpen} aria-controls={helpId} aria-label={t('field.help', { label })} onClick={() => setHelpOpen((open) => !open)}>
            <Icon name="help-circle" size={16} />
          </button>
        ) : null}
      </div>
      {help ? (
        <p className="field-help" id={helpId} hidden={!helpOpen}>
          {help}
        </p>
      ) : null}
      {children}
      {issue ? (
        <p className={`field-issue field-issue-${issue.severity}`} id={errorId}>
          <Icon name={issue.severity === 'error' ? 'alert-circle' : issue.severity === 'warning' ? 'alert-triangle' : 'info'} size={14} />
          {l(issue.message)}
        </p>
      ) : null}
    </div>
  );
}

export function FieldControl({ field, node, root, nodeTypes, onChange, issues, domId, showIssues, onTouched, onEditJson, wide }: FieldControlProps) {
  const { t, l } = useI18n();
  const inputId = useId();
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-issue`;
  const state = readField(node, field);
  const issue = showIssues ? issues[0] : undefined;
  const describedBy = [field.help ? helpId : '', issue ? errorId : ''].filter(Boolean).join(' ') || undefined;
  const invalid = issue?.severity === 'error';
  const write = (value: string | readonly string[]) => onChange(writeField(node, field, value, nodeTypes));
  const values = state.kind === 'value' ? state.values : [];
  const single = values[0] ?? '';
  const suggestion = field.suggest && state.kind === 'empty' ? field.suggest(root) : undefined;
  const placeholder = field.placeholder ? l(field.placeholder) : undefined;
  const isTypeSelect = field.path[field.path.length - 1] === '@type' && field.kind === 'select';

  let control: ReactNode;
  if (state.kind === 'complex') {
    control = <ComplexValue field={field} node={node} onChange={onChange} onEditJson={onEditJson} />;
  } else if (field.kind === 'days') {
    control = <DaysInput id={inputId} values={values} onChange={(next) => write(next)} describedBy={describedBy} />;
  } else if (field.multiple) {
    control = <MultiInput field={field} id={inputId} values={values} onChange={(next) => write(next)} onBlur={onTouched} describedBy={describedBy} invalid={invalid} />;
  } else if (field.options && (field.kind === 'select' || field.kind === 'currency' || field.kind === 'country' || field.kind === 'language')) {
    const current = single || (isTypeSelect ? (field.options[0]?.value ?? '') : '');
    const known = field.options.some((option) => option.value === current);
    control = (
      <div className="select-wrap">
        <select id={inputId} className="input select" value={current} onChange={(event) => write(event.target.value)} onBlur={onTouched} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
          {isTypeSelect ? null : <option value="">{t('field.select')}</option>}
          {current && !known ? <option value={current}>{t('field.custom', { value: current })}</option> : null}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {l(option.label)}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" size={16} className="select-icon" />
      </div>
    );
  } else if (field.kind === 'textarea') {
    control = (
      <textarea
        id={inputId}
        className="input textarea"
        rows={field.id.endsWith('text') ? 4 : 3}
        value={single}
        placeholder={placeholder}
        onChange={(event) => write(event.target.value)}
        onBlur={onTouched}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
      />
    );
  } else if (field.kind === 'datetime') {
    control = <DateTimeInput id={inputId} value={single} onChange={(next) => write(next)} onBlur={onTouched} describedBy={describedBy} invalid={invalid} />;
  } else if (field.kind === 'time') {
    control = <input id={inputId} type="time" className="input" value={single} onChange={(event) => write(event.target.value)} onBlur={onTouched} aria-describedby={describedBy} aria-invalid={invalid || undefined} />;
  } else {
    control = (
      <input
        id={inputId}
        className="input"
        type={INPUT_TYPE[field.kind] ?? 'text'}
        inputMode={INPUT_MODE[field.kind]}
        value={single}
        placeholder={placeholder}
        maxLength={field.maxLength ? field.maxLength * 2 : undefined}
        onChange={(event) => write(event.target.value)}
        onBlur={onTouched}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        spellCheck={field.kind === 'text'}
        autoComplete="off"
      />
    );
  }

  return (
    <FieldShell
      label={l(field.label)}
      importance={field.importance}
      help={field.help ? l(field.help) : undefined}
      htmlFor={inputId}
      helpId={helpId}
      errorId={errorId}
      issue={issue}
      wide={wide ?? isWideField(field)}
      domId={domId}
      labelAs={field.kind === 'days' || state.kind === 'complex' ? 'span' : 'label'}
    >
      {control}
      {suggestion ? (
        <button type="button" className="suggest-btn" onClick={() => write(suggestion)}>
          <Icon name="sparkline" size={14} />
          <span>{t('field.suggest')}</span>
          <code>{suggestion}</code>
        </button>
      ) : null}
    </FieldShell>
  );
}
