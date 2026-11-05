// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م7 «عُبور للجهات» — رمز القاعة · المعيار المرجعي (≥ 30) · تقرير الجهة · ضبط الدعوة الخارجية · إخفاء الرموز · حالات الخدمة · الطريق */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePin, randomPin, verifyPin, hashToken, benchmarkOf, clientReport, maskEmail, serviceLabel, clientUrl, SERVICE_STATUS, SERVICE_STATUS_AR, isServiceStatus, SERVICE_TITLE, BENCHMARK_MIN_N } from '../lib/miaar/service';
import { validateCreate } from '../lib/miaar/invites';
import { normalizeCandidate } from '../lib/miaar/registry';
import { crumbsFor } from '../lib/portal/way';
import type { BoardRow } from '../lib/miaar/exit';

const exitOf = (total: number, outcome: 'passed' | 'conditional' | 'failed', skills: Record<string, number>, level = 'A1') => ({ الحالة: 'final', النتيجة: outcome, الكلي: total, المستوى: level, تقدير_ar: total >= 85 ? 'ممتاز' : total >= 75 ? 'جيد جدًا' : total >= 65 ? 'جيد' : total >= 60 ? 'اجتياز' : 'لم يجتز', المهارات: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { النسبة: v, الحالة: v < 50 ? 'below' : 'ok' }])) });
const row = (email: string, exit: any, status: BoardRow['status'] = 'finished'): BoardRow => ({ email, name: email.split('@')[0], status, started_at: '2026-11-05T08:00:00Z', finished_at: '2026-11-05T09:00:00Z', answered: 35, total: 35, idle_min: null, report_code: 'ML-AAAA-0001', exit });

test('م7: رمز القاعة — تطبيع صارم (4–8 · لا صفر/O) · توليد عشوائي صالح · التحقّق بالتجزئة', () => {
  assert.equal(normalizePin(' ab12 '), 'AB12'); assert.equal(normalizePin('A0B1'), null); assert.equal(normalizePin('OOOO'), null); assert.equal(normalizePin('123'), null); assert.equal(normalizePin('123456789'), null); assert.equal(normalizePin(12), null);
  for (let i = 0; i < 20; i += 1) { const p = randomPin(); assert.equal(p.length, 6); assert.equal(normalizePin(p), p); }
  const row_ = { proctor_pin_hash: hashToken('K7M2PQ') };
  assert.equal(verifyPin(row_, 'k7m2pq'), 'ok'); assert.equal(verifyPin(row_, ''), 'required'); assert.equal(verifyPin(row_, 'K7M2PX'), 'wrong'); assert.equal(verifyPin({ proctor_pin_hash: null }, undefined), 'ok'); assert.equal(verifyPin(null, 'ANY'), 'ok');
});

test('م7: المعيار المرجعي لا يظهر دون 30 حكمًا نهائيًا للمستوى نفسه — ويحسب المتوسط ونسبة الاجتياز والمهارات حين يكفي', () => {
  const small = Array.from({ length: 10 }, (_, i) => ({ report: { exit: exitOf(70 + i, 'passed', { listening: 70, reading: 70, grammar_vocab: 70, writing: 70, speaking: 70 }) } }));
  const b1 = benchmarkOf(small, 'A1'); assert.equal(b1.n, 10); assert.equal(b1.shown, false); assert.equal(b1.avg, null); assert.equal(b1.skills.reading, null);
  const big = Array.from({ length: BENCHMARK_MIN_N }, (_, i) => ({ report: { exit: exitOf(i < 20 ? 80 : 50, i < 20 ? 'passed' : 'failed', { listening: 80, reading: 60, grammar_vocab: 70, writing: 80, speaking: 80 }) } }));
  const b2 = benchmarkOf([...big, { report: { exit: exitOf(99, 'passed', { listening: 99, reading: 99, grammar_vocab: 99, writing: 99, speaking: 99 }, 'B1') } }, { report: { exit: { الحالة: 'pending', المستوى: 'A1' } } }, { report: {} }], 'A1');
  assert.equal(b2.n, 30); assert.equal(b2.shown, true); assert.equal(b2.avg, 70); assert.equal(b2.pass_rate, 67); assert.equal(b2.skills.reading, 60); assert.equal(b2.skills.listening, 80);
});

