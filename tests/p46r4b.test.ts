// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P46 ر4-ب — «كشف الكفايات» («العودة إلى الجواز»): الاقتراح من الأدلّة · تنظيف الكشف · النواقص · الكتابة في الجواز · سطر المتدرّب · التحقّق العام · قراءة الدفعة · «رتّب الأدلّة» (تنقية صارمة) · شاهد الهيئة
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  R4B_NAMES_AR, PROFILE_LEVEL_AR, PROFILE_REC, PROFILE_REC_AR, PROFILE_EVIDENCE_MIN_LEVEL, PROFILE_MAX_QUOTES, COHORT_MIN, JUDGMENT_WORDS_AR,
  suggestLevel, emptyProfileBody, cleanProfileBody, missingBeforeProfileSubmit, profileLineAr, levelAr, passportWrites, profileLineData, profileLineText, profilePublicView, cohortReading,
  localEvidenceQuotes, cleanEvidenceQuotes, evidencePrompt, publicVerifyView, listLineAr, type ProfileComputed, type Competency, type EvidenceItem,
} from '../lib/reports/registry';
import { witnessLines as witnessSentences, type WitnessFacts, EMPTY_WITNESS } from '../lib/directory/registry';

const K = (code: string, extra: Partial<Competency> = {}): Competency => ({ code, name_ar: 'كفاية ' + code, skill_id: 'sk-' + code, units: [], avg: null, missions: 0, cases: 0, passport_computed: null, passport_approved: null, suggested: null, why: '', ...extra });
const C = (comps: Competency[] = [K('a'), K('b', { skill_id: null })]): ProfileComputed => ({ kind: 'diploma_profile', program_ar: 'دبلوم', org_ar: 'جامعة أَثَر', classroom_ar: 'أ', trainer_ar: 'نورة', subject: { key: 'e:x@x.sa', name: 'أحمد', email: 'x@x.sa', user_id: 'u1' },
  units: [{ idx: 1, title_ar: 'و1', state: 'closed', score: 85, decision: 'completed', verify_code: 'RAAAA' }, { idx: 2, title_ar: 'و2', state: 'current', score: null, decision: '', verify_code: null }], units_total: 2, units_closed: 1, units_reached: 1, attendance_pct: 90, sessions: 10, hours: 30, attention: [], around: { missions: 1, rehearsals: 0, cases: 2, stations: 0 }, competencies: comps, computed_at: '2026-11-04T00:00:00Z', supersedes_code: null });

