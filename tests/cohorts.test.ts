import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvaluations, buildFacts } from '../lib/reports/analytics';
import type { Lookups } from '../lib/reports/analytics';
import { cohorts, cohortInsights, trainerFairness, fairnessNotes, monthLabel, cohortsCsv, trainersCsv, SHRINK_K } from '../lib/reports/cohorts';
import { factsFrom, buildSummaryPrompt, parseSummary, localSummary, summaryHtml, generateExecSummary } from '../lib/ai/exec-summary';

const lk: Lookups = {
  programs: [{ id: 'p1', name_ar: 'برنامج أ' }, { id: 'p2', name_ar: 'برنامج ب (صعب)' }],
  classrooms: [{ id: 'c1', code: 'A-1', program_id: 'p1', trainer_id: 't1' }, { id: 'c2', code: 'A-2', program_id: 'p1', trainer_id: 't2' }, { id: 'c3', code: 'B-1', program_id: 'p2', trainer_id: 't3' }],
  trainers: [{ id: 't1', name: 'خالد' }, { id: 't2', name: 'منى' }, { id: 't3', name: 'سعد' }],
  questions: [{ id: 'q1', text_ar: 'الشرح', section_ar: 'المدرب', kind: 'RATING_5' }, { id: 'q2', text_ar: 'المحتوى', section_ar: 'المحتوى', kind: 'RATING_5' }],
};
let seq = 0;
function evalsFor(classroom: string, program: string, n: number, score: number, month: string) {
  const ev: any[] = [], an: any[] = [];
  for (let i = 0; i < n; i++) { const id = `e${++seq}`; ev.push({ id, program_id: program, classroom_id: classroom, kind: 'DAILY', submitted_at: `${month}-1${i % 9}T08:00:00Z`, guest_email: `${classroom}-${i}@x` }); an.push({ evaluation_id: id, question_id: 'q1', rating_value: score }, { evaluation_id: id, question_id: 'q2', rating_value: Math.max(1, score - 1) }); }
  return { ev, an };
}
const a = evalsFor('c1', 'p1', 12, 5, '2026-08'); const b = evalsFor('c2', 'p1', 12, 3, '2026-09'); const c = evalsFor('c3', 'p2', 6, 3, '2026-09');
const raw = [...a.ev, ...b.ev, ...c.ev]; const ans = [...a.an, ...b.an, ...c.an];
const evals = buildEvaluations(raw, ans, lk); const facts = buildFacts(ans, lk.questions);

test('cohorts by classroom: two cohorts, deltas, perf, insights flag spread', () => {
  const rows = cohorts('p1', evals, facts, lk, 'classroom');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, 'A-1'); assert.equal(rows[0].mean, 4.5); assert.equal(rows[0].n, 12); assert.equal(rows[0].perf, 'ok');
  assert.equal(rows[1].label, 'A-2'); assert.equal(rows[1].mean, 2.5); assert.equal(rows[1].delta, -2); assert.equal(rows[1].vsBest, -2); assert.equal(rows[1].perf, 'bad');
  assert.deepEqual(rows[0].trainers, ['خالد']);
  const ins = cohortInsights(rows);
  assert.ok(ins.some(x => x.kind === 'warn' && x.text.includes('تفاوت كبير')));
  assert.ok(ins.some(x => x.text.includes('دون المستهدف')));
  const csv = cohortsCsv('برنامج أ', rows); assert.equal(csv.length, 3);
});

test('cohorts by month/quarter + labels + insufficient data', () => {
  const m = cohorts('p1', evals, facts, lk, 'month'); assert.equal(m.length, 2); assert.equal(m[0].label, 'أغسطس 2026');
  const q = cohorts('p1', evals, facts, lk, 'quarter'); assert.equal(q.length, 1); assert.equal(q[0].label, '2026-Q3');
  assert.equal(monthLabel('2026-01'), 'يناير 2026');
  assert.equal(cohortInsights(q)[0].kind, 'info');
  assert.equal(cohorts('zzz', evals, facts, lk, 'classroom').length, 0);
});

