// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * بنك مِعيار (خادم فقط): البنود المعتمدة بمفاتيحها · المقاطع من الجدول · روابط الوسائط الموقَّعة (دلو miaar-media)
 *  · بناء النموذج العام للمتقدّم (بلا مفاتيح) · تغطية البنك (مستوى×مهارة×نوع) للوحة.
 */
import { LEVELS, SKILLS, PRODUCTIVE_SKILLS, WITHDRAWN_CODES, M1_ITEM_TYPES, isBankLevel, isSkill, isOptionId, FORM_PLAN, FLOOR_LEVEL, FLOOR_PLAN, playerPolicy } from './registry';
import type { PoolItem, PublicForm, PublicQuestion, PublicPassage, SecureItem, Option, ItemType, BankLevel, Skill } from './registry';

export const MEDIA_BUCKET = 'miaar-media';
const SIGN_SECONDS = 3 * 60 * 60;
/** نوع البند ← عدد الخيارات المقبول */
const OPTION_COUNT: Partial<Record<ItemType, [number, number]>> = { mcq: [4, 4], picture_choice: [2, 4], picture_label: [2, 4], true_false_notgiven: [3, 3] };

export function optionList(value: unknown, type: ItemType): Option[] | null {
  if (!Array.isArray(value)) return null; const [min, max] = OPTION_COUNT[type] || [2, 6]; if (value.length < min || value.length > max) return null;
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']; const out: Option[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const o = value[i]; if (!o || typeof o !== 'object') return null; const r = o as Record<string, unknown>;
    const id = typeof r.id === 'string' && ids.includes(r.id) ? r.id : ids[i];
    const text = typeof r.text === 'string' ? r.text.trim() : ''; const image = typeof r.image === 'string' && r.image.trim() ? r.image.trim() : null;
    if (type === 'picture_choice' ? !image : !text) return null;
    out.push({ id, text, image, alt: typeof r.alt === 'string' ? r.alt.trim() : null });
  }
  return new Set(out.map((o) => o.id)).size === out.length ? out : null;
}

export type PassageRow = { id: string; level: string; skill: 'reading' | 'listening'; title: string; body: string; audio_public_path: string | null; audio_storage_path: string | null; status: string; meta?: Record<string, unknown> | null };
/* «سرعة مِعيار» (2026-11-02): البنك المعتمد لا يتغيّر إلا باعتماد بشري — فيُقرأ مرة ويُعاد استعماله 90 ثانية داخل الخادم نفسه
   (كان يُحمَّل كاملًا ≈700 بند مع كل إجابة وكل بدء). الاعتماد/السحب من لوحة البنك يُفرغ الذاكرة فورًا (invalidatePoolCache). */
const POOL_TTL_MS = 90_000;
let PASSAGES_CACHE: { at: number; value: Map<string, PassageRow> } | null = null;
let POOL_CACHE: { at: number; value: PoolItem[] } | null = null;
export function invalidatePoolCache(): void { PASSAGES_CACHE = null; POOL_CACHE = null; }
const fresh = (at: number) => Date.now() - at < POOL_TTL_MS;
export async function loadPassages(db: any): Promise<Map<string, PassageRow>> {
  if (PASSAGES_CACHE && fresh(PASSAGES_CACHE.at)) return PASSAGES_CACHE.value;
  const { data, error } = await db.from('miaar_passages').select('id, level, skill, title, body, audio_public_path, audio_storage_path, status, meta').eq('status', 'approved').limit(1000);
  if (error) throw new Error('passages_unavailable');
  const value = new Map(((data || []) as PassageRow[]).map((p) => [p.id, p])); PASSAGES_CACHE = { at: Date.now(), value }; return value;
}
const listeningReady = (p: PassageRow | undefined) => !!p && p.skill === 'listening' && !!p.body && (!!p.audio_public_path || !!p.audio_storage_path);
const readingReady = (p: PassageRow | undefined) => !!p && p.skill === 'reading' && !!p.body;

