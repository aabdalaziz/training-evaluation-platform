// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P68 «تقرير القيادة» — الفترة · الأرقام الثلاثة (k ≥ 5 و«لم يُقس بعد») · الأسئلة الحتمية · «ما قرّرتم آخر مرّة» · الختم ATH-LR · القرار يُختم داخل الوثيقة · إعادة الإصدار تُلغي السابق · verify_minimal · التقرير التفصيلي (ب) · الشعار (ج) · شكل المصدر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { lrCode, isLrCode, lrDigest, DECISIONS, decisionOf, cleanNote, quarterOf, periodLabelAr, validatePeriod, periodBounds, numbersOf, threeLines, questionsFor, previousRead, issueReport, decideReport, revokeReport, verifyReport, suggestPeriod, leadershipLineFor, leadershipLineAr, listReports, KIND_AR, todayRiyadh } from '../lib/org/report';
import { secondsPerItem, stateOf } from '../lib/miaar/detail';
import { KIND_AR as SHIELD_KIND_AR, DEFAULT_SEVERITY } from '../lib/shield/guard';
import { REGISTRY } from '../lib/vault/registry';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const has = (p: string) => existsSync(new URL(`../${p}`, import.meta.url));
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ORG = U(21); const ADMIN = { id: U(1), email: 'admin@upm.edu.sa', name: 'د. أحمد' };

