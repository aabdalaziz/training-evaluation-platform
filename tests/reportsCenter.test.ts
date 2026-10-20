/**
 * Tests for the Reports Center: analytics engine + Excel writer + catalog.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import {
  TARGET, THRESHOLDS, addDays, applyFilters, axisCategory, briefText, buildComments, buildEvaluations, buildFacts,
  daysBetween, groupBy, groupRowsToTable, keywordFrequency, kpis, narrative, periodComparison, perfKey, riskKey,
  riskRegister, riyadhDate, sentimentOf, stats, timeSeries, weekKey,
  type Lookups, type RawAnswer, type RawEvaluation, type RawQuestion,
} from '../lib/reports/analytics';
import { buildXlsx, colLetter, crc32, safeSheetName, xmlEscape } from '../lib/export/xlsx';
import { REPORTS, reportById, PERIOD_PRESETS } from '../lib/reports/catalog';

/* ------------------------------------------------------------ fixtures */
const lk: Lookups = {
  programs: [{ id: 'p1', name_ar: 'برنامج أ', name_en: 'Program A' }, { id: 'p2', name_ar: 'برنامج ب', name_en: 'Program B', delivery_mode: 'remote' }],
  trainers: [{ id: 't1', name: 'Dr. Ali' }, { id: 't2', name: 'Dr. Sara' }],
  classrooms: [
    { id: 'c1', code: 'R-101', program_id: 'p1', trainer_id: 't1' },
    { id: 'c2', code: 'R-102', program_id: 'p1', trainer_id: 't2' },
    { id: 'c3', code: 'G-1', program_id: 'p2', trainer_id: 't2', delivery_mode: 'remote' },
  ],
  questions: [
    { id: 'q1', section_ar: 'المدرب', section_en: 'Trainer', text_ar: 'شرح المدرب واضح', text_en: 'Clear explanation' },
    { id: 'q2', section_ar: 'المدرب', section_en: 'Trainer', text_ar: 'يتفاعل مع المتدربين', text_en: 'Engages trainees' },
    { id: 'q3', section_ar: 'القاعة والتجهيزات', section_en: 'Facilities', text_ar: 'القاعة مناسبة', text_en: 'Room suitable' },
    { id: 'q4', section_ar: 'الرضا العام', section_en: 'Satisfaction', text_ar: 'راضٍ عمومًا', text_en: 'Overall satisfied' },
    { id: 'q5', section_ar: 'عام', section_en: 'General', text_ar: 'ملاحظات', text_en: 'Comments', kind: 'LONG_TEXT' },
    { id: 'qd', question_key: 'daily_difficulty', section_ar: 'الدرس', section_en: 'Lesson', text_ar: 'صعوبة الدرس', text_en: 'Difficulty' },
  ],
};
let seq = 0;
function ev(over: Partial<RawEvaluation>): RawEvaluation {
  seq++;
  return { id: `e${seq}`, program_id: 'p1', classroom_id: 'c1', kind: 'DAILY', submitted_at: '2026-10-10T08:00:00Z', guest_email: `u${seq}@x.com`, guest_gender: 'male', ...over };
}
function ans(evaluation_id: string, vals: Record<string, number | null>, text?: string): RawAnswer[] {
  const rows: RawAnswer[] = Object.entries(vals).map(([question_id, rating_value]) => ({ evaluation_id, question_id, rating_value }));
  if (text) rows.push({ evaluation_id, question_id: 'q5', rating_value: null, text_value: text });
  return rows;
}
// Build a dataset: room c1 (t1) strong; room c2 (t2) weak on facilities; remote group c3.
const rawE: RawEvaluation[] = [];
const rawA: RawAnswer[] = [];
for (let i = 0; i < 8; i++) { const e = ev({ classroom_id: 'c1', submitted_at: `2026-10-${String(10 + (i % 4)).padStart(2, '0')}T08:00:00Z` }); rawE.push(e); rawA.push(...ans(e.id, { q1: 5, q2: 5, q3: 4, q4: 5, qd: 2 }, i === 0 ? 'المدرب ممتاز وشرحه واضح' : undefined)); }
for (let i = 0; i < 6; i++) { const e = ev({ classroom_id: 'c2', submitted_at: `2026-10-${String(10 + (i % 3)).padStart(2, '0')}T08:00:00Z` }); rawE.push(e); rawA.push(...ans(e.id, { q1: 4, q2: 3, q3: i < 4 ? 1 : 2, q4: 3 }, i === 0 ? 'التكييف سيء والقاعة ضيقة' : undefined)); }
for (let i = 0; i < 3; i++) { const e = ev({ program_id: 'p2', classroom_id: 'c3', submitted_at: `2026-10-13T08:00:00Z`, guest_gender: 'female' }); rawE.push(e); rawA.push(...ans(e.id, { q1: 4, q2: 4, q4: 4 })); }
// previous period data (for comparison)
for (let i = 0; i < 5; i++) { const e = ev({ classroom_id: 'c1', submitted_at: `2026-10-0${3 + (i % 3)}T08:00:00Z` }); rawE.push(e); rawA.push(...ans(e.id, { q1: 3, q2: 3, q3: 3, q4: 3 })); }
// one FINAL
{ const e = ev({ classroom_id: null, kind: 'FINAL', submitted_at: '2026-10-13T20:30:00Z', accommodation_type: 'hotel' }); rawE.push(e); rawA.push(...ans(e.id, { q1: 5, q4: 4 })); }
// duplicate question text in the same evaluation (should be collapsed)
{ const e = ev({ classroom_id: 'c1', submitted_at: '2026-10-13T08:00:00Z' }); rawE.push(e); rawA.push({ evaluation_id: e.id, question_id: 'q1', rating_value: 5 }, { evaluation_id: e.id, question_id: 'q1', rating_value: 3 }); }

