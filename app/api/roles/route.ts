// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P42-أ — أدواري وقبول الدعوة: /api/roles
 *  GET  ?token=…     (بلا دخول)  → معاينة الدعوة: الصفات والجهة والرسالة وحالتها — بلا بريد كامل (يُقنَّع)
 *  GET               (Bearer)    → { roles, landing, catalog(المختصر), grants, permissions, staff } (P43-ب: الصلاحيات المجمّعة للمتصفح)
 *  POST {action:'accept', token} (Bearer) → قبول الدعوة بالبريد نفسه → منح + جسر + وجهة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson, crossSiteBrowserWrite } from '../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { loadCatalog, myRoles, acceptInvite, hashToken, inviteState, normEmail, seatsLeft, isStaffRoles } from '../../../lib/portal/roles';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const bad = (m: string, s = 400, code?: string) => NextResponse.json({ success: false, error: m, code }, { status: s });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });
const mask = (e: string) => { const [u, d] = e.split('@'); return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, u.length - 2))}@${d}`; };

function svc() { const U = process.env.NEXT_PUBLIC_SUPABASE_URL, S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false }, global: { fetch: noStore } }) : null; }
async function userOf(req: Request) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL, A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token || !U || !A) return null;
  try { const { data } = await createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStore } }).auth.getUser(token); return data?.user ? { id: data.user.id, email: normEmail(data.user.email || ''), full_name: String((data.user.user_metadata as any)?.full_name || '') || null } : null; } catch { return null; }
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const u = new URL(req.url); const token = u.searchParams.get('token');
  if (token) {
    const rl = await rateLimit(db, `roles_preview:ip:${ipOf(req)}`, 60, 30); if (!rl.allowed) return tooMany(rl);
    const { data: inv } = await db.from('portal_role_invites').select('email,full_name,role_codes,org_id,message,expires_at,accepted_at,revoked_at,kind,max_uses,uses,label').eq('token_hash', hashToken(token)).maybeSingle();
    if (!inv) return bad('الدعوة غير موجودة', 404, 'not_found');
    const catalog = await loadCatalog(db); const org = inv.org_id ? await db.from('portal_organizations').select('name_ar').eq('id', inv.org_id).maybeSingle().then((r: any) => r.data?.name_ar || null) : null;
    const me = await userOf(req);
    return NextResponse.json({ success: true, invite: { kind: inv.kind || 'personal', label: inv.label || null, seats_left: inv.kind === 'group' ? seatsLeft(inv) : null, max_uses: inv.max_uses || 1, email_masked: inv.email ? mask(inv.email) : null, full_name: inv.full_name, roles: (inv.role_codes || []).map((c: string) => ({ code: c, name_ar: catalog.find(r => r.code === c)?.name_ar || c, name_en: catalog.find(r => r.code === c)?.name_en || c })), org, message: inv.message, expires_at: inv.expires_at, state: inviteState(inv, new Date().toISOString()) }, me: me ? { email: me.email, matches: inv.kind === 'group' || normEmail(me.email) === normEmail(inv.email || '') } : null });
  }
  const me = await userOf(req); if (!me) return bad('يلزم تسجيل الدخول', 401);
  const catalog = await loadCatalog(db); const r = await myRoles(db, me, catalog);
  /* P43-ب: الصلاحيات المجمّعة + هل أنا طاقم — يقرأها المتصفح ليبني غُرَف مركز القيادة (lib/portal/rooms.ts) بلا منطق خادمي */
  const permissions = Array.from(new Set(catalog.filter(c => r.roles.includes(c.code)).flatMap(c => c.permissions || []))).sort();
  const staff = isStaffRoles(r.roles, catalog);
  return NextResponse.json({ success: true, roles: r.roles, landing: r.landing, grants: r.grants, permissions, staff, catalog: catalog.filter(c => r.roles.includes(c.code)).map(c => ({ code: c.code, name_ar: c.name_ar, name_en: c.name_en, landing: c.landing, scope: c.scope })), email: me.email });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  if (crossSiteBrowserWrite(req)) return bad('origin_not_allowed', 403);
  const me = await userOf(req); if (!me) return bad('يلزم تسجيل الدخول', 401);
  const rj = await readJson(req); if (!rj.ok) return bad(rj.error, rj.status); const body = rj.body || {};
  if (String(body.action) === 'accept') {
    const rl = await rateLimit(db, `roles_accept:user:${me.id}`, 3600, 20); if (!rl.allowed) return tooMany(rl);
    const r = await acceptInvite(db, String(body.token || ''), me); if (!r.ok) return bad(r.error, r.code === 'not_found' ? 404 : 409, r.code);
    try { await db.from('portal_security_events').insert({ kind: 'roles_accept', severity: 'info', actor: me.email, user_id: me.id, ip: ipOf(req), meta: { roles: r.roles } }); } catch { /* ignore */ }
    return NextResponse.json({ success: true, roles: r.roles, landing: r.landing });
  }
  return bad('إجراء غير معروف');
}
