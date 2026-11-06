// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P51 «دفتر اليوم» — صفحة صباح المدرّب · الاسم الرسمي: «سجلّ المدرّب اليومي» / Trainer Daily Ledger
 *  يجمع — من مصادره الحيّة وبلا جدول جديد — ما يحتاجه المدرّب في دقيقة: جلساتي اليوم · من غاب أمس · مِران شُعبي (المتوقّفون) ·
 *  ما ينتظر توقيعي (P50 بنطاق المدرّب) · أحكام عُبور هذا الأسبوع · و«كلمة» تصل إلى «تنبيهاتي» (داخل أَثَر فقط).
 *  - الأسماء داخل شُعب المدرّب فقط. لا درجات في أي إشعار. الطاقم يطّلع على دفتر مدرّب آخر بلا «كلمة» بالنيابة.
 *  - الروستر الحيّ للشعبة = المقيَّدون المعتمَدون ∪ من حضر مرّة خلال 30 يومًا (حتى لو لم يُقيَّد بعد).
 *  الجزء الصرف: cleanWord · WORD_TEMPLATES · fillTemplate · greeting · yesterdayOf · digestText · recipientsFor — الغراء: collectDayBook · sendWord · runDayDigest
 */
import { riyadhDate, IDLE_DAYS } from '../miaar/practice';
import { collectRegister } from './sign';
import type { SignGroup } from './sign';
import { collectReplies, repliesYesterday, repliesLine } from './word-reply'; /* P53 «ردّ على الكلمة» */
import type { RoomReplies } from './word-reply';

type Db = any;
export const DAY_TITLE = { ar: 'دفتر اليوم', en: 'Day book' } as const;
export const DAY_OFFICIAL = { ar: 'سجلّ المدرّب اليومي', en: 'Trainer Daily Ledger' } as const;
export const DAY_PATH = '/me/day';
export const WORD_MAX = 200;
export const WORDS_PER_HOUR = 60;
const TZ_MS = 3 * 3600000;

export type WordMode = 'one' | 'absent' | 'idle' | 'all';
export type WordTemplate = { key: 'absent' | 'idle' | 'cheer'; label_ar: string; text_ar: string };
/** صيغ محلية (بلا ذكاء خارجي) — {name} يُستبدل باسم المتعلّم أو «يا شعبة X» */
export const WORD_TEMPLATES: readonly WordTemplate[] = [
  { key: 'absent', label_ar: 'غياب', text_ar: 'افتقدناك أمس يا {name}. مقعدك محفوظ، والدرس القادم يبدأ من حيث توقّفنا — أراك فيه.' },
  { key: 'idle', label_ar: 'توقّف في مِران', text_ar: 'يا {name}، خطّة مِران تنتظرك منذ أيام — ربع ساعة اليوم تعيدك إلى الإيقاع. أنا أتابع معك.' },
  { key: 'cheer', label_ar: 'تشجيع', text_ar: 'يا {name}، ما رأيته منك هذا الأسبوع يستحقّ كلمة: استمرّ، فالأثر يُبنى يومًا بعد يوم.' },
];