const evals = buildEvaluations(rawE, rawA, lk);
const facts = buildFacts(rawA, lk.questions);

/* ------------------------------------------------------------ helpers */
describe('helpers', () => {
  test('riyadhDate uses UTC+3 day boundary', () => {
    assert.equal(riyadhDate('2026-10-13T20:30:00Z'), '2026-10-13');
    assert.equal(riyadhDate('2026-10-13T21:30:00Z'), '2026-10-14');
    assert.equal(riyadhDate(null), '');
  });
  test('date arithmetic', () => {
    assert.equal(addDays('2026-10-01', -1), '2026-09-30');
    assert.equal(daysBetween('2026-10-01', '2026-10-07'), 6);
    assert.equal(weekKey('2026-10-20'), '2026-10-18', 'weeks start on Sunday');
  });
  test('axisCategory maps Arabic/English section names', () => {
    assert.equal(axisCategory('المدرب'), 'trainer');
    assert.equal(axisCategory('', 'Facilities'), 'facility');
    assert.equal(axisCategory('السكن'), 'housing');
    assert.equal(axisCategory('xyz'), 'general');
  });
  test('stats / bands / risk', () => {
    const s = stats([5, 5, 4, 1, 2]);
    assert.equal(s.n, 5); assert.equal(s.mean, 3.4); assert.equal(s.median, 4); assert.equal(s.lowPct, 40); assert.equal(s.highPct, 60);
    assert.deepEqual(s.dist, [1, 1, 0, 1, 2]);
    assert.equal(perfKey(4.3, 10), 'EXCELLENT'); assert.equal(perfKey(3.8, 10), 'GOOD'); assert.equal(perfKey(3.2, 10), 'WATCH'); assert.equal(perfKey(2.5, 10), 'RISK'); assert.equal(perfKey(0, 0), 'NA');
    assert.equal(riskKey({ n: 3, mean: 2, sd: 0, lowPct: 50 }, 3), 'NA', 'below min sample');
    assert.equal(riskKey({ n: 10, mean: 2.9, sd: 0.5, lowPct: 5 }, 10), 'HIGH');
    assert.equal(riskKey({ n: 10, mean: 3.6, sd: 0.5, lowPct: 5 }, 10), 'MED');
    assert.equal(riskKey({ n: 10, mean: 4.5, sd: 0.3, lowPct: 0 }, 10), 'LOW');
  });
});

