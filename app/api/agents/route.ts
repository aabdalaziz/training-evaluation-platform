// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/agents — إدارة الوكلاء المفوَّضين (طاقم أَثَر · P14-ب)
 *  GET                                             → المفاتيح (بلا تجزئة) · الطلبات (المعلقة أولًا) · آخر 40 سطرًا من السجل · الجهات لإصدار مفتاح
 *  POST { action:'key_create', name, organization_id?, scopes?, daily_limit?, expires_days?, note? } → يُنشئ مفتاحًا ويعيد النص الكامل مرة واحدة فقط
 *  POST { action:'key_revoke', id }                → إبطال فوري
 *  POST { action:'decide', id, status:'approved'|'rejected', note?, response? }
 *        اعتماد حجز → تُنشأ طلبات تسجيل (portal_enrollments · source=agent) لكل مشارك لتدخل مسار القبول والتسكين المعتاد
 *  الإنسان هو من يعتمد — الوكيل لا يلزم أَثَر بشيء.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';
import { keyFromBytes, keyPrefix, ALL_SCOPES, DEFAULT_SCOPES } from '../../../lib/portal/agents';
import type { Scope } from '../../../lib/portal/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } }); const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) return { error: bad('هذه الصفحة للطاقم', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase() } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c;
  const [{ data: keys }, { data: requests }, { data: log }, { data: orgs }] = await Promise.all([
    db.from('portal_agent_keys').select('id,created_at,organization_id,name,prefix,scopes,daily_limit,expires_at,revoked_at,last_used_at,uses,note').order('created_at', { ascending: false }).limit(100),
    db.from('portal_agent_requests').select('id,created_at,key_id,organization_id,kind,payload,status,response,decided_at,note').order('created_at', { ascending: false }).limit(100),
    db.from('portal_agent_log').select('id,at,key_id,tool,ok,ms,meta').order('at', { ascending: false }).limit(40),
    db.from('portal_organizations').select('id,name_ar,sector').eq('active', true).order('name_ar').limit(300),
  ]);
  const orgName = new Map(((orgs || []) as any[]).map(o => [o.id, o.name_ar])); const keyName = new Map(((keys || []) as any[]).map(k => [k.id, k.name]));
  // P20 — «السفارة»: نداءات MCP في 7 أيام (توزيع نسخ البروتوكول والطبقات والأدوات) + التفويضات الشخصية النشطة
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: mcpRows }, { count: delegations }, { count: clients }] = await Promise.all([
    db.from('portal_agent_log').select('tool,ok,meta,at').contains('meta', { transport: 'mcp' }).gte('at', since7).order('at', { ascending: false }).limit(5000),
    db.from('portal_delegations').select('id', { count: 'exact', head: true }).is('revoked_at', null),
    db.from('portal_oauth_clients').select('id', { count: 'exact', head: true }),
  ]);
  const tally = (rows: any[], f: (r: any) => string | null) => { const m: Record<string, number> = {}; for (const r of rows) { const k = f(r); if (k) m[k] = (m[k] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })); };
  const mr = (mcpRows || []) as any[];
  const mcp = { calls_7d: mr.length, errors_7d: mr.filter(r => !r.ok).length, by_proto: tally(mr, r => r.meta?.proto || null), by_tier: tally(mr, r => r.meta?.tier || (r.meta?.anon ? 'anon' : r.meta?.key ? 'key' : null)), top_tools: tally(mr, r => r.tool).slice(0, 8), clients: tally(mr, r => r.meta?.client || null).slice(0, 8), delegations_active: Number(delegations || 0), registered_clients: Number(clients || 0), last_call: mr[0]?.at || null };
  const pending = ((requests || []) as any[]).filter(r => r.status === 'pending'); const rest = ((requests || []) as any[]).filter(r => r.status !== 'pending');
  return NextResponse.json({ success: true, keys: ((keys || []) as any[]).map(k => ({ ...k, org_name: orgName.get(k.organization_id) || null })), requests: [...pending, ...rest].map(r => ({ ...r, org_name: orgName.get(r.organization_id) || null, key_name: keyName.get(r.key_id) || null })), log: ((log || []) as any[]).map(l => ({ ...l, key_name: keyName.get(l.key_id) || null })), orgs: orgs || [], scopes: ALL_SCOPES, stats: { keys: (keys || []).length, pending: pending.length, calls: (log || []).length }, mcp });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const body = await req.json().catch(() => ({})); const action = String(body?.action || '');
  if (action === 'key_create') {
    const name = String(body?.name || '').trim().slice(0, 120); if (name.length < 2) return bad('اكتب اسمًا للمفتاح (مثل: وكيل الموارد البشرية — جامعة …)');
    const scopes = (Array.isArray(body?.scopes) ? body.scopes : DEFAULT_SCOPES).map(String).filter((s: string) => (ALL_SCOPES as string[]).includes(s)) as Scope[]; if (!scopes.length) return bad('اختر صلاحية واحدة على الأقل');
    const key = keyFromBytes(randomBytes(32)); const days = Math.max(0, Math.min(730, Number(body?.expires_days) || 0));
    const row = { created_by: user.id, organization_id: body?.organization_id || null, name, prefix: keyPrefix(key), key_hash: sha256(key), scopes, daily_limit: Math.max(10, Math.min(5000, Number(body?.daily_limit) || 200)), expires_at: days ? new Date(Date.now() + days * 86400000).toISOString() : null, note: String(body?.note || '').slice(0, 400) || null };
    const { data, error } = await db.from('portal_agent_keys').insert(row).select('id,prefix,name,scopes,daily_limit,expires_at').maybeSingle(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, key, record: data, warning: 'يُعرض المفتاح الكامل مرة واحدة فقط — انسخه الآن وسلّمه للجهة عبر قناة آمنة.' });
  }
  if (action === 'key_revoke') { const id = String(body?.id || ''); if (!id) return bad('معرّف ناقص'); const { error } = await db.from('portal_agent_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
  if (action === 'decide') {
    const id = String(body?.id || ''); const status = String(body?.status || ''); if (!id || !['approved', 'rejected'].includes(status)) return bad('بيانات ناقصة');
    const { data: rq } = await db.from('portal_agent_requests').select('id,kind,payload,status,organization_id').eq('id', id).maybeSingle(); if (!rq) return bad('الطلب غير موجود', 404); if ((rq as any).status !== 'pending') return bad('الطلب محسوم من قبل');
    const note = String(body?.note || '').slice(0, 600) || null; const response = body?.response && typeof body.response === 'object' ? body.response : null; let enrolled = 0;
    if (status === 'approved' && (rq as any).kind === 'reserve' && !(rq as any).payload?.sandbox) {
      const pl = (rq as any).payload || {}; const parts = Array.isArray(pl.participants) ? pl.participants : [];
      for (const p of parts.slice(0, 60)) { const { error } = await db.from('portal_enrollments').insert({ program_id: pl.program_id, full_name: p.full_name, email: p.email, organization: pl.org_name || null, notes: `حجز عبر وكيل مفوَّض · طلب ${id.slice(0, 8)} · ممثل الجهة: ${pl.contact_email || ''}`, lang: 'ar', source: 'agent', status: 'pending' }); if (!error) enrolled++; }
    }
    const { error } = await db.from('portal_agent_requests').update({ status, note, response: response || ((rq as any).kind === 'reserve' ? { enrolled } : null), decided_by: user.id, decided_at: new Date().toISOString() }).eq('id', id); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, enrolled });
  }
  return bad('إجراء غير معروف');
}
