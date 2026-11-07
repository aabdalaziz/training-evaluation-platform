// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P62 «رسالة إلى نفسي بعد سنة» — طبقة القاعدة (جدول portal_time_capsules نفسه من P25 + أعمدة P62)
 *  myLetters · myPrograms · writeLetter · openLetter (+ مرآة «ما حدث فعلًا») · replyLetter · deleteLetter (فوري + الوسائط)
 *  cohort: cohortFor · writeCohortLine · deleteCohortLine
 *  runSelfLetters (ضمن الكرون اليومي الحالي): إشعار «اليوم تُفتح رسالتك — الساعة HH:MM» داخل أَثَر فقط (قرار المالك: البريد مع (ج))
 *  إصلاح موروث من P25: الوسائط تنتهي بعد 180 يومًا افتراضيًا — هنا نمدّ expires_at إلى ما بعد موعد الفتح (+400 يوم) حتى لا يضيع صوت رسالةٍ مختومة لسنة.
 */
import { loadJourney } from '../journey/load';
import { capsuleSnapshot } from '../journey/registry';
import { CAPSULE_COLS } from '../journey/cron';
import { deliverAt, validateLetter, validateReply, validateCohortLine, toPublicLetter, mirrorOf, cohortEnvelope, cohortOpensAt, letterState, todayNoticeText, LETTER_LIMITS, LETTER_PATH, dayKeyRiyadh } from './self';
import { validateWhy } from '../first/registry'; /* P64 */
import type { LetterRow, LetterPublic, Horizon } from './self';

type Db = any;
export type Me = { id: string; email: string; name?: string };
export const LETTER_COLS = `${CAPSULE_COLS},horizon,opened_at,opened_early,reply_ar,reply_media_id,replied_at,chain_of,prompt_key,context_key,program_id,scope`;
export const SELF_NOTICE_KIND = 'self_letter' as const;
const BUCKET = 'athar-media'; const ENROLLED = ['approved', 'placed', 'active', 'completed'];
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MyProgram = { id: string; name_ar: string; end_date: string | null };
export async function myPrograms(db: Db, me: Me): Promise<MyProgram[]> {
  const en = await safe<any[]>(db.from('portal_enrollments').select('program_id,status').eq('email', lower(me.email)).in('status', ENROLLED).limit(50), []);
  const ids = [...new Set(en.map((e) => String(e.program_id || '')).filter(Boolean))].slice(0, 20); if (!ids.length) return [];
  const ps = await safe<any[]>(db.from('programs').select('id,name_ar,end_date').in('id', ids).limit(20), []);
  return ps.map((p) => ({ id: String(p.id), name_ar: String(p.name_ar || 'برنامج'), end_date: p.end_date ? String(p.end_date).slice(0, 10) : null }));
}
async function rowsOf(db: Db, me: Me): Promise<LetterRow[]> {
  return await safe<LetterRow[]>(db.from('portal_time_capsules').select(LETTER_COLS).eq('user_id', me.id).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(60), []);
}
/** رسائلي (self) — النصّ محجوب حتى الفتح */
export async function myLetters(db: Db, me: Me, now = new Date()): Promise<LetterPublic[]> {
  const rows = await rowsOf(db, me); return rows.filter((r) => (r.scope || 'self') === 'self').map((r) => toPublicLetter(r, now));
}
async function mine(db: Db, me: Me, id: number): Promise<LetterRow | null> {
  if (!(id > 0)) return null; const { data } = await db.from('portal_time_capsules').select(LETTER_COLS).eq('id', id).eq('user_id', me.id).maybeSingle(); return (data as LetterRow) || null;
}
async function ownMedia(db: Db, me: Me, mediaId: string): Promise<{ id: string; path: string } | null> {
  if (!UUID.test(mediaId)) return null; const { data } = await db.from('portal_media').select('id,user_id,path').eq('id', mediaId).maybeSingle(); if (!data || String(data.user_id) !== me.id) return null; return { id: String(data.id), path: String(data.path) };
}
/** الصوت لا يضيع قبل موعده: مدّ صلاحية الوسيط إلى ما بعد الفتح */
async function keepMedia(db: Db, mediaId: string, deliverAtIso: string): Promise<void> {
  try { const until = new Date(new Date(deliverAtIso).getTime() + LETTER_LIMITS.mediaGraceDays * 86400000).toISOString(); await db.from('portal_media').update({ expires_at: until, context_type: 'self_letter' }).eq('id', mediaId); } catch { /* اختياري */ }
}
async function removeMedia(db: Db, me: Me, mediaId: string | null | undefined): Promise<void> {
  if (!mediaId) return; const m = await ownMedia(db, me, mediaId); if (!m) return;
  try { await db.storage.from(BUCKET).remove([m.path]); } catch { /* يتيم نادر */ }
  try { await db.from('portal_learning_events').delete().eq('object_type', 'media').eq('object_id', m.id); await db.from('portal_media').delete().eq('id', m.id); } catch { /* اختياري */ }
}

