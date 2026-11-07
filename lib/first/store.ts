// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P64 «أول يوم — قال من سبقك» — طبقة القاعدة (صفر جداول جديدة؛ تقرأ P63 وP38 وP51 وتكتب عبر محرّك P62 فقط)
 *  firstPrograms   برامجي التي بدأت (من start_date حتى end_date) مع الطور · loadFirstPage الصفحة كاملة
 *  predecessorLines «قال من سبقك»: portal_grad_pages (مختومة · غير مُبطلة · live_public) لهذا البرنامج ولكل برنامج يحمل اسمه نفسه (دفعات سابقة بمعرّف آخر)
 *                   — السطر من جسم الختم (ثابت) · أشخاص مختلفون ≥ 5 · خلط يومي ثابت · ≤ 7 · لا أسماء
 *  writeWhy        «لماذا جئتُ» → writeLetter (P62) بأفق التخرّج وسياق first_day — لا تُحسب ضمن الرسائل الثلاث · واحدة لكل برنامج
 *  runFirstDays    (ضمن الكرون اليومي القائم): 🌅 «اليوم يومك الأول» للمتدرّب يوم start_date (يُدفع) · «اكتب كلمة الاستقبال» للمدرّب قبلها بيوم (داخل أَثَر)
 *                  · «سطرك ينتظر N متدرّبًا» لخرّيجٍ أظهر سطره حين تبدأ دفعة جديدة من خمسة فأكثر (داخل أَثَر) — لا رجعية؛ dedupe لكل شيء
 */
import { writeLetter, LETTER_COLS } from '../letters/store';
import { letterState, dayKeyRiyadh, fmtDayAr as fmtIsoAr, openHourAr } from '../letters/self';
import { programAfterOf } from '../after/load';
import { atharWelcome, pickLines, firstPhase, firstOpen, canWriteWhy, windowUntil, validateWhy, matesLineAr, whyCountLineAr, firstDayNotice, welcomeAskNotice, lineAwaitsNotice, addDaysKey, FIRST_LIMITS, FIRST_PATH, WHY_CONTEXT, WHY_PROMPT_KEY, ROAD, P64_NAMES_AR } from './registry';
import type { AtharWord, FirstPhase, GradLine, RoadStep } from './registry';

type Db = any;
export type Me = { id: string; email: string; name?: string };
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const ENROLLED = ['approved', 'placed', 'active', 'completed'];

export type FirstProgram = { id: string; name_ar: string; start_date: string; end_date: string | null; enrollment_id: string; classroom_id: string | null; phase: FirstPhase; full_name?: string | null };
export type FirstView = {
  program: FirstProgram; today: string; window_until: string; can_write: boolean;
  athar: AtharWord;
  said: { shown: boolean; n: number; lines: string[]; head_ar: string | null; below_ar: string | null };
  after: { line_ar: string | null; excerpts: { text_ar: string; station: number }[] };
  welcome: { text_ar: string; at: string; trainer_ar: string | null; voice_sec: number | null } | null;
  why: { id: number; state: 'sealed' | 'today' | 'ready' | 'opened'; opens_ar: string; open_hour_ar: string; body_ar: string | null; written_at: string } | null;
  mates_ar: string | null; why_count_ar: string | null; trainer_ar: string | null; road: RoadStep[];
};

/* ───────── برامجي التي بدأت ───────── */
export async function firstPrograms(db: Db, me: Me, now = new Date()): Promise<FirstProgram[]> {
  const today = dayKeyRiyadh(now);
  const en = await safe<any[]>(db.from('portal_enrollments').select('id,program_id,classroom_id,status,created_at,full_name').eq('email', lower(me.email)).in('status', ENROLLED).limit(50), []);
  const ids = [...new Set(en.map((e) => String(e.program_id || '')).filter(Boolean))].slice(0, 30); if (!ids.length) return [];
  const ps = await safe<any[]>(db.from('programs').select('id,name_ar,start_date,end_date').in('id', ids).limit(30), []);
  const out: FirstProgram[] = [];
  for (const p of ps) { const s = p.start_date ? String(p.start_date).slice(0, 10) : ''; const e = p.end_date ? String(p.end_date).slice(0, 10) : null; if (!firstOpen(s, e, today)) continue;
    const my = en.filter((x) => String(x.program_id) === String(p.id)).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
    out.push({ id: String(p.id), name_ar: String(p.name_ar || 'برنامج'), start_date: s, end_date: e, enrollment_id: String(my?.id || ''), classroom_id: my?.classroom_id ? String(my.classroom_id) : null, phase: firstPhase(s, today), full_name: my?.full_name ? String(my.full_name) : null }); }
  const order: Record<FirstPhase, number> = { first: 0, week: 1, later: 2, before: 3 };
  return out.sort((a, b) => order[a.phase] - order[b.phase] || String(b.start_date).localeCompare(String(a.start_date)));
}

