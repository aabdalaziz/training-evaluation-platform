// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P45 «بروفة» — التمرين التبادلي بين الممارسين (دوال صافية، بلا اعتماديات)
 *  قبل أن يقع الموقف الصعب، يُجرَّب مع إنسان: ممارس يطلب بروفة لموقف، زميل يقبل ويلعب الدور الآخر، 15 دقيقة في غرفة أَثَر
 *  بلا تسجيل وبلا ذكاء اصطناعي؛ ثم «جملة طيبة» للآخر و«ما سأفعله مختلفًا» لنفسه. لا درجات ولا «أفضل ممثّل».
 *  لماذا «بروفة»: كلمة المسرح — تجربة قبل العرض الحقيقي يُسمح فيها بالخطأ ويُعاد المشهد.
 */
import { scrubPii, cleanText } from '../onair/registry';

export const P45_NAMES_AR = {
  phase: 'بروفة', official: 'التمرين التبادلي بين الممارسين', page: 'بروفاتي', ask: 'أطلب بروفة', accept: 'ألعب هذا الدور',
  room: 'غرفة بروفة', kind: 'جملة طيبة', self: 'ما سأفعله مختلفًا', replay: 'نعيد المشهد', swap: 'نتبادل الأدوار', learned: 'ما تعلّمناه من البروفات',
  before_station: 'موقفك قادم — بروفة قبله؟', from_need: 'أطلب بروفة لهذا الموقف', open_on_program: 'بروفات مفتوحة',
} as const;
export const SITUATION_MIN = 20; export const SITUATION_MAX = 300; export const ROLE_MAX = 80;
export const KIND_MAX = 200; export const SELF_MAX = 300; export const NOTE_MIN = 3;
export const ROOM_MINUTES = 15;          // غرفة البروفة
export const NOW_HOURS = 2;              // طلب «الآن» يبقى مفتوحًا ساعتين
export const SCHEDULE_DAYS = 7;          // الموعد المؤجَّل خلال أسبوع
export const SCHEDULE_GRACE_MIN = 30;    // بعد الموعد بنصف ساعة بلا قبول → انتهى
export const NOTES_HOURS = 24;           // نافذة كتابة الجملتين · وتسليم الجملة الطيبة إن لم يكتب الطرف الآخر
export const PUBLIC_K = 5;               // جمل «ما سأفعله مختلفًا» تُعرض للعالم حين تبلغ خمسًا في القطاع
export const QUESTION_AR = 'ما الموقف الذي تخشاه وتريد أن تجرّبه قبل أن يقع؟';
export const HINT_AR = 'صف الموقف بلا أسماء، وقل من تحتاج أن يلعب الدور الآخر. لا يُسجَّل شيء في الغرفة، ولا يدخلها ذكاء اصطناعي.';

export const SOURCES = ['free', 'need', 'station', 'case', 'offer'] as const; export type RehSource = (typeof SOURCES)[number];
export const SOURCE_AR: Record<RehSource, string> = { free: 'موقف كتبته', need: 'من حاجة معلَنة', station: 'قبل محطة', case: 'من «كل يوم مهارة»', offer: 'قبل ورشة تطبيق' };
export const MODES = ['now', 'scheduled'] as const; export type RehMode = (typeof MODES)[number];
export const MODE_AR: Record<RehMode, string> = { now: 'الآن — على الهواء', scheduled: 'موعد خلال أسبوع' };
export const CIRCLES = ['all', 'program', 'need', 'faculty'] as const; export type RehCircle = (typeof CIRCLES)[number];
export const CIRCLE_AR: Record<RehCircle, string> = { all: 'أي ممارس في أَثَر', program: 'زملاء برنامجي', need: 'من أعلنوا الحاجة نفسها', faculty: 'عضو في هيئة أَثَر' };
export const STATUSES = ['open', 'accepted', 'done', 'expired', 'cancelled', 'reported'] as const; export type RehStatus = (typeof STATUSES)[number];
export const STATUS_AR: Record<RehStatus, string> = { open: 'تنتظر من يلعب الدور', accepted: 'وُجد من يلعب الدور', done: 'تمّت', expired: 'لم يُوجد من يلعب الدور في الوقت', cancelled: 'ألغاها صاحبها', reported: 'أُغلقت وبُلّغ الطاقم' };
export const HOW = ['as_planned', 'stumbled', 'not_happened'] as const; export type RehHow = (typeof HOW)[number];
export const HOW_AR: Record<RehHow, string> = { as_planned: 'مرّ قريبًا مما جرّبت', stumbled: 'تعثّر — لكنني عرفت أين', not_happened: 'لم يقع بعد' };