export type WriteBody = { body_ar?: string; media_id?: string | null; horizon?: Horizon; program_id?: string | null; prompt_key?: string | null; context_key?: string | null; chain_of?: number | null };
export async function writeLetter(db: Db, me: Me, b: WriteBody, now = new Date()): Promise<{ ok: true; letter: LetterPublic; deliver_at: string } | Fail> {
  /* P64: سطر «لماذا جئتُ» (context_key = first_day) — سطر قصير 10–160 بأفق التخرّج؛ لا يُحسب ضمن الرسائل الثلاث */
  const firstDay = String(b.context_key || '') === 'first_day'; if (firstDay && (b.horizon || 'grad') !== 'grad') return fail('سطر أول يوم يُختم إلى يوم التخرّج فقط');
  const v = firstDay ? validateWhy(b) : validateLetter(b); if (v) return fail(v);
  const horizon: Horizon = (b.horizon || '1y') as Horizon;
  const rows = await rowsOf(db, me); const sealed = rows.filter((r) => (r.scope || 'self') === 'self' && !r.opened_at && r.status !== 'cancelled' && String(r.context_key || '') !== 'first_day');
  if (!firstDay && sealed.length >= LETTER_LIMITS.maxSealed) return fail(`لديك ${LETTER_LIMITS.maxSealed} رسائل مختومة — افتح إحداها في موعدها أو احذفها قبل أن تكتب رابعة`, 409);
  let programEnd: string | null = null; let programId: string | null = null;
  if (horizon === 'grad') { const ps = await myPrograms(db, me); const p = ps.find((x) => x.id === String(b.program_id || '')) || ps.filter((x) => x.end_date && String(x.end_date).slice(0, 10) > now.toISOString().slice(0, 10)).sort((a, c) => String(a.end_date).localeCompare(String(c.end_date)))[0]; if (!p) return fail('لست منسوبًا إلى برنامج له تاريخ نهاية — اختر أفقًا آخر'); programEnd = p.end_date; programId = p.id; }
  const d = deliverAt(now, horizon, programEnd); if (!d.ok) return fail(d.error);
  const mediaId = b.media_id ? String(b.media_id) : null; if (mediaId && !(await ownMedia(db, me, mediaId))) return fail('التسجيل غير موجود أو ليس لك');
  let chainOf: number | null = null; if (b.chain_of) { const prev = await mine(db, me, Number(b.chain_of)); if (prev && prev.opened_at) chainOf = Number(prev.id); }
  let snapshot_then: unknown = { chapters: 0, levels: [], last_chapter: null, days: 0 }; try { snapshot_then = capsuleSnapshot(await loadJourney(db, me, now.getTime(), false)); } catch { /* لقطة فارغة */ }
  const row = { user_id: me.id, email: lower(me.email), full_name: me.name || null, body_ar: String(b.body_ar || '').trim(), media_id: mediaId, kind: mediaId ? 'audio' : 'text', deliver_at: d.at.toISOString(), status: 'sealed', snapshot_then, meta: { v: 'p62' },
    horizon, prompt_key: b.prompt_key ? String(b.prompt_key).slice(0, 20) : null, context_key: b.context_key ? String(b.context_key).slice(0, 20) : 'free', chain_of: chainOf, program_id: programId, scope: 'self', opened_early: false, created_at: now.toISOString() };
  const { data, error } = await db.from('portal_time_capsules').insert(row).select(LETTER_COLS).maybeSingle(); if (error || !data) return fail(error?.message || 'تعذّر الختم', 500);
  if (mediaId) await keepMedia(db, mediaId, row.deliver_at);
  try { await db.from('portal_learning_events').insert({ user_id: me.id, email: lower(me.email), verb: 'sealed', object_type: 'time_capsule', object_id: String((data as any).id), skills: [], context: { deliver_at: row.deliver_at, horizon, chain_of: chainOf } }); } catch { /* اختياري */ }
  return { ok: true, letter: toPublicLetter(data as LetterRow, now), deliver_at: row.deliver_at };
}

