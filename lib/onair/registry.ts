// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P33 «أَثَر معك — على الهواء» (Athar on Air) — النقي (بلا قاعدة بيانات):
 *  الدرجات الثلاث (عونٌ سريع · جلسة دعم · استشارة) · الوجوه · حدود الهواء · آلة حالات الطلب · ترتيب الصفّ بالمجال
 *  · الاسم المستعار · ساعات الحضور وأهلية «شهادة حضور على الهواء» ATH-OA · سطر «ما شهده أَثَر» · إحصاءات عامة بلا أسماء.
 *  مبدأ: الصعود إلى الهواء فعل شخصي (ينطفئ وحده)، الإنسان يردّ باسمه، والذكاء الاصطناعي يرتّب ويلخّص ولا يتكلم باسم أحد.
 */

export type Grade = 'quick' | 'session' | 'consult';
export const GRADES: Grade[] = ['quick', 'session', 'consult'];
export const GRADE_LABEL: Record<Grade, { ar: string; en: string }> = {
  quick: { ar: 'عونٌ سريع', en: 'Quick help' }, session: { ar: 'جلسة دعم', en: 'Support session' }, consult: { ar: 'استشارة', en: 'Consultation' },
};
export const GRADE_HINT: Record<Grade, { ar: string; en: string }> = {
  quick: { ar: 'دقائق · نصّ أو صوت · أول من يضغط «أستقبل» يكون معك · يُغلق بعد 15 دقيقة', en: 'Minutes · text or voice · first to accept is with you · closes after 15 minutes' },
  session: { ar: '20 دقيقة في غرفة أَثَر تُفتح الآن (أو رابط العضو) · ترجمة حيّة ومقعد مترجم', en: '20 minutes in an Athar room opened now (or the member’s link) · live captions' },
  consult: { ar: 'تصل الطاقم ممهورةً بالعضو وتتحوّل إلى عقد تعاون ATH-CO', en: 'Reaches staff tagged with the member and becomes an ATH-CO agreement' },
};

export type Face = 'expert' | 'trainer' | 'interpreter' | 'staff';
export const FACES: Face[] = ['expert', 'trainer', 'interpreter', 'staff'];
export const FACE_AR: Record<Face, string> = { expert: 'خبير استشاري', trainer: 'مدرب', interpreter: 'مترجم لغة إشارة', staff: 'طاقم أَثَر' };
export const FACE_EN: Record<Face, string> = { expert: 'Consulting expert', trainer: 'Trainer', interpreter: 'Sign-language interpreter', staff: 'Athar staff' };

export type Status = 'open' | 'taken' | 'done' | 'escalated' | 'expired' | 'cancelled';
export const STATUS_AR: Record<Status, string> = { open: 'في الصفّ', taken: 'معك الآن', done: 'انتهى', escalated: 'لدى الطاقم', expired: 'لم يردّ أحد', cancelled: 'أُلغي' };
export type Outcome = 'solved' | 'needs_session' | 'needs_staff';
export const OUTCOME_AR: Record<Outcome, string> = { solved: 'حُلّ', needs_session: 'يحتاج جلسة', needs_staff: 'يحتاج الطاقم' };

/** الحدود (قرارات §11 — الافتراضيات) */
export const ON_AIR_MINUTES = 90;            // ينطفئ وحده
export const ON_AIR_MAX_MINUTES = 240;       // أقصى تجديد في ضغطة واحدة
export const QUICK_TIMEOUT_MIN = 3;          // بلا ردّ → بدائل
export const QUICK_CLOSE_MIN = 15;           // يُغلق الخيط
export const SESSION_MINUTES = 20; export const SESSION_EXTEND_MINUTES = 10;
export const MAX_OPEN_PER_ASKER = 3; export const MAX_OPEN_ANON = 1;
export const MAX_WINDOWS = 5;
export const TEXT_MIN = 5; export const TEXT_MAX = 500; export const MSG_MAX = 1000; export const CHANGED_MAX = 300;
export const CERT_HOURS = 10; export const CERT_MEETINGS = 8;   // شهادة الحضور
export const ON_AIR_K = 1;                   // الحضور معلَن بإرادة أصحابه — يُعرض من 1 (الأسماء خلف الدخول)
export const STATS_K = 5;                    // أي رقم عن الطالبين (لا عن الحاضرين) يبقى k≥5

