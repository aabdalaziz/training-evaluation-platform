// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P69 «غرفة العرض» — واجهة الطاقم (مدير المنصّة فقط):
 *  GET                       → الحالة · الخطوات · مسار العرض · بطاقات العارضين (إن كان جاهزًا)
 *  POST {action:'build'}     → خطوة بناء واحدة (العميل يكرّر حتى done=true — حدود زمن الدوالّ)
 *  POST {action:'destroy', confirm:'المنطقة س'} → محو كل ما في «البيان» بترتيب التبعيات
 *  POST {action:'path'}      → نصّ مسار العرض للنسخ */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { demoStatus, buildStep, destroyDemo, presenterCards, currentRun } from '../../../../lib/demo/build';
import { DEMO_PATH, pathText, pathWith } from '../../../../lib/demo/script';
import { normalizeSite } from '../../../../lib/portal/open';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!ADMINS.includes(role)) return { error: bad('غير مصرّح — لمدير المنصّة فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const st = await demoStatus(c.db, siteOf(req));
  const cards = st.run && st.run.status === 'ready' ? presenterCards(st.run as any, st.site) : [];
  return NextResponse.json({ success: true, ...st, cards }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const body = await req.json().catch(() => ({} as Record<string, unknown>)); const action = String(body.action || '');
  const site = siteOf(req);
  if (action === 'build') {
    const r = await buildStep(c.db, { by: c.user, env: process.env, site });
    if (!r.ok) return bad(r.error, r.status || 400);
    return NextResponse.json({ success: true, done: r.done, step: r.step, step_ar: r.step_ar, log: r.run.log, manifest_counts: counts(r.run.manifest) }, { headers: NO });
  }
  if (action === 'destroy') {
    if (String(body.confirm || '').trim() !== 'المنطقة س') return bad('اكتب «المنطقة س» للتأكيد');
    const r = await destroyDemo(c.db, { by: c.user, env: process.env }); if (!r.ok) return bad(r.error, r.status || 400);
    return NextResponse.json({ success: true, counts: r.counts }, { headers: NO });
  }
  if (action === 'path') {
    const run = await currentRun(c.db); const p = pathWith(DEMO_PATH, { form: run?.manifest?.form_code || null, report: run?.manifest?.prev_report || null });
    return NextResponse.json({ success: true, text: pathText(p, site) }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
const counts = (m: any) => ({ users: (m?.user_ids || []).length, programs: (m?.program_ids || []).length, enrollments: (m?.enrollment_ids || []).length, sessions: (m?.session_ids || []).length, form: m?.form_code || null, report: m?.prev_report || null });
