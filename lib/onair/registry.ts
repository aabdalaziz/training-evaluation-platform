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
export type MentorStatus = 'invited' | 'accepted' | 'declined' | 'done';   // P34 ميراث الهواء
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
  text_only?: boolean; mentor_user_id?: string | null; mentor_status?: MentorStatus | null; shadow_left?: number;   // P34
};
export const isOnAir = (p: Pick<Presence, 'on_air_until' | 'grounded_at'>, now = Date.now()) => !p.grounded_at && !!p.on_air_until && Date.parse(p.on_air_until) > now;
export const minutesLeft = (p: Pick<Presence, 'on_air_until'>, now = Date.now()) => p.on_air_until ? Math.max(0, Math.ceil((Date.parse(p.on_air_until) - now) / 60000)) : 0;
export const goOnAir = (minutes: number, now = Date.now()) => new Date(now + Math.min(ON_AIR_MAX_MINUTES, Math.max(15, Math.round(minutes || ON_AIR_MINUTES))) * 60000).toISOString();

/** ما يراه العامة من الحاضر: بلا بريد ولا رابط بديل ولا meta */
export function publicPresence(p: Presence, person: { name_ar: string; slug: string | null; photo_url: string | null; title_ar: string | null } | null, now = Date.now()) {
  return { user_id: p.user_id, face: p.face, face_ar: FACE_AR[p.face], receives: p.receives, domains: p.domains, minutes_left: minutesLeft(p, now),
    name_ar: person?.name_ar || (p.face === 'staff' ? 'طاقم أَثَر' : 'عضو هيئة أَثَر'), slug: person?.slug || null, photo_url: person?.photo_url || null, title_ar: person?.title_ar || null, text_only: !!p.text_only };
}

