// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P71 «يوم دخلتُ» — الاسم الرسمي: «سطر الدخول — بكلمات المتعلّم يوم التسكين» / Entry Line — In the Learner's Own Words on Placement Day
 *  - بعد إرسال اختبار التسكين وقبل النتيجة: سطر واحد بلغة المتعلّم أيّها كانت («لماذا تتعلّم العربية؟») نصًّا ≤ 200 حرف أو صوتًا ≤ 20 ث — ويُتجاوز بزرّ واحد.
 *  - ليس جزءًا من الاختبار: لا يراه المصحّح · لا يدخل placement_reports.report ولا أي قرار تسكين · يُحفظ في portal_entry_lines مربوطًا بالبريد ثم بالحساب.
 *  - يعود إلى صاحبه: «أول يوم» (P64 · قلتَ يوم دخلتَ) · صفحة المستوى الأول (P70 · entry_line) · يوم تخرّجه (P63 · entry) — وللأستاذ «قالوا يوم دخلوا» (k ≥ 5 · بلا أسماء · نصوص فقط).
 *  - الصوت يبقى مع صاحبه (athar-media/entry-voice · رابط موقَّع 300 ث) · لا تفريغ على الخادم · حذف فوري بطلب صاحبه.
 *  الجزء الصرف: ENTRY_LIMITS · ENTRY_NAMES · validateEntryText · validateEntryVoice · entryVoicePath · entryPromptFor · entryEchoLine — الغراء: saveEntry · entryOfEmail · entryVoiceUrl · deleteEntry · sectionEntry
 */
import { randomUUID } from 'crypto';
import { ENTRY_LIMITS, ENTRY_COLS, validateEntryText, validateEntryVoice, voiceOfEntry, entryView, entryEchoLine } from './entry-pure';
import { parseQualityMeta } from '../portal/audio-meter';
import { stripDataUrl } from '../portal/media'; /* P72-أ: رقمان من جهاز المتعلّم (اختياري) */
import type { EntryRow, EntryView, EntryVoice } from './entry-pure';
import { whyOf, type WhyView, type EntryLite } from './why'; /* P75 «لماذا جاؤوا» */
import { membersWithFlag } from '../org/policy';

type Db = any;
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const lower = (s: unknown) => String(s || '').trim().toLowerCase();

export * from './entry-pure';
export const entryVoicePath = (sessionId: string, ext: string) => `${ENTRY_LIMITS.prefix}/${sessionId}/${randomUUID()}.${ext}`;

