// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/ratings — «تقييم الخدمة» (هـ-1/4): كلّ خدمة في أَثَر تُقيَّم بالطريقة نفسها.
 *  GET ?summary=1                      → عامّ: { services: { miaar: {avg,n,…}, iqra: …, program: … } } (مخبّأ ٥ دقائق)
 *  GET ?mine=1&service=&ref=           → تقييمي الحالي (إن وُجد) — بحساب أو برمز نتيجة مِعيار (?code=ML-…)
 *  GET ?list=1&service=&q=  (طاقم)    → آخر ٢٠٠ تقييم (بلا بريد كامل: يُقنَّع)
 *  POST { service, ref_id?, stars, tags?, comment?, context?, code? } → إدراج/تحديث (واحد لكلّ مستفيد لكلّ خدمة/مرجع)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { normEmail } from '../../../lib/portal/roles';
import { RATING_SERVICES, RATING_TAGS, maskEmail, type RatingService } from '../../../lib/portal/ratings';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 15;
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const NO = { 'Cache-Control': 'private, no-store' };
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const isCode = (c: string) => /^ML-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c);

async function ctx(req: Request, code: string) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SVC) return { error: bad('server_not_configured', 500) };
  const db = createClient(URL_, SVC, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) {
    const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data } = await userDb.auth.getUser(token);
    if (data?.user?.email) { const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); return { db, email: normEmail(data.user.email), userId: data.user.id, role: String((prof as any)?.role || '').toUpperCase() }; }
  }
  if (isCode(code)) { const { data: rep } = await db.from('placement_reports').select('candidate_email, user_id').eq('access_code', code).maybeSingle(); if (rep?.candidate_email) return { db, email: normEmail(rep.candidate_email), userId: (rep.user_id as string) || null, role: '' }; }
  return { db, email: '', userId: null, role: '' };
}

export async function GET(req: Request) {
  const u = new URL(req.url); const code = String(u.searchParams.get('code') || '').toUpperCase();
  const c = await ctx(req, code); if ('error' in c) return c.error;
  if (u.searchParams.get('summary') === '1') {
    const { data } = await c.db.rpc('service_rating_summary');
    const services: Record<string, { avg: number; n: number; dist: number[] }> = {}; const refs: Record<string, { avg: number; n: number }> = {};
    for (const r of (data || []) as any[]) {
      const k = String(r.service); if (!r.ref_id) services[k] = { avg: Number(r.avg_stars), n: Number(r.n), dist: [r.n1, r.n2, r.n3, r.n4, r.n5].map(Number) };
      else refs[`${k}:${r.ref_id}`] = { avg: Number(r.avg_stars), n: Number(r.n) };
      // تجميع عامّ للخدمة يشمل مراجعها
      const g = services[k] || (services[k] = { avg: 0, n: 0, dist: [0, 0, 0, 0, 0] }); if (r.ref_id) { const tot = g.avg * g.n + Number(r.avg_stars) * Number(r.n); g.n += Number(r.n); g.avg = g.n ? Math.round((tot / g.n) * 100) / 100 : 0; g.dist = g.dist.map((v, i) => v + Number([r.n1, r.n2, r.n3, r.n4, r.n5][i])); }
    }
    return NextResponse.json({ ok: true, services, refs }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
  }
  if (u.searchParams.get('list') === '1') {
    if (!STAFF.includes(c.role)) return bad('forbidden', 403);
    const service = String(u.searchParams.get('service') || ''); let qb = c.db.from('service_ratings').select('id, service, ref_id, rater_email, stars, tags, comment, context, created_at').order('created_at', { ascending: false }).limit(200);
    if (service) qb = qb.eq('service', service);
    const { data } = await qb;
    return NextResponse.json({ ok: true, rows: ((data || []) as any[]).map((r) => ({ ...r, rater_email: maskEmail(r.rater_email) })) }, { headers: NO });
  }
  if (u.searchParams.get('mine') === '1') {
    if (!c.email) return NextResponse.json({ ok: true, mine: null, tags: RATING_TAGS }, { headers: NO });
    const service = String(u.searchParams.get('service') || ''); const ref = String(u.searchParams.get('ref') || '');
    const { data } = await c.db.from('service_ratings').select('stars, tags, comment, updated_at').eq('service', service).eq('ref_id', ref).eq('rater_email', c.email).maybeSingle();
    return NextResponse.json({ ok: true, mine: data || null, tags: RATING_TAGS }, { headers: NO });
  }
  return bad('unknown_query');
}

export async function POST(req: Request) {
  let b: any; try { b = await req.json(); } catch { return bad('invalid_json'); }
  const c = await ctx(req, String(b?.code || '').toUpperCase()); if ('error' in c) return c.error;
  if (!c.email) return bad('sign_in_or_code', 401);
  const rl = await rateLimit(c.db, `ratings:${ipOf(req)}`, 3600, 40); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  const service = String(b?.service || '') as RatingService; if (!RATING_SERVICES.includes(service)) return bad('bad_service');
  const stars = Math.round(Number(b?.stars)); if (!(stars >= 1 && stars <= 5)) return bad('bad_stars');
  const ref_id = String(b?.ref_id || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 64);
  const tags = Array.isArray(b?.tags) ? b.tags.map(String).filter((t: string) => RATING_TAGS.some((x) => x.key === t)).slice(0, 5) : [];
  const comment = typeof b?.comment === 'string' ? b.comment.trim().slice(0, 300) : null;
  const context = b?.context && typeof b.context === 'object' ? Object.fromEntries(Object.entries(b.context).slice(0, 6).map(([k, v]) => [String(k).slice(0, 24), String(v).slice(0, 64)])) : {};
  const row = { service, ref_id, user_id: c.userId, rater_email: c.email, stars, tags, comment: comment || null, context, updated_at: new Date().toISOString() };
  const { error } = await c.db.from('service_ratings').upsert(row, { onConflict: 'service,ref_id,rater_email' });
  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, stars, thanks: stars >= 4 ? 'شكرًا — أثرك يُحسب.' : 'شكرًا على صراحتك — سنقرأ كلمتك ونحسّن.' }, { headers: NO });
}
