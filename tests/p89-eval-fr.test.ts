// P89 «الاستبيان بالفرنسيّة + نافذة الرياض» — الطبقة النقيّة + الربط في الصفحة والعدّة
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveEvalLang, windowText, fmtRiyadh, frQuestion, frSection, frOption, frCoverage, FR_Q, STR_FR, FR_PROGRAMS } from '../lib/evaluation/fr';
import { fmtWhen } from '../lib/evaluation/links';
import { FRANCE } from '../lib/cohorts/france';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const FR = FRANCE.programId;

test('P89: لغة الفتح — ?lang أوّلًا؛ برنامج فرنسا: عربيّ المتصفّح ← عربيّة وإلّا فرنسيّة؛ غيره كما كان + fr للمتصفّح الفرنسيّ', () => {
  assert.equal(resolveEvalLang({ query: 'ar', programId: FR, browser: 'fr-FR' }), 'ar');
  assert.equal(resolveEvalLang({ query: 'xx', programId: FR, browser: 'fr-FR' }), 'fr');
  assert.equal(resolveEvalLang({ programId: FR, browser: 'ar-SA' }), 'ar');
  assert.equal(resolveEvalLang({ programId: FR, browser: 'en-US' }), 'fr', 'الإنجليزيّ يفتح فرنسيّة (الكوهورت فرنسيّة)');
  assert.equal(resolveEvalLang({ programId: FR, linkLang: 'en', browser: 'en-US' }), 'en', 'رابط إنجليزيّ صريح يُحترم لمتصفّح إنجليزيّ');
  assert.equal(resolveEvalLang({ programId: FR, linkLang: 'en', browser: 'fr-FR' }), 'fr');
  assert.equal(resolveEvalLang({ programId: 'other', linkLang: 'auto', browser: 'fr-CA' }), 'fr');
  assert.equal(resolveEvalLang({ programId: 'other', linkLang: 'auto', browser: 'de-DE' }), 'en');
  assert.equal(resolveEvalLang({ programId: 'other', linkLang: 'ar', browser: 'fr-FR' }), 'ar');
  assert.equal(resolveEvalLang({ programId: 'other', browser: '' }), 'ar');
  assert.deepEqual(FR_PROGRAMS, [FR]);
});

test('P89: نافذة الرابط بتوقيت الرياض لا UTC — في fr.ts وفي links.fmtWhen (لوحة الروابط)', () => {
  // 2026-12-06T04:00Z = 07:00 الرياض
  assert.match(fmtRiyadh('2026-12-06T04:00:00Z', 'fr'), /07:00/); assert.match(fmtRiyadh('2026-12-06T04:00:00Z', 'en'), /07:00/); assert.match(fmtRiyadh('2026-12-06T04:00:00Z', 'ar'), /07:00/);
  assert.match(fmtWhen('2026-12-06T04:00:00Z', 'en'), /07:00/); assert.match(fmtWhen('2026-12-06T04:00:00Z', 'ar'), /07:00/);
  assert.doesNotMatch(fmtWhen('2026-12-06T04:00:00Z', 'ar'), /١٤٤٨|هـ/, 'ميلاديّ بأرقام لاتينيّة');
  const w = windowText('before', { opens_at: '2026-12-06T04:00:00Z', closes_at: '2026-12-24T14:00:00Z' }, 'fr');
  assert.match(w, /s’ouvre le .*07:00.*jusqu’au .*17:00.*heure de Riyad/);
  assert.match(windowText('after', { closes_at: '2026-12-24T14:00:00Z' }, 'ar'), /17:00.*بتوقيت الرياض/);
  assert.match(windowText('off', null, 'en'), /expired/); assert.equal(windowText('open', null, 'fr'), '');
});

test('P89: ترجمة الأسئلة بالمفتاح — اليومي 9/9 والختامي 15/15، والأقسام والخيارات، والرجوع إلى الإنجليزيّة لمفتاح مجهول', () => {
  const daily = ['daily_clarity', 'daily_teaching_style', 'daily_motivation', 'daily_confidence', 'daily_difficulty', 'daily_skills', 'daily_new_word', 'daily_new_sentence', 'daily_suggestion'];
  const final = Array.from({ length: 15 }, (_, i) => `final_${i + 1}`);
  assert.deepEqual(frCoverage(daily.map(k => ({ question_key: k }))), { translated: 9, total: 9 });
  assert.deepEqual(frCoverage(final.map(k => ({ question_key: k }))), { translated: 15, total: 15 });
  for (const k of [...daily, ...final]) assert.ok(FR_Q[k].length > 3 && !/[\u0600-\u06FF]/.test(FR_Q[k]), k);
  assert.equal(frQuestion({ question_key: 'daily_difficulty' }), 'Comment avez-vous trouvé la leçon d’aujourd’hui ? (1 = très facile, 5 = très difficile)');
  assert.equal(frQuestion({ question_key: 'new_q', text_en: 'New question', text_ar: 'سؤال' }), 'New question');
  assert.equal(frQuestion({ question_key: null, text_ar: 'سؤال' }), 'سؤال');
  assert.equal(frSection('تقييم الحصة / Class Evaluation'), 'Évaluation de la séance'); assert.equal(frSection('المدربون'), 'Formateurs'); assert.equal(frSection('قسم جديد', 'New section'), 'New section');
  assert.equal(frOption('التحدث / Speaking'), 'Expression orale'); assert.equal(frOption('خيار آخر'), 'خيار آخر');
  for (const k of ['dailyTitle', 'participant', 'submit', 'thanks', 'dupDaily', 'privacy', 'missingQs']) assert.ok(STR_FR[k], k);
});

test('P89: الصفحة والعدّة — FlowLang يشمل fr، أزرار اللغة الثلاثة لبرنامج فرنسيّ، /france يمرّر lang كما هو', () => {
  const sf = read('app/components/StepFlow.tsx'); assert.ok(sf.includes("export type FlowLang = 'ar' | 'en' | 'fr'") && sf.includes('fl-lang-') && sf.includes("fr: 'Suivant'"));
  const pg = read('app/evaluate/[kind]/page.tsx');
  for (const s of ['resolveEvalLang({', 'windowText(', 'LQ(q)', 'LS(g.key, g.en)', 'LO(o)', "['fr', 'ar', 'en']", 'SCALE_FR[v]', 'ONCE_FR.perDay', 'KIND_FR[']) assert.ok(pg.includes(s), s);
  assert.ok(!pg.includes('L(q.text_ar, q.text_en)') && !pg.includes('linkStateText('), 'لا بقايا من المسار القديم');
  const fr = read('app/france/page.tsx'); assert.ok(fr.includes('?lang=${lang}') && !fr.includes("lang === 'ar' ? 'ar' : 'en'"));
});

test('P89-ب: تحت الرابط لا تُستعلم classrooms من المتصفّح (غير مقروءة للضيف) — الشعب من واجهة الروابط', () => {
  const pg = read('app/evaluate/[kind]/page.tsx');
  assert.ok(pg.includes("link ? Promise.resolve({ data: linkRooms as any[] }) : db.from('classrooms')"), 'الشعب من linkRooms تحت الرابط');
  assert.ok(!pg.includes("filter(r => linkRooms.some(x => x.id === r.id))"), 'لا ترشيح على نتيجة استعلام فارغة');
});
