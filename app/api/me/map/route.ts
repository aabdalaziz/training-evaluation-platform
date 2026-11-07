// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P58 «خريطة أثرك — ما قاد إلى ماذا» — واجهة المتعلّم
 *  GET  /api/me/map                      → المحطات · الخيوط (مبقاة/مقترَحة) · الإحداثيات · سطر المرآة · لقطاتي السنوية
 *  POST /api/me/map  { action }          keep {from,to,note} · decline {from,to} · remove {from,to} · sign {year?,is_public?} · public {id,is_public} · revoke {id}
 *  المصادقة: Bearer (المتعلّم بنفسه) · لا ذكاء اصطناعي · لا يدخل في أي تقييم · الحدّ: 60 طلبًا/دقيقة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { loadMap, keepThread, declineThread, removeThread, signSnapshot, setSnapshotPublic, revokeSnapshot, mySnapshots } from '../../../../lib/map/store';
import { MAP_TITLE, MAP_OFFICIAL, MAP_LIMITS, RULE_AR, KIND_AR } from '../../../../lib/map/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  return { db, user: { id: data.user.id, email: String(data.user.email).toLowerCase() } };
}
const audit = async (db: any, user: { id: string; email: string }, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'athar_map', entity_type: 'portal_map_threads', entity_id: null, meta }); } catch { /* السجل اختياري */ } };

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const [map, snapshots] = await Promise.all([loadMap(db, user), mySnapshots(db, user)]);
  return NextResponse.json({ success: true, title: MAP_TITLE, official: MAP_OFFICIAL, limits: MAP_LIMITS, rules: RULE_AR, kinds: KIND_AR, map, snapshots }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const rl = await rateLimit(db, `atharmap:${user.id}`, 60, 60); if (!rl.allowed) return tooMany(rl);
  let b: any = {}; try { b = await req.json(); } catch { return bad('طلب غير صالح'); }
  const action = String(b.action || '');
  if (action === 'keep') { const r = await keepThread(db, user, { from: String(b.from || ''), to: String(b.to || ''), note: String(b.note || '') }); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action, from: b.from, to: b.to }); }
  else if (action === 'decline') { const r = await declineThread(db, user, { from: String(b.from || ''), to: String(b.to || '') }); if (!r.ok) return bad(r.error, r.status); }
  else if (action === 'remove') { const r = await removeThread(db, user, { from: String(b.from || ''), to: String(b.to || '') }); if (!r.ok) return bad(r.error, r.status); }
  else if (action === 'sign') { const r = await signSnapshot(db, user, { year: b.year ? Number(b.year) : undefined, is_public: !!b.is_public }); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action, year: r.snap.year, code: r.snap.code }); const [map, snapshots] = await Promise.all([loadMap(db, user), mySnapshots(db, user)]); return NextResponse.json({ success: true, snap: r.snap, map, snapshots }, { headers: NO }); }
  else if (action === 'public') { if (!b.id) return bad('معرّف اللقطة مطلوب'); const r = await setSnapshotPublic(db, user, String(b.id), !!b.is_public); if (!r.ok) return bad('تعذّر التحديث', 500); }
  else if (action === 'revoke') { if (!b.id) return bad('معرّف اللقطة مطلوب'); const r = await revokeSnapshot(db, user, String(b.id)); if (!r.ok) return bad('تعذّر الإبطال', 500); await audit(db, user, { action, id: b.id }); }
  else return bad('إجراء غير معروف');
  const [map, snapshots] = await Promise.all([loadMap(db, user), mySnapshots(db, user)]);
  return NextResponse.json({ success: true, map, snapshots }, { headers: NO });
}
