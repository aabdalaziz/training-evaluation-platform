/**
 * مِعيار — م15 «مكتب المراجعة»: منطق خالص بلا قاعدة (قابل للاختبار)
 *  · canApprove: قفل «المعتمِد ≠ المستورِد» (استثناء موثّق للمديرين بـ self_approve + ملاحظة)
 *  · reviewChecklist: فحص آلي يسبق عين المراجع (لا يمنع — يوجّه النظر)
 *  · reviewSummary: تقدّم المراجعة لكلّ دفعة × مستوى
 *  · keyText: المفتاح بصيغة مقروءة للبطاقة
 */
import { countBlanks, isCompositeType, isPermutationType, isSlotType, parseComposite } from './registry';
/* نسخة محلّية من حدود pack.ts كي يبقى هذا الملف صالحًا للعميل (بلا استيراد bank/syllabus) */
const FULL_TASHKEEL_LEVELS: readonly string[] = ['PRE_A1', 'A1']; const NO_TASHKEEL_LEVELS: readonly string[] = ['B1', 'B2', 'C1', 'C2'];

export const APPROVER_ADMINS: readonly string[] = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const TASHKEEL_RE = /[\u064B-\u0652\u0670]/g;
const ARABIC_LETTERS_RE = /[\u0621-\u064A]/g;

export type ReviewUser = { id: string; role?: string | null };
export type ReviewItemLite = { created_by?: string | null; author_notes?: any };

/** مَن «أنشأ» البند: created_by أو imported_by في author_notes (الاستيراد يسجّلهما معًا) */
export const creatorsOf = (it: ReviewItemLite): string[] => {
  const s = new Set<string>();
  if (it.created_by) s.add(String(it.created_by));
  const imp = it.author_notes && typeof it.author_notes === 'object' ? (it.author_notes as any).imported_by : null; if (imp) s.add(String(imp));
  return [...s];
};
export const isOwnItem = (it: ReviewItemLite, user: ReviewUser): boolean => creatorsOf(it).includes(user.id);

export type ApproveVerdict = { ok: true; self: boolean } | { ok: false; reason: 'own_item' | 'self_needs_admin' | 'self_needs_note' };
/** قاعدة الحوكمة قفلًا: صاحب البند لا يعتمده — إلا مدير يصرّح self_approve مع ملاحظة (يُسجَّل approved:self) */
export function canApprove(it: ReviewItemLite, user: ReviewUser, opts: { selfApprove?: boolean; note?: string } = {}): ApproveVerdict {
  if (!isOwnItem(it, user)) return { ok: true, self: false };
  if (!opts.selfApprove) return { ok: false, reason: 'own_item' };
  if (!APPROVER_ADMINS.includes(String(user.role || '').toUpperCase())) return { ok: false, reason: 'self_needs_admin' };
  if (!opts.note || opts.note.trim().length < 3) return { ok: false, reason: 'self_needs_note' };
  return { ok: true, self: true };
}
export const APPROVE_REASON_AR: Record<Exclude<ApproveVerdict, { ok: true }>['reason'], string> = {
  own_item: 'لا يعتمد المستورِد بنوده — الاعتماد بيد مراجع آخر',
  self_needs_admin: 'الاعتماد الذاتي للمديرين فقط',
  self_needs_note: 'الاعتماد الذاتي يلزمه ملاحظة تبرّر الاستثناء',
};

export type CheckItem = {
  item_type: string; level: string; skill: string; question_text: string;
  options: { id: string; text?: string | null; image?: string | null; alt?: string | null }[];
  correct?: string | null; stimulus?: any; passage_id?: string | null; author_notes?: any;
  passage?: { skill?: string; status?: string; audio_public_path?: string | null; audio_storage_path?: string | null; body?: string | null } | null;
};
export type Check = { code: string; ok: boolean; msg: string };

const tashkeelRatio = (t: string): number => { const letters = (t.match(ARABIC_LETTERS_RE) || []).length; if (!letters) return 0; return (t.match(TASHKEEL_RE) || []).length / letters; };

