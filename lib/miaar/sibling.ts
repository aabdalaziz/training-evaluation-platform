// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — من أَثَر · م3 «بنك يتنفّس»: شقيق لبند مستنزَف (خادم فقط)
 *  البند الذي عُرض كثيرًا يُقترح له شقيق بالمواصفة نفسها (المستوى · المهارة · النوع · الواصف) بالذكاء الاصطناعي؛
 *  يُحفظ مسودةً (status='draft', source_kind='ai_sibling') مع ملاحظة المصدر — لا يصل إلى متقدّم قبل اعتماد بشري.
 *  إن غاب الذكاء الاصطناعي يُنشأ «هيكل» شقيق فارغ الخيارات ليكمله المعدّ.
 */
import { runAi, aiUsage, logAi } from '../ai/athar';
import { isOptionId } from './registry';

type ItemRow = { id: string; item_code: string; content_version: string; level: string; skill: string; item_type: string; question_text: string; options: any; descriptor_code: string | null; cefr_descriptor: string | null; domain: string | null; passage_id: string | null; sub_band: string | null; stimulus: any };
export type SiblingDraft = { question_text: string; options: { id: string; text: string }[]; correct: string; rationale: string };

const SYSTEM = `أنت معدّ اختبارات لغة عربية محترف يعمل وفق الإطار الأوروبي المرجعي (CEFR). تكتب بنودًا موضوعية سليمة لغويًا، بخيارات متجانسة الطول، ومشتِّتات معقولة تمثّل أخطاء شائعة لمتعلّمي العربية لغة ثانية في المستوى المطلوب. لا تذكر أسماء أشخاص حقيقيين. أعد JSON فقط.`;

export function parseSibling(raw: string, optionIds: string[]): SiblingDraft | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/); if (!m) return null; const j = JSON.parse(m[0]);
    const q = String(j.question_text || '').trim(); if (q.length < 4 || q.length > 400) return null;
    const opts = Array.isArray(j.options) ? j.options : []; if (opts.length !== optionIds.length) return null;
    const options = opts.map((o: any, i: number) => ({ id: optionIds[i], text: String(o?.text ?? o ?? '').trim().slice(0, 160) })); if (options.some((o: { text: string }) => !o.text)) return null;
    if (new Set(options.map((o: { text: string }) => o.text)).size !== options.length) return null;
    const correct = String(j.correct || '').trim().toLowerCase(); if (!isOptionId(correct) || !optionIds.includes(correct)) return null;
    return { question_text: q, options, correct, rationale: String(j.rationale || '').slice(0, 300) };
  } catch { return null; }
}

export async function makeSibling(db: any, itemCode: string, user: { id: string; email: string; role: string }): Promise<{ ok: true; code: string; source: 'ai' | 'local'; id: string } | { ok: false; error: string }> {
  const { data: rows } = await db.from('question_bank_items').select('id, item_code, content_version, level, skill, item_type, question_text, options, descriptor_code, cefr_descriptor, domain, passage_id, sub_band, stimulus').eq('item_code', itemCode).limit(5);
  const src = ((rows || []) as ItemRow[]).find((r) => true); if (!src) return { ok: false, error: 'البند غير موجود' };
  if (src.item_type !== 'mcq' && src.item_type !== 'true_false_notgiven') return { ok: false, error: 'الشقيق التلقائي متاح لبنود الاختيار النصّية فقط (الصور والمقاطع يُعدّها الإنسان)' };
  const usage = await aiUsage(db, user.id, 'miaar_sibling'); if (!usage.allowed) return { ok: false, error: `بلغت حدّ ${usage.limit} شقيقًا خلال 24 ساعة` };
  const { data: keyRow } = await db.from('question_bank_answer_keys').select('correct_option_id').eq('item_id', src.id).maybeSingle();
  const options: { id: string; text: string }[] = Array.isArray(src.options) ? src.options.map((o: any, i: number) => ({ id: String(o?.id || 'abcdef'[i]), text: String(o?.text || '') })) : [];
  const ids = options.map((o) => o.id); if (ids.length < 2) return { ok: false, error: 'خيارات البند الأصلي غير صالحة' };
  const user_prompt = `البند الأصلي (لا تنسخه، اكتب شقيقًا جديدًا يقيس المهارة نفسها بالمستوى نفسه):
المستوى: ${src.level}${src.sub_band ? ` (${src.sub_band})` : ''} · المهارة: ${src.skill} · النوع: ${src.item_type} · الواصف: ${src.cefr_descriptor || src.descriptor_code || '—'} · المجال: ${src.domain || '—'}
السؤال: ${src.question_text}
الخيارات: ${options.map((o) => `${o.id}) ${o.text}`).join(' | ')}
المفتاح: ${keyRow?.correct_option_id || '?'}
أعد JSON بهذا الشكل فقط: {"question_text":"…","options":[${ids.map(() => '{"text":"…"}').join(',')}],"correct":"${ids[0]}","rationale":"لماذا المفتاح صحيح ولماذا المشتِّتات معقولة"} — عدد الخيارات ${ids.length} بالترتيب نفسه، و"correct" أحد: ${ids.join(', ')}.`;
  const r = await runAi<SiblingDraft | null>({ system: SYSTEM, user: user_prompt, parse: (raw) => parseSibling(raw, ids), local: () => null, budgetMs: 25000, json: true });
  await logAi(db, { user_id: user.id, email: user.email, role: user.role, purpose: 'miaar_sibling', result: r, context: { item_code: itemCode } });
  /* رمز الشقيق: الأصل + -S<n> */
  const { data: sibs } = await db.from('question_bank_items').select('item_code').like('item_code', `${itemCode}-S%`).limit(50); const n = ((sibs || []) as any[]).length + 1; const code = `${itemCode}-S${n}`;
  const draft = r.data; const source: 'ai' | 'local' = draft ? 'ai' : 'local';
  const row = {
    item_code: code, content_version: src.content_version, level: src.level, skill: src.skill, item_type: src.item_type, passage_id: src.passage_id, descriptor_code: src.descriptor_code, cefr_descriptor: src.cefr_descriptor, domain: src.domain, sub_band: src.sub_band, stimulus: src.stimulus,
    question_text: draft ? draft.question_text : `${src.question_text} — [شقيق: أعد الصياغة]`,
    options: draft ? draft.options : options.map((o) => ({ id: o.id, text: '' })),
    status: 'draft', source_kind: 'ai_sibling', created_by: user.id,
    author_notes: { sibling_of: itemCode, reason: 'over_exposed', source, model: r.model, rationale: draft?.rationale || null, note_ar: draft ? 'اقتراح آلي — راجع المفتاح والمشتِّتات قبل الاعتماد' : 'الذكاء الاصطناعي غير متاح — هيكل فارغ ليكمله المعدّ' },
  };
  const ins = await db.from('question_bank_items').insert(row).select('id').single(); if (ins.error) return { ok: false, error: ins.error.message };
  await db.from('question_bank_answer_keys').insert({ item_id: ins.data.id, correct_option_id: draft ? draft.correct : (keyRow?.correct_option_id || ids[0]) });
  await db.from('question_bank_review_events').insert({ item_id: ins.data.id, review_status: 'draft', academic_note: `شقيق للبند ${itemCode} (${source === 'ai' ? 'اقتراح آلي' : 'هيكل'}) — ميزان مِعيار`, reviewed_by: user.id });
  return { ok: true, code, source, id: ins.data.id };
}
