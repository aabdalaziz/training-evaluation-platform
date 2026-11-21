// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — م13-ج «المستورِد»: حزمة بنود miaar-pack-1 → بنك مِعيار (كلّها in_review · المستورِد = المؤلّف فلا يعتمد ما استورده)
 *  normalizePack(raw)        فحص بنيوي صِرف (بلا قاعدة): الإصدار · الدفعة · المقاطع · البنود (النوع · الخيارات · المفتاح · الواصف · الوحدات · المقطع)
 *                            + تحذيرات غير مانعة: توزيع المفتاح · حصّة mcq · التشكيل بالمستوى · تكرار داخل الحزمة.
 *  importPack(db, pack, user, {dryRun})  فحص ضدّ القاعدة (رموز موجودة · مقاطع · واصفات · تكرار الجذع) ثم الإدخال:
 *                            question_bank_import_batches (سجلّ الدفعة) · import_errors (ما رُفض) · miaar_passages (الجديد فقط) · question_bank_items (in_review)
 *                            · answer_keys · review_events. التشغيل الجافّ يفحص كل شيء ولا يكتب حرفًا.
 *  الحزمة:
 *   { version:'miaar-pack-1', source:'athar-m13a-A1-1', content_version:'athar-m13a',
 *     passages:[{id, level, skill:'reading'|'listening', title, body, audio_public_path?, meta?}],
 *     items:[{item_code, level, skill, item_type, question_text, options:[{id,text,image?,alt?}], correct, descriptor_code, unit_codes?, domain?, difficulty_est?, passage_id?, media_path?, media_alt?, rationale?:{a:'…'}}],
 *     م13-ب: matching يضيف left:[{id,text|image,alt?} ×3..4] والمفتاح «b-a-d-c» (يمين كلّ أيسر بترتيبه) · ordering: options القطع مبعثرة والمفتاح «c-a-d-b» تبديل كامل.
 *     م14: cloze_bank: question_text فيه 2–4 فراغات «___» و options مصرف كلمات (الفراغات + 1–2 مشتّت) والمفتاح كلمة كلّ فراغ بترتيبه · picture_sequence: options صور مبعثرة (3–5) والمفتاح تبديل كامل.
 *     tasks?:[{item_code, level, skill:'writing'|'speaking', question_text, task, descriptor_code?, unit_codes?, domain?, media_path?, media_alt?}] }
 *  القرار الأكاديمي بيد الطاقم: لا يُعتمد بند هنا، ولا يُمَسّ بند قائم.
 */
import { PLAYER_ITEM_TYPES, isCompositeType, isSlotType, isPermutationType, countBlanks, CLOZE_BLANKS, isResponseFor, isIdentityKey, parseComposite, isBankLevel, isSkill, isProductiveSkill, PRODUCTIVE_ITEM_TYPES, FLOOR_LEVEL } from './registry';
import type { ItemType, BankLevel, LeftItem } from './registry';
import { optionList, leftList } from './bank';
import { isUnitCode, unitLevelOf } from './syllabus';
import { validateTask } from './rubric';

export const PACK_VERSION = 'miaar-pack-1';
export const PACK_LIMITS = { items: 600, passages: 200, tasks: 100 } as const;
/** دفعات لا يجوز للمستورِد الكتابة فيها (تاريخية/محجوزة) */
export const RESERVED_VERSIONS = ['athar-m2a', 'athar-m4a', 'athar-staff', 'miaar-legacy'] as const;
export const DOMAINS = ['personal', 'public', 'educational', 'professional'] as const;
/** حدود التحذير (MIAAR-BANK-STANDARD §2 و§4): حصّة mcq ≤ 60% · أكثر حرف مفتاح ≤ 40% · التشكيل بالمستوى */
export const MCQ_MAX_SHARE = 0.6; export const KEY_MAX_SHARE = 0.4;
export const FULL_TASHKEEL_LEVELS: readonly string[] = [FLOOR_LEVEL, 'A1']; export const NO_TASHKEEL_LEVELS: readonly string[] = ['B1', 'B2', 'C1', 'C2'];
const TASHKEEL = /[\u064B-\u0652\u0670]/g;

