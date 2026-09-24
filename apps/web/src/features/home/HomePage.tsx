import { useMemo } from 'react';
import { getTemplate, type TemplateId } from 'truelink-schema-document';
import { LOCAL_LIMITS } from '../../config';
import { Icon, StudioMark } from '../../components/Icon';
import { LinkButton, ScoreRing } from '../../components/ui';
import { useI18n } from '../../i18n';
import { auditFor, brandAudit, isBrandStarted } from '../../lib/docs';
import { hrefFor } from '../../lib/router';
import { useAppState } from '../../lib/store';
import { DocCard } from '../library/DocCard';
import { TemplateCard } from '../templates/TemplateCard';

const FEATURED: readonly TemplateId[] = ['organization', 'local-business', 'website', 'article', 'faq', 'product'];

function Hero() {
  const { t } = useI18n();
  return (
    <section className="hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <p className="eyebrow">
          <StudioMark size={22} />
          {t('home.eyebrow')}
        </p>
        <h1 id="home-title">{t('home.title')}</h1>
        <p className="hero-sub">{t('home.subtitle')}</p>
        <div className="hero-ctas">
          <LinkButton variant="accent" size="lg" href={hrefFor({ name: 'brand' })} iconEnd="arrow-right">
            {t('home.ctaPrimary')}
          </LinkButton>
          <LinkButton variant="ghost" size="lg" href={hrefFor({ name: 'templates' })} className="btn-on-dark">
            {t('home.ctaSecondary')}
          </LinkButton>
        </div>
        <ul className="hero-trust">
          <li>
            <Icon name="lock" size={16} />
            {t('home.trust.local')}
          </li>
          <li>
            <Icon name="smartphone" size={16} />
            {t('home.trust.offline')}
          </li>
          <li>
            <Icon name="code" size={16} />
            {t('home.trust.open')}
          </li>
        </ul>
      </div>
      <figure className="hero-sample" aria-label={t('home.sample.label')}>
        <figcaption>{t('home.sample.label')}</figcaption>
        <div className="sample-head">
          <span className="entity-avatar" aria-hidden="true">
            {[...t('home.sample.name')][0]}
          </span>
          <div>
            <p className="sample-name">{t('home.sample.name')}</p>
            <p className="sample-type">{t('home.sample.type')}</p>
          </div>
          <ScoreRing score={92} grade="excellent" size={56} label={t('home.sample.score')} />
        </div>
        <p className="sample-text">
          <Icon name="scan" size={16} />
          <span>{t('home.sample.text')}</span>
        </p>
        <pre className="sample-code" aria-hidden="true">
          <span className="tok-key">"@type"</span>
          <span className="tok-punct">: </span>
          <span className="tok-string">"CafeOrCoffeeShop"</span>
          {',\n'}
          <span className="tok-key">"openingHoursSpecification"</span>
          <span className="tok-punct">: [ … ]</span>
          {',\n'}
          <span className="tok-key">"sameAs"</span>
          <span className="tok-punct">: [ </span>
          <span className="tok-string">"https://instagram.com/…"</span>
          <span className="tok-punct"> ]</span>
        </pre>
      </figure>
    </section>
  );
}

