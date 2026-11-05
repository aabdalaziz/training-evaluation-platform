// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «قاعة الشاهد» — مركز المراقبة الإلكترونية للاختبارات (م8-ب) — للطاقم
 *  GET                      → كل من يختبر الآن (+ المنتهون خلال 10 دقائق بلا حكم) · الافتراضي العام · التولّيات
 *  GET ?count=1             → عدّاد خفيف لمؤشّر «يختبر الآن N» (كل 20 ث من رأس الإدارة)
 *  POST whisper_many {session_ids, text}   → همسة جماعية لقاعة/مكان
 *  POST claim {key, label} / release {key} → «تولّي القاعة»
 *  POST default_mode {mode}               → «وضع المراقبة الافتراضي» لكل الاختبارات (مديرون فقط)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { hallFor, liveCount, claimGroup, HALL_TITLE, HALL_RECENT_MIN, GROUP_AR } from '../../../../../lib/miaar/hall';
import { sendWhisperMany, setDefaultWitnessMode, WITNESS_MODE_AR, WITNESS_MODES } from '../../../../../lib/miaar/witness';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role, name: String((prof as any)?.full_name || '') } };
}
async function audit(db: any, user: { id: string; email: string; role: string }, action: string, entityId: string, label: string, metadata: Record<string, unknown>) {
  try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action, entity_type: 'miaar_hall', entity_id: entityId, entity_label: label, source: 'admin', metadata }); } catch { /* تحسيني */ }
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const u = new URL(req.url);
  if (u.searchParams.get('count')) return NextResponse.json({ success: true, ...(await liveCount(db)) }, { headers: NO });
  const h = await hallFor(db);
  return NextResponse.json({ success: true, ...h, title: HALL_TITLE, recent_min: HALL_RECENT_MIN, groups_ar: GROUP_AR, modes: WITNESS_MODES.map((m) => ({ value: m, label: WITNESS_MODE_AR[m] })), me: { email: c.user.email, name: c.user.name, can_set_default: ADMINS.includes(c.user.role) } }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  if (action === 'whisper_many') {
    const r = await sendWhisperMany(db, b.session_ids, b.text, user.email || user.id); if (!r.ok) return bad(r.error);
    await audit(db, user, 'miaar_hall_whisper', 'many', 'همسة جماعية', { sent: r.sent, text: r.text });
    return NextResponse.json({ success: true, sent: r.sent }, { headers: NO });
  }
  if (action === 'claim' || action === 'release') {
    const r = await claimGroup(db, b.key, user.name || user.email, action === 'release'); if (!r.ok) return bad(r.error);
    await audit(db, user, action === 'claim' ? 'miaar_hall_claim' : 'miaar_hall_release', String(b.key), String(b.label || b.key), {});
    return NextResponse.json({ success: true, claims: r.claims }, { headers: NO });
  }
  if (action === 'default_mode') {
    if (!ADMINS.includes(user.role)) return bad('تغيير الافتراضي العام للمديرين فقط', 403);
    const r = await setDefaultWitnessMode(db, b.mode, user.email); if (!r.ok) return bad(r.error);
    await audit(db, user, 'miaar_hall_default_mode', r.mode, `وضع المراقبة الافتراضي: ${WITNESS_MODE_AR[r.mode]}`, { mode: r.mode });
    return NextResponse.json({ success: true, mode: r.mode, mode_ar: WITNESS_MODE_AR[r.mode] }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
