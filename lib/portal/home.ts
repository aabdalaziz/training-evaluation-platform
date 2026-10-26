// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — الصفحة الحيّة (P10): دوال نقية لبناء «الآن في أَثَر» (إعلانات حيّة من البرامج والجلسات)، العدّ التنازلي، وحقائق المستشار
 */
import type { Lang } from './content';
import { SERVICES, CONTACT, t, fmtDate } from './content';
import type { AdvisorFacts } from '../ai/prompts';

export type FeedProgram = { id: string; name_ar: string; name_en?: string | null; start_date?: string | null; end_date?: string | null; registration_open?: boolean | null; registration_deadline?: string | null; fee?: number | null; delivery_mode?: string | null; program_type?: string | null; intro_ar?: string | null; audience_ar?: string | null; status?: string | null; archived_at?: string | null; is_public?: boolean | null; seats?: number | null };
export type FeedSession = { id: string; kind?: string | null; title_ar: string; title_en?: string | null; speaker_name?: string | null; starts_at: string; duration_min?: number | null; access?: string | null; status?: string | null; description_ar?: string | null; provider?: string | null; capacity?: number | null };
export type FeedItem = { kind: 'program' | 'session' | 'sim' | 'daily'; id: string; href: string; badge: string; title: string; sub: string; at: string | null; cta: string; tone: 'navy' | 'teal' | 'gold' | 'plum' };

export const SESSION_KIND: Record<string, { ar: string; en: string }> = { webinar: { ar: 'ندوة مباشرة', en: 'Live webinar' }, seminar: { ar: 'ندوة', en: 'Seminar' }, workshop: { ar: 'ورشة عمل', en: 'Workshop' }, class: { ar: 'جلسة صفّية', en: 'Class' }, lecture: { ar: 'محاضرة', en: 'Lecture' }, meetup: { ar: 'لقاء', en: 'Meetup' }, office_hours: { ar: 'ساعات مكتبية', en: 'Office hours' } };
export const PROGRAM_KIND: Record<string, { ar: string; en: string }> = { diploma: { ar: 'دبلوم', en: 'Diploma' }, course: { ar: 'دورة', en: 'Course' }, workshop: { ar: 'ورشة', en: 'Workshop' }, bootcamp: { ar: 'معسكر', en: 'Bootcamp' }, certificate: { ar: 'برنامج شهادة', en: 'Certificate program' } };

/** يبني شريط «الآن في أَثَر»: أقرب جلسة، أقرب برنامج مفتوح، ثم تذكير بالمحاكاة ومهارة اليوم — بحد 6 */
export function buildFeed(programs: FeedProgram[], sessions: FeedSession[], todayIso: string, lang: Lang): FeedItem[] {
  const ar = lang === 'ar'; const out: FeedItem[] = [];
  const upcoming = sessions.filter(s => s.starts_at && s.status !== 'cancelled' && (s.access || 'public') === 'public' && new Date(s.starts_at).getTime() > Date.parse(todayIso) - 2 * 3600000).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const live = upcoming.find(s => { const st = new Date(s.starts_at).getTime(); const en = st + (Number(s.duration_min) || 60) * 60000; const now = Date.parse(todayIso); return now >= st - 15 * 60000 && now <= en; });
  for (const s of (live ? [live, ...upcoming.filter(x => x.id !== live.id)] : upcoming).slice(0, 2)) {
    const isLive = live && s.id === live.id; const kind = SESSION_KIND[String(s.kind || 'webinar')] || SESSION_KIND.webinar;
    out.push({ kind: 'session', id: s.id, href: `/live/${s.id}`, badge: isLive ? (ar ? 'يُبثّ الآن' : 'Live now') : (ar ? kind.ar : kind.en), title: (lang === 'en' && s.title_en) || s.title_ar, sub: [s.speaker_name, `${fmtDate(s.starts_at, lang)} · ${timeOf(s.starts_at, lang)}`, s.duration_min ? `${s.duration_min} ${ar ? 'دقيقة' : 'min'}` : ''].filter(Boolean).join(' · '), at: s.starts_at, cta: isLive ? (ar ? 'ادخل البث' : 'Join') : (ar ? 'احجز مقعدك' : 'Reserve a seat'), tone: isLive ? 'gold' : 'teal' });
  }
  const openProgs = programs.filter(p => p.is_public !== false && !p.archived_at && !['CANCELLED', 'COMPLETED'].includes(String(p.status || '').toUpperCase()) && (!p.end_date || p.end_date >= todayIso.slice(0, 10)))
    .sort((a, b) => Number(!!b.registration_open) - Number(!!a.registration_open) || String(a.start_date || '9999').localeCompare(String(b.start_date || '9999')));
  for (const p of openProgs.slice(0, 2)) {
    const kind = PROGRAM_KIND[String(p.program_type || 'course').toLowerCase()] || PROGRAM_KIND.course; const open = !!p.registration_open;
    out.push({ kind: 'program', id: p.id, href: `/programs/${p.id}`, badge: open ? (ar ? `التسجيل مفتوح · ${kind.ar}` : `Enrolling · ${kind.en}`) : (ar ? kind.ar : kind.en), title: (lang === 'en' && p.name_en) || p.name_ar, sub: [p.start_date ? (ar ? `يبدأ ${fmtDate(p.start_date, lang)}` : `Starts ${fmtDate(p.start_date, lang)}`) : '', p.registration_deadline ? (ar ? `آخر موعد ${fmtDate(p.registration_deadline, lang)}` : `Deadline ${fmtDate(p.registration_deadline, lang)}`) : '', p.fee ? `${p.fee} ${ar ? 'ر.س' : 'SAR'}` : (ar ? 'مجاني' : 'Free')].filter(Boolean).join(' · '), at: p.start_date ? p.start_date + 'T06:00:00Z' : null, cta: open ? (ar ? 'سجّل الآن' : 'Enrol now') : (ar ? 'التفاصيل' : 'Details'), tone: 'navy' });
  }
  out.push({ kind: 'sim', id: 'sim', href: '/sim', badge: ar ? 'محاكاة أداء' : 'Performance simulation', title: ar ? 'ادخل الصف قبل أن تدخله: طالب يخلط بين الضاد والظاء' : 'Enter the classroom before you do: a learner confusing ḍād and ẓāʾ', sub: ar ? 'ثلاث دقائق · تقييم بمعيار معلن · بلا تسجيل' : '3 minutes · rubric-scored · no sign-up', at: null, cta: ar ? 'جرّب الآن' : 'Try now', tone: 'plum' });
  if (out.length < 6) out.push({ kind: 'daily', id: 'daily', href: '/#daily', badge: ar ? 'كل يوم مهارة' : 'Daily skill', title: ar ? 'فكرة واحدة عميقة وتحدٍّ من سؤال — كل يوم' : 'One deep idea and a one-question challenge — every day', sub: ar ? 'ثلاث دقائق تُضاف دليلًا في ملفك المهاري' : 'Three minutes, logged as evidence in your skills profile', at: null, cta: ar ? 'مهارة اليوم' : "Today's skill", tone: 'gold' });
  return out.slice(0, 6);
}
export function timeOf(iso: string, lang: Lang): string { const d = new Date(iso); if (!isFinite(d.getTime())) return ''; return d.toLocaleTimeString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }); }

