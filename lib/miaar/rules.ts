// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «تعليمات الاختبار» (م8-ج): صفحة يقرؤها الممتحن ويقرّ بها قبل أن تُفتح أيّ جلسة — في كل مسارات مِعيار
 *  (فردي · دعوة عامة · نهاية المستوى · خدمة الجهات). النصّ يحرّره المدير (عربي/إنجليزي) ويُرقَّم إصدارًا مع كل حفظ،
 *  والإقرار يُثبَّت على الجلسة {version, lang, at} فيظهر في «غرفة الشاهد» والتقرير. الخادم يرفض البدء بلا إقرار صالح.
 *  صيغة النصّ بسيطة: سطر يبدأ بـ "## " عنوان · "- " نقطة · غير ذلك فقرة. المقاطع الحيّة (الوقت · الأقسام · وضع المراقبة)
 *  يبنيها المتصفّح من معطيات الاختبار الفعلية ولا تُكتب يدويًّا.
 */
type Db = any;
const nowIso = () => new Date().toISOString();
export const RULES_KEY = 'exam_instructions';
export const RULES_TITLE = { ar: 'تعليمات الاختبار وإقرار الممتحن', en: 'Exam instructions & candidate declaration' } as const;
export const RULES_MAX = 6000;

export type Rules = { version: number; ar: string; en: string; updated_at: string | null; updated_by: string | null };
export type RulesAck = { version: number; lang: 'ar' | 'en'; at: string };

export const DEFAULT_RULES_AR = `## قبل البدء
- اختر مكانًا هادئًا، وتأكّد من استقرار الاتصال وشحن الجهاز.
- استخدم متصفّحًا حديثًا على حاسوب أو جهاز لوحي، وأغلق التبويبات والتطبيقات الأخرى.
- جهّز بطاقة هويتك إن طُلبت (الاختبار عن بُعد أو بطلب جهة).
## أثناء الاختبار
- الوقت محدَّد ويظهر أعلى الشاشة؛ يُغلق الاختبار تلقائيًّا عند انتهائه.
- أجب بنفسك فقط: بلا مساعدة من أحد، ولا مصادر، ولا مترجم، ولا أدوات ذكاء اصطناعي.
- ابقَ داخل شاشة الاختبار؛ مغادرة الشاشة أو فتح نوافذ أخرى يُسجَّل في سجلّ النزاهة ويراجعه إنسان.
- يمكنك تأجيل سؤال والعودة إليه داخل المستوى نفسه قبل الإنهاء.
- في أسئلة الاستماع عدد مرّات الإعادة محدود حسب المستوى.
- انقطاع الاتصال لا يُضيع إجاباتك: أعد فتح الرابط نفسه من الجهاز نفسه وستُستأنف الجلسة.
## النتيجة
- تظهر النتيجة فور الإنهاء مع رمز وصول إلى بطاقتك.
- أسئلة الكتابة والمحادثة يصحّحها مقيّمون معتمدون خلال أيام، ثم تكتمل النتيجة.
- الغشّ أو انتحال الشخصية أو تبادل الأسئلة يُبطل النتيجة ويحجب الشهادة.
## الخصوصية
- تُعالَج بياناتك وفق نظام حماية البيانات الشخصية، ولا تُشارك إلا مع الجهة الطالبة بالقدر اللازم.
## الإقرار
قرأتُ التعليمات وفهمتها، وأتعهّد بأداء الاختبار بنفسي وبأمانة، وأعلم أن مخالفتها تُبطل نتيجتي.`;

export const DEFAULT_RULES_EN = `## Before you start
- Choose a quiet place; make sure your connection is stable and your device is charged.
- Use an up-to-date browser on a computer or tablet, and close other tabs and apps.
- Have your ID card ready if required (remote exams or institutional requests).
## During the exam
- The time is fixed and shown at the top of the screen; the exam closes automatically when it ends.
- Answer by yourself only: no help from anyone, no references, no translators, no AI tools.
- Stay inside the exam screen; leaving it or opening other windows is recorded in the integrity log and reviewed by a human.
- You may defer a question and return to it within the same level before finishing.
- In listening questions the number of replays is limited by level.
- A dropped connection does not lose your answers: reopen the same link on the same device and the session resumes.
## Results
- Your result appears immediately after finishing, with an access code to your card.
- Writing and speaking tasks are scored by certified raters within days; the result is then completed.
- Cheating, impersonation, or sharing questions voids the result and blocks the certificate.
## Privacy
- Your data is processed under the Personal Data Protection Law and shared with the requesting institution only as needed.
## Declaration
I have read and understood the instructions. I undertake to take the exam by myself and honestly, and I know that violating them voids my result.`;