/* قاعدة وهمية بسيطة: جداول في الذاكرة + rpc */
function fakeDb(seed: Record<string, any[]> = {}, rpcData: any = null) {
  const T: Record<string, any[]> = JSON.parse(JSON.stringify(seed));
  const from = (t: string) => {
    T[t] = T[t] || []; const rows = T[t]; const fs: ((r: any) => boolean)[] = []; let op = 'select'; let patch: any = null; let lim = 0; let single = false; let ordBy: [string, boolean] | null = null; let head = false;
    const q: any = {
      select(_c?: string, o?: any) { if (o?.head) head = true; return q; }, eq(c: string, v: any) { fs.push(r => String(r[c]) === String(v)); return q; }, neq(c: string, v: any) { fs.push(r => String(r[c]) !== String(v)); return q; },
      in(c: string, v: any[]) { fs.push(r => v.map(String).includes(String(r[c]))); return q; }, gt(c: string, v: any) { fs.push(r => String(r[c]) > String(v)); return q; }, gte(c: string, v: any) { fs.push(r => String(r[c]) >= String(v)); return q; },
      lt(c: string, v: any) { fs.push(r => String(r[c]) < String(v)); return q; }, lte(c: string, v: any) { fs.push(r => String(r[c]) <= String(v)); return q; },
      is(c: string, v: any) { fs.push(r => v === null ? r[c] == null : r[c] === v); return q; }, not(c: string, _o: string, v: any) { fs.push(r => !(v === null ? r[c] == null : r[c] === v)); return q; },
      ilike(c: string, v: string) { fs.push(r => String(r[c] || '').toLowerCase() === String(v).toLowerCase()); return q; },
      or(expr: string) { const parts = expr.split(','); fs.push(r => parts.some(p => { const [c, o, ...rest] = p.split('.'); const v = rest.join('.'); return o === 'eq' ? String(r[c]) === v : String(r[c] || '').toLowerCase() === v.toLowerCase(); })); return q; },
      order(c: string, o: any) { ordBy = [c, o?.ascending !== false]; return q; }, limit(n: number) { lim = n; return q; }, maybeSingle() { single = true; return q; }, single() { single = true; return q; },
      update(p: any) { op = 'update'; patch = p; return q; }, insert(p: any) { op = 'insert'; patch = p; return q; }, upsert(p: any) { op = 'insert'; patch = p; return q; },
      then(res: any) {
        let out = rows.filter(r => fs.every(f => f(r)));
        if (op === 'update') for (const r of out) Object.assign(r, patch);
        else if (op === 'insert') { const list = Array.isArray(patch) ? patch : [patch]; out = []; for (const p of list) { const r = { id: rows.length + 1, created_at: new Date().toISOString(), ...p }; rows.push(r); out.push(r); } }
        if (ordBy) { const [c, asc] = ordBy; out = [...out].sort((a, b) => (String(a[c]) < String(b[c]) ? -1 : 1) * (asc ? 1 : -1)); }
        if (lim) out = out.slice(0, lim);
        res({ data: head ? null : single ? (out[0] || null) : out, error: null, count: out.length });
      },
    };
    return q;
  };
  return { db: { from, rpc: async () => ({ data: rpcData, error: null }) }, T };
}
const impactFixture = (over: any = {}) => ({ ok: true, programs: [
  { id: 'p1', name_ar: 'قيادة الفرق', learners: 12, pending: 0, orgs: 1, credentials: 3, skills: [], end_date: '2026-02-20', attendance: { sessions: 6, present: 60 }, satisfaction: { n: 10, mean: 4.6 }, prepost: { pre_n: 10, pre: 2.1, post_n: 10, post: 3.4 }, transfer: { n: 8, mean: 2.5, supervisor: 2.4, trainee: 2.6 } },
  { id: 'p2', name_ar: 'كتابة التقارير', learners: 7, pending: 0, orgs: 1, credentials: 0, skills: [], end_date: '2026-03-10', attendance: { sessions: 4, present: 20 }, satisfaction: { n: 6, mean: 4.4 }, prepost: { pre_n: 6, pre: 2.0, post_n: 0, post: null }, transfer: { n: 0, mean: null } },
], orgs: [], skills: [{ id: 's1', code: 'LEAD', name_ar: 'قيادة الاجتماعات', name_en: 'Meetings', domain: 'lead', learners: 12, avg_level: 3.2, approved: 4, proven: 0 }, { id: 's2', code: 'WR', name_ar: 'الكتابة المهنية', name_en: 'Writing', domain: 'comm', learners: 7, avg_level: 2.8, approved: 2, proven: 2 }], sectors: [], placements: {}, credentials: { total: 3, by_kind: {} }, events: { total: 0, downloads: 0, sessions: 0, assessed: 0, completed: 0 }, ...over });
const seed = () => ({
  portal_organizations: [{ id: ORG, name_ar: 'قيادة حرس الحدود — المنطقة س', slug: 'bg-x', policy: { pseudonymous: true }, logo: null }],
  portal_org_members: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, organization_id: ORG, user_id: U(100 + i), email: `m${i}@bg.sa`, status: 'confirmed', role: i === 0 ? 'org_admin' : 'member' })).concat([{ id: 99, organization_id: ORG, user_id: U(199), email: 'p@bg.sa', status: 'pending', role: 'member' }] as any),
  portal_learning_lines: Array.from({ length: 6 }, (_, i) => ({ user_id: U(100 + i), kind: 'apply', body_ar: `طبّقت خطوة ${i + 1} في موقعي اليوم`, blocker_ar: i < 5 ? 'لا جهاز في الموقع' : null, day: '2026-02-1' + i })),
  portal_security_events: [], portal_org_reports: [], portal_grad_pages: [], portal_org_letters: [], portal_org_policy_seals: [{ organization_id: ORG, code: 'ATH-OP-AAAA-BBBB', issued_at: '2026-01-05T00:00:00Z' }], portal_shield_seals: [], portal_org_charters: [], portal_org_horizon_pledges: [],
  attendance_sessions: [], attendance_records: [], portal_enrollments: [], miaar_practice_attempts: [], placement_reports: [], portal_credentials: [],
});

