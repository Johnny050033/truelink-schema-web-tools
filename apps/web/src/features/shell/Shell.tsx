import { useEffect, useRef, type ReactNode } from 'react';
import { BRAND_LOGO_URL } from '../../config';
import { Icon, StudioMark, type IconName } from '../../components/Icon';
import { Button, LinkButton, Notice } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { downloadBackup, isBrandStarted, brandAudit } from '../../lib/docs';
import { promptInstall, useInstallState, useOnline } from '../../lib/pwa';
import { hrefFor, type Route } from '../../lib/router';
import { updateSignal, useSignal } from '../../lib/signals';
import { getStore, useAppState } from '../../lib/store';
import type { ThemePreference } from '../../lib/persistence';

interface NavItem {
  readonly route: Route;
  readonly label: MessageKey;
  readonly icon: IconName;
}

const NAV: readonly NavItem[] = [
  { route: { name: 'home' }, label: 'nav.home', icon: 'home' },
  { route: { name: 'library' }, label: 'nav.library', icon: 'layers' },
  { route: { name: 'brand' }, label: 'nav.brand', icon: 'target' },
  { route: { name: 'transfer' }, label: 'nav.transfer', icon: 'upload' },
  { route: { name: 'account' }, label: 'nav.account', icon: 'cloud' },
  { route: { name: 'settings' }, label: 'nav.settings', icon: 'settings' },
];

function isActive(item: Route, current: Route): boolean {
  if (item.name === current.name) return true;
  return item.name === 'library' && (current.name === 'doc' || current.name === 'templates');
}

function BrandLockup({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <a className={`brand-lockup${compact ? ' brand-lockup-compact' : ''}`} href={hrefFor({ name: 'home' })}>
      <StudioMark size={compact ? 30 : 34} />
      <span className="brand-text">
        {BRAND_LOGO_URL ? <img src={BRAND_LOGO_URL} alt="TrueLink" className="brand-logo" /> : <strong>TrueLink</strong>}
        <span>{t('app.name')}</span>
      </span>
    </a>
  );
}

