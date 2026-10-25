// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — التعلّم المباشر والهجين: الجلسات، المزوّدون، الحالة الزمنية، السلاسل، التعارض، الإسكان، البريد، Excel
import type { Lang, T } from './content';
import { t } from './content';

export type Provider = 'teams' | 'zoom' | 'meet' | 'athar' | 'other';
export type SessionKind = 'class' | 'webinar' | 'workshop' | 'office_hours';
export type SessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type SessionAccess = 'public' | 'registered' | 'program' | 'org' | 'staff';
export type TimeState = 'upcoming' | 'soon' | 'live' | 'ended' | 'cancelled';

export type LiveSession = {
  id: string; created_at?: string; updated_at?: string; created_by?: string | null;
  program_id?: string | null; classroom_id?: string | null; trainer_id?: string | null; series_id?: string | null;
  kind: SessionKind; title_ar: string; title_en?: string | null; description_ar?: string | null; description_en?: string | null; speaker_name?: string | null;
  starts_at: string; duration_min: number; provider: Provider; join_url?: string | null; recording_url?: string | null; resource_id?: string | null;
  skills: string[]; sector?: string | null; access: SessionAccess; organization_id?: string | null; capacity?: number | null; lang?: string | null;
  status: SessionStatus; attendance_session_id?: string | null; reminder_sent_at?: string | null; notes?: string | null;
};
export type Classroom = { id: string; code: string; section_name?: string | null; program_id: string; trainer_id?: string | null; delivery_mode?: string | null; level?: string | null; capacity?: number | null; provider?: string | null; join_url?: string | null; host_url?: string | null; placement_open?: boolean | null; portal_created?: boolean | null; cefr_level?: string | null };
export type Trainer = { id: string; full_name?: string | null; name?: string | null; email?: string | null };
export type Registration = { id: string; session_id: string; user_id?: string | null; email: string; full_name?: string | null; organization?: string | null; created_at?: string };

