import { useMemo } from 'react';
import {
  buildOutput,
  describeDocument,
  displayName,
  domainOf,
  formatAddress,
  formatWallClock,
  getAt,
  isJsonObject,
  listAt,
  summarizeHours,
  templateFields,
  textOf,
  typeLabel,
  type AuditResult,
  type JsonObject,
  type Locale,
  type ScalarField,
  type SchemaTemplate,
} from 'truelink-schema-document';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';

function joinSentences(sentences: readonly string[], locale: Locale): string {
  return sentences.join(locale === 'zh-TW' ? '' : ' ');
}

function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
}

export function initialsOf(name: string | undefined): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(trimmed)) return [...trimmed][0] ?? '?';
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => [...word][0]?.toUpperCase() ?? '').join('') || '?';
}

export function AiDescription({ template, data, audit, onGap, compact }: { template: SchemaTemplate; data: JsonObject; audit: AuditResult; onGap?: (fieldId: string) => void; compact?: boolean }) {
  const { t, locale, l } = useI18n();
  const description = useMemo(() => describeDocument(template, data, locale), [template, data, locale]);
  const gaps = audit.missing.slice(0, compact ? 4 : 6);
  // FAQ and breadcrumb readings describe their items, so they need no entity name.
  const hasContent = description.sentences.length > 0 && (description.name !== undefined || template.id === 'faq' || template.id === 'breadcrumb');
  return (
    <section className="ai-card" aria-labelledby="ai-card-title">
      <header className="ai-card-head">
        <span className="ai-card-icon">
          <Icon name="scan" size={18} />
        </span>
        <h3 id="ai-card-title">{t('preview.ai.title')}</h3>
      </header>
      {hasContent ? <p className="ai-text">{joinSentences(description.sentences, locale)}</p> : <p className="ai-empty">{t('preview.ai.empty')}</p>}
      {!compact && description.summary ? (
        <figure className="ai-quote">
          <figcaption>{t('preview.ai.summary')}</figcaption>
          <blockquote>{truncate(description.summary, 280)}</blockquote>
        </figure>
      ) : null}
      {gaps.length > 0 ? (
        <div className="ai-gaps">
          <p>{t('preview.ai.gaps')}</p>
          <ul>
            {gaps.map((gap) => (
              <li key={gap.fieldId}>
                {onGap ? (
                  <button type="button" className={`gap-chip gap-${gap.importance}`} onClick={() => onGap(gap.fieldId)}>
                    <Icon name="plus" size={14} />
                    {l(gap.label)}
                  </button>
                ) : (
                  <span className={`gap-chip gap-${gap.importance}`}>{l(gap.label)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="ai-note">
        <Icon name="info" size={14} />
        {t('preview.ai.note')}
      </p>
    </section>
  );
}

function priceText(price: string | undefined, currency: string | undefined, locale: Locale): string | undefined {
  if (!price) return undefined;
  if (currency && /^[A-Z]{3}$/.test(currency) && /^\d+(\.\d+)?$/.test(price)) {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(price));
    } catch {
      /* fall through */
    }
  }
  return [currency, price].filter(Boolean).join(' ');
}

function optionLabel(template: SchemaTemplate, fieldId: string, value: string | undefined, locale: Locale): string | undefined {
  if (!value) return undefined;
  const field = templateFields(template).map((entry) => entry.field).find((item): item is ScalarField => item.id === fieldId && item.kind !== 'list');
  return field?.options?.find((option) => option.value === value)?.label[locale] ?? value;
}

export function SearchPreview({ template, data }: { template: SchemaTemplate; data: JsonObject }) {
  const { t, locale, l } = useI18n();
  const node = useMemo(() => buildOutput(data, template), [data, template]);
  const text = (...path: string[]) => textOf(getAt(node, path));
  const pageUrl = text('url') ?? text('mainEntityOfPage') ?? text('offers', 'url');
  const domain = domainOf(pageUrl) ?? 'example.com';
  const title = displayName(template, node) ?? t('common.untitled', { type: l(template.name) });

  let crumbs: string[] = [];
  if (template.id === 'breadcrumb') {
    crumbs = listAt(node, ['itemListElement']).filter(isJsonObject).map((item) => textOf(item['name']) ?? '').filter(Boolean).slice(1);
  } else if (pageUrl) {
    try {
      crumbs = new URL(pageUrl).pathname.split('/').filter(Boolean).slice(0, 3).map((part) => decodeURIComponent(part));
    } catch {
      crumbs = [];
    }
  }

  const questions = template.id === 'faq' ? listAt(node, ['mainEntity']).filter(isJsonObject) : [];
  const firstAnswer = questions.length > 0 ? textOf(getAt(questions[0]!, ['acceptedAnswer', 'text'])) : undefined;
  const snippet = text('description') ?? firstAnswer;

  const meta: string[] = [];
  if (template.id === 'article') {
    const date = text('datePublished');
    if (date) meta.push(formatWallClock(date, locale).split(' ')[0]!);
    const author = text('author', 'name');
    if (author) meta.push(author);
  }
  if (template.id === 'person') {
    const job = text('jobTitle');
    const employer = text('worksFor', 'name');
    if (job || employer) meta.push([job, employer].filter(Boolean).join(' · '));
  }

  return (
    <section className="serp-card" aria-labelledby="serp-title">
      <h3 id="serp-title" className="panel-title">
        <Icon name="search" size={16} />
        {t('preview.search.title')}
      </h3>
      <div className="serp">
        <div className="serp-site">
          <span className="serp-favicon" aria-hidden="true">
            {initialsOf(domain)}
          </span>
          <span className="serp-site-text">
            <span className="serp-domain">{domain}</span>
            <span className="serp-crumbs">{[`https://${domain}`, ...crumbs].join(' › ')}</span>
          </span>
        </div>
        <p className="serp-title">{truncate(title, 70)}</p>
        {meta.length > 0 ? <p className="serp-meta">{meta.join(' — ')}</p> : null}
        {snippet ? <p className="serp-snippet">{truncate(snippet, 158)}</p> : null}
        {template.id === 'product' && (text('offers', 'price') || text('offers', 'availability')) ? (
          <p className="serp-rich">
            {[priceText(text('offers', 'price'), text('offers', 'priceCurrency'), locale), optionLabel(template, 'offers.availability', text('offers', 'availability'), locale)].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        {template.id === 'event' && text('startDate') ? (
          <div className="serp-event">
            <span className="serp-event-date">{formatWallClock(text('startDate')!, locale)}</span>
            <span>{text('location', 'name') ?? formatAddress(node, ['location', 'address'], locale, false) ?? ''}</span>
          </div>
        ) : null}
        {template.id === 'local-business' ? (
          <div className="serp-local">
            {formatAddress(node, ['address'], locale) ? (
              <span>
                <Icon name="map-pin" size={14} />
                {formatAddress(node, ['address'], locale)}
              </span>
            ) : null}
            {summarizeHours(node, locale) ? (
              <span>
                <Icon name="clock" size={14} />
                {summarizeHours(node, locale)}
              </span>
            ) : null}
            {text('telephone') ? (
              <span>
                <Icon name="phone" size={14} />
                {text('telephone')}
              </span>
            ) : null}
          </div>
        ) : null}
        {questions.length > 0 ? (
          <ul className="serp-faq">
            {questions.slice(0, 3).map((question, index) => (
              <li key={index}>
                <span>{truncate(textOf(question['name']) ?? '…', 80)}</span>
                <Icon name="chevron-down" size={16} />
              </li>
            ))}
            {questions.length > 3 ? <li className="serp-faq-more">{t('preview.faq.more', { count: questions.length - 3 })}</li> : null}
          </ul>
        ) : null}
      </div>
      <p className="panel-note">{t('preview.search.note')}</p>
    </section>
  );
}

export function EntityCard({ template, data }: { template: SchemaTemplate; data: JsonObject }) {
  const { t, locale } = useI18n();
  const description = useMemo(() => describeDocument(template, data, locale), [template, data, locale]);
  const label = typeLabel(template, data, locale);
  return (
    <section className="entity-card" aria-labelledby="entity-title">
      <h3 className="panel-title">
        <Icon name="shield" size={16} />
        {t('preview.entity.title')}
      </h3>
      <div className="entity-head">
        <span className="entity-avatar" aria-hidden="true" title={t('preview.noImage')}>
          {initialsOf(description.name)}
        </span>
        <div>
          <p id="entity-title" className="entity-name">
            {description.name ?? t('common.untitled', { type: label })}
          </p>
          <p className="entity-type">{label}</p>
        </div>
      </div>
      {description.summary ? <p className="entity-summary">{truncate(description.summary, 220)}</p> : null}
      {description.facts.length > 0 ? (
        <dl className="entity-facts">
          {description.facts.slice(0, 8).map((fact) => (
            <div key={fact.fieldId}>
              <dt>{fact.label.replace(/\s*[（(][^）)]*[）)]\s*/g, '')}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {description.profiles.length > 0 ? (
        <div className="entity-profiles">
          <p>{t('preview.entity.profiles')}</p>
          <ul>
            {description.profiles.map((profile) => (
              <li key={profile.url} className="profile-chip" title={profile.url}>
                <Icon name="link" size={14} />
                {profile.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export const ENTITY_TEMPLATES = new Set(['organization', 'local-business', 'person', 'website', 'service']);