export type RehRow = {
  id: string; created_at: string; user_id: string | null; email: string; name_ar: string; sector: string; situation_ar: string; my_role_ar: string; other_role_ar: string;
  source: RehSource; source_ref: string | null; mode: RehMode; scheduled_at: string | null; real_at: string | null; circle: RehCircle; circle_ref: string | null;
  status: RehStatus; expires_at: string; partner_user_id: string | null; partner_email: string | null; partner_name_ar: string | null; accepted_at: string | null;
  room_code: string | null; done_at: string | null; how_went: RehHow | null; how_went_at: string | null; reported_by: string | null; reported_at: string | null;
};
export const REH_COLS = 'id,created_at,user_id,email,name_ar,sector,situation_ar,my_role_ar,other_role_ar,source,source_ref,mode,scheduled_at,real_at,circle,circle_ref,status,expires_at,partner_user_id,partner_email,partner_name_ar,accepted_at,room_code,done_at,how_went,how_went_at,reported_by,reported_at';
export type NoteKind = 'kind_to_partner' | 'to_self';
export type NoteRow = { id: string; created_at: string; rehearsal_id: string; user_id: string | null; email: string; kind: NoteKind; text_ar: string; public_ok: boolean; sector: string };

const lower = (s: unknown) => String(s || '').trim().toLowerCase();
export const addHours = (iso: string | Date, h: number) => new Date(new Date(iso).getTime() + h * 3600000).toISOString();
export const addMinutes = (iso: string | Date, m: number) => new Date(new Date(iso).getTime() + m * 60000).toISOString();

/** تنظيف الطلب: القطاع من القاموس · الموقف 20–300 بلا بريد/هاتف · الدور الآخر مطلوب · الموعد خلال 7 أيام في المستقبل */
export function cleanRequest(b: any, sectors: readonly string[], now = new Date()): { ok: true; r: { sector: string; situation_ar: string; my_role_ar: string; other_role_ar: string; mode: RehMode; scheduled_at: string | null; real_at: string | null; circle: RehCircle; circle_ref: string | null; expires_at: string } } | { ok: false; error: string } {
  const sector = String(b?.sector || '').trim(); if (!sectors.includes(sector)) return { ok: false, error: 'اختر القطاع' };
  const situation_ar = scrubPii(cleanText(b?.situation_ar, SITUATION_MAX)); if (situation_ar.length < SITUATION_MIN) return { ok: false, error: `صف الموقف في ${SITUATION_MIN} حرفًا على الأقل` };
  const other_role_ar = scrubPii(cleanText(b?.other_role_ar, ROLE_MAX)); if (other_role_ar.length < 2) return { ok: false, error: 'من تحتاج أن يلعب الدور الآخر؟ (ولي أمر غاضب · مريض قلق · مدير…)' };
  const my_role_ar = scrubPii(cleanText(b?.my_role_ar, ROLE_MAX));
  const mode: RehMode = b?.mode === 'scheduled' ? 'scheduled' : 'now';
  let scheduled_at: string | null = null; let expires_at = addHours(now, NOW_HOURS);
  if (mode === 'scheduled') {
    const t = Date.parse(String(b?.scheduled_at || '')); if (!Number.isFinite(t)) return { ok: false, error: 'اختر موعد البروفة' };
    if (t < now.getTime() + 10 * 60000) return { ok: false, error: 'الموعد يجب أن يكون في المستقبل' }; if (t > now.getTime() + SCHEDULE_DAYS * 86400000) return { ok: false, error: `الموعد خلال ${SCHEDULE_DAYS} أيام على الأكثر` };
    scheduled_at = new Date(t).toISOString(); expires_at = addMinutes(scheduled_at, SCHEDULE_GRACE_MIN);
  }
  let real_at: string | null = null; if (b?.real_at) { const t = Date.parse(String(b.real_at)); if (Number.isFinite(t)) real_at = new Date(t).toISOString(); }
  const circle: RehCircle = (CIRCLES as readonly string[]).includes(String(b?.circle)) ? (String(b.circle) as RehCircle) : 'all';
  const circle_ref = circle === 'program' || circle === 'need' ? String(b?.circle_ref || '').trim() || null : null;
  if ((circle === 'program' || circle === 'need') && !circle_ref) return { ok: false, error: 'اختر البرنامج أو الحاجة التي تضيّق بها الدائرة' };
  return { ok: true, r: { sector, situation_ar, my_role_ar, other_role_ar, mode, scheduled_at, real_at, circle, circle_ref, expires_at } };
}
export function cleanNote(kind: NoteKind, s: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = scrubPii(cleanText(s, kind === 'kind_to_partner' ? KIND_MAX : SELF_MAX)); if (text.length < NOTE_MIN) return { ok: false, error: kind === 'kind_to_partner' ? 'اكتب جملة طيبة واحدة' : 'اكتب ما ستفعله مختلفًا' };
  return { ok: true, text };
}

