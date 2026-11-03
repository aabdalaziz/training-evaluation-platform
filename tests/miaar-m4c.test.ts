// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م4-ج «هيئة التصحيح» — منطق خالص: سحب القراءة الثانية · قاعدة الاتفاق · كابا بالأزواج · المرآة · بوّابة الاعتماد · الحذف · الطلاقة · بوّابات الإصدار والقراءة */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RATER_POLICY, bandOf, needsSecondReading, agreementOf, agreementReport, raterMirror, calibrationOf, kappaLight, dueForPurge, fluencyOf, maskRater } from '../lib/miaar/raters';
import { nextReadingFor, releaseGate } from '../lib/miaar/rating';
import { productiveBlock } from '../lib/miaar/performance';
import { SYSTEM_ROLES, hasPermission } from '../lib/portal/roles';
import type { Reading } from '../lib/miaar/raters';

const R = (performance_id: string, rater_id: string, reading: number, band: number): Reading => ({ performance_id, rater_id, reading, scores: { a: band, b: band }, band });

test('م4-ج: الدرجة الكلّية = متوسّط الأبعاد مقرَّبًا (النصف يصعد) وضمن 0–5', () => {
  assert.equal(bandOf({ a: 3, b: 4 }), 4, '3.5 → 4'); assert.equal(bandOf({ a: 3, b: 3, c: 4 }), 3, '3.33 → 3'); assert.equal(bandOf({ a: 5, b: 5 }), 5, 'max'); assert.equal(bandOf({}), 0, 'empty');
});

test('م4-ج: سحب القراءة الثانية — أوّل 50 دائمًا، ثم عيّنة ثابتة بالمعرّف ≈ 20%، والحدّ (نصف درجة) دائمًا', () => {
  assert.ok(needsSecondReading({ id: 'x', skill_read_count: 10, first_mean: 3 }), 'first 50 → always');
  assert.ok(needsSecondReading({ id: 'y', skill_read_count: 500, first_mean: 2.5 }), 'borderline → always');
  let hits = 0; for (let i = 0; i < 2000; i += 1) if (needsSecondReading({ id: `perf-${i}`, skill_read_count: 500, first_mean: 3 })) hits += 1;
  const rate = hits / 2000; assert.ok(rate > 0.15 && rate < 0.25, `sample rate ≈ 20% (got ${rate})`);
  assert.equal(needsSecondReading({ id: 'perf-7', skill_read_count: 500, first_mean: 3 }), needsSecondReading({ id: 'perf-7', skill_read_count: 500, first_mean: 3 }), 'deterministic');
});

test('م4-ج: قاعدة الاتفاق — تطابق يعتمد الأولى · فرق درجة متوسّط · فرق درجتين تحكيم', () => {
  const r1: Reading = { performance_id: 'p', rater_id: 'a', reading: 1, scores: { x: 3, y: 4 }, band: 4 };
  assert.equal(agreementOf(r1, { ...r1, rater_id: 'b', reading: 2 }).kind, 'agree', 'same band');
  const avg = agreementOf(r1, { performance_id: 'p', rater_id: 'b', reading: 2, scores: { x: 2, y: 3 }, band: 3 });
  assert.equal(avg.kind, 'average', 'gap 1'); assert.deepEqual(avg.scores, { x: 3, y: 4 }, '(3+2)/2=2.5→3 · (4+3)/2=3.5→4');
  assert.equal(agreementOf(r1, { performance_id: 'p', rater_id: 'b', reading: 2, scores: { x: 1, y: 2 }, band: 2 }).kind, 'adjudicate', 'gap 2');
});

test('م4-ج: كابا بالمهارة والزوج — رمادي قبل 10 أزواج، وذهبي عند التطابق التامّ', () => {
  const reads: Reading[] = []; for (let i = 0; i < 12; i += 1) { const b = i % 6; reads.push(R(`w${i}`, 'r1', 1, b), R(`w${i}`, 'r2', 2, b)); }
  reads.push(R('s1', 'r1', 1, 3), R('s1', 'r3', 2, 1));
  const rep = agreementReport(reads, (pid) => (pid.startsWith('w') ? 'writing' : 'speaking'), { writing: 0, speaking: 1 });
  const w = rep.find((s) => s.skill === 'writing')!; assert.equal(w.pairs_n, 12, '12 pairs'); assert.equal(w.kappa, 1, 'perfect'); assert.equal(w.light, 'gold', 'gold'); assert.equal(w.by_pair[0].n, 12, 'pair n');
  const sp = rep.find((s) => s.skill === 'speaking')!; assert.equal(sp.light, 'gray', 'under 10 pairs → gray'); assert.equal(sp.adjudications, 1, 'adjudications passthrough');
  assert.equal(kappaLight(0.5, 20).ar, 'مقبول', 'interpretation'); assert.equal(kappaLight(0.3, 20).light, 'red', 'weak');
});