export const PROVIDERS: { value: Provider; label: T; hint: T; pattern: RegExp | null }[] = [
  { value: 'teams', label: { ar: 'Microsoft Teams', en: 'Microsoft Teams' }, hint: { ar: 'رابط اجتماع Teams', en: 'Teams meeting link' }, pattern: /teams\.(microsoft|live)\.com|teams\.cloud\.microsoft/i },
  { value: 'zoom', label: { ar: 'Zoom', en: 'Zoom' }, hint: { ar: 'رابط اجتماع Zoom', en: 'Zoom meeting link' }, pattern: /zoom\.(us|com)/i },
  { value: 'meet', label: { ar: 'Google Meet', en: 'Google Meet' }, hint: { ar: 'رابط Google Meet', en: 'Google Meet link' }, pattern: /meet\.google\.com/i },
  { value: 'athar', label: { ar: 'قاعة أَثَر (تجريبي)', en: 'Athar Room (beta)' }, hint: { ar: 'غرفة فورية في المتصفح بلا حسابات — تُنشأ تلقائيًا', en: 'Instant browser room, no accounts — generated automatically' }, pattern: null },
  { value: 'other', label: { ar: 'منصة أخرى', en: 'Other platform' }, hint: { ar: 'أي رابط بث', en: 'Any streaming link' }, pattern: null },
];
export const KINDS: { value: SessionKind; label: T }[] = [
  { value: 'class', label: { ar: 'جلسة شعبة', en: 'Class session' } },
  { value: 'webinar', label: { ar: 'ندوة عامة', en: 'Webinar' } },
  { value: 'workshop', label: { ar: 'ورشة عمل', en: 'Workshop' } },
  { value: 'office_hours', label: { ar: 'ساعات مكتبية', en: 'Office hours' } },
];
export const SESSION_ACCESS: { value: SessionAccess; label: T }[] = [
  { value: 'program', label: { ar: 'متدربو الشعبة/البرنامج', en: 'Section / program trainees' } },
  { value: 'public', label: { ar: 'عامة (بتسجيل مفتوح)', en: 'Public (open registration)' } },
  { value: 'registered', label: { ar: 'للمسجّلين في أَثَر', en: 'Athar members' } },
  { value: 'org', label: { ar: 'لجهة محددة', en: 'Organization' } },
  { value: 'staff', label: { ar: 'داخلية', en: 'Internal' } },
];
export const WEEKDAYS: { value: number; label: T; short: T }[] = [
  { value: 0, label: { ar: 'الأحد', en: 'Sunday' }, short: { ar: 'أحد', en: 'Sun' } }, { value: 1, label: { ar: 'الاثنين', en: 'Monday' }, short: { ar: 'اثنين', en: 'Mon' } }, { value: 2, label: { ar: 'الثلاثاء', en: 'Tuesday' }, short: { ar: 'ثلاثاء', en: 'Tue' } },
  { value: 3, label: { ar: 'الأربعاء', en: 'Wednesday' }, short: { ar: 'أربعاء', en: 'Wed' } }, { value: 4, label: { ar: 'الخميس', en: 'Thursday' }, short: { ar: 'خميس', en: 'Thu' } }, { value: 5, label: { ar: 'الجمعة', en: 'Friday' }, short: { ar: 'جمعة', en: 'Fri' } }, { value: 6, label: { ar: 'السبت', en: 'Saturday' }, short: { ar: 'سبت', en: 'Sat' } },
];
const lab = <V extends string | number>(list: { value: V; label: T }[], v: V, lang: Lang) => { const x = list.find(a => a.value === v); return x ? t(x.label, lang) : String(v); };
export const providerLabel = (v: string, lang: Lang) => lab(PROVIDERS, v as Provider, lang);
export const kindLabel = (v: string, lang: Lang) => lab(KINDS, v as SessionKind, lang);
export const sessionAccessLabel = (v: string, lang: Lang) => lab(SESSION_ACCESS, v as SessionAccess, lang);
export function sessionTitle(s: Pick<LiveSession, 'title_ar' | 'title_en'>, lang: Lang): string { return (lang === 'en' && s.title_en) ? s.title_en : s.title_ar; }
export function sessionDesc(s: Pick<LiveSession, 'description_ar' | 'description_en'>, lang: Lang): string { return ((lang === 'en' && s.description_en) ? s.description_en : s.description_ar) || ''; }
export function classroomLabel(c: Pick<Classroom, 'code' | 'section_name'> | null | undefined, lang: Lang): string { if (!c) return ''; return c.section_name ? `${c.section_name} (${c.code})` : (lang === 'ar' ? `شعبة ${c.code}` : `Section ${c.code}`); }
export function trainerName(tr: Trainer | null | undefined): string { return tr ? String(tr.full_name || tr.name || tr.email || '') : ''; }

