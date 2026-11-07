// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P64 «أول يوم — قال من سبقك» (الاسم الرسمي: صفحة اليوم الأول للمتدرّب)
 *  GET  /api/me/first?program=<id>   → برامجي التي بدأت · الصفحة (كلمة أَثَر · «قال من سبقك» k ≥ 5 بلا أسماء · ما قالوه بعد أشهر · كلمة الاستقبال · «لماذا جئتُ» · شعبتي · خارطة الطريق)
 *  POST /api/me/first { action:'why', program_id, body_ar }  → سطر «لماذا جئتُ» (10–160) يُختم رسالةً إلى نفسي تُفتح يوم التخرّج (محرّك P62) — مرة واحدة لكل برنامج · في الأسبوع الأول فقط
 *  المبدأ: لا درجة ولا تقييم؛ لا أسماء؛ لا ذكاء اصطناعي؛ صفر SQL. المصادقة: Bearer (المتعلّم بنفسه) · الحدّ: 20 عملية كتابة/ساعة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { loadFirstPage, writeWhy } from '../../../../lib/first/store';
import { P64_NAMES_AR, FIRST_LIMITS, FIRST_FOOT_AR, WHY_PROMPT_AR } from '../../../../lib/first/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  const name = String((data.user.user_metadata as any)?.full_name || (data.user.user_metadata as any)?.name || '').trim();
  return { db, user: { id: data.user.id, email: String(data.user.email).toLowerCase(), name: name || undefined } };
}
const audit = async (db: any, user: { id: string; email: string }, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'first_day', entity_type: 'portal_time_capsules', entity_id: null, meta }); } catch { /* السجل اختياري */ } };

async function payload(db: any, user: { id: string; email: string; name?: string }, programId: string | null, now: Date) {
  const { programs, view } = await loadFirstPage(db, user, programId, now);
  return { programs, view, names: P64_NAMES_AR, limits: FIRST_LIMITS, foot_ar: FIRST_FOOT_AR, prompt_ar: WHY_PROMPT_AR, now: now.toISOString() };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const pid = new URL(req.url).searchParams.get('program');
  return NextResponse.json({ success: true, ...(await payload(db, user, pid, new Date())) }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || ''); const now = new Date(); const pid = String(body.program_id || ''); if (!pid) return bad('حدّد البرنامج');
  const rl = await rateLimit(db, `first:${user.id}`, 3600, 20); if (!rl.allowed) return tooMany(rl);
  if (action === 'why') { const r = await writeWhy(db, user, pid, { body_ar: body.body_ar }, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'why', program_id: pid, letter_id: r.id }); return NextResponse.json({ success: true, id: r.id, deliver_at: r.deliver_at, message: 'خُتم سطرك — يُفتح لك يوم تخرّجك، ويظهر في صفحة تخرّجك بكلماتك.', ...(await payload(db, user, pid, now)) }, { headers: NO }); }
  return bad('إجراء غير معروف');
}
