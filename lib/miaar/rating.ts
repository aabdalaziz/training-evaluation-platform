// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** مِعيار — م4-ب «غرفة التصحيح» (خادم فقط): طابور الأداءات بلا أسماء · التفصيل (النص أو رابط صوت موقَّع 5 دقائق + المهمة + سُلّم التقدير)
 *  · تقدير بشري بالأبعاد → حكم ومستوى (judge) · الإصدار يكتب «معتمد» في بطاقة المتقدّم على الرمز نفسه.
 *  «عيّنة المصحّح»: اقتراح أولي من الذكاء الاصطناعي للنصوص فقط وبموافقة المتقدّم — لا يرى اسمًا ولا بريدًا، ولا يُنشر شيء منه. */
import { MEDIA_BUCKET } from './bank';
import { humanRatingFrom } from './performance';
import { refreshProductive } from './room';
import { parseAiRating, RUBRIC_DIMENSIONS, DIMENSION_AR } from './rubric';
import type { AiRating } from './rubric';
import type { BankLevel, ProductiveSkill } from './registry';
import { runAi, aiUsage, logAi } from '../ai/athar';

const nowIso = () => new Date().toISOString();
const SIGN_SECONDS = 5 * 60;
export type QueueRow = { id: string; skill: ProductiveSkill; status: string; item_code: string; level_target: BankLevel; word_count: number | null; duration_sec: number | null; accommodation: string | null; ai_consent: boolean; has_ai: boolean; created_at: string; rated_at: string | null; released_at: string | null; session_short: string; receptive_level: string | null };

/** الطابور: الأحدث أولًا؛ بلا بريد ولا اسم؛ المستوى الاستقبالي من تقرير الجلسة (لتُرى المسافة بين المهارتين) */
export async function ratingQueue(db: any, status: 'pending' | 'released' | 'all' = 'pending', limit = 100): Promise<{ rows: QueueRow[]; counts: Record<string, number> }> {
  let q = db.from('miaar_performances').select('id, session_id, skill, status, item_code, level_target, word_count, duration_sec, accommodation, ai_consent, ai_rating, created_at, rated_at, released_at').order('created_at', { ascending: false }).limit(limit);
  if (status === 'pending') q = q.in('status', ['submitted', 'ai_rated', 'rated']); else if (status === 'released') q = q.eq('status', 'released');
  const { data } = await q; const rows = (data || []) as any[];
  const ids = [...new Set(rows.map((r) => r.session_id))]; const lv = new Map<string, string | null>();
  if (ids.length) { const { data: ss } = await db.from('placement_secure_sessions').select('id, report').in('id', ids); for (const s of (ss || []) as any[]) lv.set(s.id, s.report?.ملخص_التسكين?.المستوى_المثبت || s.report?.المستوى_العام || null); }
  const { data: allRows } = await db.from('miaar_performances').select('status').limit(5000); const counts: Record<string, number> = {};
  for (const r of (allRows || []) as any[]) counts[r.status] = (counts[r.status] || 0) + 1;
  return { rows: rows.filter((r) => r.status !== 'skipped').map((r) => ({ id: r.id, skill: r.skill, status: r.status, item_code: r.item_code, level_target: r.level_target, word_count: r.word_count, duration_sec: r.duration_sec, accommodation: r.accommodation, ai_consent: !!r.ai_consent, has_ai: !!r.ai_rating, created_at: r.created_at, rated_at: r.rated_at, released_at: r.released_at, session_short: String(r.session_id).slice(0, 8), receptive_level: lv.get(r.session_id) ?? null })), counts };
}

/** تفصيل أداء واحد للمصحّح: النص أو رابط صوت موقَّع قصير العمر · المهمة (مع الإجابة النموذجية للمصحّح) · سُلّم التقدير لهذه المهارة */
export async function performanceDetail(db: any, id: string): Promise<Record<string, unknown> | null> {
  const { data: p } = await db.from('miaar_performances').select('*').eq('id', id).maybeSingle(); if (!p) return null;
  const { data: items } = await db.from('question_bank_items').select('item_code, level, skill, question_text, task, media_path, media_alt, descriptor_code').eq('item_code', p.item_code).limit(1);
  const item = ((items || []) as any[])[0] || null;
  let audio_url: string | null = null;
  if (p.media_path) { try { const r = await db.storage.from(MEDIA_BUCKET).createSignedUrl(p.media_path, SIGN_SECONDS); audio_url = r.error ? null : (r.data?.signedUrl ?? null); } catch { audio_url = null; } }
  const { data: bands } = await db.from('miaar_rubric_bands').select('dimension, score, dimension_ar, text_ar').eq('skill', p.skill).order('sort');
  const { data: s } = await db.from('placement_secure_sessions').select('report').eq('id', p.session_id).maybeSingle();
  const receptive = s?.report?.ملخص_التسكين?.المستوى_المثبت || s?.report?.المستوى_العام || null;
  const { candidate_email: _e, user_id: _u, ...safe } = p; void _e; void _u;  /* لا بريد ولا معرّف مستخدم للمصحّح */
  return { ...safe, audio_url, task: item ? { prompt: item.question_text, level: item.level, task: item.task, media: item.media_path, descriptor: item.descriptor_code } : null, dimensions: RUBRIC_DIMENSIONS[p.skill as ProductiveSkill].map((d) => ({ key: d, ar: DIMENSION_AR[d] || d })), bands: bands || [], receptive_level: receptive };
}

