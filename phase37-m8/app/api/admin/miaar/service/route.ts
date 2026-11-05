// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/service — م7 «عُبور للجهات»: خدمة الاختبار المعياري (CEFR) للطاقم
 *  GET                      → سجلّ الخدمة (الطلبات مع عدّاداتها) + المستويات + فحص السلال لكل مستوى
 *  GET ?order=<id>          → طلب واحد + لوحته (الصفوف · العدّاد) + تقرير الجهة + المعيار المرجعي
 *  POST {action}
 *    create       {client_name, client_contact?, level, opens_at?, expires_at?, max_seats?, lang?, identity_mode?, pin?|auto_pin?, note?} → الدعوة + رابط بوابة الجهة (مرة واحدة) + الرمز
 *    status       {order_id, status}                 → open|rating|delivered|invoiced|cancelled (بتوقيع بشري)
 *    client_link  {order_id}                         → رابط جديد لبوابة الجهة (يُبطل القديم)
 *    revoke_link  {order_id}
 *    sign         {order_id, name}                   → «ختم المراقب»
 *  الاختبار نفسه لا يتغيّر — المعيارية. لا يقرّر الذكاء الاصطناعي هنا شيئًا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { normalizeSite } from '../../../../../lib/portal/open';
import { loadApprovedPool, loadApprovedTasks } from '../../../../../lib/miaar/bank';
import { EXIT_LEVELS, EXIT_TITLE, SPEC_VERSION, isExitLevel, poolCheck, specTable } from '../../../../../lib/miaar/exit';
import { boardFor } from '../../../../../lib/miaar/exitflow';
import { createServiceInvite, listOrders, setOrderStatus, rotateClientToken, revokeClientToken, signProctor, clientReport, benchmarkFromDb, randomPin, SERVICE_TITLE, SERVICE_STATUS, SERVICE_STATUS_AR } from '../../../../../lib/miaar/service';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
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
async function availability(db: any): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try { const pool = await loadApprovedPool(db); for (const it of pool) { const k = `${it.level}:${it.skill}`; out[k] = (out[k] || 0) + 1; } } catch { /* فارغ */ }
  try { const tasks = await loadApprovedTasks(db); for (const t of tasks) { const k = `${t.level}:${t.skill}`; out[k] = (out[k] || 0) + 1; } } catch { /* فارغ */ }
  return out;
}
async function audit(db: any, user: { id: string; email: string; role: string }, action: string, entityId: string, label: string, metadata: Record<string, unknown>) {
  try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action, entity_type: 'miaar_service', entity_id: entityId, entity_label: label, source: 'admin', metadata }); } catch { /* تحسيني */ }
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const site = siteOf(req); const u = new URL(req.url);
  const orderId = u.searchParams.get('order');
  if (orderId) {
    if (!isId(orderId)) return bad('طلب غير صالح');
    const orders = await listOrders(db, site); const o = orders.find((x: any) => x.id === orderId); if (!o) return bad('طلب الخدمة غير موجود', 404);
    const b = await boardFor(db, o.invite_id); const level = isExitLevel(o.level) ? o.level : 'A1';
    const bench = await benchmarkFromDb(db, level).catch(() => null);
    return NextResponse.json({ success: true, site, order: o, board: b ? { rows: b.rows, summary: b.summary, window: b.window } : null, report: b ? clientReport(level, b.rows, bench) : null, spec: specTable(level), official: EXIT_TITLE, service: SERVICE_TITLE }, { headers: NO });
  }
  const [orders, avail] = await Promise.all([listOrders(db, site), availability(db)]);
  const pools = Object.fromEntries(EXIT_LEVELS.map((l) => [l, poolCheck(l, avail)]));
  return NextResponse.json({ success: true, site, orders, levels: EXIT_LEVELS, pools, statuses: SERVICE_STATUS.map((s) => ({ id: s, ar: SERVICE_STATUS_AR[s] })), official: EXIT_TITLE, service: SERVICE_TITLE, version: SPEC_VERSION }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const site = siteOf(req);
  const j = await readJson(req, { maxBytes: 128 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  if (action === 'create') {
    if (!isExitLevel(b.level)) return bad('حدّد المستوى (A1–C1)');
    const seats = Number(b.max_seats); const pin = b.auto_pin === true ? randomPin() : typeof b.pin === 'string' && b.pin.trim() ? b.pin : null;
    const r = await createServiceInvite(db, {
      client_name: String(b.client_name || ''), client_contact: typeof b.client_contact === 'string' ? b.client_contact : null, level: b.level,
      opens_at: typeof b.opens_at === 'string' ? b.opens_at : null, expires_at: typeof b.expires_at === 'string' ? b.expires_at : null,
      max_seats: Number.isInteger(seats) && seats > 0 ? seats : null, lang: typeof b.lang === 'string' ? b.lang : 'ar', identity_mode: b.identity_mode === 'email_id' ? 'email_id' : 'email', pin, proctor_mode: b.proctor_mode === 'room' || b.proctor_mode === 'remote' || b.proctor_mode === 'camera' ? b.proctor_mode : null, note: typeof b.note === 'string' ? b.note.slice(0, 500) : null,
    }, user.id, site);
    if (!r.ok) return bad(r.error === 'blueprint_missing' ? 'مخطّط SYS-EXIT غير موجود — نفّذ ترحيل م6 أولًا' : r.error);
    await audit(db, user, 'miaar_service_create', r.order.id, `خدمة اختبار معياري — ${r.order.client_name} ${r.order.level}`, { invite_id: r.invite.id, level: r.order.level, seats: r.order.seats, pin: !!r.pin });
    const avail = await availability(db);
    return NextResponse.json({ success: true, order: r.order, invite: r.invite, url: r.url, client_url: r.client_url, pin: r.pin, spec: specTable(b.level), pool: poolCheck(b.level, avail), official: EXIT_TITLE, service: SERVICE_TITLE }, { headers: NO });
  }
  if (!isId(b.order_id)) return bad('طلب غير صالح');
  if (action === 'status') { const r = await setOrderStatus(db, b.order_id, b.status, user.id); if (!r.ok) return bad(r.error); await audit(db, user, 'miaar_service_status', b.order_id, `حالة الخدمة → ${String(b.status)}`, { status: b.status }); return NextResponse.json({ success: true, order: r.order }, { headers: NO }); }
  if (action === 'client_link') { const r = await rotateClientToken(db, b.order_id, user.id, site); if (!r.ok) return bad(r.error); await audit(db, user, 'miaar_service_client_link', b.order_id, 'رابط بوابة الجهة', {}); return NextResponse.json({ success: true, client_url: r.client_url }, { headers: NO }); }
  if (action === 'revoke_link') { const ok = await revokeClientToken(db, b.order_id, user.id); if (!ok) return bad('تعذّر الإبطال'); await audit(db, user, 'miaar_service_revoke_link', b.order_id, 'إبطال رابط بوابة الجهة', {}); return NextResponse.json({ success: true }, { headers: NO }); }
  if (action === 'sign') { const r = await signProctor(db, b.order_id, b.name, `staff:${user.id}`); if (!r.ok) return bad(r.error); await audit(db, user, 'miaar_service_sign', b.order_id, 'ختم المراقب', { name: b.name }); return NextResponse.json({ success: true, order: r.order }, { headers: NO }); }
  return bad('إجراء غير معروف');
}
