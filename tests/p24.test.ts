// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P24 — «أثر الجهة»: صدى الجهة (k ≥ 5 دائمًا · لا نصوص · مرآة الذات) · الإحاطة المحلية · دفعة العودة في عقود الأثر (العقود القائمة لا تتغير · تناسبية)
//                 · ميثاق الجهة (البنود الأربعة · التحقق · التوقيع Ed25519 والتحقق · التجديد · السحب) · مقاعد الجهة (التحقق · التوأمة) · الخزنة تعرف الجدولين · أداة الوكلاء العامة
import test from 'node:test';
import assert from 'node:assert/strict';
import { K_ORG, ECHO_DAYS, ECHO_THREADS, ORG_CHARTER_AR, ORG_CHARTER_VERSION, ORG_CHARTER_MONTHS, PRIVACY_AR, buildThreads, buildMirror, buildEcho, localBrief, charterState, validateCharterSign, validateSeatRequest, twinSummary, addMonths, charterCode, publicCharter } from '../lib/org-impact/registry';
import type { EchoInput, OrgCharter } from '../lib/org-impact/registry';
import { buildOrgCharterDoc, signCharter, revokeCharter, currentCharter, charterBadges, charterForPerson } from '../lib/org-impact/charter';
import { computeState, normalizeSplit, milestoneAmounts, SPLIT_DEFAULT, TARGETS_DEFAULT, pulseEvents, contractStory, validateContract, EMPTY_CONTRACT_FORM } from '../lib/portal/contracts';
import type { Contract, PersonFacts } from '../lib/portal/contracts';
import { schedule } from '../lib/portal/contracts-cron';
import { REGISTRY } from '../lib/vault/registry';
import { ALL_MCP_TOOLS, toolsFor } from '../lib/portal/mcp';
import { signerFromEnv, verifySignature, localResolver } from '../lib/portal/vc-server';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const ORG = '00000000-0000-4000-8000-000000000021'; const ORG2 = '00000000-0000-4000-8000-000000000023';
const NOW = new Date('2026-10-30T08:00:00Z').getTime(); const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();

function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {}; for (const [k, v] of Object.entries(seed)) T[k] = v.map((r, i) => ({ id: i + 1, ...r }));
  const table = (t: string) => (T[t] = T[t] || []);
  const match = (r: any, f: any): boolean => {
    switch (f.op) {
      case 'eq': return r[f.c] === f.v || String(r[f.c]) === String(f.v);
      case 'ilike': return String(r[f.c] || '').toLowerCase() === String(f.v).toLowerCase();
      case 'in': return f.v.map(String).includes(String(r[f.c]));
      case 'is': return r[f.c] == null; case 'not_is': return r[f.c] != null;
      case 'lte': return r[f.c] <= f.v; case 'lt': return r[f.c] < f.v; case 'gte': return r[f.c] >= f.v; case 'gt': return r[f.c] > f.v;
      case 'or': return f.v.split(',').some((part: string) => { const [c, op, ...rest] = part.split('.'); const v = rest.join('.'); return match(r, { op: op === 'eq' ? 'eq' : 'ilike', c, v }); });
      default: return true;
    }
  };
  const db: any = {
    T, from: (t: string) => {
      const q: any = { _f: [], _order: null, _limit: 0, _single: false, _op: 'select', _payload: null };
      const run = () => {
        const rows = table(t);
        if (q._op === 'insert') { const arr = Array.isArray(q._payload) ? q._payload : [q._payload]; const ins = arr.map((p: any) => ({ id: `${t}-${rows.length + 1}-${Math.floor(Math.random() * 1e6)}`, status_index: rows.length + 1, created_at: new Date().toISOString(), ...p })); rows.push(...ins); return { data: q._single ? ins[0] : ins, error: null }; }
        let sel = rows.filter(r => q._f.every((f: any) => match(r, f)));
        if (q._op === 'update') { for (const r of sel) Object.assign(r, q._payload); return { data: q._single ? sel[0] || null : sel, error: null }; }
        if (q._order) sel = [...sel].sort((a, b) => (a[q._order.c] < b[q._order.c] ? 1 : -1) * (q._order.asc ? -1 : 1));
        if (q._limit) sel = sel.slice(0, q._limit);
        return { data: q._single ? sel[0] || null : sel, count: sel.length, error: null };
      };
      q.select = () => q;
      for (const op of ['eq', 'ilike', 'lte', 'lt', 'gte', 'gt', 'neq']) q[op] = (c: string, v: any) => { q._f.push({ op, c, v }); return q; };
      q.in = (c: string, v: any[]) => { q._f.push({ op: 'in', c, v }); return q; }; q.is = (c: string, v: any) => { q._f.push({ op: 'is', c, v }); return q; }; q.not = (c: string, op: string) => { if (op === 'is') q._f.push({ op: 'not_is', c }); return q; }; q.or = (s: string) => { q._f.push({ op: 'or', v: s }); return q; };
      q.order = (c: string, o: any) => { q._order = { c, asc: !!o?.ascending }; return q; }; q.limit = (n: number) => { q._limit = n; return q; }; q.maybeSingle = () => { q._single = true; return q; }; q.single = q.maybeSingle;
      q.insert = (p: any) => { q._op = 'insert'; q._payload = p; return q; }; q.update = (p: any) => { q._op = 'update'; q._payload = p; return q; };
      q.then = (res: any, rej: any) => Promise.resolve(run()).then(res, rej);
      return q;
    },
  };
  return db;
}

