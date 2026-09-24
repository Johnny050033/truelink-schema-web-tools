import { useEffect, useRef } from 'react';
import { LOCALE_INFO, LOCALES, type Locale } from 'truelink-schema-document';
import { Icon } from '../../components/Icon';
import { ExternalLink } from '../../components/ui';
import { COMMUNITY_LINKS } from '../../config';
import { useI18n } from '../../i18n';
import { getStore, useAppState } from '../../lib/store';

/** Short names for the top bar button, written the way each language's readers expect. */
export const SHORT_NAMES: Readonly<Record<Locale, string>> = {
  en: 'EN',
  'zh-TW': '繁中',
  'zh-CN': '简中',
  ja: '日本語',
  es: 'ES',
  'pt-BR': 'PT',
  id: 'ID',
};

/** Every language in its own name; the ones still under native review carry a Beta tag. */
export function LanguageOptions({ onChoose }: { onChoose?: () => void }) {
  const { t, locale } = useI18n();
  const preferred = useAppState((state) => state.prefs.locale);
  const uiLang = LOCALE_INFO[locale].htmlLang;
  return (
    <>
      {LOCALES.map((code) => {
        const info = LOCALE_INFO[code];
        const active = code === preferred;
        return (
          <button
            key={code}
            type="button"
            className={`menu-item lang-option${active ? ' is-active' : ''}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => {
              onChoose?.();
              if (!active) getStore().setPreferences({ locale: code });
            }}
          >
            <span className="lang-name" lang={info.htmlLang}>
              {info.nativeName}
            </span>
            {info.status === 'beta' ? (
              <span className="chip lang-beta" lang={uiLang}>
                {t('language.beta')}
              </span>
            ) : null}
            <span className="lang-check" aria-hidden="true">
              {active ? <Icon name="check" size={16} /> : null}
            </span>
          </button>
        );
      })}
    </>
  );
}

export function LanguageNote() {
  const { t } = useI18n();
  return (
    <p className="lang-note">
      <span>{t('language.betaNote')}</span> <ExternalLink href={COMMUNITY_LINKS.translate}>{t('language.help')}</ExternalLink>
    </p>
  );
}

/** Top bar language picker (a disclosure, like the other menus); closes on outside click, Escape or choice. */
export function LanguageMenu() {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const details = ref.current;
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      const details = ref.current;
      if (event.key === 'Escape' && details?.open) {
        details.open = false;
        details.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const label = t('top.language', { language: LOCALE_INFO[locale].nativeName });
  return (
    <details className="menu menu-end lang-menu" ref={ref}>
      <summary className="lang-btn topbar-icon" aria-label={label} title={label}>
        <Icon name="languages" size={18} />
        <span className="lang-code" lang={LOCALE_INFO[locale].htmlLang} aria-hidden="true">
          {SHORT_NAMES[locale]}
        </span>
      </summary>
      <div className="menu-list lang-list">
        <LanguageOptions
          onChoose={() => {
            if (ref.current) ref.current.open = false;
          }}
        />
        <LanguageNote />
      </div>
    </details>
  );
}
