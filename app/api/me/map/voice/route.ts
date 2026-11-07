// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P60 «لأن… بصوتك» — صوت المتعلّم على خيط من خريطته (≤ 15 ثانية · ملف واحد لكل خيط)
 *  POST   /api/me/map/voice   multipart: file · from · to · [duration_sec]   → رفع (يستبدل القديم) على خيط مُبقى
 *  GET    /api/me/map/voice?from=&to=                                        → رابط موقَّع 5 دقائق لصوت صاحبه
 *  GET    /api/me/map/voice?all=1                                            → كل روابط خريطتي (لـ «اسمع خريطتك»)
 *  DELETE /api/me/map/voice?from=&to=                                        → حذف فوري (يبقى الخيط وكلمته)
 *  المبدأ: الصوت لا يسافر — لا يصل المدرّب ولا الجهة ولا صفحة التحقّق؛ لا تفريغ على الخادم؛ لا يدخل في أي تقييم.
 *  المصادقة: Bearer (المتعلّم بنفسه) · الحدّ: 10 رفعات/ساعة (VOICE_LIMITS نفسها)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../../lib/shield/ratelimit';
import { setThreadVoice, clearThreadVoice, voiceUrl, voiceUrls, loadMap } from '../../../../../lib/map/store';
import { MAP_VOICE_LIMITS, MAP_VOICE_TITLE, VOICE_FOOT_AR } from '../../../../../lib/map/voice';

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
const audit = async (db: any, user: { id: string; email: string }, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'athar_map_voice', entity_type: 'portal_map_threads', entity_id: null, meta }); } catch { /* السجل اختياري */ } };
const keysOf = (req: Request) => { const u = new URL(req.url); return { from: u.searchParams.get('from') || '', to: u.searchParams.get('to') || '', all: u.searchParams.get('all') === '1' }; };

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const k = keysOf(req);
  if (k.all) { const urls = await voiceUrls(db, user); return NextResponse.json({ success: true, urls, count: Object.keys(urls).length, limits: MAP_VOICE_LIMITS, title: MAP_VOICE_TITLE, foot_ar: VOICE_FOOT_AR }, { headers: NO }); }
  if (!k.from || !k.to) return bad('حدّد الخيط');
  const r = await voiceUrl(db, user, k); if (!r.ok) return bad(r.error, r.status);
  return NextResponse.json({ success: true, url: r.url, sec: r.sec, expires_in: MAP_VOICE_LIMITS.signedSeconds }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const rl = await rateLimit(db, `mapvoice:${user.id}`, 3600, MAP_VOICE_LIMITS.perHour); if (!rl.allowed) return tooMany(rl);
  if (!(req.headers.get('content-type') || '').includes('multipart/form-data')) return bad('أرسل التسجيل كنموذج multipart');
  let fd: FormData; try { fd = await req.formData(); } catch { return bad('تعذّر قراءة التسجيل'); }
  const file = fd.get('file'); if (!(file instanceof File)) return bad('لا يوجد تسجيل', 400, { code: 'no_file' });
  const from = String(fd.get('from') || ''); const to = String(fd.get('to') || ''); const sec = Number(fd.get('duration_sec') || 0) || 0;
  const buf = Buffer.from(await file.arrayBuffer());
  const r = await setThreadVoice(db, user, { from, to }, { buf, mime: String(file.type || ''), bytes: file.size, sec }); if (!r.ok) return bad(r.error, r.status);
  await audit(db, user, { action: 'voice_set', from, to, sec: r.voice.sec, bytes: file.size, replaced: r.replaced });
  const map = await loadMap(db, user);
  return NextResponse.json({ success: true, voice: r.voice, replaced: r.replaced, map, message: r.replaced ? 'استُبدل صوتك على هذا الخيط.' : 'حُفظ صوتك — لك وحدك.' }, { headers: NO });
}

export async function DELETE(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const k = keysOf(req); if (!k.from || !k.to) return bad('حدّد الخيط');
  const r = await clearThreadVoice(db, user, k); if (!r.ok) return bad(r.error, r.status);
  await audit(db, user, { action: 'voice_clear', from: k.from, to: k.to, had: r.had });
  const map = await loadMap(db, user);
  return NextResponse.json({ success: true, had: r.had, map, message: r.had ? 'حُذف صوتك فورًا — بقي الخيط وكلمتك.' : 'لا صوت على هذا الخيط.' }, { headers: NO });
}
