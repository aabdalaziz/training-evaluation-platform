/* بَيان (هـ-6-ج) — سجلّ الجلسات التجريبية بترتيب المنهج: البيت (ا) ثم السوق (ب) */
import type { SessionData } from './types';
import { BAYT } from './bayt';
import { SOUQ } from './souq';

export const SESSIONS: SessionData[] = [BAYT, SOUQ].sort((a, b) => a.meta.order - b.meta.order);
export const DEFAULT_SESSION = SESSIONS[0];
export const getSession = (slug: string | undefined): SessionData | undefined => SESSIONS.find(s => s.slug === slug);
export const STATIONS = [
  { key: 'start',  title: 'هَيّا نَبْدَأ',          icon: '☀️' },
  { key: 'story',  title: 'الحِكاية',               icon: '📖' },
  { key: 'harf',   title: 'حَرْف يَرْسُم',           icon: '✏️' },
  { key: 'play',   title: 'هَيّا بِنا نَلْعَب',      icon: '🎲' },
  { key: 'act',    title: 'هَيّا بِنا نُمَثِّل',      icon: '🎭' },
  { key: 'hadith', title: 'في مَدْرَسَةِ المُصْطَفى ﷺ', icon: '🕌' },
  { key: 'quran',  title: 'هَيّا بِنا نَتْلو',       icon: '📿' },
  { key: 'athari', title: 'أَثَري اليَوْم',          icon: '🌱' },
] as const;
export type StationKey = typeof STATIONS[number]['key'];
