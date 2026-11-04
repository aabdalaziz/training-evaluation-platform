// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P48-ب — «التجميد والتحقّق والتجميع»: JSON قانوني · رمز النسخة · شروط التجميد · ساعة المراجِع وشيخوخة الدليل · جسم النسخة · فرق التغطية · العرض العام
import test from 'node:test';
import assert from 'node:assert/strict';
import { dominantId, P48B_NAMES_AR, NOTE_MAX, AGE_MONTHS, snapshotCode, cleanNote, canonicalJson, freezeMissing, isAgeing, evidenceTimeline, ageingEvidence, snapshotBody, standardsCanonical, coverageDiff, snapshotPublicView, coverageOf, PAS_STANDARDS, filePublicView, type Evidence, type Narrative } from '../lib/accreditation/registry';

const EV = (kind: Evidence['kind'], codes: string[], at: string | null, n?: number): Evidence => ({ id: `${kind}:${codes.join('/')}:${at}`, kind, codes, label_ar: `دليل ${kind}`, at, href: '/me/reports', n });
const NAR = (code: string, signed = true): Narrative => ({ framework: 'pas', code, text_ar: 'ف'.repeat(60), evidence_ids: [], signed_by: signed ? 'u' : null, signed_name: signed ? 'د. فلان' : null, signed_at: signed ? '2026-10-01T00:00:00Z' : null, source: 'human' });
const NOW = new Date('2026-11-04T00:00:00Z');

