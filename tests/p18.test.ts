// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P18 — «مرصد القدرة البشرية»: براهين الخصوصية (لا خلية دون 5 أشخاص/جهتين، لا معرّفات، شرائح فقط، تقريب 5)،
//                 الطقس وعتباته، المؤشر، الإشارات المبكرة و«لماذا»، الحقيقة والادعاء، موقع الجهة، الكتم اليدوي، وثيقة العدد الموقَّعة، CSV، تغيّر الطقس.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSnapshot, capabilityIndex, weatherOf, band, orgBand, round5, confidenceOf, orgPosition, applySuppression, buildIssueDoc, issueCode, quarterOf, snapshotCsv, weatherChanges, K_PERSONS, K_ORGS, type ObsInput, type Person, type PersonLevel, type Claim } from '../lib/portal/observatory';
import { signerFromEnv, signDocument, verifySignature, localResolver } from '../lib/portal/vc-server';
import { structuralChecks } from '../lib/portal/vc';

const NOW = new Date('2026-10-28T12:00:00Z'); const day = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
const SECTORS = [{ code: 'gov', name_ar: 'القطاع الحكومي', name_en: 'Government' }, { code: 'health', name_ar: 'القطاع الصحي', name_en: 'Healthcare' }, { code: 'tech', name_ar: 'التقنية', name_en: 'Technology' }];
const SKILLS = [{ id: 's1', code: 'ATH-AR-001', name_ar: 'الكتابة المهنية', name_en: 'Professional writing', domain: 'arabic' }, { id: 's2', code: 'ATH-PD-001', name_ar: 'تصميم التدريب', name_en: 'Training design', domain: 'pedagogy' }, { id: 's3', code: 'ATH-DA-002', name_ar: 'تحليل البيانات', name_en: 'Data analysis', domain: 'data_ai' }];

/** يبني قطاعًا: n أشخاص على orgs جهات، لكل شخص مهارات بمستوى base، أدلة حالية بمستوى cur وسابقة بمستوى pri */
function sector(code: string, n: number, orgs: number, opts: { base?: number; cur?: number | null; pri?: number | null; claim?: number | null; skills?: string[]; conf?: number } = {}): { persons: Person[]; levels: PersonLevel[]; claims: Claim[] } {
  const persons: Person[] = []; const levels: PersonLevel[] = []; const claims: Claim[] = []; const sk = opts.skills || ['s1', 's2'];
  for (let i = 0; i < n; i++) {
    const uid = `${code}-u${i}`; persons.push({ user_id: uid, org_id: `${code}-org${i % orgs}`, sector: code });
    for (const sid of sk) {
      const ev = []; if (opts.cur !== null) ev.push({ kind: i % 2 ? 'mission' : 'simulation', level: opts.cur ?? 3, at: day(10 + i) }); if (opts.pri !== null) ev.push({ kind: 'placement', level: opts.pri ?? 3, at: day(100 + i) });
      levels.push({ user_id: uid, skill_id: sid, level: opts.base ?? 3, confidence: opts.conf ?? 50, approved: i === 0, evidence: ev });
      if (opts.claim != null) claims.push({ user_id: uid, skill_id: sid, level: opts.claim, at: day(5) });
    }
  }
  return { persons, levels, claims };
}
const merge = (...parts: { persons: Person[]; levels: PersonLevel[]; claims: Claim[] }[]): ObsInput => ({ persons: parts.flatMap(p => p.persons), levels: parts.flatMap(p => p.levels), claims: parts.flatMap(p => p.claims), skills: SKILLS, sectors: SECTORS, now: NOW });