/* ------------------------------------------------------------ normalisation */
describe('normalisation', () => {
  test('evaluations get trainer from classroom and Riyadh date', () => {
    const e = evals.find(x => x.classroom_id === 'c2')!;
    assert.equal(e.trainer_id, 't2');
    assert.match(e.date, /^2026-10-1\d$/);
    const fin = evals.find(x => x.kind === 'FINAL')!;
    assert.equal(fin.trainer_id, null);
  });
  test('facts exclude difficulty question and collapse duplicate texts', () => {
    assert.ok(!facts.some(f => f.question_key === 'daily_difficulty'));
    const dupEval = rawE[rawE.length - 1].id;
    const f = facts.filter(x => x.evaluation_id === dupEval);
    assert.equal(f.length, 1); assert.equal(f[0].value, 4);
  });
});

/* ------------------------------------------------------------ filters & KPIs */
describe('filters & KPIs', () => {
  test('applyFilters by program/trainer/classroom/kind/date/gender/delivery', () => {
    assert.equal(applyFilters(evals, { programId: 'p2' }, lk).length, 3);
    assert.equal(applyFilters(evals, { trainerId: 't2' }, lk).length, 9);
    assert.equal(applyFilters(evals, { classroomId: 'c2' }, lk).length, 6);
    assert.equal(applyFilters(evals, { kind: 'FINAL' }, lk).length, 1);
    assert.equal(applyFilters(evals, { gender: 'female' }, lk).length, 3);
    assert.equal(applyFilters(evals, { deliveryMode: 'remote' }, lk).length, 3);
    assert.equal(applyFilters(evals, { from: '2026-10-10', to: '2026-10-13' }, lk).length, evals.length - 5);
  });
  test('kpis aggregate correctly', () => {
    const k = kpis(applyFilters(evals, { classroomId: 'c1', from: '2026-10-10' }, lk), facts);
    assert.equal(k.responses, 9);
    assert.equal(k.daily, 9); assert.equal(k.final, 0);
    assert.ok(k.mean > 4.5);
    assert.equal(k.perf, 'EXCELLENT'); assert.equal(k.risk, 'LOW');
    assert.equal(k.rooms, 1); assert.equal(k.trainers, 1);
    assert.equal(k.firstDate, '2026-10-10'); assert.equal(k.lastDate, '2026-10-13'); assert.equal(k.days, 4);
    assert.ok(k.gap < 0, 'above target → negative gap');
  });
});

