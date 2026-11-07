// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P63 «سطر التخرّج — بصوتك» (≤ 15 ثانية · ملف واحد لكل صفحة تخرّج)
 *  POST   /api/me/grad/voice   multipart: file · program_id · [duration_sec] → رفع (يستبدل القديم)
 *  GET    /api/me/grad/voice?program=<id>                                     → رابط موقَّع 5 دقائق لصوت صاحبه
 *  DELETE /api/me/grad/voice?program=<id>                                     → حذف فوري (يبقى السطر المكتوب)
 *  المبدأ: الصوت لا يسافر — لا يدخل الجسم المختوم ولا الوجه العام ولا صفحة التحقّق؛ لا تفريغ على الخادم؛ لا يدخل في أي تقييم.
 *  المصادقة: Bearer (المتعلّم بنفسه) · الحدّ: 10 رفعات/ساعة (حدود P60 نفسها)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../../lib/shield/ratelimit';
import { setLineVoice, clearLineVoice, lineVoiceUrl } from '../../../../../lib/grad/store';
import { MAP_VOICE_LIMITS } from '../../../../../lib/map/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status, headers: NO });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  return { db, user: { id: data.user.id, email: String(data.user.email).toLowerCase() } };
}
const audit = async (db: any, user: { id: string; email: string }, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'grad_voice', entity_type: 'portal_grad_pages', entity_id: null, meta }); } catch { /* السجل اختياري */ } };
const pidOf = (req: Request) => String(new URL(req.url).searchParams.get('program') || '');

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const pid = pidOf(req); if (!pid) return bad('حدّد البرنامج');
  const r = await lineVoiceUrl(db, user, pid); if (!r.ok) return bad(r.error, r.status);
  return NextResponse.json({ success: true, url: r.url, sec: r.sec, expires_in: MAP_VOICE_LIMITS.signedSeconds }, { headers: NO });
}
export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const rl = await rateLimit(db, `gradvoice:${user.id}`, 3600, MAP_VOICE_LIMITS.perHour); if (!rl.allowed) return tooMany(rl);
  if (!(req.headers.get('content-type') || '').includes('multipart/form-data')) return bad('أرسل التسجيل كنموذج multipart');
  let fd: FormData; try { fd = await req.formData(); } catch { return bad('تعذّر قراءة التسجيل'); }
  const file = fd.get('file'); if (!(file instanceof File)) return bad('لا يوجد تسجيل', 400, { code: 'no_file' });
  const pid = String(fd.get('program_id') || ''); if (!pid) return bad('حدّد البرنامج'); const sec = Number(fd.get('duration_sec') || 0) || 0;
  const buf = Buffer.from(await file.arrayBuffer());
  const r = await setLineVoice(db, user, pid, { buf, mime: String(file.type || ''), bytes: file.size, sec }); if (!r.ok) return bad(r.error, r.status);
  await audit(db, user, { action: 'voice_set', program_id: pid, sec: r.voice.sec, bytes: file.size, replaced: r.replaced });
  return NextResponse.json({ success: true, voice: r.voice, replaced: r.replaced, message: r.replaced ? 'استُبدل صوت سطرك.' : 'حُفظ صوتك — لك وحدك، لا يدخل الختم ولا الوجه العام.' }, { headers: NO });
}
export async function DELETE(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const pid = pidOf(req); if (!pid) return bad('حدّد البرنامج');
  const r = await clearLineVoice(db, user, pid); if (!r.ok) return bad(r.error, r.status);
  await audit(db, user, { action: 'voice_clear', program_id: pid, had: r.had });
  return NextResponse.json({ success: true, had: r.had, message: r.had ? 'حُذف صوتك فورًا — بقي سطرك المكتوب.' : 'لا صوت على سطرك.' }, { headers: NO });
}