test('م4-ج: مرآة المصحّح — الميل سالب للأشدّ، وعدد المشتركة، ونسبة التحكيم', () => {
  const reads: Reading[] = [R('p1', 'me', 1, 2), R('p1', 'o', 2, 3), R('p2', 'me', 2, 1), R('p2', 'o', 1, 3), R('p3', 'me', 1, 4)];
  const m = raterMirror(reads, 'me'); assert.equal(m.n, 3, 'my readings'); assert.equal(m.n_pairs, 2, 'shared'); assert.equal(m.severity, -1.5, 'stricter'); assert.match(m.severity_ar, /أشدّ/, 'ar'); assert.equal(m.adjudication_rate, 0.5, 'one of two gaps ≥ 2');
});

test('م4-ج: بوّابة الاعتماد — 5 مراسٍ وكابا ≥ .6', () => {
  assert.equal(calibrationOf([{ mine: 3, anchor: 3 }, { mine: 2, anchor: 2 }]).need, 3, 'need 3 more');
  const pass = calibrationOf([3, 1, 4, 2, 5].map((b) => ({ mine: b, anchor: b }))); assert.ok(pass.passed && pass.kappa === 1, 'perfect → passed');
  const fail = calibrationOf([{ mine: 5, anchor: 1 }, { mine: 1, anchor: 5 }, { mine: 4, anchor: 2 }, { mine: 2, anchor: 4 }, { mine: 5, anchor: 0 }]); assert.ok(!fail.passed && fail.need === 0, 'inverse → failed'); assert.match(fail.ar, /24 ساعة/, 'lock hint');
});

test('م4-ج: من يقرأ ماذا — أولى/ثانية عمياء/تحكيم/تأهيل، ولا يقرأ أحد الأداء نفسه مرّتين', () => {
  const staff = { id: 's', email: 's@x', role: 'ADMIN', kind: 'staff' as const }; const rater = { id: 'r', email: 'r@x', role: 'RATER', kind: 'rater' as const }; const ok = { passed: true, locked_until: null }; const no = { passed: false, locked_until: null };
  const p = { status: 'submitted', second_reading: false, adjudication: null, is_anchor: false };
  assert.equal(nextReadingFor(p, [], rater, ok).reading, 1, 'first');
  assert.equal(nextReadingFor({ ...p, status: 'rated' }, [R('p', 'a', 1, 3)], rater, ok).reading, null, 'not sampled → rater cannot add second');
  assert.equal(nextReadingFor({ ...p, status: 'rated' }, [R('p', 'a', 1, 3)], staff, ok).reading, 2, 'staff optional second');
  assert.equal(nextReadingFor({ ...p, status: 'rated', second_reading: true }, [R('p', 'a', 1, 3)], rater, ok).reading, 2, 'sampled → second');
  assert.equal(nextReadingFor({ ...p, status: 'rated', second_reading: true }, [R('p', 'r', 1, 3)], rater, ok).reading, 1, 'own unreleased reading → may revise (save then release)');
  assert.equal(nextReadingFor({ ...p, status: 'rated', second_reading: true }, [R('p', 'r', 1, 3), R('p', 'b', 2, 3)], rater, ok).reading, null, 'someone read after me → no revise, no second');
  assert.equal(nextReadingFor({ ...p, status: 'released' }, [R('p', 'r', 1, 3)], rater, ok).reading, null, 'released → no');
  assert.equal(nextReadingFor({ ...p, status: 'rated', adjudication: 'needed' }, [R('p', 'a', 1, 1), R('p', 'b', 2, 4)], staff, ok).reading, 3, 'staff adjudicates');
  assert.equal(nextReadingFor({ ...p, status: 'rated', adjudication: 'needed' }, [R('p', 'a', 1, 1), R('p', 'b', 2, 4)], rater, ok).reading, null, 'rater cannot adjudicate');
  assert.equal(nextReadingFor({ ...p, status: 'released', is_anchor: true }, [], rater, no).reading, 0, 'uncalibrated → anchor reading');
  assert.equal(nextReadingFor(p, [], rater, no).reading, null, 'uncalibrated → no real queue');
  assert.equal(nextReadingFor({ ...p, status: 'released', is_anchor: true }, [], rater, { passed: false, locked_until: '2999-01-01' }).reading, null, 'locked');
});

