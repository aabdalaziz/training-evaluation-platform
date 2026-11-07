// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66 «أيام التدريب وفترات التطبيق» — طبقة القاعدة
 *  getCalendar / saveCalendar   تقويم الشعبة (المدرّب صاحب الشعبة أو الطاقم) · roomView للمدرّب: التقويم + الطور + «ما جرى في الميدان» (k ≥ 5)
 *  myLinePage                   صفحة المتدرّب «سطري»: شُعبي · طور اليوم · ما يُسمح بكتابته · سطوري · التزامي المفتوح
 *  writeLine / answerCommit     learn (يوم تدريب · واحد لليوم) · apply (أسبوع في فترة تطبيق · واحد للأسبوع) · commit (آخر يوم الكتلة · يُفتح أول يوم الكتلة التالية)
 *  overlayCalendars             لـ P64/P63/P62: اليوم الأول/الأخير من التقويم بدل start_date/end_date حين يوجد تقويم
 *  runRoomCalendar              (ضمن الكرون اليومي القائم) 🧭 بداية فترة التطبيق · تذكير أسبوعي · «ما جرى في الميدان» للمدرّب قبل الكتلة بثلاثة أيام · فتح الالتزام يوم العودة
 */
import { deriveCalendar, phaseOf, allowedKinds, validateDays, validateLine, cleanLine, isValidKind, isDone, fieldSummaryOf, atharLine, roadOf, weekStartIn, dayKey, addDays, applyStartNotice, applyWeekNotice, fieldSummaryNotice, commitOpenNotice, CAL_LIMITS, LINE_PATH, P66_NAMES_AR, PROMPTS_AR, DONE_AR, fmtDayAr } from './registry';
import type { Calendar, DayPhase, LineKind, FieldSummary, RoadItem } from './registry';
import type { LectureCard } from '../diploma/store';

type Db = any;
export type Me = { id: string; email: string; name?: string };
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const ENROLLED = ['approved', 'placed', 'active', 'completed'];
export const LINE_COLS = 'id,user_id,email,classroom_id,program_id,kind,day,body_ar,blocker_ar,block_no,apply_no,week_no,opens_on,done,done_at,created_at,updated_at,unit_id';

