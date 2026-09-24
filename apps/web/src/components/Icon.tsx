/**
 * Line icons on a 24px grid with a uniform 1.75px stroke, always paired with a
 * visible or accessible text label. No icon fonts or remote assets.
 */
const PATHS = {
  home: 'M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.25v-6h-5.5v6H5A1.5 1.5 0 0 1 3.5 19z',
  layers: 'm12 3.5 8.5 4.75L12 13 3.5 8.25zM3.5 12.25 12 17l8.5-4.75M3.5 16.25 12 21l8.5-4.75',
  plus: 'M12 5v14M5 12h14',
  building: 'M4.5 20.5V5A1.5 1.5 0 0 1 6 3.5h8A1.5 1.5 0 0 1 15.5 5v15.5M15.5 9h3a1.5 1.5 0 0 1 1.5 1.5v10M3 20.5h18M8 7.5h4M8 11h4M8 14.5h4M10 20.5v-2.5',
  store: 'M4.5 10v9A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-9M3.5 9.25 5 4h14l1.5 5.25a2.6 2.6 0 0 1-5.2.25 2.7 2.7 0 0 1-5.3 0 2.6 2.6 0 0 1-5.2 0M10 20.5v-5h4v5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  globe: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z',
  briefcase: 'M4.5 7.5h15A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V9a1.5 1.5 0 0 1 1.5-1.5zM8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18',
  box: 'M20.5 7.75 12 3.5 3.5 7.75v8.5L12 20.5l8.5-4.25zM3.5 7.75 12 12l8.5-4.25M12 12v8.5',
  'file-text': 'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5zM13.5 3.5v5h5M9 13h6M9 16.5h6M9 9.5h2',
  'help-circle': 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM9.6 9.3a2.5 2.5 0 0 1 4.85.85c0 1.65-2.45 2.15-2.45 3.6M12 16.9h.01',
  calendar: 'M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5zM3.5 10h17M8 3v4M16 3v4',
  breadcrumb: 'M3.5 7h5l2.5 5-2.5 5h-5l2.5-5zM13 7h5l2.5 5-2.5 5h-5l2.5-5z',
  code: 'm8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15',
  copy: 'M9 8.5h9.5A1.5 1.5 0 0 1 20 10v9.5a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19.5V10A1.5 1.5 0 0 1 9 8.5zM4.5 15.5A1.5 1.5 0 0 1 3 14V4.5A1.5 1.5 0 0 1 4.5 3H14a1.5 1.5 0 0 1 1.5 1.5',
  download: 'M12 3.5V15M7 10l5 5 5-5M4.5 20.5h15',
  upload: 'M12 15.5V4M7 9l5-5 5 5M4.5 20.5h15',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  'check-circle': 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM8.5 12.25l2.5 2.5 4.75-5',
  'alert-circle': 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.75v5M12 16.25h.01',
  'alert-triangle': 'M10.3 4.3 2.9 17.2A2 2 0 0 0 4.6 20.2h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0zM12 9.5v4M12 16.75h.01',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 11v5.25M12 7.75h.01',
  x: 'M6 6l12 12M18 6 6 18',
  'chevron-left': 'm14.5 6-6 6 6 6',
  'chevron-right': 'm9.5 6 6 6-6 6',
  'chevron-down': 'm6 9.5 6 6 6-6',
  'arrow-right': 'M4.5 12h15M13.5 6l6 6-6 6',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  trash: 'M4 6.5h16M10 10.5v6M14 10.5v6M5.75 6.5l.9 12.6A1.5 1.5 0 0 0 8.15 20.5h7.7a1.5 1.5 0 0 0 1.5-1.4l.9-12.6M9 6.5V4.5A1 1 0 0 1 10 3.5h4a1 1 0 0 1 1 1v2',
  external: 'M14 3.5h6.5V10M20.5 3.5l-9 9M18.5 13.5v5.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5h5.5',
  search: 'M10.75 17.5a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5zM20 20l-4.5-4.5',
  sun: 'M12 16.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5zM12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
  moon: 'M19.5 14.2A8 8 0 1 1 9.8 4.5a6.5 6.5 0 0 0 9.7 9.7z',
  monitor: 'M4.5 4.5h15A1.5 1.5 0 0 1 21 6v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5zM8.5 20.5h7M12 17v3.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  cloud: 'M7 18.5h10.25a4.25 4.25 0 0 0 .6-8.46A6 6 0 0 0 6.2 11.1 3.75 3.75 0 0 0 7 18.5z',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  shield: 'M12 3.5 5 6.25v5.5c0 4.35 2.9 7.6 7 8.75 4.1-1.15 7-4.4 7-8.75v-5.5zM9 12l2.1 2.1L15.25 10',
  link: 'M10 13.5a4 4 0 0 0 5.66.34l2.83-2.83a4 4 0 0 0-5.66-5.66l-1.06 1.06M14 10.5a4 4 0 0 0-5.66-.34l-2.83 2.83a4 4 0 0 0 5.66 5.66l1.06-1.06',
  'map-pin': 'M12 20.75s-6.5-5.6-6.5-10.75a6.5 6.5 0 0 1 13 0c0 5.15-6.5 10.75-6.5 10.75zM12 12.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5z',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2',
  phone: 'M5.5 3.5h3l1.75 4.5-2.25 1.4a10.5 10.5 0 0 0 5.1 5.1l1.4-2.25 4.5 1.75v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  scan: 'M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3M8 10h8M8 14h5',
  smartphone: 'M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16A1.5 1.5 0 0 1 16 21.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2',
  'wifi-off': 'M3 3l18 18M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.2-2.3M14.3 10.2A10 10 0 0 1 19 12.5M2 8.8a15 15 0 0 1 4.6-2.9M10.5 5.1A15 15 0 0 1 22 8.8M12 19.5h.01',
  lock: 'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5zM8 10.5V8a4 4 0 0 1 8 0v2.5',
  star: 'm12 3.5 2.55 5.2 5.7.8-4.12 4 1 5.65L12 16.5l-5.13 2.65 1-5.65-4.12-4 5.7-.8z',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  refresh: 'M19.5 11A7.5 7.5 0 1 0 17.3 16.3M19.5 4.5V11H13',
  languages: 'M3.5 5.5h9M8 3.5v2M10.5 5.5c-.6 3.4-2.8 6.1-6.5 7.5M5.8 8.5c.9 1.9 2.6 3.4 4.9 4.3M13 20.5l3.75-9 3.75 9M14.4 17.25h4.7',
  sparkline: 'M3.5 17.5l5-5 3.5 3.5 8-8M14.5 8h5.5v5.5',
  target: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 16.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5zM12 12h.01',
} as const;

export type IconName = keyof typeof PATHS;

export function isIconName(value: string): value is IconName {
  return value in PATHS;
}

export function Icon({ name, size = 20, className, title }: { name: IconName | string; size?: number; className?: string; title?: string }) {
  const path = isIconName(name) ? PATHS[name] : PATHS.code;
  const bold = name === 'more';
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={bold ? 3 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={path} />
    </svg>
  );
}

/** Product glyph for Schema Studio (not the TrueLink trademark). */
export function StudioMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="studio-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--mark-bg, #c9a13b)" />
      <path d="M12.5 9.5c-2 0-2.75 1-2.75 2.75v1.5c0 1.3-.7 2.1-1.75 2.25 1.05.15 1.75.95 1.75 2.25v1.5c0 1.75.75 2.75 2.75 2.75M19.5 9.5c2 0 2.75 1 2.75 2.75v1.5c0 1.3.7 2.1 1.75 2.25-1.05.15-1.75.95-1.75 2.25v1.5c0 1.75-.75 2.75-2.75 2.75" fill="none" stroke="var(--mark-fg, #0d2240)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.25" fill="var(--mark-fg, #0d2240)" />
    </svg>
  );
}
