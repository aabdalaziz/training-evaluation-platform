// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/sign — P50 «توقيعي» (سجلّ التوقيعات المعلّقة)
 *  GET  (Bearer)             → السجلّ كاملًا لصاحب الجلسة: {total, today_signed, oldest_days, groups[], scope}
 *  GET  ?light=1             → {total} فقط — للعدّاد في الصدفة (ذاكرة 45 ث)
 *  GET  ?fresh=1             → يتجاوز الذاكرة
 *  POST {action:'touch', key, id} → «توقيع بلمسة»: يستدعي الواجهة القائمة نفسها (approve_all) بالرمز نفسه — لا تجاوز صلاحيات · تدقيق sign_touch
 *  من يرى؟ الطاقم (profiles.role) كلّ شيء · المدرّب شُعبه فقط · أصحاب الأبواب (P42-ب) قرارات أبوابهم · غير ذلك 403
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { normalizeSite } from '../../../../lib/portal/open';
import { loadCatalog, myRoles, normEmail } from '../../../../lib/portal/roles';
import { DOOR_SLUGS, doorAllowed } from '../../../../lib/portal/hub';
import type { DoorSlug } from '../../../../lib/portal/hub';
import { collectRegister, invalidateSignCache, touchFor, STAFF_ROLES, SIGN_TITLE } from '../../../../lib/portal/sign';
import type { SignMe } from '../../../../lib/portal/sign';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'private, no-store' };
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{2,40}$/.test(v);
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const email = normEmail(String(data.user.email || '')); const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  const staff = STAFF_ROLES.includes(role); let trainer = role === 'TRAINER';
  if (!trainer && !staff && email) { try { const { data: tr } = await db.from('trainers').select('id').ilike('email', email).limit(1); trainer = Array.isArray(tr) && tr.length > 0; } catch { trainer = false; } }
  let doors: DoorSlug[] = []; try { const cat = await loadCatalog(db); const mine = await myRoles(db, { id: data.user.id, email }, cat); doors = DOOR_SLUGS.filter((d) => doorAllowed(d, mine.roles)); } catch { doors = []; }
  if (!staff && !trainer && !doors.length) return { error: bad('غير مصرّح — «توقيعي» للطاقم والمدرّبين وأصحاب الأبواب', 403) };
  const me: SignMe = { id: data.user.id, email, role, staff, trainer, doors };
  return { db, me, token };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c; const u = new URL(req.url);
  const rl = await rateLimit(db, `sign:user:${me.id}`, 120, 60); if (!rl.allowed) return tooMany(rl);
  const reg = await collectRegister(db, me, siteOf(req), { fresh: u.searchParams.get('fresh') === '1' });
  if (u.searchParams.get('light') === '1') return NextResponse.json({ success: true, total: reg.total, oldest_days: reg.oldest_days, computed_at: reg.computed_at }, { headers: NO });
  return NextResponse.json({ success: true, title: SIGN_TITLE, ...reg }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me, token } = c;
  const rl = await rateLimit(db, `sign:touch:${me.id}`, 30, 60); if (!rl.allowed) return tooMany(rl);
  const jr = await readJson(req, { maxBytes: 64 * 1024 }); if (!jr.ok) return bad(jr.error, jr.status); const b = jr.body as Record<string, unknown>;
  if (b.action !== 'touch') return bad('إجراء غير معروف');
  if (!me.staff) return bad('«توقيع بلمسة» للطاقم — افتح الرابط ووقّع من مكانه', 403);
  if (typeof b.key !== 'string' || !isId(b.id)) return bad('حدّد المجموعة والعنصر');
  const reg = await collectRegister(db, me, siteOf(req), { fresh: true }); const g = reg.groups.find((x) => x.key === b.key); const item = g?.items?.find((i) => i.id === b.id);
  if (!g || !item) return NextResponse.json({ success: false, error: 'لم يعد هذا العنصر ينتظر توقيعك — حدّث السجلّ', code: 'not_found' }, { status: 404, headers: NO });
  const t = touchFor(item); if (!t) return NextResponse.json({ success: false, error: 'هذا العنصر يُوقَّع من مكانه لا بلمسة', code: 'not_touchable' }, { status: 400, headers: NO });
  /* نفس الرمز → نفس الصلاحيات → نفس التدقيق الذي تتركه الواجهة الأصلية */
  const r = await fetch(new URL(t.path, req.url), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-forwarded-for': ipOf(req) }, body: JSON.stringify(t.body), cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  try { await db.from('audit_logs').insert({ actor_id: me.id, actor_email: me.email, actor_role: me.role, action: 'sign_touch', entity_type: 'sign_register', entity_id: String(b.id), entity_label: g?.title_ar || String(b.key), source: 'admin', metadata: { key: b.key, path: t.path, ok: !!j?.success, done: j?.done ?? null, skipped: j?.skipped ?? null } }); } catch { /* تحسيني */ }
  invalidateSignCache();
  if (!r.ok || !j?.success) return NextResponse.json({ success: false, error: j?.error || 'تعذّر التوقيع', status: r.status }, { status: r.ok ? 400 : r.status, headers: NO });
  const next = await collectRegister(db, me, siteOf(req), { fresh: true });
  return NextResponse.json({ success: true, result: { done: j.done ?? null, skipped: j.skipped ?? null, errors: j.errors ?? [] }, total: next.total, groups: next.groups, today_signed: next.today_signed, oldest_days: next.oldest_days }, { headers: NO });
}