test('ر4-ب · الأسماء والسُلّم', () => {
  assert.equal(R4B_NAMES_AR.profile, 'كشف الكفايات'); assert.equal(R4B_NAMES_AR.story, 'العودة إلى الجواز'); assert.equal(PROFILE_LEVEL_AR.length, 6); assert.equal(PROFILE_LEVEL_AR[0], 'لم يُثبت بعد'); assert.equal(PROFILE_LEVEL_AR[3], 'متوسط'); assert.equal(PROFILE_LEVEL_AR[5], 'خبير');
  assert.equal(PROFILE_EVIDENCE_MIN_LEVEL, 3); assert.equal(PROFILE_REC.length, 4); assert.equal(PROFILE_REC_AR.complete, 'إتمام الدبلوم'); assert.equal(COHORT_MIN, 5); assert.equal(PROFILE_MAX_QUOTES, 3); assert.ok(JUDGMENT_WORDS_AR.includes('ممتاز'), 'judgment');
  assert.equal(levelAr(null), '—'); assert.equal(levelAr(0), 'لم يُثبت بعد'); assert.equal(levelAr(9), 'خبير');
});
test('ر4-ب · suggestLevel: المتوسط ← +1 بمهمّتين ← الجواز المحسوب ← لا اقتراح', () => {
  assert.equal(suggestLevel({ avg: 92, missions: 0, cases: 0, passport_computed: null }).level, 5);
  assert.equal(suggestLevel({ avg: 85, missions: 0, cases: 0, passport_computed: null }).level, 4);
  assert.equal(suggestLevel({ avg: 72, missions: 0, cases: 0, passport_computed: null }).level, 3);
  assert.equal(suggestLevel({ avg: 61, missions: 0, cases: 0, passport_computed: null }).level, 2);
  assert.equal(suggestLevel({ avg: 40, missions: 3, cases: 0, passport_computed: null }).level, 1, 'below pass: no bump');
  const b = suggestLevel({ avg: 72, missions: 2, cases: 1, passport_computed: null }); assert.equal(b.level, 4); assert.ok(b.why.includes('+1') && b.why.includes('كل يوم مهارة'), b.why);
  assert.equal(suggestLevel({ avg: 95, missions: 2, cases: 0, passport_computed: null }).level, 5, 'cap 5');
  const one = suggestLevel({ avg: 72, missions: 1, cases: 0, passport_computed: null }); assert.equal(one.level, 3); assert.ok(one.why.includes('لا ترفع'), one.why);
  const p = suggestLevel({ avg: null, missions: 0, cases: 0, passport_computed: 2.6 }); assert.equal(p.level, 3); assert.ok(p.why.includes('الجواز'), p.why);
  assert.equal(suggestLevel({ avg: null, missions: 0, cases: 0, passport_computed: null }).level, null); assert.equal(suggestLevel({ avg: null, missions: 0, cases: 0, passport_computed: 0 }).level, null);
});
test('ر4-ب · emptyProfileBody/cleanProfileBody: مستوى لكل كفاية · حدود · اقتباسات محصورة', () => {
  const c = C(); const e = emptyProfileBody(c); assert.equal(e.levels.length, 2); assert.equal(e.levels[0].level, null); assert.equal(e.show_suggest, true);
  const b = cleanProfileBody({ levels: [{ code: 'a', level: '4', evidence: ' شاهد  طويل ' }, { code: 'zz', level: 5 }, { code: 'b', level: 9 }], strengths: 'x'.repeat(700), recommendation: 'bogus', quotes: [{ code: 'a', text: 'q1', source: 's' }, { code: 'a', text: 'اقتباس 1', source: 'الوحدة 1' }, { code: 'a', text: 'اقتباس 2', source: 'الوحدة 1' }, { code: 'a', text: 'اقتباس 3', source: 'الوحدة 1' }, { code: 'a', text: 'اقتباس 4', source: 'الوحدة 1' }, { code: 'zz', text: 'غريب', source: 'x' }], show_suggest: false }, c);
  assert.deepEqual(b.levels.map(l => [l.code, l.level]), [['a', 4], ['b', null]]); assert.equal(b.levels[0].evidence, 'شاهد طويل'); assert.equal(b.strengths.length, 600); assert.equal(b.recommendation, ''); assert.equal(b.quotes.length, 3); assert.ok(b.quotes.every(q => q.code === 'a')); assert.equal(b.show_suggest, false);
  const z = cleanProfileBody({ levels: [{ code: 'a', level: 0 }], recommendation: 'repeat' }, c); assert.equal(z.levels[0].level, 0); assert.equal(z.recommendation, 'repeat');
});
test('ر4-ب · missingBeforeProfileSubmit: المستويات · الشاهد من متوسط · ما يميّزه/يواصله · التوصية والخطة', () => {
  const c = C(); const e = emptyProfileBody(c); const m = missingBeforeProfileSubmit(e, c); assert.ok(m.some(x => x.includes('مستوى لكل كفاية')) && m.some(x => x.includes('ما يميّزه')) && m.some(x => x.includes('التوصية')), m.join('|'));
  const b = cleanProfileBody({ levels: [{ code: 'a', level: 3, evidence: '' }, { code: 'b', level: 0 }], strengths: 'يشرح بوضوح ويستمع', keep: 'يواصل القراءة الصوتية', recommendation: 'finish_units' }, c);
  const m2 = missingBeforeProfileSubmit(b, c); assert.ok(m2.some(x => x.includes('جملة شاهد') && x.includes('كفاية a')), m2.join('|')); assert.ok(m2.some(x => x.includes('الوحدات التي تُستكمل')), m2.join('|'));
  const ok = cleanProfileBody({ ...b, levels: [{ code: 'a', level: 3, evidence: 'قاد درسًا كاملًا أمام زملائه' }, { code: 'b', level: 2, evidence: '' }], recommendation: 'complete' }, c); assert.deepEqual(missingBeforeProfileSubmit(ok, c), []);
});
test('ر4-ب · passportWrites: مستويات 1..5 لكفايات لها مهارة فقط', () => {
  const c = C(); const b = cleanProfileBody({ levels: [{ code: 'a', level: 4 }, { code: 'b', level: 5 }] }, c); const w = passportWrites(b, c); assert.deepEqual(w, [{ skill_id: 'sk-a', level: 4, code: 'a' }]);
  assert.deepEqual(passportWrites(cleanProfileBody({ levels: [{ code: 'a', level: 0 }] }, c), c), []);
});
test('ر4-ب · سطر المتدرّب وبياناته · سطر القائمة', () => {
  const c = C(); const b = cleanProfileBody({ levels: [{ code: 'a', level: 4, evidence: 'ش' }, { code: 'b', level: 0 }], strengths: 's', keep: 'k', recommendation: 'complete_plan', plan: 'p', admin: 'سرّي' }, c);
  const t = profileLineText(b, c); assert.ok(t.includes('أثبتَ 1 من 2') && t.includes('إتمام مع خطة متابعة') && t.includes('كفاية a'), t); assert.ok(t.length <= 300);
  const d = profileLineData(b, c); assert.equal(d.levels[0].level_ar, 'متقدم'); assert.equal(d.levels[1].level_ar, 'لم يُثبت بعد'); assert.equal(d.recommendation_ar, 'إتمام مع خطة متابعة'); assert.equal(d.units_reached, 1); assert.equal(JSON.stringify(d).includes('سرّي'), false, 'admin notes never leave');
  assert.ok(profileLineAr({ computed: c, status: 'submitted' }).includes('أحمد') && profileLineAr({ computed: c, status: 'submitted' }).includes('بانتظار'));
  assert.ok(listLineAr({ kind: 'diploma_profile', computed: c, status: 'draft', week_no: 1, period_from: '2026-11-04', period_to: '2026-11-04' }).startsWith('كشف الكفايات'));
});
test('ر4-ب · profilePublicView/publicVerifyView: أعداد ومستويات بلا اسم', () => {
  const c = C(); const b = cleanProfileBody({ levels: [{ code: 'a', level: 4 }, { code: 'b', level: 0 }], recommendation: 'complete' }, c);
  const r = { kind: 'diploma_profile', verify_code: 'RXXXX', status: 'approved', author_name: 'نورة', approved_name: 'سعد', approved_at: '2026-11-04T00:00:00Z', computed: c, body: b, week_no: 1, period_from: '', period_to: '' } as any;
  const v = publicVerifyView(r); assert.equal(v.kind, 'diploma_profile'); assert.equal(v.proven, 1); assert.equal(v.competencies, 2); assert.equal(v.distribution[4].n, 1); assert.equal(v.recommendation_ar, 'إتمام الدبلوم'); assert.equal(JSON.stringify(v).includes('أحمد'), false); assert.equal(JSON.stringify(v).includes('x@x.sa'), false);
  assert.equal(profilePublicView({ ...r, status: 'draft' }), null); assert.equal(profilePublicView({ ...r, body: { ...b, superseded_by: { code: 'R2' } } }).superseded, true);
});
test('ر4-ب · cohortReading: مخفيّة تحت 5 · توزيع ومتوسط وإتمام', () => {
  const mk = (lv: number, rec: string) => ({ computed: C(), body: { levels: [{ code: 'a', level: lv }, { code: 'b', level: 0 }], recommendation: rec } });
  assert.equal(cohortReading([mk(3, 'complete'), mk(4, 'repeat')]).shown, false);
  const r = cohortReading([mk(3, 'complete'), mk(4, 'complete'), mk(4, 'complete_plan'), mk(0, 'repeat'), mk(5, 'finish_units')]); assert.equal(r.shown, true); assert.equal(r.n, 5); assert.equal(r.completion_pct, 60); assert.equal(r.avg_hours, 30);
  const a = r.competencies.find(k => k.code === 'a')!; assert.deepEqual(a.dist, [1, 0, 0, 1, 2, 1]); assert.equal(a.avg_level, 4); assert.equal(r.competencies.find(k => k.code === 'b')!.avg_level, null);
});
test('ر4-ب · «رتّب الأدلّة»: محلي أول جملة · تنقية صارمة (مصدر · حكم · رقم غريب · طول · ≤3)', () => {
  const items: EvidenceItem[] = [{ source: 'تقرير الوحدة 1', text: 'الوحدة 1 «المدخل»: 85% في «كفاية a» · بلغ ناتج الوحدة' }, { source: 'كل يوم مهارة 3 نوفمبر', text: 'تعاملت مع الموقف بالاستماع أولًا ثم اقترحت حلًّا. وبعدها كتبت خطة.' }, { source: 'مهمة مصدَّقة «درس»', text: 'قدّم درسًا كاملًا أمام 12 متدرّبًا وسجّله.' }, { source: 'x', text: 'رابع' }];
  const loc = localEvidenceQuotes('a', items); assert.equal(loc.length, 3); assert.equal(loc[1].text, 'تعاملت مع الموقف بالاستماع أولًا ثم اقترحت حلًّا.'); assert.equal(loc[0].source, 'تقرير الوحدة 1');
  const raw = { quotes: [{ text: 'قدّم درسًا كاملًا أمام 12 متدرّبًا.', source: 'مهمة مصدَّقة «درس»' }, { text: 'أداء ممتاز في الوحدة الأولى بنسبة 85%.', source: 'تقرير الوحدة 1' }, { text: 'حصل على 97% في الوحدة.', source: 'تقرير الوحدة 1' }, { text: 'استمع أولًا ثم اقترح حلًّا.', source: 'مصدر مختلق' }, { text: 'قصير', source: 'تقرير الوحدة 1' }, { text: 'بلغ ناتج الوحدة الأولى بنسبة 85%.', source: 'تقرير الوحدة 1' }] };
  const cl = cleanEvidenceQuotes('a', raw, items); assert.equal(cl.quotes.length, 2, JSON.stringify(cl)); assert.equal(cl.rejected, 4); assert.ok(cl.quotes.every(q => !q.text.includes('ممتاز') && !q.text.includes('97')));
  assert.deepEqual(cleanEvidenceQuotes('a', null, items), { quotes: [], rejected: 0 }); assert.equal(cleanEvidenceQuotes('a', { quotes: Array.from({ length: 6 }, () => ({ text: 'قدّم درسًا كاملًا أمام 12 متدرّبًا.', source: 'مهمة مصدَّقة «درس»' })) }, items).quotes.length, 1, 'dedupe');
  const p = evidencePrompt('كفاية a', items); assert.ok(p.system.includes('ممنوع') && p.user.includes('كفاية a') && JSON.parse(p.user).evidence.length === 4);
});
test('ر4-ب · شاهد الهيئة: «قاد دبلومًا موثَّقًا بـ…»', () => {
  const f: WitnessFacts = { ...EMPTY_WITNESS, profiles_led: 1, diplomas_led: 1 }; const s1 = witnessSentences(f).find(x => x.key === 'profiles_led')!; assert.ok(s1 && s1.text.includes('قاد دبلومًا موثَّقًا') && s1.text.includes('كشف كفايات معتمَد واحد'), s1?.text);
  const s7 = witnessSentences({ ...EMPTY_WITNESS, profiles_led: 7, diplomas_led: 2 }).find(x => x.key === 'profiles_led')!; assert.ok(s7.text.includes('دبلومين') && s7.text.includes('7 كشوف'), s7.text);
  const s12 = witnessSentences({ ...EMPTY_WITNESS, profiles_led: 12, diplomas_led: 3 }).find(x => x.key === 'profiles_led')!; assert.ok(s12.text.includes('3 دبلومات') && s12.text.includes('12 كشف كفايات معتمَدًا'), s12.text);
  assert.equal(witnessSentences(EMPTY_WITNESS).some(x => x.key === 'profiles_led'), false);
});
