// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/growth — «النموّ والمقارنة» للطاقم (م5-ب)
 *  GET ?options=1                                   → الوسوم والدعوات والبرامج لقوائم الاختيار (+ يمنح أذون «نهاية البرنامج» الكسولة)
 *  GET ?email=<بريد>[&report=<id>]                  → رحلة متقدّم كاملة (للطاقم: البريد والمعرّفات)
 *  GET ?a_kind=tag|invite|program|period&a=…&b_kind=…&b=…[&a_from&a_to&b_from&b_to] → مجموعة مقابل مجموعة (k ≥ 5)
 *  GET ?program=<id>                                → قبل/بعد البرنامج (الأزواج والملخّص)
 *  GET ?csv=1&program=<id> | ?csv=1&a_kind…         → CSV
 *  POST {action:'certificate', report_id}           → إصدار «شهادة النموّ» (إنسان فقط؛ تُرفض إن كان النموّ ضمن خطأ القياس)
 *  POST {action:'program_end_grants'}               → تشغيل منح أذون نهاية البرنامج الآن
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { normalizeSite } from '../../../../../lib/portal/open';
import { groupOptions, journeyByEmail, parseGroupSel, groupAttempts, compareGroups, programImpact, programEndGrants, issueGrowthCertificate, LEVEL_AR, VERDICT_AR, type Comparison } from '../../../../../lib/miaar/growth';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role } };
}
const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-zA-Z-]{2,40}$/.test(v) ? v : '');
const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvOf = (rows: unknown[][]) => '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
const pairRows = (pairs: Comparison[]) => [['الأول: التاريخ', 'الأول: المستوى', 'الأول: %', 'الثاني: التاريخ', 'الثاني: المستوى', 'الثاني: %', 'الدرجات', 'فرق %', 'خطأ الفرق', 'z', 'الأيام', 'الحكم'], ...pairs.map((c) => [c.first.taken_at.slice(0, 10), LEVEL_AR[c.first.level], c.first.percent ?? '', c.second.taken_at.slice(0, 10), LEVEL_AR[c.second.level], c.second.percent ?? '', c.steps, c.percent_diff ?? '', c.se_diff ?? '', c.z ?? '', c.days, VERDICT_AR[c.verdict].title])];

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const sp = new URL(req.url).searchParams; const site = siteOf(req);
  if (sp.get('options')) {
    const auto = await programEndGrants(db, user.id).catch(() => ({ programs: 0, granted: 0 }));
    const opts = await groupOptions(db); return NextResponse.json({ success: true, ...opts, auto }, { headers: NO });
  }
  if (sp.get('email')) { const j = await journeyByEmail(db, sp.get('email'), site, uuid(sp.get('report')) || null).catch(() => null); return j ? NextResponse.json({ success: true, journey: j }, { headers: NO }) : bad('لا محاولات لهذا البريد', 404); }
  if (sp.get('program')) {
    const id = uuid(sp.get('program')); if (!id) return bad('برنامج غير صالح'); const r = await programImpact(db, id, site); if (!r) return bad('البرنامج غير موجود', 404);
    if (sp.get('csv')) return new NextResponse(csvOf(pairRows(r.pairs)), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="miaar-program-${id.slice(0, 8)}.csv"`, ...NO } });
    return NextResponse.json({ success: true, impact: r }, { headers: NO });
  }
  const A = parseGroupSel('a', sp), B = parseGroupSel('b', sp);
  if (A && B) {
    const [ga, gb] = await Promise.all([groupAttempts(db, A), groupAttempts(db, B)]); const cmp = compareGroups(ga.attempts, ga.label, gb.attempts, gb.label);
    if (sp.get('csv')) { const rows: unknown[][] = [['المجموعة', 'k', 'المتوسط %', 'الانحراف', 'الوسيط', 'متوسط السُّلّم', ...Object.keys(cmp.a.dist).map((l) => LEVEL_AR[l as keyof typeof LEVEL_AR])]]; for (const g of [cmp.a, cmp.b]) rows.push([g.label, g.k, g.mean ?? '', g.sd ?? '', g.median ?? '', g.mean_level ?? '', ...Object.values(g.dist)]); rows.push([]); rows.push(['Cohen d', cmp.d ?? '', 'CI95', cmp.ci ? `${cmp.ci[0]} .. ${cmp.ci[1]}` : '', 'التفسير', cmp.interpretation || cmp.reason || '']); return new NextResponse(csvOf(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="miaar-groups.csv"', ...NO } }); }
    return NextResponse.json({ success: true, compare: cmp }, { headers: NO });
  }
  return bad('استعلام غير معروف');
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>; const action = String(b.action || '');
  if (action === 'certificate') { const r = await issueGrowthCertificate(db, b.report_id, user, siteOf(req)); return r.ok ? NextResponse.json({ success: true, code: r.code, url: r.url, already: r.already }, { headers: NO }) : bad(r.error, r.status); }
  if (action === 'program_end_grants') { const r = await programEndGrants(db, user.id, 50); return NextResponse.json({ success: true, ...r }, { headers: NO }); }
  return bad('إجراء غير معروف');
}
