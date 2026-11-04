// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P48-أ — «ملف الاعتماد الحيّ»: سجلّ المعايير (إطاران) · قواعد الأدلة · التغطية · ما ينقص · التأهّل · الفقرة · خريطة الكفايات · العرض العام
import test from 'node:test';
import assert from 'node:assert/strict';
import { P48_NAMES_AR, FRAMEWORKS, COVERAGE_AR, NARRATIVE_MIN, NARRATIVE_MAX, K_MIN, PAS_STANDARDS, TPS_STANDARDS, DEFAULT_STANDARDS, subsOf, topsOf, tpsGeneral, EVIDENCE_RULES, PAS_SUB_CODES, EVIDENCE_KIND_AR, coverageOf, missingTasks, fileScore, eligibilityOf, cleanNarrativeText, narrativeMissing, localNarrative, narrativePrompt, parseNarrative, cleanSkillMap, skillMapCoverage, filePublicView, type Evidence } from '../lib/accreditation/registry';

const EV = (kind: Evidence['kind'], codes: string[], n?: number, at: string | null = '2026-10-01'): Evidence => ({ id: `${kind}:${codes.join('/')}`, kind, codes, label_ar: `دليل ${kind}`, at, href: '/me/reports', n });

test('P48 · الأسماء: الرسمي والسردي والإطاران وحالات التغطية بكلمات', () => {
  assert.equal(P48_NAMES_AR.file, 'ملف الاعتماد الحيّ'); assert.equal(P48_NAMES_AR.official, 'ملف الدراسة الذاتية للاعتماد البرامجي'); assert.equal(P48_NAMES_AR.body_ar, 'هيئة تقويم التعليم والتدريب');
  assert.deepEqual([...FRAMEWORKS], ['pas', 'tps']); assert.deepEqual(Object.values(COVERAGE_AR), ['مستوفى', 'جزئي', 'ناقص', 'يدوي']); assert.equal(NARRATIVE_MIN, 40); assert.equal(NARRATIVE_MAX, 1200); assert.equal(K_MIN, 5);
});
test('P48 · سجلّ الاعتماد البرامجي: 4 معايير رئيسة و21 فرعيًّا بنصّ رسمي، ورموز فريدة ومرتّبة', () => {
  const tops = topsOf(PAS_STANDARDS, 'pas'); assert.equal(tops.length, 4); assert.deepEqual(tops.map(t => t.code), ['1', '2', '3', '4']);
  assert.deepEqual(tops.map(t => subsOf(PAS_STANDARDS, 'pas', t.code).length), [6, 6, 5, 4]); assert.equal(PAS_STANDARDS.length, 25);
  assert.equal(new Set(PAS_STANDARDS.map(s => s.code)).size, 25); assert.ok(PAS_STANDARDS.every(s => s.text_ar.length >= 10 && s.title_ar.length >= 4), 'نصوص وعناوين');
  assert.match(tops[0].title_ar, /تصميم/); assert.match(tops[1].title_ar, /تقويم|جودة/); assert.match(tops[2].title_ar, /المتدرب/); assert.match(tops[3].title_ar, /المدرب/);
  assert.ok(PAS_STANDARDS.every(s => s.source === 'official'), 'المصدر الرسمي');
});
test('P48 · سجلّ معايير المعلّم: 3 مجالات بأوزان 21/40/39 · 10 معايير عامة · 21 فرعيًّا', () => {
  const domains = topsOf(TPS_STANDARDS, 'tps'); assert.equal(domains.length, 3); assert.deepEqual(domains.map(d => d.weight), [21, 40, 39]); assert.equal(domains.reduce((a, d) => a + (d.weight || 0), 0), 100);
  const general = tpsGeneral(TPS_STANDARDS); assert.equal(general.length, 10); assert.ok(general.every(g => g.parent && ['A', 'B', 'C'].includes(g.parent)), 'كل معيار عام تحت مجال');
  const leaves = TPS_STANDARDS.filter(s => s.parent && !general.some(g => g.code === s.parent) === false); assert.equal(TPS_STANDARDS.length, 34); assert.equal(leaves.length, 21);
  assert.equal(DEFAULT_STANDARDS.length, 59); assert.equal(new Set(DEFAULT_STANDARDS.map(s => `${s.framework}:${s.code}`)).size, 59);
});
test('P48 · قواعد الأدلة: لكل معيار فرعي قاعدة بمهمة ورابط خدمة؛ اليدوية أربعة بالضبط', () => {
  const subs = PAS_STANDARDS.filter(s => s.parent); assert.equal(PAS_SUB_CODES.length, 21); assert.ok(subs.every(s => EVIDENCE_RULES[s.code]), 'قاعدة لكل فرعي');
  assert.ok(Object.values(EVIDENCE_RULES).every(r => r.task_ar.length >= 10 && r.href.startsWith('/') || r.href.startsWith('#')), 'مهمة ورابط');
  assert.deepEqual(Object.entries(EVIDENCE_RULES).filter(([, r]) => !r.auto).map(([c]) => c), ['1.3', '2.3', '2.4', '4.2']);
  assert.ok(Object.keys(EVIDENCE_KIND_AR).length >= 18, 'أنواع الأدلة');
});
test('P48 · التغطية: بلا أدلة = ناقص/يدوي وصفر؛ أدلة كافية = مستوفى (1.1 يحتاج دليلين)؛ الفقرة الموقَّعة تستوفي اليدوي', () => {
  const empty = coverageOf(PAS_STANDARDS, [], new Set()); assert.equal(empty.length, 4); assert.equal(fileScore(empty).met, 0); assert.equal(fileScore(empty).total, 21);
  assert.equal(empty.flatMap(s => s.subs).filter(x => x.state === 'manual').length, 4); assert.equal(empty.flatMap(s => s.subs).filter(x => x.state === 'missing').length, 17);
  const ev = [EV('program', ['1.1']), EV('units', ['1.1', '1.4', '1.6'], 3), EV('need', ['1.2'], 1), EV('template', ['1.6', '1.5'], 4)];
  const c = coverageOf(PAS_STANDARDS, ev, new Set(['1.3'])); const s1 = c.find(s => s.code === '1')!;
  assert.equal(s1.subs.find(x => x.code === '1.1')!.state, 'met'); assert.equal(s1.subs.find(x => x.code === '1.3')!.state, 'met'); assert.ok(s1.subs.find(x => x.code === '1.3')!.signed);
  assert.equal(s1.met, 6); assert.equal(s1.pct, 100); assert.equal(fileScore(c).met, 6); assert.equal(c.find(s => s.code === '4')!.pct, 0);
  const t = missingTasks(c); assert.equal(t.length, 15); assert.ok(t.every(x => !x.code.startsWith('1.')), 'المعيار 1 لا نواقص'); assert.ok(t.some(x => x.href === '/me/after' && x.code === '3.5'));
});
test('P48 · التأهّل يُشتقّ: دبلوم + دفعة مكتملة + وحدات + تغذية راجعة', () => {
  const e = eligibilityOf({ program_type: 'diploma', cohorts_done: 1, graduates_feedback: 6, has_units: true }); assert.equal(e.length, 4); assert.ok(e.every(x => x.ok));
  const f = eligibilityOf({ program_type: 'course', cohorts_done: 0, graduates_feedback: 0, has_units: false }); assert.ok(f.every(x => !x.ok)); assert.ok(f.every(x => x.text_ar.length > 5));
});
test('P48 · الفقرة: تنظيف وحدّ أدنى؛ المسودّة المحلية من الأدلة فقط وتذكر النواقص؛ الموجّه بلا أسماء ويحظرها؛ التحليل ينزع الأسوار', () => {
  assert.equal(narrativeMissing('قصير').length, 1); assert.equal(narrativeMissing('أ'.repeat(40)).length, 0); assert.equal(cleanNarrativeText(' x '.repeat(1000)).length, NARRATIVE_MAX);
  const ev = [EV('units', ['1.1', '1.4', '1.6'], 3), EV('final', ['2.1', '2.5'], 2)]; const c = coverageOf(PAS_STANDARDS, ev, new Set()); const s2 = c.find(s => s.code === '2')!; const std = PAS_STANDARDS.find(s => s.code === '2')!;
  const txt = localNarrative(std, s2.subs); assert.ok(txt.length >= NARRATIVE_MIN); assert.match(txt, /2\.1/); assert.match(txt, /ما لم يثبت بعد/); assert.match(txt, /2\.2/);
  const p = narrativePrompt(std, subsOf(PAS_STANDARDS, 'pas', '2'), s2.subs); assert.match(p, /لا تذكر أسماء|بلا أسماء/); assert.match(p, /2\.6/); assert.ok(!/undefined/.test(p));
  assert.equal(parseNarrative('```text\nفقرة\n```'), 'فقرة'); assert.equal(parseNarrative('# عنوان\nنصّ'), 'نصّ');
});
test('P48 · خريطة الكفايات: تنظيف إلى الرموز المعروفة فقط وحساب التغطية من 10', () => {
  const tps = tpsGeneral(TPS_STANDARDS).map(t => t.code); const m = cleanSkillMap({ 'ATH-AR-003': [tps[0], 'ZZZ', tps[0]], 'X': [tps[1]], 'ATH-PD-001': 'bad' }, ['ATH-AR-003', 'ATH-PD-001'], tps);
  assert.deepEqual(Object.keys(m), ['ATH-AR-003']); assert.deepEqual(m['ATH-AR-003'], [tps[0]]); const cov = skillMapCoverage(m, tps); assert.equal(cov.n, 1); assert.equal(cov.total, 10);
  assert.deepEqual(cleanSkillMap(null, ['A'], tps), {});
});
test('P48 · العرض العام: تغطية ونسب بلا أدلة تفصيلية ولا أسماء موقّعين', () => {
  const c = coverageOf(PAS_STANDARDS, [EV('units', ['1.1', '1.4', '1.6'], 3)], new Set()); const v = filePublicView({ program_ar: 'دبلوم', cov: c, narratives: [{ framework: 'pas', code: '1', text_ar: 'ف'.repeat(50), evidence_ids: [], signed_by: 'u', signed_name: 'د. فلان', signed_at: '2026-10-01', source: 'human' }], updated_at: '2026-10-02' }) as any;
  const js = JSON.stringify(v); assert.ok(!js.includes('فلان')); assert.ok(!js.includes('signed_by')); assert.equal(v.standards.length, 4); assert.equal(v.standards[0].met, 2); assert.equal(v.standards[0].partial, 1); assert.equal(v.total, 21);
});
