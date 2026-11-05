// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «خريطة المنهج — وسم وحدات المستوى» (م6-ب) — للطاقم
 *  GET  ?level=A1            → وحدات المستوى · التغطية (كم بندًا معتمدًا لكل وحدة معتمدة) · بنود المستوى مع وسومها · هل الجدول جاهز
 *  POST unit_save {unit}                       → إنشاء/تعديل وحدة (مديرون)
 *       unit_status {code, status}             → اعتماد/إيقاف/إرجاع إلى مسوَّدة (مديرون)
 *       seed_level {level}                     → إدراج وحدات البذرة الناقصة لمستوى (إن حُذفت)
 *       tag_items {item_ids, unit_codes, mode} → وسم يدوي (add|replace|remove) — الطاقم
 *       suggest {level, item_ids?}             → اقتراحات (محلي من الواصف + Gemini للباقي) — لا تُكتب شيئًا
 *       apply_suggestions {suggestions:[{item_id,unit_code}]} → اعتماد بشري للاقتراحات → وسم + سجل
 *  كل كتابة تُسجَّل في audit_logs، وكل نداء ذكاء في portal_ai_log.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { runAi, aiUsage, logAi } from '../../../../../lib/ai/athar';
import { loadApprovedPool } from '../../../../../lib/miaar/bank';
import { listUnits, approvedFor, coverage, saveUnit, setUnitStatus, tagItems, validateUnit, validateTag, suggestLocal, suggestPrompt, parseSuggestions, SUGGEST_SYSTEM, UNIT_SEED, UNIT_LEVELS, SYLLABUS_TITLE, isUnitCode, isItemId, resetUnitsCache } from '../../../../../lib/miaar/syllabus';
import type { ExitLevel, Suggestion, SuggestItem, UnitStatus } from '../../../../../lib/miaar/syllabus';

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
  try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action, entity_type: 'miaar_syllabus', entity_id: entityId, entity_label: label, source: 'admin', metadata }); } catch { /* تحسيني */ }
}
const levelOf = (v: unknown): ExitLevel | null => ((UNIT_LEVELS as readonly string[]).includes(String(v)) ? (String(v) as ExitLevel) : null);