/* ---------- صرف ---------- */
const norm = (e: unknown) => String(e || '').trim().toLowerCase();
/** تنقية الكلمة: لا وسوم، لا روابط، مسافات مفردة، ≤ 200 حرف */
export function cleanWord(v: unknown): string { return String(v ?? '').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, WORD_MAX); }
export function fillTemplate(t: WordTemplate | undefined, name: string): string { return (t ? t.text_ar : '').replace(/\{name\}/g, name || 'صديقي'); }
/** تحية بحسب ساعة الرياض + التاريخ بالعربية (ميلادي) */
export function greeting(now: Date, name?: string | null): { hello_ar: string; date_ar: string; date: string } {
  const h = new Date(now.getTime() + TZ_MS).getUTCHours(); const hello = h < 12 ? 'صباح الخير' : h < 17 ? 'نهارك سعيد' : 'مساء الخير';
  let date_ar = ''; try { date_ar = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(now); } catch { date_ar = riyadhDate(now); }
  return { hello_ar: name ? `${hello} يا ${name}` : hello, date_ar, date: riyadhDate(now) };
}
export const yesterdayOf = (now: Date): string => riyadhDate(new Date(now.getTime() - 86400000));
/** حدود يوم الرياض بالتوقيت العالمي */
export function riyadhDayBounds(now: Date): { from: string; to: string } { const d = riyadhDate(now); const from = new Date(Date.parse(`${d}T00:00:00Z`) - TZ_MS); return { from: from.toISOString(), to: new Date(from.getTime() + 86400000).toISOString() }; }
export type DayCounts = { sessions_today: number; absent_yesterday: number; idle: number; to_sign: number; replies_unseen?: number; replies_yesterday?: number; need_help_yesterday?: number };
export function digestText(c: DayCounts): { title_ar: string; body_ar: string; url: string } {
  const parts: string[] = []; if (c.sessions_today) parts.push(c.sessions_today === 1 ? 'جلسة واحدة' : c.sessions_today === 2 ? 'جلستان' : `${c.sessions_today} جلسات`); if (c.absent_yesterday) parts.push(`غاب أمس ${c.absent_yesterday}`); if (c.idle) parts.push(`متوقّفون في مِران ${c.idle}`); if (c.to_sign) parts.push(`ينتظر توقيعك ${c.to_sign}`); const rl = repliesLine(c.replies_yesterday || 0, c.need_help_yesterday || 0); if (rl) parts.push(rl); /* P53 */
  return { title_ar: `دفتر اليوم: ${parts.join(' · ') || 'لا شيء يستدعي انتباهك'}`, body_ar: 'افتح دفتر اليوم: جلساتك، من غاب، من توقّف، وما ينتظر توقيعك — و«كلمة» تصل إلى متعلّميك في لحظتها.', url: DAY_PATH };
}
export type Learner = { email: string; name: string };
export type ClassDay = { id: string; code: string; section_name: string | null; program_id: string | null; roster: number; roster_list: Learner[]; absent_yesterday: Array<Learner & { absences_30: number }>; sessions_yesterday: number; practice: { active: number; done_today: number; idle: Array<Learner & { idle_days: number }> }; drafts_pending: number; exit_week: { passed: number; conditional: number; failed: number; no_plan: number } };
/** مستلمو «كلمة» بحسب الوضع — بلا تكرار بالبريد */
export function recipientsFor(mode: WordMode, room: ClassDay, one?: string | null): Learner[] {
  const src: Learner[] = mode === 'absent' ? room.absent_yesterday : mode === 'idle' ? room.practice.idle : mode === 'all' ? room.roster_list : mode === 'one' ? room.roster_list.filter((l) => l.email === norm(one)) : [];
  const seen = new Set<string>(); return src.filter((l) => l.email && !seen.has(l.email) && seen.add(l.email)).map((l) => ({ email: l.email, name: l.name }));
}

/* ---------- غراء ---------- */
export type DayMe = { id: string; email: string; staff: boolean; trainerIds: string[]; name: string; viewing_other: boolean };
export type DaySession = { id: string; title_ar: string; kind: string; starts_at: string; duration_min: number; provider: string; status: string; classroom: { id: string; code: string; section_name: string | null } | null; join_url: string | null; host_url: string | null; facilitator_href: string; state: 'soon' | 'live' | 'ended' | 'upcoming' };
export type DayBook = { date: string; date_ar: string; hello_ar: string; trainer_name: string; viewing_other: boolean; linked: boolean; counts: DayCounts; sessions: DaySession[]; classrooms: ClassDay[]; to_sign: { total: number; groups: SignGroup[] }; words_today: number; templates: readonly WordTemplate[]; replies: { total: number; need_help: number; unseen: number; rooms: RoomReplies[] }; computed_at: string };
const arr = (d: unknown): any[] => (Array.isArray(d) ? d : []);
const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch { return fb; } };

