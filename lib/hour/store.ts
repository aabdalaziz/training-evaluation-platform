// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P73 «ساعة الأثر» — طبقة القاعدة (صفر جداول جديدة)
 *  الساعة = portal_sessions (kind = athar_hour · series_id واحد للشعبة) تُولَّد أسبوعيًّا من التثبيت حتى نهاية البرنامج.
 *  ما يُكتب فيها = portal_learning_lines: hour_word · hour_line · hour_vote · carry · hour_seal (القيد الفريد = واحد لكل متدرّب في اليوم).
 *  الصلاحيات: الأستاذ = مدرّب الشعبة (classrooms.trainer_id ∈ بطاقاته) أو الطاقم · المتدرّب = مسجَّل في الشعبة (portal_enrollments).
 *  hourRole · myHourRooms · pinHour/unpinHour · hourView · act(carry|word|line|vote|seal) · hourSeals (النسيج) · hourEvidence (الاعتماد)
 */
import { P73_NAMES_AR, HOUR_LIMITS, SESSION_KIND, phaseOf, occurrences, riyadhStartIso, riyadhDay, addDaysKey, validatePin, validateWord, validateHourLine, weekViewOf, cloudOf, linesViewOf, pickLine, validVotes, carryNotice, pinNotice, sealNotice, sealHeadAr, cleanText, WEEKDAYS_AR, fmtTimeAr } from './registry';
import type { HourSession, PhaseInfo, WeekView, CloudView, LinesView, SealMeta } from './registry';
import { pushNotice } from '../portal/notices';
import { randomUUID } from 'node:crypto';

type Db = any;
export type Me = { id: string; email: string; name?: string; staff?: boolean; trainerIds?: string[] };
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
const ENROLLED = ['approved', 'placed', 'active', 'completed'];
const SES_COLS = 'id,starts_at,duration_min,status,series_id,classroom_id,program_id';
const toSes = (s: any): HourSession => ({ id: String(s.id), starts_at: String(s.starts_at), duration_min: Number(s.duration_min || HOUR_LIMITS.minutes), status: String(s.status || 'scheduled'), series_id: s.series_id ? String(s.series_id) : null, day: riyadhDay(new Date(String(s.starts_at))) });

