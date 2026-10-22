import React from 'react';

/** مجموعة أيقونات SVG خطّية موحّدة للمنصة (بدل الرموز التعبيرية) */
export type IconName = 'dashboard' | 'programs' | 'evaluations' | 'reports' | 'admin' | 'settings' | 'logout' | 'login' | 'refresh' | 'alert' | 'target' | 'users' | 'trend' | 'check' | 'calendar' | 'book' | 'school' | 'laptop' | 'link' | 'star' | 'chart' | 'clock' | 'arrow' | 'shield' | 'plus' | 'edit' | 'trash' | 'home' | 'compass' | 'question' | 'scale' | 'chat' | 'folder' | 'flag' | 'download' | 'print' | 'doc' | 'slides' | 'copy' | 'table' | 'globe' | 'filter' | 'save' | 'mail' | 'x' | 'play' | 'pause' | 'stop' | 'award' | 'certificate' | 'search' | 'send';

export const ICON_PATHS: Record<IconName, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  programs: 'M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm10-1v5h5M8 13h8M8 17h8M8 9h3',
  evaluations: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  reports: 'M4 20h16M6 16V10M10 16V6M14 16v-4M18 16V8',
  admin: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zm0 5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm-4 9c1-2 2.5-3 4-3s3 1 4 3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-1.7-1L14.8 3H9.2l-.4 2.6a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 1.7 1l.4 2.6h5.6l.4-2.6a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z',
  login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  logout: 'M10 17l5-5-5-5M15 12H3M21 3v18',
  refresh: 'M21 12a9 9 0 1 1-3-6.7M21 3v6h-6',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  trend: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  check: 'M20 6L9 17l-5-5',
  calendar: 'M3 9h18M8 3v4M16 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z',
  school: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M12 11h.01',
  laptop: 'M3 5h18v11H3zM1 19h22M9 19l1-3M15 19l-1-3',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  star: 'M12 2l3 7 7 .6-5.3 4.6L18.4 22 12 18.3 5.6 22l1.7-7.8L2 9.6 9 9z',
  chart: 'M3 3v18h18M7 14l4-4 4 4 5-6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4l3 2',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  shield: 'M12 2l8 3v7c0 5-3.5 9-8 10-4.5-1-8-5-8-10V5l8-3zm-3 10l2 2 4-4',
  plus: 'M12 5v14M5 12h14',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6',
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z',
  compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm4-14l-2.5 6.5L7 17l2.5-6.5L16 8z',
  question: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01',
  scale: 'M12 3v18M5 21h14M3 7h18M6 7l-3 7a3 3 0 0 0 6 0L6 7zm12 0l-3 7a3 3 0 0 0 6 0l-3-7z',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  flag: 'M4 22V4m0 0h12l-2 4 2 4H4',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  print: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  doc: 'M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm9 0v5h5M8 13h8M8 17h6',
  slides: 'M3 4h18v12H3zM12 16v4M8 20h8M7 12l3-3 3 2 4-4',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  table: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c-3 3-3 15 0 18m0-18c3 3 3 15 0 18M3 12h18',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  save: 'M5 3h11l3 3v15H5zM8 3v6h7V3M8 21v-7h8v7',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  x: 'M6 6l12 12M18 6L6 18',
  play: 'M7 5l12 7-12 7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  stop: 'M6 6h12v12H6z',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-9v3l2 1M8.5 13.5L7 22l5-3 5 3-1.5-8.5',
  certificate: 'M3 5h18v11H3zM7 9h10M7 12h6M15 16v6l2.5-1.5L20 22v-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2l-4.3-4.3',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
};

export function Icon({ name, size = 20, color = 'currentColor', stroke = 2, className }: { name: IconName; size?: number; color?: string; stroke?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

/** أيقونة كل نوع تقرير في مركز التقارير */
export const REPORT_ICON: Record<string, IconName> = {
  executive: 'shield', trainers: 'users', programs: 'book', classrooms: 'school', axes: 'compass', questions: 'question',
  trend: 'trend', comparison: 'scale', participation: 'users', qualitative: 'chat', actions: 'target', raw: 'folder', trainer_card: 'star',
};
