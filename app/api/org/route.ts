// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org — بوابة الجهات (بوابة أَثَر · P8-ب)
 *  POST { action: 'me' }                                        → مستخدم: انضمام تلقائي بنطاق البريد (بانتظار التأكيد) + جهاتي وأدواري
 *  POST { action: 'dashboard', org_id }                          → مدير جهة/موظف: لوحة الأثر (RPC)
 *  POST { action: 'member_status', member_id, status }           → مدير جهة/موظف: تأكيد/رفض عضو
 *  POST { action: 'invite', org_id, people:[{email,full_name}], role? } → مدير جهة/موظف: دعوة أعضاء (مؤكدون) + بريد
 *  POST { action: 'bulk', org_id, program_id, people, note? }    → مدير جهة/موظف: طلب تسجيل جماعي + تسجيلات مسبقة (pending) + تنبيه الإدارة
 *  POST { action: 'set_admin', org_id, email, full_name? }       → موظف: تعيين مدير جهة (أو ترقية عضو)
 *  POST { action: 'request_status', id, status, internal_notes? } → موظف: تحديث حالة طلب جماعي
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from '../../../lib/email/resend';
import { parsePeople, validateBulk } from '../../../lib/portal/org';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const STAFF = [...WRITERS, 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');
const admins = () => String(process.env.NOTIFY_EMAILS || '').split(/[,;\s]+/).filter(Boolean);
async function mail(fn: () => Promise<any>): Promise<string | null> { try { await fn(); return null; } catch (e: any) { return String(e?.message || e); } }
const shell = (title: string, body: string) => `<div dir="rtl" style="font-family:Tahoma,Arial;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><div style="background:#0f2a4e;color:#fff;padding:18px 22px"><div style="color:#c9a24b;font-size:12px;font-weight:bold">أَثَر — بوابة الجهات</div><div style="font-size:18px;font-weight:bold;margin-top:4px">${title}</div></div><div style="padding:20px 22px;font-size:14px;line-height:1.9;color:#0f172a">${body}</div><div style="padding:12px 22px;background:#f8fafc;color:#64748b;font-size:11.5px">© 2026 د. أحمد محمد عبدالعزيز بدوي — أَثَر</div></div>`;

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') }, staff: STAFF.includes(role), writer: WRITERS.includes(role), db: createClient(URL_, SERVICE), userDb };
}
async function isOrgAdmin(db: any, orgId: string, user: { id: string; email: string }) {
  const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(1); return ((data || []) as any[]).length > 0;
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, userDb, user } = c; const site = siteUrl(req);
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');

  if (action === 'me') {
    try { await db.rpc('portal_org_autojoin', { p_user: user.id, p_email: user.email }); } catch { /* تجاهل */ }
    const { data: ms } = await db.from('portal_org_members').select('id,organization_id,role,status,source,created_at').or(`user_id.eq.${user.id},email.ilike.${user.email}`);
    const ids = Array.from(new Set(((ms || []) as any[]).map(m => m.organization_id)));
    const { data: orgs } = ids.length ? await db.from('portal_organizations').select('id,name_ar,name_en,sector,email_domain,city').in('id', ids) : { data: [] as any[] };
    const { data: staffOrgs } = c.staff ? await db.from('portal_organizations').select('id,name_ar,name_en,sector,email_domain,city').eq('active', true).order('name_ar') : { data: [] as any[] };
    return NextResponse.json({ success: true, staff: c.staff, memberships: ms || [], orgs: orgs || [], all_orgs: staffOrgs || [] });
  }

  const orgId = String(body.org_id || '');
  const needsOrgAdmin = async () => c.staff || (orgId && await isOrgAdmin(db, orgId, user));

  if (action === 'dashboard') {
    if (!orgId) return bad('معرّف الجهة مطلوب'); if (!(await needsOrgAdmin())) return bad('غير مصرّح — أنت لست مدير هذه الجهة', 403);
    const { data, error } = await db.rpc('portal_org_dashboard', { p_org: orgId }); // بصلاحية الخدمة بعد التحقق أعلاه
    if (error) return bad(error.message, 500); return NextResponse.json({ success: true, dashboard: data });
  }
  if (action === 'member_status') {
    const { data: m } = await db.from('portal_org_members').select('id,organization_id,email,status').eq('id', String(body.member_id || '')).maybeSingle(); if (!m) return bad('العضو غير موجود', 404);
    if (!(c.staff || await isOrgAdmin(db, (m as any).organization_id, user))) return bad('غير مصرّح', 403);
    const status = String(body.status || ''); if (!['confirmed', 'rejected', 'pending'].includes(status)) return bad('حالة غير صالحة');
    const { error } = await db.from('portal_org_members').update({ status, confirmed_by: status === 'confirmed' ? user.id : null, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null }).eq('id', (m as any).id); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true });
  }
  if (action === 'invite') {
    if (!orgId) return bad('معرّف الجهة مطلوب'); if (!(await needsOrgAdmin())) return bad('غير مصرّح', 403);
    const people = parsePeople(Array.isArray(body.people) ? body.people.map((p: any) => `${p.full_name || ''} <${p.email}>`).join('\n') : String(body.people || '')); if (!people.length) return bad('أدخل بريدًا صالحًا واحدًا على الأقل');
    const role = body.role === 'org_admin' && c.staff ? 'org_admin' : 'learner';
    const { data: org } = await db.from('portal_organizations').select('name_ar').eq('id', orgId).maybeSingle();
    let added = 0, updated = 0; const errors: string[] = [];
    for (const p of people) {
      const { data: ex } = await db.from('portal_org_members').select('id,status').eq('organization_id', orgId).ilike('email', p.email).maybeSingle();
      if (ex) { if ((ex as any).status !== 'confirmed') { await db.from('portal_org_members').update({ status: 'confirmed', source: 'invite', confirmed_by: user.id, confirmed_at: new Date().toISOString(), full_name: p.full_name || null }).eq('id', (ex as any).id); updated++; } continue; }
      const { error } = await db.from('portal_org_members').insert({ organization_id: orgId, email: p.email, full_name: p.full_name || null, role, status: 'confirmed', source: 'invite', invited_by: user.id, confirmed_by: user.id, confirmed_at: new Date().toISOString() }); if (error) { errors.push(`${p.email}: ${error.message}`); continue; } added++;
      if (body.notify !== false) await mail(() => sendViaResend({ to: [p.email], subject: `دعوة من ${(org as any)?.name_ar || 'جهتك'} عبر أَثَر`, html: shell(`أنت الآن ضمن منسوبي ${(org as any)?.name_ar || 'الجهة'}`, `<p>مرحبًا ${p.full_name || ''}،</p><p>أضافتك جهتك إلى بوابة أَثَر. ادخل ببريدك هذا لترى برامجك وجلساتك وحقائب جهتك وملفك المهاري — بلا كلمة مرور.</p><p><a href="${site}/me" style="display:inline-block;background:#0b8a83;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">الدخول إلى بوابتي</a></p>`), tags: [{ name: 'kind', value: 'org_invite' }] }));
    }
    return NextResponse.json({ success: true, added, updated, errors: errors.length ? errors.slice(0, 5) : undefined });
  }
  if (action === 'bulk') {
    if (!orgId) return bad('معرّف الجهة مطلوب'); if (!(await needsOrgAdmin())) return bad('غير مصرّح', 403);
    const people = parsePeople(Array.isArray(body.people) ? body.people.map((p: any) => `${p.full_name || ''} <${p.email}>`).join('\n') : String(body.people || '')); const programId = String(body.program_id || '');
    const v = validateBulk(programId, people); if (v) return bad(v);
    const [{ data: org }, { data: prog }] = await Promise.all([db.from('portal_organizations').select('name_ar').eq('id', orgId).maybeSingle(), db.from('programs').select('id,name_ar,fee,currency').eq('id', programId).maybeSingle()]);
    if (!prog) return bad('البرنامج غير موجود', 404);
    const { data: reqRow, error } = await db.from('portal_org_requests').insert({ organization_id: orgId, requested_by: user.id, requester_email: user.email, program_id: programId, people, count: people.length, note: String(body.note || '').slice(0, 1000) || null }).select('id').single(); if (error) return bad(error.message, 500);
    // أعضاء مؤكدون + تسجيلات مسبقة (pending) باسم الجهة — القبول/السداد من إدارة أَثَر
    let enrolled = 0;
    for (const p of people) {
      await db.from('portal_org_members').upsert({ organization_id: orgId, email: p.email, full_name: p.full_name || null, role: 'learner', status: 'confirmed', source: 'bulk', invited_by: user.id, confirmed_by: user.id, confirmed_at: new Date().toISOString() }, { onConflict: 'organization_id,email', ignoreDuplicates: true });
      const { error: e2 } = await db.from('portal_enrollments').insert({ program_id: programId, user_id: null, full_name: p.full_name || p.email.split('@')[0], email: p.email, organization: (org as any)?.name_ar || null, organization_id: orgId, source: 'org_bulk', status: 'pending', notes: `تسجيل جماعي من الجهة — طلب ${(reqRow as any).id}` }); if (!e2) enrolled++;
    }
    const to = admins(); const mail_error = to.length ? await mail(() => sendViaResend({ to, subject: `طلب تسجيل جماعي: ${(org as any)?.name_ar} — ${(prog as any).name_ar} (${people.length})`, html: shell('طلب تسجيل جماعي جديد', `<p><b>الجهة:</b> ${(org as any)?.name_ar}<br><b>البرنامج:</b> ${(prog as any).name_ar}<br><b>العدد:</b> ${people.length}<br><b>مقدّم الطلب:</b> ${user.name || ''} &lt;${user.email}&gt;</p>${body.note ? `<p><b>ملاحظة:</b> ${String(body.note).slice(0, 500)}</p>` : ''}<p>أُنشئت ${enrolled} تسجيلًا مسبقًا بحالة «قيد المراجعة» في طلبات التسجيل. للتسعير أنشئ عرض سعر من الاستشارات أو فواتير فردية بعد القبول.</p><p><a href="${site}/admin/enrollments">طلبات التسجيل</a> · <a href="${site}/admin/skills?tab=orgs">الجهات</a></p>`), tags: [{ name: 'kind', value: 'org_bulk' }] })) : null;
    return NextResponse.json({ success: true, request_id: (reqRow as any).id, people: people.length, pre_enrolled: enrolled, mail_error });
  }

  if (!c.writer) return bad('غير مصرّح', 403);
  if (action === 'set_admin') {
    const email = String(body.email || '').trim().toLowerCase(); if (!orgId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('الجهة والبريد مطلوبان');
    const { data: ex } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).ilike('email', email).maybeSingle();
    const patch = { role: 'org_admin', status: 'confirmed', source: 'admin', confirmed_by: user.id, confirmed_at: new Date().toISOString(), full_name: String(body.full_name || '').trim() || undefined };
    const { error } = ex ? await db.from('portal_org_members').update(patch).eq('id', (ex as any).id) : await db.from('portal_org_members').insert({ organization_id: orgId, email, invited_by: user.id, ...patch }); if (error) return bad(error.message, 500);
    const { data: org } = await db.from('portal_organizations').select('name_ar').eq('id', orgId).maybeSingle();
    const mail_error = body.notify === false ? null : await mail(() => sendViaResend({ to: [email], subject: `تم تعيينك مديرًا لجهة ${(org as any)?.name_ar || ''} في أَثَر`, html: shell('بوابة الجهات — صلاحية مدير الجهة', `<p>تم تعيينك مديرًا لجهة <b>${(org as any)?.name_ar || ''}</b>. ادخل ببريدك هذا إلى بوابة الجهات لترى لوحة أثر التدريب على منسوبيكم، وتؤكد الأعضاء، وتطلب التسجيل الجماعي.</p><p><a href="${site}/org" style="display:inline-block;background:#0b8a83;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">بوابة الجهات</a></p>`), tags: [{ name: 'kind', value: 'org_admin' }] }));
    return NextResponse.json({ success: true, mail_error });
  }
  if (action === 'request_status') {
    const status = String(body.status || ''); if (!['new', 'reviewing', 'quoted', 'approved', 'enrolled', 'cancelled'].includes(status)) return bad('حالة غير صالحة');
    const { error } = await db.from('portal_org_requests').update({ status, internal_notes: body.internal_notes !== undefined ? String(body.internal_notes).slice(0, 1000) : undefined, updated_at: new Date().toISOString() }).eq('id', String(body.id || '')); if (error) return bad(error.message, 500); return NextResponse.json({ success: true });
  }
  void userDb; return bad('إجراء غير معروف');
}
