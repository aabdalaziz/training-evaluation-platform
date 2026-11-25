// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/**
 * /api/gate — الواجهة العامة لـ«تصاريح الدخول» (P79)
 *  GET  ?product=iqra                     → حالة المنتج + هل التجربة متاحة على هذا الجهاز + ما تفتحه كعكتك الحالية
 *  POST { action:'request', product, name, email, phone?, org?, purpose?, lang? } → تسجيل طلب + إشعار الطاقم بالبريد (حدّ: 5/ساعة لكلّ IP)
 *  POST { action:'trial', product }       → تبدأ التجربة (دقيقتان افتراضيًا) مرّة واحدة لكلّ جهاز؛ تعيد نهاية التجربة ومسار البدء
 *  POST { action:'redeem', code }         → رمز تصريح → كعكة athar_gate لصاحب الرمز (يزيد uses)
 *  POST { action:'unlock' } + Bearer      → الطاقم: كعكة '*' ثلاثين يومًا · غيرهم: التصاريح النشطة على بريدهم
 *  الكعكات تُضبط هنا فقط؛ الوسيط يقرأها ولا يكتبها (عدا مسح التجربة المنتهية).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson, honeypotTripped, crossSiteBrowserWrite } from '../../../lib/shield/body';
import { rateLimit, ipOf } from '../../../lib/shield/ratelimit';
import { sendEmailRaw } from '../../../lib/portal/notify';
import { normalizeSite } from '../../../lib/portal/open';
import { DEFAULT_PRODUCTS, GATE_COOKIE, TRIAL_COOKIE, TRIAL_DONE_COOKIE, STAFF_DAYS, buildStaffNotice, canTrial, cookieAttrs, covers, findProduct, isCode, isSlug, normalizeCode, parseTrialDone, payloadForPermits, signGate, validateRequest, verifyGate, type GateProduct, type GatePayload } from '../../../lib/portal/gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const env = () => process.env as Record<string, string | undefined>;
const secure = (req: Request) => !/^http:\/\/(localhost|127\.)/.test(new URL(req.url).origin);
const cookieOf = (req: Request, name: string): string | null => { const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)); return m ? decodeURIComponent(m[1]) : null; };