export type Room = { id: string; code: string; section_name: string | null; program_id: string | null; trainer_id: string | null };
export type Role = 'instructor' | 'learner';
/** من أنا في هذه الشعبة؟ الأستاذ أولًا (أو الطاقم) ثم المتدرّب المسجَّل */
export async function hourRole(db: Db, me: Me, classroomId: string): Promise<{ role: Role; room: Room } | null> {
  const r = await safe<any>(db.from('classrooms').select('id,code,section_name,program_id,trainer_id').eq('id', classroomId).maybeSingle(), null); if (!r) return null;
  const room: Room = { id: String(r.id), code: String(r.code || ''), section_name: r.section_name || null, program_id: r.program_id ? String(r.program_id) : null, trainer_id: r.trainer_id ? String(r.trainer_id) : null };
  if (room.trainer_id && (me.trainerIds || []).includes(room.trainer_id)) return { role: 'instructor', room };
  /* المسجَّل في الشعبة متدرّبٌ فيها ولو كان من الطاقم (طاقم يحضر برنامجًا) — ثم الطاقم غير المسجَّل أستاذٌ مطّلع يفتح ويختم */
  const en = await safe<any[]>(db.from('portal_enrollments').select('id').eq('email', lower(me.email)).eq('classroom_id', classroomId).in('status', ENROLLED).limit(1), []);
  if (en.length) return { role: 'learner', room }; return me.staff ? { role: 'instructor', room } : null;
}
async function rosterEmails(db: Db, classroomId: string): Promise<Array<{ email: string; user_id: string | null }>> {
  const en = await safe<any[]>(db.from('portal_enrollments').select('email').eq('classroom_id', classroomId).in('status', ENROLLED).limit(200), []);
  const emails = [...new Set(en.map((e) => lower(e.email)).filter(Boolean))]; if (!emails.length) return [];
  const prof = await safe<any[]>(db.from('profiles').select('id,email').in('email', emails).limit(500), []); const idOf = new Map(prof.map((p) => [lower(p.email), String(p.id)]));
  return emails.map((email) => ({ email, user_id: idOf.get(email) || null }));
}
async function sessionsOf(db: Db, classroomId: string): Promise<HourSession[]> { return (await safe<any[]>(db.from('portal_sessions').select(SES_COLS).eq('classroom_id', classroomId).eq('kind', SESSION_KIND).neq('status', 'cancelled').order('starts_at').limit(60), [])).map(toSes); }
async function sealsOf(db: Db, classroomId: string, limit = 40): Promise<any[]> { return safe<any[]>(db.from('portal_learning_lines').select('id,day,body_ar,meta,created_at').eq('classroom_id', classroomId).eq('kind', 'hour_seal').order('day', { ascending: false }).limit(limit), []); }
async function phaseFor(db: Db, classroomId: string, now: Date): Promise<{ info: PhaseInfo; sessions: HourSession[]; seals: any[] }> {
  const [sessions, seals] = await Promise.all([sessionsOf(db, classroomId), sealsOf(db, classroomId)]);
  const sealed = new Set(seals.map((s) => String(s.meta?.session_id || ''))); return { info: phaseOf(sessions, sealed, now), sessions, seals };
}
export type Pin = { weekday: number; time: string; series_id: string | null; count: number; next: HourSession | null } | null;
const pinOf = (sessions: HourSession[], now: Date): Pin => { const up = sessions.filter((s) => Date.parse(s.starts_at) > now.getTime() - HOUR_LIMITS.homeHours * 3600000); const ref = up[0] || sessions[sessions.length - 1]; if (!ref) return null; const d = new Date(new Date(ref.starts_at).getTime() + 3 * 3600000); return { weekday: d.getUTCDay(), time: fmtTimeAr(ref.starts_at), series_id: ref.series_id, count: up.length, next: up.find((s) => Date.parse(s.starts_at) > now.getTime()) || null }; };

/* ───────── صفحتي: شُعبي وساعاتها ───────── */
export type HourRoomCard = { classroom_id: string; code: string; section_name: string | null; program_ar: string; role: Role; pin: Pin; phase: PhaseInfo['phase']; minutes_left: number | null; day: string | null; sealed_line: string | null };
export async function myHourRooms(db: Db, me: Me, now = new Date()): Promise<HourRoomCard[]> {
  const [en, mine] = await Promise.all([
    safe<any[]>(db.from('portal_enrollments').select('classroom_id,program_id').eq('email', lower(me.email)).in('status', ENROLLED).not('classroom_id', 'is', null).limit(50), []),
    (me.trainerIds || []).length ? safe<any[]>(db.from('classrooms').select('id').in('trainer_id', me.trainerIds).limit(50), []) : Promise.resolve([] as any[]),
  ]);
  const roles = new Map<string, Role>(); for (const e of en) roles.set(String(e.classroom_id), 'learner'); for (const c of mine) roles.set(String(c.id), 'instructor');
  const ids = [...roles.keys()]; if (!ids.length) return [];
  const rooms = await safe<any[]>(db.from('classrooms').select('id,code,section_name,program_id').in('id', ids).limit(50), []);
  const pids = [...new Set(rooms.map((r) => String(r.program_id || '')).filter(Boolean))]; const ps = pids.length ? await safe<any[]>(db.from('programs').select('id,name_ar').in('id', pids).limit(50), []) : [];
  const out: HourRoomCard[] = [];
  for (const r of rooms) { const cid = String(r.id); const { info, sessions, seals } = await phaseFor(db, cid, now); const seal = seals[0] || null; /* سطر آخر ساعة مختومة */
    out.push({ classroom_id: cid, code: String(r.code || ''), section_name: r.section_name || null, program_ar: String(ps.find((p) => String(p.id) === String(r.program_id))?.name_ar || 'برنامجك'), role: roles.get(cid) || 'learner', pin: pinOf(sessions, now), phase: info.phase, minutes_left: info.minutes_left, day: info.session?.day || null, sealed_line: seal && seal.body_ar !== '—' ? String(seal.body_ar) : null }); }
  const rank: Record<string, number> = { open: 0, home: 1, before: 2, none: 3, closed: 4 }; out.sort((a, b) => rank[a.phase] - rank[b.phase] || a.code.localeCompare(b.code, 'ar')); return out;
}

