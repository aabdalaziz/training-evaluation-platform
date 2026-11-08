// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/policy — P67 «سياسة الجهة»: مدير الجهة (أو الطاقم) يقرّر من /org → «السياسة والهوية»
 *  GET  ?verify=ATH-OP-XXXX-XXXX                 → عام: تحقّق من ختم سياسة (اسم الجهة · المفاتيح · البيان · سليم؟ · أحدث؟)
 *  GET  ?org=<id>            (مدير جهة/طاقم)     → السياسة · المُعرِّف · الأختام · ملخّص الأرقام · ★1 «كما يراني الزائر»
 *  POST { action:'save', org_id, policy }         → حفظ + ختم ATH-OP + حدث درع
 *  POST { action:'slug', org_id, slug }           → تعيين مُعرِّف الجهة (عنوان الباب /enter?o=)
 *  POST { action:'logo', org_id, logo|null }      → P68-ج: شعار الجهة المضمَّن (بطاقة الدعوة · تقرير القيادة)
 *  POST { action:'roster', org_id, text }         → إنشاء حسابات الأرقام — الأرقام السرية تُعاد مرّة واحدة (★3 لا تُخزَّن)
 *  POST { action:'codes', org_id }                → قائمة الأرقام (بلا أرقام سرية): دخل؟ غيّر رقمه؟ مقفول؟ موقوف؟
 *  POST { action:'reset_pin'|'revoke'|'restore', org_id, training_no }
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { savePolicy, listSeals, verifyOpSeal, visitorView, parseRoster, normalizePolicy, POLICY_KEYS } from '../../../../lib/org/policy';
import { orgById, setSlug, createCodes, listCodes, codesSummary, resetPin, revokeCode } from '../../../../lib/org/roster';
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
  const { data: prof } = await s.db.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { ...s, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() }, staff: WRITERS.includes(role) };
}
async function canManage(db: any, orgId: string, user: { id: string; email: string }, staff: boolean) {
  if (staff) return true;
  const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(1); return ((data || []) as any[]).length > 0;
}