// ---------- الوقت (توقيت الرياض) ----------
export const TZ = 'Asia/Riyadh';
export const SOON_MIN = 15; export const GRACE_MIN = 30;
export function endsAt(s: Pick<LiveSession, 'starts_at' | 'duration_min'>): Date { return new Date(new Date(s.starts_at).getTime() + (s.duration_min || 90) * 60000); }
export function timeState(s: Pick<LiveSession, 'starts_at' | 'duration_min' | 'status'>, now: Date): TimeState {
  if (s.status === 'cancelled') return 'cancelled';
  if (s.status === 'ended') return 'ended';
  const st = new Date(s.starts_at).getTime(); const en = endsAt(s).getTime(); const n = now.getTime();
  if (s.status === 'live' && n < en + GRACE_MIN * 60000) return 'live';
  if (n >= en) return 'ended';
  if (n >= st) return 'live';
  if (n >= st - SOON_MIN * 60000) return 'soon';
  return 'upcoming';
}
export const STATE_LABEL: Record<TimeState, T> = { upcoming: { ar: 'قادمة', en: 'Upcoming' }, soon: { ar: 'تبدأ قريبًا', en: 'Starting soon' }, live: { ar: 'مباشر الآن', en: 'Live now' }, ended: { ar: 'انتهت', en: 'Ended' }, cancelled: { ar: 'ملغاة', en: 'Cancelled' } };
export function canJoin(state: TimeState): boolean { return state === 'soon' || state === 'live'; }
export function canCheckIn(s: Pick<LiveSession, 'starts_at' | 'duration_min' | 'status'>, now: Date): boolean { const st = new Date(s.starts_at).getTime(); const en = endsAt(s).getTime(); const n = now.getTime(); return s.status !== 'cancelled' && n >= st - 10 * 60000 && n <= en + GRACE_MIN * 60000; }
export function fmtWhen(iso: string, lang: Lang, opts: { date?: boolean; time?: boolean; weekday?: boolean } = { date: true, time: true, weekday: true }): string {
  const d = new Date(iso); const loc = lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB';
  const parts: string[] = [];
  if (opts.weekday || opts.date) parts.push(d.toLocaleDateString(loc, { timeZone: TZ, ...(opts.weekday ? { weekday: 'long' } : {}), ...(opts.date ? { day: 'numeric', month: 'long', year: 'numeric' } : {}) }));
  if (opts.time) parts.push(d.toLocaleTimeString(loc, { timeZone: TZ, hour: '2-digit', minute: '2-digit' }));
  return parts.join(lang === 'ar' ? ' · ' : ' · ');
}
export function fmtRange(s: Pick<LiveSession, 'starts_at' | 'duration_min'>, lang: Lang): string {
  const loc = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB'; const o: Intl.DateTimeFormatOptions = { timeZone: TZ, hour: '2-digit', minute: '2-digit' };
  return `${new Date(s.starts_at).toLocaleTimeString(loc, o)} – ${endsAt(s).toLocaleTimeString(loc, o)}`;
}
export function countdown(iso: string, now: Date, lang: Lang): string {
  const ms = new Date(iso).getTime() - now.getTime(); if (ms <= 0) return '';
  const m = Math.floor(ms / 60000); const h = Math.floor(m / 60); const d = Math.floor(h / 24);
  if (d >= 1) return lang === 'ar' ? `بعد ${d} يوم${d > 1 && d < 11 ? '' : ''} و${h % 24} ساعة` : `in ${d}d ${h % 24}h`;
  if (h >= 1) return lang === 'ar' ? `بعد ${h} ساعة و${m % 60} دقيقة` : `in ${h}h ${m % 60}m`;
  return lang === 'ar' ? `بعد ${m} دقيقة` : `in ${m} min`;
}
/** يوم محلي (الرياض) بصيغة YYYY-MM-DD للتجميع */
export function localDay(iso: string): string { const d = new Date(iso); const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d); const g = (k: string) => p.find(x => x.type === k)?.value || ''; return `${g('year')}-${g('month')}-${g('day')}`; }
/** تحويل تاريخ+وقت بتوقيت الرياض إلى ISO (UTC+3 ثابت، لا توقيت صيفي) */
export function riyadhToIso(date: string, time: string): string { return new Date(`${date}T${time.length === 5 ? time + ':00' : time}+03:00`).toISOString(); }
export function isoToRiyadh(iso: string): { date: string; time: string } { const d = new Date(new Date(iso).getTime() + 3 * 3600000); const s = d.toISOString(); return { date: s.slice(0, 10), time: s.slice(11, 16) }; }
export function groupByDay(rows: LiveSession[]): { day: string; items: LiveSession[] }[] {
  const m = new Map<string, LiveSession[]>(); for (const r of [...rows].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) { const k = localDay(r.starts_at); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
  return Array.from(m.entries()).map(([day, items]) => ({ day, items }));
}

// ---------- قاعة أَثَر (غرفة متصفح فورية) ----------
export function atharRoomUrl(sessionId: string, title: string): string { const slug = (title || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).toLowerCase() || 'room'; return `https://meet.jit.si/athar-${sessionId.slice(0, 8)}-${sessionId.slice(-4)}-${slug}`; }
export function validateJoinUrl(provider: Provider, url: string): string | null {
  if (provider === 'athar') return null;
  const u = url.trim(); if (!u) return provider === 'other' ? 'أدخل رابط البث' : `أدخل رابط ${providerLabel(provider, 'ar')}`;
  if (!/^https?:\/\/[^\s]+$/i.test(u)) return 'الرابط يجب أن يبدأ بـ https://';
  const p = PROVIDERS.find(x => x.value === provider); if (p?.pattern && !p.pattern.test(u)) return `الرابط لا يبدو رابط ${providerLabel(provider, 'ar')}`;
  return null;
}

// ---------- السلاسل ----------
export type SeriesSpec = { start_date: string; end_date: string; weekdays: number[]; time: string; duration_min: number };
/** يُرجع تواريخ ISO لكل تكرار (الرياض) — حد أقصى 120 جلسة */
export function expandSeries(spec: SeriesSpec): string[] {
  const out: string[] = []; if (!spec.start_date || !spec.end_date || !spec.weekdays.length || !spec.time) return out;
  const start = new Date(`${spec.start_date}T00:00:00+03:00`); const end = new Date(`${spec.end_date}T00:00:00+03:00`); if (end < start) return out;
  for (let d = new Date(start); d <= end && out.length < 120; d.setDate(d.getDate() + 1)) {
    const wd = new Date(d.getTime() + 3 * 3600000).getUTCDay();
    if (spec.weekdays.includes(wd)) out.push(riyadhToIso(new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10), spec.time));
  }
  return out;
}
/** تعارض: نفس المدرب أو نفس الشعبة في فترة متداخلة */
export function conflicts(existing: LiveSession[], cand: Pick<LiveSession, 'starts_at' | 'duration_min' | 'trainer_id' | 'classroom_id'> & { id?: string }): LiveSession[] {
  const s = new Date(cand.starts_at).getTime(); const e = s + cand.duration_min * 60000;
  return existing.filter(x => x.id !== cand.id && x.status !== 'cancelled' && ((cand.trainer_id && x.trainer_id === cand.trainer_id) || (cand.classroom_id && x.classroom_id === cand.classroom_id)) && new Date(x.starts_at).getTime() < e && endsAt(x).getTime() > s);
}

