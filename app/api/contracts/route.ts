// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/contracts — عقود الأثر (P12-ب) — مصادَق
 *  GET  ?admin=1                                  → الطاقم: كل العقود بحالتها الحية + ملخص المحفظة + الجهات والبرامج
 *  GET  ?admin=1&propose=1&org=ID&program=PID     → الطاقم: مقترح شريحة (تسجيلات البرنامج ∩ منسوبي الجهة/نطاقها)
 *  GET  ?org=ID                                   → مدير جهة مؤكَّد (أو طاقم): عقود الجهة بحالتها الحية (نسخة عامة: أعداد لا أسماء)
 *  POST { action:'create', form, cohort }          → WRITERS: مسودة عقد
 *  POST { action:'update', id, form, cohort }      → WRITERS: تعديل مسودة
 *  POST { action:'activate', id }                  → WRITERS: تفعيل + بريد للجهة برابط الصفحة الحية
 *  POST { action:'deliver', id, at? }              → WRITERS: إثبات التسليم (قرار بشري) → تُفتح نافذة الأثر
 *  POST { action:'release', id, milestone, note? } → WRITERS: الإفراج عن دفعة مستحقة بمذكرة مرقّمة + بريد (milestone: delivery|evidence|impact|return — الأخيرة P24 «دفعة العودة»)
 *  POST { action:'cancel', id }                    → WRITERS: إلغاء
 *  POST { action:'pulse', dry? }                   → الطاقم: تشغيل/معاينة نبض العقود الآن
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { CONTRACT_COLS, rowToContract, stateFor, releaseMilestone, activateContract, runContractPulse } from '../../../lib/portal/contracts-cron';
import { validateContract, contractPayload, contractToken, publicContract, proposeCohort, portfolio } from '../../../lib/portal/contracts';
import type { Contract, ContractForm, CohortPerson, MilestoneKey } from '../../../lib/portal/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const STAFF = [...WRITERS, 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const site = () => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL);

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') }, staff: STAFF.includes(role), writer: WRITERS.includes(role) };
}
async function isOrgAdmin(db: any, orgId: string, user: { id: string; email: string }) {
  const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(1); return ((data || []) as any[]).length > 0;
}
async function names(db: any, rows: Contract[]) {
  const oids = Array.from(new Set(rows.map(r => r.organization_id))); const pids = Array.from(new Set(rows.map(r => r.program_id).filter(Boolean))) as string[];
  const { data: orgs } = oids.length ? await db.from('portal_organizations').select('id,name_ar,name_en,email_domain,contact_email,contact_name').in('id', oids) : { data: [] };
  const { data: progs } = pids.length ? await db.from('programs').select('id,name_ar,name_en').in('id', pids) : { data: [] };
  const on = new Map(((orgs || []) as any[]).map(o => [o.id, o])); const pn = new Map(((progs || []) as any[]).map(p => [p.id, p]));
  for (const r of rows) { r.org_name = on.get(r.organization_id)?.name_ar || ''; r.program_name = r.program_id ? (pn.get(r.program_id)?.name_ar || '') : ''; }
}
async function withStates(db: any, rows: any[], now = new Date()) {
  const cs = rows.map(rowToContract); await names(db, cs); const out = [] as { c: Contract; s: any; facts?: any }[];
  for (const c of cs) { const { state, facts } = await stateFor(db, c, now); out.push({ c, s: state, facts }); } return out;
}
async function load(db: any, id: string): Promise<Contract | null> { const { data } = await db.from('portal_impact_contracts').select(CONTRACT_COLS).eq('id', id).maybeSingle(); return data ? rowToContract(data) : null; }

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, staff } = c; const u = new URL(req.url);
  if (u.searchParams.get('admin') === '1') {
    if (!staff) return bad('غير مصرّح', 403);
    if (u.searchParams.get('propose') === '1') {
      const org = u.searchParams.get('org') || ''; const program = u.searchParams.get('program') || ''; if (!org) return bad('اختر الجهة');
      const { data: o } = await db.from('portal_organizations').select('id,email_domain,contact_email,contact_name').eq('id', org).maybeSingle();
      const { data: mem } = await db.from('portal_org_members').select('email').eq('organization_id', org).neq('status', 'rejected');
      let q = db.from('portal_enrollments').select('email,full_name,program_id,status').in('status', ['approved', 'paid', 'placed', 'completed', 'pending']); if (program) q = q.eq('program_id', program);
      const { data: ens } = await q.limit(2000);
      return NextResponse.json({ success: true, cohort: proposeCohort((ens || []) as any[], (mem || []) as any[], (o as any)?.email_domain), contact_email: (o as any)?.contact_email || '', contact_name: (o as any)?.contact_name || '' });
    }
    const { data: rows } = await db.from('portal_impact_contracts').select(CONTRACT_COLS).order('created_at', { ascending: false }).limit(200);
    const items = await withStates(db, rows || []);
    const { data: orgs } = await db.from('portal_organizations').select('id,name_ar,email_domain,contact_email,contact_name').eq('active', true).order('name_ar');
    const { data: progs } = await db.from('programs').select('id,name_ar').order('name_ar');
    return NextResponse.json({ success: true, items: items.map(i => ({ contract: i.c, state: i.s, releases: i.facts.releases, people: i.facts.people })), portfolio: portfolio(items), orgs: orgs || [], programs: progs || [] });
  }
  const org = u.searchParams.get('org') || ''; if (!org) return bad('معرّف الجهة مطلوب');
  if (!(staff || await isOrgAdmin(db, org, user))) return bad('غير مصرّح — أنت لست مدير هذه الجهة', 403);
  const { data: rows } = await db.from('portal_impact_contracts').select(CONTRACT_COLS).eq('organization_id', org).neq('status', 'draft').order('created_at', { ascending: false });
  const items = await withStates(db, rows || []);
  return NextResponse.json({ success: true, items: items.map(i => ({ contract: publicContract(i.c), state: i.s, releases: i.facts.releases })) });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, staff, writer } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || ''); const now = new Date();
  if (action === 'pulse') { if (!staff) return bad('غير مصرّح', 403); return NextResponse.json({ success: true, result: await runContractPulse(db, site(), { dry: !!body.dry, now }) }); }
  if (!writer) return bad('غير مصرّح', 403);

  if (action === 'create' || action === 'update') {
    const form = body.form as ContractForm; const cohort = ((Array.isArray(body.cohort) ? body.cohort : []) as CohortPerson[]).map(p => ({ email: String(p.email || '').toLowerCase().trim(), full_name: String(p.full_name || '').slice(0, 120) || null })).filter(p => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email));
    if (!form) return bad('بيانات ناقصة'); const err = validateContract(form, cohort); if (err) return bad(err);
    const payload = contractPayload(form, cohort);
    if (action === 'create') {
      const fd = String(body.factory_draft_id || ''); const { data, error } = await db.from('portal_impact_contracts').insert({ ...payload, created_by: user.id, token: contractToken(), status: 'draft', ...(/^[0-9a-f-]{36}$/i.test(fd) ? { factory_draft_id: fd } : {}) }).select(CONTRACT_COLS).single(); if (error) return bad(error.message);
      return NextResponse.json({ success: true, contract: rowToContract(data) });
    }
    const cur = await load(db, String(body.id || '')); if (!cur) return bad('العقد غير موجود', 404); if (cur.status !== 'draft') return bad('لا يُعدَّل إلا عقد في حالة مسودة');
    const { data, error } = await db.from('portal_impact_contracts').update({ ...payload, updated_at: now.toISOString() }).eq('id', cur.id).select(CONTRACT_COLS).single(); if (error) return bad(error.message);
    return NextResponse.json({ success: true, contract: rowToContract(data) });
  }

  const cur = await load(db, String(body.id || '')); if (!cur) return bad('العقد غير موجود', 404);
  if (action === 'activate') { const r = await activateContract(db, cur, site(), now); if (!r.ok) return bad(r.error || 'تعذّر التفعيل'); return NextResponse.json({ success: true, mailed: r.mailed }); }
  if (action === 'deliver') {
    if (cur.status !== 'active') return bad('العقد ليس نشطًا'); if (cur.delivered_at) return bad('سبق إثبات التسليم');
    const at = body.at ? new Date(String(body.at)) : now; if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000) return bad('تاريخ التسليم غير صالح');
    const { error } = await db.from('portal_impact_contracts').update({ delivered_at: at.toISOString(), updated_at: now.toISOString() }).eq('id', cur.id); if (error) return bad(error.message);
    return NextResponse.json({ success: true, delivered_at: at.toISOString() });
  }
  if (action === 'release') {
    const key = String(body.milestone || '') as MilestoneKey; if (!['delivery', 'evidence', 'impact', 'return'].includes(key)) return bad('دفعة غير معروفة'); if (key === 'return' && !(cur.split.return > 0)) return bad('هذا العقد بلا دفعة عودة');
    const r = await releaseMilestone(db, cur, key, { id: user.id, name: user.name }, body.note ? String(body.note).slice(0, 400) : null, site(), now); if (r.error) return bad(r.error);
    return NextResponse.json({ success: true, release: r.release, state: r.state, mailed: r.mailed });
  }
  if (action === 'cancel') {
    if (cur.status === 'settled') return bad('العقد مُسوّى'); const { error } = await db.from('portal_impact_contracts').update({ status: 'cancelled', updated_at: now.toISOString() }).eq('id', cur.id); if (error) return bad(error.message);
    return NextResponse.json({ success: true });
  }
  return bad('إجراء غير معروف');
}
