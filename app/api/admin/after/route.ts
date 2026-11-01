// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/after — «الشهادة التي تكبر» (الطاقم)
 *  GET  → المحطات لكل برنامج (مفتوحة · مكتوبة · بالمحطة · بالحالة · مشهودة · هل تتكلم الصفحة العامة) · المرشَّحون للنشر (أذن أصحابهم) · المنشور
 *  POST publish {id, published}   اعتماد اقتباس مجهول لصفحة البرنامج — إنسان يختار، من بين ما أذن أصحابه فقط
 *  POST summary {program_id}      مسودّة الميسِّر لهندسة البرامج من نصوص المحطات مجهَّلةً (ما نفع · ما لم ينتقل · النسخة التالية) — تُعرض للطاقم ولا تُحفظ في مكان عام
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, aiUsage, logAi } from '../../../../lib/ai/athar';
import { P38_NAMES_AR, summaryPrompt, parseSummary, localSummary } from '../../../../lib/after/registry';
import type { AfterSummary } from '../../../../lib/after/registry';
import { adminAfter, setPublished, summaryTexts } from '../../../../lib/after/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || ''), role } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const d = await adminAfter(c.db); return NextResponse.json({ success: true, names_ar: P38_NAMES_AR, ...d }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let b: any = {}; try { b = await req.json(); } catch { /* فارغ */ }
  const action = String(b.action || '');
  if (action === 'publish') { const r = await setPublished(db, b.id, !!b.published, user.id); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, note_ar: b.published ? 'اعتُمد الاقتباس — يظهر على صفحة البرنامج بلا اسم حين تتكلم الصفحة (من خمسة).' : 'أُزيل من صفحة البرنامج.' }); }
  if (action === 'summary') {
    const pid = String(b.program_id || ''); if (!/^[0-9a-z-]{1,40}$/i.test(pid)) return bad('رقم البرنامج غير صالح');
    const input = await summaryTexts(db, pid); if (input.texts.length < 3) return bad(`الخلاصة من ثلاث محطات مكتوبة على الأقل — كُتبت ${input.texts.length}`);
    const p = summaryPrompt(input); const usage = await aiUsage(db, user.id, 'factory_review');
    const res = usage.allowed ? await runAi<AfterSummary>({ system: p.system, user: p.user, parse: raw => parseSummary(JSON.parse(String(raw).replace(/^```json|```$/g, '').trim())), local: () => localSummary(input), budgetMs: 12000 }) : null;
    const summary = res ? res.data : localSummary(input);
    if (res) await logAi(db, { user_id: user.id, email: user.email, role: user.role, purpose: 'factory_review', result: res, context: { p38: 'after_summary', program_id: pid, texts: input.texts.length } });
    return NextResponse.json({ success: true, summary, source: res?.source || 'local', model: res?.model || null, n: input.texts.length, program_ar: input.program_ar, note_ar: 'مسودّة للطاقم ومهندس البرنامج — الذكاء لخّص، والقرار إنساني. انسخها إلى هندسة البرامج إن رأيتها نافعة.' });
  }
  return bad('إجراء غير معروف');
}