export const cleanGrades = (xs: unknown): Grade[] => Array.from(new Set((Array.isArray(xs) ? xs : []).map(String).filter((x): x is Grade => (GRADES as string[]).includes(x))));
export const cleanDomains = (xs: unknown): string[] => Array.from(new Set((Array.isArray(xs) ? xs : []).map(x => String(x).trim().toLowerCase().replace(/[^a-z0-9_\-\u0600-\u06FF]/g, '')).filter(x => x.length >= 2 && x.length <= 40))).slice(0, 12);
export const cleanLink = (s: unknown): string | null => { const v = String(s || '').trim(); if (!v) return null; if (!/^https:\/\/[^\s]{6,300}$/i.test(v)) return null; return v; };
export const cleanText = (s: unknown, max = TEXT_MAX) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

/** ما يحقّ لصاحب الوجوه أن يختاره من الأوجه */
export function allowedFaces(p: { directoryFaces: string[]; isStaff: boolean; interpreterOk: boolean }): Face[] {
  const out: Face[] = [];
  if (p.directoryFaces.includes('expert')) out.push('expert');
  if (p.directoryFaces.includes('trainer')) out.push('trainer');
  if (p.interpreterOk) out.push('interpreter');
  if (p.isStaff) out.push('staff');
  return out;
}

export type Presence = {
  user_id: string; email: string; face: Face; receives: Grade[]; domains: string[]; alt_link: string | null;
  on_air_until: string | null; grounded_at: string | null; grounded_note: string | null; meta: Record<string, any>; updated_at?: string;
};
export const isOnAir = (p: Pick<Presence, 'on_air_until' | 'grounded_at'>, now = Date.now()) => !p.grounded_at && !!p.on_air_until && Date.parse(p.on_air_until) > now;
export const minutesLeft = (p: Pick<Presence, 'on_air_until'>, now = Date.now()) => p.on_air_until ? Math.max(0, Math.ceil((Date.parse(p.on_air_until) - now) / 60000)) : 0;
export const goOnAir = (minutes: number, now = Date.now()) => new Date(now + Math.min(ON_AIR_MAX_MINUTES, Math.max(15, Math.round(minutes || ON_AIR_MINUTES))) * 60000).toISOString();

/** ما يراه العامة من الحاضر: بلا بريد ولا رابط بديل ولا meta */
export function publicPresence(p: Presence, person: { name_ar: string; slug: string | null; photo_url: string | null; title_ar: string | null } | null, now = Date.now()) {
  return { user_id: p.user_id, face: p.face, face_ar: FACE_AR[p.face], receives: p.receives, domains: p.domains, minutes_left: minutesLeft(p, now),
    name_ar: person?.name_ar || (p.face === 'staff' ? 'طاقم أَثَر' : 'عضو هيئة أَثَر'), slug: person?.slug || null, photo_url: person?.photo_url || null, title_ar: person?.title_ar || null };
}

export type Request = {
  id: number | string; kind: Grade; status: Status; asker_user_id: string | null; asker_email: string | null; asker_alias: string; domain: string | null; text_ar: string;
  receiver_user_id: string | null; room_code: string | null; taken_at: string | null; done_at: string | null; outcome: Outcome | null; what_changed_ar: string | null;
  duration_min: number | null; meta: Record<string, any>; created_at: string;
};
export const alias = (rnd: () => number = Math.random) => `سائل ${1000 + Math.floor(rnd() * 9000)}`;