/* ───────── التقويم ───────── */
export async function getCalendar(db: Db, classroomId: string): Promise<(Calendar & { updated_at: string | null; program_id: string | null }) | null> {
  const r = await safe<any>(db.from('portal_room_calendars').select('classroom_id,program_id,days,updated_at').eq('classroom_id', classroomId).maybeSingle(), null);
  const cal = r ? deriveCalendar(arr<string>(r.days)) : null;
  if (cal && cal.days.length) return { ...cal, updated_at: r.updated_at || null, program_id: r.program_id ? String(r.program_id) : null };
  /* P66-ب: بلا تقويم يدوي → أيام محاضرات المقرّرات (الجدول) هي التقويم المشتق */
  const d = await derivedFromLectures(db, [classroomId]); const c = d.get(classroomId); return c ? { ...c, updated_at: null, program_id: null } : null;
}
async function derivedFromLectures(db: Db, ids: string[]): Promise<Map<string, Calendar>> {
  const out = new Map<string, Calendar>(); if (!ids.length) return out;
  try { const { lectureDaysOf } = await import('../diploma/store'); const m = await lectureDaysOf(db, ids); for (const [cid, days] of m) { const cal = deriveCalendar(days.slice(0, CAL_LIMITS.maxDays)); if (cal.days.length) out.set(cid, cal); } } catch { /* بلا جدول */ }
  return out;
}
export async function calendarsFor(db: Db, classroomIds: string[]): Promise<Map<string, Calendar>> {
  const out = new Map<string, Calendar>(); const ids = [...new Set(classroomIds.filter(Boolean))]; if (!ids.length) return out;
  const rows = await safe<any[]>(db.from('portal_room_calendars').select('classroom_id,days').in('classroom_id', ids).limit(200), []);
  for (const r of rows) { const cal = deriveCalendar(arr<string>(r.days)); if (cal.days.length) out.set(String(r.classroom_id), cal); }
  const rest = ids.filter((id) => !out.has(id)); if (rest.length) for (const [cid, cal] of await derivedFromLectures(db, rest)) out.set(cid, cal);
  return out;
}
/** P64/P63/P62: استبدال اليوم الأول/الأخير حين يوجد تقويم للشعبة — لا يغيّر شيئًا بلا تقويم */
export async function overlayCalendars<T extends { classroom_id?: string | null; start_date?: string | null; end_date?: string | null }>(db: Db, items: T[]): Promise<T[]> {
  try { const cals = await calendarsFor(db, items.map((i) => String(i.classroom_id || '')).filter(Boolean)); if (!cals.size) return items;
    return items.map((i) => { const c = i.classroom_id ? cals.get(String(i.classroom_id)) : null; return c && c.first && c.last ? { ...i, start_date: c.first, end_date: c.last } : i; }); } catch { return items; }
}
/** P64/P63/P62: خريطة program_id → {start,end} من تقويم شعبتي (أول/آخر يوم) — فارغة بلا تقويم */
export async function datesOverlay(db: Db, pairs: Array<{ program_id: string; classroom_id: string | null }>): Promise<Map<string, { start: string; end: string }>> {
  const out = new Map<string, { start: string; end: string }>(); try { const cals = await calendarsFor(db, pairs.map((x) => String(x.classroom_id || '')).filter(Boolean)); if (!cals.size) return out;
    for (const x of pairs) { const c = x.classroom_id ? cals.get(String(x.classroom_id)) : null; if (c && c.first && c.last && !out.has(x.program_id)) out.set(x.program_id, { start: c.first, end: c.last }); } } catch { /* بلا تقويم */ } return out;
}
type RoomRow = { id: string; code: string; program_id: string | null; trainer_id: string | null; section_name?: string | null };
async function roomOf(db: Db, classroomId: string): Promise<RoomRow | null> { const r = await safe<any>(db.from('classrooms').select('id,code,program_id,trainer_id,section_name').eq('id', classroomId).maybeSingle(), null); return r ? { id: String(r.id), code: String(r.code || ''), program_id: r.program_id ? String(r.program_id) : null, trainer_id: r.trainer_id ? String(r.trainer_id) : null, section_name: r.section_name || null } : null; }
/** يملك الشعبة: الطاقم · أو مدرّب بريده = بريد trainers.id = classroom.trainer_id */
export async function canEditRoom(db: Db, me: Me & { staff?: boolean; trainerIds?: string[] }, room: RoomRow): Promise<boolean> {
  if (me.staff) return true; if (!room.trainer_id) return false; if (me.trainerIds?.length) return me.trainerIds.includes(room.trainer_id);
  const t = await safe<any>(db.from('trainers').select('id,email').eq('id', room.trainer_id).maybeSingle(), null); return !!t && lower(t.email) === lower(me.email);
}
export type SaveInput = { days?: unknown; text?: unknown; start?: unknown; n?: unknown; block_len?: unknown; every_weeks?: unknown; blocks?: unknown };
export async function saveCalendar(db: Db, me: Me & { staff?: boolean; trainerIds?: string[] }, classroomId: string, input: SaveInput, now = new Date()): Promise<{ ok: true; calendar: Calendar; phase: DayPhase } | Fail> {
  const room = await roomOf(db, classroomId); if (!room) return fail('الشعبة غير موجودة', 404); if (!(await canEditRoom(db, me, room))) return fail('تقويم الشعبة لمدرّبها أو للطاقم', 403);
  const { parseDays, expandDays, patternDays } = await import('./registry');
  let days: string[] = Array.isArray(input.days) ? (input.days as string[]) : [];
  if (!days.length && input.text) days = parseDays(input.text);
  if (!days.length && input.start && input.block_len) days = patternDays(String(input.start), Number(input.block_len), Number(input.every_weeks || 1), Number(input.blocks || 1));
  if (!days.length && input.start && input.n) days = expandDays(String(input.start), Number(input.n));
  const v = validateDays(days); if (!v.ok) return fail(v.error);
  const cal = deriveCalendar(v.days);
  const row = { classroom_id: room.id, program_id: room.program_id, days: cal.days, blocks: cal.blocks.map((b) => ({ no: b.no, start: b.start, end: b.end, n: b.days.length })), applies: cal.applies, updated_by: me.id, updated_at: now.toISOString() };
  const { error } = await db.from('portal_room_calendars').upsert(row, { onConflict: 'classroom_id' }); if (error) return fail(error.message || 'تعذّر الحفظ', 500);
  try { await db.from('audit_logs').insert({ actor_id: me.id, actor_email: me.email, actor_role: me.staff ? 'STAFF' : 'TRAINER', action: 'room_calendar.save', entity: 'classrooms', entity_id: room.id, meta: { days: cal.days.length, blocks: cal.blocks.length, applies: cal.applies.length } }); } catch { /* اختياري */ }
  return { ok: true, calendar: cal, phase: phaseOf(cal, dayKey(now)) };
}
export async function clearCalendar(db: Db, me: Me & { staff?: boolean; trainerIds?: string[] }, classroomId: string): Promise<{ ok: true } | Fail> {
  const room = await roomOf(db, classroomId); if (!room) return fail('الشعبة غير موجودة', 404); if (!(await canEditRoom(db, me, room))) return fail('تقويم الشعبة لمدرّبها أو للطاقم', 403);
  await db.from('portal_room_calendars').delete().eq('classroom_id', room.id); return { ok: true };
}
async function rosterOf(db: Db, classroomId: string): Promise<Array<{ id: string; email: string; user_id: string | null }>> {
  const en = await safe<any[]>(db.from('portal_enrollments').select('id,email,user_id').eq('classroom_id', classroomId).in('status', ENROLLED).limit(500), []); const seen = new Set<string>();
  return en.filter((e) => { const k = lower(e.email); if (!k || seen.has(k)) return false; seen.add(k); return true; }).map((e) => ({ id: String(e.id), email: lower(e.email), user_id: e.user_id ? String(e.user_id) : null }));
}
/** «ما جرى في الميدان» لفترة تطبيق — المجمَّع فقط */
export async function fieldSummary(db: Db, classroomId: string, cal: Calendar, applyNo: number, roster: number): Promise<FieldSummary | null> {
  const a = cal.applies.find((x) => x.no === applyNo); if (!a) return null;
  const rows = await safe<any[]>(db.from('portal_learning_lines').select('user_id,body_ar,blocker_ar,day').eq('classroom_id', classroomId).eq('kind', 'apply').gte('day', a.from).lte('day', a.to).limit(2000), []);
  return fieldSummaryOf(rows.map((r) => ({ user_id: String(r.user_id), body_ar: String(r.body_ar || ''), blocker_ar: r.blocker_ar || null, day: String(r.day) })), { seed: `${classroomId}:${applyNo}`, roster });
}
export type RoomView = { room: RoomRow; calendar: Calendar | null; phase: DayPhase; roster: number; field: FieldSummary | null; field_apply_no: number | null; learn_today: number; commits_pending: number; names: typeof P66_NAMES_AR; limits: typeof CAL_LIMITS };
export async function roomView(db: Db, me: Me & { staff?: boolean; trainerIds?: string[] }, classroomId: string, now = new Date()): Promise<RoomView | Fail> {
  const room = await roomOf(db, classroomId); if (!room) return fail('الشعبة غير موجودة', 404); if (!(await canEditRoom(db, me, room))) return fail('تقويم الشعبة لمدرّبها أو للطاقم', 403);
  const today = dayKey(now); const cal = await getCalendar(db, room.id); const ph = phaseOf(cal, today); const roster = (await rosterOf(db, room.id)).length;
  let field: FieldSummary | null = null; let field_apply_no: number | null = null;
  if (cal) { const cur = ph.phase === 'apply' && ph.apply ? ph.apply.no : [...cal.applies].reverse().find((a) => a.to < today)?.no ?? null; if (cur) { field_apply_no = cur; field = await fieldSummary(db, room.id, cal, cur, roster); } }
  const learn_today = ph.phase === 'training' ? (await safe<any[]>(db.from('portal_learning_lines').select('user_id').eq('classroom_id', room.id).eq('kind', 'learn').eq('day', today).limit(500), [])).length : 0;
  const commits_pending = (await safe<any[]>(db.from('portal_learning_lines').select('id').eq('classroom_id', room.id).eq('kind', 'commit').is('done', null).limit(500), [])).length;
  return { room, calendar: cal, phase: ph, roster, field, field_apply_no, learn_today, commits_pending, names: P66_NAMES_AR, limits: CAL_LIMITS };
}
/** شُعب المدرّب (للطاقم: المطلوبة فقط) — لبطاقة «تقويم الشعبة» في دفتر اليوم */
export async function roomsSummary(db: Db, classroomIds: string[], now = new Date()): Promise<Record<string, { has: boolean; phase: DayPhase; blocks: number; applies: number; first: string | null; last: string | null }>> {
  const today = dayKey(now); const cals = await calendarsFor(db, classroomIds); const out: Record<string, any> = {};
  for (const id of classroomIds) { const c = cals.get(id) || null; out[id] = { has: !!c, phase: phaseOf(c, today), blocks: c ? c.blocks.length : 0, applies: c ? c.applies.length : 0, first: c?.first || null, last: c?.last || null }; } return out;
}