/* ------------------------------------------------------------ breakdowns */
describe('breakdowns', () => {
  const cur = applyFilters(evals, { from: '2026-10-10' }, lk);
  test('groupBy trainer ranks and flags', () => {
    const rows = groupBy('trainer', cur, facts, lk, 'en');
    assert.equal(rows[0].label, 'Dr. Ali');
    assert.equal(rows[0].perf, 'EXCELLENT');
    const sara = rows.find(r => r.label === 'Dr. Sara')!;
    assert.equal(sara.responses, 9);
    assert.ok(sara.mean < rows[0].mean);
  });
  test('groupBy axis finds the weak facilities axis', () => {
    const rows = groupBy('axis', cur, facts, lk, 'ar');
    const fac = rows.find(r => r.label === 'القاعة والتجهيزات')!;
    assert.ok(fac.mean < 3.5);
    assert.ok(fac.lowPct >= 40);
    assert.equal(fac.meta?.category, 'facility');
  });
  test('groupBy classroom keeps trainer meta; question/kind/gender/day/week work', () => {
    const rooms = groupBy('classroom', cur, facts, lk, 'en');
    assert.equal(rooms.find(r => r.key === 'c2')!.meta?.trainer_id, 't2');
    assert.ok(groupBy('question', cur, facts, lk, 'en').length >= 4);
    assert.deepEqual(groupBy('kind', cur, facts, lk, 'en').map(r => r.key).sort(), ['DAILY', 'FINAL']);
    assert.deepEqual(groupBy('gender', cur, facts, lk, 'en').map(r => r.label).sort(), ['Female', 'Male']);
    const days = groupBy('day', cur, facts, lk, 'en');
    assert.deepEqual(days.map(d => d.key), ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']);
    assert.equal(groupBy('week', cur, facts, lk, 'en')[0].key, '2026-10-04');
  });
  test('timeSeries adds moving average', () => {
    const s = timeSeries(cur, facts, 'day', lk, 'en');
    assert.equal(s.length, 4);
    assert.ok(s.every(p => p.ma !== null));
  });
  test('groupRowsToTable produces header + rows with same width', () => {
    const t = groupRowsToTable(groupBy('trainer', cur, facts, lk, 'ar'), 'ar', 'المدرب');
    assert.equal(t[0][0], 'المدرب');
    assert.ok(t.every(r => r.length === t[0].length));
  });
});

/* ------------------------------------------------------------ comparison */
describe('period comparison', () => {
  test('compares against an equal-length previous window', () => {
    const cmp = periodComparison(evals, facts, { from: '2026-10-10', to: '2026-10-13' }, lk)!;
    assert.equal(cmp.prevFrom, '2026-10-06'); assert.equal(cmp.prevTo, '2026-10-09');
    assert.equal(cmp.previous.responses, 0, 'previous window has no data (prev data is on Oct 3–5)');
    const cmp2 = periodComparison(evals, facts, { from: '2026-10-08', to: '2026-10-13' }, lk)!;
    assert.equal(cmp2.prevFrom, '2026-10-02'); assert.equal(cmp2.previous.responses, 5);
    assert.ok((cmp2.deltaMean as number) > 0, 'current period better than previous');
  });
});

/* ------------------------------------------------------------ actions / narrative */
describe('risk register & narrative', () => {
  const cur = applyFilters(evals, { from: '2026-10-10' }, lk);
  test('riskRegister prioritises the facilities axis and the weak room', () => {
    const acts = riskRegister(cur, facts, lk, 'ar');
    assert.ok(acts.length >= 2);
    assert.equal(acts[0].priority, 'HIGH');
    assert.ok(acts.some(a => a.area === 'axis' && a.category === 'facility'));
    assert.ok(acts.some(a => a.area === 'classroom' && a.label.includes('R-102')));
    assert.ok(!acts.some(a => a.label.includes('R-101')), 'excellent room has no action');
    for (const a of acts) { assert.ok(a.recommendation.length > 10); assert.ok(a.owner); assert.ok(a.dueDays > 0); assert.ok(a.impact >= 0); }
    // low-sample groups are skipped
    const small = riskRegister(applyFilters(evals, { programId: 'p2' }, lk), facts, lk, 'en');
    assert.equal(small.length, 0);
  });
  test('narrative is bilingual and mentions the weak axis', () => {
    const k = kpis(cur, facts);
    const axes = groupBy('axis', cur, facts, lk, 'ar');
    const ar = narrative(k, axes, timeSeries(cur, facts, 'day', lk, 'ar'), null, 'ar', 'التقرير');
    const en = narrative(k, groupBy('axis', cur, facts, lk, 'en'), timeSeries(cur, facts, 'day', lk, 'en'), null, 'en', 'This report');
    assert.ok(ar.join(' ').includes('القاعة والتجهيزات'));
    assert.ok(en.join(' ').includes('Facilities'));
    assert.match(en[0], /responses from/);
    assert.deepEqual(narrative(kpis([], facts), [], [], null, 'en', 'x'), ['No data in the current filter scope.']);
  });
  test('briefText is compact plain text', () => {
    const k = kpis(cur, facts);
    const txt = briefText('Executive brief', k, groupBy('axis', cur, facts, lk, 'en'), riskRegister(cur, facts, lk, 'en'), 'en', 'All programs');
    assert.match(txt, /Responses: \d+/); assert.match(txt, /Priority actions/);
  });
});

/* ------------------------------------------------------------ qualitative */
describe('qualitative', () => {
  test('comments extracted with sentiment; keywords counted', () => {
    const c = buildComments(evals, rawA, lk.questions);
    assert.equal(c.length, 2);
    assert.equal(c.find(x => x.text.includes('ممتاز'))!.sentiment, 'positive');
    assert.equal(c.find(x => x.text.includes('سيء'))!.sentiment, 'negative');
    assert.equal(sentimentOf('ok'), 'neutral');
    const kw = keywordFrequency(c);
    assert.ok(kw.some(k => k.word === 'المدرب' || k.word === 'القاعة'));
  });
});

/* ------------------------------------------------------------ catalog */
describe('catalog', () => {
  test('all reports have bilingual metadata and sections; fallback works', () => {
    assert.ok(REPORTS.length >= 10);
    for (const r of REPORTS) { assert.ok(r.title.ar && r.title.en && r.decision.ar && r.decision.en); assert.ok(r.sections.length > 0); }
    assert.equal(new Set(REPORTS.map(r => r.id)).size, REPORTS.length);
    assert.equal(reportById('nope').id, 'executive');
    assert.ok(PERIOD_PRESETS.some(p => p.id === '30d' && p.days === 30));
  });
});

/* ------------------------------------------------------------ xlsx */
function parseZip(bytes: Uint8Array): Map<string, string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, string>();
  let p = 0;
  while (p + 4 <= bytes.length && dv.getUint32(p, true) === 0x04034b50) {
    const method = dv.getUint16(p + 8, true), size = dv.getUint32(p + 18, true), nameLen = dv.getUint16(p + 26, true), extraLen = dv.getUint16(p + 28, true);
    const name = Buffer.from(bytes.slice(p + 30, p + 30 + nameLen)).toString('utf8');
    const data = bytes.slice(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
    assert.equal(method, 0, 'stored');
    files.set(name, Buffer.from(data).toString('utf8'));
    p += 30 + nameLen + extraLen + size;
  }
  return files;
}
describe('xlsx writer', () => {
  test('crc32 known vector', () => { assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926); });
  test('helpers', () => {
    assert.equal(colLetter(0), 'A'); assert.equal(colLetter(25), 'Z'); assert.equal(colLetter(26), 'AA');
    assert.equal(xmlEscape('a<b>&"c"'), 'a&lt;b&gt;&amp;&quot;c&quot;');
    const used = new Set<string>();
    assert.equal(safeSheetName('التقرير/الملخص: 2026', used), 'التقرير الملخص  2026');
    assert.equal(safeSheetName('x'.repeat(40), used).length, 31);
    assert.equal(safeSheetName('Sheet', used), 'Sheet'); assert.equal(safeSheetName('Sheet', used), 'Sheet (2)');
  });
  test('builds a valid multi-sheet workbook with strings, numbers and Arabic', () => {
    const bytes = buildXlsx([
      { name: 'الملخص', rtl: true, rows: [['المؤشر', 'القيمة'], ['المتوسط', 4.25], ['ملاحظة', 'نص "مقتبس" & <وسم>']] },
      { name: 'Data', rows: [['a', 'b'], [1, null], [true, 'x']] },
    ]);
    assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); // PK
    const files = parseZip(bytes);
    assert.ok(files.has('[Content_Types].xml')); assert.ok(files.has('xl/workbook.xml')); assert.ok(files.has('xl/styles.xml'));
    assert.ok(files.has('xl/worksheets/sheet1.xml')); assert.ok(files.has('xl/worksheets/sheet2.xml'));
    const wb = files.get('xl/workbook.xml')!;
    assert.match(wb, /name="الملخص" sheetId="1"/); assert.match(wb, /name="Data" sheetId="2"/);
    const s1 = files.get('xl/worksheets/sheet1.xml')!;
    assert.match(s1, /rightToLeft="1"/);
    assert.match(s1, /<c r="B2"><v>4.25<\/v><\/c>/);
    assert.match(s1, /<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">المؤشر<\/t><\/is><\/c>/, 'bold header style');
    assert.match(s1, /نص &quot;مقتبس&quot; &amp; &lt;وسم&gt;/);
    const s2 = files.get('xl/worksheets/sheet2.xml')!;
    assert.match(s2, /<c r="A2"><v>1<\/v><\/c>/); assert.ok(!s2.includes('r="B2"'), 'null cell omitted'); assert.match(s2, /<c r="A3" t="b"><v>1<\/v><\/c>/);
    // zip central directory count
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocd = bytes.length - 22; assert.equal(dv.getUint32(eocd, true), 0x06054b50); assert.equal(dv.getUint16(eocd + 10, true), 9);
    void gunzipSync; // (zlib imported to make sure node env is fine)
  });
});