/* ───────── الغراء ───────── */
export type EntrySession = { id: string; candidate?: { email?: string | null } | null; user_id?: string | null; invite_id?: string | null };
/** حفظ/تبديل سطر الدخول لجلسة التسكين الحالية (بعد الإرسال) — نصّ و/أو صوت base64؛ صفّ واحد لكل جلسة */
export async function saveEntry(db: Db, s: EntrySession, b: { text?: unknown; lang?: unknown; audio?: unknown; mime?: unknown; sec?: unknown; quality?: unknown /* P72-أ */; public_ok?: unknown /* P75 */ }, now = new Date()): Promise<{ ok: true; entry: EntryView } | Fail> {
  const email = lower(s.candidate?.email); if (!email || !email.includes('@')) return fail('no_email', 400);
  let text: string | null = null; if (b.text !== undefined && b.text !== null && String(b.text).trim()) { const v = validateEntryText(b.text); if (!v.ok) return fail(v.error, 400); text = v.text; }
  let voice: EntryVoice | null = null;
  const b64 = stripDataUrl(b.audio); /* P72-أ: كان النمط القديم يُسقط `;codecs=opus` */
  if (b64) {
    if (b64.length > ENTRY_LIMITS.voiceBytes * 1.4) return fail('too_big', 413);
    let buf: Buffer; try { buf = Buffer.from(b64, 'base64'); } catch { return fail('bad_voice', 400); }
    const chk = validateEntryVoice({ mime: String(b.mime || ''), bytes: buf.length, sec: Number(b.sec || 0) }); if (!chk.ok) return fail(chk.error, 400);
    const path = entryVoicePath(s.id, chk.ext);
    const up = await db.storage.from(ENTRY_LIMITS.bucket).upload(path, buf, { contentType: chk.mime, upsert: false }); if (up?.error) return fail('audio_upload_failed', 500);
    const quality = parseQualityMeta(b.quality); voice = { path, sec: chk.sec, bytes: buf.length, mime: chk.mime, at: now.toISOString(), ...(quality ? { quality } : {}) };
  }
  if (!text && !voice) return fail('empty', 400);
  const rep = await safe<any>(db.from('placement_reports').select('id,report').eq('submission_id', s.id).maybeSingle(), null);
  const lang = b.lang === 'en' ? 'en' : 'ar';
  const prev = await safe<any>(db.from('portal_entry_lines').select(ENTRY_COLS).eq('session_id', s.id).maybeSingle(), null);
  /* ما أُرسل يحلّ محلّ نظيره فقط: نصّ جديد يبقي الصوت السابق، وصوت جديد يبقي النصّ السابق */
  const row = { email, session_id: s.id, report_id: rep?.id ? String(rep.id) : null, user_id: s.user_id || null, invite_id: s.invite_id || null, lang, body_text: text ?? (prev?.body_text || null), voice: voice || voiceOfEntry(prev?.voice) || {}, updated_at: now.toISOString(), ...(b.public_ok !== undefined ? { public_ok: b.public_ok === true || b.public_ok === 'true' } : {}) /* P75: الإذن صريح من الخانة؛ غيابه لا يغيّر شيئًا */ };
  if (prev && voice && voiceOfEntry(prev.voice)) { try { await db.storage.from(ENTRY_LIMITS.bucket).remove([voiceOfEntry(prev.voice)!.path]); } catch { /* الاحتفاظ ينظّف */ } }
  const { data, error } = prev
    ? await db.from('portal_entry_lines').update(row).eq('id', prev.id).select(ENTRY_COLS).single()
    : await db.from('portal_entry_lines').insert({ ...row, created_at: now.toISOString() }).select(ENTRY_COLS).single();
  if (error || !data) return fail(error?.message || 'db', 500);
  return { ok: true, entry: entryView(data as EntryRow) };
}
/** سطر صاحبه بالبريد (أو بالحساب) — الأحدث */
export async function entryOfEmail(db: Db, email: string, userId?: string | null): Promise<EntryRow | null> {
  const em = lower(email); if (!em) return null;
  const rows = await safe<any[]>(db.from('portal_entry_lines').select(ENTRY_COLS).eq('email', em).order('created_at', { ascending: false }).limit(3), []);
  const r = rows[0] || null; if (r && userId && !r.user_id) { try { await db.from('portal_entry_lines').update({ user_id: userId }).eq('id', r.id); } catch { /* الربط اختياري */ } }
  return r;
}
export async function entryVoiceUrl(db: Db, email: string): Promise<{ ok: true; url: string; sec: number } | Fail> {
  const r = await entryOfEmail(db, email); const v = r ? voiceOfEntry(r.voice) : null; if (!v) return fail('لا تسجيل', 404);
  const { data, error } = await db.storage.from(ENTRY_LIMITS.bucket).createSignedUrl(v.path, ENTRY_LIMITS.signedSeconds); if (error || !data?.signedUrl) return fail('تعذّر فتح التسجيل', 500);
  return { ok: true, url: String(data.signedUrl), sec: v.sec };
}
/** حذف فوري بطلب صاحبه (نصًّا وصوتًا) */
export async function deleteEntry(db: Db, email: string): Promise<{ ok: true; had: boolean }> {
  const r = await entryOfEmail(db, email); if (!r) return { ok: true, had: false };
  const v = voiceOfEntry(r.voice); if (v) { try { await db.storage.from(ENTRY_LIMITS.bucket).remove([v.path]); } catch { /* الاحتفاظ ينظّف */ } }
  await db.from('portal_entry_lines').delete().eq('id', r.id); return { ok: true, had: true };
}
/** للأستاذ: سطور الدخول لشعبته (بأبرِدة قيود التسجيل) — نصوص فقط · k ≥ 5 · بلا أسماء (P75: + معرّف وعلم الإذن كي يخفي عن الرئيسة) */
export async function sectionEntry(db: Db, emails: string[], roster: number, seed: string): Promise<{ shown: boolean; n: number; head_ar: string | null; lines: string[]; items: Array<{ id: number; text: string; public_ok: boolean }> }> {
  const ems = [...new Set(emails.map(lower).filter(Boolean))].slice(0, 200); if (ems.length < ENTRY_LIMITS.k) return { shown: false, n: 0, head_ar: null, lines: [], items: [] };
  const rows = await safe<any[]>(db.from('portal_entry_lines').select('id,email,body_text,public_ok').in('email', ems).not('body_text', 'is', null).order('created_at', { ascending: false }).limit(500), []);
  const byEmail = new Map<string, { id: number; text: string; public_ok: boolean }>(); for (const r of rows) if (r.body_text && !byEmail.has(lower(r.email))) byEmail.set(lower(r.email), { id: Number(r.id), text: String(r.body_text), public_ok: r.public_ok === true });
  return entryEchoLine([...byEmail.values()], roster, seed);
}