// ---------- الإسكان (معاينة في الواجهة؛ التنفيذ الفعلي في SQL) ----------
export function placementPlan(classrooms: Classroom[], counts: Record<string, number>, toPlace: number): { classroom_id: string | null; code: string; take: number }[] {
  const plan: { classroom_id: string | null; code: string; take: number }[] = []; let left = toPlace;
  for (const c of [...classrooms].filter(c => c.placement_open !== false).sort((a, b) => a.code.localeCompare(b.code))) {
    if (left <= 0) break; const free = Math.max(0, (c.capacity || 30) - (counts[c.id] || 0)); if (free <= 0) continue; const take = Math.min(free, left); plan.push({ classroom_id: c.id, code: c.code, take }); left -= take;
  }
  let n = classrooms.length; while (left > 0) { n++; const take = Math.min(30, left); plan.push({ classroom_id: null, code: `SEC-${String(n).padStart(2, '0')}`, take }); left -= take; }
  return plan;
}
export function occupancyTone(placed: number, capacity: number): 'ok' | 'warn' | 'full' { if (placed >= capacity) return 'full'; if (placed >= capacity * 0.8) return 'warn'; return 'ok'; }

// ---------- نموذج الإدارة ----------
export type SessionForm = {
  mode: 'single' | 'series'; kind: SessionKind; program_id: string; classroom_id: string; trainer_id: string; title_ar: string; title_en: string; description_ar: string; speaker_name: string;
  date: string; time: string; duration_min: number; provider: Provider; join_url: string; host_url: string; access: SessionAccess; organization_id: string; capacity: string; skills: string[]; sector: string; resource_id: string;
  series_end: string; weekdays: number[];
};
export const EMPTY_SESSION: SessionForm = { mode: 'single', kind: 'class', program_id: '', classroom_id: '', trainer_id: '', title_ar: '', title_en: '', description_ar: '', speaker_name: '', date: '', time: '19:00', duration_min: 90, provider: 'teams', join_url: '', host_url: '', access: 'program', organization_id: '', capacity: '', skills: [], sector: '', resource_id: '', series_end: '', weekdays: [] };
export function validateSession(f: SessionForm): string | null {
  if (f.title_ar.trim().length < 4) return 'عنوان الجلسة مطلوب (4 أحرف على الأقل)';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return 'اختر تاريخ الجلسة';
  if (!/^\d{2}:\d{2}$/.test(f.time)) return 'اختر وقت البداية';
  if (!(f.duration_min >= 15 && f.duration_min <= 600)) return 'المدة بين 15 و600 دقيقة';
  if (f.kind === 'class' && !f.program_id) return 'جلسة الشعبة تحتاج برنامجًا';
  if (f.kind === 'class' && !f.classroom_id) return 'اختر الشعبة (القاعة)';
  if (f.access === 'org' && !f.organization_id) return 'اختر الجهة المرتبطة';
  if (f.capacity && !(Number(f.capacity) > 0)) return 'السعة رقم موجب';
  const u = validateJoinUrl(f.provider, f.join_url); if (u) return u;
  if (f.host_url && !/^https?:\/\/[^\s]+$/i.test(f.host_url.trim())) return 'رابط المضيف غير صالح';
  if (f.mode === 'series') { if (!/^\d{4}-\d{2}-\d{2}$/.test(f.series_end)) return 'اختر تاريخ نهاية السلسلة'; if (f.series_end < f.date) return 'نهاية السلسلة قبل بدايتها'; if (!f.weekdays.length) return 'اختر يومًا واحدًا على الأقل في الأسبوع'; const n = expandSeries({ start_date: f.date, end_date: f.series_end, weekdays: f.weekdays, time: f.time, duration_min: f.duration_min }).length; if (n === 0) return 'لا توجد جلسات في هذا المدى'; if (n > 120) return 'الحد الأقصى 120 جلسة للسلسلة'; }
  return null;
}
export function sessionPayload(f: SessionForm, startsAt: string, seriesId: string | null, createdBy: string) {
  return {
    program_id: f.program_id || null, classroom_id: f.classroom_id || null, trainer_id: f.trainer_id || null, series_id: seriesId, kind: f.kind,
    title_ar: f.title_ar.trim(), title_en: f.title_en.trim() || null, description_ar: f.description_ar.trim() || null, speaker_name: f.speaker_name.trim() || null,
    starts_at: startsAt, duration_min: f.duration_min, provider: f.provider, join_url: f.provider === 'athar' ? null : (f.join_url.trim() || null),
    access: f.access, organization_id: f.organization_id || null, capacity: f.capacity ? Number(f.capacity) : null, skills: f.skills, sector: f.sector || null, resource_id: f.resource_id || null,
    status: 'scheduled', created_by: createdBy,
  };
}
export function sessionToForm(s: LiveSession, host_url = ''): SessionForm {
  const { date, time } = isoToRiyadh(s.starts_at);
  return { ...EMPTY_SESSION, kind: s.kind, program_id: s.program_id || '', classroom_id: s.classroom_id || '', trainer_id: s.trainer_id || '', title_ar: s.title_ar, title_en: s.title_en || '', description_ar: s.description_ar || '', speaker_name: s.speaker_name || '', date, time, duration_min: s.duration_min, provider: s.provider, join_url: s.join_url || '', host_url, access: s.access, organization_id: s.organization_id || '', capacity: s.capacity ? String(s.capacity) : '', skills: s.skills || [], sector: s.sector || '', resource_id: s.resource_id || '' };
}
export function validateRegistration(f: { full_name: string; email: string }): string | null {
  if (f.full_name.trim().length < 3) return 'الاسم مطلوب';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'البريد الإلكتروني غير صالح';
  return null;
}

