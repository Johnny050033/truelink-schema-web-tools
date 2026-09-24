import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildOutput,
  checkJsonValue,
  isJsonObject,
  LIMITS,
  toJsonLdJson,
  type AuditIssue,
  type AuditResult,
  type JsonCheckCode,
  type JsonObject,
  type SchemaTemplate,
  type Severity,
} from 'truelink-schema-document';
import { VALIDATORS } from '../../config';
import { CodeBlock } from '../../components/CodeBlock';
import { Icon, type IconName } from '../../components/Icon';
import { Button, ExternalLink, LinkButton, ScoreRing } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import type { SchemaDoc } from '../../lib/persistence';
import { hrefFor } from '../../lib/router';

const CHECK_MESSAGES: Record<JsonCheckCode, MessageKey> = {
  not_json: 'json.code.not_json',
  too_deep: 'json.code.too_deep',
  too_many_nodes: 'json.code.too_many_nodes',
  forbidden_key: 'json.code.forbidden_key',
  string_too_long: 'json.code.string_too_long',
  too_large: 'json.code.too_large',
};

/**
 * Raw JSON-LD editing. Valid input is applied after a short pause; invalid input
 * never replaces the document, so the form keeps showing the last valid state.
 */
export function JsonEditor({ template, data, onApply }: { template: SchemaTemplate; data: JsonObject; onApply: (next: JsonObject) => void }) {
  const { t } = useI18n();
  const format = (value: JsonObject) => JSON.stringify(buildOutput(value, template), null, 2);
  const [text, setText] = useState(() => format(data));
  const [error, setError] = useState<string | null>(null);
  const applied = useRef(data);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (data !== applied.current) {
      applied.current = data;
      setText(format(data));
      setError(null);
    }
  }, [data]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const validate = (value: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (reason) {
      setError(t('json.invalid', { message: reason instanceof Error ? reason.message : String(reason) }));
      return;
    }
    if (!isJsonObject(parsed)) {
      setError(t('json.notObject'));
      return;
    }
    const check = checkJsonValue(parsed, { maxBytes: LIMITS.documentBytes });
    if (!check.ok) {
      setError(t('json.rejected', { reason: t(CHECK_MESSAGES[check.code]) }));
      return;
    }
    setError(null);
    applied.current = parsed;
    onApply(parsed);
  };

  return (
    <div className="card json-editor-card">
      <label htmlFor="json-editor" className="field-label">
        {t('json.label')}
      </label>
      <p className="field-help field-help-static" id="json-editor-hint">
        {t('json.hint')}
      </p>
      <textarea
        id="json-editor"
        className="json-editor"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={text}
        aria-describedby="json-editor-hint json-editor-status"
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => validate(value), 400);
        }}
      />
      <div className="json-status" id="json-editor-status" role="status" aria-live="polite">
        {error ? (
          <>
            <p className="field-issue field-issue-error">
              <Icon name="alert-circle" size={14} />
              {error}
            </p>
            <p className="json-pending">{t('json.pending')}</p>
            <Button size="sm" variant="ghost" icon="refresh" onClick={() => {
              setText(format(applied.current));
              setError(null);
            }}>
              {t('json.revert')}
            </Button>
          </>
        ) : (
          <p className="json-ok">
            <Icon name="check" size={14} />
            {t('json.applied')}
          </p>
        )}
      </div>
    </div>
  );
}

