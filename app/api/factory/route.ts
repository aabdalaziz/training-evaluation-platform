// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/factory — منظومة تصميم البرامج المدعومة بالذكاء الاصطناعي («مصنع البرامج» · P13-أ) — الطاقم فقط
 *  GET                                   → المسودّات (آخر 200) + الإحصاءات + المهارات (للربط عند النشر)
 *  POST { action: 'create', need }       → مسودّة جديدة من الاحتياج + تشغيل محلل الاحتياج (استشراف)
 *  POST { action: 'foresight'|'design'|'review', id }  → إعادة تشغيل محطة (ذكاء اصطناعي + بديل محلي) — لا تغيّر المرحلة إلا للأمام
 *  POST { action: 'approve', id }        → الاعتماد البشري للمحطة الحالية → الانتقال للمرحلة التالية
 *  POST { action: 'publish', id, skill_ids[] } → إنشاء برنامج مسودّة في programs (+ ربط المهارات في portal_program_skills) وتعليم المسودّة «منشور»
 *  POST { action: 'update', id, patch }  → تعديل بشري على need/design/notes
 *  POST { action: 'delete', id }
 *  كل محطة آلية لها بديل محلي كامل؛ لا شيء يُنشر إلا بقرار إنسان مسمّى.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, logAi } from '../../../lib/ai/athar';
import { DRAFT_COLS, validateNeed, needPayload, draftTitle, localForesight, buildForesightPrompt, parseForesight, localDesign, buildDesignPrompt, parseDesign, localReview, buildReviewPrompt, parseReview, programPayload, factoryStats } from '../../../lib/portal/factory';
import type { Draft, Design, Foresight, Review } from '../../../lib/portal/factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name,organization_id').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح', 403) };
  return { db: createClient(URL_, SERVICE, { auth: { persistSession: false } }), user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || ''), org: (prof as any)?.organization_id || null }, role, writer: WRITERS.includes(role) };
}
const now = () => new Date().toISOString();
async function loadDraft(db: any, id: string): Promise<Draft | null> { const { data } = await db.from('portal_program_drafts').select(DRAFT_COLS).eq('id', id).maybeSingle(); return (data as Draft) || null; }
async function save(db: any, id: string, patch: Record<string, unknown>): Promise<Draft | null> { const { data, error } = await db.from('portal_program_drafts').update({ ...patch, updated_at: now() }).eq('id', id).select(DRAFT_COLS).maybeSingle(); if (error) throw new Error(error.message); return (data as Draft) || null; }