/* ───────── صفحة المتدرّب «سطري» ───────── */
export type MyLine = { id: number; kind: LineKind; day: string; day_ar: string; unit_id: string | null; body_ar: string; blocker_ar: string | null; block_no: number | null; apply_no: number | null; week_no: number | null; opens_on: string | null; opens_ar: string | null; done: 'yes' | 'part' | 'no' | null; done_ar: string | null; open: boolean };
export type MyRoom = { classroom_id: string; code: string; program_id: string | null; program_ar: string; enrollment_id: string; has_calendar: boolean; lectures: LectureCard[]; move_open: boolean; phase: DayPhase; allowed: LineKind[]; written_today: Partial<Record<LineKind, boolean>>; athar_ar: string; road: RoadItem[]; commit_open: MyLine | null; lines: MyLine[]; counts: { learn: number; apply: number; commit: number; days: number } };
const toMy = (r: any, today: string): MyLine => ({ id: Number(r.id), kind: r.kind, day: String(r.day), day_ar: fmtDayAr(String(r.day)), unit_id: r.unit_id ? String(r.unit_id) : null, body_ar: String(r.body_ar || ''), blocker_ar: r.blocker_ar || null, block_no: r.block_no ?? null, apply_no: r.apply_no ?? null, week_no: r.week_no ?? null, opens_on: r.opens_on || null, opens_ar: r.opens_on ? fmtDayAr(String(r.opens_on)) : null, done: isDone(r.done) ? r.done : null, done_ar: isDone(r.done) ? DONE_AR[r.done as 'yes' | 'part' | 'no'] : null, open: r.kind !== 'commit' || (!!r.opens_on && String(r.opens_on) <= today) });
async function myEnrollments(db: Db, me: Me) {
  const en = await safe<any[]>(db.from('portal_enrollments').select('id,program_id,classroom_id,status').eq('email', lower(me.email)).in('status', ENROLLED).not('classroom_id', 'is', null).limit(50), []);
  const seen = new Set<string>(); return en.filter((e) => { const k = String(e.classroom_id); if (seen.has(k)) return false; seen.add(k); return true; });
}
export async function myLinePage(db: Db, me: Me, now = new Date()): Promise<{ rooms: MyRoom[]; today: string; names: typeof P66_NAMES_AR; prompts: typeof PROMPTS_AR; limits: typeof CAL_LIMITS; shift: { day: string; until: string } | null }> {
  const today = dayKey(now); const en = await myEnrollments(db, me); const rooms: MyRoom[] = []; if (!en.length) return { rooms, today, names: P66_NAMES_AR, prompts: PROMPTS_AR, limits: CAL_LIMITS, shift: null };
  const cids = en.map((e) => String(e.classroom_id)); const dip = await import('../diploma/store'); const [cals, crs, lines, cards, shift] = await Promise.all([
    calendarsFor(db, cids), safe<any[]>(db.from('classrooms').select('id,code,program_id').in('id', cids).limit(50), []),
    safe<any[]>(db.from('portal_learning_lines').select(LINE_COLS).eq('user_id', me.id).in('classroom_id', cids).order('day', { ascending: false }).limit(400), []),
    dip.lectureCardsFor(db, me, cids, now).catch(() => new Map<string, { lectures: LectureCard[]; move_open: boolean }>()), dip.shiftDayFor(db, me, now).catch(() => null),
  ]);
  const pids = [...new Set(crs.map((c) => String(c.program_id || '')).concat(en.map((e) => String(e.program_id || ''))).filter(Boolean))];
  const ps = pids.length ? await safe<any[]>(db.from('programs').select('id,name_ar,start_date,end_date').in('id', pids).limit(50), []) : [];
  for (const e of en) { const cid = String(e.classroom_id); const cr = crs.find((c) => String(c.id) === cid); const pid = String(cr?.program_id || e.program_id || ''); const p = ps.find((x) => String(x.id) === pid);
    let cal = cals.get(cid) || null; const has = !!cal;
    if (!cal && p?.start_date && p?.end_date) { /* بلا تقويم: مدة متّصلة (أيام العمل) — عرض فقط، لا كتل ولا فترات */ const { expandDays } = await import('./registry'); const n = Math.max(1, Math.min(CAL_LIMITS.maxDays, Math.round((Date.parse(String(p.end_date)) - Date.parse(String(p.start_date))) / 86400000) + 1)); cal = deriveCalendar(expandDays(String(p.start_date).slice(0, 10), n, false).filter((d) => d <= String(p.end_date).slice(0, 10))); }
    const ph = phaseOf(cal, today); const mine = lines.filter((l) => String(l.classroom_id) === cid).map((l) => toMy(l, today));
    const written: Partial<Record<LineKind, boolean>> = {}; for (const k of allowedKinds(ph)) { const key = k === 'apply' && ph.apply ? ph.apply.week_start : today; written[k] = mine.some((l) => l.kind === k && l.day === key); }
    const commit_open = mine.find((l) => l.kind === 'commit' && l.open && !l.done) || null;
    const program_ar = String(p?.name_ar || 'برنامجك');
    const card = cards.get(cid); rooms.push({ classroom_id: cid, code: String(cr?.code || ''), program_id: pid || null, program_ar, enrollment_id: String(e.id), has_calendar: has, lectures: card?.lectures || [], move_open: !!card?.move_open, phase: ph, allowed: has ? allowedKinds(ph) : (ph.phase === 'training' ? ['learn'] : []), written_today: written, athar_ar: atharLine(ph, program_ar), road: cal && has ? roadOf(cal, ph) : [], commit_open, lines: mine.slice(0, 60), counts: { learn: mine.filter((l) => l.kind === 'learn').length, apply: mine.filter((l) => l.kind === 'apply').length, commit: mine.filter((l) => l.kind === 'commit').length, days: cal ? cal.days.length : 0 } }); }
  rooms.sort((a, b) => (a.phase.phase === 'after' ? 1 : 0) - (b.phase.phase === 'after' ? 1 : 0));
  /* الترتيب: ما ينتظر فعلًا أولًا — التزام مفتوح، ثم شعبة لها تقويم، ثم ما يمكن الكتابة فيه اليوم، ثم الباقي */
  const rank = (r: MyRoom) => (r.commit_open ? 0 : r.has_calendar ? 1 : r.allowed.length ? 2 : 3); rooms.sort((x, y) => rank(x) - rank(y));
  return { rooms, today, names: P66_NAMES_AR, prompts: PROMPTS_AR, limits: CAL_LIMITS, shift };
}
export async function writeLine(db: Db, me: Me, b: { classroom_id?: unknown; kind?: unknown; body_ar?: unknown; blocker_ar?: unknown; unit_id?: unknown; shift?: unknown }, now0 = new Date()): Promise<{ ok: true; line: MyLine; updated: boolean } | Fail> {
  const cid = String(b.classroom_id || ''); if (!cid) return fail('حدّد الشعبة'); if (!isValidKind(b.kind)) return fail('نوع السطر غير معروف');
  const uid = b.unit_id ? String(b.unit_id) : null; if (uid && b.kind !== 'learn') return fail('سطر المقرّر هو «سطر اليوم» فقط');
  /* ★ وضع الوردية: بعد منتصف الليل يبقى سطر الأمس مفتوحًا حتى نهاية الليل (06:00 أو quiet_to) */
  let now = now0; if (b.shift === true && b.kind === 'learn') { const { shiftDayFor } = await import('../diploma/store'); const sh = await shiftDayFor(db, me, now0); if (!sh) return fail('انتهت مهلة الوردية — سطر الأمس أُغلق'); now = new Date(`${sh.day}T20:00:00+03:00`); }
  const v = validateLine(b.body_ar, b.blocker_ar); if (v) return fail(v);
  const en = (await myEnrollments(db, me)).find((e) => String(e.classroom_id) === cid); if (!en) return fail('هذه الشعبة ليست من شُعبك', 403);
  const today = dayKey(now); const cal = await getCalendar(db, cid); let ph = phaseOf(cal, today);
  if (!cal) { /* بلا تقويم: «سطر اليوم» فقط خلال مدة البرنامج */ const p = await safe<any>(db.from('programs').select('start_date,end_date').eq('id', String(en.program_id || '')).maybeSingle(), null); const s = String(p?.start_date || '').slice(0, 10); const e = String(p?.end_date || '').slice(0, 10); if (!s || today < s || (e && today > e)) return fail('البرنامج ليس في أيامه الآن', 409); ph = { phase: 'training', today, block: { no: 1, day_idx: 1, len: 1, is_first_day: false, is_last_day: false, is_program_first: false, is_program_last: false, next_block_start: null } }; }
  const allowed = cal ? allowedKinds(ph) : (['learn'] as LineKind[]); if (!allowed.includes(b.kind)) return fail(b.kind === 'apply' ? 'سطر التطبيق يُكتب في فترة التطبيق فقط' : b.kind === 'commit' ? '«التزامي حتى نلتقي» يُكتب في آخر يوم من الكتلة فقط' : '«سطر اليوم» يُكتب في يوم تدريب فقط', 409);
  const day = b.kind === 'apply' && ph.apply ? ph.apply.week_start : today;
  if (uid) { const { lectureExists } = await import('../diploma/store'); if (!(await lectureExists(db, cid, uid, day))) return fail('لا محاضرة لهذا المقرّر في شعبتك هذا اليوم'); }
  const row: Record<string, unknown> = { user_id: me.id, email: lower(me.email), classroom_id: cid, program_id: en.program_id ? String(en.program_id) : null, kind: b.kind, day, unit_id: uid, body_ar: cleanLine(b.body_ar), blocker_ar: b.kind === 'apply' && cleanLine(b.blocker_ar) ? cleanLine(b.blocker_ar) : null, block_no: ph.block?.no ?? null, apply_no: ph.apply?.no ?? null, week_no: ph.apply?.week_no ?? null, opens_on: b.kind === 'commit' ? ph.block?.next_block_start || null : null, updated_at: now.toISOString() };
  const pq = db.from('portal_learning_lines').select('id,done').eq('user_id', me.id).eq('classroom_id', cid).eq('kind', b.kind).eq('day', day); const prev = await safe<any>(uid ? pq.eq('unit_id', uid).maybeSingle() : pq.is('unit_id', null).maybeSingle(), null);
  if (prev && prev.done) return fail('هذا الالتزام أُجيب عنه — لا يُعدَّل', 409);
  let data: any = null; let error: any = null;
  if (prev) { const r = await db.from('portal_learning_lines').update({ body_ar: row.body_ar, blocker_ar: row.blocker_ar, updated_at: row.updated_at }).eq('id', prev.id).select(LINE_COLS).maybeSingle(); data = r.data; error = r.error; }
  else { const r = await db.from('portal_learning_lines').insert(row).select(LINE_COLS).maybeSingle(); data = r.data; error = r.error; }
  if (error || !data) return fail(error?.message || 'تعذّر الحفظ', 500);
  try { await db.from('portal_learning_events').insert({ user_id: me.id, email: lower(me.email), verb: 'wrote', object_type: 'learning_line', object_id: String(data.id), skills: [], context: { kind: b.kind, classroom_id: cid, day } }); } catch { /* اختياري */ }
  return { ok: true, line: toMy(data, today), updated: !!prev };
}
export async function answerCommit(db: Db, me: Me, b: { id?: unknown; done?: unknown; note_ar?: unknown }, now = new Date()): Promise<{ ok: true; line: MyLine } | Fail> {
  const id = Number(b.id); if (!id) return fail('حدّد الالتزام'); if (!isDone(b.done)) return fail('الإجابة: فعلت · جزئيًا · لم أفعل بعد');
  const row = await safe<any>(db.from('portal_learning_lines').select(LINE_COLS).eq('id', id).eq('user_id', me.id).eq('kind', 'commit').maybeSingle(), null); if (!row) return fail('الالتزام غير موجود أو ليس لك', 404);
  const today = dayKey(now); if (!row.opens_on || String(row.opens_on) > today) return fail(`يُفتح ${fmtDayAr(String(row.opens_on || today))} — يوم عودتك إلى الكتلة`, 409);
  if (row.done) return fail('أجبتَ عن هذا الالتزام', 409);
  const note = cleanLine(b.note_ar); const { data, error } = await db.from('portal_learning_lines').update({ done: b.done, done_at: now.toISOString(), meta: { ...(row.meta || {}), note_ar: note || null }, updated_at: now.toISOString() }).eq('id', id).select(LINE_COLS).maybeSingle();
  if (error || !data) return fail(error?.message || 'تعذّر الحفظ', 500); return { ok: true, line: toMy(data, today) };
}
export async function deleteLine(db: Db, me: Me, id: number): Promise<{ ok: true } | Fail> {
  const row = await safe<any>(db.from('portal_learning_lines').select('id').eq('id', id).eq('user_id', me.id).maybeSingle(), null); if (!row) return fail('السطر غير موجود أو ليس لك', 404);
  await db.from('portal_learning_lines').delete().eq('id', id); return { ok: true };
}

