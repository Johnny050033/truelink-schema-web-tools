import { lazy, Suspense, useEffect } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import { HomePage } from './features/home/HomePage';
import { LibraryPage } from './features/library/LibraryPage';
import { NudgeProvider } from './features/shell/Nudge';
import { Shell } from './features/shell/Shell';
import { TemplatesPage } from './features/templates/TemplatesPage';

// Heavier screens load on demand; the service worker precaches every chunk for offline use.
const EditorPage = lazy(() => import('./features/editor/EditorPage').then((module) => ({ default: module.EditorPage })));
const BrandPage = lazy(() => import('./features/brand/BrandPage').then((module) => ({ default: module.BrandPage })));
const TransferPage = lazy(() => import('./features/transfer/TransferPage').then((module) => ({ default: module.TransferPage })));
const AccountPage = lazy(() => import('./features/account/AccountPage').then((module) => ({ default: module.AccountPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
import { I18nProvider, translate, useI18n } from './i18n';
import type { ThemePreference } from './lib/persistence';
import { useRoute, type Route } from './lib/router';
import { installedSignal, useSignal } from './lib/signals';
import { useAppState } from './lib/store';

const THEME_COLORS = { light: '#0d2240', dark: '#070e19' } as const;

function useDocumentTheme(preference: ThemePreference): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
      document.documentElement.setAttribute('data-theme', theme);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
    };
    apply();
    if (preference !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'templates':
      return <TemplatesPage />;
    case 'library':
      return <LibraryPage />;
    case 'doc':
      return <EditorPage key={route.id} id={route.id} />;
    case 'brand':
      return <BrandPage />;
    case 'transfer':
      return <TransferPage />;
    case 'account':
      return <AccountPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <HomePage />;
  }
}

function InstalledToast() {
  const { t } = useI18n();
  const toast = useToast();
  const installed = useSignal(installedSignal);
  useEffect(() => {
    if (installed > 0) toast({ message: t('install.done'), tone: 'success', icon: 'smartphone' });
  }, [installed, t, toast]);
  return null;
}

export function App() {
  const locale = useAppState((state) => state.prefs.locale);
  const theme = useAppState((state) => state.prefs.theme);
  const route = useRoute();
  useDocumentTheme(theme);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh-TW' ? 'zh-Hant-TW' : 'en';
    document.title = `${translate(locale, 'app.name')} · TrueLink — ${translate(locale, 'app.tagline')}`;
  }, [locale]);

  return (
    <I18nProvider locale={locale}>
      <ToastProvider>
        <NudgeProvider>
          <InstalledToast />
          <Shell route={route}>
            <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
              <Page route={route} />
            </Suspense>
          </Shell>
        </NudgeProvider>
      </ToastProvider>
    </I18nProvider>
  );
}