/** البنود المعتمدة الصالحة للتقديم في م1 (الأنواع الأربعة · مقاطع جاهزة · مفتاح صالح · ليست مسحوبة) */
export async function loadApprovedPool(db: any, passages?: Map<string, PassageRow>): Promise<PoolItem[]> {
  if (POOL_CACHE && fresh(POOL_CACHE.at)) return POOL_CACHE.value;
  const P = passages || await loadPassages(db);
  const [items, keys] = await Promise.all([
    db.from('question_bank_items').select('id, item_code, level, skill, passage_id, question_text, options, item_type, stimulus, media_path, media_alt, descriptor_code, cefr_descriptor').eq('status', 'approved').limit(2000),
    db.from('question_bank_answer_keys').select('item_id, correct_option_id').limit(5000),
  ]);
  if (items.error || keys.error) throw new Error('approved_pool_unavailable');
  const keyOf = new Map<string, string>(((keys.data || []) as any[]).map((r) => [r.item_id, r.correct_option_id]));
  const seen = new Set<string>(); const pool: PoolItem[] = [];
  for (const row of (items.data || []) as any[]) {
    const code = typeof row.item_code === 'string' ? row.item_code.trim() : ''; if (!code || seen.has(code) || WITHDRAWN_CODES.has(code)) continue;
    const type = (M1_ITEM_TYPES as readonly string[]).includes(row.item_type) ? (row.item_type as ItemType) : null; if (!type) continue;
    const options = optionList(row.options, type); const correct = keyOf.get(row.id);
    if (!options || !isOptionId(correct) || !options.some((o) => o.id === correct) || !isBankLevel(row.level) || !isSkill(row.skill)) continue;
    const passageId = typeof row.passage_id === 'string' && row.passage_id.trim() ? row.passage_id.trim() : null;
    if (row.skill === 'listening' && !listeningReady(P.get(passageId || ''))) continue;
    if (row.skill === 'reading' && passageId && !readingReady(P.get(passageId))) continue;
    if (typeof row.question_text !== 'string' || row.question_text.trim().length < 2) continue;
    const stim = row.stimulus && typeof row.stimulus === 'object' ? row.stimulus : null; const image = (stim?.image as string) || row.media_path || null;
    if ((type === 'picture_label') && !image) continue;
    seen.add(code);
    pool.push({ id: row.id, code, level: row.level, skill: row.skill, type, passageId, questionText: row.question_text.trim(), options, correctOptionId: correct, stimulus: image ? { image, alt: (stim?.alt as string) || row.media_alt || null } : null, descriptor: row.descriptor_code || row.cefr_descriptor || null });
  }
  POOL_CACHE = { at: Date.now(), value: pool };
  return pool;
}