async function runForesight(db: any, d: Draft, who: { id: string; email: string; name: string; role: string }) {
  const local = localForesight(d.need); const p = buildForesightPrompt(d.need);
  const res = await runAi<Foresight>({ system: p.system, user: p.user, parse: raw => parseForesight(raw, local), local: () => local, budgetMs: 30000 });
  await logAi(db, { user_id: who.id, email: who.email, role: who.role, purpose: 'factory_foresight', result: res, context: { draft: d.id } });
  return { data: res.data, source: res.source, log: { at: now(), by: who.name || who.email, action: 'foresight', source: res.source } };
}
async function runDesign(db: any, d: Draft, who: { id: string; email: string; name: string; role: string }) {
  const fs = d.foresight || localForesight(d.need); const local = localDesign(d.need, fs); const p = buildDesignPrompt(d.need, fs);
  const res = await runAi<Design>({ system: p.system, user: p.user, parse: raw => parseDesign(raw, local), local: () => local, budgetMs: 40000 });
  await logAi(db, { user_id: who.id, email: who.email, role: who.role, purpose: 'factory_design', result: res, context: { draft: d.id } });
  return { data: res.data, source: res.source, log: { at: now(), by: who.name || who.email, action: 'design', source: res.source } };
}
async function runReview(db: any, d: Draft, who: { id: string; email: string; name: string; role: string }) {
  if (!d.design) throw new Error('لا يوجد مخطط للمراجعة');
  const local = localReview(d.need, d.design); const p = buildReviewPrompt(d.need, d.design, local);
  const res = await runAi<Review>({ system: p.system, user: p.user, parse: raw => parseReview(raw, local), local: () => local, budgetMs: 25000 });
  await logAi(db, { user_id: who.id, email: who.email, role: who.role, purpose: 'factory_review', result: res, context: { draft: d.id } });
  return { data: res.data, source: res.source, log: { at: now(), by: who.name || who.email, action: 'review', source: res.source } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c;
  const [{ data: drafts }, { data: skills }] = await Promise.all([
    db.from('portal_program_drafts').select(DRAFT_COLS).order('created_at', { ascending: false }).limit(200),
    db.from('portal_skills').select('id,code,name_ar,domain_code,future_family,horizon').eq('active', true).order('code'),
  ]);
  const list = (drafts || []) as Draft[];
  return NextResponse.json({ success: true, drafts: list, stats: factoryStats(list), skills: skills || [] });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, role, writer } = c; const who = { ...user, role };
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');
  try {
    if (action === 'create') {
      if (!writer) return bad('غير مصرّح', 403);
      const err = validateNeed(body.need || {}); if (err) return bad(err);
      const need = needPayload(body.need);
      const { data: ins, error } = await db.from('portal_program_drafts').insert({ created_by: user.id, title_ar: draftTitle(need), need, stage: 'foresight', log: [{ at: now(), by: user.name || user.email, action: 'create' }] }).select(DRAFT_COLS).single();
      if (error) return bad(error.message, 500);
      const d = ins as Draft; const fs = await runForesight(db, d, who);
      const saved = await save(db, d.id, { foresight: fs.data, log: [...(d.log || []), fs.log] });
      return NextResponse.json({ success: true, draft: saved, source: fs.source });
    }
    const id = String(body.id || ''); if (!id) return bad('معرّف المسودّة مطلوب');
    const d = await loadDraft(db, id); if (!d) return bad('المسودّة غير موجودة', 404);
    if (action === 'foresight') { const r = await runForesight(db, d, who); const saved = await save(db, id, { foresight: r.data, log: [...(d.log || []), r.log] }); return NextResponse.json({ success: true, draft: saved, source: r.source }); }
    if (action === 'design') { const r = await runDesign(db, d, who); const saved = await save(db, id, { design: r.data, review: null, stage: d.stage === 'foresight' ? 'designed' : d.stage === 'published' ? 'published' : 'designed', log: [...(d.log || []), r.log] }); return NextResponse.json({ success: true, draft: saved, source: r.source }); }
    if (action === 'review') { const r = await runReview(db, d, who); const saved = await save(db, id, { review: r.data, stage: d.stage === 'published' ? 'published' : 'reviewed', log: [...(d.log || []), r.log] }); return NextResponse.json({ success: true, draft: saved, source: r.source }); }
    if (action === 'approve') {
      if (!writer) return bad('غير مصرّح', 403);
      // الاعتماد البشري يدفع المحطة التالية تلقائيًا (استشراف→تصميم، تصميم→مراجعة)؛ النشر له إجراء مستقل
      if (d.stage === 'foresight') { const r = await runDesign(db, d, who); const saved = await save(db, id, { design: r.data, stage: 'designed', log: [...(d.log || []), { at: now(), by: user.name || user.email, action: 'approve_foresight' }, r.log] }); return NextResponse.json({ success: true, draft: saved, source: r.source }); }
      if (d.stage === 'designed') { const r = await runReview(db, d, who); const saved = await save(db, id, { review: r.data, stage: 'reviewed', log: [...(d.log || []), { at: now(), by: user.name || user.email, action: 'approve_design' }, r.log] }); return NextResponse.json({ success: true, draft: saved, source: r.source }); }
      return bad('هذه المرحلة تحتاج «نشر» لا اعتمادًا');
    }
    if (action === 'publish') {
      if (!writer) return bad('غير مصرّح', 403);
      if (!d.design) return bad('لا يوجد مخطط'); if (d.stage === 'published' && d.program_id) return bad('نُشرت من قبل');
      const payload = programPayload(d.design, d.need); const orgId = user.org || null;
      const { data: prog, error } = await db.from('programs').insert({ ...(orgId ? { organization_id: orgId } : {}), ...payload }).select('id').single();
      if (error) return bad(`تعذّر إنشاء البرنامج: ${error.message}`, 500);
      const pid = String((prog as any).id);
      const skillIds: string[] = Array.isArray(body.skill_ids) ? body.skill_ids.map(String).slice(0, 12) : [];
      if (skillIds.length) await db.from('portal_program_skills').upsert(skillIds.map(sid => ({ program_id: pid, skill_id: sid, weight: 1 })), { onConflict: 'program_id,skill_id' });
      const saved = await save(db, id, { stage: 'published', program_id: pid, log: [...(d.log || []), { at: now(), by: user.name || user.email, action: 'publish' }] });
      return NextResponse.json({ success: true, draft: saved, program_id: pid });
    }
    if (action === 'update') {
      if (!writer) return bad('غير مصرّح', 403);
      const patch: Record<string, unknown> = {}; const p = body.patch || {};
      if (p.need) { const err = validateNeed(p.need); if (err) return bad(err); patch.need = needPayload(p.need); patch.title_ar = draftTitle(needPayload(p.need)); }
      if (p.design && typeof p.design === 'object') patch.design = { ...(d.design || {}), ...p.design };
      if (typeof p.notes === 'string') patch.notes = p.notes.slice(0, 2000);
      if (typeof p.title_ar === 'string' && p.title_ar.trim()) patch.title_ar = p.title_ar.trim().slice(0, 160);
      const saved = await save(db, id, { ...patch, log: [...(d.log || []), { at: now(), by: user.name || user.email, action: 'update' }] });
      return NextResponse.json({ success: true, draft: saved });
    }
    if (action === 'delete') { if (!writer) return bad('غير مصرّح', 403); const { error } = await db.from('portal_program_drafts').delete().eq('id', id); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
    return bad('إجراء غير معروف');
  } catch (e: any) { return bad(String(e?.message || e), 500); }
}