// ---------- لوحة البث الحي ----------
export function liveBoard(rows: LiveSession[], now: Date) {
  const states = rows.map(s => ({ s, st: timeState(s, now) }));
  const live = states.filter(x => x.st === 'live').map(x => x.s); const soon = states.filter(x => x.st === 'soon').map(x => x.s);
  const today = localDay(now.toISOString()); const todayAll = rows.filter(s => localDay(s.starts_at) === today && s.status !== 'cancelled');
  const upcoming = states.filter(x => x.st === 'upcoming').map(x => x.s).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return { live, soon, today: todayAll, upcoming, endedToday: todayAll.filter(s => timeState(s, now) === 'ended').length };
}

// ---------- Excel ----------
export function sessionsSheet(rows: LiveSession[], rooms: Map<string, Classroom>, trainers: Map<string, Trainer>, programs: Map<string, string>) {
  const header = ['التاريخ', 'الوقت', 'المدة', 'العنوان', 'النوع', 'البرنامج', 'الشعبة', 'المدرب', 'المنصة', 'الوصول', 'الحالة', 'رابط الانضمام'];
  return { name: 'الجلسات', rtl: true, widths: [12, 14, 8, 40, 12, 30, 16, 22, 16, 18, 10, 40], rows: [header, ...rows.map(s => { const { date, time } = isoToRiyadh(s.starts_at); return [date, time, s.duration_min, s.title_ar, kindLabel(s.kind, 'ar'), programs.get(s.program_id || '') || '', classroomLabel(rooms.get(s.classroom_id || ''), 'ar'), trainerName(trainers.get(s.trainer_id || '')), providerLabel(s.provider, 'ar'), sessionAccessLabel(s.access, 'ar'), s.status, s.join_url || (s.provider === 'athar' ? atharRoomUrl(s.id, s.title_ar) : '')]; })] };
}
export function roomsSheet(rooms: Classroom[], counts: Record<string, number>, trainers: Map<string, Trainer>, programs: Map<string, string>) {
  const header = ['البرنامج', 'الشعبة', 'الاسم', 'المدرب', 'السعة', 'المُسكَنون', 'المتاح', 'الإسكان مفتوح', 'المنصة'];
  return { name: 'الشعب', rtl: true, widths: [30, 12, 16, 22, 8, 10, 8, 12, 16], rows: [header, ...rooms.map(c => [programs.get(c.program_id) || '', c.code, c.section_name || '', trainerName(trainers.get(c.trainer_id || '')), c.capacity || 30, counts[c.id] || 0, Math.max(0, (c.capacity || 30) - (counts[c.id] || 0)), c.placement_open === false ? 'لا' : 'نعم', providerLabel(c.provider || 'teams', 'ar')])] };
}

