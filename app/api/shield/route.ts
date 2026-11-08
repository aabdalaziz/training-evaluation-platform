// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/shield — درع أَثَر (P21): لوحة الطاقم + الصورة العامة المجهّلة
 *  GET  ?public=1                    → (بلا دخول) ملخص مجهّل: آخر تمرين ✓/✗ · عدّاد أحداث 30 يومًا حسب الدرجة · حالة الترويسات — لصفحة /security
 *  GET  (طاقم)                       → summary · events (آخر 200) · keys (بصمات فقط) · rls · manual_todo · limits
 *  POST (طاقم) { action:'drill' }    → يشنّ التمرين الذاتي الآن ويحفظه حدثًا
 *  POST (طاقم) { action:'handle', id, note? }       → يعلّم حدثًا بأنه عولج
 *  POST (طاقم) { action:'gen_key' }  → مفتاح رئيسي جديد (لا يُخزَّن) + خطوات التدوير
 *  POST (طاقم) { action:'gc' }       → تنظيف دلاء/أحداث قديمة
 *  P65 الطبقة الثانية:
 *  GET  ?public=1                    → + seal (آخر «شهادة الدرع»)        · GET ?seal=ATH-SH-…  → تحقّق عام من ختم  · GET ?erasure=ATH-ER-… → تحقّق عام من إيصال محو جهة
 *  GET  (طاقم)                       → + csp (خلاصة + حكم الجاهزية) · access (الوصول الإداري 7 أيام) · orgs (التجميد/المحو) · seals · policy (تقرير السياسات)
 *  POST (طاقم) { action:'freeze'|'unfreeze', org_id, reason? } · { action:'org_footprint'|'org_export'|'org_erase_request'|'org_erase_cancel', org_id, reason? }
 *  POST (طاقم) { action:'seal_now' }  → ختم جزئي للشهر الجاري (يُستبدل عند اكتماله) · { action:'csp_clear' } → يعلّم تقارير CSP كلّها «عولجت»
 *  مبدأ: لا أسرار تخرج من هنا أبدًا — بصمات 8 أحرف فقط.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { shieldSummary, securityEvent, KIND_AR, SEVERITY_AR } from '../../../lib/shield/guard';
