// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P45 «بروفة» — القراءة/الكتابة (Supabase بمفتاح الخدمة؛ البوابات في المسار)
 *  الطلب (الآن/موعد · الدائرة) · القبول (يفتح غرفة rehearsal لشخصين 15 دقيقة) · الإنهاء · الجملتان (طيبة للآخر · «ما سأفعله مختلفًا» لنفسي)
 *  · «كيف مرّ؟» بعد الموقف الحقيقي · الانتهاء الكسول · البلاغ (يغلق الغرفة ويصل الطاقم) · العام k≥5 · الطاقم.
 *  لا كرون: كل المهل تُحسم عند أول تحميل.
 */
import { notify } from '../portal/notify';
import { SECTORS_2062, sectorByCode } from '../portal/lexicon';
import { roomCode } from '../portal/media';
import { loadMyProfile } from '../directory/load';
import { REH_COLS, ROOM_MINUTES, P45_NAMES_AR, NOTES_HOURS, toView, sortOpen, shouldExpire, canAccept, canCancel, canNote, canAnswerHow, kindNoteDelivered, roleCardAr, roomTitleAr, publicLearned, witnessLineAr, isParty, isAsker, cleanNote, HOW } from './registry';
import type { RehRow, RehView, NoteRow, NoteKind, RehHow } from './registry';

const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();
/** الاسم الذي يُكشف للطرف الآخر بعد القبول: الاسم الكامل، وإلا الجزء المحلي من البريد (كما في الغرف) */
const displayName = (me: { name: string; email: string }) => (me.name || me.email.split('@')[0] || 'زميل').slice(0, 80);
async function safe<T>(q: PromiseLike<{ data: any; error: any }>, fb: T): Promise<T> { try { const { data, error } = await q; if (error) return fb; return (data ?? fb) as T; } catch { return fb; } }
export type Me = { id: string; email: string; name: string; staff: boolean; faculty?: boolean; enrolled?: boolean; programs?: string[]; needs?: string[] };
export const SECTOR_CODES: readonly string[] = SECTORS_2062.map(s => s.code);
export const sectorAr = (c: string) => sectorByCode(c)?.name.ar || c;
export const SECTOR_OPTIONS = SECTORS_2062.map(s => ({ code: s.code, ar: s.name.ar }));

/** أهلية من يلعب الدور ودوائره: هيئة معتمَدة · تسجيلات في برامج · حاجات أعلنها أو أيّدها */
export async function enrich(db: any, me: Me): Promise<Me> {
  const p = await loadMyProfile(db, me).catch(() => null); const faculty = me.staff || (!!p && p.status === 'approved');
  const enr = await safe<any[]>(db.from('portal_enrollments').select('program_id,status').or(`user_id.eq.${me.id},email.eq.${me.email}`).limit(200), []);
  const programs = Array.from(new Set(enr.filter(e => !['rejected', 'cancelled'].includes(String(e.status))).map(e => String(e.program_id))));
  const mineNeeds = await safe<any[]>(db.from('portal_needs').select('id').or(`user_id.eq.${me.id},email.eq.${me.email}`).limit(200), []);
  const sup = await safe<any[]>(db.from('portal_need_supports').select('need_id').or(`user_id.eq.${me.id},email.eq.${me.email}`).limit(500), []);
  const needs = Array.from(new Set([...mineNeeds.map(n => String(n.id)), ...sup.map(s => String(s.need_id))]));
  return { ...me, faculty, enrolled: programs.length > 0, programs, needs };
}

