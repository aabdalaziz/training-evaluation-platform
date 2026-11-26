// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/**
 * /api/admin/gate — إدارة «تصاريح الدخول» (للطاقم: المالك ومديرو النظام)
 *  GET                                   → المنتجات + الطلبات (آخر 200) + التصاريح (آخر 200) + عدّادات
 *  POST { action:'approve', id, days?, note? }                 → يوافق على طلب: يُنشئ تصريحًا ويُرسل بريد الرابط
 *  POST { action:'reject', id, note?, mail?:boolean }          → يرفض (ببريد مهذّب اختياري)
 *  POST { action:'permit_create', product, email, name?, days? } → تصريح يدوي + بريد
 *  POST { action:'permit_resend', id }                         → إعادة إرسال بريد التصريح
 *  POST { action:'revoke', id }                                → إلغاء تصريح (الكعكات القائمة تنتهي بانتهائها — ≤30 يومًا)
 *  POST { action:'product_set', slug, mode?, trial_seconds?, message_ar? } → تبديل حالة الباب بلا نشر (الحافة تلتقطه خلال دقيقة)
 *  days: 0/null = حتى إشعار آخر. كلّ قرار يُسجَّل في audit_logs (source gate).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { requireMfa } from '../../../../lib/shield/mfa'; /* P80 */
