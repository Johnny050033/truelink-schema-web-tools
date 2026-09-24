import { TEMPLATES, type TemplateCategory } from 'truelink-schema-document';
import { LOCAL_LIMITS } from '../../config';
import { Notice } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { useAppState } from '../../lib/store';
import { TemplateCard } from './TemplateCard';

const CATEGORIES: readonly TemplateCategory[] = ['entity', 'offering', 'content', 'navigation', 'other'];

export function TemplatesPage() {
  const { t } = useI18n();
  const full = useAppState((state) => state.docs.length >= LOCAL_LIMITS.maxDocuments);
  return (
    <div className="page-wide">
      <header className="page-head">
        <h1>{t('templates.title')}</h1>
        <p>{t('templates.subtitle')}</p>
      </header>
      {full ? <Notice tone="warning">{t('templates.limit', { max: LOCAL_LIMITS.maxDocuments })}</Notice> : null}
      {CATEGORIES.map((category) => {
        const items = TEMPLATES.filter((template) => template.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="section" aria-labelledby={`cat-${category}`}>
            <h2 id={`cat-${category}`} className="section-title">
              {t(`templates.category.${category}` as MessageKey)}
            </h2>
            <div className="template-grid">
              {items.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
