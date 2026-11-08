// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/report — P68 «تقرير القيادة» (صفحة واحدة موقَّعة ATH-LR، تنتهي بقرار)
 *  GET  ?verify=ATH-LR-XXXX-XXXX          → عام: صالح؟ سليم؟ حيّ أم صدر بعده أحدث؟ (verify_minimal يحجب القرار والسطور)
 *  GET  ?mine=1                            → للمنسوب: سطر «قيادتك قرأت وقرّرت» (آخر 120 يومًا) — بلا أسماء
 *  GET  ?org=<id>                          → مدير جهة/طاقم: الأرشيف + الفترة المقترَحة + قائمة القرارات
 *  GET  ?code=ATH-LR-…                     → مدير جهة/طاقم: الوثيقة كاملة (للعرض والطباعة)
 *  POST { action:'issue', org_id, kind, from, to, name?, title? } → بناء + توقيع + حفظ (يُلغي التقرير الحيّ لنفس الفترة إن وُجد)
 *  POST { action:'decide', code, key, note_ar? }                  → ختم القرار داخل الوثيقة (إعادة توقيع بنفس الرمز) — مرّة واحدة
 *  POST { action:'revoke', code }                                 → إلغاء
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { issueReport, decideReport, revokeReport, listReports, reportByCode, verifyReport, suggestPeriod, leadershipLineFor, leadershipLineAr, DECISIONS, KIND_AR, quarterOf, todayRiyadh, loadOrgLite } from '../../../../lib/org/report';
import { rateLimit, tooMany, ipOf } from '../../../../lib/shield/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
function service() { const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!URL_ || !ANON || !SERVICE) return null; return { db: createClient(URL_, SERVICE, { auth: { persistSession: false } }), url: URL_, anon: ANON }; }

async function ctx(req: Request) {
  const s = service(); if (!s) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userDb = createClient(s.url, s.anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: prof } = await s.db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { ...s, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') }, staff: WRITERS.includes(role) };
}
async function canManage(db: any, orgId: string, user: { id: string; email: string }, staff: boolean) {
  if (staff) return true;
  const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(1); return ((data || []) as any[]).length > 0;
}
const publicRow = (r: any) => ({ id: r.id, code: r.code, kind: r.kind, kind_ar: KIND_AR[r.kind as keyof typeof KIND_AR] || r.kind, period_from: r.period_from, period_to: r.period_to, status: r.status, issued_at: r.issued_at, issued_name: r.issued_name, issued_title: r.issued_title, decision: r.decision || null, decision_at: r.decision_at || null, revoked_at: r.revoked_at || null, reissued_from: r.reissued_from ?? null, signed: !!r.body?.proof, digest: r.digest || null });

export async function GET(req: Request) {
  const u = new URL(req.url); const verify = u.searchParams.get('verify');
  if (verify) { const s = service(); if (!s) return bad('إعدادات الخادم غير مكتملة', 500); const rl = await rateLimit(s.db, `lrverify:${ipOf(req)}`, 60, 30); if (!rl.allowed) return tooMany(rl); return NextResponse.json({ success: true, ...(await verifyReport(s.db, verify)) }, { headers: { 'Cache-Control': 'public, max-age=60' } }); }
  const c = await ctx(req); if ('error' in c) return c.error;
  if (u.searchParams.get('mine')) { const l = await leadershipLineFor(c.db, c.user); return NextResponse.json({ success: true, line: l ? { ...l, text_ar: leadershipLineAr(l) } : null }, { headers: NO }); }
  const code = u.searchParams.get('code');
  if (code) { const row = await reportByCode(c.db, code); if (!row) return bad('التقرير غير موجود', 404); if (!(await canManage(c.db, row.organization_id, c.user, c.staff))) return bad('هذه الصفحة لمدير الجهة', 403);
    const org = await loadOrgLite(c.db, row.organization_id); return NextResponse.json({ success: true, report: { ...publicRow(row), body: row.body, logo: org?.logo || null }, site: siteUrl(req), decisions: DECISIONS }, { headers: NO }); }
  const orgId = String(u.searchParams.get('org') || ''); if (!orgId) return bad('حدّد الجهة');
  if (!(await canManage(c.db, orgId, c.user, c.staff))) return bad('هذه الصفحة لمدير الجهة', 403);
  const org = await loadOrgLite(c.db, orgId); if (!org) return bad('الجهة غير موجودة', 404);
  const [rows, suggested] = await Promise.all([listReports(c.db, orgId), suggestPeriod(c.db, orgId)]); const today = todayRiyadh();
  const presets = [suggested, { ...quarterOf(today), kind: 'quarter' as const, to: quarterOf(today).to < today ? quarterOf(today).to : today }, { ...quarterOf(today, -1), kind: 'quarter' as const }].filter((p, i, a) => a.findIndex((x) => x.from === p.from && x.to === p.to) === i);
  return NextResponse.json({ success: true, org: { id: org.id, name_ar: org.name_ar, slug: org.slug || null, has_logo: !!org.logo, pseudonymous: !!org.policy?.pseudonymous }, me: { name: c.user.name, staff: c.staff }, reports: rows.map(publicRow), presets, decisions: DECISIONS, site: siteUrl(req) }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const rl = await rateLimit(c.db, `lrpost:${c.user.id}`, 300, 20); if (!rl.allowed) return tooMany(rl);
  let b: any = {}; try { b = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const action = String(b.action || ''); const site = siteUrl(req); const by = { id: c.user.id, email: c.user.email, name: c.user.name };
  if (action === 'issue') {
    const orgId = String(b.org_id || ''); if (!orgId) return bad('حدّد الجهة'); if (!(await canManage(c.db, orgId, c.user, c.staff))) return bad('هذه الصفحة لمدير الجهة', 403);
    const r = await issueReport(c.db, { org_id: orgId, kind: b.kind, from: b.from, to: b.to, name: b.name || c.user.name, title: b.title, by, site });
    if (!r.ok) return bad(r.error, r.status || 400); return NextResponse.json({ success: true, report: { ...publicRow(r.row), body: r.row.body }, replaced: r.replaced, url: `${site}/org/report/${r.row.code}` }, { headers: NO });
  }
  if (action === 'decide' || action === 'revoke') {
    const row = await reportByCode(c.db, b.code); if (!row) return bad('التقرير غير موجود', 404); if (!(await canManage(c.db, row.organization_id, c.user, c.staff))) return bad('هذه الصفحة لمدير الجهة', 403);
    if (action === 'revoke') { const r = await revokeReport(c.db, b.code, by); return r.ok ? NextResponse.json({ success: true }, { headers: NO }) : bad(r.error || 'تعذّر الإلغاء'); }
    const r = await decideReport(c.db, { code: b.code, key: b.key, note_ar: b.note_ar, by, site }); if (!r.ok) return bad(r.error, r.status || 400);
    return NextResponse.json({ success: true, report: { ...publicRow(r.row), body: r.row.body } }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