/* ───────── التثبيت (الأستاذ) ───────── */
export async function pinHour(db: Db, me: Me, classroomId: string, b: { weekday?: unknown; time?: unknown }, now = new Date()): Promise<{ ok: true; count: number; first: string | null; notified: number } | Fail> {
  const who = await hourRole(db, me, classroomId); if (!who || who.role !== 'instructor') return fail('تثبيت الساعة لأستاذ الشعبة أو الطاقم', 403);
  const v = validatePin(b); if (!v.ok) return fail(v.error);
  const prog = who.room.program_id ? await safe<any>(db.from('programs').select('id,end_date,organization_id').eq('id', who.room.program_id).maybeSingle(), null) : null;
  const days = occurrences(v.weekday, v.time, now, prog?.end_date ? String(prog.end_date).slice(0, 10) : null); if (!days.length) return fail('لا موعد متاح قبل نهاية البرنامج — راجع تاريخ النهاية');
  await db.from('portal_sessions').delete().eq('classroom_id', classroomId).eq('kind', SESSION_KIND).eq('status', 'scheduled').gt('starts_at', now.toISOString());
  const series = randomUUID(); const label = `${P73_NAMES_AR.session_title} — شعبة ${who.room.code}`;
  const rows = days.map((d) => ({ program_id: who.room.program_id, classroom_id: classroomId, trainer_id: who.room.trainer_id, series_id: series, kind: SESSION_KIND, title_ar: label, description_ar: `${P73_NAMES_AR.official}: بلا تعليم ولا تصحيح — نقرأ ما كتبناه ونحمل سطرًا ونكتب كلمة ونختم سطرًا معًا.`, starts_at: riyadhStartIso(d, v.time), duration_min: HOUR_LIMITS.minutes, provider: 'athar', access: 'program', status: 'scheduled', lang: 'ar', created_by: me.id, organization_id: prog?.organization_id || null }));
  const { error } = await db.from('portal_sessions').insert(rows); if (error) return fail(error.message, 500);
  let notified = 0; const t = pinNotice(who.room.code, v.weekday, v.time);
  for (const e of await rosterEmails(db, classroomId)) { try { const r = await pushNotice(db, { email: e.email, user_id: e.user_id, report_id: null, kind: 'hour_pinned' as any, ...t, url: `${P73_NAMES_AR.path}?classroom=${classroomId}`, ref_id: classroomId, dedupe_key: `hour_pin:${series}:${e.email}` }); if (r.inserted) notified += 1; } catch { /* لا شيء */ } }
  return { ok: true, count: rows.length, first: days[0] || null, notified };
}
export async function unpinHour(db: Db, me: Me, classroomId: string, now = new Date()): Promise<{ ok: true } | Fail> {
  const who = await hourRole(db, me, classroomId); if (!who || who.role !== 'instructor') return fail('إلغاء الساعة لأستاذ الشعبة أو الطاقم', 403);
  const { error } = await db.from('portal_sessions').delete().eq('classroom_id', classroomId).eq('kind', SESSION_KIND).eq('status', 'scheduled').gt('starts_at', now.toISOString()); if (error) return fail(error.message, 500); return { ok: true };
}