/** مرآة «ما حدث فعلًا» منذ كتابة الرسالة — أعداد من بيانات صاحبها فقط */
export async function mirrorFor(db: Db, me: Me, l: Pick<LetterRow, 'created_at' | 'id'>, now = new Date()) {
  const from = l.created_at;
  const [j, th, wd, others] = await Promise.all([
    loadJourney(db, me, now.getTime(), false).catch(() => ({ chapters: [] as { kind: string; at: string }[] })),
    safe<any[]>(db.from('portal_map_threads').select('decided_at,status,from_key,to_key').eq('email', lower(me.email)).eq('status', 'kept').gte('decided_at', from).limit(500), []),
    safe<any[]>(db.from('portal_learner_notices').select('created_at').eq('email', lower(me.email)).eq('kind', 'trainer_word').gte('created_at', from).limit(500), []),
    safe<any[]>(db.from('portal_time_capsules').select('id,created_at').eq('user_id', me.id).neq('status', 'cancelled').gte('created_at', from).limit(60), []),
  ]);
  return mirrorOf({ written_at: from, now, chapters: (j.chapters || []).map((c: any) => ({ kind: String(c.kind), at: String(c.at) })), threads: th.map((t) => ({ decided_at: t.decided_at || null, status: String(t.status), from_key: String(t.from_key), to_key: String(t.to_key) })), words: wd.map((w) => ({ created_at: String(w.created_at) })), letters_written: others.filter((o) => Number(o.id) !== Number(l.id)).length });
}
/** فتح الرسالة — في موعدها أو قبله (موسومة) */
export async function openLetter(db: Db, me: Me, id: number, now = new Date()): Promise<{ ok: true; letter: LetterPublic; mirror: Awaited<ReturnType<typeof mirrorFor>>; early: boolean } | Fail> {
  const row = await mine(db, me, id); if (!row || (row.scope || 'self') !== 'self') return fail('الرسالة غير موجودة', 404);
  if (row.opened_at) { const mirror = await mirrorFor(db, me, row, now); return { ok: true, letter: toPublicLetter(row, now), mirror, early: !!row.opened_early }; }
  const early = letterState(row, now).state !== 'ready';
  let snapshot_now: unknown = null; try { snapshot_now = capsuleSnapshot(await loadJourney(db, me, now.getTime(), false)); } catch { /* اختياري */ }
  const patch: Record<string, unknown> = { opened_at: now.toISOString(), opened_early: early, status: 'delivered', delivered_at: row.delivered_at || now.toISOString(), snapshot_now: row.snapshot_now ?? snapshot_now };
  const { error } = await db.from('portal_time_capsules').update(patch).eq('id', row.id).eq('user_id', me.id); if (error) return fail('تعذّر الفتح', 500);
  try { await db.from('portal_learning_events').insert({ user_id: me.id, email: lower(me.email), verb: early ? 'opened_early' : 'opened', object_type: 'time_capsule', object_id: String(row.id), skills: [], context: { deliver_at: row.deliver_at } }); } catch { /* اختياري */ }
  const opened = { ...row, ...patch } as LetterRow; const mirror = await mirrorFor(db, me, opened, now);
  return { ok: true, letter: toPublicLetter(opened, now), mirror, early };
}
export async function replyLetter(db: Db, me: Me, id: number, b: { reply_ar?: string; media_id?: string | null }, now = new Date()): Promise<{ ok: true; letter: LetterPublic } | Fail> {
  const v = validateReply(b); if (v) return fail(v);
  const row = await mine(db, me, id); if (!row || !row.opened_at) return fail('افتح الرسالة أولًا', 404);
  const mediaId = b.media_id ? String(b.media_id) : null; if (mediaId && !(await ownMedia(db, me, mediaId))) return fail('التسجيل غير موجود أو ليس لك');
  const patch = { reply_ar: String(b.reply_ar || '').trim() || null, reply_media_id: mediaId, replied_at: now.toISOString() };
  const { error } = await db.from('portal_time_capsules').update(patch).eq('id', row.id).eq('user_id', me.id); if (error) return fail('تعذّر حفظ الردّ', 500);
  if (mediaId) await keepMedia(db, mediaId, new Date(now.getTime() + 365 * 86400000).toISOString());
  if (row.reply_media_id && row.reply_media_id !== mediaId) await removeMedia(db, me, row.reply_media_id);
  return { ok: true, letter: toPublicLetter({ ...row, ...patch } as LetterRow, now) };
}
/** حذف فوري — الصفّ والنصّ والصوت والردّ؛ لا سلّة */
export async function deleteLetter(db: Db, me: Me, id: number): Promise<{ ok: true } | Fail> {
  const row = await mine(db, me, id); if (!row) return fail('الرسالة غير موجودة', 404);
  const { error } = await db.from('portal_time_capsules').delete().eq('id', row.id).eq('user_id', me.id); if (error) return fail('تعذّر الحذف', 500);
  await removeMedia(db, me, row.media_id); await removeMedia(db, me, row.reply_media_id);
  try { await db.from('portal_time_capsules').update({ chain_of: null }).eq('user_id', me.id).eq('chain_of', row.id); } catch { /* اختياري */ }
  return { ok: true };
}