/* ───────── P75 «لماذا جاؤوا» ───────── */
/** صاحب السطر يأذن أو يسحب إذنه (من «أول يوم» أو صفحة المستوى) — نصّ فقط؛ لا إذن لسطر بلا نصّ */
export async function setEntryPublic(db: Db, email: string, pub: boolean, userId?: string | null): Promise<{ ok: true; public_ok: boolean; had: boolean } | Fail> {
  const r = await entryOfEmail(db, email, userId); if (!r) return { ok: true, public_ok: false, had: false }; if (pub && !r.body_text) return fail('لا نصّ ليظهر — الصوت لا يسافر', 409);
  const { error } = await db.from('portal_entry_lines').update({ public_ok: !!pub, updated_at: new Date().toISOString() }).eq('id', r.id); if (error) return fail('تعذّر الحفظ', 500); invalidateWhyCache(); return { ok: true, public_ok: !!pub, had: true };
}
/** الأستاذ يخفي سطرًا من شعبته عن الرئيسة (لا يحذفه ولا يرى صاحبه) — يتحقّق أن صاحبه من قيود شعبته */
export async function hideEntryPublic(db: Db, entryId: number, rosterEmails: string[]): Promise<{ ok: true; hidden: boolean } | Fail> {
  const r = await safe<any>(db.from('portal_entry_lines').select('id,email,public_ok').eq('id', entryId).maybeSingle(), null); if (!r) return fail('لا سطر بهذا الرقم', 404);
  if (!rosterEmails.map(lower).includes(lower(r.email))) return fail('هذا السطر ليس من شعبتك', 403);
  if (r.public_ok !== true) return { ok: true, hidden: false };
  const { error } = await db.from('portal_entry_lines').update({ public_ok: false, updated_at: new Date().toISOString() }).eq('id', r.id); if (error) return fail('تعذّر الإخفاء', 500); invalidateWhyCache(); return { ok: true, hidden: true };
}
let whyCache: { at: number; view: WhyView } | null = null;
export const invalidateWhyCache = () => { whyCache = null; };
const WHY_ENROLLED = ['approved', 'placed', 'active', 'completed'];
/** خيط الرئيسة: المأذون فقط → مسكَّنون في شعبة → المرشّح → العتبتان (ذاكرة 10 دقائق في العملية) */
export async function whyThread(db: Db, now = new Date()): Promise<WhyView> {
  if (whyCache && now.getTime() - whyCache.at < 600000) return whyCache.view;
  const from = new Date(now.getTime() - 365 * 86400000).toISOString();
  const rows = await safe<any[]>(db.from('portal_entry_lines').select('id,email,body_text,created_at,public_ok').eq('public_ok', true).not('body_text', 'is', null).gte('created_at', from).order('created_at', { ascending: false }).limit(1000), []);
  const emails = [...new Set(rows.map((r) => lower(r.email)).filter(Boolean))]; const roomOf = new Map<string, string>(); const orgOfRoom = new Map<string, string | null>();
  for (let i = 0; i < emails.length; i += 100) {
    const en = await safe<any[]>(db.from('portal_enrollments').select('email,classroom_id').in('email', emails.slice(i, i + 100)).in('status', WHY_ENROLLED).not('classroom_id', 'is', null).limit(1000), []);
    for (const e of en) if (e.classroom_id && !roomOf.has(lower(e.email))) roomOf.set(lower(e.email), String(e.classroom_id));
  }
  const cids = [...new Set(roomOf.values())]; if (cids.length) { const cls = await safe<any[]>(db.from('classrooms').select('id,organization_id').in('id', cids).limit(500), []); for (const c of cls) orgOfRoom.set(String(c.id), c.organization_id ? String(c.organization_id) : null); }
  let excluded = new Set<string>(); try { excluded = (await membersWithFlag(db, 'home_threads_off')).orgs; } catch { /* لا شيء */ }
  const lite: EntryLite[] = rows.map((r) => { const cid = roomOf.get(lower(r.email)) || null; return { id: Number(r.id), text: r.body_text ? String(r.body_text) : null, email: lower(r.email), classroom_id: cid, org_id: cid ? orgOfRoom.get(cid) ?? null : null, public_ok: r.public_ok === true, at: String(r.created_at) }; });
  const view = whyOf(lite, excluded, now); whyCache = { at: now.getTime(), view }; return view;
}
