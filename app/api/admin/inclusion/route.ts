// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/inclusion — «أَثَر للجميع» للطاقم (P32)
 *  GET                      → إحصاءات k≥5 · نصوص «نسخة أبسط» (pending أولًا) · بلاغات الوصول · البرامج وسماتها · ميتا
 *  GET ?program=<id>        → احتياجات المسجَّلين في البرنامج الذين سمحوا بمشاركتها (share_staff فقط) — مجمَّعة بلا بريد
 *  POST { action:'text', id, op:'approve'|'reject'|'edit', simple_ar?, note_ar? }
 *  POST { action:'report', id, status:'open'|'fixed'|'wontfix', staff_note? }
 *  POST { action:'features', program_id, features[] }             → ما يوفّره البرنامج فعلًا
 *  لا يرى الطاقم هنا أي ملف فردي؛ لا بريد ولا اسم مع أي احتياج.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { NEEDS, NEED_LABEL, NEED_EFFECT_AR, FEATURES, FEATURE_LABEL, REPORT_STATUS_AR, SIMPLE_COLS, cleanFeatures, ACCESS_K } from '../../../../lib/inclusion/registry';
import type { Need } from '../../../../lib/inclusion/registry';
import { accessStats, listReports, sharedNeedsFor } from '../../../../lib/inclusion/load';

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
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() } };
}
const META = { needs: NEEDS.map(k => ({ key: k, label: NEED_LABEL[k], effect_ar: NEED_EFFECT_AR[k] })), features: FEATURES.map(k => ({ key: k, label: FEATURE_LABEL[k] })), report_status_ar: REPORT_STATUS_AR, k: ACCESS_K };

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const sp = new URL(req.url).searchParams;
  const program = sp.get('program');
  if (program) {
    const { data: enr } = await db.from('portal_enrollments').select('email').eq('program_id', program).in('status', ['approved', 'pending', 'waitlisted']).limit(500);
    const shared = await sharedNeedsFor(db, ((enr || []) as any[]).map(e => e.email));
    const counts = Object.fromEntries(NEEDS.map(n => [n, 0])) as Record<Need, number>; for (const s of shared) for (const n of s.needs) counts[n]++;
    const helps = shared.map(s => s.helps_ar).filter(Boolean) as string[];
    return NextResponse.json({ success: true, program, shared_people: shared.length, needs: NEEDS.filter(n => counts[n] > 0).map(n => ({ key: n, label_ar: NEED_LABEL[n].ar, n: counts[n] })), helps_ar: helps, note_ar: 'يظهر هنا فقط من سمح بمشاركة احتياجاته مع الطاقم — بلا أسماء ولا بُرُد. استخدمه لتجهيز القاعة والمواد والمترجم.' });
  }
  const [stats, texts, reports, programs] = await Promise.all([
    accessStats(db),
    db.from('portal_access_texts').select(SIMPLE_COLS).order('status', { ascending: false }).order('created_at', { ascending: false }).limit(200).then((r: any) => r.data || [], () => []),
    listReports(db, null, 200),
    db.from('programs').select('id,name_ar,is_public,archived_at,access_features').is('archived_at', null).order('start_date', { ascending: false }).limit(300).then((r: any) => ({ rows: r.data || [], error: r.error ? String(r.error.message || r.error) : null }), (e: any) => ({ rows: [], error: String(e?.message || e) })),
  ]);
  const pending_sql = !!programs.error && /access_features/i.test(programs.error);
  return NextResponse.json({ success: true, meta: META, stats, texts, reports, programs: (programs.rows as any[]).map(p => ({ id: p.id, name_ar: p.name_ar, is_public: !!p.is_public, features: cleanFeatures(p.access_features) })), pending_sql });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let b: any = {}; try { b = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(b.action || ''); const now = new Date().toISOString();
  if (action === 'text') {
    const id = b.id; const op = String(b.op || ''); if (id === undefined || id === null || id === '') return bad('معرّف ناقص');
    const patch: any = { updated_at: now, note_ar: b.note_ar ? String(b.note_ar).slice(0, 400) : null };
    if (op === 'approve') Object.assign(patch, { status: 'approved', approved_by: user.id, approved_at: now });
    else if (op === 'reject') Object.assign(patch, { status: 'rejected', approved_by: user.id, approved_at: now });
    else if (op === 'edit') { const t = String(b.simple_ar || '').trim(); if (t.length < 10 || t.length > 6000) return bad('النص بين 10 و6000 حرف'); Object.assign(patch, { simple_ar: t, status: 'approved', approved_by: user.id, approved_at: now, model: 'staff' }); }
    else return bad('عملية غير معروفة');
    const { data, error } = await db.from('portal_access_texts').update(patch).eq('id', id).select(SIMPLE_COLS).single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, text: data });
  }
  if (action === 'report') {
    const id = b.id; const status = String(b.status || ''); if (id === undefined || id === null || id === '' || !['open', 'fixed', 'wontfix'].includes(status)) return bad('بيانات ناقصة');
    const { data, error } = await db.from('portal_access_reports').update({ status, staff_note: b.staff_note ? String(b.staff_note).slice(0, 600) : null, closed_at: status === 'open' ? null : now }).eq('id', id).select('id,status,staff_note,closed_at').single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, report: data });
  }
  if (action === 'features') {
    const pid = String(b.program_id || ''); if (!pid) return bad('معرّف البرنامج ناقص'); const features = cleanFeatures(b.features);
    const { error } = await db.from('programs').update({ access_features: features }).eq('id', pid); if (error) return bad(/access_features/i.test(error.message) ? 'نفّذ ملف SQL الخاص بـ P32 أولًا (عمود access_features)' : error.message, 500);
    return NextResponse.json({ success: true, program_id: pid, features, labels_ar: features.map(f => FEATURE_LABEL[f].ar) });
  }
  return bad('إجراء غير معروف');
}