test('م4-ج: بوّابة الإصدار — التحكيم يوقف، والقراءة الثانية المسحوبة تنتظر', () => {
  assert.equal(releaseGate({ status: 'rated', second_reading: false, adjudication: null }, 1).ok, true, 'single reading ok');
  assert.equal(releaseGate({ status: 'rated', second_reading: true, adjudication: null }, 1).ok, false, 'waiting second');
  assert.equal(releaseGate({ status: 'rated', second_reading: true, adjudication: null }, 2).ok, true, 'two readings ok');
  assert.match(releaseGate({ status: 'rated', second_reading: true, adjudication: 'needed' }, 2).why_ar || '', /تحكيم/, 'adjudication blocks');
  assert.equal(releaseGate({ status: 'rated', second_reading: true, adjudication: 'done' }, 3).ok, true, 'adjudicated ok');
});

test('م4-ج: البطاقة — «ما قلتَه» للتحدّث المعتمد وسياسة الصوت، والحذف يستهدف المنتهي فقط', () => {
  const hr = { scores: { a: 3 }, estimated: 'B1' as const, verdict_ar: 'يحقّق', note_ar: null };
  const block = productiveBlock([{ skill: 'speaking', status: 'released', item_code: 'S1', level_target: 'B1', duration_sec: 60, human_rating: hr, released_at: '2026-11-03T00:00:00Z', transcript: 'أنا أتكلّم عن مدينتي' }]) as any;
  assert.equal(block['التحدّث']['ما_قلتَه'], 'أنا أتكلّم عن مدينتي', 'transcript on card'); assert.match(block['سياسة_الصوت'], /180/, 'audio policy');
  const w = productiveBlock([{ skill: 'writing', status: 'released', item_code: 'W1', level_target: 'B1', word_count: 90, human_rating: hr, transcript: 'x' }]) as any; assert.equal(w['الكتابة']['ما_قلتَه'], undefined, 'not for writing'); assert.equal(w['سياسة_الصوت'], undefined, 'no audio → no policy');
  assert.equal(dueForPurge([{ media_path: 'a', expires_at: '2026-01-01T00:00:00Z' }, { media_path: 'b', expires_at: '2999-01-01T00:00:00Z' }, { media_path: null, expires_at: '2020-01-01T00:00:00Z' }], '2026-11-03T00:00:00Z'), 1, 'only expired with media');
  const f = fluencyOf('السلام عليكم آآ أنا إمم أدرس في الجامعة', 20)!; assert.equal(f.words, 8, 'words'); assert.equal(f.fillers, 2, 'fillers'); assert.equal(f.wpm, 24, 'wpm');
  assert.equal(fluencyOf('', 10), null, 'empty');
});

test('م4-ج: دور «المصحّح» — صلاحية miaar.rate وحدها، بلا جسر قديم، والقناع ثابت بلا بريد', () => {
  const r = SYSTEM_ROLES.find((x) => x.code === 'RATER')!; assert.ok(r, 'exists'); assert.deepEqual(r.permissions, ['miaar.rate'], 'one permission'); assert.equal(r.legacy_role, null, 'no bridge'); assert.equal(r.landing, '/admin/miaar/rating', 'landing');
  assert.ok(hasPermission(['RATER'], 'miaar.rate'), 'can rate'); assert.ok(!hasPermission(['RATER'], 'miaar.bank.write'), 'cannot write bank'); assert.ok(hasPermission(['ADMIN'], 'miaar.rate'), 'admin wildcard');
  assert.equal(maskRater('abc'), maskRater('abc'), 'stable'); assert.match(maskRater('abc'), /^مصحّح [0-9A-F]{4}$/, 'masked'); assert.equal(RATER_POLICY.audio_days, 180, 'policy');
});
