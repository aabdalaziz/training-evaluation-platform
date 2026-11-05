// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/forms — «منشئ النماذج» (م2-ب) للطاقم
 *  GET ?list=1                      → المخطّطات كلها + المتاح المعتمد لكل خلية (مستوى×مهارة) كما يراه المحرّك فعلًا + أنواع الاختبارات وطرق السحب
 *  GET ?cell=A1&skill=reading[&q=]  → البنود المعتمدة الصالحة في الخلية (لاختيار سلّة الخبير أو الثابت)
 *  POST {action}
 *   blueprint_save      {id?, name_ar, name_en?, description_ar?, test_type, level?, duration_minutes, cut_percent, requirements{levels, counts, draw, pool, floor, probe, shuffle_options, start_level, ladder}, sort_order?}
 *                       → يُحفظ مسودّة (أو يبقى على حالته) ويُرجع أخطاء الخطة إن وُجدت؛ التفعيل يشترط خلوّها
 *   blueprint_status    {id, status: draft|active|archived, is_public?}  التفعيل يتحقّق من الخطة ومن توفّر البنود في كل خلية
 *   blueprint_preview   {id} | {fields…}  → سحب تجريبي (بذرة عشوائية) — رموز البنود حسب المستوى ومواضع النقص
 *   blueprint_duplicate {id}  → نسخة مسودّة
 *   blueprint_delete    {id}  → فقط غير النظامي وغير المستخدم في جلسة أو دعوة
 *  السحب الفعلي للجلسات يبقى عشوائيًا دائمًا (البذرة رمز الجلسة) — المخطّط يضبط «من أيّ سلّة وكم»، لا «أيّ بند بعينه» إلا في الثابت.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { LEVELS, SKILLS, isLevel, isSkill } from '../../../../../lib/miaar/registry';
import type { PoolItem } from '../../../../../lib/miaar/registry';
import { loadApprovedPool, loadPassages } from '../../../../../lib/miaar/bank';
import { listUnits, coverage } from '../../../../../lib/miaar/syllabus'; /* م6-ب */
import { TEST_TYPES, TEST_TYPE_INFO, DRAW_MODE_INFO, isTestType, planFromBlueprint, drawPlan, planTotal, cellKey, expertReadiness } from '../../../../../lib/miaar/blueprint';
import type { BlueprintRow } from '../../../../../lib/miaar/blueprint';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const TABLE = 'question_bank_blueprints';
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status });
const ok = (body: Record<string, unknown>) => NextResponse.json({ success: true, ...body }, { headers: { 'Cache-Control': 'no-store' } });
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, role } };
}
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, min: number, max: number, dflt: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : dflt; };

