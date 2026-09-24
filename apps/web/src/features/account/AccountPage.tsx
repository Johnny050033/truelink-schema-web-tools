import { TRUELINK_LINKS } from '../../config';
import { Icon, type IconName } from '../../components/Icon';
import { Chip, LinkButton } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';

interface Benefit {
  readonly id: 'deploy' | 'geo' | 'trust' | 'sync';
  readonly icon: IconName;
  readonly planned?: boolean;
}

const BENEFITS: readonly Benefit[] = [
  { id: 'deploy', icon: 'cloud' },
  { id: 'geo', icon: 'sparkline' },
  { id: 'trust', icon: 'shield' },
  { id: 'sync', icon: 'refresh', planned: true },
];

type Availability = 'yes' | 'no' | 'platform' | 'planned';

const COMPARISON: readonly (readonly [MessageKey, Availability, Availability])[] = [
  ['account.compare.edit', 'yes', 'yes'],
  ['account.compare.audit', 'yes', 'yes'],
  ['account.compare.brand', 'yes', 'yes'],
  ['account.compare.offline', 'yes', 'yes'],
  ['account.compare.deploy', 'no', 'platform'],
  ['account.compare.geo', 'no', 'platform'],
  ['account.compare.sync', 'no', 'planned'],
];

function AvailabilityCell({ value }: { value: Availability }) {
  const { t } = useI18n();
  if (value === 'yes')
    return (
      <span className="avail avail-yes">
        <Icon name="check-circle" size={18} />
        <span className="sr-only">{t('account.compare.yes')}</span>
      </span>
    );
  if (value === 'no')
    return (
      <span className="avail avail-no">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t('account.compare.no')}</span>
      </span>
    );
  if (value === 'planned') return <Chip tone="neutral">{t('account.planned')}</Chip>;
  return (
    <span className="avail avail-platform">
      <Icon name="check-circle" size={18} />
      <span>{t('account.compare.viaPlatform')}</span>
    </span>
  );
}

/**
 * The sign-up funnel. Registration happens on the TrueLink site: this page links
 * out (new tab, no data in the URL) and states plainly what is and is not built.
 */
export function AccountPage() {
  const { t, locale } = useI18n();
  return (
    <div className="account-page page-wide">
      <h1 className="sr-only">{t('account.title')}</h1>
      <section className="account-hero" aria-labelledby="account-hero-title">
        <div className="account-hero-copy">
          <p className="eyebrow eyebrow-gold">
            <Icon name="shield" size={16} />
            {t('account.hero.eyebrow')}
          </p>
          <h2 id="account-hero-title">{t('account.hero.title')}</h2>
          <p className="hero-sub">{t('account.hero.body')}</p>
          <div className="hero-ctas">
            <LinkButton variant="accent" size="lg" href={TRUELINK_LINKS.signup[locale]} external>
              {t('account.cta.register')}
            </LinkButton>
            <LinkButton variant="ghost" size="lg" href={TRUELINK_LINKS.webTool[locale]} external className="btn-on-dark">
              {t('account.cta.open')}
            </LinkButton>
          </div>
          <p className="account-leave">
            <Icon name="info" size={14} />
            {t('account.leaveNote')}
          </p>
        </div>
        <div className="account-status" aria-labelledby="account-status-title">
          <h3 id="account-status-title">{t('account.status.title')}</h3>
          <ul>
            <li>
              <Icon name="smartphone" size={18} />
              <span>{t('account.status.local')}</span>
            </li>
            <li>
              <Icon name="link" size={18} />
              <span>{t('account.status.linking')}</span>
            </li>
            <li>
              <Icon name="cloud" size={18} />
              <span>{t('account.status.sync')}</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="benefits-title">
        <h2 id="benefits-title" className="sr-only">
          {t('account.hero.title')}
        </h2>
        <div className="benefit-grid">
          {BENEFITS.map((benefit) => (
            <article key={benefit.id} className={`card benefit${benefit.planned ? ' benefit-planned' : ''}`}>
              <span className="benefit-icon">
                <Icon name={benefit.icon} size={22} />
              </span>
              <h3>
                {t(`account.benefit.${benefit.id}.title` as MessageKey)}
                {benefit.planned ? <Chip tone="neutral">{t('account.planned')}</Chip> : null}
              </h3>
              <p>{t(`account.benefit.${benefit.id}.body` as MessageKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card compare-card" aria-labelledby="compare-title">
        <h2 id="compare-title">{t('account.compare.title')}</h2>
        <div className="table-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">{t('account.compare.feature')}</th>
                <th scope="col">{t('account.compare.local')}</th>
                <th scope="col" className="compare-highlight">
                  {t('account.compare.account')}
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([label, local, account]) => (
                <tr key={label}>
                  <th scope="row">{t(label)}</th>
                  <td>
                    <AvailabilityCell value={local} />
                  </td>
                  <td className="compare-highlight">
                    <AvailabilityCell value={account} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="compare-cta">
          <LinkButton variant="accent" href={TRUELINK_LINKS.signup[locale]} external>
            {t('account.cta.register')}
          </LinkButton>
          <LinkButton variant="ghost" href={TRUELINK_LINKS.eeatGuide} external>
            {t('account.cta.guide')}
          </LinkButton>
        </div>
      </section>

      <section className="card privacy-card" aria-labelledby="privacy-title">
        <span className="card-icon">
          <Icon name="lock" size={20} />
        </span>
        <div>
          <h2 id="privacy-title">{t('account.privacy.title')}</h2>
          <p>{t('account.privacy.body')}</p>
        </div>
      </section>
    </div>
  );
}
