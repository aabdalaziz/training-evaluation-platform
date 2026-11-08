// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/frozen — P68-ب «النموذج المثبَّت» للطاقم
 *  GET ?invite=<id>                       → النموذج الحيّ للدعوة (نسخة المشرف بالنصوص) أو {form:null, lock}
 *  GET ?form=<id|ATH-FM-…>                → معاينة نسخة المشرف (بالنصوص · الميزان · الإصدارات · القفل)
 *  GET ?alternatives=<form_id>&item=<code> → بدائل البند من الخليّة نفسها (بالنصوص)
 *  GET ?performance=<form_id>             → ★3 أثر الورقة بعد الاختبار (k ≥ 5)
 *  GET ?sheet=<form_id>                   → ★4 بيانات «نسخة المراقب»
 *  POST {action: freeze {invite_id} | swap {form_id, from, to, reason} | redraw {form_id, reason?} | withdraw {form_id, reason}}
 *  نصوص البنود لا تخرج إلا من هنا (طاقم فقط) — التحقّق العام في /api/miaar?form= بلا نصوص. لا ذكاء اصطناعي يقرّر.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { normalizeSite } from '../../../../../lib/portal/open';
import { previewForm, liveFormForInvite, lockState, alternativesFor, performanceOf, proctorSheet, freezeForm, swapItem, redrawForm, withdrawForm } from '../../../../../lib/miaar/forms';

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
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const u = new URL(req.url); const site = siteOf(req);
  const q = (k: string) => String(u.searchParams.get(k) || '').trim();
  if (q('invite')) { const live = await liveFormForInvite(db, q('invite')); if (!live) return NextResponse.json({ success: true, form: null, lock: await lockState(db, q('invite')) }, { headers: NO }); const p = await previewForm(db, live.id, { withText: true, site }); return NextResponse.json({ success: true, form: p }, { headers: NO }); }
  if (q('form')) { const p = await previewForm(db, q('form'), { withText: true, site }); return p ? NextResponse.json({ success: true, form: p }, { headers: NO }) : bad('النموذج غير موجود', 404); }
  if (q('alternatives')) { const r = await alternativesFor(db, q('alternatives'), q('item')); return r.ok ? NextResponse.json({ success: true, ...r }, { headers: NO }) : bad(r.error, r.status || 400); }
  if (q('performance')) { const r = await performanceOf(db, q('performance')); return r ? NextResponse.json({ success: true, performance: r }, { headers: NO }) : bad('النموذج غير موجود', 404); }
  if (q('sheet')) { const r = await proctorSheet(db, q('sheet'), site); return r ? NextResponse.json({ success: true, sheet: r }, { headers: NO }) : bad('النموذج غير موجود', 404); }
  return bad('معامل مفقود');
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const site = siteOf(req);
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>; const action = String(b.action || '');
  const by = { id: user.id, email: user.email };
  if (action === 'freeze') { const r = await freezeForm(db, { invite_id: b.invite_id, by, site }); if (!r.ok) return bad(r.error, r.status || 400); const p = await previewForm(db, r.form.id, { withText: true, site }); return NextResponse.json({ success: true, form: p, balance: r.balance, note_ar: `ثُبِّت النموذج ${r.form.code} (الإصدار 1) — ${r.items.length} بندًا. راجع نسخة المشرف قبل القاعة.` }); }
  if (action === 'swap') { const r = await swapItem(db, { form_id: b.form_id, from: b.from, to: b.to, reason: b.reason, by, site }); if (!r.ok) return bad(r.error, r.status || 400); const p = await previewForm(db, r.form.id, { withText: true, site }); return NextResponse.json({ success: true, form: p, note_ar: `بُدِّل البند — الإصدار ${r.form.version} من ${r.form.code}.` }); }
  if (action === 'redraw') { const r = await redrawForm(db, { form_id: b.form_id, reason: b.reason, by, site }); if (!r.ok) return bad(r.error, r.status || 400); const p = await previewForm(db, r.form.id, { withText: true, site }); return NextResponse.json({ success: true, form: p, note_ar: `سُحب نموذج جديد كاملًا — الإصدار ${r.form.version}${r.overlap ? ` (تكرّر ${r.overlap} بند لضيق البنك)` : ' (بلا أي بند مكرّر)'}.` }); }
  if (action === 'withdraw') { const r = await withdrawForm(db, { form_id: b.form_id, reason: b.reason, by, site }); if (!r.ok) return bad(r.error, r.status || 400); return NextResponse.json({ success: true, form: r.form, note_ar: `أُلغي التثبيت — الدعوة عادت إلى السحب العشوائي${r.locked_sessions ? ` (${r.locked_sessions} جلسة بدأت تُكمل ورقتها كما هي)` : ''}.` }); }
  return bad('إجراء غير معروف');
}