test('P48-ب · الأسماء والحدود ورمز النسخة (A + 9 من أبجدية بلا التباس)', () => {
  assert.equal(P48B_NAMES_AR.freeze, 'جمِّد نسخة للمراجِع'); assert.equal(P48B_NAMES_AR.clock, 'ساعة المراجِع'); assert.equal(P48B_NAMES_AR.ageing, 'دليل سيشيخ'); assert.equal(NOTE_MAX, 300); assert.equal(AGE_MONTHS, 12);
  const c = snapshotCode(() => 0.5); assert.equal(c.length, 10); assert.ok(c.startsWith('A')); assert.match(c, /^[A-Z2-9]+$/); assert.ok(!/[IO01]/.test(c), 'بلا I O 0 1');
  assert.equal(cleanNote(' x '.repeat(500)).length, NOTE_MAX); assert.equal(cleanNote(null), '');
});
test('P48-ب · JSON قانوني: ترتيب المفاتيح لا يغيّر النصّ · undefined يُسقَط · المصفوفات تحفظ ترتيبها', () => {
  assert.equal(canonicalJson({ b: 1, a: [3, { z: 1, y: null }] }), canonicalJson({ a: [3, { y: null, z: 1 }], b: 1 }));
  assert.equal(canonicalJson({ a: 1, u: undefined }), '{"a":1}'); assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1])); assert.equal(canonicalJson('س'), '"س"');
});
test('P48-ب · شروط التجميد: فقرة موقَّعة لكل معيار رئيس؛ الفرعية لا تكفي', () => {
  const cov = coverageOf(PAS_STANDARDS, [], new Set());
  assert.equal(freezeMissing(cov, []).length, 4); assert.equal(freezeMissing(cov, [NAR('1'), NAR('2'), NAR('3'), NAR('4')]).length, 0);
  assert.equal(freezeMissing(cov, [NAR('1'), NAR('2'), NAR('3'), NAR('4', false)]).length, 1); assert.match(freezeMissing(cov, [NAR('1'), NAR('2'), NAR('3'), NAR('4.1')])[0], /المعيار 4/);
});
test('P48-ب · ساعة المراجِع: ترتيب زمني تصاعدي، غير المؤرَّخ آخرًا، وعلامة الشيخوخة عند 12 شهرًا فأكثر', () => {
  const ev = [EV('final', ['2.1'], '2026-06-01'), EV('need', ['1.2'], '2025-09-15'), EV('template', ['1.6'], null), EV('units', ['1.1'], '2025-11-04')];
  const tl = evidenceTimeline(ev, NOW); assert.deepEqual(tl.map(t => t.at), ['2025-09-15', '2025-11-04', '2026-06-01', null]);
  assert.deepEqual(tl.map(t => t.ageing), [true, true, false, false]); assert.equal(tl[0].top, '1'); assert.equal(tl[0].kind_ar.length > 0, true);
  assert.equal(isAgeing('2025-12-01', NOW), false); assert.equal(isAgeing('2025-11-01', NOW), true); assert.equal(isAgeing(null, NOW), false); assert.equal(ageingEvidence(ev, NOW).length, 2);
  assert.equal(evidenceTimeline([ev[0], ev[0]], NOW).length, 1, 'بلا تكرار');
});
test('P48-ب · جسم النسخة: بلا أسماء موقّعين ولا روابط · نصوص المعايير مضمَّنة · بصمة المعايير ثابتة', () => {
  const ev = [EV('program', ['1.1'], '2026-01-01'), EV('units', ['1.1', '1.4', '1.6'], '2026-02-01', 3)]; const cov = coverageOf(PAS_STANDARDS, ev, new Set(['1.3']));
  const body = snapshotBody({ program_ar: 'دبلوم', org_ar: 'جامعة أَثَر', program_type: 'diploma', cov, narratives: [NAR('1'), NAR('1.3')], eligibility: [{ key: 'q', ok: true, text_ar: 'x' }], timeline: evidenceTimeline(ev, NOW), standards: PAS_STANDARDS, skill_map_coverage: { n: 2, total: 10 }, frozen_at: '2026-11-04T00:00:00Z', note_ar: 'كلمة' });
  const js = JSON.stringify(body); assert.ok(!js.includes('فلان')); assert.ok(!js.includes('href')); assert.ok(!js.includes('signed_by'));
  assert.equal(body.standards.length, 4); assert.ok(body.standards[0].text_ar.length > 20); assert.equal(body.standards[0].subs[0].title_ar.length > 3, true); assert.equal(body.narratives.length, 2); assert.equal(body.timeline.length, 2); assert.equal(body.org_ar, 'جامعة أَثَر'); assert.equal(body.met, 4);
  assert.equal(standardsCanonical(PAS_STANDARDS), standardsCanonical([...PAS_STANDARDS].reverse())); assert.notEqual(standardsCanonical(PAS_STANDARDS), standardsCanonical(PAS_STANDARDS.map(s => s.code === '1.6' ? { ...s, text_ar: 'نصّ آخر' } : s)));
});
test('P48-ب · فرق التغطية: صعود/نزول بين نسختين، ولا فرق بلا سابقة', () => {
  const a = filePublicView({ program_ar: 'د', cov: coverageOf(PAS_STANDARDS, [EV('program', ['1.1'], null)], new Set()), narratives: [], updated_at: null });
  const b = filePublicView({ program_ar: 'د', cov: coverageOf(PAS_STANDARDS, [EV('program', ['1.1'], null), EV('units', ['1.1', '1.4'], null)], new Set(['1.3'])), narratives: [], updated_at: null });
  const d = coverageDiff(a, b)!; assert.deepEqual(d.improved.map(x => x.code).sort(), ['1.1', '1.3', '1.4']); assert.equal(d.improved.find(x => x.code === '1.1')!.from, 'partial'); assert.equal(d.regressed.length, 0); assert.equal(d.met_from, 0); assert.equal(d.met_to, 3);
  const back = coverageDiff(b, a)!; assert.equal(back.regressed.length, 3); assert.equal(back.improved.length, 0); assert.equal(coverageDiff(null, b), null);
});
test('P48-ب · العرض العام للنسخة: يحمل الرمز والبصمتين وحالة المطابقة ولا يحمل معرّف الموقِّع', () => {
  const v = snapshotPublicView({ code: 'AABCDEFGH2', sha256: 'ab'.repeat(32), standards_sha: 'cd'.repeat(32), body: { met: 3, total: 21, standards: [] }, frozen_name: 'د. نورة', frozen_at: '2026-11-04T00:00:00Z', score_met: 3, score_total: 21, eligible: false, note_ar: null }, true);
  assert.equal(v.code, 'AABCDEFGH2'); assert.equal(v.intact, true); assert.equal(v.standards_sha_short, 'cdcdcdcd'); assert.equal(v.note_ar, ''); assert.equal((v as any).frozen_by, undefined); assert.equal(v.met, 3);
});
test('P48-ب.1 · الجهة الغالبة: الأكثر تكرارًا · التعادل للأقدم · الفراغ null', () => {
  assert.equal(dominantId(['a', 'b', 'b', null, '', 'a', 'b']), 'b'); assert.equal(dominantId(['x', 'y']), 'x'); assert.equal(dominantId([]), null); assert.equal(dominantId([null, undefined, ' ']), null);
});
