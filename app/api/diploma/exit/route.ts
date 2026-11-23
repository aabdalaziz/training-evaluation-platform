// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/diploma/exit — توأمة البرامج والدبلومات + EXIT (هـ-1/5)
 *  GET  ?mine=1                         (مشارك)  → «لو خرجت اليوم تحمل معك» لكلّ دبلوم مقيَّد فيه + حالة الخروج/العودة
 *  GET  ?program=<id>                   (طاقم)    → نظرة الدبلوم: المقيَّدون · التقدّم · الإشارة المبكرة · الحالة
 *  GET  ?programs=1                     (طاقم)    → قائمة الدبلومات + البرامج (للربط)
 *  POST { action:'auto', program_id }                       (طاقم) → ملء الإتمام الآلي
 *  POST { action:'complete', program_id, unit_id, email, done, note } (طاقم)
 *  POST { action:'link', program_id, unit_id, linked_program_id }     (طاقم)
 *  POST { action:'exit', enrollment_id, reason_code, reason }         (طاقم أو المشارك لقيده) → شهادات + سجلّ + قيد خروج
 *  POST { action:'return', enrollment_id }                            (طاقم أو المشارك خلال المهلة)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { diplomaOverview, learnerCarry, autoCompletions, setCompletion, exitCredentials, returnFromExit, linkUnitProgram } from '../../../../lib/diploma/exit-store';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER']; const STAFF = [...WRITERS, 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, success: false, error }, { status });
const NO = { 'Cache-Control': 'private, no-store' };
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SVC) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const db = createClient(URL_, SVC, { auth: { persistSession: false } });
  const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() }, staff: STAFF.includes(role), writer: WRITERS.includes(role) };
}
const out = (r: any) => (r.ok ? NextResponse.json({ success: true, ...r }, { headers: NO }) : bad(r.error, r.status));

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const u = new URL(req.url);
  if (u.searchParams.get('mine') === '1') return out(await learnerCarry(c.db, c.user.email, c.user.id));
  if (!c.staff) return bad('للطاقم', 403);
  if (u.searchParams.get('programs') === '1') {
    const { data } = await c.db.from('programs').select('id,name_ar,program_type,start_date').order('program_type').order('name_ar').limit(500);
    const all = (data || []) as any[]; return NextResponse.json({ success: true, diplomas: all.filter((p) => p.program_type === 'diploma'), programs: all.filter((p) => p.program_type !== 'diploma') }, { headers: NO });
  }
  const pid = String(u.searchParams.get('program') || ''); if (!pid) return bad('program مطلوب');
  return out(await diplomaOverview(c.db, pid));
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; let b: any; try { b = await req.json(); } catch { return bad('invalid_json'); }
  const action = String(b?.action || '');
  if (action === 'exit' || action === 'return') {
    const self = !c.writer; if (self) { const rl = await rateLimit(c.db, `dexit:${ipOf(req)}`, 3600, 5); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة'); }
    const eid = String(b.enrollment_id || ''); if (!eid) return bad('enrollment_id مطلوب');
    return out(action === 'exit' ? await exitCredentials(c.db, { enrollment_id: eid, reason_code: b.reason_code ? String(b.reason_code) : null, reason: b.reason ? String(b.reason) : null }, c.user, siteUrl(req), self) : await returnFromExit(c.db, eid, c.user, self));
  }
  if (!c.writer) return bad('للطاقم', 403);
  if (action === 'auto') return out(await autoCompletions(c.db, String(b.program_id || ''), c.user.id));
  if (action === 'complete') return out(await setCompletion(c.db, { program_id: String(b.program_id || ''), unit_id: String(b.unit_id || ''), email: String(b.email || ''), done: !!b.done, note: b.note ? String(b.note) : '' }, c.user.id));
  if (action === 'link') return out(await linkUnitProgram(c.db, { program_id: String(b.program_id || ''), unit_id: String(b.unit_id || ''), linked_program_id: b.linked_program_id ? String(b.linked_program_id) : null }));
  return bad('إجراء غير معروف');
}