export const FACTORY_RULES: Rules = { version: 1, ar: DEFAULT_RULES_AR, en: DEFAULT_RULES_EN, updated_at: null, updated_by: null };
let cache: { rules: Rules; at: number } | null = null;

/** التعليمات الحالية (من miaar_settings؛ ذاكرة 30 ث؛ المصنع = الإصدار 1) */
export async function getRules(db: Db): Promise<Rules> {
  if (cache && Date.now() - cache.at < 30000) return cache.rules;
  let rules: Rules = FACTORY_RULES;
  try {
    const { data } = await db.from('miaar_settings').select('value, updated_at, updated_by').eq('key', RULES_KEY).maybeSingle();
    const v = data?.value; if (v && typeof v === 'object' && Number.isInteger(v.version) && v.version >= 1) rules = { version: v.version, ar: String(v.ar || DEFAULT_RULES_AR), en: String(v.en || DEFAULT_RULES_EN), updated_at: data.updated_at || null, updated_by: data.updated_by || null };
  } catch { /* الجدول غير موجود بعد → المصنع */ }
  cache = { rules, at: Date.now() }; return rules;
}
/** حفظ إصدار جديد (مديرون فقط — يتحقّق المسار) */
export async function setRules(db: Db, input: { ar: unknown; en: unknown }, by: string): Promise<{ ok: true; rules: Rules } | { ok: false; error: string }> {
  const ar = typeof input.ar === 'string' ? input.ar.replace(/\r\n/g, '\n').trim() : ''; const en = typeof input.en === 'string' ? input.en.replace(/\r\n/g, '\n').trim() : '';
  if (ar.length < 40) return { ok: false, error: 'النصّ العربي قصير جدًّا (40 حرفًا على الأقل)' };
  if (ar.length > RULES_MAX || en.length > RULES_MAX) return { ok: false, error: `الحدّ ${RULES_MAX} حرفًا لكل لغة` };
  if (!/الإقرار|أقرّ|أتعهّد/.test(ar)) return { ok: false, error: 'يجب أن يحتوي النصّ العربي على فقرة إقرار (كلمة «الإقرار» أو «أتعهّد»)' };
  const cur = await getRules(db); const rules: Rules = { version: cur.version + 1, ar, en: en || DEFAULT_RULES_EN, updated_at: nowIso(), updated_by: by };
  const r = await db.from('miaar_settings').upsert({ key: RULES_KEY, value: { version: rules.version, ar: rules.ar, en: rules.en }, updated_at: rules.updated_at, updated_by: by }, { onConflict: 'key' }); if (r.error) return { ok: false, error: 'تعذّر الحفظ' };
  cache = { rules, at: Date.now() }; return { ok: true, rules };
}
export function resetRulesCache() { cache = null; }

/** التحقّق من إقرار الممتحن قبل فتح الجلسة */
export function validateAck(ack: unknown, currentVersion: number): { ok: true; ack: RulesAck } | { ok: false; error: 'instructions_required' | 'instructions_changed' } {
  if (!ack || typeof ack !== 'object') return { ok: false, error: 'instructions_required' };
  const a = ack as Record<string, unknown>; const version = Number(a.version);
  if (!Number.isInteger(version) || version < 1 || a.accepted !== true) return { ok: false, error: 'instructions_required' };
  if (version !== currentVersion) return { ok: false, error: 'instructions_changed' };
  return { ok: true, ack: { version, lang: a.lang === 'en' ? 'en' : 'ar', at: nowIso() } };
}

/** تحليل النصّ إلى كتل للعرض (عنوان · نقاط · فقرة) — يستخدمه المتصفّح والمعاينة */
export type RulesBlock = { kind: 'h' | 'ul' | 'p'; text?: string; items?: string[] };
export function parseRules(text: string): RulesBlock[] {
  const out: RulesBlock[] = []; let ul: string[] | null = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim(); if (!line) { ul = null; continue; }
    if (line.startsWith('## ')) { ul = null; out.push({ kind: 'h', text: line.slice(3).trim() }); continue; }
    if (line.startsWith('- ') || line.startsWith('• ')) { if (!ul) { ul = []; out.push({ kind: 'ul', items: ul }); } ul.push(line.slice(2).trim()); continue; }
    ul = null; out.push({ kind: 'p', text: line });
  }
  return out;
}
/** عدد النقاط (للملخّص «N نقطة») */
export const countPoints = (text: string) => parseRules(text).reduce((n, b) => n + (b.kind === 'ul' ? (b.items || []).length : 0), 0);