/** بنود المستوى (كل الحالات) مع وسومها — للقائمة وللاقتراح */
async function levelItems(db: any, level: ExitLevel): Promise<Array<SuggestItem & { status: string; unit_codes: string[] }>> {
  const { data, error } = await db.from('question_bank_items').select('id, item_code, level, skill, status, descriptor_code, domain, question_text, unit_codes').eq('level', level).limit(1000);
  if (error) { /* قبل الهجرة: بلا عمود unit_codes */ const r = await db.from('question_bank_items').select('id, item_code, level, skill, status, descriptor_code, domain, question_text').eq('level', level).limit(1000); return ((r.data || []) as any[]).map((x) => ({ id: x.id, code: x.item_code, level: x.level, skill: x.skill, status: x.status, descriptor_code: x.descriptor_code || null, domain: x.domain || null, text: String(x.question_text || ''), unit_codes: [] })); }
  return ((data || []) as any[]).map((x) => ({ id: x.id, code: x.item_code, level: x.level, skill: x.skill, status: x.status, descriptor_code: x.descriptor_code || null, domain: x.domain || null, text: String(x.question_text || ''), unit_codes: Array.isArray(x.unit_codes) ? x.unit_codes.filter(isUnitCode) : [] }));
}
async function tableReady(db: any): Promise<boolean> { try { const r = await db.from('miaar_syllabus_units').select('code').limit(1); return !r.error; } catch { return false; } }

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const u = new URL(req.url); const level = levelOf(u.searchParams.get('level')) || 'A1';
  const ready = await tableReady(db); const all = ready ? await listUnits(db, true) : [];
  const [items, pool] = await Promise.all([levelItems(db, level).catch(() => []), loadApprovedPool(db).catch(() => [])]);
  const cov = coverage(all, level, pool);
  const counts: Record<string, { total: number; approved: number; draft: number }> = {};
  for (const L of UNIT_LEVELS) { const ls = all.filter((x) => x.level === L); counts[L] = { total: ls.length, approved: ls.filter((x) => x.status === 'approved').length, draft: ls.filter((x) => x.status === 'draft').length }; }
  return NextResponse.json({ success: true, title: SYLLABUS_TITLE, ready, level, units: all.filter((x) => x.level === level), counts, coverage: cov, items: items.map((i) => ({ id: i.id, code: i.code, skill: i.skill, status: i.status, descriptor_code: i.descriptor_code, domain: i.domain, text: i.text.slice(0, 140), unit_codes: i.unit_codes })), can_edit: ADMINS.includes(user.role), seed_total: UNIT_SEED.length }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 256 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  if (!(await tableReady(db))) return bad('جدول وحدات المستوى غير موجود بعد — نفّذ هجرة م6-ب أولًا', 503);

  if (action === 'unit_save') {
    if (!ADMINS.includes(user.role)) return bad('تحرير الوحدات للمديرين فقط', 403);
    const v = validateUnit((b.unit as Record<string, unknown>) || {}); if (!v.ok) return bad(v.error);
    const r = await saveUnit(db, v.unit, user.email || user.id); if (!r.ok) return bad(r.error);
    await audit(db, user, 'miaar_unit_save', v.unit.code, v.unit.title_ar, { level: v.unit.level, status: v.unit.status, descriptors: v.unit.descriptor_codes.length });
    return NextResponse.json({ success: true, unit: v.unit }, { headers: NO });
  }
  if (action === 'unit_status') {
    if (!ADMINS.includes(user.role)) return bad('اعتماد الوحدات للمديرين فقط', 403);
    const code = String(b.code || ''); const status = String(b.status || '') as UnitStatus; if (!isUnitCode(code) || !['draft', 'approved', 'retired'].includes(status)) return bad('رمز أو حالة غير صالحة');
    if (!(await listUnits(db, true)).some((u) => u.code === code)) return bad('الوحدة غير موجودة', 404);
    const ok = await setUnitStatus(db, code, status, user.email || user.id); if (!ok) return bad('تعذّر تغيير الحالة');
    await audit(db, user, 'miaar_unit_status', code, code, { status });
    return NextResponse.json({ success: true }, { headers: NO });
  }
  if (action === 'seed_level') {
    if (!ADMINS.includes(user.role)) return bad('للمديرين فقط', 403);
    const level = levelOf(b.level); if (!level) return bad('المستوى من A1 إلى C1');
    const have = new Set((await listUnits(db, true)).map((x) => x.code)); let n = 0;
    for (const s of UNIT_SEED.filter((x) => x.level === level && !have.has(x.code))) { const r = await saveUnit(db, { ...s, status: 'draft' }, user.email || user.id); if (r.ok) n += 1; }
    resetUnitsCache(); await audit(db, user, 'miaar_unit_seed', level, `بذرة ${level}`, { inserted: n });
    return NextResponse.json({ success: true, inserted: n }, { headers: NO });
  }
  if (action === 'tag_items') {
    const v = validateTag(b); if (!v.ok) return bad(v.error);
    const n = await tagItems(db, v.item_ids, v.unit_codes, v.mode);
    await audit(db, user, 'miaar_items_tag', v.unit_codes.join(',') || '-', `وسم ${n} بندًا`, { mode: v.mode, items: v.item_ids.length, changed: n, units: v.unit_codes, by: 'human' });
    return NextResponse.json({ success: true, changed: n }, { headers: NO });
  }
  if (action === 'suggest') {
    const level = levelOf(b.level); if (!level) return bad('المستوى من A1 إلى C1');
    const all = await listUnits(db, true); const units = all.filter((x) => x.level === level && x.status !== 'retired'); if (!units.length) return bad('لا وحدات لهذا المستوى');
    const wanted = Array.isArray(b.item_ids) ? new Set(b.item_ids.map(String)) : null;
    const items = (await levelItems(db, level)).filter((i) => (wanted ? wanted.has(i.id) : !i.unit_codes.length)).slice(0, 60);
    if (!items.length) return NextResponse.json({ success: true, suggestions: [], source: 'none', note: 'كل بنود المستوى موسومة' }, { headers: NO });
    const local = suggestLocal(items, units); const done = new Set(local.map((s) => s.item_id)); const rest = items.filter((i) => !done.has(i.id));
    let aiPart: Suggestion[] = []; let source: 'local' | 'ai' = 'local'; let note: string | null = null;
    if (rest.length) {
      const usage = await aiUsage(db, user.id, 'miaar_syllabus_tag');
      if (!usage.allowed) note = `بلغت حدّ الاقتراحات الآلية اليومي (${usage.limit})؛ الاقتراح المحلي من الواصف يبقى متاحًا`;
      else {
        const r = await runAi<Suggestion[]>({ system: SUGGEST_SYSTEM, user: suggestPrompt(level, units, rest), parse: (raw) => parseSuggestions(raw, rest, units), local: () => [], budgetMs: 25000, json: true });
        await logAi(db, { user_id: user.id, email: user.email, role: user.role, purpose: 'miaar_syllabus_tag', result: r, context: { level, items: rest.length } });
        aiPart = r.data; source = r.source === 'ai' ? 'ai' : 'local'; if (r.source !== 'ai') note = 'الذكاء غير متاح الآن — اعتمدنا الواصف فقط';
      }
    }
    const byUnit = new Map(units.map((x) => [x.code, x.title_ar]));
    const suggestions = [...local, ...aiPart].map((s) => ({ ...s, unit_title: byUnit.get(s.unit_code) || s.unit_code, item_code: items.find((i) => i.id === s.item_id)?.code || '' }));
    return NextResponse.json({ success: true, suggestions, source, note, considered: items.length }, { headers: NO });
  }
  if (action === 'apply_suggestions') {
    const raw = Array.isArray(b.suggestions) ? (b.suggestions as Array<Record<string, unknown>>) : []; let n = 0; const applied: string[] = [];
    for (const s of raw.slice(0, 200)) { const id = String(s.item_id || ''); const code = String(s.unit_code || ''); if (!isItemId(id) || !isUnitCode(code)) continue; n += await tagItems(db, [id], [code], 'add'); applied.push(`${id}:${code}`); }
    await audit(db, user, 'miaar_items_tag', 'suggestions', `اعتماد ${n} اقتراحًا`, { mode: 'add', items: raw.length, changed: n, by: 'human_over_ai' });
    return NextResponse.json({ success: true, changed: n }, { headers: NO });
  }
  if (action === 'coverage') {
    const level = levelOf(b.level); if (!level) return bad('المستوى من A1 إلى C1');
    const cov = coverage(await listUnits(db, true), level, await loadApprovedPool(db).catch(() => [])); return NextResponse.json({ success: true, coverage: cov, approved_units: approvedFor(await listUnits(db), level).length }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
