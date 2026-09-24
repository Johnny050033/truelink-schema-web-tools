import { getTemplate, typeLabel } from 'truelink-schema-document';
import { Icon } from '../../components/Icon';
import { gradeTone, ProgressBar } from '../../components/ui';
import { useI18n } from '../../i18n';
import { auditFor, docTitle } from '../../lib/docs';
import type { SchemaDoc } from '../../lib/persistence';
import { hrefFor } from '../../lib/router';

export function DocCard({ doc }: { doc: SchemaDoc }) {
  const { t, locale, relativeTime } = useI18n();
  const template = getTemplate(doc.templateId);
  const audit = auditFor(doc.templateId, doc.data);
  const title = docTitle(doc, locale);
  return (
    <a className="doc-card" href={hrefFor({ name: 'doc', id: doc.id })}>
      <span className={`template-icon cat-${template.category}`} aria-hidden="true">
        <Icon name={template.icon} size={20} />
      </span>
      <span className="doc-card-body">
        <span className="doc-card-title">{title}</span>
        <span className="doc-card-meta">
          {typeLabel(template, doc.data, locale)} · {t('library.updated', { time: relativeTime(doc.updatedAt) })}
        </span>
        <span className="doc-card-score">
          <ProgressBar value={audit.score} tone={gradeTone(audit.grade)} label={`${t('audit.title')} ${audit.score}%`} />
          <span className={`doc-card-percent tone-text-${gradeTone(audit.grade)}`}>{audit.score}%</span>
        </span>
      </span>
      {audit.errors > 0 ? (
        <span className="doc-card-flag" title={t('audit.counts', { errors: audit.errors, warnings: audit.warnings, infos: audit.infos })}>
          <Icon name="alert-circle" size={16} />
          <span className="sr-only">{t('audit.counts', { errors: audit.errors, warnings: audit.warnings, infos: audit.infos })}</span>
        </span>
      ) : null}
    </a>
  );
}
