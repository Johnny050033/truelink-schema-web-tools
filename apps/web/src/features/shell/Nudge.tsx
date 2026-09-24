import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { NUDGE_COOLDOWN_MS } from '../../config';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/ui';
import { useI18n } from '../../i18n';
import { navigate, useRoute } from '../../lib/router';
import { getStore } from '../../lib/store';

type NudgeKind = 'export';

interface NudgeApi {
  /** Records an export and, at meaningful moments, suggests TrueLink hosting. */
  readonly afterExport: () => void;
}

const NudgeContext = createContext<NudgeApi>({ afterExport: () => undefined });

/**
 * Sign-up suggestions appear only after the user got value (e.g. copied code),
 * at most on the 1st and every 5th export, and never within the cool-down after
 * a dismissal. They are dismissible and never block work.
 */
export function NudgeProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const route = useRoute();
  const [active, setActive] = useState<NudgeKind | null>(null);

  const afterExport = useCallback(() => {
    const store = getStore();
    const count = store.recordExport();
    const { nudgeDismissedAt } = store.getState().prefs;
    if ((count === 1 || count % 5 === 0) && Date.now() - nudgeDismissedAt > NUDGE_COOLDOWN_MS) setActive('export');
  }, []);

  const dismiss = useCallback(() => {
    getStore().setPreferences({ nudgeDismissedAt: Date.now() });
    setActive(null);
  }, []);

  const value = useMemo(() => ({ afterExport }), [afterExport]);

  return (
    <NudgeContext.Provider value={value}>
      {children}
      {active && route.name !== 'account' ? (
        <aside className="nudge" aria-labelledby="nudge-title">
          <span className="nudge-icon">
            <Icon name="cloud" size={20} />
          </span>
          <div className="nudge-body">
            <h2 id="nudge-title">{t('nudge.export.title')}</h2>
            <p>{t('nudge.export.body')}</p>
            <div className="nudge-actions">
              <Button
                variant="accent"
                size="sm"
                onClick={() => {
                  dismiss();
                  navigate({ name: 'account' });
                }}
              >
                {t('nudge.cta')}
              </Button>
              <Button variant="ghost" size="sm" onClick={dismiss}>
                {t('nudge.later')}
              </Button>
            </div>
          </div>
          <button type="button" className="nudge-close" aria-label={t('common.close')} onClick={dismiss}>
            <Icon name="x" size={16} />
          </button>
        </aside>
      ) : null}
    </NudgeContext.Provider>
  );
}

export function useNudge(): NudgeApi {
  return useContext(NudgeContext);
}