/** آلة الحالات: من يفعل ماذا */
export function canTake(r: Pick<Request, 'status' | 'asker_user_id' | 'receiver_user_id'>, me: string): { ok: true } | { ok: false; error: string } {
  if (r.status !== 'open') return { ok: false, error: 'الطلب لم يعد في الصفّ' };
  if (r.asker_user_id && r.asker_user_id === me) return { ok: false, error: 'لا تستقبل طلبك أنت' };
  return { ok: true };
}
export function canClose(r: Pick<Request, 'status' | 'receiver_user_id' | 'asker_user_id'>, me: string, isStaff = false) {
  if (!['taken', 'open'].includes(r.status)) return { ok: false as const, error: 'الطلب مغلق' };
  if (r.receiver_user_id === me || r.asker_user_id === me || isStaff) return { ok: true as const };
  return { ok: false as const, error: 'ليس طلبك' };
}
export const nextStatus = (outcome: Outcome): Status => (outcome === 'needs_staff' ? 'escalated' : 'done');
/** عونٌ سريع بلا ردّ بعد 3 دقائق → منتهٍ (يُحسب عند القراءة — لا كرون) */
export const quickExpired = (r: Pick<Request, 'kind' | 'status' | 'created_at'>, now = Date.now()) => r.kind === 'quick' && r.status === 'open' && now - Date.parse(r.created_at) > QUICK_TIMEOUT_MIN * 60000;
export const quickClosed = (r: Pick<Request, 'kind' | 'status' | 'taken_at'>, now = Date.now()) => r.kind === 'quick' && r.status === 'taken' && !!r.taken_at && now - Date.parse(r.taken_at) > QUICK_CLOSE_MIN * 60000;