/** جهة من 8 منسوبين: 6 لمسوا موضوع «التغيير» (يظهر) و2 لمسا «الجودة» (لا يظهر) */
function echoSeed(): EchoInput {
  const members = Array.from({ length: 8 }, (_, i) => `m${i}@org.sa`); const cases: EchoInput['cases'] = []; const posts: EchoInput['posts'] = [];
  for (let i = 0; i < 3; i++) cases.push({ id: `c${i}`, author_email: `m${i}@org.sa`, created_at: ago(5 + i), theme: 'change', status: i === 0 ? 'returned' : 'open', committed_at: ago(4), return_due_at: ago(-10), returned_at: i === 0 ? ago(1) : null, return_outcome: i === 0 ? 'succeeded' : null });
  for (let i = 3; i < 6; i++) posts.push({ case_id: 'c0', email: `m${i}@org.sa`, kind: i === 3 ? 'advice' : 'question', created_at: ago(3) });
  posts.push({ case_id: 'c1', email: 'outsider@other.sa', kind: 'question', created_at: ago(2) }); // من جهة أخرى — لا يُعدّ لنا
  cases.push({ id: 'q1', author_email: 'm6@org.sa', created_at: ago(2), theme: 'quality', status: 'open', committed_at: null, return_due_at: null, returned_at: null, return_outcome: null });
  posts.push({ case_id: 'q1', email: 'm7@org.sa', kind: 'question', created_at: ago(1) });
  cases.push({ id: 'old', author_email: 'm0@org.sa', created_at: ago(60), theme: 'upward', status: 'closed', committed_at: ago(58), return_due_at: ago(44), returned_at: ago(50), return_outcome: 'struggled' }); // الربع الحالي لكن خارج نافذة الصدى
  const scribes: EchoInput['scribes'] = [{ case_id: 'c0', pivotal_questions: ['ما الذي يخسره الرافضون تحديدًا؟'], unsaid_ar: 'لم يُذكر رأي المستفيدين.', patterns: ['change'] }];
  const attestations: EchoInput['attestations'] = [{ to_email: 'm1@org.sa', status: 'approved', created_at: ago(20), decided_at: ago(18) }, { to_email: 'm2@org.sa', status: 'pending', created_at: ago(2), decided_at: null }, { to_email: 'm3@org.sa', status: 'approved', created_at: ago(120), decided_at: ago(110) }];
  return { members, cases, posts, scribes, attestations, daily_people: 4, daily_people_prev: 2 };
}