/* ───────── الغرفة ───────── */
export type HourView = {
  role: Role; room: Room; program_ar: string; roster: number; pin: Pin; phase: PhaseInfo; day: string | null; home: boolean;
  week: WeekView; carried: { id: number; text: string } | null; cloud: CloudView; my_word: string | null; lines: LinesView; my_line: { id: number; text: string } | null;
  seal: { line: string | null; head_ar: string; cloud: SealMeta['cloud']; at: string } | null; history: Array<{ day: string; line: string | null }>; counts: { words: number; lines: number; carries: number; votes: number };
  names: typeof P73_NAMES_AR; limits: typeof HOUR_LIMITS; weekdays: typeof WEEKDAYS_AR; now: string;
};
async function hourRows(db: Db, classroomId: string, day: string) { return safe<any[]>(db.from('portal_learning_lines').select('id,user_id,kind,body_ar,meta,day,created_at').eq('classroom_id', classroomId).eq('day', day).in('kind', ['hour_word', 'hour_line', 'hour_vote', 'carry', 'hour_seal']).limit(600), []); }
export async function hourView(db: Db, me: Me, classroomId: string, now = new Date()): Promise<HourView | Fail> {
  const who = await hourRole(db, me, classroomId); if (!who) return fail('هذه الشعبة ليست من شُعبك', 404);
  const { info, sessions, seals } = await phaseFor(db, classroomId, now); const day = info.session?.day || null;
  const [prog, roster] = await Promise.all([who.room.program_id ? safe<any>(db.from('programs').select('name_ar').eq('id', who.room.program_id).maybeSingle(), null) : Promise.resolve(null), rosterEmails(db, classroomId)]);
  const base = { role: who.role, room: who.room, program_ar: String(prog?.name_ar || 'برنامجك'), roster: roster.length, pin: pinOf(sessions, now), phase: info, day, names: P73_NAMES_AR, limits: HOUR_LIMITS, weekdays: WEEKDAYS_AR, now: now.toISOString(), history: seals.filter((s) => s.body_ar && s.body_ar !== '—').slice(0, 12).map((s) => ({ day: String(s.day), line: String(s.body_ar) })) };
  const empty = { week: weekViewOf([], me.id, 'x'), carried: null, cloud: cloudOf([]), my_word: null, lines: linesViewOf([], [], me.id, 'x'), my_line: null, seal: null, counts: { words: 0, lines: 0, carries: 0, votes: 0 }, home: false };
  if (!day || !info.session) return { ...base, ...empty };
  const seed = info.session.id; const from = addDaysKey(day, -6);
  const [weekRows, rows] = await Promise.all([
    safe<any[]>(db.from('portal_learning_lines').select('id,user_id,kind,body_ar,day').eq('classroom_id', classroomId).in('kind', ['learn', 'apply', 'commit']).gte('day', from).lte('day', day).order('day').limit(HOUR_LIMITS.weekLinesMax), []),
    hourRows(db, classroomId, day),
  ]);
  const words = rows.filter((r) => r.kind === 'hour_word'); const lines = rows.filter((r) => r.kind === 'hour_line'); const votes = rows.filter((r) => r.kind === 'hour_vote').map((r) => ({ user_id: String(r.user_id), for: Number(r.meta?.for || 0) })); const carries = rows.filter((r) => r.kind === 'carry'); const sealRow = rows.find((r) => r.kind === 'hour_seal') || null;
  const myCarry = carries.find((r) => String(r.user_id) === me.id); const myWord = words.find((r) => String(r.user_id) === me.id); const myLine = lines.find((r) => String(r.user_id) === me.id);
  return { ...base,
    home: info.phase === 'home',
    week: weekViewOf(weekRows.map((r) => ({ id: Number(r.id), user_id: String(r.user_id), kind: String(r.kind), body_ar: String(r.body_ar || ''), day: String(r.day) })), me.id, seed),
    carried: myCarry ? { id: Number(myCarry.meta?.from || 0), text: String(myCarry.body_ar) } : null,
    cloud: cloudOf(words.map((r) => ({ user_id: String(r.user_id), body_ar: String(r.body_ar || '') }))), my_word: myWord ? String(myWord.body_ar) : null,
    lines: linesViewOf(lines.map((r) => ({ id: Number(r.id), user_id: String(r.user_id), body_ar: String(r.body_ar || '') })), votes, me.id, seed), my_line: myLine ? { id: Number(myLine.id), text: String(myLine.body_ar) } : null,
    seal: sealRow ? { line: sealRow.body_ar && sealRow.body_ar !== '—' ? String(sealRow.body_ar) : null, head_ar: sealHeadAr(sealRow.meta || { people: 0, words: 0, lines: 0, carries: 0 }), cloud: arr(sealRow.meta?.cloud), at: String(sealRow.created_at) } : null,
    counts: { words: words.length, lines: lines.length, carries: carries.length, votes: validVotes(lines.map((r) => ({ id: Number(r.id), user_id: String(r.user_id), body_ar: String(r.body_ar || '') })), votes).length },
  };
}