/** المتاح لكل خلية كما يراه المحرّك (بنود معتمدة صالحة فعلًا: مفتاح + مقطع جاهز + وسائط) */
function availability(pool: readonly PoolItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of pool) out[cellKey(i.level, i.skill)] = (out[cellKey(i.level, i.skill)] || 0) + 1;
  return out;
}
/** مطابقة الخطة مع البنك: الخلايا التي لا يكفيها المتاح (أو السلّة) */
function shortages(plan: ReturnType<typeof planFromBlueprint>['plan'], pool: readonly PoolItem[]): string[] {
  const avail = availability(pool); const codes = new Set(pool.map((i) => i.code)); const out: string[] = [];
  for (const l of plan.levels) for (const s of SKILLS) {
    const need = plan.counts[l][s]; if (!need) continue;
    if (plan.draw === 'random') { if ((avail[cellKey(l, s)] || 0) < need) out.push(`${l}/${s}: المتاح ${avail[cellKey(l, s)] || 0} < المطلوب ${need}`); continue; }
    const basket = (plan.pool[cellKey(l, s)] || []).filter((c) => codes.has(c));
    if (basket.length < need) out.push(`${l}/${s}: السلّة الصالحة ${basket.length} < المطلوب ${need}`);
  }
  return out;
}
/** قراءة حقول المخطّط من الطلب إلى صفّ قابل للحفظ */
function rowFromBody(b: Record<string, unknown>, existing: Partial<BlueprintRow> | null) {
  const test_type = isTestType(b.test_type) ? b.test_type : existing?.test_type && isTestType(existing.test_type) ? existing.test_type : 'custom';
  const req = b.requirements && typeof b.requirements === 'object' ? (b.requirements as Record<string, unknown>) : (existing?.requirements as Record<string, unknown>) || {};
  const levels = Array.isArray(req.levels) ? (req.levels as unknown[]).filter(isLevel) : [];
  const counts: Record<string, Record<string, number>> = {};
  const rawCounts = req.counts && typeof req.counts === 'object' ? (req.counts as Record<string, Record<string, unknown>>) : {};
  for (const l of LEVELS) { counts[l] = {}; for (const s of SKILLS) counts[l][s] = num(rawCounts[l]?.[s], 0, 40, 0); }
  const productive: Record<string, { writing: number; speaking: number }> = {}; const rawProd = req.productive && typeof req.productive === 'object' ? (req.productive as Record<string, Record<string, unknown>>) : {};
  for (const l of LEVELS) productive[l] = { writing: num(rawProd[l]?.writing, 0, 3, 0), speaking: num(rawProd[l]?.speaking, 0, 3, 0) };
  const pool: Record<string, string[]> = {}; const rawPool = req.pool && typeof req.pool === 'object' ? (req.pool as Record<string, unknown>) : {};
  for (const [k, v] of Object.entries(rawPool)) if (Array.isArray(v)) pool[k] = [...new Set(v.map((c) => str(c, 60)).filter(Boolean))].slice(0, 400);
  const level = test_type === 'level' ? (isLevel(b.level) ? b.level : levels[0] || null) : null;
  const requirements = {
    levels: test_type === 'level' && level ? [level] : levels, counts, draw: req.draw === 'expert_pool' || req.draw === 'fixed' ? req.draw : 'random', pool,
    floor: req.floor === true || req.floor === 'true', probe: req.probe === true || req.probe === 'true', shuffle_options: !(req.shuffle_options === false || req.shuffle_options === 'false'),
    start_level: isLevel(req.start_level) ? req.start_level : null, ladder: req.ladder === 'adaptive' || req.ladder === 'linear' || req.ladder === 'single' ? req.ladder : null,
    productive, productive_mode: req.productive_mode === 'declared' ? 'declared' : 'demonstrated', /* م4-أ */
  };
  const purpose = test_type === 'level' ? 'level' : test_type === 'short' ? 'diagnostic' : 'placement';
  return {
    name_ar: str(b.name_ar, 120) || existing?.name_ar || TEST_TYPE_INFO[test_type].name_ar, name_en: str(b.name_en, 120) || existing?.name_en || TEST_TYPE_INFO[test_type].name_en,
    description_ar: str(b.description_ar, 400) || existing?.description_ar || null, test_type, level, requirements, purpose,
    duration_minutes: num(b.duration_minutes, 5, 240, existing?.duration_minutes || 50), cut_percent: num(b.cut_percent, 30, 100, existing?.cut_percent || 60), sort_order: num(b.sort_order, 1, 999, existing?.sort_order || 100),
  };
}
async function nextCode(db: any, type: string): Promise<string> {
  const prefix = `BP-${type.toUpperCase()}-`; const { data } = await db.from(TABLE).select('code').like('code', `${prefix}%`).limit(500);
  const used = new Set(((data || []) as { code: string }[]).map((r) => r.code)); for (let n = 1; n < 1000; n += 1) { const c = `${prefix}${String(n).padStart(3, '0')}`; if (!used.has(c)) return c; } return `${prefix}${Date.now()}`;
}
const publicRow = (r: BlueprintRow, pool: readonly PoolItem[]) => { const { plan, errors } = planFromBlueprint(r); return { ...r, plan_total: planTotal(plan), plan_errors: errors, shortages: shortages(plan, pool), type_name: TEST_TYPE_INFO[plan.type].name_ar, ladder: plan.ladder, ...(/^SYS-EXIT-/.test(String(r.code || '')) ? { expert_ready: expertReadiness(plan) } : {}) }; };

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const p = new URL(req.url).searchParams;
  const passages = await loadPassages(db).catch(() => new Map()); const pool = await loadApprovedPool(db, passages as any).catch(() => [] as PoolItem[]);
  if (p.get('cell')) {
    const level = p.get('cell'); const skill = p.get('skill'); const q = str(p.get('q'), 80);
    if (!isLevel(level) || !isSkill(skill)) return bad('خلية غير صالحة');
    const items = pool.filter((i) => i.level === level && i.skill === skill && (!q || i.code.includes(q) || i.questionText.includes(q))).slice(0, 300)
      .map((i) => ({ code: i.code, type: i.type, text: i.questionText.slice(0, 140), passage: i.passageId ? ((passages as Map<string, any>).get(i.passageId)?.title || i.passageId) : null, image: Boolean(i.stimulus?.image) }));
    return ok({ items, total: pool.filter((i) => i.level === level && i.skill === skill).length });
  }
  const { data, error } = await db.from(TABLE).select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }).limit(200); if (error) return bad(error.message, 500);
  const rows: any[] = ((data || []) as BlueprintRow[]).map((r) => publicRow(r, pool));
  /* م6-ب: فحص تغطية وحدات المستوى على بطاقات SYS-EXIT (الوحدات المعتمدة بلا بنود موسومة) */
  try { const units = await listUnits(db); if (units.length) for (const r of rows) { const m = String(r.code || '').match(/^SYS-EXIT-(A1|A2|B1|B2|C1)$/); if (!m) continue; const c = coverage(units, m[1] as any, pool); r.unit_coverage = { approved: c.rows.length, covered: c.rows.filter((x) => x.covered).length, uncovered: c.uncovered, tagged: c.tagged, total: c.total }; } } catch { /* بلا تغطية */ }
  const [sessions, invites] = await Promise.all([db.from('placement_secure_sessions').select('blueprint_id').not('blueprint_id', 'is', null).limit(5000), db.from('placement_invites').select('blueprint_id').not('blueprint_id', 'is', null).limit(2000)]);
  const usage: Record<string, { sessions: number; invites: number }> = {};
  for (const r of (sessions.data || []) as { blueprint_id: string }[]) { usage[r.blueprint_id] = usage[r.blueprint_id] || { sessions: 0, invites: 0 }; usage[r.blueprint_id].sessions += 1; }
  for (const r of (invites.data || []) as { blueprint_id: string }[]) { usage[r.blueprint_id] = usage[r.blueprint_id] || { sessions: 0, invites: 0 }; usage[r.blueprint_id].invites += 1; }
  return ok({
    blueprints: rows, usage, availability: availability(pool), pool_total: pool.length,
    types: TEST_TYPES.map((t) => ({ id: t, ...TEST_TYPE_INFO[t] })), draw_modes: Object.entries(DRAW_MODE_INFO).map(([id, v]) => ({ id, ...v })), levels: LEVELS, skills: SKILLS,
  });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 1024 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || ''); const now = new Date().toISOString();
  const load = async (id: string) => { const { data } = await db.from(TABLE).select('*').eq('id', id).maybeSingle(); return (data as BlueprintRow | null) || null; };
  const pool = async () => loadApprovedPool(db).catch(() => [] as PoolItem[]);

  if (action === 'blueprint_save') {
    const id = str(b.id, 60); const existing = id ? await load(id) : null; if (id && !existing) return bad('المخطّط غير موجود', 404);
    const fields = rowFromBody(b, existing);
    if (existing?.is_system && fields.test_type !== existing.test_type) return bad('المخطّط النظامي لا يغيّر نوعه — أنشئ نسخة');
    const { errors } = planFromBlueprint({ ...(existing || {}), ...fields } as any);
    if (existing && existing.status === 'active' && errors.length) return bad('المخطّط نشط ولا يقبل خطة فيها أخطاء — عطّله أولًا أو صحّح', 400, { plan_errors: errors });
    let row: BlueprintRow | null = null;
    if (existing) { const r = await db.from(TABLE).update({ ...fields, updated_at: now }).eq('id', existing.id).select('*').single(); if (r.error) return bad(r.error.message, 500); row = r.data as BlueprintRow; }
    else { const code = str(b.code, 40).toUpperCase().replace(/[^A-Z0-9-]/g, '') || await nextCode(db, fields.test_type); const r = await db.from(TABLE).insert({ ...fields, code, status: 'draft', is_public: false, is_system: false, created_by: user.id, created_at: now, updated_at: now }).select('*').single(); if (r.error || !r.data) return bad(r.error?.message || 'تعذّر الإنشاء', 500); row = r.data as BlueprintRow; }
    return ok({ blueprint: publicRow(row, await pool()), plan_errors: errors });
  }
  if (action === 'blueprint_status') {
    const id = str(b.id, 60); const row = id ? await load(id) : null; if (!row) return bad('المخطّط غير موجود', 404);
    const status = String(b.status || row.status); if (!['draft', 'active', 'archived'].includes(status)) return bad('حالة غير معروفة');
    const is_public = typeof b.is_public === 'boolean' ? b.is_public : row.is_public;
    if (row.is_system && status === 'archived') return bad('المخطّط النظامي لا يُؤرشف — يمكن إخفاؤه من الأبواب العامة (is_public) أو تعديله');
    if (status === 'active') {
      const { plan, errors } = planFromBlueprint(row); if (errors.length) return bad('الخطة فيها أخطاء — صحّحها قبل التفعيل', 400, { plan_errors: errors });
      const lack = shortages(plan, await pool()); if (lack.length) return bad('البنك لا يكفي هذه الخطة — راجع الخلايا', 400, { shortages: lack });
    }
    if (is_public && status !== 'active') return bad('الباب العام يحتاج مخطّطًا نشطًا');
    const r = await db.from(TABLE).update({ status, is_public, updated_at: now }).eq('id', row.id).select('*').single(); if (r.error) return bad(r.error.message, 500);
    return ok({ blueprint: publicRow(r.data as BlueprintRow, await pool()) });
  }
  if (action === 'blueprint_preview') {
    const id = str(b.id, 60); const existing = id ? await load(id) : null; if (id && !existing) return bad('المخطّط غير موجود', 404);
    const source = existing && !b.requirements ? existing : { ...(existing || {}), ...rowFromBody(b, existing), code: existing?.code || 'PREVIEW' };
    const { plan, errors } = planFromBlueprint(source as any);
    const P = await pool(); const seed = `preview:${Date.now()}:${Math.random()}`; const drawn = drawPlan(P, seed, plan);
    const byCode = new Map(P.map((i) => [i.code, i]));
    const items = (drawn?.codes || []).map((code) => { const i = byCode.get(code); return { code, level: i?.level, skill: i?.skill, type: i?.type, text: (i?.questionText || '').slice(0, 90) }; });
    return ok({ plan: { ...plan, pool: undefined }, total: planTotal(plan), plan_errors: errors, shortages: shortages(plan, P), short: drawn?.short || [], items, drawn: items.length, seed });
  }
  if (action === 'blueprint_duplicate') {
    const id = str(b.id, 60); const row = id ? await load(id) : null; if (!row) return bad('المخطّط غير موجود', 404);
    const code = await nextCode(db, row.test_type);
    const r = await db.from(TABLE).insert({ code, name_ar: `${row.name_ar} (نسخة)`, name_en: row.name_en, description_ar: row.description_ar, test_type: row.test_type, requirements: row.requirements || {}, duration_minutes: row.duration_minutes, is_system: false, purpose: row.purpose, level: row.level, cut_percent: row.cut_percent, status: 'draft', is_public: false, sort_order: (row.sort_order || 100) + 1, created_by: user.id, created_at: now, updated_at: now }).select('*').single();
    if (r.error || !r.data) return bad(r.error?.message || 'تعذّر النسخ', 500);
    return ok({ blueprint: publicRow(r.data as BlueprintRow, await pool()) });
  }
  if (action === 'blueprint_delete') {
    const id = str(b.id, 60); const row = id ? await load(id) : null; if (!row) return bad('المخطّط غير موجود', 404);
    if (row.is_system) return bad('المخطّط النظامي لا يُحذف');
    const [s, i] = await Promise.all([db.from('placement_secure_sessions').select('id', { count: 'exact', head: true }).eq('blueprint_id', row.id), db.from('placement_invites').select('id', { count: 'exact', head: true }).eq('blueprint_id', row.id)]);
    if ((s.count || 0) > 0 || (i.count || 0) > 0) return bad(`مستخدم في ${s.count || 0} جلسة و${i.count || 0} دعوة — أرشِفه بدل الحذف`);
    const d = await db.from(TABLE).delete().eq('id', row.id); if (d.error) return bad(d.error.message, 500);
    return ok({ deleted: row.id });
  }
  return bad('إجراء غير معروف');
}
