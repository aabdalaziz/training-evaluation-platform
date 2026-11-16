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
export async function saveEntry(db: Db, s: EntrySession, b: { text?: unknown; lang?: unknown; audio?: unknown; mime?: unknown; sec?: unknown; quality?: unknown /* P72-أ */ }, now = new Date()): Promise<{ ok: true; entry: EntryView } | Fail> {
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
  const row = { email, session_id: s.id, report_id: rep?.id ? String(rep.id) : null, user_id: s.user_id || null, invite_id: s.invite_id || null, lang, body_text: text ?? (prev?.body_text || null), voice: voice || voiceOfEntry(prev?.voice) || {}, updated_at: now.toISOString() };
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
/** للأستاذ: سطور الدخول لشعبته (بأبرِدة قيود التسجيل) — نصوص فقط · k ≥ 5 · بلا أسماء */
export async function sectionEntry(db: Db, emails: string[], roster: number, seed: string): Promise<{ shown: boolean; n: number; head_ar: string | null; lines: string[] }> {
  const ems = [...new Set(emails.map(lower).filter(Boolean))].slice(0, 200); if (ems.length < ENTRY_LIMITS.k) return { shown: false, n: 0, head_ar: null, lines: [] };
  const rows = await safe<any[]>(db.from('portal_entry_lines').select('email,body_text').in('email', ems).not('body_text', 'is', null).limit(500), []);
  const byEmail = new Map<string, string>(); for (const r of rows) if (r.body_text && !byEmail.has(lower(r.email))) byEmail.set(lower(r.email), String(r.body_text));
  return entryEchoLine([...byEmail.values()], roster, seed);
}