test('م7: تقرير الجهة — العدّادات · متوسط المهارات · أضعف محورين · التقديرات · التوصيات تتبدّل بالحالة والمعيار المرجعي', () => {
  const rows = [
    row('a@x.io', exitOf(88, 'passed', { listening: 90, reading: 85, grammar_vocab: 90, writing: 85, speaking: 85 })),
    row('b@x.io', exitOf(66, 'conditional', { listening: 70, reading: 45, grammar_vocab: 75, writing: 70, speaking: 65 })),
    row('c@x.io', exitOf(50, 'failed', { listening: 50, reading: 40, grammar_vocab: 55, writing: 55, speaking: 50 })),
    row('d@x.io', { الحالة: 'pending', النتيجة: 'pending', المستوى: 'A1', المهارات: {} }),
    row('e@x.io', null, 'started'),
  ];
  const r = clientReport('A1', rows, null);
  assert.equal(r.summary.passed, 1); assert.equal(r.summary.conditional, 1); assert.equal(r.summary.failed, 1); assert.equal(r.summary.pending, 1); assert.equal(r.finals, 3);
  const reading = r.skills.find((s) => s.skill === 'reading')!; assert.equal(reading.avg, 57); assert.equal(reading.below, 2); assert.equal(reading.benchmark, null); assert.equal(reading.delta, null);
  assert.deepEqual(r.weakest, ['reading', 'speaking']); assert.equal(r.grades['ممتاز'], 1); assert.equal(r.grades['لم يجتز'], 1);
  assert.ok(r.recommendations_ar.some((t) => t.includes('أضعف محورين') && t.includes('القراءة'))); assert.ok(r.recommendations_ar.some((t) => t.includes('مشروط'))); assert.ok(r.recommendations_ar.some((t) => t.includes('لم يجتازوا')));
  assert.equal(r.benchmark.avg, null); assert.equal(r.spec.level, 'A1'); assert.equal(r.official.ar, 'اختبار نهاية المستوى — معياري (CEFR)');
  const bench = { n: 40, shown: true, avg: 75, pass_rate: 70, skills: { listening: 75, reading: 70, grammar_vocab: 75, writing: 75, speaking: 75 } as any };
  const r2 = clientReport('A1', rows, bench); assert.equal(r2.benchmark.avg, 75); assert.equal(r2.skills.find((s) => s.skill === 'reading')!.delta, -13); assert.ok(r2.recommendations_ar.some((t) => t.includes('دون المعيار المرجعي')));
  const r3 = clientReport('A1', [], null); assert.equal(r3.finals, 0); assert.ok(r3.recommendations_ar.some((t) => t.includes('لم يكتمل التصحيح')));
});

test('م7: الدعوة الخارجية — أعمدة الخدمة تُقبل فقط مع service_mode=external · الهوية · التسمية · الرابط', () => {
  const v = validateCreate({ kind: 'group', label_ar: serviceLabel('معهد النور', 'A2'), purpose: 'level_exit', level_target: 'A2', service_mode: 'external', client_name: '  معهد   النور ', client_contact: 'x@y.z', proctor_pin_hash: 'h1', client_token_hash: 'h2', identity_mode: 'email_id' } as any);
  assert.ok(v.ok); if (!v.ok) return; const r = v.row as any;
  assert.equal(r.service_mode, 'external'); assert.equal(r.client_name, 'معهد النور'); assert.equal(r.proctor_pin_hash, 'h1'); assert.equal(r.client_token_hash, 'h2'); assert.equal(r.identity_mode, 'email_id'); assert.equal(r.label_ar, 'اختبار نهاية المستوى — معياري (CEFR) A2 — معهد النور');
  const v2 = validateCreate({ kind: 'group', label_ar: 'دعوة داخلية عادية', client_name: 'تسلّل', proctor_pin_hash: 'h', identity_mode: 'email_id' } as any);
  assert.ok(v2.ok); if (!v2.ok) return; assert.equal((v2.row as any).service_mode, undefined); assert.equal((v2.row as any).client_name, undefined); assert.equal((v2.row as any).proctor_pin_hash, undefined);
  assert.equal(clientUrl('https://athar-portal.vercel.app/', 'abc'), 'https://athar-portal.vercel.app/miaar/client/abc'); assert.equal(maskEmail('sara.ahmed@example.com'), 'sa***@example.com');
  assert.equal(SERVICE_TITLE.ar, 'خدمة الاختبار المعياري للجهات');
});

test('م7: رقم الهوية يُقبل في بيانات المتقدّم مُنقّى من غير الأرقام/الحروف · ويُهمل إن فرغ', () => {
  const c = normalizeCandidate({ name: 'سارة', email: 'S@X.IO', idNumber: ' 10-12 34 ' }); assert.equal(c?.idNumber, '10-1234');
  const c2 = normalizeCandidate({ name: 'سارة', email: 's@x.io', idNumber: '<script>' }); assert.equal(c2?.idNumber, 'script');
  const c3 = normalizeCandidate({ name: 'سارة', email: 's@x.io' }); assert.equal(c3?.idNumber, undefined);
});

test('م7: حالات الخدمة الست بأسمائها العربية · والطريق إلى بوابة الجهة', () => {
  assert.deepEqual([...SERVICE_STATUS], ['prepared', 'open', 'rating', 'delivered', 'invoiced', 'cancelled']); assert.equal(SERVICE_STATUS_AR.delivered, 'سُلِّم'); assert.ok(isServiceStatus('rating')); assert.ok(!isServiceStatus('paid'));
  const c = crumbsFor('/miaar/client/abcdef', 'ar'); assert.ok(c.some((x: any) => x.label === 'بوابة الجهة' && x.dead === true), JSON.stringify(c)); assert.equal(c[c.length - 1].current, true);
});