/** ترتيب الصفّ للمُستقبِل: مجاله أولًا ثم الأقدم */
export function rankQueue<T extends Pick<Request, 'domain' | 'created_at' | 'kind'>>(open: T[], mine: { receives: Grade[]; domains: string[] }): T[] {
  const dom = new Set(mine.domains);
  return open.filter(r => mine.receives.includes(r.kind)).sort((a, b) => {
    const am = a.domain && dom.has(a.domain) ? 0 : 1, bm = b.domain && dom.has(b.domain) ? 0 : 1;
    return am - bm || Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}
/** من يُنادى على طلب: الحاضرون الذين يستقبلون هذه الدرجة — مجاله أولًا */
export function matchReceivers<T extends Presence>(present: T[], r: Pick<Request, 'kind' | 'domain'>, now = Date.now()): T[] {
  return present.filter(p => isOnAir(p, now) && p.receives.includes(r.kind)).sort((a, b) => {
    const am = r.domain && a.domains.includes(r.domain) ? 0 : 1, bm = r.domain && b.domains.includes(r.domain) ? 0 : 1;
    return am - bm || Date.parse(a.on_air_until || '') - Date.parse(b.on_air_until || '');
  });
}

/** ساعات الحضور من اللقاءات الفعلية (لا من المفتاح) */
export type Hours = { meetings: number; minutes: number; hours: number; by_kind: Record<Grade, number>; eligible: boolean; remaining_hours: number; remaining_meetings: number };
export function hoursFrom(done: Pick<Request, 'kind' | 'status' | 'duration_min'>[]): Hours {
  const d = done.filter(r => r.status === 'done'); const by_kind: Record<Grade, number> = { quick: 0, session: 0, consult: 0 };
  let minutes = 0; for (const r of d) { by_kind[r.kind]++; minutes += Math.max(1, Math.min(240, Number(r.duration_min) || (r.kind === 'session' ? SESSION_MINUTES : 10))); }
  const hours = Math.round((minutes / 60) * 10) / 10; const meetings = d.length;
  return { meetings, minutes, hours, by_kind, eligible: hours >= CERT_HOURS && meetings >= CERT_MEETINGS, remaining_hours: Math.max(0, Math.round((CERT_HOURS - hours) * 10) / 10), remaining_meetings: Math.max(0, CERT_MEETINGS - meetings) };
}
export const certCode = (rnd: () => string) => `ATH-OA-${rnd().slice(0, 4).toUpperCase()}-${rnd().slice(0, 4).toUpperCase()}`;
/** سطر «ما شهده أَثَر» */
export function onAirWitnessLine(h: Pick<Hours, 'meetings' | 'hours'>): string | null {
  if (h.meetings <= 0) return null;
  const m = h.meetings === 1 ? 'لقاءً واحدًا' : h.meetings === 2 ? 'لقاءين' : h.meetings <= 10 ? `${h.meetings} لقاءات` : `${h.meetings} لقاءً`;
  return `كان على الهواء ${h.hours} ساعة · ${m}`;
}

/** متوسط زمن الردّ (دقائق) من الطلبات التي قُبلت */
export function avgResponseMin(taken: Pick<Request, 'created_at' | 'taken_at'>[]): number | null {
  const xs = taken.filter(r => r.taken_at).map(r => (Date.parse(r.taken_at!) - Date.parse(r.created_at)) / 60000).filter(x => x >= 0 && x < 600);
  if (!xs.length) return null; return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}
/** أرقام عامة: الحاضرون من 1 · الطالبون k≥5 */
export function publicStats(inp: { present: number; faces: Partial<Record<Face, number>>; month_done: number; askers_month: number; avg_response_min: number | null }) {
  return { present: inp.present, faces: inp.faces, meetings_month: inp.month_done >= STATS_K ? inp.month_done : null, askers_month: inp.askers_month >= STATS_K ? inp.askers_month : null, avg_response_min: inp.month_done >= STATS_K ? inp.avg_response_min : null, k: STATS_K };
}

/** نصّ المؤقّت للجلسة */
export const sessionEndsAt = (startedIso: string, extended = false) => new Date(Date.parse(startedIso) + (SESSION_MINUTES + (extended ? SESSION_EXTEND_MINUTES : 0)) * 60000).toISOString();

/** تلخيص الخيط للمُستقبِل (يعتمده الطالب) — المطالبة تحمل نصّ الخيط العام فقط */
export function summaryPrompt(messages: { from_role: string; text_ar: string }[]) {
  const body = messages.map(m => `${m.from_role === 'asker' ? 'السائل' : m.from_role === 'receiver' ? 'المُستقبِل' : 'النظام'}: ${m.text_ar}`).join('\n').slice(0, 6000);
  return { system: 'أنت كاتب محاضر في أَثَر. لخّص خيط «عونٍ سريع» في ثلاث جمل عربية فصيحة قصيرة: السؤال، ما قيل، ما بقي. لا تذكر أسماء ولا تضف نصيحة من عندك. أعد JSON: {"summary_ar": "..."}', user: body };
}
export function localSummary(messages: { from_role: string; text_ar: string }[]): string {
  const q = messages.find(m => m.from_role === 'asker')?.text_ar || ''; const a = messages.filter(m => m.from_role === 'receiver').map(m => m.text_ar).join(' ');
  return `السؤال: ${q.slice(0, 140)}${q.length > 140 ? '…' : ''}\nما قيل: ${a.slice(0, 220) || '—'}${a.length > 220 ? '…' : ''}`;
}

/** نافذة معلَنة */
export type Win = { id: number | string; user_id: string; weekday: number; from_min: number; to_min: number; note_ar: string | null };
export const WEEKDAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function cleanWindow(b: any): { ok: true; w: Pick<Win, 'weekday' | 'from_min' | 'to_min' | 'note_ar'> } | { ok: false; error: string } {
  const weekday = Number(b?.weekday), from_min = Number(b?.from_min), to_min = Number(b?.to_min);
  if (!(weekday >= 0 && weekday <= 6)) return { ok: false, error: 'اليوم غير صحيح' };
  if (!(from_min >= 0 && to_min <= 1440 && to_min - from_min >= 30 && to_min - from_min <= 240)) return { ok: false, error: 'المدة بين 30 دقيقة و4 ساعات' };
  return { ok: true, w: { weekday, from_min, to_min, note_ar: cleanText(b?.note_ar, 120) || null } };
}
/** النافذة القادمة خلال 7 أيام (توقيت الرياض UTC+3) */
export function nextWindowAt(w: Pick<Win, 'weekday' | 'from_min'>, now = new Date()): Date {
  const riyadh = new Date(now.getTime() + 3 * 3600000); const today = riyadh.getUTCDay();
  let delta = (w.weekday - today + 7) % 7; const minsNow = riyadh.getUTCHours() * 60 + riyadh.getUTCMinutes();
  if (delta === 0 && w.from_min <= minsNow) delta = 7;
  const d = new Date(Date.UTC(riyadh.getUTCFullYear(), riyadh.getUTCMonth(), riyadh.getUTCDate() + delta, 0, w.from_min, 0)); return new Date(d.getTime() - 3 * 3600000);
}
export const TAGLINE_AR = 'اسأل الآن… فثمّة إنسان يسمعك';
