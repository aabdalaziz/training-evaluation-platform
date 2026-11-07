// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P54 «أمانة صوتية» — ردّ صوتي للمتعلّم على «كلمة» مدرّبه (≤ 15 ثانية)
 *  POST   /api/me/voice-reply  multipart: file (audio) · notice_id · [chip] · [transcript ≤ 300] · [duration_sec]
 *         → يرفع الملف إلى المخزن الخاص athar-media تحت word-voice/<trainer_id>/<uuid>.<ext> ثم يسجّله في ردّ المتعلّم نفسه (meta.voice)
 *         صوت جديد على الكلمة نفسها يحلّ محلّ القديم (ويُحذف القديم من المخزن) · لا يدخل في أي تقييم
 *  DELETE /api/me/voice-reply?notice_id=… → حذف الأمانة الصوتية خلال ساعة من إرسالها (إن لم يبقَ لمسة ولا سطر يُحذف الردّ كلّه)
 *  المصادقة: Bearer (المتعلّم بنفسه) · الحدّ: 10 أمانات/ساعة · 400 لملف غير صالح · 404 لكلمة ليست له · 409 بعد نافذة التعديل
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { rateLimit, tooMany, ipOf } from '../../../../lib/shield/ratelimit';
import { submitReply, resolveWordForLearner, removeVoice, validateVoice, voicePath, voiceExt, cleanTranscript, chipLabel, VOICE_LIMITS } from '../../../../lib/portal/word-reply';
import type { VoiceMeta } from '../../../../lib/portal/word-reply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status, headers: NO });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  return { db, user: { id: data.user.id, email: String(data.user.email).toLowerCase() } };
}
const removeQuiet = async (db: any, path: string | null | undefined) => { if (!path) return; try { await db.storage.from(VOICE_LIMITS.bucket).remove([path]); } catch { /* تنظيف لاحق عبر الاحتفاظ */ } };
const audit = async (db: any, user: { id: string; email: string }, req: Request, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'word_voice', entity_type: 'notice', entity_id: String(meta.notice_id || ''), entity_label: 'أمانة صوتية على كلمة', source: 'portal', metadata: { ...meta, ip: ipOf(req) } }); } catch { /* التدقيق لا يوقف الأمانة */ } };

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const rl = await rateLimit(db, `wordvoice:${user.id}`, 3600, VOICE_LIMITS.perHour); if (!rl.allowed) return tooMany(rl);
  if (!(req.headers.get('content-type') || '').includes('multipart/form-data')) return bad('أرسل التسجيل كنموذج multipart');
  let fd: FormData; try { fd = await req.formData(); } catch { return bad('تعذّر قراءة التسجيل'); }
  const file = fd.get('file'); const noticeId = String(fd.get('notice_id') || ''); if (!(file instanceof File)) return bad('لا يوجد تسجيل', 400, { code: 'no_file' });
  const sec = Number(fd.get('duration_sec') || 0) || 0; const v = validateVoice({ mime: String(file.type || ''), bytes: file.size, sec }); if (!v.ok) return bad(v.error, 400, { code: 'bad_voice' });
  const word = await resolveWordForLearner(db, user.email, noticeId); if ('error' in word) return bad(word.error, word.status);
  /* الرفع أوّلًا — ثم التسجيل في الردّ؛ إن فشل التسجيل حُذف الملف */
  const path = voicePath(word.trainer_id, randomUUID(), voiceExt(v.mime)); const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await db.storage.from(VOICE_LIMITS.bucket).upload(path, buf, { contentType: v.mime, upsert: false }); if (upErr) return bad(`تعذّر رفع التسجيل: ${upErr.message}`, 500);
  const voice: VoiceMeta = { path, sec: v.sec, bytes: file.size, mime: v.mime, at: new Date().toISOString() };
  const r = await submitReply(db, { email: user.email, name: (fd.get('name') && String(fd.get('name')).slice(0, 80)) || null }, { notice_id: noticeId, chip: fd.get('chip') || undefined, text: undefined, voice, transcript: fd.has('transcript') ? cleanTranscript(fd.get('transcript')) : undefined });
  if ('error' in r) { await removeQuiet(db, path); return bad(r.error, r.status); }
  await removeQuiet(db, r.replaced_voice); /* الصوت القديم على الكلمة نفسها */
  await audit(db, user, req, { notice_id: r.row.notice_id, sec: v.sec, bytes: file.size, mime: v.mime, transcript_chars: (String(fd.get('transcript') || '')).length, created: r.created, replaced: !!r.replaced_voice });
  return NextResponse.json({ success: true, created: r.created, reply: { chip: r.row.chip, chip_ar: chipLabel(r.row.chip), text: r.row.text, at: r.row.updated_at, editable: true, voice_sec: v.sec, transcript: (r.row.meta as any)?.transcript || null }, message: r.replaced_voice ? 'حلّت أمانتك الجديدة محلّ القديمة.' : 'وصلت أمانتك الصوتية إلى مدرّبك — له وحده.' }, { headers: NO });
}

export async function DELETE(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const noticeId = new URL(req.url).searchParams.get('notice_id') || ''; if (!noticeId) return bad('حدّد الكلمة');
  const r = await removeVoice(db, { email: user.email, name: null }, noticeId); if ('error' in r) return bad(r.error, r.status);
  await removeQuiet(db, r.path); await audit(db, user, req, { notice_id: noticeId, deleted: true, row_deleted: r.row_deleted });
  return NextResponse.json({ success: true, row_deleted: r.row_deleted, message: r.row_deleted ? 'حُذفت أمانتك.' : 'حُذف الصوت وبقي ردّك.' }, { headers: NO });
}