/** تقدير بشري (حفظ أو إصدار) — الإصدار يُظهر «معتمد» في البطاقة فورًا */
export async function ratePerformance(db: any, id: string, body: { scores: unknown; note: unknown; release: boolean }, rater: { id: string }): Promise<{ ok: true; status: string; rating: ReturnType<typeof humanRatingFrom> } | { ok: false; error: string }> {
  const { data: p } = await db.from('miaar_performances').select('id, session_id, skill, level_target, status').eq('id', id).maybeSingle(); if (!p) return { ok: false, error: 'الأداء غير موجود' };
  if (p.status === 'skipped') return { ok: false, error: 'هذا الأداء لم يُقدَّم' };
  const rating = humanRatingFrom(p.skill, p.level_target, body.scores, body.note); if (!rating) return { ok: false, error: 'الدرجات ناقصة أو خارج السُّلّم (0–5 لكل بُعد)' };
  const status = body.release ? 'released' : 'rated';
  const up = await db.from('miaar_performances').update({ human_rating: rating, rater_id: rater.id, rater_note_ar: rating.note_ar, rated_at: nowIso(), status, released_at: body.release ? nowIso() : null, updated_at: nowIso() }).eq('id', id);
  if (up.error) return { ok: false, error: 'تعذّر الحفظ' };
  await refreshProductive(db, p.session_id);
  return { ok: true, status, rating };
}
/** سحب إصدار (خطأ بشري) — يعود «قيد التصحيح» في البطاقة */
export async function unreleasePerformance(db: any, id: string): Promise<boolean> {
  const { data: p } = await db.from('miaar_performances').select('id, session_id, status').eq('id', id).maybeSingle(); if (!p || p.status !== 'released') return false;
  const up = await db.from('miaar_performances').update({ status: 'rated', released_at: null, updated_at: nowIso() }).eq('id', id); if (up.error) return false;
  await refreshProductive(db, p.session_id); return true;
}

const AI_SYSTEM = `أنت مصحّح مساعد لاختبار «مِعيار» للغة العربية وفق الإطار الأوروبي المرجعي (CEFR). تُقيِّم نصًّا كتبه متقدّم مجهول الهوية استجابةً لمهمة محدّدة المستوى.
قيِّم كل بُعد على سُلّم 0–5 (0 = لا إنتاج يُقيَّم، 3 = يحقّق متطلبات مستوى المهمة، 5 = يتجاوزها بوضوح). كن محافظًا؛ اقتبس شواهد قصيرة من النص نفسه؛ لا تخمّن هوية الكاتب ولا تذكر أي بيانات شخصية.
أعد JSON فقط: {"scores":{...},"evidence":["اقتباس قصير",…],"next_step_ar":"ما يرفع الكاتب درجة واحدة","confidence":0–1}.`;
/** «عيّنة المصحّح»: اقتراح أولي للنصوص (كتابة أو تحدّث مكتوب كتيسير) بموافقة المتقدّم فقط — يُحفظ في ai_rating ولا يُنشر */
export async function aiSuggest(db: any, id: string, user: { id: string; email: string; role: string }): Promise<{ ok: true; rating: AiRating; source: 'ai' | 'local' } | { ok: false; error: string }> {
  const { data: p } = await db.from('miaar_performances').select('id, skill, level_target, text_answer, ai_consent, status, item_code').eq('id', id).maybeSingle(); if (!p) return { ok: false, error: 'الأداء غير موجود' };
  if (!p.ai_consent) return { ok: false, error: 'المتقدّم لم يوافق على مساعدة الذكاء الاصطناعي — قيّم يدويًا' };
  if (!p.text_answer) return { ok: false, error: 'الاقتراح الآلي متاح للنصوص فقط (التسجيلات يسمعها الإنسان)' };
  const usage = await aiUsage(db, user.id, 'miaar_rate'); if (!usage.allowed) return { ok: false, error: `بلغت حدّ ${usage.limit} اقتراحًا خلال 24 ساعة` };
  const { data: items } = await db.from('question_bank_items').select('question_text, task').eq('item_code', p.item_code).limit(1); const item = ((items || []) as any[])[0];
  const dims = RUBRIC_DIMENSIONS[p.skill as ProductiveSkill].map((d) => `"${d}"`).join(',');
  const userPrompt = `المهارة: ${p.skill} · مستوى المهمة: ${p.level_target}\nالمهمة: ${item?.question_text || '—'}${item?.task?.min_words ? ` (${item.task.min_words}–${item.task.max_words} كلمة)` : ''}\nالأبعاد المطلوبة في scores بالضبط: {${dims}}\n\nالنص:\n"""\n${String(p.text_answer).slice(0, 4000)}\n"""`;
  const r = await runAi<AiRating | null>({ system: AI_SYSTEM, user: userPrompt, parse: (raw) => parseAiRating(p.skill, p.level_target, raw), local: () => null, budgetMs: 25000, json: true });
  await logAi(db, { user_id: user.id, email: user.email, role: user.role, purpose: 'miaar_rate', result: r, context: { performance: id, skill: p.skill } });
  if (!r.data) return { ok: false, error: 'لم يُنتج الذكاء الاصطناعي تقديرًا صالحًا — قيّم يدويًا' };
  await db.from('miaar_performances').update({ ai_rating: { ...r.data, model: r.model, at: nowIso() }, status: p.status === 'submitted' ? 'ai_rated' : p.status, updated_at: nowIso() }).eq('id', id);
  return { ok: true, rating: r.data, source: r.source };
}
