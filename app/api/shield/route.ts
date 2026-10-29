// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/shield — درع أَثَر (P21): لوحة الطاقم + الصورة العامة المجهّلة
 *  GET  ?public=1                    → (بلا دخول) ملخص مجهّل: آخر تمرين ✓/✗ · عدّاد أحداث 30 يومًا حسب الدرجة · حالة الترويسات — لصفحة /security
 *  GET  (طاقم)                       → summary · events (آخر 200) · keys (بصمات فقط) · rls · manual_todo · limits
 *  POST (طاقم) { action:'drill' }    → يشنّ التمرين الذاتي الآن ويحفظه حدثًا
 *  POST (طاقم) { action:'handle', id, note? }       → يعلّم حدثًا بأنه عولج
 *  POST (طاقم) { action:'gen_key' }  → مفتاح رئيسي جديد (لا يُخزَّن) + خطوات التدوير
 *  POST (طاقم) { action:'gc' }       → تنظيف دلاء/أحداث قديمة
 *  مبدأ: لا أسرار تخرج من هنا أبدًا — بصمات 8 أحرف فقط.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { shieldSummary, securityEvent, KIND_AR, SEVERITY_AR } from '../../../lib/shield/guard';
import { runDrill, MANUAL_TODO_AR } from '../../../lib/shield/drill';
import { keyInfo, generateMasterKey, ROTATION_STEPS_AR } from '../../../lib/shield/keys';
import { LIMITS } from '../../../lib/shield/ratelimit';
import { readJson, STAFF_MAX_BYTES } from '../../../lib/shield/body';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://athar-portal.vercel.app').replace(/\/+$/, '');
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const K = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && K ? createClient(U, K, { auth: { persistSession: false } }) : null; };

async function staff(req: Request) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const db = svc(); if (!U || !A || !db) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const { data } = await createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }).auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) return { error: bad('هذه الصفحة للطاقم', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || '') } };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get('public') === '1') {
    const db = svc(); if (!db) return bad('غير مهيأ', 500);
    const s = await shieldSummary(db, 30);
    const checks = s.drill ? ((await db.from('portal_security_events').select('meta').eq('kind', 'drill').order('at', { ascending: false }).limit(1).maybeSingle()).data as any)?.meta?.checks : null;
    const anon = Array.isArray(checks) ? checks.map((c: any) => ({ id: c.id, title_ar: c.title_ar, ok: !!c.ok })) : [];
    return NextResponse.json({ success: true, drill: s.drill, checks: anon, events_30d: { total: s.total, by_severity: s.by_severity }, open_critical: s.open_critical > 0, generated_at: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', 'Access-Control-Allow-Origin': '*' } });
  }
  const c = await staff(req); if ('error' in c) return c.error; const { db } = c;
  const [summary, { data: events }, { data: rls }] = await Promise.all([
    shieldSummary(db, 30),
    db.from('portal_security_events').select('id,at,severity,kind,actor,ip,user_id,meta,notified_at,handled_at,handled_by').order('at', { ascending: false }).limit(200),
    db.rpc('shield_rls_report'),
  ]);
  const lastDrill = ((events || []) as any[]).find(e => e.kind === 'drill');
  return NextResponse.json({ success: true, summary, events: ((events || []) as any[]).map(e => ({ ...e, ip: e.ip ? String(e.ip).replace(/\.\d+$/, '.x').replace(/:[0-9a-f]*:[0-9a-f]*$/i, ':x') : null, meta: e.kind === 'drill' ? { passed: e.meta?.passed, total: e.meta?.total, ms: e.meta?.ms } : e.meta })),
    last_drill: lastDrill?.meta || null, keys: { ...keyInfo(process.env), rotation_steps: ROTATION_STEPS_AR }, rls: Array.isArray(rls) ? rls : null, rls_error: Array.isArray(rls) ? null : 'نفّذ SQL 725 (shield_rls_report)',
    manual_todo: MANUAL_TODO_AR, limits: LIMITS, kinds: KIND_AR, severities: SEVERITY_AR, site: site() });
}

export async function POST(req: Request) {
  const c = await staff(req); if ('error' in c) return c.error; const { db, user } = c;
  const r = await readJson(req, { maxBytes: STAFF_MAX_BYTES }); if (!r.ok) return bad(r.error, r.status); const body = r.body || {}; const action = String(body.action || '');
  if (action === 'drill') {
    const result = await runDrill(site(), process.env, db);
    await securityEvent(db, { severity: result.passed === result.total ? 'info' : 'warn', kind: 'drill', actor: user.email, user_id: user.id, meta: { passed: result.passed, total: result.total, ms: result.ms, checks: result.checks } });
    return NextResponse.json({ success: true, result });
  }
  if (action === 'handle') {
    const id = Number(body.id || 0); if (!id) return bad('معرّف ناقص');
    const { data: ev } = await db.from('portal_security_events').select('meta').eq('id', id).maybeSingle(); if (!ev) return bad('الحدث غير موجود', 404);
    const meta = { ...(((ev as any).meta as Record<string, unknown>) || {}), ...(body.note ? { handled_note: String(body.note).slice(0, 400) } : {}) };
    const { error } = await db.from('portal_security_events').update({ handled_at: new Date().toISOString(), handled_by: user.id, meta }).eq('id', id); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true });
  }
  if (action === 'gen_key') return NextResponse.json({ success: true, key: generateMasterKey(), steps: ROTATION_STEPS_AR, current: keyInfo(process.env) });
  if (action === 'gc') { const { data, error } = await db.rpc('shield_gc'); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, removed: data }); }
  return bad('إجراء غير معروف');
}
