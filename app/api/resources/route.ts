// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/resources — تنزيل آمن وسجل أحداث التعلّم (بوابة أَثَر · P5)
 *  POST { action: 'download', resource_id, file_id }  → زائر أو مستخدم: قرار الوصول (RPC portal_resource_access) ⇒ رابط موقّع 120 ثانية + حدث downloaded + عدّادات
 *  POST { action: 'view', resource_id }                → زائر أو مستخدم: حدث viewed + عدّاد المشاهدات (مرة لكل جلسة من العميل)
 *  GET  ?resource_id=…                                 → حالة الوصول للمستخدم الحالي (ok|login|program|org|staff|not_found)
 * الهوية اختيارية (Authorization: Bearer <access_token>). الملفات لا تُقرأ إلا عبر هذا المسار.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'portal-resources';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  let user: { id: string; email: string } | null = null;
  if (token) {
    const uc = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data } = await uc.auth.getUser(token);
    if (data?.user) user = { id: data.user.id, email: String(data.user.email || '') };
  }
  if (!SERVICE) return { error: bad('مفتاح الخدمة غير مضبوط (SUPABASE_SERVICE_ROLE_KEY)', 500) };
  return { user, db: createClient(URL_, SERVICE) };
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
  try { return NextResponse.json({ success: true, state: await access(c.db, id, c.user?.id || null) }); } catch (e: any) { return bad(String(e?.message || e), 500); }
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

  if (action === 'download') {
    const fileId = String(body.file_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) return bad('معرّف الملف غير صالح');
    let state: string; try { state = await access(db, resourceId, user?.id || null); } catch (e: any) { return bad(String(e?.message || e), 500); }
    if (state !== 'ok') return NextResponse.json({ success: false, state, error: state === 'login' ? 'يرجى تسجيل الدخول' : state === 'not_found' ? 'المادة غير متاحة' : 'غير مصرّح بالوصول إلى هذه المادة' }, { status: state === 'not_found' ? 404 : 403 });
    const [{ data: f }, { data: r }] = await Promise.all([
      db.from('portal_resource_files').select('id,name,path,resource_id').eq('id', fileId).eq('resource_id', resourceId).maybeSingle(),
      db.from('portal_resources').select('id,skills,title_ar,program_id').eq('id', resourceId).maybeSingle(),
    ]);
    if (!f) return bad('الملف غير موجود', 404);
    const { data: s, error } = await db.storage.from(BUCKET).createSignedUrl((f as any).path, 120, { download: (f as any).name });
    if (error || !s?.signedUrl) return bad('تعذّر إنشاء رابط التنزيل: ' + (error?.message || ''), 500);
    await db.from('portal_learning_events').insert({ user_id: user?.id || null, email: user?.email || null, verb: 'downloaded', object_type: 'resource_file', object_id: fileId, skills: (r as any)?.skills || [], context: { resource_id: resourceId, file_name: (f as any).name, program_id: (r as any)?.program_id || null } });
    await db.rpc('portal_resource_bump', { p_resource: resourceId, p_file: fileId, p_kind: 'download' });
    return NextResponse.json({ success: true, url: s.signedUrl, name: (f as any).name });
  }

  return bad('إجراء غير معروف');
}