test('P68 الرمز ATH-LR والهضم', () => {
  const c = lrCode(); assert.match(c, /^ATH-LR-[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.ok(isLrCode(c)); assert.ok(!isLrCode('ATH-OP-AAAA-BBBB')); assert.ok(!isLrCode('ATH-LR-AAA0-BBBB'));
  const d1 = lrDigest({ a: 1, b: [1, 2], proof: 'x', hash: 'y' }); const d2 = lrDigest({ b: [1, 2], a: 1 }); assert.equal(d1, d2); assert.notEqual(d1, lrDigest({ a: 2, b: [1, 2] }));
});
test('P68 ثمانية قرارات — السابع مستهدَفات والثامن مخصّص بحدّ 140 حرفًا', () => {
  assert.equal(DECISIONS.length, 8); assert.equal(new Set(DECISIONS.map(d => d.key)).size, 8); assert.equal(DECISIONS[7].key, 'custom'); assert.equal(DECISIONS[7].target, null);
  assert.equal(DECISIONS.filter(d => d.target === 'transfer').length, 5); assert.ok(decisionOf('protected_time')); assert.equal(decisionOf('nope'), null);
  assert.equal(cleanNote('<b>قرار</b> https://x.y  طويل').length, 'قرار طويل'.length); assert.equal(cleanNote('ب'.repeat(300)).length, 140);
});
test('P68 الفترة: ربع · تسمية · تحقّق', () => {
  assert.deepEqual(quarterOf('2026-02-15'), { from: '2026-01-01', to: '2026-03-31', label_ar: 'الربع الأول 2026' }); assert.equal(quarterOf('2026-02-15', -1).from, '2025-10-01'); assert.equal(quarterOf('2026-11-08', 1).label_ar, 'الربع الأول 2027');
  assert.equal(periodLabelAr('2026-01-01', '2026-03-31', 'quarter'), 'الربع الأول 2026'); assert.equal(periodLabelAr('2026-02-01', '2026-02-28', 'month'), 'فبراير 2026'); assert.match(periodLabelAr('2026-02-03', '2026-03-09', 'since_last'), /→/);
  const now = new Date('2026-11-08T10:00:00Z'); assert.equal(validatePeriod('2026-08-01', '2026-10-31', now), null); assert.match(validatePeriod('2026-10-31', '2026-08-01', now) || '', /بعد نهايتها/); assert.match(validatePeriod('2026-12-01', '2026-12-31', now) || '', /المستقبل/); assert.match(validatePeriod('2025-01-01', '2026-10-31', now) || '', /أطول/); assert.match(validatePeriod('x', 'y', now) || '', /YYYY/);
  const b = periodBounds('2026-02-01', '2026-02-28'); assert.equal(b.from, '2026-01-31T21:00:00.000Z'); assert.equal(b.to, '2026-02-28T21:00:00.000Z'); assert.equal(b.day_to, '2026-03-01');
});
test('P68 الأرقام الثلاثة: k ≥ 5 و«لم يُقس بعد — يُقاس في …»', () => {
  const n = numbersOf(impactFixture() as any, { pct: 83, sessions: 10, roster_people: 8 }, { to: '2026-03-31' });
  assert.equal(n.transfer.pct, 37.5); assert.equal(n.transfer.n, 8); assert.equal(n.transfer.note_ar, null); assert.equal(n.gain.n, 10); assert.ok((n.gain.pct || 0) > 0); assert.equal(n.attendance.pct, 83);
  const lines = threeLines(n); assert.equal(lines.length, 3); assert.match(lines[0], /الانتقال إلى الميدان 38%/); assert.match(lines[1], /الكسب المعياري \+/); assert.match(lines[2], /83%/);
  const few = numbersOf(impactFixture({ programs: [{ ...impactFixture().programs[0], transfer: { n: 3, mean: 4.8 }, prepost: { pre_n: 10, pre: 2, post_n: 2, post: 3 } }] }) as any, { pct: null, sessions: 0, roster_people: 0 }, { to: '2026-03-31' });
  assert.equal(few.transfer.pct, null); assert.match(few.transfer.note_ar || '', /لم يُقس بعد — يُقاس في 22 مارس 2026/); assert.equal(few.gain.pct, null); assert.match(few.gain.note_ar || '', /لم يُقس/); assert.match(threeLines(few)[2], /لا جلسات حضور/);
  const none = numbersOf(null, null, { to: '2026-03-31' }); assert.equal(none.transfer.pct, null); assert.equal(none.satisfaction.pct, null);
});
test('P68 ثلاثة أسئلة حتمية من الفجوات — ثلاثة دائمًا وبلا تكرار', () => {
  const n = numbersOf(impactFixture() as any, { pct: 65, sessions: 10, roster_people: 8 }, { to: '2026-03-31' });
  const qs = questionsFor({ numbers: n, skills: [{ name_ar: 'قيادة الاجتماعات', code: 'LEAD', avg_level: 3.2, learners: 12, approved: 4, proven: 0 }], programs: [{ name_ar: 'أ', learners: 12, post_n: 10 }, { name_ar: 'ب', learners: 7, post_n: 0 }], pending: 1, pulse_replied_pct: 20, field_people: 6 });
  assert.equal(qs.length, 3); assert.match(qs[0], /الرضا 88% والانتقال إلى الميدان 38%/); assert.match(qs[1], /برنامج واحد من 2 لم يُقَس بعديًّا/); assert.match(qs[2], /«قيادة الاجتماعات» لم تُثبَت/);
  const empty = questionsFor({ numbers: numbersOf(null, null, { to: '2026-03-31' }), skills: [], programs: [], pending: 0, pulse_replied_pct: null, field_people: 0 }); assert.equal(empty.length, 3); assert.match(empty[0], /الميدان لم يتكلّم/); assert.match(empty[1], /القرار الواحد/);
  assert.deepEqual(qs, questionsFor({ numbers: n, skills: [{ name_ar: 'قيادة الاجتماعات', code: 'LEAD', avg_level: 3.2, learners: 12, approved: 4, proven: 0 }], programs: [{ name_ar: 'أ', learners: 12, post_n: 10 }, { name_ar: 'ب', learners: 7, post_n: 0 }], pending: 1, pulse_replied_pct: 20, field_people: 6 }), 'حتمية');
});
test('P68 «ما قرّرتم آخر مرّة»: الرقم المستهدَف قبل/بعد', () => {
  const n = numbersOf(impactFixture() as any, { pct: 83, sessions: 10, roster_people: 8 }, { to: '2026-03-31' });
  const p = previousRead({ code: 'ATH-LR-AAAA-AAAA', period_ar: 'الربع الرابع 2025', decision: { text_ar: 'وقت تطبيق أسبوعي محمي', target: 'transfer', at: '2026-01-02T00:00:00Z' }, before: 20 }, n);
  assert.ok(p); assert.equal(p!.after, 37.5); assert.match(p!.read_ar, /تحرّك من 20% إلى 38% ↑/);
  assert.match(previousRead({ code: 'x', period_ar: 'ف', decision: { text_ar: 'تجهيزات', target: 'transfer', at: '' }, before: null }, n)!.read_ar, /لأوّل مرّة: 38%/);
  assert.match(previousRead({ code: 'x', period_ar: 'ف', decision: { text_ar: 'قرار آخر', target: null, at: '' }, before: null }, n)!.read_ar, /قرّرتم في تقرير ف/);
});
test('P68 الإصدار: وثيقة موقَّعة بلا أسماء · k ≥ 5 للميدان · شارة الأرقام التدريبية · حدث درع', async () => {
  const { db, T } = fakeDb(seed(), impactFixture()); const now = new Date('2026-04-03T08:00:00Z');
  const r = await issueReport(db as any, { org_id: ORG, kind: 'quarter', from: '2026-01-01', to: '2026-03-31', name: 'العقيد س', title: 'قائد التدريب', by: ADMIN, env: {}, site: 'https://athar-portal.vercel.app', now });
  assert.ok(r.ok, JSON.stringify(r)); if (!r.ok) return; const b = r.row.body;
  assert.equal(b.type, 'AtharLeadershipReport'); assert.equal(b.period.label_ar, 'الربع الأول 2026'); assert.equal(b.pseudonymous, true); assert.equal(b.previous, null); assert.equal(b.lines_ar.length, 3); assert.equal(b.questions.length, 3);
  assert.equal(b.people.members, 8); assert.equal(b.people.pending, 1); assert.equal(b.skills.length, 2); assert.equal(b.skills[0].name_ar, 'قيادة الاجتماعات');
  assert.ok(b.field.lines.length >= 3, 'ستة كتبوا → سطور الميدان تظهر'); assert.ok(b.field.lines.some(l => l.startsWith('عائق تكرّر')), 'العائق خمسة أشخاص'); assert.ok(b.field.sources_ar.includes('سطور التطبيق الميداني'));
  assert.equal(b.tail.policy_seal?.code, 'ATH-OP-AAAA-BBBB'); assert.equal(b.issued.name, 'العقيد س'); assert.equal(b.decision, null);
  const txt = JSON.stringify(b); for (const m of T.portal_org_members) assert.ok(!txt.includes(m.email), 'لا بريد'); assert.ok(!txt.includes(U(100)), 'لا معرّف منسوب');
  assert.equal(r.row.digest, lrDigest(b)); assert.equal(r.row.status, 'issued'); assert.ok(T.portal_security_events.some(e => e.kind === 'org_report_issued'));
  /* دون k: أربعة كتبوا فقط → لا سطر */
  const s2 = seed(); s2.portal_learning_lines = s2.portal_learning_lines.slice(0, 4); const { db: db2 } = fakeDb(s2, impactFixture());
  const r2 = await issueReport(db2 as any, { org_id: ORG, kind: 'quarter', from: '2026-01-01', to: '2026-03-31', by: ADMIN, env: {}, now }); assert.ok(r2.ok); if (r2.ok) { assert.equal(r2.row.body.field.lines.length, 0); assert.match(r2.row.body.field.note_ar || '', /k ≥ 5/); }
});
test('P68 القرار يُختم داخل الوثيقة بنفس الرمز — مرّة واحدة · إعادة الإصدار تُلغي السابق وتفتح «ما قرّرتم» · التحقّق', async () => {
  const { db, T } = fakeDb(seed(), impactFixture()); const now = new Date('2026-04-03T08:00:00Z'); const env = {}; const site = 'https://athar-portal.vercel.app';
  const r = await issueReport(db as any, { org_id: ORG, kind: 'quarter', from: '2026-01-01', to: '2026-03-31', by: ADMIN, env, site, now }); assert.ok(r.ok); if (!r.ok) return; const code = r.row.code; const digest0 = r.row.digest;
  const bad = await decideReport(db as any, { code, key: 'custom', note_ar: 'قصير', by: ADMIN, env, site }); assert.ok(!bad.ok);
  const d = await decideReport(db as any, { code, key: 'protected_time', note_ar: 'كل خميس', by: ADMIN, env, site, now: new Date('2026-04-04T08:00:00Z') }); assert.ok(d.ok, JSON.stringify(d)); if (!d.ok) return;
  assert.equal(d.row.code, code); assert.equal(d.row.body.decision?.key, 'protected_time'); assert.equal(d.row.body.decision?.target, 'transfer'); assert.equal(d.row.body.decision?.note_ar, 'كل خميس'); assert.notEqual(d.row.digest, digest0); assert.equal(d.row.digest, lrDigest(d.row.body));
  const again = await decideReport(db as any, { code, key: 'equipment', by: ADMIN, env, site }); assert.ok(!again.ok); assert.match((again as any).error, /قرارٌ واحد يكفي/);
  assert.ok(T.portal_security_events.some(e => e.kind === 'org_report_decided'));
  /* سطر /me للمنسوب */
  const line = await leadershipLineFor(db as any, { id: U(103), email: 'm3@bg.sa' }, new Date('2026-04-10T00:00:00Z')); assert.ok(line); assert.equal(line!.code, code); assert.match(leadershipLineAr(line!), /^قيادتك في «قيادة حرس الحدود — المنطقة س» قرأت تقرير الربع الأول 2026 وقرّرت: وقت تطبيق/);
  assert.equal(await leadershipLineFor(db as any, { id: U(999), email: 'x@y.z' }), null);
  /* التحقّق العام — verify_minimal يحجب القرار والسطور */
  const v = await verifyReport(db as any, code); assert.ok(v.valid && v.intact && v.status === 'issued' && !v.superseded); assert.equal(v.report?.decision_ar, 'وقت تطبيق أسبوعي محمي (ساعتان) لمن أنهى البرنامج'); assert.equal(v.report?.lines_ar.length, 3);
  T.portal_organizations[0].policy = { pseudonymous: true, verify_minimal: true }; const vm = await verifyReport(db as any, code); assert.equal(vm.minimal, true); assert.equal(vm.report?.decision_ar, null); assert.equal(vm.report?.lines_ar.length, 0); assert.equal(vm.report?.organization, 'قيادة حرس الحدود — المنطقة س');
  T.portal_organizations[0].policy = { pseudonymous: true }; assert.equal((await verifyReport(db as any, 'ATH-LR-ZZZZ-ZZZZ')).valid, false);
  /* إعادة إصدار الفترة نفسها → السابق مُلغى، الجديد reissued_from */
  const r2 = await issueReport(db as any, { org_id: ORG, kind: 'quarter', from: '2026-01-01', to: '2026-03-31', by: ADMIN, env, site, now: new Date('2026-04-05T08:00:00Z') }); assert.ok(r2.ok); if (!r2.ok) return;
  assert.equal(r2.replaced, code); assert.equal(r2.row.reissued_from, r.row.id); const old = T.portal_org_reports.find(x => x.code === code); assert.equal(old.status, 'revoked');
  const vo = await verifyReport(db as any, code); assert.ok(vo.valid && vo.superseded && vo.status === 'revoked');
  /* التقرير التالي (فترة لاحقة) يفتح بـ «ما قرّرتم آخر مرّة» — القرار في التقرير المُلغى لا يُحتسب؛ نختم قرارًا على الحيّ أوّلًا */
  await decideReport(db as any, { code: r2.row.code, key: 'review_30', by: ADMIN, env, site });
  const r3 = await issueReport(db as any, { org_id: ORG, kind: 'quarter', from: '2026-04-01', to: '2026-06-30', by: ADMIN, env, site, now: new Date('2026-07-02T08:00:00Z') }); assert.ok(r3.ok); if (!r3.ok) return;
  assert.ok(r3.row.body.previous); assert.equal(r3.row.body.previous!.code, r2.row.code); assert.match(r3.row.body.previous!.read_ar, /اجتماع متابعة/); assert.equal(r3.row.body.previous!.before, 37.5);
  const list = await listReports(db as any, ORG); assert.equal(list.length, 3); assert.equal(list[0].code, r3.row.code);
  const sp = await suggestPeriod(db as any, ORG, new Date('2026-07-20T08:00:00Z')); assert.equal(sp.kind, 'since_last'); assert.equal(sp.from, '2026-07-01'); assert.equal(sp.to, todayRiyadh(new Date('2026-07-20T08:00:00Z')));
  assert.ok((await revokeReport(db as any, r3.row.code, ADMIN)).ok); assert.equal((await suggestPeriod(db as any, ORG, new Date('2026-07-20T08:00:00Z'))).from, '2026-04-01', 'بعد الإلغاء يعود «منذ آخر تقرير» إلى آخر حيّ');
  assert.ok(KIND_AR.since_last);
});
test('P68 الإصدار يرفض الفترة الخاطئة والجهة المجهولة', async () => {
  const { db } = fakeDb(seed(), impactFixture());
  assert.ok(!(await issueReport(db as any, { org_id: ORG, kind: 'custom', from: '2026-03-31', to: '2026-01-01', by: ADMIN, env: {} })).ok);
  const r = await issueReport(db as any, { org_id: U(77), kind: 'custom', from: '2026-01-01', to: '2026-01-31', by: ADMIN, env: {} }); assert.ok(!r.ok); assert.equal((r as any).status, 404);
});
test('P68-ب التقرير التفصيلي: الزمن لكل بند من فروق الإجابات · حالات الواصف', () => {
  const m = secondsPerItem(['a', 'b', 'c'], [{ question_id: 'b', submitted_at: '2026-01-01T00:01:00Z' }, { question_id: 'a', submitted_at: '2026-01-01T00:00:20Z' }, { question_id: 'c', submitted_at: '2026-01-01T01:00:00Z' }], '2026-01-01T00:00:00Z');
  assert.equal(m.get('a'), 20); assert.equal(m.get('b'), 40); assert.equal(m.has('c'), false, 'فجوة > 30 دقيقة لا تُحتسب');
  assert.equal(secondsPerItem([], [{ question_id: 'a', submitted_at: '2026-01-01T00:00:20Z' }], null).size, 0);
  assert.equal(stateOf(75), 'strong'); assert.equal(stateOf(50), 'developing'); assert.equal(stateOf(49), 'gap');
});
test('P68 شكل المصدر: SQL · الجداول في الخزنة · أنواع أحداث الدرع · التبويب · المسارات · الشعار', () => {
  const sql = read('supabase/p68-leadership-report.sql');
  for (const s of ['portal_org_reports', "add column if not exists logo", 'porg_logo_chk', 'por_live_period_uidx', 'portal_org_report_by_code', 'revoke all on public.portal_org_reports from anon', "'p68_policies'"]) assert.ok(sql.includes(s), s);
  assert.ok(REGISTRY.some(r => r.table === 'portal_org_reports' && r.piiCols.includes('issued_name') && r.userCol === 'issued_by'));
  assert.equal(SHIELD_KIND_AR.org_report_issued !== undefined, true); assert.equal(DEFAULT_SEVERITY.org_report_decided, 'info');
  const org = read('app/org/page.tsx'); assert.ok(org.includes("['leader', 'تقرير القيادة', 'Leadership report']")); assert.ok(org.includes("['report', 'البيانات التفصيلية', 'Detailed data']")); assert.ok(org.includes("tab === 'leader' && <OrgReport"));
  for (const p of ['app/api/org/report/route.ts', 'app/components/OrgReport.tsx', 'app/components/OrgReportSheet.tsx', 'app/org/report/[code]/page.tsx', 'app/verify/report/page.tsx', 'lib/miaar/detail.ts', 'app/miaar/DetailReport.tsx', 'app/miaar/result/[code]/detail/page.tsx']) assert.ok(has(p), p);
  const way = read('lib/portal/way.ts'); assert.ok(way.includes("'org/report'")); assert.ok(way.includes("'verify/report'"));
  const sheet = read('app/components/OrgReportSheet.tsx'); assert.ok(sheet.includes('أرقام تدريبية لا أسماء')); assert.ok(sheet.includes('/verify/report?code=')); assert.ok(sheet.includes('@media print'));
  const banner = read('app/components/OrgPledgeBanner.tsx'); assert.ok(banner.includes('/api/org/report?mine=1')); assert.ok(banner.includes('org-lead-line'));
  const pol = read('app/api/org/policy/route.ts'); assert.ok(pol.includes("action === 'logo'")); assert.ok(pol.includes('131072'));
  const opl = read('app/components/OrgPolicy.tsx'); assert.ok(opl.includes('opl-logo-file')); assert.ok(opl.includes('toDataURL'));
  const am = read('app/admin/miaar/AdminMiaar.tsx'); assert.ok(am.includes('/icons/icon-192.png')); assert.ok(am.includes('mm-org')); assert.ok(am.includes('orgs=1'));
  const mi = read('app/miaar/MiaarApp.tsx'); assert.ok(mi.includes('mi-detail-link')); const xb = read('app/admin/miaar/ExitBoard.tsx'); assert.ok(xb.includes('xb-detail-link'));
  const api = read('app/api/miaar/route.ts'); assert.ok(api.includes("searchParams.get('detail')")); const adm = read('app/api/admin/miaar/route.ts'); assert.ok(adm.includes('withText: true'));
  const dr = read('app/miaar/DetailReport.tsx'); assert.ok(!dr.includes('it.text}') || dr.includes('grader ?'), 'النصّ فقط في نسخة المصحّح');
});