test('p24 echo: k ≥ 5 always — thread appears only with ≥ 5 people; smaller themes are reported honestly as below quorum; no case text leaks', () => {
  assert.equal(K_ORG, 5, 'k = 5 دائمًا — لا استثناء للجهات الصغيرة'); assert.equal(ECHO_THREADS, 3, 'ثلاثة خيوط');
  const { threads, below } = buildThreads(echoSeed(), NOW);
  assert.equal(threads.length, 1, 'خيط واحد بلغ النصاب'); assert.equal(threads[0].theme, 'change'); assert.equal(threads[0].people, 6, 'ستة من منسوبينا (الغريب لا يُعدّ)');
  assert.equal(threads[0].questions, 2, 'سؤالان'); assert.equal(threads[0].advice, 1, 'نصيحة'); assert.equal(threads[0].returns, 1, 'عودة'); assert.equal(threads[0].pivotal_question, 'ما الذي يخسره الرافضون تحديدًا؟');
  assert.deepEqual(below.map(b => [b.theme, b.people]), [['quality', 2]], 'الجودة دون النصاب: 2 من 5');
  assert.ok(!JSON.stringify(threads).includes('@'), 'لا بُرُد في الخيوط'); assert.ok(!('body_ar' in (threads[0] as any)), 'لا نص قضية');
  const small = buildThreads({ ...echoSeed(), members: ['m0@org.sa', 'm1@org.sa', 'm2@org.sa', 'm3@org.sa'] }, NOW);
  assert.equal(small.threads.length, 0, 'جهة من 4 أشخاص لا ترى خيطًا أبدًا'); assert.equal(small.below[0].people, 4);
});

test('p24 echo: mirror compares the organization with its own previous quarter only (no other org); daily counts included', () => {
  const m = buildMirror(echoSeed(), NOW); const by = Object.fromEntries(m.map(x => [x.key, x]));
  assert.equal(by.active.now, 8, '8 فاعلين هذا الربع (4 أصحاب قضايا + 4 متداولين)'); assert.equal(by.active.prev, 0, 'الربع السابق خالٍ');
  assert.equal(by.ask_ratio.now, 75, '3 أسئلة من 4 مداخلات = 75%'); assert.equal(by.ask_ratio.prev, null); assert.ok(by.ask_ratio.read_ar.includes('أول ربع'), 'أول ربع يُقاس');
  assert.equal(by.returns_on_time.now, 100, 'عودتان في موعدهما (c0 و old)'); assert.equal(by.attestations.now, 1, 'شهادة معتمدة واحدة في الربع (الثانية قبل 110 يومًا = الربع السابق)'); assert.equal(by.attestations.prev, 1);
  assert.equal(by.daily.now, 4); assert.equal(by.daily.delta, 2);
  assert.ok(m.every(x => !/جهة أخرى|منافس/.test(x.label_ar)), 'لا مقارنة بجهة أخرى');
});