/** هوية المدرّب: بطاقاته في trainers ببريده — أو بطاقة مدرّب آخر إن كان طاقمًا واطّلع عليها */
export async function resolveTrainer(db: Db, u: { id: string; email: string; staff: boolean; fullName?: string | null }, wantTrainerId?: string | null): Promise<DayMe> {
  if (wantTrainerId && u.staff) { const { data: t } = await db.from('trainers').select('id, name, email').eq('id', wantTrainerId).maybeSingle(); if (t) return { id: u.id, email: u.email, staff: true, trainerIds: [String(t.id)], name: String(t.name || t.email || ''), viewing_other: norm(t.email) !== norm(u.email) }; }
  const { data: tr } = await db.from('trainers').select('id, name, email').ilike('email', u.email || 'x@x').limit(5); const rows = arr(tr);
  return { id: u.id, email: u.email, staff: u.staff, trainerIds: rows.map((t) => String(t.id)), name: String(rows[0]?.name || u.fullName || u.email || ''), viewing_other: false };
}

export async function collectDayBook(db: Db, me: DayMe, site: string, opts: { now?: Date } = {}): Promise<DayBook> {
  const now = opts.now || new Date(); const today = riyadhDate(now); const yday = yesterdayOf(now); const g = greeting(now, me.name); const tids = me.trainerIds;
  const { from, to } = riyadhDayBounds(now); const ago30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10); const ago7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const empty: DayBook = { date: today, date_ar: g.date_ar, hello_ar: g.hello_ar, trainer_name: me.name, viewing_other: me.viewing_other, linked: tids.length > 0, counts: { sessions_today: 0, absent_yesterday: 0, idle: 0, to_sign: 0 }, sessions: [], classrooms: [], to_sign: { total: 0, groups: [] }, words_today: 0, templates: WORD_TEMPLATES, replies: { total: 0, need_help: 0, unseen: 0, rooms: [] }, computed_at: now.toISOString() };
  if (!tids.length) return empty;
  /* الشُّعب والجلسات والتوقيعات والكلمات — معًا */
  const [{ data: cls }, { data: ses }, reg, { count: wc, data: wd }, replies, ry] = await Promise.all([
    db.from('classrooms').select('id, code, section_name, program_id, trainer_id').in('trainer_id', tids).limit(50),
    db.from('portal_sessions').select('id, title_ar, kind, starts_at, duration_min, provider, status, classroom_id, trainer_id, join_url').in('trainer_id', tids).gte('starts_at', from).lt('starts_at', to).neq('status', 'cancelled').order('starts_at', { ascending: true }).limit(50),
    safe<{ total: number; groups: SignGroup[] }>(collectRegister(db, { id: me.id, email: me.email, role: 'TRAINER', staff: false, trainer: true, doors: [] }, site, { now }), { total: 0, groups: [] }),
    safe(Promise.resolve(db.from('audit_logs').select('id', { count: 'exact' }).eq('actor_id', me.id).eq('action', 'trainer_word').gte('created_at', from).limit(1)), { count: null, data: [] }),
    safe(collectReplies(db, [...tids, me.id], { now }), { total: 0, need_help: 0, unseen: 0, rooms: [] as RoomReplies[] }), /* P53 */
    safe(repliesYesterday(db, [...tids, me.id], now), { replies: 0, need_help: 0 }),
  ]);
  const withReplies = (c: DayCounts): DayCounts => ({ ...c, replies_unseen: replies.unseen, replies_yesterday: ry.replies, need_help_yesterday: ry.need_help });
  const rooms = arr(cls); const cids = rooms.map((r) => String(r.id)); const roomOf = new Map(rooms.map((r) => [String(r.id), r]));
  /* الجلسات */
  const sessions: DaySession[] = []; const sids = arr(ses).map((s) => String(s.id));
  const { data: priv } = sids.length ? await db.from('portal_session_private').select('session_id, host_url').in('session_id', sids) : { data: [] }; const hostOf = new Map(arr(priv).map((p) => [String(p.session_id), p.host_url]));
  for (const s of arr(ses)) { const st = Date.parse(s.starts_at); const end = st + (Number(s.duration_min) || 60) * 60000; const state: DaySession['state'] = s.status === 'live' || (s.status !== 'ended' && st <= now.getTime() && end > now.getTime()) ? 'live' : s.status === 'ended' || end < now.getTime() ? 'ended' : st - now.getTime() < 30 * 60000 ? 'soon' : 'upcoming'; const r = s.classroom_id ? roomOf.get(String(s.classroom_id)) : null;
    sessions.push({ id: String(s.id), title_ar: String(s.title_ar || ''), kind: String(s.kind || 'class'), starts_at: s.starts_at, duration_min: Number(s.duration_min) || 60, provider: String(s.provider || ''), status: String(s.status || ''), classroom: r ? { id: String(r.id), code: String(r.code || ''), section_name: r.section_name || null } : null, join_url: s.join_url || null, host_url: hostOf.get(String(s.id)) || null, facilitator_href: `/live/facilitator/${s.id}`, state }); }
  if (!cids.length) return { ...empty, sessions, counts: withReplies({ ...empty.counts, sessions_today: sessions.length, to_sign: reg.total }), to_sign: { total: reg.total, groups: reg.groups }, words_today: typeof wc === 'number' ? wc : arr(wd).length, replies };
  /* الروستر · الحضور (أمس + 30 يومًا) · مِران · عُبور — معًا */
  const [{ data: enr }, { data: att }, { data: decs }, { data: invs }] = await Promise.all([
    db.from('portal_enrollments').select('email, full_name, classroom_id').in('classroom_id', cids).eq('status', 'approved').limit(2000),
    db.from('attendance_sessions').select('id, classroom_id, session_date').in('classroom_id', cids).gte('session_date', ago30).lte('session_date', yday).limit(500),
    db.from('placement_decisions').select('report_id, classroom_id').in('classroom_id', cids).eq('decision_status', 'approved').limit(2000),
    db.from('placement_invites').select('id, classroom_id').in('classroom_id', cids).not('level_target', 'is', null).limit(200),
  ]);
  const aSes = arr(att); const aIds = aSes.map((a) => String(a.id)); const sesRoom = new Map(aSes.map((a) => [String(a.id), String(a.classroom_id)])); const sesDate = new Map(aSes.map((a) => [String(a.id), String(a.session_date)]));
  const repRoom = new Map(arr(decs).map((d) => [String(d.report_id), String(d.classroom_id)])); const invRoom = new Map(arr(invs).map((i) => [String(i.id), String(i.classroom_id)]));
  const [{ data: recs }, { data: plans }, { data: reps }] = await Promise.all([
    aIds.length ? db.from('attendance_records').select('session_id, email, full_name, status').in('session_id', aIds).limit(5000) : Promise.resolve({ data: [] }),
    repRoom.size || invRoom.size ? db.from('miaar_practice_plans').select('id, report_id, invite_id, email, kind, status, approved_at, last_attempt_at, days').eq('status', 'approved').limit(3000) : Promise.resolve({ data: [] }),
    invRoom.size ? db.from('placement_reports').select('id, invite_id, report, created_at').in('invite_id', [...invRoom.keys()]).gte('created_at', ago7).is('archived_at', null).limit(1000) : Promise.resolve({ data: [] }),
  ]);
  /* الروستر الحيّ لكل شعبة */
  const roster = new Map<string, Map<string, string>>(); const put = (cid: string, email: string, name: string) => { const e = norm(email); if (!e) return; const m = roster.get(cid) || new Map<string, string>(); if (!m.has(e) || (!m.get(e) && name)) m.set(e, name || m.get(e) || ''); roster.set(cid, m); };
  for (const e of arr(enr)) put(String(e.classroom_id), e.email, String(e.full_name || ''));
  const present = new Map<string, Set<string>>(); /* session_id → emails */
  for (const r of arr(recs)) { const sid = String(r.session_id); const cid = sesRoom.get(sid); if (!cid) continue; const e = norm(r.email); if (!e) continue; put(cid, e, String(r.full_name || '')); if (['present', 'late', 'excused'].includes(String(r.status))) { const s = present.get(sid) || new Set<string>(); s.add(e); present.set(sid, s); } }
  /* مِران: خطّة → شعبة */
  const planRoom = (p: any): string | null => (p.kind === 'placement' ? repRoom.get(String(p.report_id)) : p.invite_id ? invRoom.get(String(p.invite_id)) : null) || null;
  const approvedPlanReps = new Set(arr(plans).map((p) => String(p.report_id)));
  const classrooms: ClassDay[] = [];
  for (const r of rooms) { const cid = String(r.id); const ros = roster.get(cid) || new Map<string, string>(); const sesOfRoom = aSes.filter((a) => String(a.classroom_id) === cid); const ySes = sesOfRoom.filter((a) => String(a.session_date) === yday);
    const absent: ClassDay['absent_yesterday'] = [];
    if (ySes.length) { for (const [email, name] of ros) { const came = ySes.some((a) => present.get(String(a.id))?.has(email)); if (came) continue; const misses = sesOfRoom.filter((a) => !present.get(String(a.id))?.has(email)).length; absent.push({ email, name, absences_30: misses }); } }
    absent.sort((a, b) => b.absences_30 - a.absences_30 || a.name.localeCompare(b.name, 'ar'));
    let active = 0; let doneToday = 0; const idle: ClassDay['practice']['idle'] = [];
    for (const p of arr(plans)) { if (planRoom(p) !== cid) continue; active += 1; const days = arr(p.days); if (days.some((d) => d.done_at && riyadhDate(new Date(d.done_at)) === today)) doneToday += 1; const lastAt = Date.parse(p.last_attempt_at || p.approved_at || ''); const idl = Number.isFinite(lastAt) ? Math.floor((now.getTime() - lastAt) / 86400000) : 0; if (idl >= IDLE_DAYS) { const e = norm(p.email); idle.push({ email: e, name: ros.get(e) || '', idle_days: idl }); } }
    idle.sort((a, b) => b.idle_days - a.idle_days);
    const ex = { passed: 0, conditional: 0, failed: 0, no_plan: 0 };
    for (const rp of arr(reps)) { if (invRoom.get(String(rp.invite_id)) !== cid) continue; const x = rp.report?.exit; if (!x || x.الحالة !== 'final') continue; if (x.النتيجة === 'passed') ex.passed += 1; else if (x.النتيجة === 'conditional') ex.conditional += 1; else ex.failed += 1; if (x.النتيجة !== 'passed' && !approvedPlanReps.has(String(rp.id))) ex.no_plan += 1; }
    const drafts = reg.groups.find((gq) => gq.key === 'practice_start')?.items?.find((i) => i.id === cid)?.count || 0;
    classrooms.push({ id: cid, code: String(r.code || ''), section_name: r.section_name || null, program_id: r.program_id || null, roster: ros.size, roster_list: [...ros].map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name, 'ar')), absent_yesterday: absent, sessions_yesterday: ySes.length, practice: { active, done_today: doneToday, idle }, drafts_pending: drafts, exit_week: ex }); }
  classrooms.sort((a, b) => (b.absent_yesterday.length + b.practice.idle.length) - (a.absent_yesterday.length + a.practice.idle.length) || a.code.localeCompare(b.code));
  const counts: DayCounts = { sessions_today: sessions.length, absent_yesterday: classrooms.reduce((n, c) => n + c.absent_yesterday.length, 0), idle: classrooms.reduce((n, c) => n + c.practice.idle.length, 0), to_sign: reg.total };
  /* P53: أسماء الردود من روستر الشعبة حين لم يُسجَّل اسم */
  for (const rr of replies.rooms) { const ros = rr.classroom_id ? roster.get(rr.classroom_id) : null; if (ros) for (const it of rr.items) if (!it.name) it.name = ros.get(it.email) || ''; }
  return { ...empty, counts: withReplies(counts), sessions, classrooms, to_sign: { total: reg.total, groups: reg.groups }, words_today: typeof wc === 'number' ? wc : arr(wd).length, replies };
}