export async function GET(req: Request) {
  const u = new URL(req.url); const verify = u.searchParams.get('verify');
  if (verify) { const s = service(); if (!s) return bad('إعدادات الخادم غير مكتملة', 500); const rl = await rateLimit(s.db, `opverify:${ipOf(req)}`, 60, 30); if (!rl.allowed) return tooMany(rl); return NextResponse.json({ success: true, ...(await verifyOpSeal(s.db, verify)) }, { headers: { 'Cache-Control': 'public, max-age=60' } }); }
  const c = await ctx(req); if ('error' in c) return c.error;
  const orgId = String(u.searchParams.get('org') || ''); if (!orgId) return bad('حدّد الجهة');
  if (!(await canManage(c.db, orgId, c.user, c.staff))) return bad('هذه الصفحة لمدير الجهة', 403);
  const org = await orgById(c.db, orgId); if (!org) return bad('الجهة غير موجودة', 404);
  const [seals, codes, visitor, logoRow] = await Promise.all([listSeals(c.db, orgId), listCodes(c.db, orgId), visitorView(c.db, orgId), c.db.from('portal_organizations').select('logo').eq('id', orgId).maybeSingle().then((r: any) => r?.data || null, () => null)]);
  return NextResponse.json({ success: true, org: { id: org.id, name_ar: org.name_ar, name_en: org.name_en, slug: org.slug, frozen: !!org.frozen, logo: (logoRow as any)?.logo || null }, policy: org.policy, keys: POLICY_KEYS, seals, codes: codesSummary(codes), visitor, staff: c.staff, enter_url: org.slug ? `${siteUrl(req)}/enter?o=${org.slug}` : null }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || ''); const orgId = String(body.org_id || ''); if (!orgId) return bad('حدّد الجهة');
  if (!(await canManage(c.db, orgId, c.user, c.staff))) return bad('هذا الإجراء لمدير الجهة', 403);
  const org = await orgById(c.db, orgId); if (!org) return bad('الجهة غير موجودة', 404);
  if (org.frozen && action !== 'codes') return NextResponse.json({ success: false, error: 'الجهة في وضع القراءة فقط مؤقتًا — لا تغيير للسياسة الآن' }, { status: 423, headers: NO });
  if (action === 'save') {
    const r = await savePolicy(c.db, { org_id: orgId, policy: normalizePolicy(body.policy), by: c.user, site: siteUrl(req) });
    return r.ok ? NextResponse.json({ success: true, policy: r.policy, changed: r.changed, seal: r.seal }, { headers: NO }) : bad(r.error || 'تعذّر الحفظ');
  }
  /* P68-ج: شعار الجهة — صورة صغيرة مضمَّنة (≤ 96 KB، PNG/JPEG/WebP/SVG) تظهر على بطاقة دعوة مِعيار وتقرير القيادة · null = إزالة */
  if (action === 'logo') { const logo = body.logo == null ? null : String(body.logo); if (logo !== null && !/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(logo)) return bad('الشعار يجب أن يكون صورة PNG/JPEG/WebP/SVG'); if (logo && logo.length > 131072) return bad('الشعار أكبر من 96 KB — صغّره أوّلًا');
    const { error } = await c.db.from('portal_organizations').update({ logo }).eq('id', orgId); return error ? bad(String(error.message || error).includes('logo') ? 'نفّذ p68-leadership-report.sql أوّلًا (عمود الشعار)' : String(error.message || error).slice(0, 160)) : NextResponse.json({ success: true, logo }, { headers: NO }); }
  if (action === 'slug') { const r = await setSlug(c.db, orgId, String(body.slug || '')); return r.ok ? NextResponse.json({ success: true, enter_url: `${siteUrl(req)}/enter?o=${String(body.slug).trim().toLowerCase()}` }, { headers: NO }) : bad(r.error || 'تعذّر'); }
  if (action === 'roster') {
    if (!org.policy.code_login) return bad('فعّل «الدخول بالرمز» واحفظ السياسة أولًا');
    const rl = await rateLimit(c.db, `roster:${orgId}`, 3600, 10); if (!rl.allowed) return tooMany(rl);
    const parsed = parseRoster(String(body.text || '')); if (!parsed.ok.length) return bad(parsed.bad.length ? `لا أرقام صالحة (مثال غير صالح: ${parsed.bad[0]})` : 'الصق الأرقام التدريبية — رقم في كل سطر');
    const r = await createCodes(c.db, { org, numbers: parsed.ok, by: c.user });
    return NextResponse.json({ success: true, ...r, bad: parsed.bad, enter_url: `${siteUrl(req)}/enter?o=${org.slug}` }, { headers: NO });
  }
  if (action === 'codes') { const rows = await listCodes(c.db, orgId); return NextResponse.json({ success: true, rows: rows.map(r => ({ training_no: r.training_no, created_at: r.created_at, first_login_at: r.first_login_at, last_login_at: r.last_login_at, pin_changed: r.pin_changed, locked: !!(r.locked_until && new Date(r.locked_until).getTime() > Date.now()), revoked: !!r.revoked_at })), summary: codesSummary(rows) }, { headers: NO }); }
  if (action === 'reset_pin') { const r = await resetPin(c.db, { org, training_no: String(body.training_no || ''), by: c.user }); return r.ok ? NextResponse.json({ success: true, pin: r.pin }, { headers: NO }) : bad(r.error || 'تعذّر'); }
  if (action === 'revoke' || action === 'restore') { const r = await revokeCode(c.db, { org, training_no: String(body.training_no || ''), by: c.user, restore: action === 'restore' }); return r.ok ? NextResponse.json({ success: true }, { headers: NO }) : bad(r.error || 'تعذّر'); }
  return bad('إجراء غير معروف');
}