test('p24 echo: buildEcho + local brief — honest when quorum is missing, three-thread narrative otherwise, ≈90 seconds', () => {
  const e = buildEcho(echoSeed(), NOW); assert.equal(e.quorum_ok, true); assert.equal(e.people_total, 8); assert.equal(e.people_active, 8, 'كل الثمانية لمسوا شيئًا في 28 يومًا'); assert.deepEqual(e.privacy_ar, PRIVACY_AR); assert.equal(e.window_days, ECHO_DAYS);
  const b = localBrief('جامعة الأمير مقرن', e); const words = b.split(/\s+/).length;
  assert.ok(words >= 60 && words <= 260, `≈ 90 ثانية (${words} كلمة)`); assert.ok(b.includes('قيادة التغيير') && b.includes('ما الذي يخسره'), 'يذكر الخيط وسؤاله المحوري'); assert.ok(b.includes('لا تقييم') || b.includes('تقييم وظيفي'), 'يختم بتذكير الميثاق'); assert.ok(!b.includes('@'), 'لا بُرُد');
  const quiet = buildEcho({ ...echoSeed(), members: ['m0@org.sa', 'm1@org.sa'] }, NOW); assert.equal(quiet.quorum_ok, false);
  const qb = localBrief('جهة صغيرة', quiet); assert.ok(qb.includes('لم يكتمل النصاب'), 'يقولها بصدق'); assert.ok(qb.includes('قيادة التغيير') && qb.includes('من 5'), 'يسمّي أقرب موضوع إلى الظهور');
});

const cohort = ['a@org.sa', 'b@org.sa', 'c@org.sa', 'd@org.sa', 'e@org.sa', 'f@org.sa', 'g@org.sa', 'h@org.sa'].map(email => ({ email, full_name: null }));
const pf = (email: string, o: Partial<PersonFacts> = {}): PersonFacts => ({ email, completed: true, confirmed_missions: 1, submitted_missions: 0, evidence_at: [], returns_at: [], ...o });
const baseC: Contract = { id: 'c24', created_at: '2026-06-01T00:00:00Z', organization_id: ORG, program_id: 'p1', title_ar: 'عقد أثر — قيادة الصف الأول', cohort, total_amount: 200000, currency: 'SAR', split: { ...SPLIT_DEFAULT }, targets: { ...TARGETS_DEFAULT }, status: 'active', token: 'T'.repeat(24), start_at: '2026-06-01', delivered_at: '2026-07-01T00:00:00Z', flags: {} };

test('p24 return payment: new default 55/20/15/10; legacy contracts keep 3 milestones; return milestone counts council returns inside the window, pro-rata', () => {
  assert.deepEqual(SPLIT_DEFAULT, { delivery: 55, evidence: 20, impact: 15, return: 10 }); assert.equal(TARGETS_DEFAULT.return_rate, 25);
  assert.deepEqual(milestoneAmounts(200000, SPLIT_DEFAULT), { delivery: 110000, evidence: 40000, impact: 30000, return: 20000 });
  // عقد قائم (ثلاثي): لا دفعة رابعة تُفرض بأثر رجعي
  const legacy = { ...baseC, split: normalizeSplit({ delivery: 60, evidence: 25, impact: 15 }) }; const ls = computeState(legacy, { people: cohort.map(p => pf(p.email)), releases: [] }, new Date('2026-08-01T00:00:00Z'));
  assert.equal(ls.milestones.length, 3, 'العقد القائم يبقى بثلاث دفعات'); assert.equal(schedule(legacy).length, 3); assert.equal(ls.returned, 0);
  // عقد جديد: نافذة مفتوحة — العودة قيد التقدم؛ عودة قبل التسليم لا تُحتسب؛ عودة بعد إغلاق النافذة لا تُحتسب
  const people = cohort.map((p, i) => pf(p.email, { returns_at: i < 2 ? ['2026-08-15T00:00:00Z'] : i === 2 ? ['2026-06-20T00:00:00Z'] : i === 3 ? ['2026-11-01T00:00:00Z'] : [] }));
  const open = computeState(baseC, { people, releases: [] }, new Date('2026-08-20T00:00:00Z'));
  assert.equal(open.milestones.length, 4); const r = open.milestones[3]; assert.equal(r.key, 'return'); assert.equal(r.status, 'progress'); assert.equal(open.returned, 2, 'عودتان داخل النافذة فقط');
  assert.equal(r.progress, 100, '2/8 = 25% = الهدف'); assert.equal(r.payable, 20000); assert.ok(open.next.some(n => n.ar.includes('دفعة العودة')), 'الخطوة التالية تذكر العودة');
  // إغلاق النافذة (90 يومًا) بعودة واحدة فقط → تناسبية 50%
  const half = cohort.map((p, i) => pf(p.email, { returns_at: i === 0 ? ['2026-08-15T00:00:00Z'] : [] }));
  const closed = computeState(baseC, { people: half, releases: [] }, new Date('2026-10-05T00:00:00Z')); const rc = closed.milestones[3];
  assert.equal(rc.status, 'due'); assert.equal(rc.prorata, true); assert.equal(rc.payable, 10400, '1/8 = 12.5% ≈ 13% (تقريب النسبة كما في دفعة الأثر) من هدف 25% → 52% من 20000'); assert.ok(rc.detail.ar.includes('تناسبية'));
  assert.ok(closed.due >= 10400, 'مستحق يشمل العودة'); const ev = pulseEvents(baseC, closed, new Date('2026-10-05T00:00:00Z')); assert.ok(ev.some(e => e.key === 'return_due_at'), 'نبض: دفعة العودة مستحقة');
  assert.ok(contractStory(baseC, closed, 'ar').some(l => l.includes('العودة') && l.includes('تدفع للعودة')), 'القصة تذكر العودة');
  assert.equal(validateContract({ ...EMPTY_CONTRACT_FORM, organization_id: ORG, title_ar: 'عقد أثر طويل', total_amount: '1000' }, cohort), null, 'النموذج الافتراضي صالح (مجموع 100 مع العودة)');
  assert.equal(validateContract({ ...EMPTY_CONTRACT_FORM, organization_id: ORG, title_ar: 'عقد أثر طويل', total_amount: '1000', split: { delivery: 55, evidence: 20, impact: 15, return: 20 } }, cohort), 'مجموع الدفعات يجب أن يساوي 100%');
});