/** «كلمة» — إشعار داخل أَثَر للمستلمين (كلمة واحدة لكل متعلّم من كل مدرّب في اليوم؛ المتأخّرة تُحدِّث الأولى) */
export type WordResult = { sent: number; recipients: number; text_ar: string };
export async function sendWord(db: Db, me: DayMe, room: ClassDay, input: { mode: WordMode; email?: string | null; text?: string; template?: string | null }, opts: { now?: Date; dry?: boolean } = {}): Promise<WordResult | { error: string }> {
  const now = opts.now || new Date(); const tpl = WORD_TEMPLATES.find((t) => t.key === input.template);
  const recipients: Learner[] = recipientsFor(input.mode, room, input.email || null);
  if (!recipients.length) return { error: 'لا مستلم لهذه الكلمة' };
  const raw = cleanWord(input.text); if (!raw && !tpl) return { error: 'اكتب كلمة أو اختر صيغة' };
  const { pushNotice } = await import('./notices'); const day = riyadhDate(now); const tid = me.trainerIds[0] || me.id; let sent = 0; let last = '';
  for (const l of recipients) { const text = raw || fillTemplate(tpl, l.name.split(' ')[0] || ''); last = text;
    const r = await pushNotice(db, { email: l.email, user_id: null, report_id: null, kind: 'trainer_word', title_ar: `كلمة من مدرّبك${me.name ? ` ${me.name}` : ''}`, body_ar: text, url: '/me', ref_id: room.id, dedupe_key: `trainer_word:${tid}:${l.email}:${day}`, push: false, merge: true }, { dry: !!opts.dry });
    if (r.inserted) sent += 1; }
  return { sent, recipients: recipients.length, text_ar: raw || (tpl ? tpl.text_ar : last) };
}

