import { useEffect, useId, useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import type { Grade } from 'truelink-schema-document';
import { useI18n } from '../i18n';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'quiet' | 'inverse';
type Size = 'md' | 'sm' | 'lg';

function buttonClass(variant: Variant, size: Size, block?: boolean, extra?: string): string {
  return ['btn', `btn-${variant}`, `btn-${size}`, block ? 'btn-block' : '', extra ?? ''].filter(Boolean).join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconEnd?: IconName;
  block?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', icon, iconEnd, block, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, block, className)} {...rest}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children ? <span className="btn-label">{children}</span> : null}
      {iconEnd ? <Icon name={iconEnd} size={size === 'sm' ? 16 : 18} /> : null}
    </button>
  );
}

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconEnd?: IconName;
  block?: boolean;
  external?: boolean;
}

/** Anchor styled as a button. External links open a new tab without referrer or opener. */
export function LinkButton({ variant = 'secondary', size = 'md', icon, iconEnd, block, external, className, children, ...rest }: LinkButtonProps) {
  const { t } = useI18n();
  return (
    <a className={buttonClass(variant, size, block, className)} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      <span className="btn-label">{children}</span>
      {external ? <Icon name={iconEnd ?? 'external'} size={16} /> : iconEnd ? <Icon name={iconEnd} size={18} /> : null}
      {external ? <span className="sr-only">{t('common.newTab')}</span> : null}
    </a>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const { t } = useI18n();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className ? `ext-link ${className}` : 'ext-link'}>
      {children}
      <Icon name="external" size={14} />
      <span className="sr-only">{t('common.newTab')}</span>
    </a>
  );
}

export function IconButton({ icon, label, className, size = 'md', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: 'md' | 'sm' }) {
  return (
    <button type="button" className={`icon-btn icon-btn-${size}${className ? ` ${className}` : ''}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 20} />
    </button>
  );
}

export function Chip({ tone = 'neutral', icon, children }: { tone?: 'neutral' | 'gold' | 'green' | 'blue' | 'red' | 'amber'; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`chip chip-${tone}`}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

const GRADE_TONE: Record<Grade, string> = { 'needs-work': 'amber', good: 'blue', excellent: 'green' };

export function ScoreRing({ score, grade, size = 88, label }: { score: number; grade: Grade; size?: number; label?: string }) {
  const { t } = useI18n();
  const stroke = size >= 72 ? 8 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  const text = `${label ?? t('audit.title')} ${score}% · ${t(`audit.grade.${grade}`)}`;
  return (
    <div className={`score-ring tone-${GRADE_TONE[grade]}`} style={{ width: size, height: size }} role="img" aria-label={text}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="score-ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="score-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="score-ring-number" aria-hidden="true">
        {score}
        <small>%</small>
      </span>
    </div>
  );
}

export function ProgressBar({ value, tone = 'blue', label }: { value: number; tone?: string; label: string }) {
  return (
    <div className={`progress tone-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function gradeTone(grade: Grade): string {
  return GRADE_TONE[grade];
}

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  tone?: 'default' | 'danger';
}

/** Native modal dialog: focus trapping, Escape and inert background come from the platform. */
export function Dialog({ open, title, onClose, children, actions, tone = 'default' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${tone}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="dialog-body">
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        <div className="dialog-content">{children}</div>
        {actions ? <div className="dialog-actions">{actions}</div> : null}
      </div>
    </dialog>
  );
}

export interface TabItem<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly icon?: IconName;
  readonly badge?: number;
  /** Overrides the id of the panel this tab controls. */
  readonly controls?: string;
}

/** Accessible segmented tabs with arrow-key navigation. */
export function Tabs<T extends string>({ items, value, onChange, label, idBase, variant = 'tabs' }: { items: readonly TabItem<T>[]; value: T; onChange: (value: T) => void; label: string; idBase: string; variant?: 'tabs' | 'segmented' }) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    const item = items[next]!;
    onChange(item.id);
    document.getElementById(`${idBase}-tab-${item.id}`)?.focus();
  };
  return (
    <div className={variant === 'segmented' ? 'segmented' : 'tabs'} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button
          key={item.id}
          id={`${idBase}-tab-${item.id}`}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          aria-controls={item.controls ?? `${idBase}-panel-${item.id}`}
          tabIndex={item.id === value ? 0 : -1}
          className="tab"
          onClick={() => onChange(item.id)}
        >
          {item.icon ? <Icon name={item.icon} size={16} /> : null}
          <span>{item.label}</span>
          {item.badge ? <span className="tab-badge">{item.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {children ? <div className="empty-actions">{children}</div> : null}
    </div>
  );
}

export function Notice({ tone = 'info', icon, children, action }: { tone?: 'info' | 'warning' | 'danger' | 'success' | 'gold'; icon?: IconName; children: ReactNode; action?: ReactNode }) {
  const fallback: IconName = tone === 'danger' ? 'alert-circle' : tone === 'warning' ? 'alert-triangle' : tone === 'success' ? 'check-circle' : 'info';
  return (
    <div className={`notice notice-${tone}`} role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}>
      <Icon name={icon ?? fallback} size={18} />
      <div className="notice-text">{children}</div>
      {action ? <div className="notice-action">{action}</div> : null}
    </div>
  );
}