// ---------- البريد ----------
const esc = (s: string) => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
function shell(title: string, body: string, lang: Lang): string {
  return `<!doctype html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><body style="margin:0;background:#f1f5f9;font-family:Tahoma,Arial,sans-serif"><div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0"><div style="background:#0f2a4e;color:#fff;padding:18px 22px"><div style="font-size:12px;color:#c9a24b;font-weight:bold">${lang === 'ar' ? 'أَثَر — التعلّم المباشر' : 'Athar — Live learning'}</div><div style="font-size:18px;font-weight:bold;margin-top:4px">${esc(title)}</div></div><div style="padding:20px 22px;color:#0f172a;font-size:14px;line-height:1.9">${body}</div><div style="padding:12px 22px;background:#f8fafc;color:#64748b;font-size:11.5px">${lang === 'ar' ? '© 2026 د. أحمد محمد عبدالعزيز بدوي — أَثَر' : '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — Athar'}</div></div></body></html>`;
}
export function reminderEmail(s: LiveSession, joinUrl: string, pageUrl: string, lang: Lang, name?: string | null) {
  const when = fmtWhen(s.starts_at, lang); const title = sessionTitle(s, lang);
  const subject = lang === 'ar' ? `تذكير: ${title} — ${when}` : `Reminder: ${title} — ${when}`;
  const html = shell(title, `<p>${lang === 'ar' ? `مرحبًا ${esc(name || '')}،` : `Hello ${esc(name || '')},`}</p><p>${lang === 'ar' ? 'نذكّرك بموعد الجلسة:' : 'A reminder of your session:'}</p><p><b>${esc(title)}</b><br>${esc(when)} (${lang === 'ar' ? 'توقيت الرياض' : 'Riyadh time'}) · ${s.duration_min} ${lang === 'ar' ? 'دقيقة' : 'min'} · ${esc(providerLabel(s.provider, lang))}</p><p><a href="${joinUrl}" style="display:inline-block;background:#0b8a83;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">${lang === 'ar' ? 'رابط الانضمام' : 'Join link'}</a></p><p style="color:#64748b;font-size:12.5px">${lang === 'ar' ? 'صفحة الجلسة (الحضور والمواد والتسجيل لاحقًا):' : 'Session page (attendance, materials, recording):'} <a href="${pageUrl}">${pageUrl}</a></p>`, lang);
  return { subject, html };
}
export function registeredEmail(s: LiveSession, pageUrl: string, lang: Lang, name?: string | null) {
  const title = sessionTitle(s, lang); const when = fmtWhen(s.starts_at, lang);
  return { subject: lang === 'ar' ? `تم تسجيلك: ${title}` : `You're registered: ${title}`, html: shell(title, `<p>${lang === 'ar' ? `مرحبًا ${esc(name || '')}، تم تسجيلك في الجلسة.` : `Hello ${esc(name || '')}, you are registered.`}</p><p><b>${esc(when)}</b> (${lang === 'ar' ? 'توقيت الرياض' : 'Riyadh time'})</p><p>${lang === 'ar' ? 'سيصلك رابط الانضمام في التذكير قبل الموعد، ويمكنك الدخول من صفحة الجلسة:' : 'The join link arrives with the reminder; you can also join from the session page:'} <a href="${pageUrl}">${pageUrl}</a></p>`, lang) };
}

