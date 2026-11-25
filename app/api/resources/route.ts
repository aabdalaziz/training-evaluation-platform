// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/resources — تنزيل آمن وسجل أحداث التعلّم (بوّابة أَثَر · P5)
 *  POST { action: 'download', resource_id, file_id }  → زائر أو مستخدم: قرار الوصول (RPC portal_resource_access) ⇒ رابط موقّع 120 ثانية + حدث downloaded + عدّادات
 *  POST { action: 'view', resource_id }                → زائر أو مستخدم: حدث viewed + عدّاد المشاهدات (مرة لكل جلسة من العميل)
 *  POST { action: 'buy', resource_id }                 → مستخدم: فاتورة ترخيص الحقيبة (RPC portal_issue_resource_invoice بجلسة المستخدم) ⇒ { invoice_id, pay_url }  (P5-ب)
 *  POST { action: 'deliver', resource_id, grant_id? }   → إرسال ملفّات الحقيبة إلى بريد صاحب الترخيص: الطاقم لأيّ ترخيص (grant_id)، أو صاحب الترخيص لنفسه (مرّة كلّ ساعة)  (P5-ب)
 *  قاعدة التنزيل من الموقع للحقائب المرخَّصة: مرّة واحدة لكلّ ملفّ لكلّ ترخيص (portal_resource_grants.downloads/download_limit) — الطاقم بلا حدّ.
 *  GET  ?resource_id=…                                 → حالة الوصول للمستخدم الحالي (ok|login|purchase|program|org|staff|not_found) + السعر + الفاتورة المعلّقة إن وُجدت
 * الهوية اختيارية (Authorization: Bearer <access_token>). الملفات لا تُقرأ إلا عبر هذا المسار — ولا رابط موقّعًا قبل قرار 'ok'.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rpcErrAr } from '../../../lib/portal/resources';
import { deliverResourceFiles } from '../../../lib/portal/resource-delivery';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'];
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
async function roleOf(db: any, userId: string): Promise<string> { const { data } = await db.from('profiles').select('role').eq('id', userId).maybeSingle(); return String((data as any)?.role || '').toUpperCase(); }
async function grantOf(db: any, resourceId: string, user: { id: string; email: string }): Promise<any | null> { const { data } = await db.from('portal_resource_grants').select('*').eq('resource_id', resourceId).or(`user_id.eq.${user.id},email.ilike.${user.email.replace(/[,()]/g, '')}`).limit(1); return (data && data[0]) || null; }

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'portal-resources';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  let user: { id: string; email: string } | null = null; let userDb: any = null;
  if (token) {
    const uc = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data } = await uc.auth.getUser(token);
    if (data?.user) { user = { id: data.user.id, email: String(data.user.email || '') }; userDb = uc; }
  }
  if (!SERVICE) return { error: bad('مفتاح الخدمة غير مضبوط (SUPABASE_SERVICE_ROLE_KEY)', 500) };
  return { user, userDb, db: createClient(URL_, SERVICE) };
}