/** رابط وسيط: مسار عام (/miaar/...) كما هو، وإلا توقيع من الدلو */
export async function mediaUrl(db: any, path: string | null | undefined): Promise<string | null> {
  if (!path) return null; if (path.startsWith('/') || path.startsWith('http')) return path;
  try { const r = await db.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGN_SECONDS); return r.error ? null : (r.data?.signedUrl ?? null); } catch { return null; }
}
/** «سرعة مِعيار»: كل روابط المخزن في النموذج تُوقَّع بطلب واحد بدل طلب لكل صورة/مقطع (كان النموذج الكامل يحتاج عشرات الرحلات المتتابعة) */
export async function mediaUrls(db: any, paths: readonly (string | null | undefined)[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>(); const toSign: string[] = [];
  for (const p of paths) { if (!p || out.has(p)) continue; if (p.startsWith('/') || p.startsWith('http')) out.set(p, p); else { out.set(p, null); toSign.push(p); } }
  if (!toSign.length) return out;
  try {
    const r = await db.storage.from(MEDIA_BUCKET).createSignedUrls(toSign, SIGN_SECONDS);
    if (!r.error && Array.isArray(r.data)) for (const row of r.data as { path?: string | null; signedUrl?: string | null; error?: string | null }[]) if (row?.path && row.signedUrl && !row.error) out.set(row.path, row.signedUrl);
    else for (const p of toSign) out.set(p, await mediaUrl(db, p));  /* احتياط: مخزن لا يدعم التوقيع الجماعي */
  } catch { for (const p of toSign) out.set(p, await mediaUrl(db, p)); }
  return out;
}

/** النموذج العام من رموز مسندة: الأسئلة بلا مفاتيح + المقاطع بروابط الصوت */
export async function formFromPool(db: any, pool: readonly PoolItem[], codes: readonly string[], passages?: Map<string, PassageRow>): Promise<PublicForm | null> {
  const P = passages || await loadPassages(db); const byCode = new Map(pool.map((i) => [i.code, i]));
  const selected = codes.map((c) => byCode.get(c)).filter((i): i is PoolItem => !!i); if (selected.length !== codes.length) return null;
  const passageIds = [...new Set(selected.map((i) => i.passageId).filter((x): x is string => !!x))];
  const passRows = passageIds.map((id) => P.get(id)); if (passRows.some((p) => !p)) return null;
  /* طلب توقيع واحد لكل الوسائط (مقاطع الاستماع · صور الخيارات · صور المنبّه) */
  const paths: (string | null | undefined)[] = [];
  for (const p of passRows as PassageRow[]) if (p.skill === 'listening') paths.push(p.audio_public_path || p.audio_storage_path);
  for (const i of selected) { for (const o of i.options) paths.push(o.image); if (i.stimulus) paths.push(i.stimulus.image); }
  const urls = await mediaUrls(db, paths); const urlOf = (p: string | null | undefined) => (p ? urls.get(p) ?? null : null);
  const out: PublicPassage[] = (passRows as PassageRow[]).map((p) => { const pol = playerPolicy(p.level, (p.meta || null) as any); return { id: p.id, level: p.level, skill: p.skill, title: p.title, text: p.body, audioUrl: p.skill === 'listening' ? urlOf(p.audio_public_path || p.audio_storage_path) : null, player: p.skill === 'listening' ? { ...pol, twice: (p.meta as any)?.twice === true } : undefined }; });
  const questions: PublicQuestion[] = selected.map((i) => ({ id: i.code, level: i.level, skill: i.skill, type: i.type, passageId: i.passageId, questionText: i.questionText,
    options: i.options.map((o) => ({ id: o.id, text: o.text, image: o.image ? urlOf(o.image) : null, alt: o.alt || null })) as Option[],
    stimulus: i.stimulus ? { image: urlOf(i.stimulus.image), alt: i.stimulus.alt || null } : null }));
  return { questions, passages: out };
}
export const secureItems = (pool: readonly PoolItem[], codes: readonly string[]): SecureItem[] | null => {
  const byCode = new Map(pool.map((i) => [i.code, i])); const items = codes.map((c) => byCode.get(c)).filter((i): i is PoolItem => !!i);
  return items.length === codes.length ? items.map((i) => ({ id: i.code, level: i.level, skill: i.skill, correctOptionId: i.correctOptionId })) : null;
};

/** تغطية البنك للوحة: لكل مستوى×مهارة عدد المعتمد مقابل الخطة، وبالنوع */
export type Coverage = { cells: Array<{ level: BankLevel; skill: Skill; approved: number; in_review: number; needed: number; by_type: Record<string, number> }>; productive: Array<{ level: BankLevel; skill: 'writing' | 'speaking'; approved: number; in_review: number; needed: number }>; total_approved: number; total_all: number; by_status: Record<string, number>; by_batch: Record<string, Record<string, number>>; passages: number; descriptors_used: number };
/** دفعة البند: athar-m2a (الجديد) · miaar-legacy (الدفعة التأسيسية — وسم تاريخي، ملك أَثَر) · غير ذلك إصدار المحتوى */
export const itemBatch = (r: { content_version?: string | null; legacy_extra?: any }): string => (r.legacy_extra && typeof r.legacy_extra === 'object' && typeof r.legacy_extra.batch === 'string') ? r.legacy_extra.batch : (r.content_version || '—');
export async function bankCoverage(db: any): Promise<Coverage> {
  const [{ data: items }, { data: passages }] = await Promise.all([
    db.from('question_bank_items').select('level, skill, status, item_type, descriptor_code, content_version, legacy_extra').limit(5000),
    db.from('miaar_passages').select('id').eq('status', 'approved').limit(2000),
  ]);
  const rows = (items || []) as any[]; const by_status: Record<string, number> = {}; const used = new Set<string>(); const by_batch: Coverage['by_batch'] = {};
  for (const r of rows) { by_status[r.status] = (by_status[r.status] || 0) + 1; if (r.descriptor_code) used.add(r.descriptor_code); const b = itemBatch(r); by_batch[b] = by_batch[b] || {}; by_batch[b][r.status] = (by_batch[b][r.status] || 0) + 1; }
  const cells: Coverage['cells'] = [];
  for (const level of [FLOOR_LEVEL, ...LEVELS] as BankLevel[]) for (const skill of SKILLS) {
    const here = rows.filter((r) => r.level === level && r.skill === skill); const approved = here.filter((r) => r.status === 'approved'); const by_type: Record<string, number> = {};
    for (const r of approved) by_type[r.item_type || 'mcq'] = (by_type[r.item_type || 'mcq'] || 0) + 1;
    cells.push({ level, skill, approved: approved.length, in_review: here.filter((r) => r.status === 'in_review').length, needed: level === FLOOR_LEVEL ? FLOOR_PLAN[skill] : FORM_PLAN[level][skill], by_type });
  }
  /* م4-أ: خلايا المهام الإنتاجية — المطلوب 3 معتمدة لكل خلية (مهمة واحدة تُسحب عشوائيًا من ثلاث على الأقل) */
  const productive: Coverage['productive'] = [];
  for (const level of [FLOOR_LEVEL, ...LEVELS] as BankLevel[]) for (const skill of PRODUCTIVE_SKILLS) {
    const here = rows.filter((r) => r.level === level && r.skill === skill);
    productive.push({ level, skill, approved: here.filter((r) => r.status === 'approved').length, in_review: here.filter((r) => r.status === 'in_review').length, needed: 3 });
  }
  return { cells, productive, total_approved: by_status.approved || 0, total_all: rows.length, by_status, by_batch, passages: (passages || []).length, descriptors_used: used.size };
}