function db() { const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; return URL_ && SERVICE ? createClient(URL_, SERVICE, { auth: { persistSession: false } }) : null; }
async function productsOf(d: any): Promise<GateProduct[]> { if (!d) return DEFAULT_PRODUCTS; const { data } = await d.from('portal_gate_products').select('*').order('sort'); return Array.isArray(data) && data.length ? (data as GateProduct[]) : DEFAULT_PRODUCTS; }
async function userOf(req: Request): Promise<{ id: string; email: string; role: string } | null> {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!URL_ || !ANON || !token) return null;
  const u = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await u.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await u.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role: String((prof as any)?.role || '').toUpperCase() };
}
function withCookie(json: any, req: Request, name: string, value: string, maxAgeS: number, httpOnly = true) {
  const res = NextResponse.json(json); res.headers.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; ${cookieAttrs(maxAgeS, httpOnly, secure(req))}`); return res;
}

export async function GET(req: Request) {
  const u = new URL(req.url); const slug = String(u.searchParams.get('product') || '').toLowerCase(); if (!isSlug(slug)) return bad('المنتج غير معروف');
  const d = db(); const product = findProduct(slug, await productsOf(d)); if (!product) return bad('المنتج غير معروف', 404);
  const gate = await verifyGate(cookieOf(req, GATE_COOKIE), env()); const trial = await verifyGate(cookieOf(req, TRIAL_COOKIE), env());
  const done = parseTrialDone(cookieOf(req, TRIAL_DONE_COOKIE));
  const res = NextResponse.json({ success: true, product: { slug: product.slug, name_ar: product.name_ar, name_en: product.name_en, mode: product.mode, trial_seconds: product.trial_seconds, entry_path: product.entry_path, message_ar: product.message_ar }, unlocked: covers(gate, slug), via: gate?.k || null, trial_active: covers(trial, slug) ? trial!.e : null, trial_available: canTrial(product, done) });
  res.headers.set('Cache-Control', 'no-store'); return res;
}

export async function POST(req: Request) {
  if (crossSiteBrowserWrite(req)) return bad('طلب من موقع آخر مرفوض', 403);
  const rj = await readJson(req); if (!rj.ok) return bad(rj.error, rj.status); const body = rj.body || {}; const action = String(body.action || '');
  const d = db(); const list = await productsOf(d); const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);

  if (action === 'request') {
    if (honeypotTripped(body)) return NextResponse.json({ success: true, state: 'received' }); // مصيدة الروبوتات: نجيب بهدوء
    const v = validateRequest(body); if (!v.ok) return bad(v.error);
    const product = findProduct(v.value.product, list); if (!product) return bad('المنتج غير معروف', 404);
    const rl = await rateLimit(d, `gate_request:ip:${ipOf(req)}`, 3600, 5); if (!rl.allowed) return bad('محاولات كثيرة — حاول بعد قليل', 429);
    if (!d) return bad('إعدادات الخادم غير مكتملة', 500);
    const { data: dup } = await d.from('portal_gate_requests').select('id, status, created_at').eq('product', product.slug).ilike('email', v.value.email).eq('status', 'pending').gte('created_at', new Date(Date.now() - 7 * 86400e3).toISOString()).limit(1);
    if (Array.isArray(dup) && dup.length) return NextResponse.json({ success: true, state: 'already' });
    const ipHash = await (async () => { const b = new TextEncoder().encode('gate:' + ipOf(req)); const h = await crypto.subtle.digest('SHA-256', b); return Array.from(new Uint8Array(h)).slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join(''); })();
    const { error } = await d.from('portal_gate_requests').insert({ product: product.slug, name: v.value.name, email: v.value.email, phone: v.value.phone, org: v.value.org, purpose: v.value.purpose, lang: v.value.lang, ip_hash: ipHash });
    if (error) return bad('تعذّر حفظ الطلب — حاول مرة أخرى', 500);
    try { const to = String(process.env.GATE_NOTIFY_EMAIL || 'info@athar-portal.com').split(/[,;\s]+/).filter(Boolean); const m = buildStaffNotice({ req: v.value, product, adminUrl: `${site}/admin/gate` }); await sendEmailRaw({ to, subject: m.subject, html: m.html, replyTo: v.value.email, tags: [{ name: 'kind', value: 'gate_request' }] }); } catch { /* الطلب محفوظ؛ الإشعار ثانوي */ }
    return NextResponse.json({ success: true, state: 'received' });
  }

  if (action === 'trial') {
    const slug = String(body.product || '').toLowerCase(); const product = isSlug(slug) ? findProduct(slug, list) : null; if (!product) return bad('المنتج غير معروف', 404);
    const done = parseTrialDone(cookieOf(req, TRIAL_DONE_COOKIE)); if (!canTrial(product, done)) return bad('التجربة غير متاحة على هذا الجهاز — اطلب تصريحًا', 403);
    const nowS = Math.floor(Date.now() / 1000); const payload: GatePayload = { v: 1, k: 'trial', p: [slug], e: nowS + product.trial_seconds };
    const token = await signGate(payload, env()); const res = NextResponse.json({ success: true, ends_at: payload.e, start_path: product.trial_path || product.entry_path, seconds: product.trial_seconds });
    res.headers.append('Set-Cookie', `${TRIAL_COOKIE}=${encodeURIComponent(token)}; ${cookieAttrs(product.trial_seconds + 5, false, secure(req))}`);
    res.headers.append('Set-Cookie', `${TRIAL_DONE_COOKIE}=${encodeURIComponent([...done, slug].join(','))}; ${cookieAttrs(365 * 86400, true, secure(req))}`);
    return res;
  }

  if (action === 'redeem') {
    const code = normalizeCode(body.code); if (!isCode(code)) return bad('الرمز غير صالح — 10 أحرف/أرقام');
    const rl = await rateLimit(d, `gate_redeem:ip:${ipOf(req)}`, 600, 20); if (!rl.allowed) return bad('محاولات كثيرة — حاول بعد قليل', 429);
    if (!d) return bad('إعدادات الخادم غير مكتملة', 500);
    const { data: p } = await d.from('portal_gate_permits').select('id, code, product, email, expires_at, revoked_at, uses').eq('code', code).maybeSingle();
    if (!p) return bad('لا يوجد تصريح بهذا الرمز', 404);
    const payload = payloadForPermits([p as any], String((p as any).email)); if (!payload) return bad((p as any).revoked_at ? 'هذا التصريح أُلغي' : 'انتهت صلاحية هذا التصريح', 410);
    const existing = await verifyGate(cookieOf(req, GATE_COOKIE), env()); if (existing && existing.k === 'permit') payload.p = Array.from(new Set([...existing.p, ...payload.p])); // دمج تصاريح متعدّدة على الجهاز نفسه
    await d.from('portal_gate_permits').update({ uses: Number((p as any).uses || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', (p as any).id);
    const product = findProduct(String((p as any).product), list);
    return withCookie({ success: true, product: (p as any).product, entry_path: product?.entry_path || '/', expires_at: (p as any).expires_at }, req, GATE_COOKIE, await signGate(payload, env()), payload.e - Math.floor(Date.now() / 1000));
  }

  if (action === 'unlock') {
    const user = await userOf(req); if (!user) return bad('يلزم تسجيل الدخول', 401);
    const nowS = Math.floor(Date.now() / 1000);
    if (STAFF.includes(user.role)) { const payload: GatePayload = { v: 1, k: 'staff', p: ['*'], e: nowS + STAFF_DAYS * 86400, m: user.email }; return withCookie({ success: true, via: 'staff', products: ['*'] }, req, GATE_COOKIE, await signGate(payload, env()), STAFF_DAYS * 86400); }
    if (!d) return bad('إعدادات الخادم غير مكتملة', 500);
    const { data: ps } = await d.from('portal_gate_permits').select('product, expires_at, revoked_at').ilike('email', user.email).limit(50);
    const payload = payloadForPermits((ps || []) as any[], user.email); if (!payload) return NextResponse.json({ success: true, via: null, products: [] });
    return withCookie({ success: true, via: 'permit', products: payload.p }, req, GATE_COOKIE, await signGate(payload, env()), payload.e - nowS);
  }
  return bad('إجراء غير معروف');
}