/** عدّ تنازلي مقروء: {d,h,m,s,label} */
export function countdown(targetIso: string, nowMs: number, lang: Lang): { d: number; h: number; m: number; s: number; label: string; past: boolean } {
  const diff = Date.parse(targetIso) - nowMs; const past = diff <= 0; const x = Math.max(0, diff);
  const d = Math.floor(x / 86400000), h = Math.floor((x % 86400000) / 3600000), m = Math.floor((x % 3600000) / 60000), s = Math.floor((x % 60000) / 1000);
  const ar = lang === 'ar'; const label = past ? (ar ? 'بدأ' : 'Started') : d > 0 ? (ar ? `بعد ${d} يوم و${h} ساعة` : `in ${d}d ${h}h`) : h > 0 ? (ar ? `بعد ${h} ساعة و${m} دقيقة` : `in ${h}h ${m}m`) : (ar ? `بعد ${m} دقيقة و${s} ثانية` : `in ${m}m ${s}s`);
  return { d, h, m, s, label, past };
}

/** حقائق المستشار من الصفوف الخام (تُستخدم في /api/advisor و/api/athir) */
export function advisorFacts(programs: FeedProgram[], sessions: FeedSession[], resources: number, todayIso: string, lang: Lang): AdvisorFacts {
  const today = todayIso.slice(0, 10);
  return {
    services: SERVICES.map(s => ({ title: t(s.title, lang), href: s.cta.href, summary: t(s.short, lang) })),
    programs: programs.filter(p => p.is_public !== false && !p.archived_at && (!p.end_date || p.end_date >= today)).slice(0, 12).map(p => ({ id: p.id, name: (lang === 'en' && p.name_en) || p.name_ar, fee: p.fee ?? null, start: p.start_date || null, open: !!p.registration_open, delivery: p.delivery_mode || null })),
    sessions: sessions.filter(s => (s.access || 'public') === 'public' && s.status !== 'cancelled' && Date.parse(s.starts_at) > Date.parse(todayIso) - 3600000).slice(0, 6).map(s => ({ id: s.id, title: (lang === 'en' && s.title_en) || s.title_ar, when: `${fmtDate(s.starts_at, lang)} ${timeOf(s.starts_at, lang)}`, free: true })),
    resources, contact: { email: CONTACT.email, phone: CONTACT.phone },
  };
}

/** نص الكتابة التدريجية: يعيد الجزء المعروض عند خطوة معيّنة */
export function typewriter(text: string, step: number, chunk = 3): string { return text.slice(0, Math.min(text.length, step * chunk)); }
