// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/iqra/access — باب اقْرَأْ (هـ-1/3): حالة الدخول + التجربة + شراء مقعد + منح الطاقم.
 *  GET                                 → { state, level, seat, days_left, trial_available, pending_invoice_id, plans, vat }
 *  POST { action: 'trial' }            → تجربة ٧ أيام (مرّة واحدة لكل بريد) عبر RPC portal_start_trial
 *  POST { action: 'buy', plan }        → فاتورة الخطّة عبر RPC portal_issue_service_invoice → { invoice_id } ثم /pay/<id>
 *  POST { action: 'grant', email, days, note? }  → طاقم: منح أيّام (RPC portal_grant_seat)
 *  GET ?list=1&q=                      → طاقم: آخر المقاعد
 * الصلاحيات كلّها داخل الـRPC (security definer) — هذا الملف لا يرفع صلاحية أحد.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { approvedDecision, findEnrolment } from '../../../../lib/iqra/store';
import { normEmail } from '../../../../lib/portal/roles';
import { seatsOf, plansOf, currentSeat, lastSeat, daysLeft, seatState, pendingServiceInvoice, SEAT_COPY, SEAT_FREE_ROLES } from '../../../../lib/portal/entitlements';
import type { SeatState } from '../../../../lib/portal/entitlements';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 20;
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('server_not_configured', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { db, user: null as null, userDb: null as null, email: '', role: '' };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data } = await userDb.auth.getUser(token);
  if (!data?.user?.email) return { db, user: null as null, userDb: null as null, email: '', role: '' };
  const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return { db, user: data.user, userDb, email: normEmail(data.user.email), role: String((prof as any)?.role || '').toUpperCase() };
}

async function levelOf(db: any, email: string): Promise<string | 'pending' | null> {
  const e = await findEnrolment(db, email); if (e) return e.level;
  const d = await approvedDecision(db, email); if (!d) return null; if (d === 'pending') return 'pending';
  return d.level;
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const u = new URL(req.url);
  const rl = await rateLimit(c.db, `iqra_access:${ipOf(req)}`, 3600, 300); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  const plans = await plansOf(c.db, 'iqra');
  const { data: st } = await c.db.from('portal_payment_settings').select('vat_rate, prices_include_vat, currency, card_enabled, bank_transfer_enabled').eq('id', 1).maybeSingle();
  const vat = { rate: Number((st as any)?.vat_rate || 0), included: !!(st as any)?.prices_include_vat, currency: String((st as any)?.currency || 'SAR'), card: !!(st as any)?.card_enabled, bank: !!(st as any)?.bank_transfer_enabled };

  if (u.searchParams.get('list') === '1') {
    if (!c.user || !STAFF.includes(c.role)) return bad('forbidden', 403);
    const q = normEmail(String(u.searchParams.get('q') || '')); let qb = c.db.from('service_entitlements').select('id, service, learner_email, plan_code, source, starts_at, ends_at, invoice_id, note, created_at').eq('service', 'iqra').order('created_at', { ascending: false }).limit(200);
    if (q) qb = qb.ilike('learner_email', `%${q}%`);
    const { data } = await qb; const now = Date.now();
    const rows = ((data || []) as any[]).map((r) => ({ ...r, active: Date.parse(r.starts_at) <= now && Date.parse(r.ends_at) > now, days_left: daysLeft(r.ends_at, now) }));
    return NextResponse.json({ ok: true, rows, active: rows.filter((r) => r.active).length, trials: rows.filter((r) => r.source === 'trial').length, paid: rows.filter((r) => r.source === 'invoice').length }, { headers: NO });
  }

  if (!c.user) return NextResponse.json({ ok: true, state: 'guest' as SeatState, copy: SEAT_COPY.guest, level: null, seat: null, days_left: 0, trial_available: false, pending_invoice_id: null, plans, vat }, { headers: NO });
  const [level, seats, pending] = await Promise.all([levelOf(c.db, c.email), seatsOf(c.db, 'iqra', c.email), pendingServiceInvoice(c.db, 'iqra', c.user.id)]);
  const staffFree = SEAT_FREE_ROLES.includes(c.role) || process.env.IQRA_SEATS === 'off';
  let state = seatState({ signedIn: true, level, seats, pendingInvoice: !!pending });
  if (staffFree && (state === 'noSeat' || state === 'expired' || state === 'paying')) state = 'active';
  const seat = currentSeat(seats) || (state === 'expired' ? lastSeat(seats) : null);
  const trial_used = seats.some((s) => s.source === 'trial');
  return NextResponse.json({ ok: true, state, copy: SEAT_COPY[state], level: level === 'pending' ? null : level, seat, days_left: seat ? daysLeft(seat.ends_at) : 0, trial_used, trial_available: !trial_used && !!plans.find((p) => p.code === 'trial'), pending_invoice_id: pending, plans, vat, staff_free: staffFree && !currentSeat(seats) }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  if (!c.user || !c.userDb) return bad('sign_in_required', 401);
  const rl = await rateLimit(c.db, `iqra_access_w:${ipOf(req)}`, 3600, 60); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  let b: any; try { b = await req.json(); } catch { return bad('invalid_json'); }
  const action = String(b?.action || '');

  if (action === 'trial') {
    const level = await levelOf(c.db, c.email); if (!level || level === 'pending') return bad('level_required', 409);
    const { data, error } = await c.userDb.rpc('portal_start_trial', { p_service: 'iqra' });
    if (error) return bad(error.message.includes('trial_not_available') ? 'trial_not_available' : error.message, 400);
    const r = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, already: !!r?.already, ends_at: r?.ends_at || null, days_left: daysLeft(r?.ends_at) }, { headers: NO });
  }
  if (action === 'buy') {
    const plan = String(b?.plan || '').replace(/[^a-z_]/g, ''); if (!plan) return bad('plan_required');
    const level = await levelOf(c.db, c.email); if (!level || level === 'pending') return bad('level_required', 409);
    const { data, error } = await c.userDb.rpc('portal_issue_service_invoice', { p_service: 'iqra', p_plan: plan });
    if (error) return bad(error.message.includes('plan_not_found') ? 'plan_not_found' : error.message, 400);
    return NextResponse.json({ ok: true, invoice_id: data, pay_url: `/pay/${data}` }, { headers: NO });
  }
  if (action === 'grant') {
    if (!STAFF.includes(c.role)) return bad('forbidden', 403);
    const email = normEmail(String(b?.email || '')); const days = Math.round(Number(b?.days) || 0); if (!email || days < 1) return bad('email_and_days_required');
    const { data, error } = await c.userDb.rpc('portal_grant_seat', { p_service: 'iqra', p_email: email, p_days: days, p_note: typeof b?.note === 'string' ? b.note.slice(0, 200) : null });
    if (error) return bad(error.message, 400);
    return NextResponse.json({ ok: true, id: data }, { headers: NO });
  }
  return bad('unknown_action');
}