test('trainerFairness: shrinkage, context adjustment, ranks and confidence', () => {
  const res = trainerFairness(evals, facts, lk);
  assert.ok(res.globalMean != null);
  const g = res.globalMean as number;
  const kh = res.rows.find(r => r.name === 'خالد')!; const sa = res.rows.find(r => r.name === 'سعد')!; const mo = res.rows.find(r => r.name === 'منى')!;
  // الانكماش يقرّب الخام نحو المتوسط العام
  assert.ok(kh.raw! > kh.adjusted! && kh.adjusted! > g);
  assert.ok(mo.raw! < mo.adjusted! && mo.adjusted! < g);
  assert.equal(kh.adjusted, Math.round(((12 * kh.raw! + SHRINK_K * g) / (12 + SHRINK_K)) * 100) / 100);
  // سعد درّس البرنامج الصعب وحده → سياقه 0 (هو متوسط برنامجه)؛ منى دون متوسط برنامجها
  assert.equal(sa.context, 0); assert.ok(mo.context! < 0); assert.ok(kh.context! > 0);
  assert.equal(kh.rank, 1); assert.equal(kh.confidence, 'medium'); assert.equal(sa.confidence, 'low');
  assert.ok(kh.ci != null && kh.ci >= 0);
  const notes = fairnessNotes(res); assert.ok(notes.length >= 2); assert.ok(notes.some(n => n.includes('الأعلى بعد التصحيح: خالد')));
  const csv = trainersCsv(res.rows); assert.equal(csv.length, 4);
  // فلترة حسب البرنامج
  const only = trainerFairness(evals, facts, lk, { programId: 'p2' }); assert.equal(only.rows.length, 1);
});

test('exec summary: facts → prompt → parse; local fallback; html; generate with/without AI', async () => {
  const f = factsFrom({ scope: 'كل البرامج', period: 'آخر 30 يومًا', generatedAt: '2026-10-23', k: { responses: 30, participants: 28, mean: 3.9, highPct: 60, lowPct: 18, programs: 2, trainers: 3, rooms: 3, median: 4, sd: 1, gap: 0.3, perf: 'GOOD', risk: 'MED', daily: 30, final: 0, measurements: 60, firstDate: '', lastDate: '', days: 30, perDay: 1, dist: [1, 2, 3, 4, 5] } as any, cmp: { deltaMean: -0.2 } as any, axes: [{ label: 'المدرب', mean: 4.5, n: 30 }, { label: 'المحتوى', mean: 3.2, n: 30 }] as any, programs: [{ label: 'أ', mean: 4.4, responses: 20, n: 40 }, { label: 'ب', mean: 3.1, responses: 10, n: 20 }] as any, trainers: [] as any, actions: [{ label: 'المحتوى', recommendation: 'راجع المادة', priority: 'HIGH' }] as any, extras: { chain_index: 64, open_notifications: 3 } });
  assert.equal(f.kpis?.mean, 3.9); assert.equal(f.axesLow[0].label, 'المحتوى'); assert.equal(f.programs.length, 2);
  const p = buildSummaryPrompt(f); assert.ok(p.system.includes('4.2')); assert.ok(p.user.includes('"mean":3.9'));
  assert.deepEqual(parseSummary('نص قبل {"headline":"عنوان","bullets":["أ","ب"],"risks":[],"actions":["افعل"]} نص بعد'), { headline: 'عنوان', bullets: ['أ', 'ب'], risks: [], actions: ['افعل'] });
  assert.equal(parseSummary('لا يوجد json'), null); assert.equal(parseSummary('{"bullets":[]}'), null);
  const loc = localSummary(f);
  assert.equal(loc.source, 'local'); assert.ok(loc.headline.includes('30 استبانة')); assert.ok(loc.headline.includes('بتراجع')); assert.ok(loc.risks.some(r => r.includes('18%'))); assert.ok(loc.risks.some(r => r.includes('3 تنبيه'))); assert.ok(loc.bullets.some(b => b.includes('64/100')));
  const html = summaryHtml(loc); assert.ok(html.includes('تحليل آلي') && html.includes(loc.headline));
  const empty = localSummary({ ...f, kpis: null }); assert.ok(empty.headline.includes('لا توجد تقييمات'));
  // AI path
  const ok = await generateExecSummary(f, { callAi: async () => ({ text: '{"headline":"من النموذج","bullets":["1"],"risks":[],"actions":["2"]}', model: 'test-model' }) });
  assert.equal(ok.source, 'ai'); assert.equal(ok.model, 'test-model'); assert.equal(ok.headline, 'من النموذج');
  const badJson = await generateExecSummary(f, { callAi: async () => ({ text: 'garbage', model: 'm' }) }); assert.equal(badJson.source, 'local');
  const thrown = await generateExecSummary(f, { callAi: async () => { throw new Error('429'); } }); assert.equal(thrown.source, 'local');
  const none = await generateExecSummary(f, {}); assert.equal(none.source, 'local');
});