test('P18 الخصوصية: قطاع بأقل من 5 أشخاص يُكتم ويُسجَّل سببه', () => {
  const s = computeSnapshot(merge(sector('gov', 4, 2)));
  const g = s.sectors.find(x => x.code === 'gov')!; assert.equal(g.cell, null, 'الخلية مكتومة'); assert.equal(g.weather, 'unknown', 'لا طقس لخلية مكتومة'); assert.equal(g.rising.length + g.cooling.length, 0, 'لا إشارات');
  assert.ok(s.suppressed_log.some(l => l.scope.includes('الحكومي') && l.reason_ar.includes('5')), 'سجل الكتم يذكر السبب'); assert.equal(s.totals.sectors_suppressed, 1, 'عدّ المكتوم');
});
test('P18 الخصوصية: 5 أشخاص على جهة واحدة يُكتم (حدّ الجهتين)، وعلى جهتين يُنشر', () => {
  const one = computeSnapshot(merge(sector('gov', 6, 1))); assert.equal(one.sectors[0].cell, null, 'جهة واحدة → كتم'); assert.ok(one.suppressed_log[0].reason_ar.includes(String(K_ORGS)), 'السبب: الجهات');
  const two = computeSnapshot(merge(sector('gov', 5, 2))); assert.ok(two.sectors[0].cell, 'جهتان و5 أشخاص → نشر'); assert.equal(two.sectors[0].cell!.people, '5–9', 'شريحة لا رقم'); assert.equal(two.sectors[0].cell!.orgs, '2–4', 'شريحة الجهات');
});
test('P18 الخصوصية: المجال داخل القطاع يُكتم مستقلًا إن قلّ أشخاصه عن 5', () => {
  // s3 لدى 3 أشخاص فقط
  const base = sector('gov', 8, 2); for (let i = 0; i < 3; i++) base.levels.push({ user_id: `gov-u${i}`, skill_id: 's3', level: 4, confidence: 60, approved: false, evidence: [] });
  const g = computeSnapshot(merge(base)).sectors[0]; assert.ok(g.domains.some(d => d.domain === 'arabic'), 'مجال العربية منشور'); assert.ok(!g.domains.some(d => d.domain === 'data_ai'), 'مجال البيانات مكتوم'); assert.ok(g.suppressed.some(x => x.includes('data_ai')), 'مذكور في كتم القطاع');
});
test('P18 الخصوصية: لا معرّف شخص أو جهة أو بريد يظهر في اللقطة المنشورة', () => {
  const inp = merge(sector('gov', 12, 3, { claim: 4 }), sector('health', 7, 2, { cur: 2, pri: 4 })); const s = computeSnapshot(inp); const txt = JSON.stringify(s).replace(/"skill_id":"s\d"/g, '');
  for (const p of inp.persons) { assert.ok(!txt.includes(`"${p.user_id}"`), `لا user_id ${p.user_id}`); assert.ok(!txt.includes(p.org_id!), `لا org_id ${p.org_id}`); }
  assert.ok(!/@/.test(txt), 'لا بريد'); assert.ok(!/"count":\d/.test(txt), 'لا أعداد خام');
});
test('P18 التقريب والشرائح: المؤشر مضاعف 5، الشرائح صحيحة، الثقة ثلاث درجات', () => {
  for (let l = 1; l <= 5; l += 0.37) for (const c of [0, 20, 50, 90]) assert.equal(capabilityIndex(l, c) % 5, 0, `مؤشر مقرَّب ${l}/${c}`);
  assert.equal(capabilityIndex(1, 0), 0, 'الأدنى 0'); assert.equal(capabilityIndex(5, 100), 100, 'الأعلى 100'); assert.equal(capabilityIndex(3, 50), round5(42.5 + 7.5), 'منتصف السلم');
  assert.equal(band(5), '5–9', 'شريحة 5'); assert.equal(band(10), '10–49', 'شريحة 10'); assert.equal(band(50), '50–199', 'شريحة 50'); assert.equal(band(200), '200+', 'شريحة 200'); assert.equal(orgBand(2), '2–4', 'جهات 2'); assert.equal(orgBand(20), '20+', 'جهات 20');
  assert.equal(confidenceOf(80), 'strong', 'قوية'); assert.equal(confidenceOf(40), 'moderate', 'متوسطة'); assert.equal(confidenceOf(10), 'early', 'أولية');
});
test('P18 الطقس: العتبات (+0.15 صاعد، −0.15 يبرد، النشاط ±25%، لا دليل كافٍ)', () => {
  assert.equal(weatherOf(0.2, 10, 10), 'rising', 'Δ موجب'); assert.equal(weatherOf(-0.2, 10, 10), 'cooling', 'Δ سالب'); assert.equal(weatherOf(0.05, 10, 10), 'stable', 'مستقر');
  assert.equal(weatherOf(0, 13, 10), 'rising', 'نشاط +30%'); assert.equal(weatherOf(0, 7, 10), 'cooling', 'نشاط −30%'); assert.equal(weatherOf(0, 3, 2), 'unknown', 'لا دليل كافٍ');
  assert.equal(weatherOf(0, 12, 0), 'rising', 'نشاط جديد كبير بلا سابق'); assert.equal(weatherOf(0, 2, 10), 'cooling', 'توقف الأدلة');
  const up = computeSnapshot(merge(sector('gov', 8, 2, { cur: 4, pri: 3 }))).sectors[0]; assert.equal(up.weather, 'rising', 'قطاع صاعد'); assert.ok(up.delta >= 0.9, 'Δ ≈ +1');
  const down = computeSnapshot(merge(sector('health', 8, 2, { cur: 2, pri: 3.5 }))).sectors[0]; assert.equal(down.weather, 'cooling', 'قطاع يبرد');
  const flat = computeSnapshot(merge(sector('tech', 8, 2, { cur: 3, pri: 3 }))).sectors[0]; assert.equal(flat.weather, 'stable', 'قطاع مستقر');
});
test('P18 الإشارات المبكرة: 3 صاعدة/3 باردة كحد أقصى، كل منها بشريحة أشخاص و«لماذا» من مزيج الأدلة', () => {
  const part = sector('gov', 10, 2, { skills: ['s1'], cur: 4.5, pri: 3 }); const cool = sector('gov', 10, 2, { skills: ['s2'], cur: 2, pri: 4 }); cool.persons = []; // الأشخاص أنفسهم
  const s = computeSnapshot(merge(part, { persons: [], levels: cool.levels, claims: [] })).sectors[0];
  assert.equal(s.rising.length, 1, 'إشارة صاعدة واحدة'); assert.equal(s.rising[0].code, 'ATH-AR-001', 'المهارة الصاعدة'); assert.ok(s.rising[0].why_ar.includes('%'), 'لماذا بنسبة'); assert.ok(/مهام|محاكاة/.test(s.rising[0].why_ar), 'لماذا من نوع الدليل'); assert.equal(s.rising[0].people, '10–49', 'شريحة');
  assert.equal(s.cooling.length, 1, 'إشارة باردة واحدة'); assert.equal(s.cooling[0].code, 'ATH-PD-001', 'المهارة الباردة'); assert.ok(s.cooling[0].delta < 0, 'Δ سالب');
  const many = sector('gov', 10, 2, { skills: ['s1', 's2', 's3'], cur: 4, pri: 3 }); const sk4 = [...SKILLS, { id: 's4', code: 'X4', name_ar: 'أ', name_en: null, domain: 'other' }, { id: 's5', code: 'X5', name_ar: 'ب', name_en: null, domain: 'other' }];
  for (const sid of ['s4', 's5']) for (let i = 0; i < 10; i++) many.levels.push({ user_id: `gov-u${i}`, skill_id: sid, level: 3, confidence: 50, approved: false, evidence: [{ kind: 'media', level: 5, at: day(5) }, { kind: 'placement', level: 2, at: day(120) }] });
  const s5 = computeSnapshot({ ...merge(many), skills: sk4 }).sectors[0]; assert.equal(s5.rising.length, 3, 'حد أقصى 3'); assert.ok(s5.rising[0].delta >= s5.rising[2].delta, 'مرتبة تنازليًا');
});
test('P18 الحقيقة والادعاء: تُحسب فقط مع ≥5 مقيِّمين ذاتيًا، والحكم over/under/aligned', () => {
  const over = computeSnapshot(merge(sector('gov', 8, 2, { base: 3, claim: 4 }))).sectors[0]; assert.ok(over.gap, 'فجوة موجودة'); assert.equal(over.gap!.verdict, 'over', 'ادعاء أعلى'); assert.equal(over.gap!.claimed, 4, 'الادعاء'); assert.equal(over.gap!.actual, 3, 'الدليل'); assert.equal(over.gap!.gap, 1, 'الفجوة');
  const under = computeSnapshot(merge(sector('gov', 8, 2, { base: 4, claim: 3 }))).sectors[0]; assert.equal(under.gap!.verdict, 'under', 'تواضع');
  const al = computeSnapshot(merge(sector('gov', 8, 2, { base: 3.2, claim: 3 }))).sectors[0]; assert.equal(al.gap!.verdict, 'aligned', 'متقارب');
  const few = sector('gov', 8, 2); few.claims = [0, 1, 2, 3].map(i => ({ user_id: `gov-u${i}`, skill_id: 's1', level: 5, at: day(1) })); const f = computeSnapshot(merge(few)).sectors[0]; assert.equal(f.gap, null, '4 مقيِّمين → لا فجوة'); assert.ok(f.suppressed.some(x => x.includes('الادعاء')), 'مذكور في الكتم');
});
test('P18 موقع الجهة: يلزم 5 منسوبين، المئين مع 3 جهات مؤهلة، ولا أسماء جهات أخرى', () => {
  const inp = merge(sector('gov', 18, 3, { base: 3 })); for (const l of inp.levels) if (l.user_id.endsWith('u0') || l.user_id.endsWith('u3') || l.user_id.endsWith('u6') || l.user_id.endsWith('u9') || l.user_id.endsWith('u12') || l.user_id.endsWith('u15')) l.level = 4.5; // جهة org0 أعلى
  const snap = computeSnapshot(inp); const p0 = orgPosition('gov-org0', inp, snap); const p1 = orgPosition('gov-org1', inp, snap);
  assert.equal(p0.members_band, '5–9', 'شريحة المنسوبين'); assert.equal(p0.orgs_in_sector, 3, '3 جهات مؤهلة'); assert.equal(p0.percentile, 100, 'الأعلى'); assert.ok(p0.org_index! > p1.org_index!, 'ترتيب صحيح'); assert.ok(!JSON.stringify(p0).includes('gov-org1'), 'لا اسم جهة أخرى');
  const small = orgPosition('x', merge(sector('gov', 6, 2)), snap); assert.equal(small.org_index, null, 'جهة بلا منسوبين'); assert.equal(small.members_band, '<5', 'أقل من 5');
  const two = merge(sector('gov', 10, 2)); const p = orgPosition('gov-org0', two, computeSnapshot(two)); assert.equal(p.percentile, null, 'جهتان → لا مئين'); assert.ok(p.org_index !== null, 'لكن المؤشر يظهر');
});
test('P18 الكتم اليدوي: يُفرغ خلية القطاع ويُسجَّل، ولا يمسّ الأصل', () => {
  const s = computeSnapshot(merge(sector('gov', 8, 2), sector('health', 8, 2))); const c = applySuppression(s, ['gov']);
  assert.equal(c.sectors.find(x => x.code === 'gov')!.cell, null, 'مكتوم'); assert.ok(c.sectors.find(x => x.code === 'gov')!.suppressed.some(x => x.includes('يدوي')), 'السبب يدوي'); assert.ok(c.sectors.find(x => x.code === 'health')!.cell, 'الآخر منشور');
  assert.equal(c.totals.sectors_published, 1, 'الإجماليات تُعاد'); assert.ok(s.sectors.find(x => x.code === 'gov')!.cell, 'الأصل سليم'); assert.ok(c.suppressed_log.length > s.suppressed_log.length, 'سجل الكتم زاد');
});
test('P18 العدد الربعي: الرمز والربع، الوثيقة تُوقَّع وتُتحقق وتكشف التلاعب، ولا تحمل معرّفات', async () => {
  assert.equal(quarterOf(new Date('2026-10-28T00:00:00Z')), '2026-Q4', 'الربع الرابع'); assert.equal(quarterOf(new Date('2027-02-01T00:00:00Z')), '2027-Q1', 'الربع الأول'); assert.equal(issueCode('2026-Q4'), 'ATH-OBS-2026-Q4', 'رمز العدد');
  const snap = computeSnapshot(merge(sector('gov', 8, 2, { claim: 4 }))); const signer = signerFromEnv({ VC_SIGNING_KEY: Buffer.alloc(32, 7).toString('base64') } as any, 'https://athar-portal.vercel.app')!;
  const doc = buildIssueDoc({ quarter: '2026-Q4', snapshot: snap, editorial_ar: 'افتتاحية', digest: 'abc', site: 'https://athar-portal.vercel.app', did: signer.did, now: NOW, statusIndex: 7, prev_code: 'ATH-OBS-2026-Q3' });
  assert.ok(doc.type.includes('AtharObservatoryIssue'), 'النوع'); assert.ok(doc.credentialSubject.type.includes('Dataset'), 'بيان بيانات'); assert.equal(doc.credentialSubject.license, 'https://creativecommons.org/licenses/by/4.0/', 'الرخصة'); assert.equal(doc.credentialSubject.previousIssue, 'ATH-OBS-2026-Q3', 'يشير للسابق'); assert.equal(doc._athar.verify_url, 'https://athar-portal.vercel.app/verify/vc?code=ATH-OBS-2026-Q4', 'رابط التحقق');
  assert.ok(!JSON.stringify(doc).includes('gov-u'), 'لا معرّفات');
  const signed = await signDocument(doc, signer, NOW); assert.ok(structuralChecks(signed, NOW).every(c => c.ok === true), 'بنية سليمة بعد التوقيع'); const ok = await verifySignature(signed, localResolver(signer, [])); assert.equal(ok.ok, true, 'التوقيع صحيح');
  const tampered = JSON.parse(JSON.stringify(signed)); tampered.credentialSubject.sectors[0].index = 95; const bad = await verifySignature(tampered, localResolver(signer, [])); assert.equal(bad.ok, false, 'التلاعب يُكشف');
});
test('P18 CSV: ترويسة ثابتة، صفوف القطاعات والمجالات، مكتوم يظهر suppressed بلا أرقام، BOM', () => {
  const csv = snapshotCsv(computeSnapshot(merge(sector('gov', 8, 2), sector('health', 3, 1)))); const lines = csv.split('\n');
  assert.ok(csv.startsWith('\uFEFF'), 'BOM'); assert.ok(lines[0].startsWith('\uFEFFscope,code,name_ar'), 'الترويسة'); assert.ok(lines.some(l => l.startsWith('sector,gov,') && l.includes('CC BY 4.0')), 'صف القطاع بالرخصة');
  const h = lines.find(l => l.startsWith('sector,health,'))!; assert.ok(h.includes('suppressed'), 'مكتوم'); assert.ok(h.split(',')[6] === '', 'لا مؤشر للمكتوم'); assert.ok(lines.some(l => l.startsWith('sector_domain,gov/')), 'صف مجال داخل قطاع'); assert.ok(lines.some(l => l.startsWith('domain,')), 'صف مجال عام');
});
test('P18 تغيّر الطقس بين لقطتين: يُبلَّغ عن التحوّلات الحقيقية فقط (لا من/إلى «لا دليل كافٍ»)', () => {
  const a = computeSnapshot(merge(sector('gov', 8, 2, { cur: 3, pri: 3 }), sector('health', 8, 2, { cur: 3, pri: 3 }), sector('tech', 3, 1)));
  const b = computeSnapshot(merge(sector('gov', 8, 2, { cur: 4, pri: 3 }), sector('health', 8, 2, { cur: 3, pri: 3 }), sector('tech', 8, 2, { cur: 4, pri: 3 })));
  const ch = weatherChanges(a, b); assert.equal(ch.length, 1, 'تغيّر واحد'); assert.equal(ch[0].code, 'gov', 'الحكومي'); assert.equal(ch[0].from, 'stable', 'من مستقر'); assert.equal(ch[0].to, 'rising', 'إلى صاعد'); assert.equal(weatherChanges(null, b).length, 0, 'لا سابق → لا تغيّر');
});
test('P18 الإجماليات: شرائح فقط، والأدلة مقرَّبة، والمنهجية تذكر k والتقريب', () => {
  const s = computeSnapshot(merge(sector('gov', 12, 3), sector('health', 2, 1))); assert.equal(s.totals.people, '10–49', 'أشخاص شريحة'); assert.ok(/^\d+\+$|^<10$|k\+$/.test(s.totals.evidence), 'أدلة مقرَّبة'); assert.ok(s.method_ar.some(m => m.includes(String(K_PERSONS)) && m.includes(String(K_ORGS))), 'المنهجية تذكر k'); assert.ok(s.method_ar.some(m => m.includes('أقرب 5')), 'المنهجية تذكر التقريب');
  assert.ok(s.sectors.every(x => !x.cell || x.cell.index % 5 === 0), 'كل المؤشرات مقرَّبة'); assert.equal(s.totals.sectors_published, 1, 'منشور 1'); assert.equal(s.totals.sectors_suppressed, 1, 'مكتوم 1');
});