export function isAsker(r: Pick<RehRow, 'user_id' | 'email'>, me: { id?: string | null; email?: string }): boolean { return !!((me.id && r.user_id === me.id) || (me.email && lower(r.email) === lower(me.email))); }
export function isPartner(r: Pick<RehRow, 'partner_user_id' | 'partner_email'>, me: { id?: string | null; email?: string }): boolean { return !!((me.id && r.partner_user_id && r.partner_user_id === me.id) || (me.email && r.partner_email && lower(r.partner_email) === lower(me.email))); }
export function isParty(r: RehRow, me: { id?: string | null; email?: string }): boolean { return isAsker(r, me) || isPartner(r, me); }

/** انتهاء كسول: طلب مفتوح تجاوز expires_at */
export function shouldExpire(r: Pick<RehRow, 'status' | 'expires_at'>, now = new Date()): boolean { return r.status === 'open' && Date.parse(r.expires_at) <= now.getTime(); }
/** من يستطيع القبول: ليس الطالب · الطلب مفتوح · مؤهَّل (طاقم أو هيئة أو له تسجيل في برنامج) · ضمن الدائرة */
export function canAccept(r: RehRow, me: { id?: string | null; email?: string; staff?: boolean; faculty?: boolean; enrolled?: boolean; programs?: string[]; needs?: string[] }, now = new Date()): { ok: true } | { ok: false; error: string } {
  if (isAsker(r, me)) return { ok: false, error: 'هذه بروفتك — تنتظر غيرك' };
  if (r.status !== 'open') return { ok: false, error: r.status === 'accepted' ? 'سبقك إليها زميل' : 'هذا الطلب لم يعد مفتوحًا' };
  if (shouldExpire(r, now)) return { ok: false, error: 'انتهى وقت هذا الطلب' };
  if (!(me.staff || me.faculty || me.enrolled)) return { ok: false, error: 'يلعب الدور من أتمّ برنامجًا في أَثَر أو عضو في هيئته' };
  if (r.circle === 'faculty' && !(me.staff || me.faculty)) return { ok: false, error: 'طلب صاحبها عضوًا في هيئة أَثَر' };
  if (r.circle === 'program' && !(me.staff || (me.programs || []).includes(String(r.circle_ref)))) return { ok: false, error: 'هذه البروفة لزملاء برنامج بعينه' };
  if (r.circle === 'need' && !(me.staff || (me.needs || []).includes(String(r.circle_ref)))) return { ok: false, error: 'هذه البروفة لمن أعلنوا الحاجة نفسها' };
  return { ok: true };
}
export function canCancel(r: RehRow, me: { id?: string | null; email?: string }): { ok: true } | { ok: false; error: string } {
  if (!isAsker(r, me)) return { ok: false, error: 'ليست بروفتك' }; if (!['open', 'accepted'].includes(r.status)) return { ok: false, error: 'لا يمكن إلغاؤها الآن' }; return { ok: true };
}
/** الجملتان: لطرفي بروفة تمّت (أو قُبلت) خلال 24 ساعة من انتهائها */
export function canNote(r: RehRow, me: { id?: string | null; email?: string }, now = new Date()): { ok: true } | { ok: false; error: string } {
  if (!isParty(r, me)) return { ok: false, error: 'لست طرفًا في هذه البروفة' };
  if (!['accepted', 'done'].includes(r.status)) return { ok: false, error: 'تُكتب الجملتان بعد بروفة تمّت' };
  const base = r.done_at || r.accepted_at; if (base && now.getTime() > Date.parse(base) + (NOTES_HOURS + ROOM_MINUTES / 60) * 3600000) return { ok: false, error: 'أُغلقت نافذة الكتابة (24 ساعة)' };
  return { ok: true };
}
/** تسليم الجملة الطيبة: بعد أن يكتب الطرفان، أو بعد 24 ساعة من انتهاء البروفة */
export function kindNoteDelivered(r: Pick<RehRow, 'done_at' | 'accepted_at'>, bothWrote: boolean, now = new Date()): boolean {
  if (bothWrote) return true; const base = r.done_at || r.accepted_at; return !!base && now.getTime() >= Date.parse(base) + NOTES_HOURS * 3600000;
}
/** «كيف مرّ؟» — لطالب البروفة بعد أن تمّت (وبعد تاريخ الموقف الحقيقي إن حُدِّد) */
export function canAnswerHow(r: RehRow, me: { id?: string | null; email?: string }, now = new Date()): boolean {
  return isAsker(r, me) && r.status === 'done' && !r.how_went && (!r.real_at || Date.parse(r.real_at) <= now.getTime());
}