/** قائمة تحقّق آلية — كلّ سطر {ok, msg}؛ الكهرماني يستحقّ نظرة، لا رفضًا تلقائيًّا */
export function reviewChecklist(it: CheckItem): Check[] {
  const out: Check[] = []; const add = (code: string, ok: boolean, msg: string) => out.push({ code, ok, msg });
  const type = it.item_type; const opts = Array.isArray(it.options) ? it.options : []; const ids = opts.map((o) => o.id);
  const left: any[] = Array.isArray(it.stimulus?.left) ? it.stimulus.left : [];
  const rationale = it.author_notes && typeof it.author_notes === 'object' && it.author_notes.options && typeof it.author_notes.options === 'object' ? it.author_notes.options as Record<string, unknown> : null;
  /* 1) المفتاح */
  if (isCompositeType(type)) {
    const parts = parseComposite(it.correct);
    const slots = type === 'cloze_bank' ? countBlanks(it.question_text) : type === 'matching' ? left.length : opts.length;
    add('key_shape', !!parts && parts.length === slots && parts.every((p) => ids.includes(p)), parts ? `المفتاح ${it.correct} — ${parts.length} جزءًا مقابل ${slots} ${type === 'cloze_bank' ? 'فراغات' : type === 'matching' ? 'عناصر يسرى' : 'خيارات'}` : 'المفتاح المركّب غير صالح');
    if (type === 'cloze_bank') add('blanks', slots >= 2 && slots <= 4, `عدد الفراغات «___» في الجذع: ${slots} (المطلوب 2–4)`);
    if (type === 'cloze_bank') add('bank_size', opts.length >= slots + 1 && opts.length <= slots + 2, `مصرف الكلمات ${opts.length} = الفراغات + ${opts.length - slots} مشتّت (المطلوب 1–2)`);
    const identity = !!parts && parts.every((p, i) => p === ids[i]);
    add('identity', !identity, identity ? (isPermutationType(type) ? 'المفتاح هو الهويّة a-b-c… — الترتيب المعروض هو الصحيح (كاشف)' : 'المفتاح هويّة a-b… — بعثر الكلمات') : 'المفتاح مبعثر (ليس الهويّة)');
    const n = isSlotType(type) ? Math.max(slots, parts?.length || 0) : 1; const keys = isSlotType(type) ? Array.from({ length: n }, (_, i) => String(i + 1)) : ['why'];
    const missing = keys.filter((k) => !rationale || !String(rationale[k] || '').trim());
    add('rationale', missing.length === 0, missing.length ? `مبرّر ناقص لـ ${isSlotType(type) ? `الفراغ/العنصر ${missing.join('، ')}` : 'why'}` : 'المبرّرات مكتملة');
  } else {
    add('key_shape', !!it.correct && ids.includes(String(it.correct)), it.correct ? `المفتاح ${it.correct} ضمن الخيارات` : 'لا مفتاح');
    const missing = ids.filter((id) => !rationale || !String(rationale[id] || '').trim());
    add('rationale', missing.length === 0, missing.length ? `مبرّر ناقص للخيار ${missing.join('، ')}` : 'مبرّر لكلّ خيار');
  }
  /* 2) الخيارات */
  const texts = opts.map((o) => (o.text || '').trim() || (o.image || '')); add('unique_options', new Set(texts).size === texts.length, new Set(texts).size === texts.length ? 'لا تكرار في الخيارات' : 'خياران بنصّ/صورة واحدة');
  const imgs = [...opts, ...left].filter((o) => o.image); if (imgs.length) add('alt', imgs.every((o) => (o.alt || o.text || '').trim()), imgs.every((o) => (o.alt || o.text || '').trim()) ? `وصف بديل لكلّ صورة (${imgs.length})` : 'صورة بلا وصف بديل');
  /* 3) التشكيل بالمستوى */
  const all = [it.question_text, ...opts.map((o) => o.text || ''), ...left.map((l) => l.text || '')].join(' '); const r = tashkeelRatio(all);
  if (FULL_TASHKEEL_LEVELS.includes(it.level)) add('tashkeel', r >= 0.25, r >= 0.25 ? `تشكيل كافٍ (${Math.round(r * 100)}%)` : `تشكيل ناقص لمستوى ${it.level} (${Math.round(r * 100)}%)`);
  else if (NO_TASHKEEL_LEVELS.includes(it.level)) add('tashkeel', r <= 0.05, r <= 0.05 ? 'بلا تشكيل كما يليق بالمستوى' : `تشكيل زائد لمستوى ${it.level} (${Math.round(r * 100)}%)`);
  /* 4) المقطع */
  if (it.skill === 'reading' || it.skill === 'listening') {
    add('passage', !!it.passage_id, it.passage_id ? `مرتبط بالمقطع ${it.passage_id}` : 'بند قراءة/استماع بلا مقطع');
    if (it.passage) {
      if (it.skill === 'listening') add('audio', !!(it.passage.audio_public_path || it.passage.audio_storage_path), (it.passage.audio_public_path || it.passage.audio_storage_path) ? 'للمقطع صوت' : 'مقطع استماع بلا صوت — لن يُسحب');
      add('passage_status', it.passage.status === 'approved', it.passage.status === 'approved' ? 'المقطع معتمد' : `المقطع ${it.passage.status || '—'} — اعتمد المقطع أيضًا`);
    }
  }
  return out;
}

/** المفتاح بصيغة مقروءة: mcq → «b · النصّ» · cloze → «1 ← كلمة» · matching → «يسار ← يمين» · ordering → «قطعة ← قطعة» */
export function keyText(it: Pick<CheckItem, 'item_type' | 'options' | 'correct' | 'stimulus'>): string {
  const opts = Array.isArray(it.options) ? it.options : []; const byId = new Map(opts.map((o) => [o.id, o])); const label = (id: string) => { const o = byId.get(id); return o ? (o.text || o.alt || o.image || id) : id; };
  if (!it.correct) return '—';
  if (!isCompositeType(it.item_type)) return `${it.correct} · ${label(String(it.correct))}`;
  const parts = parseComposite(it.correct) || []; if (!parts.length) return String(it.correct);
  if (isPermutationType(it.item_type)) return parts.map(label).join(' ← ');
  if (it.item_type === 'matching') { const left: any[] = Array.isArray(it.stimulus?.left) ? it.stimulus.left : []; return parts.map((p, i) => `${left[i]?.text || left[i]?.alt || i + 1} ← ${label(p)}`).join(' · '); }
  return parts.map((p, i) => `${i + 1} ← ${label(p)}`).join(' · ');
}

export type SummaryRow = { batch: string; level: string; status: string; n: number };
/** تقدّم المراجعة: لكلّ دفعة × مستوى {in_review, approved, draft, archived, total} + مجاميع الدفعة */
export function reviewSummary(rows: SummaryRow[]): Record<string, { total: Record<string, number>; levels: Record<string, Record<string, number>> }> {
  const out: Record<string, { total: Record<string, number>; levels: Record<string, Record<string, number>> }> = {};
  for (const r of rows) {
    const b = out[r.batch] || (out[r.batch] = { total: {}, levels: {} }); const lv = b.levels[r.level] || (b.levels[r.level] = {});
    lv[r.status] = (lv[r.status] || 0) + r.n; b.total[r.status] = (b.total[r.status] || 0) + r.n;
  }
  return out;
}