/* ───────── «قال من سبقك» ───────── */
async function lineageIds(db: Db, programId: string, nameAr: string | null): Promise<string[]> {
  const ids = new Set<string>([programId]);
  if (nameAr) { const same = await safe<any[]>(db.from('programs').select('id').eq('name_ar', nameAr).limit(20), []); for (const p of same) ids.add(String(p.id)); }
  return [...ids].slice(0, 20);
}
export async function predecessorLines(db: Db, programId: string, nameAr: string | null, now = new Date()): Promise<{ shown: boolean; n: number; lines: string[] }> {
  const ids = await lineageIds(db, programId, nameAr);
  const rows = await safe<any[]>(db.from('portal_grad_pages').select('user_id,program_id,body,sealed_at,revoked_at,live_public').in('program_id', ids).eq('live_public', true).not('sealed_at', 'is', null).is('revoked_at', null).limit(2000), []);
  const lines: GradLine[] = rows.map((r) => ({ user_id: String(r.user_id || ''), line_ar: String(r.body?.line_ar || ''), sealed_at: r.sealed_at ? String(r.sealed_at) : null }));
  return pickLines(lines, `${programId}:${dayKeyRiyadh(now)}`);
}

/* ───────── الصفحة ───────── */
async function roomsOf(db: Db, programId: string): Promise<{ id: string; code: string; trainer_id: string | null }[]> {
  return (await safe<any[]>(db.from('classrooms').select('id,code,trainer_id').eq('program_id', programId).limit(50), [])).map((r) => ({ id: String(r.id), code: String(r.code || ''), trainer_id: r.trainer_id ? String(r.trainer_id) : null }));
}
async function welcomeOf(db: Db, me: Me, roomIds: Set<string>): Promise<FirstView['welcome']> {
  try { const { data: n } = await db.from('portal_learner_notices').select('body_ar,title_ar,created_at,ref_id,meta').eq('email', lower(me.email)).eq('kind', 'trainer_word').order('created_at', { ascending: false }).limit(60);
    const f = arr<any>(n).find((x) => x.meta && (x.meta as any).welcome && (!x.ref_id || roomIds.has(String(x.ref_id)))); if (!f) return null;
    return { text_ar: String(f.body_ar || ''), at: String(f.created_at), voice_sec: f.meta?.voice?.sec ? Number(f.meta.voice.sec) : null, trainer_ar: String(f.title_ar || '').replace(/^🌅\s*/, '').replace(/^كلمة الاستقبال من مدرّبك\s*/, '').trim() || null };
  } catch { return null; }
}
async function whyOf(db: Db, me: Me, programId: string, now: Date): Promise<FirstView['why']> {
  const rows = await safe<any[]>(db.from('portal_time_capsules').select(LETTER_COLS).eq('user_id', me.id).eq('program_id', programId).eq('context_key', WHY_CONTEXT).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(3), []);
  const l = rows[0]; if (!l) return null; const st = letterState(l, now);
  return { id: Number(l.id), state: st.state, opens_ar: fmtIsoAr(l.deliver_at), open_hour_ar: openHourAr(l.deliver_at), body_ar: st.state === 'opened' ? String(l.body_ar || '') : null, written_at: String(l.created_at) };
}
async function matesOf(db: Db, p: FirstProgram): Promise<{ mates: number; whys: number }> {
  if (!p.classroom_id) return { mates: 0, whys: 0 };
  const en = await safe<any[]>(db.from('portal_enrollments').select('id,user_id,email').eq('classroom_id', p.classroom_id).in('status', ENROLLED).limit(500), []);
  const emails = new Set(en.map((e) => lower(e.email)).filter(Boolean)); const uids = [...new Set(en.map((e) => String(e.user_id || '')).filter(Boolean))].slice(0, 200);
  let whys = 0; if (uids.length) { const caps = await safe<any[]>(db.from('portal_time_capsules').select('user_id').eq('program_id', p.id).eq('context_key', WHY_CONTEXT).neq('status', 'cancelled').in('user_id', uids).limit(500), []); whys = new Set(caps.map((c) => String(c.user_id))).size; }
  return { mates: emails.size, whys };
}
export async function loadFirstPage(db: Db, me: Me, programId: string | null, now = new Date()): Promise<{ programs: FirstProgram[]; view: FirstView | null }> {
  const programs = await firstPrograms(db, me, now); const p = (programId ? programs.find((x) => x.id === programId) : programs[0]) || null;
  if (!p) return { programs, view: null };
  const today = dayKeyRiyadh(now); const rooms = await roomsOf(db, p.id); const myRoom = rooms.find((r) => r.id === p.classroom_id) || null; const roomIds = new Set(rooms.map((r) => r.id));
  const [said, after, welcome, why, mates] = await Promise.all([predecessorLines(db, p.id, p.name_ar, now), safe<any>(programAfterOf(db, p.id, now).then((a) => ({ data: a, error: null })), null), welcomeOf(db, me, roomIds), whyOf(db, me, p.id, now), matesOf(db, p)]);
  let trainer_ar: string | null = null; if (myRoom?.trainer_id) { const t = await safe<any>(db.from('trainers').select('name').eq('id', myRoom.trainer_id).maybeSingle(), null); trainer_ar = t?.name ? String(t.name) : null; }
  const firstName = (me.name || p.full_name || '').trim().split(/\s+/)[0] || null; /* الاسم الأول: من الجلسة أو من طلب التسجيل */
  return { programs, view: {
    program: p, today, window_until: windowUntil(p.start_date), can_write: canWriteWhy(p.phase) && !why,
    athar: atharWelcome(firstName, p.name_ar),
    said: { ...said, head_ar: said.shown ? `من ${said.n} خرّيجًا كتبوا سطرهم يوم تخرّجهم — بلا أسماء` : null, below_ar: said.shown ? null : (said.n === 0 ? 'أنت من أوائل من يبدأ هنا — سطرك يوم تخرّجك سيكون أول ما يقرؤه من يأتي بعدك.' : `كتب ${said.n} من خرّيجي هذا البرنامج سطرهم؛ تظهر السطور حين يبلغون خمسة — بلا أسماء.`) },
    after: { line_ar: after?.shown ? String(after.line_ar || '') || null : null, excerpts: arr<any>(after?.excerpts).slice(0, FIRST_LIMITS.afterMax).map((x) => ({ text_ar: String(x.text_ar || x.excerpt_ar || ''), station: Number(x.station || 0) })).filter((x) => x.text_ar) },
    welcome, why, mates_ar: matesLineAr(mates.mates), why_count_ar: whyCountLineAr(mates.whys), trainer_ar, road: ROAD,
  } };
}

