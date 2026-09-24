import { useI18n } from '../i18n';
import shieldUrl from '../assets/brand/shield.svg';

/**
 * The official TrueLink shield, copied unmodified from the TrueLink brand library
 * (00-master/shield.svg). Dark surfaces get the official reversed variant: shield-mono.svg
 * as a mask filled with the text colour, the same technique as the TrueLink site navbar.
 * "reverse" forces the reversed shield, e.g. on the navy hero.
 */
export function BrandShield({ size, tone = 'auto' }: { size: number; tone?: 'auto' | 'reverse' }) {
  return (
    <span className={`brand-shield${tone === 'reverse' ? ' brand-shield-reverse' : ''}`} style={{ height: size }} aria-hidden="true">
      <img src={shieldUrl} alt="" width={880} height={941} className="brand-shield-color" draggable={false} />
      <span className="brand-shield-rev" />
    </span>
  );
}

/** Shield plus the "TrueLink" wordmark as used by the site navbar, followed by the product name. */
export function BrandLockup({ href, compact }: { href: string; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <a className={`brand-lockup${compact ? ' brand-lockup-compact' : ''}`} href={href} aria-label={t('brand.homeAria')}>
      <BrandShield size={compact ? 32 : 38} />
      <span className="brand-text" aria-hidden="true">
        <span className="brand-wordmark">
          True<span>Link</span>
        </span>
        <span className="brand-product">{t('app.name')}</span>
      </span>
    </a>
  );
}
