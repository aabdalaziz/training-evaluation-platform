// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P42-أ — إدارة الأدوار بالدعوة: /api/admin/roles
 *  GET  → { roles, grants, invites, orgs, me }      (الطاقم يقرأ؛ مدير النظام وحده يكتب)
 *  POST actions:
 *   invite        {email, full_name?, roles[], org_id?, message?}  → دعوة برمز لمرة واحدة (14 يومًا) + رابط /join/<token> يُعرض مرة واحدة
 *   grant         {email, roles[], org_id?, note?}                 → منحة مباشرة بلا دعوة (لمن هو داخل أصلًا)
 *   revoke        {grant_id, reason?}                              → سحب فوري
 *   revoke_invite {invite_id}
 *   role_create   {code, name_ar, name_en, scope, landing, permissions, is_staff, legacy_role} → دور مخصّص «حسب الاحتياج»
 *   role_toggle   {code, active}
 *  كل كتابة تُسجَّل في درع أَثَر (portal_security_events) — «الإنسان يقرّر».
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson, crossSiteBrowserWrite } from '../../../../lib/shield/body';
import { loadCatalog, validateInvite, validateRole, newInviteToken, inviteUrl, inviteState, myRoles, isAdminRoles, isStaffRoles, normEmail, bridgeLegacy, INVITE_DAYS, type Grant, type Invite } from '../../../../lib/portal/roles';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const bad = (m: string, s = 400) => NextResponse.json({ success: false, error: m }, { status: s });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL, A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, S = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !A || !S) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(U, S, { auth: { persistSession: false }, global: { fetch: noStore } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStore } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const user = { id: data.user.id, email: normEmail(data.user.email || ''), full_name: String((data.user.user_metadata as any)?.full_name || '') || null };
  const catalog = await loadCatalog(db); const mine = await myRoles(db, user, catalog);
  if (!isStaffRoles(mine.roles, catalog) && !isAdminRoles(mine.roles)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user, catalog, mine, admin: isAdminRoles(mine.roles) };
}
const siteOf = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
async function audit(db: any, user: { id: string; email: string }, kind: string, detail: Record<string, unknown>) {
  try { await db.from('portal_security_events').insert({ kind: `roles_${kind}`, severity: 'info', actor: user.email, user_id: user.id, meta: detail }); } catch { /* سجلّ اختياري */ }
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, catalog, mine, admin } = c; const now = new Date().toISOString();
  const [grants, invites, orgs] = await Promise.all([
    db.from('portal_role_grants').select('*').is('revoked_at', null).order('created_at', { ascending: false }).limit(500).then((r: any) => (r.data || []) as Grant[]),
    db.from('portal_role_invites').select('id,email,full_name,role_codes,org_id,message,expires_at,accepted_at,revoked_at,created_at').order('created_at', { ascending: false }).limit(200).then((r: any) => (r.data || []) as Invite[]),
    db.from('portal_organizations').select('id,name_ar,name_en').eq('active', true).order('name_ar').limit(300).then((r: any) => r.data || []),
  ]);
  return NextResponse.json({ success: true, roles: catalog, grants, invites: invites.map(i => ({ ...i, state: inviteState(i, now) })), orgs, me: { roles: mine.roles, admin }, invite_days: INVITE_DAYS });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, catalog, admin } = c;
  if (crossSiteBrowserWrite(req)) return bad('origin_not_allowed', 403);
  const rj = await readJson(req); if (!rj.ok) return bad(rj.error, rj.status); const body = rj.body || {};
  const action = String(body.action || '');
  if (!admin) return bad('هذه العملية لمدير النظام فقط', 403);
  const now = new Date().toISOString();

  if (action === 'invite' || action === 'grant') {
    const v = validateInvite(body, catalog); if (!v.ok) return bad(v.error);
    if (action === 'grant') {
      const made: string[] = [];
      for (const role_code of v.roles) {
        const exists = await db.from('portal_role_grants').select('id').ilike('email', v.email).eq('role_code', role_code).is('revoked_at', null).limit(1).then((r: any) => r.data || []);
        if (exists.length) continue;
        const { error } = await db.from('portal_role_grants').insert({ email: v.email, role_code, org_id: v.org_id, granted_by: user.id, source: 'manual', note: body.note ? String(body.note).slice(0, 300) : null }); if (error) return bad(error.message);
        made.push(role_code);
      }
      /* إن كان صاحب البريد مسجَّلًا بالفعل نربط المنحة ونرفع الجسر فورًا */
      const prof = await db.from('profiles').select('id,role').ilike('email', v.email).maybeSingle().then((r: any) => r.data || null);
      if (prof?.id) { await db.from('portal_role_grants').update({ user_id: prof.id }).ilike('email', v.email).is('user_id', null); await bridgeLegacy(db, { id: prof.id, email: v.email }, v.roles, catalog); }
      await audit(db, user, 'grant', { email: v.email, roles: v.roles, org_id: v.org_id, made });
      return NextResponse.json({ success: true, granted: made, already: v.roles.filter(r => !made.includes(r)) });
    }
    const { token, hash } = newInviteToken();
    const { data, error } = await db.from('portal_role_invites').insert({ token_hash: hash, email: v.email, full_name: v.full_name, role_codes: v.roles, org_id: v.org_id, message: v.message, created_by: user.id, expires_at: new Date(Date.now() + INVITE_DAYS * 86400000).toISOString() }).select('id,expires_at').single();
    if (error || !data) return bad(error?.message || 'تعذّر إنشاء الدعوة');
    await audit(db, user, 'invite', { email: v.email, roles: v.roles, org_id: v.org_id, invite_id: data.id });
    const names = v.roles.map(r => catalog.find(x => x.code === r)?.name_ar || r);
    const url = inviteUrl(siteOf(req), token);
    const text = `السلام عليكم${v.full_name ? ' ' + v.full_name : ''}،\nدعوة للانضمام إلى بوابة أَثَر بصفة: ${names.join(' · ')}.\n${v.message ? v.message + '\n' : ''}افتح الرابط وادخل بالبريد ${v.email}:\n${url}\n(صالح ${INVITE_DAYS} يومًا)`;
    return NextResponse.json({ success: true, invite_id: data.id, url, text, expires_at: data.expires_at });
  }
  if (action === 'revoke') {
    const id = String(body.grant_id || ''); if (!id) return bad('معرّف المنحة مطلوب');
    const { data, error } = await db.from('portal_role_grants').update({ revoked_at: now, revoked_by: user.id, revoke_reason: body.reason ? String(body.reason).slice(0, 300) : null }).eq('id', id).is('revoked_at', null).select('id,email,role_code'); if (error) return bad(error.message);
    if (!data?.length) return bad('المنحة غير موجودة أو مسحوبة', 404);
    await audit(db, user, 'revoke', { grant_id: id, email: data[0].email, role: data[0].role_code, reason: body.reason || null });
    return NextResponse.json({ success: true });
  }
  if (action === 'revoke_invite') {
    const id = String(body.invite_id || ''); const { data, error } = await db.from('portal_role_invites').update({ revoked_at: now }).eq('id', id).is('accepted_at', null).is('revoked_at', null).select('id'); if (error) return bad(error.message);
    if (!data?.length) return bad('الدعوة غير موجودة أو لم تعد معلّقة', 404); await audit(db, user, 'revoke_invite', { invite_id: id }); return NextResponse.json({ success: true });
  }
  if (action === 'role_create') {
    const v = validateRole(body); if (!v.ok) return bad(v.error);
    const exists = catalog.some(r => r.code === v.role.code); if (exists) return bad('الرمز مستخدم');
    const { error } = await db.from('portal_roles').insert({ ...v.role, is_system: false, active: true, sort: 200, created_by: user.id }); if (error) return bad(error.message);
    await audit(db, user, 'role_create', { code: v.role.code, name_ar: v.role.name_ar, is_staff: v.role.is_staff }); return NextResponse.json({ success: true, code: v.role.code });
  }
  if (action === 'role_toggle') {
    const code = String(body.code || '').toUpperCase(); const r = catalog.find(x => x.code === code); if (!r) return bad('دور غير معروف', 404); if (r.is_system) return bad('الأدوار النظامية لا تُعطَّل');
    const { error } = await db.from('portal_roles').update({ active: !!body.active }).eq('code', code); if (error) return bad(error.message);
    await audit(db, user, 'role_toggle', { code, active: !!body.active }); return NextResponse.json({ success: true });
  }
  return bad('إجراء غير معروف');
}