/* ───────── «لماذا جئتُ» ───────── */
export async function writeWhy(db: Db, me: Me, programId: string, b: { body_ar?: unknown }, now = new Date()): Promise<{ ok: true; id: number; deliver_at: string } | Fail> {
  const v = validateWhy(b); if (v) return fail(v);
  const programs = await firstPrograms(db, me, now); const p = programs.find((x) => x.id === programId); if (!p) return fail('هذا البرنامج لم يبدأ لك بعد — أو ليس من برامجك', 403);
  if (!canWriteWhy(p.phase)) return fail(`باب «${P64_NAMES_AR.why}» يُفتح في الأسبوع الأول من البرنامج فقط (حتى ${windowUntil(p.start_date)})`, 409);
  if (!p.end_date) return fail('برنامجك بلا تاريخ نهاية — لا يمكن ختم السطر إلى يوم التخرّج', 409);
  if (await whyOf(db, me, p.id, now)) return fail('كتبتَ سطرك لهذا البرنامج — يُفتح يوم تخرّجك', 409);
  const r = await writeLetter(db, me, { body_ar: String(b.body_ar || '').trim(), horizon: 'grad', program_id: p.id, prompt_key: WHY_PROMPT_KEY, context_key: WHY_CONTEXT }, now);
  if (!r.ok) return r;
  return { ok: true, id: r.letter.id, deliver_at: r.deliver_at };
}

