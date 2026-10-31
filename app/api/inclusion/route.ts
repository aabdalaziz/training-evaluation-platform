// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/inclusion — «أَثَر للجميع» (P32 · «أَثَر على مقاسي»)
 *  GET  ?meta=1                       (عام)   → الاحتياجات بكلماتها وأثر كلٍّ منها · سمات البرامج · بيان الوصول · الخصوصية
 *  GET  ?stats=1                      (عام)   → إحصاءات مجمَّعة k≥5 (لا رقم عن احتياج أقل من 5 أشخاص)
 *  GET  ?mine=1                       (مسجّل) → ملفي «أَثَر على مقاسي» (RLS: صاحبه فقط)
 *  GET  ?simple=<source>&id=<id>      (عام)   → «نسخة أبسط» المعتمَدة لهذا المصدر إن وُجدت (لا تُعرض pending)
 *  GET  ?programs=1                   (عام)   → سمات الوصول لكل برنامج عام {id: features[]} — متسامح إن لم يُنفَّذ SQL بعد
 *  POST (مسجّل) { action:'save', needs[], helps_ar?, share_staff? } · { action:'delete' } · { action:'simplify', source, id } (يولّد نسخة pending أو يعيد المعتمَدة/الموجودة)
 *  POST (عام)   { action:'report', page, text, contact? } → بلاغ عائق وصول
 *  السياسة: الملف لا يُرسل إلى أي نموذج؛ «نسخة أبسط» تُولَّد من النص العام وحده ولا تُعرض للجمهور قبل اعتماد بشري.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { limitFor, tooMany, ipOf } from '../../../lib/shield/ratelimit';
import { aiUsage, logAi, aiStatus } from '../../../lib/ai/athar';
import { NEEDS, NEED_LABEL, NEED_EFFECT_AR, FEATURES, FEATURE_LABEL, ACCESS_STATEMENT, ACCESS_AUDIT, PRIVACY_ACCESS_AR, ACCESS_K, ACCESS_TIME_FACTOR, ACCESS_HELPS_MAX, isSimpleSource, validateReport, cleanFeatures } from '../../../lib/inclusion/registry';
import { loadAccessProfile, saveAccessProfile, deleteAccessProfile, accessStats, getSimpleText, requestSimpleText } from '../../../lib/inclusion/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
type Who = { id: string; email: string; userDb: any };
async function who(req: Request): Promise<Who | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  return { id: data.user.id, email: String(data.user.email || '').toLowerCase(), userDb };
}
const META = {
  needs: NEEDS.map(k => ({ key: k, label: NEED_LABEL[k], effect_ar: NEED_EFFECT_AR[k] })),
  features: FEATURES.map(k => ({ key: k, label: FEATURE_LABEL[k] })),
  statement: ACCESS_STATEMENT, audit: ACCESS_AUDIT, privacy_ar: PRIVACY_ACCESS_AR, k: ACCESS_K, time_factor: ACCESS_TIME_FACTOR, helps_max: ACCESS_HELPS_MAX, ai: aiStatus().enabled,
};

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams; const db = svc(); if (!db) return bad('الخدمة غير مهيأة', 500);
  if (sp.get('meta') === '1') return NextResponse.json({ success: true, meta: META });
  if (sp.get('stats') === '1') return NextResponse.json({ success: true, stats: await accessStats(db), k: ACCESS_K });
  if (sp.get('programs') === '1') {
    const { data, error } = await db.from('programs').select('id,access_features').eq('is_public', true).limit(500);
    if (error) return NextResponse.json({ success: true, features: {}, pending_sql: true });
    const features: Record<string, string[]> = {}; for (const p of (data || []) as any[]) { const f = cleanFeatures(p.access_features); if (f.length) features[p.id] = f; }
    return NextResponse.json({ success: true, features });
  }
  const simple = sp.get('simple');
  if (simple) {
    const id = String(sp.get('id') || '').slice(0, 120); if (!isSimpleSource(simple) || !id) return bad('مصدر غير معروف');
    const row = await getSimpleText(db, simple, id);
    return NextResponse.json({ success: true, text: row && row.status === 'approved' ? row : null, pending: !!row && row.status === 'pending' });
  }
  if (sp.get('mine') === '1') {
    const me = await who(req); if (!me) return bad('سجّل الدخول', 401);
    return NextResponse.json({ success: true, profile: await loadAccessProfile(me.userDb, me.id), meta: META });
  }
  return bad('طلب غير معروف');
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('الخدمة غير مهيأة', 500);
  let body: any = {}; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || '');
  if (action === 'report') {
    const rl = await limitFor(db, 'credential_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl);
    const err = validateReport({ page: body.page, text: body.text, contact: body.contact }); if (err) return bad(err);
    const me = await who(req);
    const { error } = await db.from('portal_access_reports').insert({ page: String(body.page).trim().slice(0, 200), text_ar: String(body.text).trim(), contact: body.contact ? String(body.contact).trim().slice(0, 160) : null, user_id: me ? me.id : null, status: 'open' });
    if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, message_ar: 'وصل بلاغك. نقرؤه بأنفسنا ونرد خلال 5 أيام عمل إن تركت بريدًا.' });
  }
  const me = await who(req); if (!me) return bad('سجّل الدخول', 401);
  if (action === 'save') {
    const r = await saveAccessProfile(me.userDb, me, { needs: body.needs, helps_ar: body.helps_ar, share_staff: body.share_staff });
    if (r.error) return bad(r.error, 500); return NextResponse.json({ success: true, profile: r.profile });
  }
  if (action === 'delete') { const ok = await deleteAccessProfile(me.userDb, me.id); return ok ? NextResponse.json({ success: true, profile: null }) : bad('تعذّر الحذف', 500); }
  if (action === 'simplify') {
    const source = String(body.source || ''); const id = String(body.id || '').slice(0, 120); if (!isSimpleSource(source) || !id) return bad('مصدر غير معروف');
    const existing = await getSimpleText(db, source, id);
    if (existing) return NextResponse.json({ success: true, text: existing.status === 'approved' ? existing : null, pending: existing.status !== 'approved', created: false, note_ar: existing.status === 'approved' ? null : 'نسخة أبسط بانتظار اعتماد الطاقم — لا تُعرض قبل أن يقرأها إنسان' });
    const usage = await aiUsage(db, me.id, 'access_simplify'); if (!usage.allowed) return bad(`بلغت حدّ طلبات «نسخة أبسط» اليوم (${usage.limit})`, 429);
    const r = await requestSimpleText(db, me, source, id);
    if (r.ai) await logAi(db, { user_id: me.id, email: me.email, role: 'USER', purpose: 'access_simplify', result: r.ai, context: { source, id } });
    if (r.error) return bad(r.error, 500);
    return NextResponse.json({ success: true, text: null, pending: true, created: r.created, source: r.source, note_ar: 'كتب الذكاء الاصطناعي نسخة أبسط وستُعرض بعد أن يعتمدها الطاقم — عادةً خلال يوم عمل' });
  }
  return bad('إجراء غير معروف');
}