/* ───────── الكرون اليومي ───────── */
export async function runRoomCalendar(db: Db, opts: { now?: Date; dry?: boolean; site?: string } = {}): Promise<{ rooms: number; apply_start: number; apply_week: number; field: number; commits: number; first: number; last: number; errors: string[] }> {
  const now = opts.now || new Date(); const today = dayKey(now); const s = { rooms: 0, apply_start: 0, apply_week: 0, field: 0, commits: 0, first: 0, last: 0, errors: [] as string[] };
  const { pushNotice } = await import('../portal/notices'); const o = { dry: !!opts.dry, site: opts.site, now };
  try {
    const rows = await safe<any[]>(db.from('portal_room_calendars').select('classroom_id,program_id,days').limit(300), []);
    for (const r of rows) { const cal = deriveCalendar(arr<string>(r.days)); if (!cal.days.length || today < cal.first! || today > cal.last!) continue; s.rooms += 1; const cid = String(r.classroom_id); const ph = phaseOf(cal, today);
      const room = await roomOf(db, cid); const p = room?.program_id || r.program_id ? await safe<any>(db.from('programs').select('id,name_ar').eq('id', String(room?.program_id || r.program_id)).maybeSingle(), null) : null; const programAr = String(p?.name_ar || 'برنامجك');
      if (ph.phase === 'apply' && ph.apply) { const roster = await rosterOf(db, cid); const isStart = today === ph.apply.from; const isWeek = !isStart && ph.apply.week_start === today && ph.apply.days_left >= 3;
        if (isStart || isWeek) for (const e of roster) { const t = isStart ? applyStartNotice(programAr, ph.apply.next_block_start) : applyWeekNotice(programAr, ph.apply.week_no, ph.apply.weeks);
          const res = await pushNotice(db, { email: e.email, user_id: e.user_id, report_id: null, kind: (isStart ? 'apply_start' : 'apply_week') as any, ...t, url: LINE_PATH, ref_id: cid, dedupe_key: isStart ? `apply_start:${e.id}:${ph.apply.no}` : `apply_week:${e.id}:${ph.apply.no}:${ph.apply.week_no}`, push: true }, o); if (res.inserted) { if (isStart) s.apply_start += 1; else s.apply_week += 1; } }
        if (ph.apply.days_left === CAL_LIMITS.summaryBeforeDays && room?.trainer_id) { const t = await safe<any>(db.from('trainers').select('id,email').eq('id', room.trainer_id).maybeSingle(), null); const email = lower(t?.email);
          if (email) { const fs = await fieldSummary(db, cid, cal, ph.apply.no, roster.length); if (fs) { const n = fieldSummaryNotice(room.code, fs, ph.apply.next_block_start); const res = await pushNotice(db, { email, user_id: null, report_id: null, kind: 'field_summary' as any, ...n, url: `/me/day?room=${encodeURIComponent(cid)}#calendar`, ref_id: cid, dedupe_key: `field_summary:${cid}:${ph.apply.no}`, push: false }, o); if (res.inserted) s.field += 1; } } } }
      if (ph.phase === 'training' && ph.block && (ph.block.is_program_first || ph.block.is_program_last) && p) { /* P64/P63 عبر التقويم: أول/آخر يوم تدريب فعلي (نفس مفاتيح dedupe — لا تكرار مع start_date/end_date) */
        const pd = await safe<any>(db.from('programs').select('start_date,end_date').eq('id', String(p.id)).maybeSingle(), null); const first = ph.block.is_program_first && String(pd?.start_date || '').slice(0, 10) !== today; const last = ph.block.is_program_last && String(pd?.end_date || '').slice(0, 10) !== today;
        if (first || last) { const { firstDayNotice, FIRST_PATH } = await import('../first/registry'); const { gradDayNotice, GRAD_PATH } = await import('../grad/registry'); const roster = await rosterOf(db, cid);
          for (const e of roster) { if (first) { const t = firstDayNotice(programAr); const res = await pushNotice(db, { email: e.email, user_id: e.user_id, report_id: null, kind: 'first_day' as any, ...t, url: `${FIRST_PATH}?program=${encodeURIComponent(String(p.id))}`, ref_id: String(p.id), dedupe_key: `first_day:${e.id}`, push: true }, o); if (res.inserted) s.first += 1; }
            if (last) { const t = gradDayNotice(programAr); const res = await pushNotice(db, { email: e.email, user_id: e.user_id, report_id: null, kind: 'grad_day' as any, ...t, url: `${GRAD_PATH}?program=${encodeURIComponent(String(p.id))}`, ref_id: String(p.id), dedupe_key: `grad_day:${e.id}`, push: true }, o); if (res.inserted) s.last += 1; } } } }
      if (ph.phase === 'training' && ph.block?.is_first_day && ph.block.no > 1) { const cs = await safe<any[]>(db.from('portal_learning_lines').select('id,email,user_id').eq('classroom_id', cid).eq('kind', 'commit').eq('opens_on', today).is('done', null).limit(500), []);
        for (const c of cs) { const t = commitOpenNotice(programAr); const res = await pushNotice(db, { email: lower(c.email), user_id: c.user_id || null, report_id: null, kind: 'commit_open' as any, ...t, url: LINE_PATH, ref_id: cid, dedupe_key: `commit_open:${c.id}`, push: true }, o); if (res.inserted) s.commits += 1; } } }
  } catch (e: any) { s.errors.push(e?.message || String(e)); }
  return s;
}
export { weekStartIn, addDays };
