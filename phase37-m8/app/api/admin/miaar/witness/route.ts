// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/witness — م8 «شاهِد»: سجلّ نزاهة الاختبار للطاقم
 *  GET ?session=<id>        → «غرفة الشاهد»: الخطّ الزمني (لقطات موقَّعة 10 د · أحداث · لقطة الهوية · الملخّص · الحكم) — ويحذف كسولًا صور > 90 يومًا
 *  GET ?invite=<id>         → ملخّص حيّ لكل جلسة في الدعوة (آخر لقطة · المستوى · العدّادات) — تستخدمه لوحة 09
 *  POST {action}
 *    whisper {session_id, text}            → «همسة المراقب» تظهر للمتقدّم خلال ~20 ث (لا إيقاف · لا إنذار آلي)
 *    verdict {report_id, status, note?}    → «حكم الشاهد» بتوقيع بشري: clear | note | invalid (يحجب الشهادة)
 *  لا يقرّر الذكاء الاصطناعي هنا شيئًا؛ الصور لا تغادر هذا المسار إلى أي طرف.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { timelineFor, liveFor, sendWhisper, setVerdict, purgeExpiredFrames, WITNESS_TITLE, INTEGRITY_AR, WITNESS_MODE_AR, RETENTION_DAYS } from '../../../../../lib/miaar/witness';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{2,40}$/.test(v);
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
  try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action, entity_type: 'miaar_witness', entity_id: entityId, entity_label: label, source: 'admin', metadata }); } catch { /* تحسيني */ }
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const u = new URL(req.url);
  const sessionId = u.searchParams.get('session'); const inviteId = u.searchParams.get('invite');
  if (sessionId) {
    if (!isId(sessionId)) return bad('جلسة غير صالحة');
    await purgeExpiredFrames(db, 50).catch(() => null);  /* تنفيذ الوعد كسولًا — بلا كرون */
    const t = await timelineFor(db, sessionId); if (!t) return bad('الجلسة غير موجودة', 404);
    return NextResponse.json({ success: true, ...t, integrity_ar: INTEGRITY_AR, modes_ar: WITNESS_MODE_AR }, { headers: NO });
  }
  if (inviteId) {
    if (!isId(inviteId)) return bad('دعوة غير صالحة');
    const { data: ss } = await db.from('placement_secure_sessions').select('id').eq('invite_id', inviteId).limit(200);
    const live = await liveFor(db, ((ss || []) as any[]).map((s) => s.id));
    return NextResponse.json({ success: true, witness: live, at: new Date().toISOString() }, { headers: NO });
  }
  return NextResponse.json({ success: true, title: WITNESS_TITLE, retention_days: RETENTION_DAYS, modes_ar: WITNESS_MODE_AR, integrity_ar: INTEGRITY_AR }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  if (action === 'whisper') {
    if (!isId(b.session_id)) return bad('جلسة غير صالحة');
    const r = await sendWhisper(db, b.session_id, b.text, user.email || user.id); if (!r.ok) return bad(r.error);
    await audit(db, user, 'miaar_witness_whisper', b.session_id, 'همسة المراقب', { text: r.text });
    return NextResponse.json({ success: true, text: r.text }, { headers: NO });
  }
  if (action === 'verdict') {
    if (!isId(b.report_id)) return bad('تقرير غير صالح');
    const r = await setVerdict(db, b.report_id, b.status, b.note, { id: user.id, email: user.email }); if (!r.ok) return bad(r.error);
    await audit(db, user, 'miaar_witness_verdict', b.report_id, `حكم الشاهد — ${INTEGRITY_AR[r.report.integrity_status as keyof typeof INTEGRITY_AR] || r.report.integrity_status}`, { status: r.report.integrity_status, note: r.report.integrity_note, access_code: r.report.access_code });
    return NextResponse.json({ success: true, report: r.report }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