/** بطاقة الدور للزميل — ما يعرفه عن الشخصية التي يلعبها (تُكتب في prompt الغرفة) */
export function roleCardAr(r: Pick<RehRow, 'situation_ar' | 'my_role_ar' | 'other_role_ar'>): string {
  const mine = r.my_role_ar ? `وأنا ${r.my_role_ar}.` : '';
  return `الموقف: ${r.situation_ar} — أنت تلعب: ${r.other_role_ar}. ${mine} ابدأ المشهد كما يبدأ في الواقع، وتعِب واغضب كما يفعل صاحبه. يُسمح بالخطأ ويُعاد المشهد.`.replace(/\s+/g, ' ').trim();
}
/** عنوان الغرفة */
export function roomTitleAr(r: Pick<RehRow, 'other_role_ar'>): string { return `بروفة: ${r.other_role_ar}`.slice(0, 120); }

/** ما يراه غير الطرفين قبل القبول: لا اسم ولا بريد */
export type RehView = {
  id: string; created_at: string; sector: string; sector_ar: string; situation_ar: string; my_role_ar: string; other_role_ar: string; source: RehSource; source_ar: string; mode: RehMode; mode_ar: string; scheduled_at: string | null; real_at: string | null;
  circle: RehCircle; circle_ar: string; circle_ref: string | null; status: RehStatus; status_ar: string; expires_at: string; room_code: string | null; accepted_at: string | null; done_at: string | null; how_went: RehHow | null; how_ar: string | null;
  mine: boolean; partner: boolean; asker_name_ar: string | null; partner_name_ar: string | null; when_ar: string;
};
export function whenAr(r: Pick<RehRow, 'mode' | 'scheduled_at' | 'expires_at'>): string {
  if (r.mode === 'now') return `الآن — الطلب مفتوح حتى ${fmtHm(r.expires_at)}`; return `موعد: ${fmtDay(r.scheduled_at || r.expires_at)} ${fmtHm(r.scheduled_at || r.expires_at)}`;
}
export const fmtHm = (iso: string | null | undefined) => { if (!iso) return ''; const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`; };
export const fmtDay = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : '');
export function toView(r: RehRow, o: { me: { id?: string | null; email?: string } | null; sectorAr: (c: string) => string }): RehView {
  const mine = !!o.me && isAsker(r, o.me); const partner = !!o.me && isPartner(r, o.me); const revealed = (mine || partner) && r.status !== 'open';
  return {
    id: r.id, created_at: r.created_at, sector: r.sector, sector_ar: o.sectorAr(r.sector), situation_ar: r.situation_ar, my_role_ar: r.my_role_ar, other_role_ar: r.other_role_ar, source: r.source, source_ar: SOURCE_AR[r.source] || r.source, mode: r.mode, mode_ar: MODE_AR[r.mode], scheduled_at: r.scheduled_at, real_at: r.real_at,
    circle: r.circle, circle_ar: CIRCLE_AR[r.circle], circle_ref: r.circle_ref, status: r.status, status_ar: STATUS_AR[r.status], expires_at: r.expires_at, room_code: (mine || partner) ? r.room_code : null, accepted_at: r.accepted_at, done_at: r.done_at, how_went: r.how_went, how_ar: r.how_went ? HOW_AR[r.how_went] : null,
    mine, partner, asker_name_ar: revealed ? (r.name_ar || null) : null, partner_name_ar: revealed ? (r.partner_name_ar || null) : null, when_ar: whenAr(r),
  };
}
/** ترتيب اللوحة: «الآن» المفتوحة أولًا (الأقرب انتهاءً)، ثم المواعيد الأقرب */
export function sortOpen(rows: RehRow[]): RehRow[] { return rows.slice().sort((a, b) => (a.mode === b.mode ? Date.parse(a.expires_at) - Date.parse(b.expires_at) : a.mode === 'now' ? -1 : 1)); }

/** العام k≥5: جمل «ما سأفعله مختلفًا» المأذون بها حين تبلغ خمسًا في القطاع — بلا أسماء ولا تواريخ دقيقة */
export function publicLearned(notes: Pick<NoteRow, 'sector' | 'text_ar' | 'kind' | 'public_ok'>[], sectorAr: (c: string) => string, k = PUBLIC_K): { sector: string; sector_ar: string; count: number; lines: string[] }[] {
  const by = new Map<string, string[]>(); for (const n of notes) { if (n.kind !== 'to_self' || !n.public_ok || !n.sector) continue; by.set(n.sector, [...(by.get(n.sector) || []), n.text_ar]); }
  return Array.from(by.entries()).filter(([, v]) => v.length >= k).map(([sector, lines]) => ({ sector, sector_ar: sectorAr(sector), count: lines.length, lines: lines.slice(0, 12) })).sort((a, b) => b.count - a.count);
}
/** سطر «ما شهده أَثَر» بالكلمات — يظهر حين تبلغ البروفات التامّة خمسًا في الشهر */
export function witnessLineAr(done: { sector: string; other_role_ar: string }[], sectorAr: (c: string) => string, k = PUBLIC_K): string | null {
  if (done.length < k) return null; const roles = new Map<string, number>(); for (const d of done) roles.set(d.other_role_ar, (roles.get(d.other_role_ar) || 0) + 1);
  const top = Array.from(roles.entries()).sort((a, b) => b[1] - a[1])[0]; const sectors = new Set(done.map(d => d.sector));
  const nAr = done.length < 10 ? `${done.length} بروفات` : `${done.length} بروفة`;
  return `جرّب ممارسو أَثَر ${nAr} هذا الشهر قبل مواقفهم الحقيقية${top && top[1] >= 2 ? ` — أكثرها مع «${top[0]}»` : ''}${sectors.size > 1 ? ` في ${sectors.size} قطاعات` : ` في ${sectorAr(Array.from(sectors)[0])}`}.`;
}
/** ملخّص اللوحة بالكلمات */
export function boardSummaryAr(rows: Pick<RehRow, 'status' | 'mode'>[]): string {
  const open = rows.filter(r => r.status === 'open').length; const now = rows.filter(r => r.status === 'open' && r.mode === 'now').length; const done = rows.filter(r => r.status === 'done').length;
  const parts: string[] = []; if (open) parts.push(open === 1 ? 'طلب واحد ينتظر من يلعب الدور' : open === 2 ? 'طلبان ينتظران' : `${open} طلبات تنتظر من يلعب الدور`); if (now) parts.push(now === 1 ? 'واحد منها الآن' : `${now} منها الآن`); if (done) parts.push(done === 1 ? 'وتمّت بروفة واحدة' : done === 2 ? 'وتمّت بروفتان' : `وتمّت ${done} بروفات`);
  return parts.length ? parts.join(' · ') : 'الصفحة تبدأ بموقفك.';
}
/** نصّ بروفة من حاجة معلَنة / محطة / موقف اليوم — يملأ الاستمارة ولا يُرسَل */
export function situationFromNeed(text: string): string { return cleanText(text, SITUATION_MAX); }
export function situationFromStation(programAr: string): string { return cleanText(`الموقف الذي سأطبّق فيه ما تعلّمته في «${programAr}» قبل أن تُفتح محطتي`, SITUATION_MAX); }
export function situationFromCase(c: { situation_ar: string; role_ar?: string | null; parties_ar?: unknown }): { situation_ar: string; my_role_ar: string; other_role_ar: string } {
  const parties = Array.isArray(c.parties_ar) ? (c.parties_ar as unknown[]).map(p => (typeof p === 'string' ? p : String((p as any)?.name_ar || (p as any)?.name || ''))).filter(Boolean) : [];
  return { situation_ar: cleanText(c.situation_ar, SITUATION_MAX), my_role_ar: cleanText(c.role_ar || '', ROLE_MAX), other_role_ar: cleanText(parties[0] || '', ROLE_MAX) };
}