async function access(db: any, resourceId: string, userId: string | null): Promise<string> {
  const { data, error } = await db.rpc('portal_resource_access', { p_resource: resourceId, p_user: userId });
  if (error) throw new Error(error.message);
  return String(data || 'not_found');
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const id = new URL(req.url).searchParams.get('resource_id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return bad('معرّف غير صالح');
  try {
    const state = await access(c.db, id, c.user?.id || null);
    let pending_invoice_id: string | null = null;
    if (state === 'purchase' && c.user) { const { data } = await c.db.from('portal_invoices').select('id').eq('user_id', c.user.id).eq('resource_id', id).in('status', ['unpaid', 'under_review']).order('created_at', { ascending: false }).limit(1); pending_invoice_id = (data?.[0] as any)?.id || null; }
    let grant: any = null; if (state === 'ok' && c.user) { const g = await grantOf(c.db, id, c.user); if (g) grant = { id: g.id, downloads: g.downloads || {}, download_limit: g.download_limit ?? 1, delivered_at: g.delivered_at || null, email: g.email }; }
    return NextResponse.json({ success: true, state, pending_invoice_id, grant });
  } catch (e: any) { return bad(String(e?.message || e), 500); }
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || ''); const resourceId = String(body.resource_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(resourceId)) return bad('معرّف المادة غير صالح');
  const { db, user } = c;

  if (action === 'view') {
    const { data: r } = await db.from('portal_resources').select('id,skills,status').eq('id', resourceId).maybeSingle();
    if (!r || (r as any).status !== 'published') return bad('المادة غير متاحة', 404);
    await db.from('portal_learning_events').insert({ user_id: user?.id || null, email: user?.email || null, verb: 'viewed', object_type: 'resource', object_id: resourceId, skills: (r as any).skills || [], context: { resource_id: resourceId } });
    await db.rpc('portal_resource_bump', { p_resource: resourceId, p_file: null, p_kind: 'view' });
    return NextResponse.json({ success: true });
  }

  if (action === 'buy') {
    if (!user || !c.userDb) return NextResponse.json({ success: false, state: 'login', error: 'يرجى تسجيل الدخول أولًا' }, { status: 401 });
    const { data, error } = await c.userDb.rpc('portal_issue_resource_invoice', { p_resource: resourceId });
    if (error) { const m = String(error.message || ''); const already = m.includes('already_granted'); return NextResponse.json({ success: false, state: already ? 'ok' : undefined, error: rpcErrAr(m) }, { status: already ? 409 : 400 }); }
    await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'requested_licence', object_type: 'resource', object_id: resourceId, skills: [], context: { resource_id: resourceId, invoice_id: data } }).then(() => null, () => null);
    return NextResponse.json({ success: true, invoice_id: data, pay_url: `/pay/${data}` });
  }

  if (action === 'deliver') {
    if (!user) return NextResponse.json({ success: false, state: 'login', error: 'يرجى تسجيل الدخول أولًا' }, { status: 401 });
    const staff = STAFF.includes(await roleOf(db, user.id)); const grantId = String(body.grant_id || '');
    let g: any = null;
    if (staff && /^[0-9a-f-]{36}$/i.test(grantId)) { const { data } = await db.from('portal_resource_grants').select('*').eq('id', grantId).maybeSingle(); g = data; }
    else { g = await grantOf(db, resourceId, user); if (g && g.delivered_at && Date.now() - Date.parse(g.delivered_at) < 3600e3) return bad('أُرسلت الملفّات قبل أقلّ من ساعة — تحقّق من صندوق الوارد والرسائل غير المرغوبة', 429); }
    if (!g) return bad('لا ترخيص لهذه الحقيبة', 403);
    const r = await deliverResourceFiles(db, { grantId: g.id }, siteUrl(req), { force: true });
    if (!r.sent) return bad(r.error || r.skipped || 'تعذّر الإرسال', 500);
    return NextResponse.json({ success: true, ...r, email: g.email });
  }

  if (action === 'download') {
    const fileId = String(body.file_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) return bad('معرّف الملف غير صالح');
    let state: string; try { state = await access(db, resourceId, user?.id || null); } catch (e: any) { return bad(String(e?.message || e), 500); }
    if (state !== 'ok') return NextResponse.json({ success: false, state, error: state === 'login' ? 'يرجى تسجيل الدخول' : state === 'not_found' ? 'المادة غير متاحة' : state === 'purchase' ? 'التنزيل بعد شراء الترخيص' : 'غير مصرّح بالوصول إلى هذه المادة' }, { status: state === 'not_found' ? 404 : 403 });
    const [{ data: f }, { data: r }] = await Promise.all([
      db.from('portal_resource_files').select('id,name,path,resource_id').eq('id', fileId).eq('resource_id', resourceId).maybeSingle(),
      db.from('portal_resources').select('id,skills,title_ar,program_id').eq('id', resourceId).maybeSingle(),
    ]);
    if (!f) return bad('الملف غير موجود', 404);
    /* P5-ب: الحقيبة المرخَّصة — مرّة واحدة لكلّ ملفّ لكلّ ترخيص (الطاقم مستثنى) */
    const { data: rr } = await db.from('portal_resources').select('access').eq('id', resourceId).maybeSingle();
    if ((rr as any)?.access === 'paid' && user) {
      const staff = STAFF.includes(await roleOf(db, user.id));
      if (!staff) {
        const g = await grantOf(db, resourceId, user); if (!g) return NextResponse.json({ success: false, state: 'purchase', error: 'لا ترخيص لهذه الحقيبة' }, { status: 403 });
        const used = Number((g.downloads || {})[fileId] || 0); const limit = Number(g.download_limit ?? 1);
        if (used >= limit) return NextResponse.json({ success: false, state: 'ok', exhausted: true, error: 'استُنفدت مرّة التنزيل لهذا الملفّ من الموقع — الملفّات في بريدك، أو اطلب «أعد إرسال الملفّات إلى بريدي».' }, { status: 403 });
        await db.from('portal_resource_grants').update({ downloads: { ...(g.downloads || {}), [fileId]: used + 1 } }).eq('id', g.id);
      }
    }
    const { data: s, error } = await db.storage.from(BUCKET).createSignedUrl((f as any).path, 120, { download: (f as any).name });
    if (error || !s?.signedUrl) return bad('تعذّر إنشاء رابط التنزيل: ' + (error?.message || ''), 500);
    await db.from('portal_learning_events').insert({ user_id: user?.id || null, email: user?.email || null, verb: 'downloaded', object_type: 'resource_file', object_id: fileId, skills: (r as any)?.skills || [], context: { resource_id: resourceId, file_name: (f as any).name, program_id: (r as any)?.program_id || null } });
    await db.rpc('portal_resource_bump', { p_resource: resourceId, p_file: fileId, p_kind: 'download' });
    return NextResponse.json({ success: true, url: s.signedUrl, name: (f as any).name });
  }

  return bad('إجراء غير معروف');
}