// ============================ P6-ب ============================
// ---------- أنشطة ما بعد الجلسة ----------
export type ActivityKind = 'mcq' | 'reflection' | 'self_rating';
export type Activity = { id: string; session_id: string; created_at?: string; kind: ActivityKind; prompt_ar: string; prompt_en?: string | null; options: string[]; correct?: number | null; skill_id?: string | null; sort: number; active: boolean };
export type ActivityAnswer = { choice?: number; text?: string; rating?: number };
export type ActivityResponse = { id: string; activity_id: string; session_id: string; user_id: string; email?: string | null; answer: ActivityAnswer; score?: number | null; created_at?: string };
export const ACTIVITY_KINDS: { value: ActivityKind; label: T; hint: T }[] = [
  { value: 'mcq', label: { ar: 'سؤال اختيار من متعدد', en: 'Multiple choice' }, hint: { ar: 'يُصحَّح تلقائيًا', en: 'Auto-graded' } },
  { value: 'reflection', label: { ar: 'تأمل كتابي', en: 'Written reflection' }, hint: { ar: 'ما أهم ما تعلّمته؟ كيف ستطبقه؟', en: 'Key takeaway and how you will apply it' } },
  { value: 'self_rating', label: { ar: 'تقييم ذاتي للمهارة (1–5)', en: 'Skill self-rating (1–5)' }, hint: { ar: 'يُسجَّل كدليل مهارة في الملف', en: 'Recorded as skill evidence' } },
];
export const activityKindLabel = (v: string, lang: Lang) => lab(ACTIVITY_KINDS, v as ActivityKind, lang);
export function activityPrompt(a: Pick<Activity, 'prompt_ar' | 'prompt_en'>, lang: Lang): string { return (lang === 'en' && a.prompt_en) ? a.prompt_en : a.prompt_ar; }
export type ActivityForm = { kind: ActivityKind; prompt_ar: string; prompt_en: string; options: string[]; correct: number; skill_id: string };
export const EMPTY_ACTIVITY: ActivityForm = { kind: 'mcq', prompt_ar: '', prompt_en: '', options: ['', '', '', ''], correct: 0, skill_id: '' };
export function validateActivity(f: ActivityForm): string | null {
  if (f.prompt_ar.trim().length < 5) return 'نص النشاط مطلوب (5 أحرف على الأقل)';
  if (f.kind === 'mcq') { const opts = f.options.map(o => o.trim()).filter(Boolean); if (opts.length < 2) return 'أدخل خيارين على الأقل'; if (!(f.correct >= 0 && f.correct < f.options.length) || !f.options[f.correct]?.trim()) return 'حدد الإجابة الصحيحة'; }
  if (f.kind === 'self_rating' && !f.skill_id) return 'التقييم الذاتي يحتاج مهارة مرتبطة';
  return null;
}
export function activityPayload(f: ActivityForm, sessionId: string, sort: number, createdBy: string) {
  const options = f.kind === 'mcq' ? f.options.map(o => o.trim()) : [];
  const nonEmpty = options.map((o, i) => ({ o, i })).filter(x => x.o);
  const correct = f.kind === 'mcq' ? nonEmpty.findIndex(x => x.i === f.correct) : null;
  return { session_id: sessionId, kind: f.kind, prompt_ar: f.prompt_ar.trim(), prompt_en: f.prompt_en.trim() || null, options: nonEmpty.map(x => x.o), correct, skill_id: f.skill_id || null, sort, created_by: createdBy, active: true };
}
/** الدرجة: اختيار 100/0 · تقييم ذاتي rating×20 · تأمل بلا درجة */
export function scoreAnswer(a: Pick<Activity, 'kind' | 'correct' | 'options'>, ans: ActivityAnswer): number | null {
  if (a.kind === 'mcq') { if (typeof ans.choice !== 'number' || ans.choice < 0 || ans.choice >= (a.options || []).length) return null; return a.correct !== null && a.correct !== undefined && ans.choice === a.correct ? 100 : 0; }
  if (a.kind === 'self_rating') { const r = Number(ans.rating); return r >= 1 && r <= 5 ? r * 20 : null; }
  return null;
}
export function validateAnswer(a: Pick<Activity, 'kind' | 'options'>, ans: ActivityAnswer): string | null {
  if (a.kind === 'mcq' && (typeof ans.choice !== 'number' || ans.choice < 0 || ans.choice >= (a.options || []).length)) return 'اختر إجابة';
  if (a.kind === 'reflection' && String(ans.text || '').trim().length < 10) return 'اكتب تأملك (10 أحرف على الأقل)';
  if (a.kind === 'self_rating' && !(Number(ans.rating) >= 1 && Number(ans.rating) <= 5)) return 'اختر تقييمًا من 1 إلى 5';
  return null;
}
export function activityStats(acts: Activity[], responses: ActivityResponse[]) {
  return acts.map(a => { const rs = responses.filter(r => r.activity_id === a.id); const scored = rs.filter(r => typeof r.score === 'number'); return { activity_id: a.id, responses: rs.length, avg: scored.length ? Math.round(scored.reduce((s, r) => s + Number(r.score), 0) / scored.length) : null, correct: a.kind === 'mcq' ? rs.filter(r => Number(r.score) === 100).length : null }; });
}