/** «نبض الصباح» للمدرّبين — من الكرون اليومي القائم: مرّة في اليوم لمن عنده شيء */
export async function runDayDigest(db: Db, opts: { site?: string; dry?: boolean; now?: Date } = {}): Promise<{ trainers: number; sent: number; errors: string[] }> {
  const now = opts.now || new Date(); const s = { trainers: 0, sent: 0, errors: [] as string[] };
  try {
    const { data: trs } = await db.from('trainers').select('id, name, email').not('email', 'is', null).limit(150); const list = arr(trs).filter((t) => norm(t.email)); s.trainers = list.length; if (!list.length) return s;
    const { pushNotice } = await import('./notices'); const day = riyadhDate(now); const seen = new Set<string>();
    for (const t of list) { const email = norm(t.email); if (seen.has(email)) continue; seen.add(email);
      try { const me: DayMe = { id: `digest:${t.id}`, email, staff: false, trainerIds: list.filter((x) => norm(x.email) === email).map((x) => String(x.id)), name: String(t.name || ''), viewing_other: false };
        const book = await collectDayBook(db, me, opts.site || '', { now }); const c = book.counts; if (!c.sessions_today && !c.absent_yesterday && !c.idle && !c.to_sign && !c.replies_yesterday) continue;
        const txt = digestText(c); const r = await pushNotice(db, { email, user_id: null, report_id: null, kind: 'day_digest', ...txt, ref_id: null, dedupe_key: `day_digest:${email}:${day}`, push: false }, { dry: !!opts.dry }); if (r.inserted) s.sent += 1; } catch (e: any) { s.errors.push(`${t.id}: ${e?.message || e}`); } }
  } catch (e: any) { s.errors.push(e?.message || String(e)); }
  return s;
}