export type Request = {
  id: number | string; kind: Grade; status: Status; asker_user_id: string | null; asker_email: string | null; asker_alias: string; domain: string | null; text_ar: string;
  receiver_user_id: string | null; room_code: string | null; taken_at: string | null; done_at: string | null; outcome: Outcome | null; what_changed_ar: string | null;
  duration_min: number | null; meta: Record<string, any>; created_at: string; org_id?: string | null;   // P34 هواء الجهة
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
export const quickExpired = (r: Pick<Request, 'kind' | 'status' | 'created_at' | 'meta'>, now = Date.now()) => r.kind === 'quick' && r.status === 'open' && now - Date.parse(r.created_at) > (isBottle(r) ? BOTTLE_HOURS * 60 : QUICK_TIMEOUT_MIN) * 60000;
export const quickClosed = (r: Pick<Request, 'kind' | 'status' | 'taken_at'>, now = Date.now()) => r.kind === 'quick' && r.status === 'taken' && !!r.taken_at && now - Date.parse(r.taken_at) > QUICK_CLOSE_MIN * 60000;

/** ترتيب الصفّ للمُستقبِل: مجاله أولًا ثم الأقدم */
export function rankQueue<T extends Pick<Request, 'domain' | 'created_at' | 'kind' | 'meta'>>(open: T[], mine: { receives: Grade[]; domains: string[]; text_only?: boolean }): T[] {
  const dom = new Set(mine.domains);
  return open.filter(r => mine.receives.includes(r.kind) && !(mine.text_only && r.kind === 'session' && r.meta?.prefer_text === false)).sort((a, b) => {
    const ab = isBottle(a) ? 0 : 1, bb = isBottle(b) ? 0 : 1;                      // الزجاجات أولًا — انتظرت أكثر
    const am = a.domain && dom.has(a.domain) ? 0 : 1, bm = b.domain && dom.has(b.domain) ? 0 : 1;
    return ab - bb || am - bm || Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}
/** من يُنادى على طلب: الحاضرون الذين يستقبلون هذه الدرجة — مجاله أولًا */
export function matchReceivers<T extends Presence>(present: T[], r: Pick<Request, 'kind' | 'domain'> & { meta?: Record<string, any>; org_id?: string | null }, now = Date.now(), orgMembers?: Set<string>): T[] {
  const preferText = !!r.meta?.prefer_text;
  return present.filter(p => isOnAir(p, now) && p.receives.includes(r.kind) && (!r.org_id || !orgMembers || orgMembers.has(p.user_id))).sort((a, b) => {
    const at = preferText ? (a.text_only ? 0 : 1) : 0, bt = preferText ? (b.text_only ? 0 : 1) : 0;   // الهواء الصامت: من يستقبل بالنص أولًا
    const am = r.domain && a.domains.includes(r.domain) ? 0 : 1, bm = r.domain && b.domains.includes(r.domain) ? 0 : 1;
    return at - bt || am - bm || Date.parse(a.on_air_until || '') - Date.parse(b.on_air_until || '');
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

// ───────────────────────────── P34 «الهواء يتّسع» ─────────────────────────────
export const BOTTLE_HOURS = 72;                 // «رسالة في زجاجة» تبقى 72 ساعة
export const SHADOW_REQUESTS = 5;               // «ميراث الهواء»: أول 5 طلبات
export const GOLDEN_REMIND_MIN = 60;            // تذكير قبل الساعة الذهبية
export const GOLDEN_DEFAULT_MIN = 60;
export const isBottle = (r: { meta?: Record<string, any> | null }) => !!r?.meta?.bottle;
export const BOTTLE_AR = 'رسالة في زجاجة';
export const P34_NAMES_AR = { golden: 'ساعة الهواء الذهبية', quiet: 'الهواء الصامت', echo: 'صدى السؤال', legacy: 'ميراث الهواء', org: 'هواء الجهة', map: 'خريطة الحضور الحيّة', signed: 'الهواء بالإشارة', bottle: BOTTLE_AR } as const;

/** 7) الهواء بالإشارة + 2) الهواء الصامت: إعدادات افتراضية للحوار من «احتياجاتي» — تُحسب على المتصفح فقط ولا تُرسل */
export function dialogDefaults(needs: readonly string[] | null | undefined): { grade: Grade | null; interpreter: boolean; prefer_text: boolean; note_ar: string | null } {
  const n = new Set(needs || []);
  if (n.has('sign_language')) return { grade: 'session', interpreter: true, prefer_text: true, note_ar: 'جهّزنا لك جلسة دعم بمقعد مترجم إشارة — غيّر ما تشاء.' };
  if (n.has('hard_hearing') || n.has('focus') || n.has('simple')) return { grade: null, interpreter: false, prefer_text: true, note_ar: 'سنفضّل النصّ في هذا اللقاء — يمكنك إلغاء ذلك.' };
  return { grade: null, interpreter: false, prefer_text: false, note_ar: null };
}

/** 1) ساعة الهواء الذهبية */
export type Golden = { id: number | string; title_ar: string; weekday: number; from_min: number; duration_min: number; active: boolean };
export function cleanGolden(b: any): { ok: true; g: Omit<Golden, 'id' | 'active'> } | { ok: false; error: string } {
  const weekday = Number(b?.weekday), from_min = Number(b?.from_min), duration_min = Number(b?.duration_min ?? GOLDEN_DEFAULT_MIN);
  if (!(weekday >= 0 && weekday <= 6)) return { ok: false, error: 'اليوم غير صحيح' };
  if (!(from_min >= 0 && from_min < 1440)) return { ok: false, error: 'الوقت غير صحيح' };
  if (!(duration_min >= 30 && duration_min <= 180)) return { ok: false, error: 'المدة بين 30 و180 دقيقة' };
  return { ok: true, g: { title_ar: cleanText(b?.title_ar, 80) || 'ساعة الهواء الذهبية', weekday, from_min, duration_min } };
}
/** مفتاح الأسبوع (ISO) للتعهّد — الأسبوع الذي تقع فيه الساعة القادمة */
export function weekKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); const w = Math.ceil(((x.getTime() - y0.getTime()) / 86400000 + 1) / 7);
  return `${x.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}
/** حالة الساعة الذهبية الآن: قادمة (مع العدّاد) أو جارية */
export function goldenState(g: Pick<Golden, 'weekday' | 'from_min' | 'duration_min'>, now = new Date()): { live: boolean; starts_at: string; ends_at: string; minutes_to: number; week_key: string } {
  const next = nextWindowAt(g, now);                                  // القادمة (قد تكون بعد 7 أيام إن بدأت اليوم)
  const prev = new Date(next.getTime() - 7 * 86400000);               // الحدوث السابق
  const prevEnd = new Date(prev.getTime() + g.duration_min * 60000);
  if (prev.getTime() <= now.getTime() && now.getTime() < prevEnd.getTime()) return { live: true, starts_at: prev.toISOString(), ends_at: prevEnd.toISOString(), minutes_to: 0, week_key: weekKey(prev) };
  return { live: false, starts_at: next.toISOString(), ends_at: new Date(next.getTime() + g.duration_min * 60000).toISOString(), minutes_to: Math.ceil((next.getTime() - now.getTime()) / 60000), week_key: weekKey(next) };
}
export function countdownAr(minutes: number): string {
  if (minutes <= 0) return 'الآن';
  const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60;
  const parts: string[] = []; if (d) parts.push(d === 1 ? 'يوم' : d === 2 ? 'يومان' : `${d} أيام`); if (h) parts.push(h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : `${h} ساعات`); if (!d && m) parts.push(m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتان' : `${m} دقائق`);
  return `بعد ${parts.join(' و')}`;
}

/** 4) ميراث الهواء */
export function canAdopt(mentor: { eligible: boolean; id: string }, mentee: Pick<Presence, 'user_id' | 'mentor_status' | 'shadow_left'> | null): { ok: true } | { ok: false; error: string } {
  if (!mentor.eligible) return { ok: false, error: 'المرافقة لحاملي «شهادة حضور على الهواء» (10 ساعات و8 لقاءات)' };
  if (mentee && mentee.user_id === mentor.id) return { ok: false, error: 'لا ترافق نفسك' };
  if (mentee && mentee.mentor_status === 'accepted' && (mentee.shadow_left || 0) > 0) return { ok: false, error: 'لديه مرافق بالفعل' };
  return { ok: true };
}
/** عند «أستقبل»: هل يُرفق المرافق بهذا الطلب؟ يُعيد ما يُحدَّث على الحضور */
export function shadowOnTake(p: Pick<Presence, 'mentor_user_id' | 'mentor_status' | 'shadow_left'>): { shadow_user_id: string | null; patch: Partial<Pick<Presence, 'shadow_left' | 'mentor_status'>> | null } {
  if (p.mentor_status !== 'accepted' || !p.mentor_user_id || (p.shadow_left || 0) <= 0) return { shadow_user_id: null, patch: null };
  const left = (p.shadow_left || 0) - 1; return { shadow_user_id: p.mentor_user_id, patch: { shadow_left: left, ...(left === 0 ? { mentor_status: 'done' } : {}) } };
}

/** 6) خريطة الحضور الحيّة — مدن المملكة (تقريبية، للعرض فقط) على لوحة 100×100 */
export const CITY_POINTS: Record<string, { x: number; y: number; ar: string }> = {
  riyadh: { x: 56, y: 50, ar: 'الرياض' }, jeddah: { x: 25, y: 60, ar: 'جدة' }, makkah: { x: 28, y: 61, ar: 'مكة المكرمة' }, madinah: { x: 27, y: 44, ar: 'المدينة المنورة' },
  dammam: { x: 74, y: 44, ar: 'الدمام' }, khobar: { x: 75, y: 45, ar: 'الخبر' }, dhahran: { x: 74, y: 46, ar: 'الظهران' }, alahsa: { x: 72, y: 52, ar: 'الأحساء' },
  taif: { x: 31, y: 62, ar: 'الطائف' }, abha: { x: 36, y: 84, ar: 'أبها' }, khamis: { x: 37, y: 84, ar: 'خميس مشيط' }, jazan: { x: 32, y: 92, ar: 'جازان' }, najran: { x: 47, y: 88, ar: 'نجران' },
  tabuk: { x: 18, y: 22, ar: 'تبوك' }, hail: { x: 40, y: 32, ar: 'حائل' }, buraidah: { x: 48, y: 40, ar: 'بريدة' }, qassim: { x: 48, y: 40, ar: 'القصيم' }, sakaka: { x: 32, y: 16, ar: 'سكاكا' }, arar: { x: 40, y: 12, ar: 'عرعر' }, albaha: { x: 32, y: 72, ar: 'الباحة' }, yanbu: { x: 20, y: 48, ar: 'ينبع' }, jubail: { x: 72, y: 40, ar: 'الجبيل' }, neom: { x: 12, y: 18, ar: 'نيوم' },
};
const CITY_ALIASES: [RegExp, string][] = [[/رياض|riyadh/i, 'riyadh'], [/جد[هة]|jeddah|jidda/i, 'jeddah'], [/مكة|مكه|makkah|mecca/i, 'makkah'], [/مدينة|madinah|medina/i, 'madinah'], [/دمام|dammam/i, 'dammam'], [/خبر|khobar/i, 'khobar'], [/ظهران|dhahran/i, 'dhahran'], [/أحساء|احساء|hofuf|ahsa/i, 'alahsa'], [/طائف|taif/i, 'taif'], [/أبها|ابها|abha/i, 'abha'], [/خميس|khamis/i, 'khamis'], [/جازان|جيزان|jazan|jizan/i, 'jazan'], [/نجران|najran/i, 'najran'], [/تبوك|tabuk/i, 'tabuk'], [/حائل|حايل|hail/i, 'hail'], [/بريدة|buraidah/i, 'buraidah'], [/قصيم|qassim/i, 'qassim'], [/سكاكا|جوف|sakaka|jouf/i, 'sakaka'], [/عرعر|arar/i, 'arar'], [/باحة|baha/i, 'albaha'], [/ينبع|yanbu/i, 'yanbu'], [/جبيل|jubail/i, 'jubail'], [/نيوم|neom/i, 'neom']];
export const cityKey = (city: string | null | undefined): string | null => { const c = String(city || '').trim(); if (!c) return null; for (const [re, k] of CITY_ALIASES) if (re.test(c)) return k; return null; };
/** تجميع الحاضرين بالمدن — أعداد فقط، بلا أسماء؛ من لا مدينة له يُعدّ في «أخرى» */
export function liveMap(present: { user_id: string }[], cityOf: Record<string, string | null | undefined>): { points: { key: string; ar: string; x: number; y: number; n: number }[]; other: number; total: number } {
  const n: Record<string, number> = {}; let other = 0;
  for (const p of present) { const k = cityKey(cityOf[p.user_id]); if (k) n[k] = (n[k] || 0) + 1; else other++; }
  const points = Object.entries(n).map(([key, c]) => ({ key, ar: CITY_POINTS[key].ar, x: CITY_POINTS[key].x, y: CITY_POINTS[key].y, n: c })).sort((a, b) => b.n - a.n);
  return { points, other, total: present.length };
}

/** 3) صدى السؤال — مطالبة صياغة «مهارة اليوم» من خيط مجهّل */
export function echoPrompt(input: { text_ar: string; summary_ar: string; domain: string | null }) {
  return {
    system: 'أنت مصمّم «مهارة اليوم» في أَثَر. من سؤال واقعي حُلّ على الهواء، اكتب موقفًا تدريبيًا قصيرًا بالعربية الفصحى بلا أسماء ولا جهات ولا تفاصيل تعريفية. أعد JSON فقط: {"title_ar":"عنوان ≤ 60 حرفًا","situation_ar":"الموقف في 2–3 جمل","ask_ar":"ما المطلوب من المتدرّب؟ جملة واحدة","rubric":["معيار 1","معيار 2","معيار 3"]}',
    user: `المجال: ${input.domain || 'عام'}\nالسؤال: ${input.text_ar.slice(0, 500)}\nخلاصة الحلّ: ${input.summary_ar.slice(0, 600)}`,
  };
}
export function localEcho(input: { text_ar: string; summary_ar: string; domain: string | null }) {
  const t = input.text_ar.replace(/\s+/g, ' ').trim();
  return { title_ar: (t.length > 56 ? t.slice(0, 56) + '…' : t) || 'موقف من الهواء', situation_ar: `وصلك على الهواء سؤال: «${t.slice(0, 220)}»`, ask_ar: 'اكتب كيف تتصرّف خلال خمس دقائق، وما أول ما تسأل عنه.', rubric: ['تشخيص المشكلة قبل الحلّ', 'خطوة أولى عملية', 'ما الذي ستتحقّق منه بعدها'] };
}
export type EchoDraft = { title_ar: string; situation_ar: string; ask_ar: string; rubric: string[]; domain_code?: string | null };
export function parseEcho(x: any): EchoDraft | null {
  if (!x || typeof x !== 'object') return null; const title_ar = cleanText(x.title_ar, 80), situation_ar = cleanText(x.situation_ar, 600), ask_ar = cleanText(x.ask_ar, 240);
  const rubric = Array.isArray(x.rubric) ? x.rubric.map((r: any) => cleanText(r, 120)).filter(Boolean).slice(0, 5) : [];
  if (!title_ar || !situation_ar || !ask_ar || rubric.length < 2) return null; return { title_ar, situation_ar, ask_ar, rubric };
}
/** تجهيل بسيط قبل أي إرسال للنموذج: بريد · هاتف · روابط */
export const scrubPii = (s: string) => String(s || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[بريد]').replace(/(\+?\d[\d\s-]{7,}\d)/g, '[رقم]').replace(/https?:\/\/\S+/g, '[رابط]');

/** 5) هواء الجهة — سطر «أثر الجهة» */
export function orgAirLine(x: { hours_given: number; meetings_given: number; hours_received: number; askers: number }): string | null {
  if (x.meetings_given <= 0 && x.askers < STATS_K) return null;
  const parts: string[] = [];
  if (x.meetings_given > 0) parts.push(`منسوبوها قدّموا ${x.hours_given} ساعة على الهواء في ${x.meetings_given} لقاءً`);
  if (x.askers >= STATS_K) parts.push(`و${x.askers} من منسوبيها سألوا`);
  return parts.join(' ');
}