// ---------- ملف التقويم ICS ----------
function icsEsc(s: string): string { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function icsDate(iso: string): string { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
export function icsForSessions(rows: LiveSession[], site: string, lang: Lang): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Athar//Live Learning//AR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEsc(lang === 'ar' ? 'أَثَر — جلساتي' : 'Athar — My sessions')}`];
  for (const s of rows) {
    const url = `${site}/live/${s.id}`; const join = s.provider === 'athar' ? atharRoomUrl(s.id, s.title_ar) : (s.join_url || '');
    lines.push('BEGIN:VEVENT', `UID:athar-${s.id}@athar-portal`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(s.starts_at)}`, `DTEND:${icsDate(endsAt(s).toISOString())}`,
      `SUMMARY:${icsEsc(sessionTitle(s, lang))}`, `DESCRIPTION:${icsEsc((lang === 'ar' ? 'المنصة: ' : 'Platform: ') + providerLabel(s.provider, lang) + (join ? `\n${lang === 'ar' ? 'رابط الانضمام: ' : 'Join: '}${join}` : '') + `\n${url}`)}`,
      `LOCATION:${icsEsc(join || providerLabel(s.provider, lang))}`, `URL:${url}`, 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(sessionTitle(s, lang))}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
export function icsFilename(s: LiveSession | null, series: boolean): string { const base = s ? (s.title_en || 'athar-session').replace(/[^\w-]+/g, '-').toLowerCase().slice(0, 40) : 'athar-sessions'; return `${base || 'athar'}${series ? '-series' : ''}.ics`; }

// ---------- التذكير التلقائي (يُستدعى من الـcron اليومي) ----------
/** الجلسات التي تستحق تذكيرًا: تبدأ خلال النافذة ولم يُرسل لها تذكير ولم تُلغَ */
export function dueForReminder(rows: LiveSession[], now: Date, windowHours = 30): LiveSession[] {
  const lo = now.getTime(); const hi = lo + windowHours * 3600000;
  return rows.filter(s => s.status === 'scheduled' && !s.reminder_sent_at && new Date(s.starts_at).getTime() > lo && new Date(s.starts_at).getTime() <= hi);
}

// ---------- جدول المدرب ----------
export function trainerWeek(rows: LiveSession[], trainerIds: string[], now: Date): { today: LiveSession[]; week: { day: string; items: LiveSession[] }[] } {
  const mine = rows.filter(s => s.trainer_id && trainerIds.includes(s.trainer_id) && s.status !== 'cancelled');
  const today = localDay(now.toISOString()); const end = new Date(now.getTime() + 7 * 86400000);
  return { today: mine.filter(s => localDay(s.starts_at) === today).sort((a, b) => a.starts_at.localeCompare(b.starts_at)), week: groupByDay(mine.filter(s => localDay(s.starts_at) > today && new Date(s.starts_at) <= end)) };
}