/* ───────── الأفعال ───────── */
type Ctx = { who: { role: Role; room: Room }; info: PhaseInfo; day: string; session: HourSession };
async function ctxOf(db: Db, me: Me, classroomId: string, now: Date, needLearner = true): Promise<Ctx | Fail> {
  const who = await hourRole(db, me, classroomId); if (!who) return fail('هذه الشعبة ليست من شُعبك', 404);
  if (needLearner && who.role !== 'learner') return fail('هذا للمتدرّبين — الأستاذ يفتح ويختم ولا يكتب', 403);
  const { info } = await phaseFor(db, classroomId, now); if (!info.session || (info.phase !== 'open' && info.phase !== 'home')) return fail(info.phase === 'before' ? 'الساعة لم تُفتح بعد' : 'لا ساعة مفتوحة الآن', 409);
  return { who, info, day: info.session.day, session: info.session };
}
async function myRow(db: Db, me: Me, classroomId: string, kind: string, day: string) { return safe<any>(db.from('portal_learning_lines').select('id,body_ar,meta').eq('user_id', me.id).eq('classroom_id', classroomId).eq('kind', kind).eq('day', day).maybeSingle(), null); }
async function putRow(db: Db, me: Me, c: Ctx, kind: string, body_ar: string, meta: Record<string, unknown>): Promise<{ id: number } | Fail> {
  const ex = await myRow(db, me, c.who.room.id, kind, c.day); const home = c.info.phase === 'home' ? 1 : 0;
  if (ex) { const { error } = await db.from('portal_learning_lines').update({ body_ar, meta: { ...meta, home, session_id: c.session.id }, updated_at: new Date().toISOString() }).eq('id', ex.id); if (error) return fail(error.message, 500); return { id: Number(ex.id) }; }
  const { data, error } = await db.from('portal_learning_lines').insert({ user_id: me.id, email: lower(me.email), classroom_id: c.who.room.id, program_id: c.who.room.program_id, kind, day: c.day, body_ar, meta: { ...meta, home, session_id: c.session.id } }).select('id').single(); if (error) return fail(error.message, 500); return { id: Number(data?.id || 0) };
}
/** «أحمله معي»: سطر واحد لغيري — يُنسخ نصّه (يبقى لو حُذف الأصل) ويصل صاحبَه إشعار بلا اسم */
export async function actCarry(db: Db, me: Me, classroomId: string, b: { line_id?: unknown }, now = new Date()): Promise<{ ok: true; carried: { id: number; text: string } } | Fail> {
  const c = await ctxOf(db, me, classroomId, now); if ('error' in c) return c; const lid = Number(b.line_id); if (!Number.isInteger(lid) || lid <= 0) return fail('اختر سطرًا');
  const src = await safe<any>(db.from('portal_learning_lines').select('id,user_id,email,body_ar,classroom_id,kind').eq('id', lid).maybeSingle(), null);
  if (!src || String(src.classroom_id) !== classroomId || !['learn', 'apply', 'commit'].includes(String(src.kind))) return fail('السطر ليس من سطور الشعبة هذا الأسبوع', 404); if (String(src.user_id) === me.id) return fail('احمل سطرًا لغيرك — سطرك معك أصلًا');
  const text = cleanText(src.body_ar); const r = await putRow(db, me, c, 'carry', text.slice(0, 200), { from: lid }); if ('error' in r) return r;
  try { const t = carryNotice(c.who.room.code); await pushNotice(db, { email: String(src.email || ''), user_id: String(src.user_id), report_id: null, kind: 'hour_carry' as any, ...t, url: `${P73_NAMES_AR.path}?classroom=${classroomId}`, ref_id: String(lid), dedupe_key: `hour_carry:${lid}:${me.id}` }); } catch { /* لا شيء */ }
  return { ok: true, carried: { id: lid, text } };
}
export async function actWord(db: Db, me: Me, classroomId: string, b: { text?: unknown }, now = new Date()): Promise<{ ok: true; word: string } | Fail> {
  const c = await ctxOf(db, me, classroomId, now); if ('error' in c) return c; const v = validateWord(b.text); if (!v.ok) return fail(v.error);
  const r = await putRow(db, me, c, 'hour_word', v.word, {}); if ('error' in r) return r; return { ok: true, word: v.word };
}
export async function actLine(db: Db, me: Me, classroomId: string, b: { text?: unknown }, now = new Date()): Promise<{ ok: true; line: { id: number; text: string } } | Fail> {
  const c = await ctxOf(db, me, classroomId, now); if ('error' in c) return c; if (c.info.phase === 'home') { const sealed = await sealsOf(db, classroomId, 3); if (sealed.some((s) => String(s.meta?.session_id) === c.session.id)) return fail('خُتم سطر الساعة — تستطيع أن تحمل سطرًا وتكتب كلمتك', 409); }
  const v = validateHourLine(b.text); if (!v.ok) return fail(v.error); const r = await putRow(db, me, c, 'hour_line', v.text, {}); if ('error' in r) return r; return { ok: true, line: { id: r.id, text: v.text } };
}
export async function actVote(db: Db, me: Me, classroomId: string, b: { line_id?: unknown }, now = new Date()): Promise<{ ok: true; for: number } | Fail> {
  const c = await ctxOf(db, me, classroomId, now); if ('error' in c) return c; const lid = Number(b.line_id); if (!Number.isInteger(lid) || lid <= 0) return fail('اختر سطرًا');
  const sealed = await sealsOf(db, classroomId, 3); if (sealed.some((s) => String(s.meta?.session_id) === c.session.id)) return fail('خُتم سطر الساعة — انتهى التصويت', 409);
  const l = await safe<any>(db.from('portal_learning_lines').select('id,user_id,classroom_id,kind,day').eq('id', lid).maybeSingle(), null);
  if (!l || String(l.classroom_id) !== classroomId || l.kind !== 'hour_line' || String(l.day) !== c.day) return fail('السطر ليس من سطور هذه الساعة', 404); if (String(l.user_id) === me.id) return fail('صوّت لسطر غيرك');
  const r = await putRow(db, me, c, 'hour_vote', 'صوت', { for: lid }); if ('error' in r) return r; return { ok: true, for: lid };
}
/** الختم (الأستاذ): يختار النظام السطر بالأصوات (التعادل → الأقصر) · يحفظ الأعداد لا الأسماء · يُنهي الجلسة · يُخبر الشعبة */
export async function actSeal(db: Db, me: Me, classroomId: string, now = new Date()): Promise<{ ok: true; line: string | null; meta: SealMeta; notified: number } | Fail> {
  const who = await hourRole(db, me, classroomId); if (!who) return fail('هذه الشعبة ليست من شُعبك', 404); if (who.role !== 'instructor') return fail('الختم لأستاذ الشعبة', 403);
  const { info, seals } = await phaseFor(db, classroomId, now); if (!info.session || (info.phase !== 'open' && info.phase !== 'home')) return fail('لا ساعة مفتوحة لتُختم', 409);
  if (seals.some((s) => String(s.meta?.session_id) === info.session!.id)) return fail('خُتمت هذه الساعة من قبل', 409);
  const day = info.session.day; const rows = await hourRows(db, classroomId, day);
  const words = rows.filter((r) => r.kind === 'hour_word'); const lines = rows.filter((r) => r.kind === 'hour_line').map((r) => ({ id: Number(r.id), user_id: String(r.user_id), body_ar: String(r.body_ar || '') })); const votes = rows.filter((r) => r.kind === 'hour_vote').map((r) => ({ user_id: String(r.user_id), for: Number(r.meta?.for || 0) })); const carries = rows.filter((r) => r.kind === 'carry');
  const people = new Set(rows.filter((r) => r.kind !== 'hour_seal').map((r) => String(r.user_id))).size; const pick = pickLine(lines, votes); const cloud = cloudOf(words.map((r) => ({ user_id: String(r.user_id), body_ar: String(r.body_ar || '') })));
  const meta: SealMeta = { session_id: info.session.id, line_id: pick?.id || null, people, words: words.length, lines: lines.length, carries: carries.length, votes: validVotes(lines, votes).length, cloud: cloud.shown ? cloud.items.slice(0, 12) : [], sealed_at: now.toISOString(), home: rows.filter((r) => r.meta?.home).length };
  const { error } = await db.from('portal_learning_lines').insert({ user_id: me.id, email: lower(me.email), classroom_id: classroomId, program_id: who.room.program_id, kind: 'hour_seal', day, body_ar: pick ? pick.text : '—', meta }); if (error) return fail(error.message, 500);
  try { await db.from('portal_sessions').update({ status: 'ended', updated_at: now.toISOString() }).eq('id', info.session.id); } catch { /* لا شيء */ }
  let notified = 0; const t = sealNotice(who.room.code, pick ? pick.text : null, day);
  for (const e of await rosterEmails(db, classroomId)) { try { const r = await pushNotice(db, { email: e.email, user_id: e.user_id, report_id: null, kind: 'hour_sealed' as any, ...t, url: `${P73_NAMES_AR.path}?classroom=${classroomId}`, ref_id: info.session.id, dedupe_key: `hour_seal:${info.session.id}:${e.email}` }); if (r.inserted) notified += 1; } catch { /* لا شيء */ } }
  return { ok: true, line: pick ? pick.text : null, meta, notified };
}

