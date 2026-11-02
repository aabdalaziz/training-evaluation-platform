// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/bank — محرّر بنك مِعيار (م2-أ) للطاقم
 *  GET ?level&skill&status&batch&type&q&offset&limit → البنود (مع المفتاح والمقطع) · ?passages=1 → المقاطع · ?descriptors=1 → الواصفات
 *  POST {action}
 *   item_update   {id, question_text, options[{id,text,image?,alt?}], correct, descriptor_code?, domain?, difficulty_est?, passage_id?, media_path?, media_alt?, note?}
 *   item_status   {id | ids[], status: approved|in_review|archived|draft, note?}   (حدث مراجعة لكل بند)
 *   item_delete   {id}  حذف نهائي — فقط لبند غير معتمد لم يُجب عنه أحد قط (وإلا: أرشفة). المفاتيح والأحداث تُحذف بالتتابع.
 *   batch_status  {batch: athar-m2a|miaar-legacy|<content_version>, status, level?}  → «مراجعة الدفعة» (in_review → approved) أو «أرشفة التأسيسية»
 *   item_create   {level, skill, item_type, question_text, options, correct, passage_id?, descriptor_code?, domain?, difficulty_est?, media_path?, media_alt?}
 *   passage_update {id, title?, body?, status?, meta?, audio_public_path?}
 *   passage_create {id, level, skill, title, body, meta?}
 *   audio_upload  {passage_id, base64 (mp3 ≤ 4MB)} → الدلو miaar-media/audio/<id>.mp3 (رابط موقَّع عند التقديم)
 *  م4-أ «صوتك وقلمك»: GET ?skill=writing|speaking (المهام) · ?rubric=1 → سُلّم التقدير (48 درجة)
 *   task_update   {id, question_text, task{genre,prompt_en?,tips_ar[],sample_ar?,min_words|min_seconds…}, descriptor_code?, domain?, media_path?, media_alt?, note?}
 *   task_create   {level, skill: writing|speaking, question_text, task, descriptor_code?, domain?, media_path?, media_alt?}
 *   اعتماد المهمة لا يحتاج مفتاحًا (تُقدَّر بالسُلّم لا بمفتاح) — item_status/batch_status يميّزان ذلك.
 *  القرار الأكاديمي بيد الطاقم؛ لا يقرّر الذكاء الاصطناعي هنا شيئًا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { ITEM_TYPES, SKILLS, PRODUCTIVE_SKILLS, PRODUCTIVE_ITEM_TYPES, isBankLevel, isSkill, isProductiveSkill, isOptionId, BANK_LEVELS, FLOOR_LEVEL } from '../../../../../lib/miaar/registry';
