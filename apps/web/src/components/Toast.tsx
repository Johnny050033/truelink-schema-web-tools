import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Icon, type IconName } from './Icon';

export interface ToastOptions {
  readonly message: string;
  readonly tone?: 'default' | 'success' | 'danger';
  readonly icon?: IconName;
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly durationMs?: number;
}

interface ToastItem extends ToastOptions {
  readonly id: number;
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const show = useCallback(
    (options: ToastOptions) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-2), { ...options, id }]);
      const duration = options.durationMs ?? (options.action ? 8000 : 4000);
      if (duration > 0) window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone ?? 'default'}`}>
            <Icon name={item.icon ?? (item.tone === 'danger' ? 'alert-circle' : 'check-circle')} size={18} />
            <span className="toast-message">{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            ) : null}
            <button type="button" className="toast-close" aria-label={t('common.close')} onClick={() => dismiss(item.id)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (options: ToastOptions) => void {
  return useContext(ToastContext);
}