function Sidebar({ route }: { route: Route }) {
  const { t } = useI18n();
  const docCount = useAppState((state) => state.docs.length);
  const brand = useAppState((state) => state.brand);
  const brandScore = isBrandStarted(brand) ? brandAudit(brand).score : undefined;
  return (
    <aside className="sidebar">
      <BrandLockup />
      <LinkButton variant="accent" icon="plus" block href={hrefFor({ name: 'templates' })} className="sidebar-create">
        {t('nav.createSchema')}
      </LinkButton>
      <nav aria-label={t('nav.label')} className="sidebar-nav">
        <ul>
          {NAV.map((item) => (
            <li key={item.route.name}>
              <a href={hrefFor(item.route)} aria-current={isActive(item.route, route) ? 'page' : undefined} className="nav-link">
                <Icon name={item.icon} size={20} />
                <span className="nav-label">{t(item.label)}</span>
                {item.route.name === 'library' && docCount > 0 ? <span className="nav-badge">{docCount}</span> : null}
                {item.route.name === 'brand' && brandScore !== undefined ? <span className="nav-badge nav-badge-gold">{brandScore}%</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-foot">
        <div className="sidebar-promo">
          <p className="sidebar-promo-title">
            <Icon name="shield" size={18} />
            {t('nav.promo.title')}
          </p>
          <p>{t('nav.promo.body')}</p>
          <a href={hrefFor({ name: 'account' })} className="sidebar-promo-link">
            {t('nav.promo.cta')}
            <Icon name="arrow-right" size={16} />
          </a>
        </div>
        <p className="sidebar-local">
          <Icon name="lock" size={14} />
          {t('nav.localMode')}
        </p>
      </div>
    </aside>
  );
}

const THEME_ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];
const THEME_ICON: Record<ThemePreference, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

function TopBar({ route }: { route: Route }) {
  const { t, locale } = useI18n();
  const theme = useAppState((state) => state.prefs.theme);
  const online = useOnline();
  const install = useInstallState();
  const current: NavItem | undefined = route.name === 'templates' ? { route, label: 'nav.createSchema', icon: 'plus' } : NAV.find((item) => isActive(item.route, route));
  const store = getStore();
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]!;
  return (
    <header className="topbar">
      <div className="topbar-start">
        <div className="topbar-mobile-brand">
          <BrandLockup compact />
        </div>
        {current ? (
          <p className="topbar-section">
            <Icon name={current.icon} size={18} />
            {t(current.label)}
          </p>
        ) : null}
      </div>
      <div className="topbar-actions">
        {!online ? (
          <span className="offline-chip" role="status">
            <Icon name="wifi-off" size={16} />
            <span className="offline-text">{t('top.offline')}</span>
          </span>
        ) : null}
        {install.canPrompt && !install.standalone ? (
          <Button variant="quiet" size="sm" icon="smartphone" className="topbar-install" onClick={() => void promptInstall()}>
            {t('top.install')}
          </Button>
        ) : null}
        <button
          type="button"
          className="icon-btn icon-btn-md topbar-icon"
          aria-label={t('top.theme', { mode: t(`theme.${theme}`) })}
          title={t('top.theme', { mode: t(`theme.${theme}`) })}
          onClick={() => store.setPreferences({ theme: nextTheme })}
        >
          <Icon name={THEME_ICON[theme]} size={20} />
        </button>
        <button
          type="button"
          className="lang-btn topbar-icon"
          aria-label={t('top.language')}
          title={t('top.language')}
          lang={locale === 'zh-TW' ? 'en' : 'zh-Hant-TW'}
          onClick={() => store.setPreferences({ locale: locale === 'zh-TW' ? 'en' : 'zh-TW' })}
        >
          {t('top.languageShort')}
        </button>
        <LinkButton variant="accent" size="sm" href={hrefFor({ name: 'account' })} className="topbar-join" icon="shield">
          {t('top.join')}
        </LinkButton>
      </div>
    </header>
  );
}

function BottomNav({ route }: { route: Route }) {
  const { t } = useI18n();
  const items: readonly (NavItem & { primary?: boolean })[] = [
    NAV[0]!,
    NAV[1]!,
    { route: { name: 'templates' }, label: 'nav.create', icon: 'plus', primary: true },
    NAV[2]!,
    NAV[4]!,
  ];
  return (
    <nav className="bottom-nav" aria-label={t('nav.label')}>
      {items.map((item) => {
        const active = item.primary ? route.name === 'templates' : isActive(item.route, route) && !(item.route.name === 'library' && route.name === 'templates');
        return (
          <a key={item.route.name} href={hrefFor(item.route)} className={`bottom-link${item.primary ? ' bottom-link-primary' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="bottom-icon">
              <Icon name={item.icon} size={item.primary ? 24 : 22} />
            </span>
            <span className="bottom-label">{t(item.label)}</span>
          </a>
        );
      })}
    </nav>
  );
}

function StorageNotices() {
  const { t } = useI18n();
  const storage = useAppState((state) => state.storage);
  const docs = useAppState((state) => state.docs);
  const brand = useAppState((state) => state.brand);
  const update = useSignal(updateSignal);
  const backup = (
    <Button size="sm" variant="secondary" icon="download" onClick={() => downloadBackup(docs, brand)}>
      {t('storage.backup')}
    </Button>
  );
  return (
    <div className="shell-notices">
      {update ? (
        <Notice tone="gold" icon="refresh" action={<Button size="sm" variant="accent" onClick={update}>{t('update.reload')}</Button>}>
          {t('update.ready')}
        </Notice>
      ) : null}
      {!storage.available ? <Notice tone="warning">{t('storage.unavailable')}</Notice> : null}
      {storage.problem === 'quota' ? <Notice tone="danger" action={backup}>{t('storage.quota')}</Notice> : null}
      {storage.problem === 'limit' ? <Notice tone="danger" action={backup}>{t('storage.limit')}</Notice> : null}
      {storage.problem === 'document-too-large' ? <Notice tone="danger">{t('storage.documentTooLarge')}</Notice> : null}
      {storage.recovered ? (
        <Notice tone="warning" action={<Button size="sm" variant="ghost" onClick={() => getStore().dismissRecovered()}>{t('common.close')}</Button>}>
          {t('storage.recovered')}
        </Notice>
      ) : null}
    </div>
  );
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { t } = useI18n();
  const mainRef = useRef<HTMLElement>(null);
  const routeKey = route.name === 'doc' ? `doc:${route.id}` : route.name;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, [routeKey]);

  return (
    <div className="shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        {t('nav.skip')}
      </a>
      <Sidebar route={route} />
      <div className="shell-body">
        <TopBar route={route} />
        <StorageNotices />
        <main id="main" ref={mainRef} tabIndex={-1} className={`page page-${route.name}`}>
          {children}
        </main>
      </div>
      <BottomNav route={route} />
    </div>
  );
}