const SEVERITY_ICON: Record<Severity, IconName> = { error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
const SEVERITY_LABEL: Record<Severity, MessageKey> = { error: 'audit.errors', warning: 'audit.warnings', info: 'audit.infos' };

export function ScoreCard({ audit, onShowIssues }: { audit: AuditResult; onShowIssues?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="score-card">
      <ScoreRing score={audit.score} grade={audit.grade} />
      <div className="score-card-text">
        <p className="score-card-grade">
          {t('audit.title')} · <strong className={`grade grade-${audit.grade}`}>{t(`audit.grade.${audit.grade}`)}</strong>
        </p>
        <p className="score-card-counts">
          <span>{t('audit.required', audit.required)}</span>
          <span>{t('audit.recommended', audit.recommended)}</span>
        </p>
        {onShowIssues && audit.issues.length > 0 ? (
          <button type="button" className="link-btn" onClick={onShowIssues}>
            {t('audit.counts', { errors: audit.errors, warnings: audit.warnings, infos: audit.infos })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AuditPanel({ audit, onFocusField }: { audit: AuditResult; onFocusField: (fieldId: string) => void }) {
  const { t, l } = useI18n();
  const groups = (['error', 'warning', 'info'] as const).map((severity) => ({ severity, items: audit.issues.filter((issue) => issue.severity === severity) }));
  return (
    <div className="audit-panel">
      {audit.issues.length === 0 ? (
        <p className="audit-clear">
          <Icon name="check-circle" size={20} />
          {t('audit.none')}
        </p>
      ) : null}
      {groups.map(({ severity, items }) =>
        items.length > 0 ? (
          <section key={severity} className={`issue-group issue-group-${severity}`}>
            <h3>
              {t(SEVERITY_LABEL[severity])} <span className="count">{items.length}</span>
            </h3>
            <ul>
              {items.map((issue: AuditIssue, index) => (
                <li key={`${issue.code}-${index}`} className={`issue issue-${severity}`}>
                  <Icon name={SEVERITY_ICON[severity]} size={16} />
                  <span className="issue-text">{l(issue.message)}</span>
                  {issue.fieldId ? (
                    <button type="button" className="link-btn issue-go" onClick={() => onFocusField(issue.fieldId!)}>
                      {t('audit.goToField')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {audit.unknown > 0 ? <p className="panel-note">{t('audit.unknown', { count: audit.unknown })}</p> : null}
      <p className="panel-note">{t('audit.disclaimer')}</p>
      <p className="panel-note validators">
        {t('audit.validate')} <ExternalLink href={VALIDATORS.richResults}>{t('audit.richResults')}</ExternalLink>
        <ExternalLink href={VALIDATORS.schemaMarkup}>{t('audit.schemaValidator')}</ExternalLink>
      </p>
    </div>
  );
}

export function CodePanel({ template, data, onCopy, onDownloadJson, onDownloadHtml }: { template: SchemaTemplate; data: JsonObject; onCopy: () => void; onDownloadJson: () => void; onDownloadHtml: () => void }) {
  const { t } = useI18n();
  const json = useMemo(() => toJsonLdJson(buildOutput(data, template)), [data, template]);
  return (
    <div className="code-panel">
      <h3 className="panel-title">
        <Icon name="code" size={16} />
        {t('code.title')}
      </h3>
      <ol className="steps">
        <li>{t('code.step1')}</li>
        <li>{t('code.step2')}</li>
        <li>{t('code.step3')}</li>
      </ol>
      <CodeBlock json={json} wrapScript label={t('json.label')} />
      <div className="code-actions">
        <Button variant="primary" icon="copy" onClick={onCopy}>
          {t('editor.copyCode')}
        </Button>
        <Button variant="secondary" icon="download" onClick={onDownloadJson}>
          {t('code.downloadJson')}
        </Button>
        <Button variant="ghost" icon="download" onClick={onDownloadHtml}>
          {t('code.downloadHtml')}
        </Button>
      </div>
      <div className="cdn-card">
        <span className="cdn-icon">
          <Icon name="cloud" size={20} />
        </span>
        <div>
          <p className="cdn-title">{t('code.cdnTitle')}</p>
          <p>{t('code.cdnBody')}</p>
        </div>
        <LinkButton variant="accent" size="sm" href={hrefFor({ name: 'account' })}>
          {t('code.cdnCta')}
        </LinkButton>
      </div>
    </div>
  );
}

export function StatusCard({ doc }: { doc: SchemaDoc }) {
  const { t, dateTime } = useI18n();
  const rows: [MessageKey, string, IconName][] = [
    ['status.storage', t('status.storageValue'), 'smartphone'],
    ['status.revision', `r${doc.revision}`, 'refresh'],
    ['status.updated', dateTime(doc.updatedAt), 'clock'],
    ['status.cloud', t('status.cloudValue'), 'cloud'],
    ['status.visibility', t('status.visibilityValue'), 'lock'],
  ];
  return (
    <section className="status-card" aria-labelledby="status-title">
      <h3 id="status-title" className="panel-title">
        <Icon name="info" size={16} />
        {t('status.title')}
      </h3>
      <dl>
        {rows.map(([label, value, icon]) => (
          <div key={label}>
            <dt>
              <Icon name={icon} size={14} />
              {t(label)}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <a className="link-btn" href={hrefFor({ name: 'account' })}>
        {t('status.cta')}
        <Icon name="arrow-right" size={14} />
      </a>
    </section>
  );
}
