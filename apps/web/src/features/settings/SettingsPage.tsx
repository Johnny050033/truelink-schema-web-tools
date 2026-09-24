import { useState } from 'react';
import { LOCALE_INFO, LOCALES, utf8Bytes } from 'truelink-schema-document';
import { APP_VERSION, COMMUNITY_LINKS, LOCAL_LIMITS, TRUELINK_LINKS } from '../../config';
import { Icon, type IconName } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, Dialog, ExternalLink, LinkButton, Notice, ProgressBar } from '../../components/ui';
import { useI18n } from '../../i18n';
import type { ThemePreference } from '../../lib/persistence';
import { promptInstall, useInstallState } from '../../lib/pwa';
import { hrefFor } from '../../lib/router';
import { getStore, useAppState } from '../../lib/store';
import { LanguageNote } from '../shell/LanguageMenu';

const THEMES: readonly [ThemePreference, IconName][] = [
  ['system', 'monitor'],
  ['light', 'sun'],
  ['dark', 'moon'],
];

export function SettingsPage() {
  const { t, bytes } = useI18n();
  const toast = useToast();
  const prefs = useAppState((state) => state.prefs);
  const docs = useAppState((state) => state.docs);
  const brand = useAppState((state) => state.brand);
  const install = useInstallState();
  const [confirmClear, setConfirmClear] = useState(false);
  const store = getStore();
  const used = utf8Bytes(JSON.stringify(docs)) + utf8Bytes(JSON.stringify(brand)) + utf8Bytes(JSON.stringify(prefs));

  return (
    <div className="page-narrow settings-page">
      <header className="page-head">
        <h1>{t('settings.title')}</h1>
      </header>

      <section className="card settings-card" aria-labelledby="appearance-title">
        <h2 id="appearance-title">{t('settings.appearance')}</h2>
        <div className="choice-row" role="radiogroup" aria-labelledby="appearance-title">
          {THEMES.map(([value, icon]) => (
            <label key={value} className={`choice${prefs.theme === value ? ' is-on' : ''}`}>
              <input type="radio" name="theme" value={value} checked={prefs.theme === value} onChange={() => store.setPreferences({ theme: value })} />
              <Icon name={icon} size={18} />
              <span>{t(`theme.${value}`)}</span>
            </label>
          ))}
        </div>
        <h2 id="language-title">{t('settings.language')}</h2>
        <div className="choice-row" role="radiogroup" aria-labelledby="language-title">
          {LOCALES.map((value) => {
            const info = LOCALE_INFO[value];
            return (
              <label key={value} className={`choice${prefs.locale === value ? ' is-on' : ''}`}>
                <input type="radio" name="locale" value={value} checked={prefs.locale === value} onChange={() => store.setPreferences({ locale: value })} />
                <Icon name="languages" size={18} />
                <span lang={info.htmlLang}>{info.nativeName}</span>
                {info.status === 'beta' ? <span className="chip lang-beta">{t('language.beta')}</span> : null}
              </label>
            );
          })}
        </div>
        <LanguageNote />
      </section>

      <section className="card settings-card" aria-labelledby="install-title">
        <h2 id="install-title">{t('settings.install.title')}</h2>
        <p>{t('settings.install.body')}</p>
        {install.standalone || install.installed ? (
          <Notice tone="success">{t('settings.install.installed')}</Notice>
        ) : install.canPrompt ? (
          <Button variant="primary" icon="smartphone" onClick={() => void promptInstall()}>
            {t('settings.install.button')}
          </Button>
        ) : install.ios ? (
          <Notice tone="info" icon="smartphone">
            {t('settings.install.ios')}
          </Notice>
        ) : (
          <Notice tone="info">{t('settings.install.unavailable')}</Notice>
        )}
      </section>

      <section className="card settings-card" aria-labelledby="storage-title">
        <h2 id="storage-title">{t('settings.storage.title')}</h2>
        <p>{t('settings.storage.body')}</p>
        <div className="usage">
          <div className="usage-row">
            <span>{t('settings.storage.usage', { used: bytes(used), max: bytes(LOCAL_LIMITS.maxTotalBytes) })}</span>
            <span>{t('settings.storage.docs', { count: docs.length, max: LOCAL_LIMITS.maxDocuments })}</span>
          </div>
          <ProgressBar value={(used / LOCAL_LIMITS.maxTotalBytes) * 100} tone={used / LOCAL_LIMITS.maxTotalBytes > 0.8 ? 'amber' : 'blue'} label={t('settings.storage.title')} />
        </div>
        <div className="row-actions">
          <LinkButton variant="secondary" icon="download" href={hrefFor({ name: 'transfer' })}>
            {t('settings.storage.backup')}
          </LinkButton>
          <Button variant="danger" icon="trash" onClick={() => setConfirmClear(true)}>
            {t('settings.storage.clear')}
          </Button>
        </div>
      </section>

      <section className="card settings-card" aria-labelledby="about-title">
        <h2 id="about-title">{t('settings.about.title')}</h2>
        <p>{t('settings.about.body')}</p>
        <p className="about-meta">
          <span>{t('settings.about.version', { version: APP_VERSION })}</span>
          <ExternalLink href={TRUELINK_LINKS.source}>{t('settings.about.source')}</ExternalLink>
        </p>
      </section>

      <section className="card settings-card" aria-labelledby="feedback-title">
        <h2 id="feedback-title">{t('settings.feedback.title')}</h2>
        <p>{t('settings.feedback.body')}</p>
        <ul className="feedback-links">
          <li>
            <Icon name="alert-circle" size={18} />
            <ExternalLink href={COMMUNITY_LINKS.bug}>{t('feedback.bug')}</ExternalLink>
          </li>
          <li>
            <Icon name="layers" size={18} />
            <ExternalLink href={COMMUNITY_LINKS.idea}>{t('feedback.idea')}</ExternalLink>
          </li>
          <li>
            <Icon name="languages" size={18} />
            <ExternalLink href={COMMUNITY_LINKS.translate}>{t('language.help')}</ExternalLink>
          </li>
          <li>
            <Icon name="star" size={18} />
            <ExternalLink href={COMMUNITY_LINKS.star}>{t('feedback.star')}</ExternalLink>
          </li>
        </ul>
      </section>

      <Dialog
        open={confirmClear}
        tone="danger"
        title={t('settings.storage.clearTitle')}
        onClose={() => setConfirmClear(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                store.clearAll();
                setConfirmClear(false);
                toast({ message: t('settings.storage.cleared'), tone: 'success' });
              }}
            >
              {t('settings.storage.clear')}
            </Button>
          </>
        }
      >
        <p>{t('settings.storage.clearBody')}</p>
      </Dialog>
    </div>
  );
}
