// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/me/policy — P67: «ما الذي قرّرته جهتي؟» للمتصفح (نادِ · الكشك · إخفاء أزرار الصوت/الوسائط)
 *  GET (Bearer) → { policy, orgs:[{id,name_ar,slug}], code_user } — خاص، يُخزَّن 5 دقائق في المتصفح (sessionStorage) وليس في CDN
 *  POST { action:'change_pin', current, next } → المتعلّم بالرمز يغيّر رقمه السري
 *  POST { action:'epithet', id, lang? }        → ★4 «الرمز يتكلّم»: كُنية من القائمة المغلقة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { userPolicy, EPITHETS, isSyntheticEmail } from '../../../../lib/org/policy';
import { changePin, setEpithet } from '../../../../lib/org/roster';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  return { db: createClient(URL_, SERVICE, { auth: { persistSession: false } }), user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() }, url: URL_, anon: ANON };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const p = await userPolicy(c.db, c.user);
  return NextResponse.json({ success: true, ...p, epithets: p.code_user ? EPITHETS : [] }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');
  if (!isSyntheticEmail(c.user.email)) return bad('هذه الخدمة لحسابات الدخول بالرمز', 403);
  if (action === 'change_pin') {
    const rl = await rateLimit(c.db, `pinchange:${c.user.id}`, 3600, 5); if (!rl.allowed) return tooMany(rl);
    const r = await changePin(c.db, { user: c.user, current: String(body.current || ''), next: String(body.next || ''), url: c.url, anon: c.anon });
    return r.ok ? NextResponse.json({ success: true }, { headers: NO }) : bad(r.error || 'تعذّر', 400);
  }
  if (action === 'epithet') {
    const r = await setEpithet(c.db, c.user, String(body.id || 'none'), body.lang === 'en' ? 'en' : 'ar');
    return r.ok ? NextResponse.json({ success: true, name: r.name }, { headers: NO }) : bad(r.error || 'تعذّر', 400);
  }
  return bad('إجراء غير معروف');
}