// ——— «رسالة الدفعة» ———
export type CohortView = { program_id: string; program_ar: string; end_date: string; opens_ar: string; days_left: number; n: number; ready: boolean; below_k: boolean; my_line: string | null; my_id: number | null; can_write: boolean; lines: string[] };
export async function cohortFor(db: Db, me: Me, now = new Date()): Promise<CohortView[]> {
  const ps = (await myPrograms(db, me)).filter((p) => p.end_date); if (!ps.length) return [];
  const out: CohortView[] = [];
  for (const p of ps.slice(0, 6)) {
    const opens = cohortOpensAt(p.end_date as string); if (Number.isNaN(opens.getTime())) continue;
    const rows = await safe<any[]>(db.from('portal_time_capsules').select('id,user_id,body_ar,created_at').eq('scope', 'cohort').eq('program_id', p.id).neq('status', 'cancelled').limit(1000), []);
    const mineRow = rows.find((r) => String(r.user_id) === me.id) || null;
    const env = cohortEnvelope(rows.map((r) => ({ body_ar: String(r.body_ar || ''), created_at: String(r.created_at || '') })), opens, now);
    out.push({ program_id: p.id, program_ar: p.name_ar, end_date: p.end_date as string, opens_ar: env.opens_ar, days_left: env.days_left, n: env.n, ready: env.ready, below_k: env.below_k, my_line: mineRow ? String(mineRow.body_ar) : null, my_id: mineRow ? Number(mineRow.id) : null, can_write: !mineRow && now.getTime() < opens.getTime(), lines: env.lines });
  }
  return out;
}
export async function writeCohortLine(db: Db, me: Me, programId: string, body: string, now = new Date()): Promise<{ ok: true; id: number } | Fail> {
  const v = validateCohortLine(body); if (v) return fail(v);
  const p = (await myPrograms(db, me)).find((x) => x.id === String(programId) && x.end_date); if (!p) return fail('لست منسوبًا إلى هذا البرنامج', 404);
  const opens = cohortOpensAt(p.end_date as string); if (now.getTime() >= opens.getTime()) return fail('ظرف الدفعة فُتح — لم يعد يقبل أسطرًا جديدة', 409);
  const { data: dup } = await db.from('portal_time_capsules').select('id').eq('user_id', me.id).eq('scope', 'cohort').eq('program_id', p.id).neq('status', 'cancelled').limit(1); if (arr(dup).length) return fail('سطرك في ظرف الدفعة موجود — احذفه إن أردت تغييره', 409);
  const row = { user_id: me.id, email: lower(me.email), full_name: null, body_ar: String(body).trim(), media_id: null, kind: 'text', deliver_at: opens.toISOString(), status: 'sealed', snapshot_then: { chapters: 0, levels: [], last_chapter: null, days: 0 }, meta: { v: 'p62' }, horizon: '1y', scope: 'cohort', program_id: p.id, context_key: 'cohort', opened_early: false, created_at: now.toISOString() };
  const { data, error } = await db.from('portal_time_capsules').insert(row).select('id').maybeSingle(); if (error || !data) return fail(error?.message || 'تعذّر الختم', 500);
  return { ok: true, id: Number((data as any).id) };
}
export async function deleteCohortLine(db: Db, me: Me, id: number): Promise<{ ok: true } | Fail> {
  const row = await mine(db, me, id); if (!row || row.scope !== 'cohort') return fail('السطر غير موجود', 404);
  const { error } = await db.from('portal_time_capsules').delete().eq('id', row.id).eq('user_id', me.id); if (error) return fail('تعذّر الحذف', 500); return { ok: true };
}