/* ───────── الكرون اليومي ───────── */
export async function runFirstDays(db: Db, opts: { now?: Date; dry?: boolean; site?: string } = {}): Promise<{ learners: number; trainers: number; graduates: number; errors: string[] }> {
  const now = opts.now || new Date(); const today = dayKeyRiyadh(now); const s = { learners: 0, trainers: 0, graduates: 0, errors: [] as string[] };
  const { pushNotice } = await import('../portal/notices');
  try { /* 1) اليوم الأول — لمن يبدأ برنامجه اليوم فقط (لا إشعارات رجعية؛ الصفحة نفسها تُفتح لكل من بدأ) */
    const ps = await safe<any[]>(db.from('programs').select('id,name_ar,start_date').eq('start_date', today).limit(50), []);
    for (const p of ps) { const en = await safe<any[]>(db.from('portal_enrollments').select('id,email,user_id').eq('program_id', p.id).in('status', ENROLLED).limit(500), []); const seen = new Set<string>();
      for (const e of en) { const email = lower(e.email); if (!email || seen.has(email)) continue; seen.add(email); const t = firstDayNotice(String(p.name_ar || 'برنامجك'));
        const r = await pushNotice(db, { email, user_id: e.user_id || null, report_id: null, kind: 'first_day' as any, ...t, url: `${FIRST_PATH}?program=${encodeURIComponent(String(p.id))}`, ref_id: String(p.id), dedupe_key: `first_day:${e.id}`, push: true }, { dry: !!opts.dry, site: opts.site, now }); if (r.inserted) s.learners += 1; }
      /* 3) «سطرك ينتظر N» — لخرّيجٍ أظهر سطره (الوجه العام) حين تبدأ دفعة من خمسة فأكثر وتُعرض السطور (≥ 5 أشخاص) */
      const n = seen.size; if (n < FIRST_LIMITS.k) continue;
      const said = await predecessorLines(db, String(p.id), String(p.name_ar || '') || null, now); if (!said.shown) continue;
      const ids = await lineageIds(db, String(p.id), String(p.name_ar || '') || null);
      const gp = await safe<any[]>(db.from('portal_grad_pages').select('id,email,user_id').in('program_id', ids).eq('live_public', true).not('sealed_at', 'is', null).is('revoked_at', null).limit(2000), []); const seenG = new Set<string>();
      for (const g of gp) { const email = lower(g.email); if (!email || seen.has(email) || seenG.has(email)) continue; seenG.add(email); const t = lineAwaitsNotice(String(p.name_ar || 'البرنامج'), n);
        const r = await pushNotice(db, { email, user_id: g.user_id || null, report_id: null, kind: 'line_awaits' as any, ...t, url: `/me/grad`, ref_id: String(p.id), dedupe_key: `line_awaits:${g.id}:${today}`, push: false }, { dry: !!opts.dry, site: opts.site, now }); if (r.inserted) s.graduates += 1; } }
  } catch (e: any) { s.errors.push(e?.message || String(e)); }
  try { /* 2) «اكتب كلمة الاستقبال» — للمدرّب قبل البداية بيوم (اختيارية؛ الصفحة تعمل بدونها) */
    const day = addDaysKey(today, FIRST_LIMITS.welcomeBeforeDays); const ps = await safe<any[]>(db.from('programs').select('id,name_ar,start_date').eq('start_date', day).limit(50), []);
    for (const p of ps) { const rooms = await safe<any[]>(db.from('classrooms').select('id,code,trainer_id').eq('program_id', p.id).not('trainer_id', 'is', null).limit(50), []); if (!rooms.length) continue;
      const trs = await safe<any[]>(db.from('trainers').select('id,email').in('id', [...new Set(rooms.map((r) => String(r.trainer_id)))]).limit(50), []);
      for (const room of rooms) { const t = trs.find((x) => String(x.id) === String(room.trainer_id)); const email = lower(t?.email); if (!email) continue; const n = welcomeAskNotice(String(p.name_ar || 'البرنامج'), String(room.code || ''), String(p.start_date));
        const r = await pushNotice(db, { email, user_id: null, report_id: null, kind: 'welcome_word' as any, ...n, url: `/me/day?welcome=${encodeURIComponent(String(room.id))}`, ref_id: String(room.id), dedupe_key: `welcome_word:${room.id}`, push: false }, { dry: !!opts.dry, site: opts.site, now }); if (r.inserted) s.trainers += 1; } }
  } catch (e: any) { s.errors.push(e?.message || String(e)); }
  return s;
}
