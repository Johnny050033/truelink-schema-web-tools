import { useEffect, useRef } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuItem {
  readonly label: string;
  readonly icon: IconName;
  readonly onSelect: () => void;
  readonly tone?: 'danger';
  readonly disabled?: boolean;
}

/** Disclosure menu built on <details>; closes on outside click, Escape or selection. */
export function Menu({ label, items, icon = 'more', align = 'end' }: { label: string; items: readonly MenuItem[]; icon?: IconName; align?: 'start' | 'end' }) {
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
  return (
    <details className={`menu menu-${align}`} ref={ref}>
      <summary className="icon-btn icon-btn-md" aria-label={label} title={label}>
        <Icon name={icon} size={20} />
      </summary>
      <div className="menu-list">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`menu-item${item.tone === 'danger' ? ' is-danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              if (ref.current) ref.current.open = false;
              item.onSelect();
            }}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}