/* ───────── النسيج والاعتماد ───────── */
/** خيط «ساعاتنا» في نسيج الشعبة: السطور الجماعية المختومة (بلا أسماء — ملك الشعبة) */
export async function hourSeals(db: Db, classroomId: string, limit = 20): Promise<Array<{ day: string; day_ar: string; line: string | null; people: number; words: number; carries: number }>> {
  const seals = await sealsOf(db, classroomId, limit); const { fmtDayAr } = await import('./registry');
  return seals.map((s) => ({ day: String(s.day), day_ar: fmtDayAr(String(s.day)), line: s.body_ar && s.body_ar !== '—' ? String(s.body_ar) : null, people: Number(s.meta?.people || 0), words: Number(s.meta?.words || 0), carries: Number(s.meta?.carries || 0) }));
}
/** «ساعة الدفعة» في ملف الاعتماد: أعداد فقط (ساعات مختومة · سطور محمولة) تحت 3.5 — لا محتوى ولا أسماء */
export async function hourEvidence(db: Db, programId: string): Promise<Array<{ id: string; kind: 'hour'; codes: string[]; label_ar: string; at: null; href: null; n: number }>> {
  const rows = await safe<any[]>(db.from('portal_learning_lines').select('kind,classroom_id,user_id').eq('program_id', programId).in('kind', ['hour_seal', 'carry']).limit(5000), []);
  const seals = rows.filter((r) => r.kind === 'hour_seal'); const carries = rows.filter((r) => r.kind === 'carry'); if (!seals.length) return [];
  const rooms = new Set(seals.map((r) => String(r.classroom_id))).size; const carriers = new Set(carries.map((r) => String(r.user_id))).size;
  const label = `ساعة الدفعة: ${seals.length} ${seals.length === 1 ? 'ساعة أثر مختومة' : seals.length === 2 ? 'ساعتا أثر مختومتان' : 'ساعات أثر مختومة'} في ${rooms} ${rooms === 1 ? 'شعبة' : 'شُعب'}${carriers >= HOUR_LIMITS.k ? ` — حمل ${carriers} متدرّبًا سطورًا من زملائهم (${carries.length} سطرًا)` : ''} · لقاء تأمل أسبوعي بلا تقييم`;
  return [{ id: 'hour:seals', kind: 'hour', codes: ['3.5'], label_ar: label, at: null, href: null, n: seals.length }];
}