import { runDrill, MANUAL_TODO_AR } from '../../../lib/shield/drill';
import { keyInfo, generateMasterKey, ROTATION_STEPS_AR } from '../../../lib/shield/keys';
import { LIMITS } from '../../../lib/shield/ratelimit';
import { readJson, STAFF_MAX_BYTES } from '../../../lib/shield/body';
import { cspSummary, cspVerdict, ENFORCE_STEPS_AR } from '../../../lib/shield/csp';
import { accessSummary, accessCsv, PII_PATHS } from '../../../lib/shield/access';
import { listOrgs, setFreeze } from '../../../lib/shield/freeze';
import { latestSeal, findSeal, issueSeal, monthOf } from '../../../lib/shield/seal';
import { orgFootprint, exportOrg, requestOrgErase, cancelOrgErase, findEraseReceipt, footprintSummaryAr } from '../../../lib/vault/org';

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
  if (u.searchParams.get('seal')) { const db = svc(); if (!db) return bad('غير مهيأ', 500); const r = await findSeal(db, u.searchParams.get('seal') || ''); return NextResponse.json({ success: true, ...r }, { headers: { 'Cache-Control': 'no-store' } }); }
  if (u.searchParams.get('erasure')) { const db = svc(); if (!db) return bad('غير مهيأ', 500); const r = await findEraseReceipt(db, u.searchParams.get('erasure') || ''); return NextResponse.json({ success: true, ...r }, { headers: { 'Cache-Control': 'no-store' } }); }
  if (u.searchParams.get('public') === '1') {
    const db = svc(); if (!db) return bad('غير مهيأ', 500);
    const s = await shieldSummary(db, 30); const seal = await latestSeal(db).catch(() => null);
    const checks = s.drill ? ((await db.from('portal_security_events').select('meta').eq('kind', 'drill').order('at', { ascending: false }).limit(1).maybeSingle()).data as any)?.meta?.checks : null;
    const anon = Array.isArray(checks) ? checks.map((c: any) => ({ id: c.id, title_ar: c.title_ar, ok: !!c.ok })) : [];
    return NextResponse.json({ success: true, drill: s.drill, checks: anon, seal, events_30d: { total: s.total, by_severity: s.by_severity }, open_critical: s.open_critical > 0, generated_at: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', 'Access-Control-Allow-Origin': '*' } });
  }
  const c = await staff(req); if ('error' in c) return c.error; const { db } = c;
  const [summary, { data: events }, { data: rls }] = await Promise.all([
    shieldSummary(db, 30),
    db.from('portal_security_events').select('id,at,severity,kind,actor,ip,user_id,meta,notified_at,handled_at,handled_by').order('at', { ascending: false }).limit(200),
    db.rpc('shield_rls_report'),
  ]);
  const lastDrill = ((events || []) as any[]).find(e => e.kind === 'drill');
  /* P65 */
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: cspEv }, access, orgs, { data: seals }, { data: policy }] = await Promise.all([
    db.from('portal_security_events').select('at,meta').eq('kind', 'csp_report').is('handled_at', null).gte('at', since7).order('at', { ascending: false }).limit(500),
    accessSummary(db, 7).catch(() => null), listOrgs(db).catch(() => []),
    db.from('portal_shield_seals').select('month,code,issued_at,passed_days,total_days,checks_total').order('month', { ascending: false }).limit(12),
    db.rpc('shield_policy_report'),
  ]);
  const cspRows = cspSummary((cspEv || []) as any[]); const csp = { rows: cspRows, verdict: cspVerdict(cspRows), steps: ENFORCE_STEPS_AR };
  let names: Record<string, string> = {};
  if (access && access.by_user.length) { const { data: ps } = await db.from('profiles').select('id,full_name').in('id', access.by_user.map(x => x.user_id)); for (const p of (ps || []) as any[]) names[p.id] = p.full_name || ''; }
  if (u.searchParams.get('format') === 'csv' && access) return new Response(accessCsv(access.rows, names), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="athar-admin-access-${new Date().toISOString().slice(0, 10)}.csv"` } });
  return NextResponse.json({ success: true, summary, csp, access: access ? { ...access, rows: access.rows.slice(0, 300), names } : null, pii_paths: PII_PATHS, orgs, seals: seals || [], policy: Array.isArray(policy) ? policy : null, events: ((events || []) as any[]).map(e => ({ ...e, ip: e.ip ? String(e.ip).replace(/\.\d+$/, '.x').replace(/:[0-9a-f]*:[0-9a-f]*$/i, ':x') : null, meta: e.kind === 'drill' ? { passed: e.meta?.passed, total: e.meta?.total, ms: e.meta?.ms } : e.meta })),
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
  /* P65 */
  if (action === 'freeze' || action === 'unfreeze') { const org_id = String(body.org_id || ''); if (!org_id) return bad('حدّد الجهة'); const r = await setFreeze(db, { org_id, on: action === 'freeze', by: user, reason: String(body.reason || ''), env: process.env }); return r.ok ? NextResponse.json({ success: true, org: r.org }) : bad(r.error, 400); }
  if (action === 'org_footprint' || action === 'org_export' || action === 'org_erase_request' || action === 'org_erase_cancel') {
    const org_id = String(body.org_id || ''); if (!org_id) return bad('حدّد الجهة');
    const { data: org } = await db.from('portal_organizations').select('id,name_ar,erase_at').eq('id', org_id).maybeSingle(); if (!org) return bad('الجهة غير موجودة', 404);
    if (action === 'org_footprint') { const r = await orgFootprint(db, org_id); return r.ok ? NextResponse.json({ success: true, rows: r.rows, summary_ar: footprintSummaryAr(r.rows) }) : bad(r.error || 'تعذّر', 500); }
    if (action === 'org_export') { const r = await exportOrg(db, org as any, user, process.env, site()); return r.ok ? NextResponse.json({ success: true, code: r.code, counts: r.counts, doc: r.doc }) : bad(r.error, 500); }
    if (action === 'org_erase_request') { if ((org as any).erase_at) return bad('المحو مطلوب أصلًا'); const r = await requestOrgErase(db, org as any, user, String(body.reason || '')); return r.ok ? NextResponse.json({ success: true, erase_at: r.erase_at }) : bad(r.error, 500); }
    const r = await cancelOrgErase(db, org as any, user); return r.ok ? NextResponse.json({ success: true }) : bad(r.error, 500);
  }
  if (action === 'seal_now') { const seal = await issueSeal(db, { month: monthOf(new Date()), partial: true, env: process.env, site: site(), actor: user.email }); return seal ? NextResponse.json({ success: true, seal: { month: seal.month, code: seal.code, passed_days: seal.passed_days, total_days: seal.total_days } }) : bad('لا تمرين مسجَّلًا هذا الشهر بعد — شغّل التمرين أولًا أو نفّذ SQL P65'); }
  if (action === 'csp_clear') { const { error } = await db.from('portal_security_events').update({ handled_at: new Date().toISOString(), handled_by: user.id }).eq('kind', 'csp_report').is('handled_at', null); return error ? bad(error.message, 500) : NextResponse.json({ success: true }); }
  if (action === 'gen_key') return NextResponse.json({ success: true, key: generateMasterKey(), steps: ROTATION_STEPS_AR, current: keyInfo(process.env) });
  if (action === 'gc') { const { data, error } = await db.rpc('shield_gc'); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, removed: data }); }
  return bad('إجراء غير معروف');
}
