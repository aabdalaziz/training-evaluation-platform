// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/after — «الشهادة التي تكبر» (الطاقم)
 *  GET  → المحطات لكل برنامج (مفتوحة · مكتوبة · بالمحطة · بالحالة · مشهودة · هل تتكلم الصفحة العامة) · المرشَّحون للنشر (أذن أصحابهم) · المنشور
 *  POST publish {id, published}   اعتماد اقتباس مجهول لصفحة البرنامج — إنسان يختار، من بين ما أذن أصحابه فقط
 *  POST summary {program_id}      مسودّة الميسِّر لهندسة البرامج من نصوص المحطات مجهَّلةً (ما نفع · ما لم ينتقل · النسخة التالية) — تُعرض للطاقم ولا تُحفظ في مكان عام
 *  P39 «البرنامج يردّ»: GET يضيف لكل برنامج voices{trigger, offers[want,no]} و org_written
 *   POST offer_draft {program_id}                 مسودّة دعوة من نصوص «لم تسنح» مجهَّلةً (الغرض القائم factory_review؛ محلي بلا مفتاح)
 *   POST offer {program_id, title_ar, text_ar, link?}  يعرض ورشة تطبيق — إنسان يكتب ويقرّر؛ لا يُرسَل شيء تلقائيًا غير إشعار داخلي
 *   POST offer_close {id}
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, aiUsage, logAi } from '../../../../lib/ai/athar';
import { P38_NAMES_AR, summaryPrompt, parseSummary, localSummary } from '../../../../lib/after/registry';
import type { AfterSummary } from '../../../../lib/after/registry';
import { adminAfter, setPublished, summaryTexts } from '../../../../lib/after/load';
import { cleanOffer, localOfferDraft, offerPrompt, parseOfferDraft } from '../../../../lib/after/voices';
import { createOffer, closeOffer } from '../../../../lib/after/voices-load';

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
  /* P39 — البرنامج يردّ */
  if (action === 'offer_draft') {
    const pid = String(b.program_id || ''); if (!/^[0-9a-z-]{1,40}$/i.test(pid)) return bad('رقم البرنامج غير صالح');
    const { data: rows } = await db.from('portal_after_stations').select('text_ar,state,written_at').eq('program_id', pid).eq('state', 'no_chance').not('written_at', 'is', null).limit(100);
    const texts = ((rows || []) as any[]).map(r => String(r.text_ar || '')).filter(Boolean); const { data: p } = await db.from('programs').select('name_ar').eq('id', pid).maybeSingle(); const programAr = String((p as any)?.name_ar || 'البرنامج');
    const local = localOfferDraft(programAr, texts); const pr = offerPrompt(programAr, texts); const usage = await aiUsage(db, user.id, 'factory_review');
    const res = usage.allowed && texts.length ? await runAi<{ title_ar: string; text_ar: string }>({ system: pr.system, user: pr.user, parse: raw => parseOfferDraft(JSON.parse(String(raw).replace(/^```json|```$/g, '').trim()), local), local: () => local, budgetMs: 10000 }) : null;
    if (res) await logAi(db, { user_id: user.id, email: user.email, role: user.role, purpose: 'factory_review', result: res, context: { p39: 'offer_draft', program_id: pid, texts: texts.length } });
    return NextResponse.json({ success: true, draft: res ? res.data : local, source: res?.source || 'local', n: texts.length, note_ar: 'مسودّة — حرّرها بكلماتك ثم «اعرض ورشة تطبيق». لا يُرسَل شيء قبل قرارك.' });
  }
  if (action === 'offer') {
    const pid = String(b.program_id || ''); if (!/^[0-9a-z-]{1,40}$/i.test(pid)) return bad('رقم البرنامج غير صالح'); const c = cleanOffer(b); if (!c.ok) return bad(c.error);
    const { data: rows } = await db.from('portal_after_stations').select('id,enrollment_id,program_id,user_id,email,state,written_at').eq('program_id', pid).limit(2000);
    const r = await createOffer(db, pid, c.o, user.id, (rows || []) as any[]); if (!r.ok) return bad(r.error);
    return NextResponse.json({ success: true, id: r.id, note_ar: 'عُرضت ورشة التطبيق — يراها من كتبوا «لم تسنح الفرصة» في محطاتهم، ويجيبون «أرغب» أو «لا، شكرًا».' });
  }
  if (action === 'offer_close') { const r = await closeOffer(db, b.id); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, note_ar: 'أُغلق العرض — يبقى في الصفحة العامة سطر «وردّ البرنامج بورشة تطبيق».' }); }
  return bad('إجراء غير معروف');
}