/* ───────── القراءة ───────── */
export async function rehById(db: any, id: string): Promise<RehRow | null> { return safe<RehRow | null>(db.from('portal_rehearsals').select(REH_COLS).eq('id', id).maybeSingle(), null); }
export async function rehByRoom(db: any, code: string): Promise<RehRow | null> { return safe<RehRow | null>(db.from('portal_rehearsals').select(REH_COLS).eq('room_code', code).maybeSingle(), null); }
/** الانتهاء الكسول للطلبات المفتوحة التي تجاوزت وقتها */
export async function expireStale(db: any, rows: RehRow[], site: string, now = new Date()): Promise<RehRow[]> {
  const out: RehRow[] = [];
  for (const r of rows) {
    if (!shouldExpire(r, now)) { out.push(r); continue; }
    const { error } = await db.from('portal_rehearsals').update({ status: 'expired' }).eq('id', r.id).eq('status', 'open');
    if (!error) { try { await notify(db, { kind: 'rehearsal_expired', to: { email: r.email }, ref: `reh:expired:${r.id}`, subject: 'لم يُوجد من يلعب الدور في الوقت', text: `لم يقبل أحد بروفتك «${r.other_role_ar}» في وقتها. جرّب موعدًا مؤجَّلًا خلال أسبوع أو وسّع الدائرة.`, url: `${site}/me/rehearsal` }); } catch { /* داخلي */ } out.push({ ...r, status: 'expired' }); }
    else out.push(r);
  }
  return out;
}
/** اللوحة لمسجَّل: الطلبات المفتوحة من غيره (بلا أسماء) ضمن دوائره · بروفاته (طلب أو دور) · جمله */
export async function board(db: any, me: Me, site: string): Promise<{ open: RehView[]; mine: RehView[]; notes: Record<string, { kind_mine: string | null; self_mine: string | null; self_public: boolean; kind_from_partner: string | null; kind_delivered: boolean; partner_wrote: boolean }>; summary_rows: RehRow[] }> {
  let rows = await safe<RehRow[]>(db.from('portal_rehearsals').select(REH_COLS).order('created_at', { ascending: false }).limit(400), []);
  rows = await expireStale(db, rows, site);
  const mineRows = rows.filter(r => isParty(r, me));
  const openRows = sortOpen(rows.filter(r => r.status === 'open' && !isAsker(r, me) && canAccept(r, me).ok));
  const notes = await notesFor(db, mineRows, me);
  return { open: openRows.map(r => toView(r, { me, sectorAr })), mine: mineRows.map(r => toView(r, { me, sectorAr })), notes, summary_rows: rows };
}
async function notesFor(db: any, rows: RehRow[], me: Me) {
  const out: Record<string, { kind_mine: string | null; self_mine: string | null; self_public: boolean; kind_from_partner: string | null; kind_delivered: boolean; partner_wrote: boolean }> = {};
  const ids = rows.filter(r => ['accepted', 'done'].includes(r.status)).map(r => r.id); if (!ids.length) return out;
  const all = await safe<NoteRow[]>(db.from('portal_rehearsal_notes').select('id,created_at,rehearsal_id,user_id,email,kind,text_ar,public_ok,sector').in('rehearsal_id', ids).limit(2000), []);
  for (const r of rows) {
    if (!ids.includes(r.id)) continue; const ns = all.filter(n => n.rehearsal_id === r.id); const mineN = ns.filter(n => lower(n.email) === lower(me.email) || (n.user_id && n.user_id === me.id)); const theirs = ns.filter(n => !mineN.includes(n));
    const kindMine = mineN.find(n => n.kind === 'kind_to_partner'); const selfMine = mineN.find(n => n.kind === 'to_self'); const kindTheirs = theirs.find(n => n.kind === 'kind_to_partner');
    const delivered = kindNoteDelivered(r, !!kindMine && !!kindTheirs);
    out[r.id] = { kind_mine: kindMine?.text_ar || null, self_mine: selfMine?.text_ar || null, self_public: !!selfMine?.public_ok, kind_from_partner: kindTheirs && delivered ? kindTheirs.text_ar : null, kind_delivered: delivered, partner_wrote: !!kindTheirs };
  }
  return out;
}
/** بروفات مفتوحة لبرنامج (صفحة البرنامج — عام بلا أسماء) */
export async function openForProgram(db: any, programId: string): Promise<{ count: number; roles: string[] }> {
  const rows = await safe<RehRow[]>(db.from('portal_rehearsals').select(REH_COLS).eq('circle', 'program').eq('circle_ref', programId).eq('status', 'open').limit(50), []);
  const live = rows.filter(r => !shouldExpire(r)); return { count: live.length, roles: Array.from(new Set(live.map(r => r.other_role_ar))).slice(0, 5) };
}
/** العام: ما تعلّمناه من البروفات (k≥5 في القطاع) + سطر الشهر */
export async function publicBoard(db: any) {
  const notes = await safe<NoteRow[]>(db.from('portal_rehearsal_notes').select('id,created_at,rehearsal_id,user_id,email,kind,text_ar,public_ok,sector').eq('kind', 'to_self').eq('public_ok', true).order('created_at', { ascending: false }).limit(2000), []);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const done = await safe<any[]>(db.from('portal_rehearsals').select('sector,other_role_ar,done_at,status').eq('status', 'done').gte('done_at', since).limit(2000), []);
  return { learned: publicLearned(notes, sectorAr), line_ar: witnessLineAr(done, sectorAr), k: 5 };
}
/** الطاقم: كل البروفات (بلا الجمل الخاصة) */
export async function adminBoard(db: any, site: string) {
  let rows = await safe<RehRow[]>(db.from('portal_rehearsals').select(REH_COLS).order('created_at', { ascending: false }).limit(500), []); rows = await expireStale(db, rows, site);
  const roles = new Map<string, number>(); for (const r of rows) roles.set(r.other_role_ar, (roles.get(r.other_role_ar) || 0) + 1);
  return { items: rows.map(r => ({ ...r, sector_ar: sectorAr(r.sector), name_ar: r.name_ar || r.email.split('@')[0], partner_name_ar: r.partner_name_ar || (r.partner_email ? r.partner_email.split('@')[0] : null) })), top_roles: Array.from(roles.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([role, n]) => ({ role, n })), waiting: rows.filter(r => r.status === 'open').length, reported: rows.filter(r => r.status === 'reported').length };
}

