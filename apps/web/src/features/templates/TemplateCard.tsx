import type { SchemaTemplate } from 'truelink-schema-document';
import { LOCAL_LIMITS } from '../../config';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useI18n } from '../../i18n';
import { isBrandStarted } from '../../lib/docs';
import { navigate } from '../../lib/router';
import { getStore, useAppState } from '../../lib/store';

export function useCreateDocument(): (template: SchemaTemplate) => void {
  const { t } = useI18n();
  const toast = useToast();
  return (template) => {
    const doc = getStore().createDocument(template.id);
    if (doc) navigate({ name: 'doc', id: doc.id });
    else toast({ message: t('templates.limit', { max: LOCAL_LIMITS.maxDocuments }), tone: 'danger' });
  };
}

export function TemplateCard({ template, compact }: { template: SchemaTemplate; compact?: boolean }) {
  const { t, l } = useI18n();
  const create = useCreateDocument();
  const brand = useAppState((state) => state.brand);
  const prefilled = isBrandStarted(brand) && (template.id === 'organization' || (template.brandFill?.length ?? 0) > 0 || template.id === 'breadcrumb');
  return (
    <button type="button" className={`template-card${compact ? ' template-card-compact' : ''}`} onClick={() => create(template)}>
      <span className={`template-icon cat-${template.category}`} aria-hidden="true">
        <Icon name={template.icon} size={22} />
      </span>
      <span className="template-text">
        <span className="template-name">{l(template.name)}</span>
        <span className="template-summary">{l(template.summary)}</span>
        {!compact && (template.richResult || prefilled) ? (
          <span className="template-tags">
            {template.richResult ? (
              <span className="chip chip-green">
                <Icon name="search" size={12} />
                {l(template.richResult)}
              </span>
            ) : null}
            {prefilled ? (
              <span className="chip chip-gold">
                <Icon name="target" size={12} />
                {t('templates.brandFill')}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <span className="template-go" aria-hidden="true">
        <Icon name="arrow-right" size={18} />
      </span>
    </button>
  );
}