test('p24 charter: four clauses (time · confidentiality · no appraisal · no names), yearly, strict acceptance validation, state machine', () => {
  assert.equal(ORG_CHARTER_AR.length, 4); assert.deepEqual(ORG_CHARTER_AR.map(c => c.id), ['time', 'confidentiality', 'no_appraisal', 'no_names']); assert.equal(ORG_CHARTER_MONTHS, 12); assert.equal(ORG_CHARTER_VERSION, '2026-10');
  assert.equal(validateCharterSign({ confirm: true, accepted: ['time', 'confidentiality', 'no_appraisal', 'no_names'] }), null);
  assert.match(validateCharterSign({ confirm: true, accepted: ['time'] }) || '', /ينقص/); assert.equal(validateCharterSign({ confirm: false, accepted: [] }), 'يلزم تأكيد صريح');
  const c = (o: Partial<OrgCharter>): OrgCharter => ({ id: 'x', created_at: ago(1), organization_id: ORG, version: '2026-10', clauses: [], signer_user_id: 'u', signer_email: 'a@o.sa', signer_name: null, signer_title: null, signed_at: ago(1), expires_at: addMonths(ago(1), 12), status: 'active', revoked_at: null, revoked_by: null, vc_code: 'ATH-OC-AAAA-BBBB', vc_issuance_id: null, ...o });
  assert.equal(charterState(null).status, 'none'); assert.equal(charterState(c({}), NOW).signed, true); assert.equal(charterState(c({}), NOW).renew_soon, false);
  assert.equal(charterState(c({ expires_at: ago(-20) }), NOW).renew_soon, true, 'آخر 30 يومًا = تجديد'); assert.equal(charterState(c({ expires_at: ago(1) }), NOW).status, 'expired'); assert.equal(charterState(c({ status: 'revoked' }), NOW).signed, false);
  assert.match(charterCode(() => 'ABCD'), /^ATH-OC-ABCD-ABCD$/); const pub = publicCharter(c({}), 'جامعة'); assert.ok(!('signer_email' in pub) && pub.org_name === 'جامعة', 'الشارة العامة بلا أشخاص');
});