import { validateTask } from '../../../../../lib/miaar/rubric';
import type { ItemType } from '../../../../../lib/miaar/registry';
import { optionList, MEDIA_BUCKET, itemBatch } from '../../../../../lib/miaar/bank';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const STATUSES = ['draft', 'in_review', 'approved', 'archived'];
const DOMAINS = ['personal', 'public', 'educational', 'professional'];
const NEW_VERSION = 'athar-staff';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
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
const batchFilter = (q: any, batch: string) => batch === 'miaar-legacy' ? q.eq('legacy_extra->>batch', 'miaar-legacy') : q.eq('content_version', batch);

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const u = new URL(req.url); const p = u.searchParams;
  if (p.get('descriptors') === '1') {
    const { data } = await db.from('miaar_descriptors').select('code, level, mode, text_ar, text_en, sort').order('sort').limit(500);
    return NextResponse.json({ success: true, descriptors: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (p.get('rubric') === '1') {
    const { data } = await db.from('miaar_rubric_bands').select('skill, dimension, dimension_ar, dimension_en, score, text_ar, text_en, sort').order('sort').limit(200);
    return NextResponse.json({ success: true, bands: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (p.get('passages') === '1') {
    let q = db.from('miaar_passages').select('id, level, skill, title, body, status, source, version, audio_public_path, audio_storage_path, meta, updated_at').order('level').order('id').limit(500);
    if (isBankLevel(p.get('level'))) q = q.eq('level', p.get('level')); if (p.get('skill') === 'reading' || p.get('skill') === 'listening') q = q.eq('skill', p.get('skill'));
    const { data, error } = await q; if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, passages: data || [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const limit = Math.min(100, Math.max(5, Number(p.get('limit')) || 40)); const offset = Math.max(0, Number(p.get('offset')) || 0);
  let q = db.from('question_bank_items').select('id, item_code, content_version, level, skill, passage_id, question_text, options, item_type, status, descriptor_code, cefr_descriptor, domain, difficulty_est, stimulus, media_path, media_alt, author_notes, task, legacy_extra, latest_review_note, reviewed_at, exposure_count, updated_at', { count: 'exact' });
  if (isBankLevel(p.get('level'))) q = q.eq('level', p.get('level')); if (isSkill(p.get('skill')) || isProductiveSkill(p.get('skill'))) q = q.eq('skill', p.get('skill')); else if (p.get('productive') === '1') q = q.in('skill', [...PRODUCTIVE_SKILLS]);
  if (STATUSES.includes(p.get('status') || '')) q = q.eq('status', p.get('status')); if ((ITEM_TYPES as readonly string[]).includes(p.get('type') || '')) q = q.eq('item_type', p.get('type'));
  const batch = str(p.get('batch'), 40); if (batch) q = batchFilter(q, batch);
  const text = str(p.get('q'), 80); if (text) q = q.or(`item_code.ilike.%${text.replace(/[%,()]/g, '')}%,question_text.ilike.%${text.replace(/[%,()]/g, '')}%`);
  if (p.get('dupes') === '1') q = q.not('legacy_extra->>duplicate_of', 'is', null);
  q = q.order('level').order('skill').order('item_code').range(offset, offset + limit - 1);
  const { data, error, count } = await q; if (error) return bad(error.message, 500);
  const rows = (data || []) as any[]; const ids = rows.map((r) => r.id);
  const keys = ids.length ? await db.from('question_bank_answer_keys').select('item_id, correct_option_id').in('item_id', ids) : { data: [] };
  const keyOf = new Map<string, string>(((keys.data || []) as any[]).map((k) => [k.item_id, k.correct_option_id]));
  const pids = [...new Set(rows.map((r) => r.passage_id).filter(Boolean))];
  const pas = pids.length ? await db.from('miaar_passages').select('id, title, skill, status, audio_public_path, audio_storage_path').in('id', pids) : { data: [] };
  const pasOf = new Map<string, any>(((pas.data || []) as any[]).map((x) => [x.id, x]));
  const items = rows.map((r) => ({ ...r, correct: keyOf.get(r.id) || null, batch: itemBatch(r), passage: r.passage_id ? pasOf.get(r.passage_id) || null : null }));
  return NextResponse.json({ success: true, items, total: count || 0, offset, limit, levels: BANK_LEVELS, skills: SKILLS, statuses: STATUSES, domains: DOMAINS }, { headers: { 'Cache-Control': 'no-store' } });
}

async function reviewEvent(db: any, itemIds: string[], status: string, note: string, userId: string) {
  if (!itemIds.length) return;
  await db.from('question_bank_review_events').insert(itemIds.map((item_id) => ({ item_id, review_status: status, academic_note: note || null, reviewed_by: userId })));
}
function parseItemFields(b: Record<string, unknown>, type: ItemType) {
  const question_text = str(b.question_text, 1200); if (question_text.length < 2) return { error: 'نص السؤال قصير' };
  const options = optionList(b.options, type); if (!options) return { error: 'الخيارات غير صالحة لهذا النوع (العدد أو النص/الصورة)' };
  const correct = b.correct; if (!isOptionId(correct) || !options.some((o) => o.id === correct)) return { error: 'المفتاح لا يطابق خيارًا' };
  const descriptor_code = str(b.descriptor_code, 40) || null; const domain = DOMAINS.includes(String(b.domain)) ? String(b.domain) : null;
  const d = Number(b.difficulty_est); const difficulty_est = Number.isInteger(d) && d >= 1 && d <= 5 ? d : null;
  const passage_id = str(b.passage_id, 80) || null; const media_path = str(b.media_path, 300) || null; const media_alt = str(b.media_alt, 200) || null;
  const opts = options.map((o) => ({ id: o.id, text: o.text, ...(o.image ? { image: o.image, alt: o.alt || null } : {}) }));
  return { value: { question_text, options: opts, correct, descriptor_code, domain, difficulty_est, passage_id, media_path, media_alt, stimulus: media_path ? { image: media_path, alt: media_alt } : null } };
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 6 * 1024 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || ''); const note = str(b.note, 600); const now = new Date().toISOString();

  if (action === 'item_update') {
    const id = str(b.id, 60); if (!id) return bad('معرّف مفقود');
    const { data: cur } = await db.from('question_bank_items').select('id, item_type, status').eq('id', id).maybeSingle(); if (!cur) return bad('البند غير موجود', 404);
    const type = (ITEM_TYPES as readonly string[]).includes(String(b.item_type)) ? (String(b.item_type) as ItemType) : (cur.item_type as ItemType);
    const f = parseItemFields(b, type); if ('error' in f) return bad(f.error!);
    const v = f.value!;
    const up = await db.from('question_bank_items').update({ question_text: v.question_text, options: v.options, item_type: type, descriptor_code: v.descriptor_code, cefr_descriptor: v.descriptor_code, domain: v.domain, difficulty_est: v.difficulty_est, passage_id: v.passage_id, media_path: v.media_path, media_alt: v.media_alt, stimulus: v.stimulus, latest_review_note: note || null, reviewed_by: user.id, reviewed_at: now, updated_at: now }).eq('id', id);
    if (up.error) return bad(up.error.message, 500);
    const k = await db.from('question_bank_answer_keys').upsert({ item_id: id, correct_option_id: v.correct, updated_at: now }, { onConflict: 'item_id' }); if (k.error) return bad(k.error.message, 500);
    await reviewEvent(db, [id], `edited:${cur.status}`, note, user.id);
    return NextResponse.json({ success: true, note_ar: 'حُفظ البند.' });
  }
  if (action === 'item_status') {
    const status = String(b.status || ''); if (!STATUSES.includes(status)) return bad('حالة غير معروفة');
    const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).map((x) => str(x, 60)).filter(Boolean).slice(0, 200); if (!ids.length) return bad('لا بنود');
    if (status === 'approved') {
      const { data: keys } = await db.from('question_bank_answer_keys').select('item_id').in('item_id', ids); const have = new Set(((keys || []) as any[]).map((k) => k.item_id));
      const { data: prod } = await db.from('question_bank_items').select('id').in('id', ids).in('skill', [...PRODUCTIVE_SKILLS]); for (const r of (prod || []) as any[]) have.add(r.id); /* المهام تُقدَّر بالسُلّم لا بمفتاح */
      const missing = ids.filter((x) => !have.has(x)); if (missing.length) return bad(`لا يمكن اعتماد بند بلا مفتاح (${missing.length})`);
    }
    const up = await db.from('question_bank_items').update({ status, latest_review_note: note || null, reviewed_by: user.id, reviewed_at: now, updated_at: now }).in('id', ids); if (up.error) return bad(up.error.message, 500);
    await reviewEvent(db, ids, status, note, user.id);
    return NextResponse.json({ success: true, count: ids.length, note_ar: `حُدِّثت حالة ${ids.length} بندًا → ${status}.` });
  }
  if (action === 'batch_status') {
    const status = String(b.status || ''); if (!['approved', 'in_review', 'archived'].includes(status)) return bad('حالة غير معروفة');
    const batch = str(b.batch, 40); if (!batch) return bad('دفعة مفقودة'); const level = isBankLevel(b.level) ? String(b.level) : null;
    const from = status === 'approved' ? ['in_review', 'draft'] : status === 'archived' ? ['approved', 'in_review', 'draft'] : ['approved', 'draft'];
    let sel = batchFilter(db.from('question_bank_items').select('id'), batch).in('status', from); if (level) sel = sel.eq('level', level);
    const { data: rows, error } = await sel.limit(2000); if (error) return bad(error.message, 500);
    let ids = ((rows || []) as any[]).map((r) => r.id);
    if (status === 'approved' && ids.length) { const { data: keys } = await db.from('question_bank_answer_keys').select('item_id').in('item_id', ids); const have = new Set(((keys || []) as any[]).map((k) => k.item_id)); const { data: prod } = await db.from('question_bank_items').select('id').in('id', ids).in('skill', [...PRODUCTIVE_SKILLS]); for (const r of (prod || []) as any[]) have.add(r.id); ids = ids.filter((x) => have.has(x)); }
    if (!ids.length) return NextResponse.json({ success: true, count: 0, note_ar: 'لا بنود مطابقة.' });
    for (let i = 0; i < ids.length; i += 200) { const part = ids.slice(i, i + 200); const up = await db.from('question_bank_items').update({ status, latest_review_note: note || `دفعة ${batch}`, reviewed_by: user.id, reviewed_at: now, updated_at: now }).in('id', part); if (up.error) return bad(up.error.message, 500); await reviewEvent(db, part, `batch:${status}`, note || `دفعة ${batch}`, user.id); }
    return NextResponse.json({ success: true, count: ids.length, note_ar: `${status === 'approved' ? 'اعتُمد' : status === 'archived' ? 'أُرشف' : 'أُعيد للمراجعة'} ${ids.length} بندًا من دفعة ${batch}${level ? ` (${level})` : ''}.` });
  }
  if (action === 'task_update' || action === 'task_create') {
    const create = action === 'task_create';
    let id = str(b.id, 60); let level = isBankLevel(b.level) ? String(b.level) : null; let skill = isProductiveSkill(b.skill) ? String(b.skill) : null; let curStatus = 'draft';
    if (!create) {
      if (!id) return bad('معرّف مفقود');
      const { data: cur } = await db.from('question_bank_items').select('id, level, skill, status').eq('id', id).maybeSingle(); if (!cur) return bad('المهمة غير موجودة', 404);
      if (!isProductiveSkill(cur.skill)) return bad('هذا بند لا مهمة'); level = cur.level; skill = cur.skill; curStatus = cur.status;
    }
    if (!level || !skill || !isProductiveSkill(skill)) return bad('المستوى أو المهارة غير صالح');
    const question_text = str(b.question_text, 1500); if (question_text.length < 8) return bad('نص المهمة قصير');
    const vt = validateTask(skill, level, b.task); if (!vt.task) return bad(vt.errors.join(' · ') || 'بيانات المهمة ناقصة');
    const descriptor_code = str(b.descriptor_code, 40) || null; const domain = DOMAINS.includes(String(b.domain)) ? String(b.domain) : null;
    const media_path = str(b.media_path, 300) || null; const media_alt = str(b.media_alt, 200) || null; const stimulus = media_path ? { image: media_path, alt: media_alt } : null;
    if (create) {
      const pre = `AR-${skill === 'writing' ? 'WR' : 'SP'}-${level === FLOOR_LEVEL ? 'PRE' : level}-S`;
      const { count } = await db.from('question_bank_items').select('id', { count: 'exact', head: true }).eq('content_version', NEW_VERSION).like('item_code', `${pre}%`);
      const item_code = `${pre}${String((count || 0) + 1).padStart(3, '0')}`;
      const ins = await db.from('question_bank_items').insert({ item_code, content_version: NEW_VERSION, level, skill, question_text, options: [], item_type: PRODUCTIVE_ITEM_TYPES[skill], status: 'draft', source_kind: 'manual', descriptor_code, cefr_descriptor: descriptor_code, domain, task: vt.task, media_path, media_alt, stimulus, created_by: user.id }).select('id, item_code').single();
      if (ins.error || !ins.data) return bad(ins.error?.message || 'تعذّر الإنشاء', 500);
      await reviewEvent(db, [ins.data.id], 'draft', note, user.id);
      return NextResponse.json({ success: true, id: ins.data.id, item_code: ins.data.item_code, note_ar: `أُنشئت المهمة ${ins.data.item_code} (مسودّة).` });
    }
    const up = await db.from('question_bank_items').update({ question_text, task: vt.task, descriptor_code, cefr_descriptor: descriptor_code, domain, media_path, media_alt, stimulus, latest_review_note: note || null, reviewed_by: user.id, reviewed_at: now, updated_at: now }).eq('id', id);
    if (up.error) return bad(up.error.message, 500);
    await reviewEvent(db, [id], `edited:${curStatus}`, note, user.id);
    return NextResponse.json({ success: true, note_ar: 'حُفظت المهمة.' });
  }
  if (action === 'item_delete') {
    const id = str(b.id, 60); if (!id) return bad('معرّف مفقود');
    const { data: it } = await db.from('question_bank_items').select('id, item_code, status').eq('id', id).maybeSingle(); if (!it) return bad('البند غير موجود', 404);
    if (it.status === 'approved') return bad('بند معتمد لا يُحذف — أرشِفه بدل الحذف');
    const { count } = await db.from('placement_secure_answers').select('session_id', { count: 'exact', head: true }).eq('question_id', id);
    if ((count || 0) > 0) return bad(`أُجيب عن هذا البند في ${count} جلسة — لا يُحذف حفاظًا على التقارير؛ أرشِفه`);
    /* التوابع صراحةً (FK on delete cascade موجود في الإنتاج؛ الحذف الصريح يجعل السلوك واحدًا في كل بيئة) */
    for (const t of ['question_bank_answer_keys', 'question_bank_review_events', 'question_bank_form_items']) await db.from(t).delete().eq('item_id', id);
    const del = await db.from('question_bank_items').delete().eq('id', id); if (del.error) return bad(del.error.message, 500);
    return NextResponse.json({ success: true, note_ar: `حُذف البند ${it.item_code} نهائيًا.` });
  }
  if (action === 'item_create') {
    const level = isBankLevel(b.level) ? String(b.level) : null; const skill = isSkill(b.skill) ? String(b.skill) : null; if (!level || !skill) return bad('المستوى أو المهارة غير صالح');
    const type = (ITEM_TYPES as readonly string[]).includes(String(b.item_type)) ? (String(b.item_type) as ItemType) : 'mcq';
    const f = parseItemFields(b, type); if ('error' in f) return bad(f.error!); const v = f.value!;
    if (skill === 'listening' && !v.passage_id) return bad('بند الاستماع يحتاج مقطعًا');
    const pre = `AR-${skill === 'reading' ? 'RD' : skill === 'listening' ? 'LI' : 'LU'}-${level === FLOOR_LEVEL ? 'PRE' : level}-S`;
    const { count } = await db.from('question_bank_items').select('id', { count: 'exact', head: true }).eq('content_version', NEW_VERSION).like('item_code', `${pre}%`);
    const item_code = `${pre}${String((count || 0) + 1).padStart(3, '0')}`;
    const ins = await db.from('question_bank_items').insert({ item_code, content_version: NEW_VERSION, level, skill, passage_id: v.passage_id, question_text: v.question_text, options: v.options, item_type: type, status: 'draft', source_kind: 'manual', descriptor_code: v.descriptor_code, cefr_descriptor: v.descriptor_code, domain: v.domain, difficulty_est: v.difficulty_est, media_path: v.media_path, media_alt: v.media_alt, stimulus: v.stimulus, created_by: user.id, author_notes: { authored_by: 'staff' } }).select('id').single();
    if (ins.error || !ins.data) return bad(ins.error?.message || 'تعذّر الإنشاء', 500);
    const k = await db.from('question_bank_answer_keys').insert({ item_id: ins.data.id, correct_option_id: v.correct }); if (k.error) return bad(k.error.message, 500);
    await reviewEvent(db, [ins.data.id], 'draft', note, user.id);
    return NextResponse.json({ success: true, id: ins.data.id, item_code, note_ar: `أُنشئ ${item_code} كمسودّة.` });
  }
  if (action === 'passage_update') {
    const id = str(b.id, 80); if (!id) return bad('معرّف مفقود'); const patch: Record<string, unknown> = { updated_at: now };
    if (typeof b.title === 'string') patch.title = str(b.title, 200); if (typeof b.body === 'string') { patch.body = String(b.body).trim().slice(0, 6000); patch.transcript = patch.body; }
    if (STATUSES.includes(String(b.status))) patch.status = String(b.status); if (b.meta && typeof b.meta === 'object') patch.meta = b.meta;
    if (typeof b.audio_public_path === 'string') patch.audio_public_path = str(b.audio_public_path, 300) || null;
    const up = await db.from('miaar_passages').update(patch).eq('id', id); if (up.error) return bad(up.error.message, 500);
    return NextResponse.json({ success: true, note_ar: 'حُفظ المقطع.' });
  }
  if (action === 'passage_create') {
    const id = str(b.id, 80).replace(/[^A-Za-z0-9_-]/g, ''); const level = isBankLevel(b.level) ? String(b.level) : null; const skill = b.skill === 'reading' || b.skill === 'listening' ? String(b.skill) : null;
    const title = str(b.title, 200); const body = String(b.body || '').trim().slice(0, 6000);
    if (!id || !level || !skill || title.length < 2 || body.length < 2) return bad('بيانات المقطع ناقصة');
    const ins = await db.from('miaar_passages').insert({ id, level, skill, title, body, transcript: skill === 'listening' ? body : null, status: 'draft', source: 'staff', version: NEW_VERSION, meta: b.meta && typeof b.meta === 'object' ? b.meta : null });
    if (ins.error) return bad(ins.error.message, 500);
    return NextResponse.json({ success: true, id, note_ar: `أُنشئ المقطع ${id} كمسودّة.` });
  }
  if (action === 'audio_upload') {
    const id = str(b.passage_id, 80); const b64 = typeof b.base64 === 'string' ? b.base64.replace(/^data:[^,]*,/, '') : ''; if (!id || !b64) return bad('مقطع أو ملف مفقود');
    let bytes: Buffer; try { bytes = Buffer.from(b64, 'base64'); } catch { return bad('ملف غير صالح'); }
    if (bytes.length < 1000 || bytes.length > 4 * 1024 * 1024) return bad('حجم الملف خارج الحدّ (1KB–4MB)');
    const isMp3 = (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0); if (!isMp3) return bad('يُقبل MP3 فقط');
    const path = `audio/${id}.mp3`;
    const up = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: 'audio/mpeg', upsert: true }); if (up.error) return bad(up.error.message, 500);
    const pu = await db.from('miaar_passages').update({ audio_storage_path: path, audio_public_path: null, meta: { ...(await db.from('miaar_passages').select('meta').eq('id', id).maybeSingle()).data?.meta, engine: 'upload', uploaded_at: now }, updated_at: now }).eq('id', id); if (pu.error) return bad(pu.error.message, 500);
    return NextResponse.json({ success: true, path, note_ar: 'رُفع الصوت وربُط بالمقطع (سيُقدَّم برابط موقَّع).' });
  }
  return bad('إجراء غير معروف');
}