/** الكرون اليومي: إشعار «اليوم تُفتح رسالتك» لرسائل اليوم (بتوقيت الرياض) غير المفتوحة — داخل أَثَر فقط، مرّة واحدة (dedupe) */
export async function runSelfLetters(db: Db, opts: { now?: Date; dry?: boolean } = {}): Promise<{ scanned: number; sent: number; errors: string[] }> {
  const now = opts.now || new Date(); const s = { scanned: 0, sent: 0, errors: [] as string[] };
  try {
    const from = new Date(now.getTime() - 36 * 3600000).toISOString(); const to = new Date(now.getTime() + 36 * 3600000).toISOString();
    const rows = await safe<LetterRow[]>(db.from('portal_time_capsules').select('id,user_id,email,created_at,deliver_at,opened_at,scope,status').gte('deliver_at', from).lte('deliver_at', to).is('opened_at', null).neq('status', 'cancelled').limit(500), []);
    const today = dayKeyRiyadh(now); const { pushNotice } = await import('../portal/notices');
    for (const r of rows) {
      if ((r.scope || 'self') !== 'self' || dayKeyRiyadh(new Date(r.deliver_at)) !== today) continue; s.scanned++;
      try { const t = todayNoticeText(r); const res = await pushNotice(db, { email: lower(r.email), user_id: r.user_id || null, report_id: null, kind: SELF_NOTICE_KIND, ...t, url: `${LETTER_PATH}#letter-${r.id}`, ref_id: String(r.id), dedupe_key: `${SELF_NOTICE_KIND}:${r.id}`, push: true }, { dry: !!opts.dry, now }); if (res.inserted) s.sent++; }
      catch (e: any) { s.errors.push(`letter ${r.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { s.errors.push(String(e?.message || e)); }
  return s;
}
