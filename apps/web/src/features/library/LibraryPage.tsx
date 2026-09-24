import { useMemo, useState } from 'react';
import { getTemplate, type TemplateCategory } from 'truelink-schema-document';
import { LOCAL_LIMITS } from '../../config';
import { Icon } from '../../components/Icon';
import { EmptyState, LinkButton, Notice } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { docTitle } from '../../lib/docs';
import { hrefFor } from '../../lib/router';
import { useAppState } from '../../lib/store';
import { DocCard } from './DocCard';

type Filter = 'all' | TemplateCategory;
const FILTERS: readonly Filter[] = ['all', 'entity', 'offering', 'content', 'navigation', 'other'];

export function LibraryPage() {
  const { t, locale } = useI18n();
  const docs = useAppState((state) => state.docs);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const sorted = useMemo(() => [...docs].sort((a, b) => b.updatedAt - a.updatedAt), [docs]);
  const visible = sorted.filter((doc) => {
    if (filter !== 'all' && getTemplate(doc.templateId).category !== filter) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return docTitle(doc, locale).toLowerCase().includes(needle) || JSON.stringify(doc.data).toLowerCase().includes(needle);
  });
  const nearLimit = docs.length >= LOCAL_LIMITS.maxDocuments - 5;

  return (
    <div className="page-wide">
      <header className="page-head page-head-row">
        <div>
          <h1>{t('library.title')}</h1>
          <p>{t('library.subtitle', { count: docs.length, max: LOCAL_LIMITS.maxDocuments })}</p>
        </div>
        <div className="page-actions">
          <LinkButton variant="secondary" icon="upload" href={hrefFor({ name: 'transfer' })}>
            {t('library.import')}
          </LinkButton>
          <LinkButton variant="primary" icon="plus" href={hrefFor({ name: 'templates' })}>
            {t('library.new')}
          </LinkButton>
        </div>
      </header>

      {nearLimit ? (
        <Notice tone="gold" icon="cloud" action={<LinkButton size="sm" variant="accent" href={hrefFor({ name: 'account' })}>{t('library.nearLimitCta')}</LinkButton>}>
          {t('library.nearLimit', { count: docs.length, max: LOCAL_LIMITS.maxDocuments })}
        </Notice>
      ) : null}

      {docs.length === 0 ? (
        <EmptyState icon="layers" title={t('library.emptyTitle')} body={t('library.emptyBody')}>
          <LinkButton variant="primary" icon="plus" href={hrefFor({ name: 'templates' })}>
            {t('library.new')}
          </LinkButton>
          <LinkButton variant="secondary" icon="upload" href={hrefFor({ name: 'transfer' })}>
            {t('library.import')}
          </LinkButton>
        </EmptyState>
      ) : (
        <>
          <div className="library-tools">
            <label className="search-box">
              <Icon name="search" size={18} />
              <span className="sr-only">{t('library.search')}</span>
              <input type="search" className="input" placeholder={t('library.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="filter-chips" role="group" aria-label={t('library.filter')}>
              {FILTERS.map((item) => (
                <button key={item} type="button" className={`filter-chip${filter === item ? ' is-on' : ''}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                  {item === 'all' ? t('library.filterAll') : t(`templates.category.${item}` as MessageKey)}
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <p className="muted">{t('library.noMatch')}</p>
          ) : (
            <div className="doc-grid">
              {visible.map((doc) => (
                <DocCard key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