import { normalizeSite } from '../../../../lib/portal/open';
import { sendEmailRaw } from '../../../../lib/portal/notify';
import { DEFAULT_PRODUCTS, PERMIT_DAYS_DEFAULT, buildPermitMail, buildRejectMail, findProduct, isSlug, permitCode, permitExpiry, type GateProduct } from '../../../../lib/portal/gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للمالك ومديري النظام', 403) };
  const mfa = await requireMfa(userDb, token, role); if (!mfa.ok) return { error: NextResponse.json({ success: false, error: mfa.error, code: mfa.code }, { status: mfa.status }) }; /* P80 */
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role } };
}
async function productsOf(db: any): Promise<GateProduct[]> { const { data } = await db.from('portal_gate_products').select('*').order('sort'); return Array.isArray(data) && data.length ? (data as GateProduct[]) : DEFAULT_PRODUCTS; }
async function audit(db: any, user: { id: string; email: string }, action: string, details: any) { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, action, entity_type: 'gate', entity_id: String(details.permit_id || details.request_id || details.slug || ''), source: 'gate', metadata: details }); } catch { /* السجلّ ثانوي */ } }
async function mailPermit(db: any, site: string, permit: any, product: GateProduct) {
  const m = buildPermitMail({ name: permit.name || null, product, code: permit.code, url: `${site}/gate/p/${permit.code}`, expires_at: permit.expires_at || null });
  try { await sendEmailRaw({ to: [permit.email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'gate_permit' }] }); return { ok: true, error: null as string | null }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
async function createPermit(db: any, p: { product: string; email: string; name: string | null; days: number | null; request_id: string | null; by: string }) {
  for (let i = 0; i < 4; i++) { const code = permitCode(); const row = { code, product: p.product, email: p.email.toLowerCase(), name: p.name, request_id: p.request_id, expires_at: permitExpiry(p.days), created_by: p.by };
    const r = await db.from('portal_gate_permits').insert(row).select('*').single(); if (!r.error) return r.data; if (!/duplicate|unique/i.test(String(r.error.message))) throw new Error(r.error.message); }
  throw new Error('تعذّر توليد رمز فريد');
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c;
  const [products, reqs, permits] = await Promise.all([productsOf(db), db.from('portal_gate_requests').select('*').order('created_at', { ascending: false }).limit(200), db.from('portal_gate_permits').select('*').order('created_at', { ascending: false }).limit(200)]);
  const requests = (reqs.data || []) as any[]; const perms = (permits.data || []) as any[]; const now = Date.now();
  const counts = { pending: requests.filter((r) => r.status === 'pending').length, active: perms.filter((p) => !p.revoked_at && (!p.expires_at || new Date(p.expires_at).getTime() > now)).length };
  return NextResponse.json({ success: true, products, requests, permits: perms, counts, notify_to: process.env.GATE_NOTIFY_EMAIL || 'info@athar-portal.com' });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const site = siteOf(req);
  const rj = await readJson(req, { maxBytes: 1024 * 1024 }); if (!rj.ok) return bad(rj.error, rj.status); const b = rj.body || {}; const action = String(b.action || '');
  const list = await productsOf(db);
  const days = b.days === undefined ? PERMIT_DAYS_DEFAULT : Number(b.days) > 0 ? Math.min(Number(b.days), 3650) : null;

  if (action === 'approve') {
    const id = String(b.id || ''); const { data: r } = await db.from('portal_gate_requests').select('*').eq('id', id).maybeSingle(); if (!r) return bad('الطلب غير موجود', 404);
    if ((r as any).status === 'approved') return bad('هذا الطلب معتمد مسبقًا');
    const product = findProduct((r as any).product, list); if (!product) return bad('المنتج غير معروف');
    const permit = await createPermit(db, { product: product.slug, email: (r as any).email, name: (r as any).name, days, request_id: id, by: user.email });
    await db.from('portal_gate_requests').update({ status: 'approved', note: b.note ? String(b.note).slice(0, 400) : (r as any).note, permit_id: permit.id, decided_at: new Date().toISOString(), decided_by: user.email }).eq('id', id);
    const mail = await mailPermit(db, site, permit, product); await audit(db, user, 'gate_approve', { request_id: id, permit_id: permit.id, product: product.slug, email: permit.email, days, mailed: mail.ok });
    return NextResponse.json({ success: true, permit, mail });
  }
  if (action === 'reject') {
    const id = String(b.id || ''); const { data: r } = await db.from('portal_gate_requests').select('*').eq('id', id).maybeSingle(); if (!r) return bad('الطلب غير موجود', 404);
    const note = b.note ? String(b.note).slice(0, 400) : null;
    await db.from('portal_gate_requests').update({ status: 'rejected', note, decided_at: new Date().toISOString(), decided_by: user.email }).eq('id', id);
    let mail: { ok: boolean; error: string | null } = { ok: false, error: null };
    if (b.mail) { const product = findProduct((r as any).product, list)!; const m = buildRejectMail({ name: (r as any).name, product, note }); try { await sendEmailRaw({ to: [(r as any).email], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'gate_reject' }] }); mail = { ok: true, error: null }; } catch (e: any) { mail = { ok: false, error: String(e?.message || e) }; } }
    await audit(db, user, 'gate_reject', { request_id: id, product: (r as any).product, email: (r as any).email, note, mailed: mail.ok });
    return NextResponse.json({ success: true, mail });
  }
  if (action === 'permit_create') {
    const slug = String(b.product || '').toLowerCase(); const product = isSlug(slug) ? findProduct(slug, list) : null; if (!product) return bad('المنتج غير معروف');
    const email = String(b.email || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad('البريد غير صالح');
    const permit = await createPermit(db, { product: product.slug, email, name: b.name ? String(b.name).slice(0, 80) : null, days, request_id: null, by: user.email });
    const mail = b.mail === false ? { ok: false, error: null } : await mailPermit(db, site, permit, product); await audit(db, user, 'gate_permit_create', { permit_id: permit.id, product: product.slug, email, days, mailed: mail.ok });
    return NextResponse.json({ success: true, permit, mail, url: `${site}/gate/p/${permit.code}` });
  }
  if (action === 'permit_resend') {
    const { data: p } = await db.from('portal_gate_permits').select('*').eq('id', String(b.id || '')).maybeSingle(); if (!p) return bad('التصريح غير موجود', 404); if ((p as any).revoked_at) return bad('التصريح مُلغى');
    const product = findProduct((p as any).product, list)!; const mail = await mailPermit(db, site, p, product); await audit(db, user, 'gate_permit_resend', { permit_id: (p as any).id, mailed: mail.ok });
    return NextResponse.json({ success: true, mail });
  }
  if (action === 'revoke') {
    const id = String(b.id || ''); const r = await db.from('portal_gate_permits').update({ revoked_at: new Date().toISOString() }).eq('id', id).is('revoked_at', null).select('id, product, email').maybeSingle();
    if (!r.data) return bad('التصريح غير موجود أو مُلغى'); await audit(db, user, 'gate_revoke', { permit_id: id, ...r.data }); return NextResponse.json({ success: true });
  }
  if (action === 'product_set') {
    const slug = String(b.slug || '').toLowerCase(); if (!isSlug(slug) || !findProduct(slug, list)) return bad('المنتج غير معروف');
    const patch: any = { updated_at: new Date().toISOString(), updated_by: user.email };
    if (b.mode !== undefined) { if (!['open', 'permit', 'closed'].includes(String(b.mode))) return bad('الحالة غير صالحة'); patch.mode = String(b.mode); }
    if (b.trial_seconds !== undefined) { const t = Math.round(Number(b.trial_seconds)); if (!Number.isFinite(t) || t < 0 || t > 3600) return bad('مدّة التجربة بين 0 و3600 ثانية'); patch.trial_seconds = t; }
    if (b.message_ar !== undefined) patch.message_ar = String(b.message_ar || '').trim().slice(0, 600) || null;
    const r = await db.from('portal_gate_products').update(patch).eq('slug', slug).select('*').maybeSingle(); if (r.error || !r.data) return bad('تعذّر الحفظ — شغّل ترحيل P79 أولًا', 500);
    await audit(db, user, 'gate_product_set', { slug, ...patch }); return NextResponse.json({ success: true, product: r.data });
  }
  return bad('إجراء غير معروف');
}
