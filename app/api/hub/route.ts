// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/hub?door=<slug> (Bearer) — «مؤشرات أَثَر» للباب (P42-ب)
 *  يتحقق من الصفة (مدير النظام أو صفات الباب) ثم يحسب المؤشرات بصلاحية الخدمة — عدّ ومجاميع فقط، لا أسماء.
 *  403 door_denied لمن لا يملك الباب · 404 door_unknown · Cache-Control: private, no-store
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { loadCatalog, myRoles, normEmail } from '../../../lib/portal/roles';
import { doorFor, doorAllowed, doorLive, type DoorSlug } from '../../../lib/portal/hub';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const bad = (m: string, s = 400, code?: string) => NextResponse.json({ success: false, error: m, code }, { status: s });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });
function svc() { const U = process.env.NEXT_PUBLIC_SUPABASE_URL, S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false }, global: { fetch: noStore } }) : null; }
async function userOf(req: Request) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL, A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token || !U || !A) return null;
  try { const { data } = await createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStore } }).auth.getUser(token); return data?.user ? { id: data.user.id, email: normEmail(data.user.email || '') } : null; } catch { return null; }
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await userOf(req); if (!me) return bad('يلزم تسجيل الدخول', 401);
  const slug = (new URL(req.url).searchParams.get('door') || '').toLowerCase().slice(0, 24);
  if (!doorFor(slug)) return bad('لا يوجد باب بهذا الاسم', 404, 'door_unknown');
  const rl = await rateLimit(db, `hub:user:${me.id}`, 60, 60); if (!rl.allowed) return tooMany(rl);
  const catalog = await loadCatalog(db); const mine = await myRoles(db, me, catalog);
  if (!doorAllowed(slug, mine.roles)) return NextResponse.json({ success: false, error: 'هذا الباب لصفة أخرى', code: 'door_denied', roles: mine.roles }, { status: 403 });
  const live = await doorLive(db, slug as DoorSlug, me);
  return NextResponse.json({ success: true, ...live, roles: mine.roles }, { headers: { 'Cache-Control': 'private, no-store' } });
}