test('p24 charter: sign → Ed25519 document verifies; renew blocked while active; revoke hides badge and revokes the VC; person sees own org status', async () => {
  const db = fakeDb({ portal_organizations: [{ id: ORG, name_ar: 'جامعة الأمير مقرن' }, { id: ORG2, name_ar: 'هيئة التقويم' }], portal_org_members: [{ organization_id: ORG, email: 'x@upm.edu.sa', user_id: 'ux', status: 'confirmed', role: 'learner' }] });
  const site = 'https://athar-portal.vercel.app'; const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, site)!; const did = 'did:web:athar-portal.vercel.app';
  const r = await signCharter(db, { id: ORG, name_ar: 'جامعة الأمير مقرن' }, { id: 'u1', email: 'admin@upm.edu.sa', name: 'أحمد', title: 'مدير التدريب' }, signer, site, did, () => 'ABCD', new Date(NOW));
  assert.ok(r.ok, 'التوقيع نجح'); if (!r.ok) return; assert.equal(r.signed_vc, true); assert.equal(r.charter.vc_code, 'ATH-OC-ABCD-ABCD'); assert.ok(r.verify_url!.includes('/verify/vc?code=ATH-OC-ABCD-ABCD'));
  const iss = db.T.portal_vc_issuances[0]; assert.equal(iss.kind, 'org_charter'); assert.equal(iss.vc._athar.kind, 'org_charter'); assert.equal(iss.vc.credentialSubject.name, 'جامعة الأمير مقرن'); assert.equal(iss.vc.credentialSubject.result.length, 4);
  const v = await verifySignature(iss.vc, localResolver(signer, [])); assert.equal(v.ok, true, 'التوقيع يتحقق'); const tampered = { ...iss.vc, validUntil: '2099-01-01T00:00:00.000Z' }; assert.equal((await verifySignature(tampered, localResolver(signer, []))).ok, false, 'التلاعب يُكشف');
  const again = await signCharter(db, { id: ORG, name_ar: 'جامعة الأمير مقرن' }, { id: 'u1', email: 'admin@upm.edu.sa', name: 'أحمد', title: null }, signer, site, did, () => 'EFGH', new Date(NOW)); assert.ok(!again.ok && /فعّال/.test((again as any).error), 'لا تجديد وهو فعّال');
  const badges = await charterBadges(db, NOW); assert.equal(badges.length, 1); assert.equal(badges[0].org_name, 'جامعة الأمير مقرن'); assert.equal(badges[0].code, 'ATH-OC-ABCD-ABCD');
  const me = await charterForPerson(db, { id: 'ux', email: 'x@upm.edu.sa' }); assert.equal(me?.signed, true, 'المنسوب يرى أن جهته وقّعت'); assert.equal(me?.code, 'ATH-OC-ABCD-ABCD');
  assert.equal(await charterForPerson(db, { id: 'nobody', email: 'n@n.sa' }), null, 'بلا جهة → لا سطر');
  // تجديد في آخر 30 يومًا: يُسمح ويُعلَّم القديم expired
  const cur = await currentCharter(db, ORG); cur!.expires_at = ago(-10); db.T.portal_org_charters[0].expires_at = ago(-10);
  const renew = await signCharter(db, { id: ORG, name_ar: 'جامعة الأمير مقرن' }, { id: 'u1', email: 'admin@upm.edu.sa', name: 'أحمد', title: null }, signer, site, did, () => 'EFGH', new Date(NOW)); assert.ok(renew.ok, 'التجديد مسموح قرب الانتهاء'); assert.equal(db.T.portal_org_charters[0].status, 'expired'); assert.equal(db.T.portal_org_charters.length, 2);
  const rv = await revokeCharter(db, ORG, { id: 'u1' }, new Date(NOW)); assert.equal(rv.ok, true); assert.equal((await charterBadges(db, NOW)).length, 0, 'الشارة اختفت'); assert.ok(db.T.portal_vc_issuances.find((x: any) => x.code === 'ATH-OC-EFGH-EFGH').revoked_at, 'الوثيقة أُلغيت');
  // بلا مفتاح توقيع: يُسجَّل الميثاق بلا وثيقة
  const noKey = await signCharter(db, { id: ORG2, name_ar: 'هيئة التقويم' }, { id: 'u2', email: 'a@etec.gov.sa', name: '', title: null }, null, site, did, () => 'ZZZZ', new Date(NOW)); assert.ok(noKey.ok && !noKey.signed_vc && noKey.charter.vc_code === null);
  const doc = buildOrgCharterDoc({ code: 'ATH-OC-1111-2222', org: { id: ORG, name_ar: 'ج' }, signer_title: null, site, did, expires: addMonths(new Date(NOW), 12), statusIndex: 7 }); assert.equal(doc.credentialStatus?.statusListIndex, '7'); assert.ok(doc.type.includes('OpenBadgeCredential'));
});