export type Problem = { at: string; msg: string };
export type PackPassage = { id: string; level: BankLevel; skill: 'reading' | 'listening'; title: string; body: string; audio_public_path: string | null; meta: Record<string, unknown> | null };
export type PackItem = { item_code: string; level: BankLevel; skill: 'grammar_vocab' | 'reading' | 'listening'; item_type: ItemType; question_text: string; options: Array<{ id: string; text: string; image?: string; alt?: string | null }>; correct: string; left?: LeftItem[]; descriptor_code: string; unit_codes: string[]; domain: string | null; difficulty_est: number | null; passage_id: string | null; media_path: string | null; media_alt: string | null; rationale: Record<string, string> };
export type PackTask = { item_code: string; level: BankLevel; skill: 'writing' | 'speaking'; question_text: string; task: Record<string, unknown>; descriptor_code: string | null; unit_codes: string[]; domain: string | null; media_path: string | null; media_alt: string | null };
export type Pack = { version: string; source: string; content_version: string; passages: PackPassage[]; items: PackItem[]; tasks: PackTask[] };
export type Summary = { source: string; content_version: string; passages: number; items: number; tasks: number; by_level: Record<string, number>; by_type: Record<string, number>; warnings: Problem[] };

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const DESC_RE = /^(RD|LI|LU|WR|SP)-(PRE_A1|A1|A2|B1|B2|C1|C2)-\d{2}$/;
const MODE_OF: Record<string, string> = { reading: 'RD', listening: 'LI', grammar_vocab: 'LU', writing: 'WR', speaking: 'SP' };
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,39}$/;
/** الجذع المطبَّع للكشف عن التكرار: بلا تشكيل ولا ترقيم، همزات/ياء/تاء مربوطة موحَّدة، فراغات مضغوطة */
export const normStem = (t: string): string => t.replace(TASHKEEL, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const hasTashkeel = (t: string) => TASHKEEL.test(t) && (t.match(TASHKEEL) || []).length >= 2;

function unitCodes(v: unknown, level: string, at: string, problems: Problem[]): string[] {
  if (v == null) return []; if (!Array.isArray(v)) { problems.push({ at, msg: 'unit_codes يجب أن تكون قائمة' }); return []; }
  const out = [...new Set(v.filter(isUnitCode))].slice(0, 4);
  if (out.length !== new Set(v).size) problems.push({ at, msg: 'رمز وحدة غير صالح (الصيغة A1-U01)' });
  for (const c of out) if (unitLevelOf(c) !== level) problems.push({ at, msg: `الوحدة ${c} من مستوى آخر` });
  return out;
}
function descriptor(v: unknown, level: string, skill: string, at: string, problems: Problem[], required: boolean): string | null {
  const d = s(v, 40); if (!d) { if (required) problems.push({ at, msg: 'الواصف مطلوب (مثل LU-A1-02)' }); return null; }
  const m = d.match(DESC_RE); if (!m) { problems.push({ at, msg: `صيغة الواصف غير صحيحة: ${d}` }); return null; }
  if (m[1] !== MODE_OF[skill]) problems.push({ at, msg: `الواصف ${d} لا يناسب مهارة ${skill}` }); if (m[2] !== level) problems.push({ at, msg: `الواصف ${d} من مستوى آخر` });
  return d;
}

/** فحص بنيوي صِرف — لا يلمس القاعدة */
export function normalizePack(raw: unknown): { ok: true; pack: Pack; problems: Problem[]; warnings: Problem[] } | { ok: false; problems: Problem[]; warnings: Problem[] } {
  const problems: Problem[] = []; const warnings: Problem[] = [];
  if (!raw || typeof raw !== 'object') return { ok: false, problems: [{ at: 'pack', msg: 'الحزمة ليست كائن JSON' }], warnings };
  const r = raw as Record<string, unknown>;
  if (r.version !== PACK_VERSION) problems.push({ at: 'version', msg: `الإصدار المدعوم ${PACK_VERSION}` });
  const source = s(r.source, 60); if (source.length < 3) problems.push({ at: 'source', msg: 'اسم المصدر مطلوب (مثل athar-m13a-A1-1)' });
  const content_version = s(r.content_version, 40);
  if ((RESERVED_VERSIONS as readonly string[]).includes(content_version)) problems.push({ at: 'content_version', msg: `الدفعة ${content_version} محجوزة — لا يُستورد فيها` });
  else if (!/^athar-[a-z0-9][a-z0-9-]{1,30}$/.test(content_version)) problems.push({ at: 'content_version', msg: 'اسم الدفعة بالصيغة athar-xxx' });
  const passages: PackPassage[] = []; const pIds = new Set<string>();
  const rawP = Array.isArray(r.passages) ? r.passages : []; if (rawP.length > PACK_LIMITS.passages) problems.push({ at: 'passages', msg: `الحدّ ${PACK_LIMITS.passages} مقطعًا` });
  rawP.slice(0, PACK_LIMITS.passages).forEach((p: any, i: number) => {
    const at = `passages[${i}]`; const id = s(p?.id, 80).replace(/[^A-Za-z0-9_-]/g, '');
    if (id.length < 3) { problems.push({ at, msg: 'معرّف المقطع مطلوب (حروف لاتينية وأرقام)' }); return; } if (pIds.has(id)) { problems.push({ at, msg: `مقطع مكرّر ${id}` }); return; } pIds.add(id);
    const level = isBankLevel(p?.level) ? (p.level as BankLevel) : null; const skill = p?.skill === 'reading' || p?.skill === 'listening' ? p.skill : null;
    if (!level || !skill) { problems.push({ at, msg: `${id}: المستوى أو المهارة غير صالح` }); return; }
    const title = s(p?.title, 200); const body = s(p?.body, 6000); if (title.length < 2 || body.length < 2) { problems.push({ at, msg: `${id}: العنوان أو النص ناقص` }); return; }
    const audio = s(p?.audio_public_path, 300) || null; if (skill === 'listening' && !audio) warnings.push({ at, msg: `${id}: مقطع استماع بلا مسار صوت — يُرفع لاحقًا من اللوحة` });
    if (NO_TASHKEEL_LEVELS.includes(level) && hasTashkeel(body)) warnings.push({ at, msg: `${id}: نصّ ${level} مشكول — المعيار: بلا تشكيل من B1` });
    passages.push({ id, level, skill, title, body, audio_public_path: audio, meta: p?.meta && typeof p.meta === 'object' ? p.meta : null });
  });
  const items: PackItem[] = []; const codes = new Set<string>(); const stems = new Map<string, string>();
  const rawI = Array.isArray(r.items) ? r.items : []; if (rawI.length > PACK_LIMITS.items) problems.push({ at: 'items', msg: `الحدّ ${PACK_LIMITS.items} بندًا` });
  rawI.slice(0, PACK_LIMITS.items).forEach((it: any, i: number) => {
    const code = s(it?.item_code, 40); const at = `items[${i}]${code ? ' ' + code : ''}`;
    if (!CODE_RE.test(code)) { problems.push({ at, msg: 'رمز البند مطلوب (مثل AR-LU-A1-M13-001)' }); return; } if (codes.has(code)) { problems.push({ at, msg: 'رمز مكرّر داخل الحزمة' }); return; } codes.add(code);
    const level = isBankLevel(it?.level) ? (it.level as BankLevel) : null; const skill = isSkill(it?.skill) ? it.skill : null;
    if (!level || !skill) { problems.push({ at, msg: 'المستوى أو المهارة غير صالح' }); return; }
    const type = s(it?.item_type, 30) as ItemType;
    if (!(PLAYER_ITEM_TYPES as readonly string[]).includes(type)) { problems.push({ at, msg: `النوع ${type || '—'} غير مدعوم في المشغّل بعد` }); return; }
    const question_text = s(it?.question_text, 1200); if (question_text.length < 2) { problems.push({ at, msg: 'نص السؤال قصير' }); return; }
    const options = optionList(it?.options, type); if (!options) { problems.push({ at, msg: 'الخيارات غير صالحة لهذا النوع (العدد أو النص/الصورة)' }); return; }
    const texts = options.map((o) => normStem(o.text || o.image || '')); if (new Set(texts).size !== texts.length) problems.push({ at, msg: 'خياران متطابقان' });
    /* م13-ب: العمود الأيسر للمطابقة + المفتاح المركّب (MIAAR-M13B-SPEC §2) */
    const left = type === 'matching' ? leftList(it?.left) : null;
    if (type === 'matching' && !left) { problems.push({ at, msg: 'المطابقة تحتاج left من 3–4 عناصر (نصّ أو صورة) بلا تكرار' }); return; }
    if (left && (options.length < left.length || options.length > left.length + 1)) { problems.push({ at, msg: `خيارات المطابقة ${options.length} — المطلوب ${left.length} أو ${left.length + 1} (مشتّت واحد)` }); return; }
    /* م14: الفراغات — 2–4 «___» في النصّ، والمصرف = الفراغات + 1–2 مشتّت */
    const blanks = type === 'cloze_bank' ? countBlanks(question_text) : 0;
    if (type === 'cloze_bank' && (blanks < CLOZE_BLANKS[0] || blanks > CLOZE_BLANKS[1])) { problems.push({ at, msg: `الفراغات تحتاج ${CLOZE_BLANKS[0]}–${CLOZE_BLANKS[1]} فراغات «___» في النصّ (وُجد ${blanks})` }); return; }
    if (type === 'cloze_bank' && (options.length < blanks + 1 || options.length > blanks + 2)) { problems.push({ at, msg: `مصرف الكلمات ${options.length} — المطلوب ${blanks + 1} أو ${blanks + 2} (مشتّت أو اثنان)` }); return; }
    const slots = left?.length || blanks;
    const correct = typeof it?.correct === 'string' ? it.correct.trim() : '';
    if (!isResponseFor(type, options.map((o) => o.id), slots, correct)) { problems.push({ at, msg: isCompositeType(type) ? (type === 'matching' ? 'مفتاح المطابقة: معرّفات اليمين لكلّ عنصر أيسر بترتيبه بلا تكرار (مثل b-a-d-c)' : type === 'cloze_bank' ? `مفتاح الفراغات: كلمة كلّ فراغ بترتيبه (${blanks} معرّفات بلا تكرار، مثل c-a-d)` : 'مفتاح الترتيب: تبديل كامل لكلّ القطع (مثل c-a-d-b)') : 'المفتاح لا يطابق خيارًا' }); return; }
    if (isPermutationType(type) && isIdentityKey(correct, options.map((o) => o.id))) { problems.push({ at, msg: 'القطع مكتوبة بترتيبها الصحيح (a-b-c…) — ابعثرها في الحزمة' }); return; }
    if (isSlotType(type) && isIdentityKey(correct, options.map((o) => o.id))) warnings.push({ at, msg: `مفتاح ${type === 'matching' ? 'المطابقة' : 'الفراغات'} هو الهويّة a-b-c… — بعثر الخيارات` });
    const descriptor_code = descriptor(it?.descriptor_code, level, skill, at, problems, true) || '';
    const unit_codes = unitCodes(it?.unit_codes, level, at, problems);
    const domain = (DOMAINS as readonly string[]).includes(String(it?.domain)) ? String(it.domain) : null;
    const d = Number(it?.difficulty_est); const difficulty_est = Number.isInteger(d) && d >= 1 && d <= 5 ? d : null;
    const passage_id = s(it?.passage_id, 80) || null;
    if (skill === 'listening' && !passage_id) problems.push({ at, msg: 'بند الاستماع يحتاج مقطعًا' });
    if (skill === 'grammar_vocab' && passage_id) warnings.push({ at, msg: 'بند كفاية لغوية مربوط بمقطع — يُتجاهَل عادةً' });
    const media_path = s(it?.media_path, 300) || null; const media_alt = s(it?.media_alt, 200) || null;
    if ((type === 'picture_label') && !media_path) problems.push({ at, msg: 'تسمية الصورة تحتاج media_path' });
    if (media_path && !media_alt) warnings.push({ at, msg: 'صورة بلا وصف بديل (media_alt)' });
    const rationale: Record<string, string> = {}; const ratKeys = type === 'matching' ? (left || []).map((l) => l.id) : type === 'cloze_bank' ? Array.from({ length: blanks }, (_, i) => String(i + 1)) : isPermutationType(type) ? ['why'] : options.map((o) => o.id);
    if (it?.rationale && typeof it.rationale === 'object') for (const k of ratKeys) { const v = s((it.rationale as any)[k], 300); if (v) rationale[k] = v; }
    if (Object.keys(rationale).length < ratKeys.length) warnings.push({ at, msg: isPermutationType(type) ? 'مبرّر الترتيب (rationale.why) ناقص' : type === 'matching' ? 'مبرّر ناقص لبعض عناصر المطابقة' : type === 'cloze_bank' ? 'مبرّر ناقص لبعض الفراغات' : 'مبرّر ناقص لبعض المشتّتات' });
    const key = `${level}:${normStem(question_text)}`; const prev = stems.get(key); if (prev) problems.push({ at, msg: `جذع مكرّر داخل الحزمة (مثل ${prev})` }); else stems.set(key, code);
    const full = `${question_text} ${options.map((o) => o.text).join(' ')} ${(left || []).map((l) => l.text).join(' ')}`;
    if (FULL_TASHKEEL_LEVELS.includes(level) && !hasTashkeel(full)) warnings.push({ at, msg: `بند ${level} بلا تشكيل — المعيار: تشكيل كامل` });
    if (NO_TASHKEEL_LEVELS.includes(level) && hasTashkeel(full)) warnings.push({ at, msg: `بند ${level} مشكول — المعيار: بلا تشكيل من B1` });
    items.push({ item_code: code, level, skill, item_type: type, question_text, options: options.map((o) => ({ id: o.id, text: o.text, ...(o.image ? { image: o.image, alt: o.alt || null } : {}) })), correct, ...(left ? { left: left.map((l) => ({ id: l.id, text: l.text, ...(l.image ? { image: l.image, alt: l.alt || null } : {}) })) } : {}), descriptor_code, unit_codes, domain, difficulty_est, passage_id, media_path, media_alt, rationale });
  });
  const tasks: PackTask[] = []; const rawT = Array.isArray(r.tasks) ? r.tasks : []; if (rawT.length > PACK_LIMITS.tasks) problems.push({ at: 'tasks', msg: `الحدّ ${PACK_LIMITS.tasks} مهمة` });
  rawT.slice(0, PACK_LIMITS.tasks).forEach((t: any, i: number) => {
    const code = s(t?.item_code, 40); const at = `tasks[${i}]${code ? ' ' + code : ''}`;
    if (!CODE_RE.test(code)) { problems.push({ at, msg: 'رمز المهمة مطلوب' }); return; } if (codes.has(code)) { problems.push({ at, msg: 'رمز مكرّر داخل الحزمة' }); return; } codes.add(code);
    const level = isBankLevel(t?.level) ? (t.level as BankLevel) : null; const skill = isProductiveSkill(t?.skill) ? t.skill : null; if (!level || !skill) { problems.push({ at, msg: 'المستوى أو المهارة غير صالح' }); return; }
    const question_text = s(t?.question_text, 1500); if (question_text.length < 8) { problems.push({ at, msg: 'نص المهمة قصير' }); return; }
    const vt = validateTask(skill, level, t?.task); if (!vt.task) { problems.push({ at, msg: vt.errors.join(' · ') || 'بيانات المهمة ناقصة' }); return; }
    tasks.push({ item_code: code, level, skill, question_text, task: vt.task as unknown as Record<string, unknown>, descriptor_code: descriptor(t?.descriptor_code, level, skill, at, problems, false), unit_codes: unitCodes(t?.unit_codes, level, at, problems), domain: (DOMAINS as readonly string[]).includes(String(t?.domain)) ? String(t.domain) : null, media_path: s(t?.media_path, 300) || null, media_alt: s(t?.media_alt, 200) || null });
  });
  if (!items.length && !tasks.length) problems.push({ at: 'items', msg: 'الحزمة بلا بنود' });
  /* مراجع المقاطع داخل الحزمة (ما ليس هنا يُفحص ضدّ القاعدة عند الاستيراد) */
  for (const it of items) if (it.passage_id && pIds.has(it.passage_id)) { const p = passages.find((x) => x.id === it.passage_id)!; if (p.level !== it.level) problems.push({ at: it.item_code, msg: `المقطع ${p.id} من مستوى آخر` }); if (it.skill !== 'grammar_vocab' && p.skill !== it.skill) problems.push({ at: it.item_code, msg: `المقطع ${p.id} لمهارة أخرى` }); }
  for (const p of passages) if (!items.some((it) => it.passage_id === p.id)) warnings.push({ at: p.id, msg: 'مقطع بلا بنود في هذه الحزمة' });
  /* الإنصاف وحصّة mcq لكل مستوى */
  const byLevel = new Map<string, PackItem[]>(); for (const it of items) byLevel.set(it.level, [...(byLevel.get(it.level) || []), it]);
  for (const [level, list] of byLevel) {
    if (list.length < 8) continue;
    const mcq = list.filter((x) => x.item_type === 'mcq').length; if (mcq / list.length > MCQ_MAX_SHARE) warnings.push({ at: level, msg: `حصّة mcq ${Math.round((100 * mcq) / list.length)}% — المعيار ≤ 60%` });
    const keys: Record<string, number> = {}; for (const x of list.filter((y) => y.item_type !== 'true_false_notgiven' && !isCompositeType(y.item_type))) keys[x.correct] = (keys[x.correct] || 0) + 1;
    const n = Object.values(keys).reduce((a, b) => a + b, 0); for (const [k, v] of Object.entries(keys)) if (n >= 8 && v / n > KEY_MAX_SHARE) warnings.push({ at: level, msg: `المفتاح «${k}» في ${Math.round((100 * v) / n)}% من البنود — وزّع المفاتيح` });
  }
  if (problems.length) return { ok: false, problems, warnings };
  return { ok: true, pack: { version: PACK_VERSION, source, content_version, passages, items, tasks }, problems, warnings };
}

export function summarize(pack: Pack, warnings: Problem[]): Summary {
  const by_level: Record<string, number> = {}; const by_type: Record<string, number> = {};
  for (const it of pack.items) { by_level[it.level] = (by_level[it.level] || 0) + 1; by_type[it.item_type] = (by_type[it.item_type] || 0) + 1; }
  for (const t of pack.tasks) { by_level[t.level] = (by_level[t.level] || 0) + 1; by_type[PRODUCTIVE_ITEM_TYPES[t.skill]] = (by_type[PRODUCTIVE_ITEM_TYPES[t.skill]] || 0) + 1; }
  return { source: pack.source, content_version: pack.content_version, passages: pack.passages.length, items: pack.items.length, tasks: pack.tasks.length, by_level, by_type, warnings };
}

/** م13-ب: الصيغة المقروءة للمفتاح المركّب في answer_keys.accepted — {pairs:[{l,r}]} للمطابقة · {order:[…]} للترتيب */
export function acceptedOf(it: Pick<PackItem, 'item_type' | 'options' | 'correct' | 'left'>): Record<string, unknown> {
  const parts = parseComposite(it.correct) || []; const label = (id: string) => it.options.find((o) => o.id === id)?.text || it.options.find((o) => o.id === id)?.alt || it.options.find((o) => o.id === id)?.image || id;
  if (isPermutationType(it.item_type)) return { order: parts, order_text: parts.map(label) };
  if (it.item_type === 'cloze_bank') return { fills: parts.map((r, i) => ({ blank: i + 1, r: label(r), right_id: r })) };
  return { pairs: parts.map((r, i) => ({ l: it.left?.[i]?.text || it.left?.[i]?.image || String(i + 1), r: label(r), left_id: String(i + 1), right_id: r })) };
}
export type ImportReport = { batch_id: string | null; dry_run: boolean; passages_created: number; passages_existing: string[]; items_created: number; tasks_created: number; skipped_existing: string[]; rejected: Array<{ item_code: string; field: string; msg: string }>; possible_duplicates: Array<{ item_code: string; of: string }>; descriptors_unknown: string[] };
const chunk = <T,>(a: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

/** الفحص ضدّ القاعدة ثم الإدخال (أو الفحص فقط في التشغيل الجافّ) */
export async function importPack(db: any, pack: Pack, user: { id: string }, opts: { dryRun?: boolean; fileName?: string | null } = {}): Promise<ImportReport> {
  const dry = !!opts.dryRun; const now = new Date().toISOString();
  const report: ImportReport = { batch_id: null, dry_run: dry, passages_created: 0, passages_existing: [], items_created: 0, tasks_created: 0, skipped_existing: [], rejected: [], possible_duplicates: [], descriptors_unknown: [] };
  const allCodes = [...pack.items.map((i) => i.item_code), ...pack.tasks.map((t) => t.item_code)];
  /* 1) رموز موجودة في الدفعة نفسها → تُتخطّى (لا نلمس بندًا قائمًا) */
  const existing = new Set<string>();
  for (const part of chunk(allCodes, 200)) { const { data } = await db.from('question_bank_items').select('item_code').eq('content_version', pack.content_version).in('item_code', part); for (const r of (data || []) as any[]) existing.add(r.item_code); }
  /* 2) الواصفات */
  const descCodes = [...new Set([...pack.items.map((i) => i.descriptor_code), ...pack.tasks.map((t) => t.descriptor_code || '')].filter(Boolean))];
  const known = new Set<string>(); for (const part of chunk(descCodes, 200)) { const { data } = await db.from('miaar_descriptors').select('code').in('code', part); for (const r of (data || []) as any[]) known.add(r.code); }
  report.descriptors_unknown = descCodes.filter((c) => !known.has(c));
  /* 3) المقاطع: ما في الحزمة يُنشأ إن لم يوجد؛ المرجع الخارجي يجب أن يوجد في القاعدة */
  const pIds = [...new Set([...pack.passages.map((p) => p.id), ...pack.items.map((i) => i.passage_id || '').filter(Boolean)])];
  const dbPassages = new Set<string>(); for (const part of chunk(pIds, 200)) { const { data } = await db.from('miaar_passages').select('id').in('id', part); for (const r of (data || []) as any[]) dbPassages.add(r.id); }
  const packP = new Set(pack.passages.map((p) => p.id));
  /* 4) تكرار الجذع ضدّ بنود المستوى نفسه في القاعدة (غير المؤرشفة · بلا بنود اقْرَأْ: مِران الحلقات ليس من بنك مِعيار) */
  const levels = [...new Set(pack.items.map((i) => i.level))]; const stemOf = new Map<string, string>();
  for (const level of levels) { const { data } = await db.from('question_bank_items').select('item_code, level, question_text, status').eq('level', level).neq('status', 'archived').neq('source_kind', 'iqra').limit(3000); for (const r of (data || []) as any[]) if (typeof r.question_text === 'string') stemOf.set(`${r.level}:${normStem(r.question_text)}`, r.item_code); }
  const okItems: PackItem[] = [];
  for (const it of pack.items) {
    if (existing.has(it.item_code)) { report.skipped_existing.push(it.item_code); continue; }
    if (!known.has(it.descriptor_code)) { report.rejected.push({ item_code: it.item_code, field: 'descriptor_code', msg: `واصف غير موجود: ${it.descriptor_code}` }); continue; }
    if (it.passage_id && !packP.has(it.passage_id) && !dbPassages.has(it.passage_id)) { report.rejected.push({ item_code: it.item_code, field: 'passage_id', msg: `مقطع غير موجود: ${it.passage_id}` }); continue; }
    const dup = stemOf.get(`${it.level}:${normStem(it.question_text)}`); if (dup) report.possible_duplicates.push({ item_code: it.item_code, of: dup });
    okItems.push(it);
  }
  const okTasks: PackTask[] = [];
  for (const t of pack.tasks) {
    if (existing.has(t.item_code)) { report.skipped_existing.push(t.item_code); continue; }
    if (t.descriptor_code && !known.has(t.descriptor_code)) { report.rejected.push({ item_code: t.item_code, field: 'descriptor_code', msg: `واصف غير موجود: ${t.descriptor_code}` }); continue; }
    okTasks.push(t);
  }
  const newPassages = pack.passages.filter((p) => !dbPassages.has(p.id)); report.passages_existing = pack.passages.filter((p) => dbPassages.has(p.id)).map((p) => p.id);
  if (dry) { report.passages_created = newPassages.length; report.items_created = okItems.length; report.tasks_created = okTasks.length; return report; }
  /* 5) سجلّ الدفعة */
  const total = pack.items.length + pack.tasks.length;
  const bi = await db.from('question_bank_import_batches').insert({ source_format: PACK_VERSION, file_name: opts.fileName || pack.source, content_version: pack.content_version, initial_status: 'in_review', created_by: user.id, status: 'processing', total_rows: total, valid_rows: okItems.length + okTasks.length, rejected_rows: report.rejected.length, validation_summary: { source: pack.source, passages: pack.passages.length, skipped_existing: report.skipped_existing.length, possible_duplicates: report.possible_duplicates.length } }).select('id').single();
  if (bi.error || !bi.data) throw new Error(bi.error?.message || 'batch_insert_failed');
  const batchId = String(bi.data.id); report.batch_id = batchId;
  if (report.rejected.length) await db.from('question_bank_import_errors').insert(report.rejected.map((e, i) => ({ batch_id: batchId, source_row_number: i + 1, item_code: e.item_code, field_name: e.field, error_code: e.field, error_message: e.msg })));
  /* 6) المقاطع الجديدة (الموجود لا يُمَسّ) */
  for (const part of chunk(newPassages, 100)) {
    const ins = await db.from('miaar_passages').insert(part.map((p) => ({ id: p.id, level: p.level, skill: p.skill, title: p.title, body: p.body, transcript: p.body, audio_public_path: p.audio_public_path, audio_storage_path: null, status: 'approved', source: pack.source, version: pack.content_version, meta: p.meta || {} })));
    if (ins.error) throw new Error(ins.error.message); report.passages_created += part.length;
  }
  /* 7) البنود (in_review) + المفاتيح + حدث المراجعة */
  for (const part of chunk(okItems, 100)) {
    const rows = part.map((it) => ({ item_code: it.item_code, content_version: pack.content_version, level: it.level, skill: it.skill, passage_id: it.skill === 'grammar_vocab' ? null : it.passage_id, question_text: it.question_text, options: it.options, item_type: it.item_type, status: 'in_review', source_kind: 'imported', descriptor_code: it.descriptor_code, cefr_descriptor: it.descriptor_code, unit_codes: it.unit_codes.length ? it.unit_codes : null, domain: it.domain, difficulty_est: it.difficulty_est, media_path: it.media_path, media_alt: it.media_alt, stimulus: it.media_path || it.left ? { ...(it.media_path ? { image: it.media_path, alt: it.media_alt } : {}), ...(it.left ? { left: it.left } : {}) } : null, created_by: user.id, import_batch_id: batchId, author_notes: { options: it.rationale, authored_by: pack.source, imported_by: user.id, ...(report.possible_duplicates.find((d) => d.item_code === it.item_code) ? { possible_duplicate_of: report.possible_duplicates.find((d) => d.item_code === it.item_code)!.of } : {}) } }));
    const ins = await db.from('question_bank_items').insert(rows).select('id, item_code'); if (ins.error || !ins.data) throw new Error(ins.error?.message || 'items_insert_failed');
    const idOf = new Map<string, string>(((ins.data || []) as any[]).map((r) => [r.item_code, r.id]));
    const keys = part.filter((it) => idOf.has(it.item_code)).map((it) => ({ item_id: idOf.get(it.item_code)!, correct_option_id: it.correct, ...(isCompositeType(it.item_type) ? { accepted: acceptedOf(it) } : {}) }));
    const k = await db.from('question_bank_answer_keys').insert(keys); if (k.error) throw new Error(k.error.message);
    await db.from('question_bank_review_events').insert(keys.map((x) => ({ item_id: x.item_id, review_status: 'in_review', academic_note: `استيراد ${pack.source}`, reviewed_by: user.id })));
    report.items_created += keys.length;
  }
  for (const part of chunk(okTasks, 100)) {
    const rows = part.map((t) => ({ item_code: t.item_code, content_version: pack.content_version, level: t.level, skill: t.skill, question_text: t.question_text, options: [], item_type: PRODUCTIVE_ITEM_TYPES[t.skill], status: 'in_review', source_kind: 'imported', descriptor_code: t.descriptor_code, cefr_descriptor: t.descriptor_code, unit_codes: t.unit_codes.length ? t.unit_codes : null, domain: t.domain, task: t.task, media_path: t.media_path, media_alt: t.media_alt, stimulus: t.media_path ? { image: t.media_path, alt: t.media_alt } : null, created_by: user.id, import_batch_id: batchId, author_notes: { authored_by: pack.source, imported_by: user.id } }));
    const ins = await db.from('question_bank_items').insert(rows).select('id'); if (ins.error || !ins.data) throw new Error(ins.error?.message || 'tasks_insert_failed');
    await db.from('question_bank_review_events').insert(((ins.data || []) as any[]).map((r) => ({ item_id: r.id, review_status: 'in_review', academic_note: `استيراد ${pack.source}`, reviewed_by: user.id })));
    report.tasks_created += rows.length;
  }
  await db.from('question_bank_import_batches').update({ status: 'completed', imported_rows: report.items_created + report.tasks_created, completed_at: now }).eq('id', batchId);
  return report;
}

/** آخر الدفعات المستورَدة — لشاشة «استيراد» */
export async function recentImports(db: any, limit = 20): Promise<Array<{ id: string; source: string; content_version: string; status: string; total: number; imported: number; rejected: number; created_at: string; created_by: string | null }>> {
  const { data } = await db.from('question_bank_import_batches').select('id, file_name, content_version, status, total_rows, imported_rows, rejected_rows, created_at, created_by, validation_summary').order('created_at', { ascending: false }).limit(limit);
  return ((data || []) as any[]).map((r) => ({ id: r.id, source: (r.validation_summary && typeof r.validation_summary === 'object' && r.validation_summary.source) || r.file_name || '—', content_version: r.content_version || '—', status: r.status, total: r.total_rows || 0, imported: r.imported_rows || 0, rejected: r.rejected_rows || 0, created_at: r.created_at, created_by: r.created_by || null }));
}
