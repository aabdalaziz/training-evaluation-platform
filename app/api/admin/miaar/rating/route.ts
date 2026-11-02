// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/rating — «غرفة التصحيح» للطاقم (م4-ب)
 *  GET ?status=pending|released|all → الطابور (بلا أسماء) + العدّادات
 *  GET ?id=<uuid>                   → تفصيل أداء: النص أو رابط صوت موقَّع 5 دقائق · المهمة · سُلّم التقدير
 *  POST {action}
 *   rate {id, scores, note, release} → تقدير بشري بالأبعاد (حفظ) أو إصدار (يكتب «معتمد» في بطاقة المتقدّم على الرمز نفسه)
 *   unrelease {id}                   → سحب إصدار
 *   ai_suggest {id}                  → «عيّنة المصحّح»: اقتراح أولي للنصوص بموافقة المتقدّم — لا يُنشر
 *  لا اسم ولا بريد في أي استجابة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { ratingQueue, performanceDetail, ratePerformance, unreleasePerformance, aiSuggest } from '../../../../../lib/miaar/rating';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
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
const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{20,40}$/i.test(v) ? v : '');

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const u = new URL(req.url);
  const id = uuid(u.searchParams.get('id'));
  if (id) { const d = await performanceDetail(db, id).catch(() => null); return d ? NextResponse.json({ success: true, performance: d }, { headers: NO }) : bad('الأداء غير موجود', 404); }
  const st = u.searchParams.get('status'); const status = st === 'released' || st === 'all' ? st : 'pending';
  const q = await ratingQueue(db, status).catch(() => null); if (!q) return bad('تعذّرت قراءة الطابور — هل شُغّلت هجرة م4-ب؟', 500);
  return NextResponse.json({ success: true, ...q }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || ''); const id = uuid(b.id); if (!id) return bad('معرّف أداء غير صالح');
  if (action === 'rate') { const r = await ratePerformance(db, id, { scores: b.scores, note: b.note, release: b.release === true }, user); return r.ok ? NextResponse.json({ success: true, status: r.status, rating: r.rating, note_ar: r.status === 'released' ? 'أُصدر التقدير — ظهر «معتمد» في بطاقة المتقدّم' : 'حُفظ التقدير (لم يُصدر بعد)' }, { headers: NO }) : bad(r.error); }
  if (action === 'unrelease') { const ok = await unreleasePerformance(db, id); return ok ? NextResponse.json({ success: true, note_ar: 'سُحب الإصدار — عاد «قيد التصحيح»' }, { headers: NO }) : bad('لا يمكن سحب هذا الأداء'); }
  if (action === 'ai_suggest') { const r = await aiSuggest(db, id, user); return r.ok ? NextResponse.json({ success: true, rating: r.rating, source: r.source, note_ar: r.source === 'ai' ? 'اقتراح أولي — راجعه وعدّله، القرار لك' : 'لا اقتراح متاح' }, { headers: NO }) : bad(r.error); }
  return bad('إجراء غير معروف');
}