test('p24 seats: validation (≥ 2 seats, topic), twin summary never names other organizations', () => {
  const ppl = [{ email: 'a@o.sa' }, { email: 'b@o.sa' }];
  assert.equal(validateSeatRequest({ topic: 'change', people: ppl }), null); assert.match(validateSeatRequest({ topic: 'change', people: [ppl[0]] }) || '', /أقل طلب 2/); assert.match(validateSeatRequest({ topic: '', people: ppl }) || '', /موضوع/);
  assert.match(validateSeatRequest({ topic: 'change', people: Array.from({ length: 41 }, (_, i) => ({ email: `p${i}@o.sa` })) }) || '', /أقصى/);
  const members = [{ council_id: 'c1', organization_id: ORG, status: 'active' }, { council_id: 'c1', organization_id: ORG, status: 'active' }, { council_id: 'c1', organization_id: ORG2, status: 'active' }, { council_id: 'c1', organization_id: 'o3', status: 'active' }, { council_id: 'c1', organization_id: ORG, status: 'left' }, { council_id: 'c2', organization_id: ORG2, status: 'active' }];
  const t = twinSummary(ORG, members, [{ id: 'c1', title_ar: 'مجلس أ', status: 'active', cycle_no: 1, cycle_ends_at: null }, { id: 'c2', title_ar: 'مجلس ب', status: 'active', cycle_no: 1, cycle_ends_at: null }]);
  assert.equal(t.length, 1, 'فقط المجلس الذي فيه منسوبونا'); assert.equal(t[0].mine, 2); assert.equal(t[0].others, 2); assert.equal(t[0].other_orgs, 2); assert.ok(!JSON.stringify(t).includes(ORG2), 'لا معرّفات جهات أخرى');
});

test('p24 vault + agents: both new tables are registered (PDPL) and org_charter_verify is a public read-only tool', () => {
  const ch = REGISTRY.find(r => r.table === 'portal_org_charters'); const sr = REGISTRY.find(r => r.table === 'portal_org_seat_requests');
  assert.ok(ch && ch.policy === 'retain_legal' && ch.access.includes('public'), 'الميثاق: وثيقة تعاقدية محفوظة والشارة عامة'); assert.ok(sr && sr.policy === 'anonymize' && sr.piiCols.includes('people'), 'طلبات المقاعد: تُجهَّل قائمة البُرُد عند النسيان');
  const t = ALL_MCP_TOOLS.find(x => x.name === 'org_charter_verify'); assert.ok(t && t.annotations.readOnlyHint && t.tiers.includes('anon'), 'أداة عامة للقراءة'); assert.ok(toolsFor('anon').some(x => x.name === 'org_charter_verify'));
  assert.ok(toolsFor('personal', ['wallet:read']).some(x => x.name === 'org_charter_verify'), 'متاحة للمفوَّضين أيضًا');
});
