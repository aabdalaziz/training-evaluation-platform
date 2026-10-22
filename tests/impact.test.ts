import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, makeToken, TEMPLATES } from '../lib/impact/model';
import type { ImpactQuestion, ImpactResponse } from '../lib/impact/model';
import { betaInc, tTestP, hakeGain, hakeLabel, pairResponses, summarize, questionStats, domainStats, buckets, stat } from '../lib/impact/analytics';

const Q = (id: string, kind: 'scale' | 'mcq', domain = 'عام', correct?: string): ImpactQuestion =>
  ({ id, order_no: Number(id.replace(/\D/g, '')) || 1, kind, domain_ar: domain, text_ar: id, options: kind === 'mcq' ? [{ k: 'a', ar: 'a' }, { k: 'b', ar: 'b' }] : [], correct_key: correct || null, weight: 1 });
const R = (phase: 'pre' | 'post', hash: string, score: number, answers: Record<string, any> = {}, gender: string | null = null): ImpactResponse =>
  ({ id: `${phase}-${hash}`, assessment_id: 'A', phase, respondent_hash: hash, respondent_label: `…${hash.slice(-3)}`, gender, answers, scale_mean: null, knowledge_pct: null, score, submitted_at: '2026-10-01' });

test('impact: computeScore mixes scale and knowledge like SQL', () => {
  const qs = [Q('q1', 'scale'), Q('q2', 'scale'), Q('q3', 'mcq', 'المعرفة', 'b'), Q('q4', 'mcq', 'المعرفة', 'a')];
  const r = computeScore(qs, { q1: 5, q2: 3, q3: 'b', q4: 'b' }, 5);
  assert.equal(r.scale_mean, 4);            // (5+3)/2
  assert.equal(r.knowledge_pct, 50);        // 1 of 2
  assert.equal(r.score, 62.5);              // ((4-1)/4*100=75 + 50)/2
  assert.deepEqual(computeScore(qs, {}, 5), { scale_mean: null, knowledge_pct: null, score: null });
  assert.equal(computeScore([Q('s', 'scale')], { s: 1 }, 5).score, 0);
  assert.equal(computeScore([Q('s', 'scale')], { s: 5 }, 5).score, 100);
});

test('impact: token is 8 unambiguous chars', () => {
  const t = makeToken(() => 0.999); assert.equal(t.length, 8); assert.match(makeToken(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  assert.ok(TEMPLATES.find(t => t.id === 'competency')!.questions.length === 8);
});

test('impact: Student t p-values match reference', () => {
  assert.ok(Math.abs(betaInc(0.5, 0.5, 0.5) - 0.5) < 1e-9);
  assert.ok(Math.abs(tTestP(2.262, 9) - 0.05) < 0.001);     // t crit 0.05 two-tailed, df 9
  assert.ok(Math.abs(tTestP(1.96, 1e6) - 0.05) < 0.001);    // ~ normal
  assert.ok(Math.abs(tTestP(4.604, 4) - 0.01) < 0.001);     // df 4, 0.01
  assert.equal(tTestP(0, 10), 1);
});

test('impact: Hake gain and labels', () => {
  assert.equal(hakeGain(40, 70), 0.5);
  assert.equal(hakeGain(100, 100), 0);
  assert.equal(hakeGain(null, 70), null);
  assert.equal(hakeLabel(0.75).key, 'high'); assert.equal(hakeLabel(0.4).key, 'medium'); assert.equal(hakeLabel(0.1).key, 'low'); assert.equal(hakeLabel(-0.2).key, 'none'); assert.equal(hakeLabel(null).key, 'na');
});

test('impact: pairing & summary', () => {
  const rows = [
    R('pre', 'h1', 40, { q1: 2 }), R('post', 'h1', 70, { q1: 4 }),
    R('pre', 'h2', 50, { q1: 3 }), R('post', 'h2', 80, { q1: 5 }),
    R('pre', 'h3', 60, { q1: 3 }), R('post', 'h3', 60, { q1: 3 }),
    R('pre', 'h4', 55, { q1: 3 }),                     // بلا بعدي
    R('post', 'h5', 90, { q1: 5 }),                    // بلا قبلي
  ];
  const pairs = pairResponses(rows);
  assert.equal(pairs.length, 3); assert.equal(pairs[0].hash, 'h1'); // أكبر كسب أولًا (30)
  const s = summarize(rows);
  assert.equal(s.nPre, 4); assert.equal(s.nPost, 4); assert.equal(s.nPaired, 3);
  assert.equal(s.pre.mean, 50); assert.equal(s.post.mean, 70); assert.equal(s.gain, 20); assert.equal(s.gainPct, 40);
  assert.equal(s.hake, 0.4); assert.equal(s.verdict.key, 'medium');
  assert.equal(s.improved, 2); assert.equal(s.same, 1); assert.equal(s.declined, 0);
  assert.ok(s.cohenD! > 1 && s.t! > 1.5 && s.p! > 0 && s.p! < 1);
  const qs = questionStats([Q('q1', 'scale', 'المهارة')], rows, 5);
  assert.equal(qs[0].nPairs, 3); assert.equal(qs[0].pre, 2.67); assert.equal(qs[0].post, 4); assert.equal(qs[0].gain, 1.33);
  const ds = domainStats(qs, 5); assert.equal(ds[0].domain, 'المهارة'); assert.equal(ds[0].unit, 'scale'); assert.equal(ds[0].hake, hakeGain(2.67, 4, 5));
  const b = buckets(rows); assert.equal(b.find(x => x.label === '40–59')!.pre, 3); assert.equal(b.find(x => x.label === '90–100')!.post, 1);
  assert.equal(summarize([]).verdict.key, 'na'); assert.equal(stat([]).mean, null);
});

test('impact: mcq question stats use % correct', () => {
  const q = Q('k1', 'mcq', 'المعرفة', 'b');
  const rows = [R('pre', 'a', 0, { k1: 'a' }), R('post', 'a', 100, { k1: 'b' }), R('pre', 'b', 100, { k1: 'b' }), R('post', 'b', 100, { k1: 'b' })];
  const [s] = questionStats([q], rows, 5);
  assert.equal(s.unit, 'pct'); assert.equal(s.pre, 50); assert.equal(s.post, 100); assert.equal(s.hake, 1);
});