/* ───────── الكتابة ───────── */
export async function createRehearsal(db: any, me: Me, r: { sector: string; situation_ar: string; my_role_ar: string; other_role_ar: string; mode: 'now' | 'scheduled'; scheduled_at: string | null; real_at: string | null; circle: string; circle_ref: string | null; expires_at: string }, src: { source: string; source_ref: string | null }, site: string): Promise<{ ok: true; reh: RehRow } | { ok: false; error: string }> {
  const openMine = await safe<any[]>(db.from('portal_rehearsals').select('id').eq('status', 'open').or(`user_id.eq.${me.id},email.eq.${me.email}`).limit(5), []); if (openMine.length >= 3 && !me.staff) return { ok: false, error: 'لديك ثلاثة طلبات مفتوحة — انتظر أحدها أو ألغِه' };
  if (r.circle === 'program' && r.circle_ref && !me.staff && !(me.programs || []).includes(r.circle_ref)) return { ok: false, error: 'لست مسجَّلًا في هذا البرنامج' };
  if (r.circle === 'need' && r.circle_ref && !me.staff && !(me.needs || []).includes(r.circle_ref)) return { ok: false, error: 'لست من أعلنوا هذه الحاجة أو أيّدوها' };
  const row = { user_id: me.id, email: me.email, name_ar: displayName(me), ...r, source: src.source, source_ref: src.source_ref, status: 'open' as const };
  const { data, error } = await db.from('portal_rehearsals').insert(row).select(REH_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  const reh = (data || { ...row, id: '', created_at: nowIso() }) as RehRow;
  // إشعار داخلي موجَّه: من أعلنوا الحاجة نفسها (دائرة الحاجة) — بلا اسم الطالب
  if (r.circle === 'need' && r.circle_ref) { for (const email of (await needPeople(db, r.circle_ref)).filter(e => e !== me.email).slice(0, 50)) { try { await notify(db, { kind: 'rehearsal_wanted', to: { email }, ref: `reh:wanted:${reh.id}:${email}`, subject: 'زميل يطلب بروفة لموقف أعلنتموه معًا', text: `ممارس أعلن معك الحاجة نفسها يطلب من يلعب دور «${r.other_role_ar}» في بروفة ${r.mode === 'now' ? 'الآن' : 'بموعد'}. خمس عشرة دقيقة قد تغيّر موقفه الحقيقي.`, url: `${site}/me/rehearsal?r=${reh.id}` }); } catch { /* داخلي */ } } }
  return { ok: true, reh };
}
async function needPeople(db: any, needId: string): Promise<string[]> {
  const n = await safe<any>(db.from('portal_needs').select('email').eq('id', needId).maybeSingle(), null); const s = await safe<any[]>(db.from('portal_need_supports').select('email').eq('need_id', needId).limit(500), []);
  return Array.from(new Set([n?.email, ...s.map(x => x.email)].filter(Boolean).map(lower)));
}
async function uniqueRoomCode(db: any): Promise<string> { for (let i = 0; i < 6; i++) { const c = roomCode(); const rows = await safe<any[]>(db.from('portal_rooms').select('id').eq('code', c).limit(1), []); if (!rows.length) return c; } return roomCode(); }
/** القبول: أول قابل يحجزها · تُفتح غرفة بروفة لشخصين · يُكشف الاسمان · يُبلَّغ الطالب */
export async function acceptRehearsal(db: any, me: Me, id: string, site: string): Promise<{ ok: true; reh: RehRow; room_code: string } | { ok: false; error: string }> {
  const r = await rehById(db, id); if (!r) return { ok: false, error: 'الطلب غير موجود' }; const c = canAccept(r, me); if (!c.ok) return c;
  const code = await uniqueRoomCode(db);
  const { data: room, error: re } = await db.from('portal_rooms').insert({ code, title: roomTitleAr(r), kind: 'rehearsal', created_by: me.id, prompt: roleCardAr(r), max_peers: 2, minutes: ROOM_MINUTES, status: 'open', notes: [] }).select('id,code').maybeSingle(); if (re || !room) return { ok: false, error: re?.message || 'تعذّر فتح الغرفة' };
  const patch = { status: 'accepted', partner_user_id: me.id, partner_email: me.email, partner_name_ar: displayName(me), accepted_at: nowIso(), room_code: code };
  const { data, error } = await db.from('portal_rehearsals').update(patch).eq('id', id).eq('status', 'open').select(REH_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; if (!data) return { ok: false, error: 'سبقك إليها زميل' };
  try { await notify(db, { kind: 'rehearsal_accepted', to: { email: r.email }, ref: `reh:accepted:${id}`, subject: `${displayName(me)} سيلعب دور «${r.other_role_ar}»`, text: `قبل ${displayName(me)} بروفتك. الغرفة جاهزة ${r.mode === 'now' ? 'الآن' : `في موعدها`} — رمزها ${code}. خمس عشرة دقيقة، لا يُسجَّل شيء.`, url: `${site}/room/${code}` }); } catch { /* داخلي */ }
  return { ok: true, reh: data as RehRow, room_code: code };
}
export async function cancelRehearsal(db: any, me: Me, id: string, site: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await rehById(db, id); if (!r) return { ok: false, error: 'الطلب غير موجود' }; const c = canCancel(r, me); if (!c.ok) return c;
  await db.from('portal_rehearsals').update({ status: 'cancelled' }).eq('id', id); if (r.room_code) await db.from('portal_rooms').update({ status: 'closed', closed_at: nowIso() }).eq('code', r.room_code);
  if (r.partner_email) { try { await notify(db, { kind: 'rehearsal_cancelled', to: { email: r.partner_email }, ref: `reh:cancelled:${id}`, subject: 'أُلغيت بروفة كنت ستلعب فيها دورًا', text: `ألغى صاحبها بروفة «${r.other_role_ar}». شكرًا لأنك قبلت.`, url: `${site}/me/rehearsal` }); } catch { /* داخلي */ } }
  return { ok: true };
}
/** الإنهاء: أيّ من الطرفين (أو إغلاق الغرفة) → done · تُغلق الغرفة */
export async function finishRehearsal(db: any, me: Me, id: string): Promise<{ ok: true; reh: RehRow } | { ok: false; error: string }> {
  const r = await rehById(db, id); if (!r) return { ok: false, error: 'الطلب غير موجود' }; if (!isParty(r, me) && !me.staff) return { ok: false, error: 'لست طرفًا في هذه البروفة' }; if (r.status !== 'accepted') return { ok: false, error: r.status === 'done' ? 'انتهت من قبل' : 'لم تبدأ بعد' };
  const { data } = await db.from('portal_rehearsals').update({ status: 'done', done_at: nowIso() }).eq('id', id).eq('status', 'accepted').select(REH_COLS).maybeSingle(); if (r.room_code) await db.from('portal_rooms').update({ status: 'closed', closed_at: nowIso() }).eq('code', r.room_code);
  return { ok: true, reh: (data || { ...r, status: 'done', done_at: nowIso() }) as RehRow };
}
/** الجملتان — تُسلَّم الطيبة حين يكتب الطرفان (أو بعد 24 ساعة) */
export async function writeNote(db: any, me: Me, id: string, kind: NoteKind, text: unknown, publicOk: boolean, site: string): Promise<{ ok: true; delivered: boolean } | { ok: false; error: string }> {
  const r = await rehById(db, id); if (!r) return { ok: false, error: 'الطلب غير موجود' };
  if (r.status === 'accepted' && (isParty(r, me))) { await finishRehearsal(db, me, id); r.status = 'done'; r.done_at = nowIso(); }
  const c = canNote(r, me); if (!c.ok) return c; const t = cleanNote(kind, text); if (!t.ok) return t;
  const row = { rehearsal_id: id, user_id: me.id, email: me.email, kind, text_ar: t.text, public_ok: kind === 'to_self' ? !!publicOk : false, sector: r.sector };
  const existing = await safe<any[]>(db.from('portal_rehearsal_notes').select('id').eq('rehearsal_id', id).eq('kind', kind).ilike('email', me.email).limit(1), []);
  const { error } = existing.length ? await db.from('portal_rehearsal_notes').update({ text_ar: t.text, public_ok: row.public_ok }).eq('id', existing[0].id) : await db.from('portal_rehearsal_notes').insert(row); if (error) return { ok: false, error: error.message };
  let delivered = false;
  if (kind === 'kind_to_partner') {
    const other = isAsker(r, me) ? r.partner_email : r.email; const theirs = other ? await safe<any[]>(db.from('portal_rehearsal_notes').select('id').eq('rehearsal_id', id).eq('kind', 'kind_to_partner').ilike('email', other).limit(1), []) : [];
    delivered = kindNoteDelivered(r, theirs.length > 0);
    if (delivered && other) { for (const email of [other, me.email]) { try { await notify(db, { kind: 'rehearsal_kind', to: { email }, ref: `reh:kind:${id}:${email}`, subject: 'وصلتك جملة طيبة من بروفتك', text: `كتب لك شريك بروفتك «${r.other_role_ar}» جملة طيبة — تقرأها في بروفاتك.`, url: `${site}/me/rehearsal?r=${id}` }); } catch { /* داخلي */ } } }
  }
  return { ok: true, delivered };
}
export async function answerHow(db: any, me: Me, id: string, how: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await rehById(db, id); if (!r) return { ok: false, error: 'الطلب غير موجود' }; if (!canAnswerHow(r, me)) return { ok: false, error: 'يُجاب عن «كيف مرّ؟» بعد بروفة تمّت وبعد الموقف الحقيقي' };
  const h = String(how || ''); if (!(HOW as readonly string[]).includes(h)) return { ok: false, error: 'اختر إجابة' };
  const { error } = await db.from('portal_rehearsals').update({ how_went: h as RehHow, how_went_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message }; return { ok: true };
}
/** البلاغ من داخل الغرفة: يغلق الغرفة والبروفة ويصل الطاقم بالهويتين فقط — لا نصّ */
export async function reportRehearsal(db: any, me: Me, id: string, site: string, staffEmails: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await rehById(db, id); if (!r) return { ok: false, error: 'الطلب غير موجود' }; if (!isParty(r, me)) return { ok: false, error: 'لست طرفًا في هذه البروفة' };
  await db.from('portal_rehearsals').update({ status: 'reported', reported_by: me.id, reported_at: nowIso() }).eq('id', id); if (r.room_code) await db.from('portal_rooms').update({ status: 'closed', closed_at: nowIso() }).eq('code', r.room_code);
  for (const email of staffEmails) { try { await notify(db, { kind: 'rehearsal_reported', to: { email }, ref: `reh:reported:${id}:${email}`, subject: 'بلاغ من غرفة بروفة', text: `أغلق ${me.name || me.email} غرفة بروفة وبلّغ. الطرفان: ${r.email} و${r.partner_email || '—'}. لا نصّ محفوظ من الغرفة — تواصل معهما.`, url: `${site}/admin/rehearsals` }); } catch { /* داخلي */ } }
  return { ok: true };
}
export async function deleteRehearsal(db: any, id: string): Promise<boolean> { const r = await rehById(db, id); if (!r) return false; if (r.room_code) await db.from('portal_rooms').update({ status: 'closed', closed_at: nowIso() }).eq('code', r.room_code); const { error } = await db.from('portal_rehearsals').delete().eq('id', id); return !error; }
/** مصادر الاستمارة: حاجة / محطة / موقف اليوم — للتعبئة المسبقة بعد التحقق */
export async function needText(db: any, id: string): Promise<{ text_ar: string; sector: string } | null> { const n = await safe<any>(db.from('portal_needs').select('text_ar,sector,status').eq('id', id).maybeSingle(), null); return n ? { text_ar: String(n.text_ar), sector: String(n.sector) } : null; }
export async function caseText(db: any, id: string): Promise<{ situation_ar: string; role_ar: string | null; parties_ar: unknown; domain_code: string } | null> { return safe<any>(db.from('portal_daily_cases').select('situation_ar,role_ar,parties_ar,domain_code').eq('id', id).maybeSingle(), null); }
export const notesWindowHours = NOTES_HOURS; export const names = P45_NAMES_AR;