function Welcome() {
  const { t } = useI18n();
  const docs = useAppState((state) => state.docs);
  const brand = useAppState((state) => state.brand);
  const average = docs.length > 0 ? Math.round(docs.reduce((sum, doc) => sum + auditFor(doc.templateId, doc.data).score, 0) / docs.length) : 0;
  const brandScore = isBrandStarted(brand) ? brandAudit(brand).score : 0;
  return (
    <section className="welcome" aria-labelledby="home-title">
      <div>
        <h1 id="home-title">{t('home.welcome')}</h1>
        <p>{t('home.welcomeBody')}</p>
      </div>
      <dl className="stats">
        <div>
          <dt>{t('home.stats.docs')}</dt>
          <dd>
            {docs.length}
            <small>/{LOCAL_LIMITS.maxDocuments}</small>
          </dd>
        </div>
        <div>
          <dt>{t('home.stats.average')}</dt>
          <dd>
            {average}
            <small>%</small>
          </dd>
        </div>
        <div>
          <dt>{t('home.stats.brand')}</dt>
          <dd>
            {brandScore}
            <small>%</small>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function BrandCard() {
  const { t, l } = useI18n();
  const brand = useAppState((state) => state.brand);
  if (!isBrandStarted(brand)) {
    return (
      <section className="card brand-card brand-card-empty" aria-labelledby="brand-card-title">
        <span className="brand-card-icon">
          <Icon name="target" size={26} />
        </span>
        <div className="brand-card-body">
          <h2 id="brand-card-title">{t('home.brand.emptyTitle')}</h2>
          <p>{t('home.brand.emptyBody')}</p>
        </div>
        <LinkButton variant="primary" href={hrefFor({ name: 'brand' })} iconEnd="arrow-right">
          {t('home.brand.cta')}
        </LinkButton>
      </section>
    );
  }
  const audit = brandAudit(brand);
  const name = typeof brand.data['name'] === 'string' ? brand.data['name'] : undefined;
  return (
    <section className="card brand-card" aria-labelledby="brand-card-title">
      <ScoreRing score={audit.score} grade={audit.grade} label={t('brand.completeness')} />
      <div className="brand-card-body">
        <p className="brand-card-kicker">{t('home.brand.title')}</p>
        <h2 id="brand-card-title">{name ?? t('brand.title')}</h2>
        {audit.missing.length > 0 ? (
          <>
            <p>{t('home.brand.gaps')}</p>
            <ul className="gap-list">
              {audit.missing.slice(0, 5).map((item) => (
                <li key={item.fieldId}>
                  <span className={`gap-chip gap-${item.importance}`}>{l(item.label)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="brand-card-complete">
            <Icon name="check-circle" size={16} />
            {t('home.brand.complete')}
          </p>
        )}
      </div>
      <LinkButton variant="secondary" href={hrefFor({ name: 'brand' })} iconEnd="arrow-right">
        {t('home.brand.continue')}
      </LinkButton>
    </section>
  );
}

export function PromoBand() {
  const { t } = useI18n();
  return (
    <section className="promo-band" aria-labelledby="promo-title">
      <div className="promo-copy">
        <p className="eyebrow eyebrow-gold">
          <Icon name="shield" size={16} />
          TrueLink · The AI Trust Engine
        </p>
        <h2 id="promo-title">{t('home.promo.title')}</h2>
        <p>{t('home.promo.body')}</p>
      </div>
      <LinkButton variant="accent" size="lg" href={hrefFor({ name: 'account' })} iconEnd="arrow-right">
        {t('home.promo.cta')}
      </LinkButton>
    </section>
  );
}

export function HomePage() {
  const { t } = useI18n();
  const docs = useAppState((state) => state.docs);
  const brand = useAppState((state) => state.brand);
  const returning = docs.length > 0 || isBrandStarted(brand);
  const recent = useMemo(() => [...docs].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4), [docs]);
  return (
    <div className="home">
      {returning ? <Welcome /> : <Hero />}
      <BrandCard />
      <section className="section" aria-labelledby="quick-title">
        <div className="section-head">
          <h2 id="quick-title">{t('home.templates.title')}</h2>
          <a className="link-btn" href={hrefFor({ name: 'templates' })}>
            {t('home.templates.all')}
            <Icon name="arrow-right" size={16} />
          </a>
        </div>
        <div className="template-grid template-grid-compact">
          {FEATURED.map((id) => (
            <TemplateCard key={id} template={getTemplate(id)} compact />
          ))}
        </div>
      </section>
      {docs.length > 0 ? (
        <section className="section" aria-labelledby="recent-title">
          <div className="section-head">
            <h2 id="recent-title">{t('home.recent.title')}</h2>
            <a className="link-btn" href={hrefFor({ name: 'library' })}>
              {t('home.recent.all')}
              <Icon name="arrow-right" size={16} />
            </a>
          </div>
          <div className="doc-grid">
            {recent.map((doc) => (
              <DocCard key={doc.id} doc={doc} />
            ))}
          </div>
        </section>
      ) : null}
      <PromoBand />
    </div>
  );
}
