// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «أثر الجهة» (P24) — سياق موحَّد لواجهات /api/org/*: Bearer → المستخدم → الدور · هل هو مدير الجهة المؤكَّد؟ (أو الطاقم) */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../portal/open';

export const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
export const STAFF = [...WRITERS, 'QUALITY_ANALYST'];
export const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
export const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
export type OrgWho = { id: string; email: string; name: string; staff: boolean; writer: boolean };
export function svc() { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; }

export async function who(req: Request, db: any): Promise<OrgWho | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; if (!U || !ANON) return null;
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return null;
  const userDb = createClient(U, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(role), writer: WRITERS.includes(role) };
}
export async function isOrgAdmin(db: any, orgId: string, user: { id: string; email: string }): Promise<boolean> {
  const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(1); return ((data || []) as any[]).length > 0;
}
export async function loadOrg(db: any, orgId: string): Promise<{ id: string; name_ar: string; name_en: string | null; sector: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return null; const { data } = await db.from('portal_organizations').select('id,name_ar,name_en,sector').eq('id', orgId).maybeSingle(); return (data as any) || null;
}
/** يعيد السياق الكامل أو ردًّا جاهزًا بالخطأ */
export async function orgCtx(req: Request, orgId: string): Promise<{ db: any; me: OrgWho; org: NonNullable<Awaited<ReturnType<typeof loadOrg>>>; site: string } | { error: NextResponse }> {
  const db = svc(); if (!db) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const me = await who(req, db); if (!me) return { error: bad('سجّل الدخول أولًا', 401) };
  if (!orgId) return { error: bad('معرّف الجهة مطلوب') }; const org = await loadOrg(db, orgId); if (!org) return { error: bad('الجهة غير موجودة', 404) };
  if (!(me.staff || await isOrgAdmin(db, orgId, me))) return { error: bad('غير مصرّح — أنت لست مدير هذه الجهة', 403) };
  return { db, me, org, site: siteOf(req) };
}
