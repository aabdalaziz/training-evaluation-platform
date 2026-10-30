// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P28 — «أفق الجهة» («عشر سنوات وخطوة»): الأهلية (5 منسوبين + فصلان) · المسودة المحلية بصيغة «نحن» من فصول الجهة وكلماتها · الخطوات الثلاث (أنواع متمايزة · ما لم تعشه الجهة أولًا · جهة صغيرة = مجلس/كتاب فقط)
//                 · الدرب من أحداث المنسوبين المؤكَّدين بعد التوقيع فقط (5 أشخاص متمايزين · مجلس يضم اثنين + عودة · 5×5 مواقف · كتاب سنة) · وثيقة Ed25519 kind=org_horizon باسم الجهة بلا نص الأفق
//                 · الكرون: فتح مراجعة سنة الجهة في اليوم 365 لمديري الجهة · تذكير 182 مرة واحدة · طيّ بعد 30 يومًا · فصل «عهد الجهة» في رحلة الجهة · الخزنة · وكلاء MCP بلا أداة جديدة
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORG_HORIZON_MIN_CHAPTERS, ORG_HORIZON_MIN_MEMBERS, ORG_HORIZON_YEARS, ORG_PLEDGE_DAYS, ORG_REVIEW_WINDOW_DAYS, ORG_MIDYEAR_DAY, ORG_PLEDGE_OPTIONS, ORG_PLEDGE_PEOPLE, ORG_PLEDGE_KIND_AR, orgEligibility, localOrgScenario, validateOrgScenario, proposeOrgPledges, validateOrgPledgeChoice, validateOrgReview, buildOrgPath, orgReviewText, memberPledgeView, orgPledgeChapters, orgYearTarget, orgPledgeCode } from '../lib/org-horizon/registry';
import type { OrgPledge, OrgPathInput, OrgPledgeOption } from '../lib/org-horizon/registry';
import { buildOrgPledgeDoc, signOrgPledge, revokeOrgPledge } from '../lib/org-horizon/pledge';
import { runOrgHorizon } from '../lib/org-horizon/cron';
import { buildOrgChapters, buildOrgJourney, ORG_KIND_AR, quarterOf } from '../lib/org-journey/registry';
import type { OrgJourneyInput, OrgChapter } from '../lib/org-journey/registry';
import { REGISTRY, erasurePlan } from '../lib/vault/registry';
import { ALL_MCP_TOOLS } from '../lib/portal/mcp';
import { signerFromEnv, verifySignature, localResolver } from '../lib/portal/vc-server';
import { structuralChecks } from '../lib/portal/vc';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const SITE = 'https://athar-portal.vercel.app'; const DID = 'did:web:athar-portal.vercel.app';
const NOW = new Date('2026-10-30T08:00:00Z').getTime(); const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const ORG = { id: '00000000-0000-4000-8000-000000000021', name: 'جامعة الأمير محمد' }; const WHO = { id: '00000000-0000-4000-8000-000000000001', email: 'Admin@upm.edu.sa', name: 'أحمد' };
const M = Array.from({ length: 7 }, (_, i) => `p${i + 1}@upm.edu.sa`);

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
        if (q._op === 'delete') { T[t] = rows.filter(r => !sel.includes(r)); return { data: sel, error: null }; }
        if (q._order) sel = [...sel].sort((a, b) => (a[q._order.c] < b[q._order.c] ? 1 : -1) * (q._order.asc ? -1 : 1));
        if (q._limit) sel = sel.slice(0, q._limit);
        return { data: q._single ? sel[0] || null : sel, count: sel.length, error: null };
      };
      q.select = () => q;
      for (const op of ['eq', 'ilike', 'lte', 'lt', 'gte', 'gt', 'neq']) q[op] = (c: string, v: any) => { q._f.push({ op, c, v }); return q; };
      q.in = (c: string, v: any[]) => { q._f.push({ op: 'in', c, v }); return q; }; q.is = (c: string, v: any) => { q._f.push({ op: 'is', c, v }); return q; }; q.not = (c: string, op: string) => { if (op === 'is') q._f.push({ op: 'not_is', c }); return q; }; q.or = (s: string) => { q._f.push({ op: 'or', v: s }); return q; };
      q.order = (c: string, o: any) => { q._order = { c, asc: !!o?.ascending }; return q; }; q.limit = (n: number) => { q._limit = n; return q; }; q.maybeSingle = () => { q._single = true; return q; }; q.single = q.maybeSingle;
      q.insert = (p: any) => { q._op = 'insert'; q._payload = p; return q; }; q.update = (p: any) => { q._op = 'update'; q._payload = p; return q; }; q.delete = () => { q._op = 'delete'; return q; };
      q.then = (res: any, rej: any) => Promise.resolve(run()).then(res, rej);
      return q;
    },
  };
  return db;
}

/** مدخلات رحلة جهة: 7 منسوبين · فصلان (أول موقف لخمسة · مهام لخمسة) */
const five = (at: number) => M.slice(0, 5).map((p, i) => ({ person: p, at: ago(at + i) }));
function oinp(over: Partial<OrgJourneyInput> = {}): OrgJourneyInput {
  return { members: M, daily_first: five(200), missions: five(150), joins: [], returns: [], attestations: [], levels: [], credentials: [], charters: [], twinnings: [], contracts: [], ...over };
}
const chaptersOf = (i: OrgJourneyInput) => buildOrgChapters(i).chapters;
const emptyPath = (over: Partial<OrgPathInput> = {}): OrgPathInput => ({ members: M, missions: [], daily: [], joins: [], returns: [], levels: [], attestations: [], yearbooks: [], ...over });
const P = (kind: OrgPledge['kind'], target: any, signedDaysAgo = 100): Pick<OrgPledge, 'kind' | 'target' | 'signed_at'> => ({ kind, target, signed_at: ago(signedDaysAgo) });

test('p28 eligibility + local scenario + validators: no org horizon before 5 confirmed members and 2 chapters; the draft speaks as «we», from the org’s own chapters and words', () => {
  assert.equal(ORG_HORIZON_MIN_CHAPTERS, 2); assert.equal(ORG_HORIZON_MIN_MEMBERS, 5); assert.equal(ORG_HORIZON_YEARS, 10); assert.equal(ORG_PLEDGE_DAYS, 365); assert.equal(ORG_REVIEW_WINDOW_DAYS, 30); assert.equal(ORG_MIDYEAR_DAY, 182); assert.equal(ORG_PLEDGE_OPTIONS, 3); assert.equal(ORG_PLEDGE_PEOPLE, 5); assert.equal(orgYearTarget(NOW), 2036);
  const ch = chaptersOf(oinp()); assert.equal(ch.length, 2, 'two org chapters from 5 people each');
  const ok = orgEligibility(ch, 7); assert.equal(ok.ok, true); assert.equal(ok.members, 7);
  const fewM = orgEligibility(ch, 4); assert.equal(fewM.ok, false); assert.ok(fewM.read_ar.includes('5 منسوبين') && fewM.read_ar.includes('4 منسوبين'), fewM.read_ar);
  const one = chaptersOf(oinp({ missions: [] })); const fewC = orgEligibility(one, 7); assert.equal(fewC.ok, false); assert.equal(fewC.chapters, 1); assert.ok(fewC.read_ar.includes('فصلين') && fewC.read_ar.includes('فصل واحد'), fewC.read_ar);
  const noK = orgEligibility(chaptersOf(oinp({ daily_first: five(200).slice(0, 4), missions: five(150).slice(0, 4) })), 7); assert.equal(noK.ok, false, 'four people never make a chapter — k=5 holds');
  const charterOnly = orgEligibility(chaptersOf(oinp({ daily_first: [], missions: [], charters: [{ signed_at: ago(300), renewed: false }, { signed_at: ago(100), renewed: true }] })), 5); assert.equal(charterOnly.ok, true, 'org-level chapters (charter) count without quorum');
  const s = localOrgScenario(ORG.name, ch, ['نبدأ اجتماعاتنا بموقف لا بتقرير'], 7, 2036);
  assert.ok(s.startsWith('في 2036 ننظر — نحن «جامعة الأمير محمد»'), s); assert.ok(s.includes('نبدأ اجتماعاتنا بموقف') && s.includes('المهام') && s.includes('7 منسوبين'), s); assert.ok(!/أنا|أنظر/.test(s), 'plural voice, not first-person singular');
  assert.equal(localOrgScenario(ORG.name, [], [], 7), '');
  assert.ok(validateOrgScenario({ scenario_ar: 'قصير' })!.includes('100')); assert.ok(validateOrgScenario({ scenario_ar: 'x'.repeat(1501) })!.includes('1500')); assert.ok(validateOrgScenario({ scenario_ar: s + ' راسلونا على a@b.co' })!.includes('بُرُد')); assert.equal(validateOrgScenario({ scenario_ar: s, source: 'local' }), null); assert.ok(validateOrgScenario({ scenario_ar: s, source: 'robot' }));
  assert.ok(validateOrgReview({ note_ar: 'قصير', decision: 'renew' })); assert.ok(validateOrgReview({ note_ar: 'تغيّر فينا أننا صرنا نبدأ بموقف لا بتقرير.', decision: 'maybe' })!.includes('renew')); assert.equal(validateOrgReview({ note_ar: 'تغيّر فينا أننا صرنا نبدأ بموقف لا بتقرير.', decision: 'archive' }), null);
});

test('p28 three steps: distinct kinds, what the org has not lived first, exactly three, yearbook always offered; a small org (<5) gets only council/yearbook; choice validation', () => {
  const ch = chaptersOf(oinp()); const o = proposeOrgPledges(ch, 7);
  assert.equal(o.length, 3); assert.equal(new Set(o.map(x => x.kind)).size, 3, 'distinct kinds');
  assert.deepEqual(o.map(x => x.kind), ['council', 'levels', 'attestations'], 'what the org has not lived yet, in order');
  assert.ok(!o.some(x => x.kind === 'missions'), 'missions already lived → not among the first three'); assert.equal(o[0].kind, 'council', 'never sat at a council → first');
  for (const x of o) { assert.ok(x.title_ar.length >= 10 && x.why_ar.length > 5 && x.target && typeof x.target === 'object', x.title_ar); assert.ok(ORG_PLEDGE_KIND_AR[x.kind], x.kind); }
  const lived = chaptersOf(oinp({ joins: five(110), returns: five(90), levels: five(80), attestations: five(70) })); const o2 = proposeOrgPledges(lived, 7);
  assert.equal(o2.length, 3); assert.equal(o2[0].kind, 'yearbook'); assert.ok(o2.some(x => x.kind === 'yearbook'), 'yearbook offered once the org has lived the rest'); assert.ok(o2.some(x => x.why_ar.includes('ثانٍ') || x.why_ar.includes('ثانية') || x.why_ar.includes('مرة أخرى') || x.why_ar.includes('الاستمرار')), JSON.stringify(o2.map(x => x.why_ar)));
  const small = proposeOrgPledges(ch, 4); assert.ok(small.length >= 1 && small.every(x => x.kind === 'council' || x.kind === 'yearbook'), 'small org: only steps that need <5 people');
  assert.ok(validateOrgPledgeChoice({ index: 7 }, o)); assert.ok(validateOrgPledgeChoice({ index: 0, title_ar: 'قصير' }, o)); assert.ok(validateOrgPledgeChoice({ index: 0, title_ar: 'x'.repeat(161) }, o)!.includes('160')); assert.ok(validateOrgPledgeChoice({ index: 0, title_ar: 'راسلونا a@b.co للعهد الجديد' }, o)!.includes('بُرُد')); assert.equal(validateOrgPledgeChoice({ index: 1, title_ar: 'خمسة منا يواجهون المواقف هذه السنة' }, o), null);
});

test('p28 path: derived from confirmed members’ events after signing only — distinct people, council needs two members in ONE council + a return, daily needs 5 people × 5 cases, yearbook needs ≥3 chapters; outsiders and pre-signing events never count', () => {
  // 5 مهمات: 4 بعد التوقيع من أشخاص متمايزين + 1 قبل التوقيع + 1 من خارج الجهة + تكرار الشخص نفسه → 4/5
  const miss = emptyPath({ missions: [...M.slice(0, 4).map((p, i) => ({ person: p, at: ago(90 - i) })), { person: M[0], at: ago(50) }, { person: M[5], at: ago(120) }, { person: 'ghost@x.sa', at: ago(40) }] });
  const pm = buildOrgPath(P('missions', { people: 5 }), miss, NOW); assert.equal(pm.steps.length, 1); assert.equal(pm.steps[0].have, 4); assert.equal(pm.complete, false); assert.ok(pm.read_ar.includes('4 منسوبين') && pm.read_ar.includes('مفتوحة'), pm.read_ar);
  miss.missions.push({ person: M[4], at: ago(10) }); const pm2 = buildOrgPath(P('missions', { people: 5 }), miss, NOW); assert.equal(pm2.complete, true); assert.equal(pm2.steps[0].at, ago(10), 'completion date = fifth distinct person'); assert.ok(pm2.read_ar.includes('وقع'), pm2.read_ar);
  assert.equal(buildOrgPath(P('missions', { people: 5 }), miss, NOW - 20 * 864e5).complete, false, 'as-of time respected');
  // مجلس: اثنان في مجالس مختلفة لا يكفي؛ اثنان في مجلس واحد + عودة من ذلك المجلس
  const c1 = emptyPath({ joins: [{ person: M[0], at: ago(80), council: 'c1' }, { person: M[1], at: ago(70), council: 'c2' }], returns: [{ person: M[0], at: ago(30), council: 'c1' }] });
  const pc1 = buildOrgPath(P('council', { members: 2, returns: 1 }), c1, NOW); assert.equal(pc1.steps.length, 2); assert.equal(pc1.steps[0].done, false, 'two councils, one person each'); assert.equal(pc1.complete, false);
  c1.joins.push({ person: M[2], at: ago(60), council: 'c1' }); const pc2 = buildOrgPath(P('council', { members: 2, returns: 1 }), c1, NOW); assert.equal(pc2.steps[0].done, true); assert.equal(pc2.steps[0].at, ago(60)); assert.equal(pc2.steps[1].done, true); assert.equal(pc2.complete, true);
  const c3 = emptyPath({ joins: [{ person: M[0], at: ago(80), council: 'c1' }, { person: M[1], at: ago(70), council: 'c1' }], returns: [{ person: M[3], at: ago(30), council: 'c9' }] }); assert.equal(buildOrgPath(P('council', { members: 2, returns: 1 }), c3, NOW).complete, false, 'return must come from the shared council');
  // مواقف: 5 أشخاص × 5 إجابات
  const daily: { person: string; at: string }[] = []; for (const p of M.slice(0, 5)) for (let i = 0; i < 5; i++) daily.push({ person: p, at: ago(90 - i) }); daily.push({ person: M[5], at: ago(5) });
  const pd = buildOrgPath(P('daily', { people: 5, per_person: 5 }), emptyPath({ daily }), NOW); assert.equal(pd.complete, true); assert.ok(pd.steps[0].detail_ar!.includes('5 منسوبين بلغوا') && pd.steps[0].detail_ar!.includes('6 منسوبين بدؤوا'), pd.steps[0].detail_ar!);
  const pd2 = buildOrgPath(P('daily', { people: 5, per_person: 5 }), emptyPath({ daily: daily.filter(d => d.person !== M[4]) }), NOW); assert.equal(pd2.steps[0].have, 4); assert.equal(pd2.complete, false);
  // مستويات/شهادات
  assert.equal(buildOrgPath(P('levels', { people: 5 }), emptyPath({ levels: five(20) }), NOW).complete, true); assert.equal(buildOrgPath(P('attestations', { people: 5 }), emptyPath({ attestations: five(120) }), NOW).complete, false, 'before signing');
  // كتاب السنة
  const yb = buildOrgPath(P('yearbook', { chapters: 3 }), emptyPath({ yearbooks: [{ at: ago(50), chapters: 2 }] }), NOW); assert.equal(yb.complete, false); assert.ok(yb.steps[0].detail_ar!.includes('أقل'), yb.steps[0].detail_ar!);
  const yb2 = buildOrgPath(P('yearbook', { chapters: 3 }), emptyPath({ yearbooks: [{ at: ago(50), chapters: 2 }, { at: ago(20), chapters: 4 }] }), NOW); assert.equal(yb2.complete, true); assert.equal(yb2.steps[0].at, ago(20));
  // أرباع + نص المراجعة بلا أسماء
  assert.ok(pm2.quarters.length >= 1 && pm2.quarters.length <= 4 && pm2.quarters[0].label.includes('الربع الأول'), JSON.stringify(pm2.quarters));
  const rt = orgReviewText(ORG.name, { title_ar: 'خمس مهمات', signed_at: ago(365) }, pm2, 2, 5, 7, 9); assert.ok(rt.includes('قبل سنة') && rt.includes('«خمس مهمات»') && rt.includes('فصلان') && rt.includes('5 فصول') && rt.includes('7 منسوبين') && rt.includes('9 منسوبين') && rt.includes('نجدّد أم نطوي'), rt); assert.ok(!rt.includes('@'));
  const mv = memberPledgeView({ id: 'x', kind: 'missions', title_ar: 'خمس مهمات', code: 'ATH-OH-AB12-CD34', signed_at: ago(10), expires_at: ago(-355), status: 'active' } as any, ORG.name); assert.deepEqual(Object.keys(mv).sort(), ['code', 'kind', 'kind_ar', 'org_name', 'review_at', 'signed_at', 'title_ar'], 'member sees title/kind/dates only — no horizon, no path');
});

test('p28 pledge document: Ed25519 kind=org_horizon in the ORG’s name, signer named by role, horizon text never inside; sign/revoke on a fake db; code ATH-OH', async () => {
  const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, SITE)!; const db = fakeDb({ portal_vc_issuances: [], portal_org_horizon_pledges: [] }); const now = new Date(NOW);
  const opt: OrgPledgeOption = { kind: 'council', title_ar: 'يجلس اثنان من منسوبينا إلى مجلس واحد ويعود أحدهما', why_ar: 'لم يجلسوا بعد', target: { members: 2, returns: 1 } };
  const r = await signOrgPledge(db, WHO, ORG, 'h1', opt, 2036, signer, SITE, DID, () => 'AB12', now); assert.ok(r.ok, 'signed'); if (!r.ok) return;
  assert.equal(r.pledge.code, 'ATH-OH-AB12-AB12'); assert.ok(r.signed_vc && r.verify_url!.includes('ATH-OH-AB12-AB12')); assert.equal(r.pledge.organization_id, ORG.id); assert.equal(r.pledge.signed_email, 'admin@upm.edu.sa'); assert.equal(r.pledge.status, 'active'); assert.equal(r.pledge.expires_at, new Date(NOW + 365 * 864e5).toISOString()); assert.equal(r.pledge.meta.signer_name, 'أحمد');
  const vcRow = db.T.portal_vc_issuances[0]; assert.equal(vcRow.kind, 'org_horizon'); assert.equal(vcRow.full_name, ORG.name); assert.ok(vcRow.title_ar.startsWith('عهد الجهة')); const vc = vcRow.vc;
  assert.equal(vc.credentialSubject.name, ORG.name); assert.equal(vc._athar.kind, 'org_horizon'); assert.equal(vc._athar.org_id, ORG.id); assert.equal(vc._athar.signed_by, 'أحمد'); assert.equal(vc._athar.pledge.kind, 'council'); assert.ok(vc.credentialSubject.result.some((x: any) => x.resultDescription === 'signed_by_role' && x.value === 'org_admin'));
  assert.ok(!JSON.stringify(vc).includes('scenario') && !JSON.stringify(vc).includes('نحن في'), 'the horizon never enters the document');
  assert.equal(structuralChecks(vc, now).filter(c => !c.ok).length, 0, 'W3C/OB3 structure'); assert.equal((await verifySignature(vc, localResolver(signer, []))).ok, true, 'Ed25519 verifies');
  const doc = buildOrgPledgeDoc({ code: 'ATH-OH-X', orgName: ORG.name, signerName: 'أحمد', option: opt, year: 2036, site: SITE, did: DID, expires: ago(-365), statusIndex: null, orgId: ORG.id }); assert.ok(!('credentialStatus' in doc) && doc.credentialSubject.achievement.id.endsWith('/org?tab=horizon'));
  const nosig = await signOrgPledge(fakeDb({ portal_org_horizon_pledges: [] }), WHO, ORG, 'h1', opt, 2036, null, SITE, DID, () => 'CD34', now); assert.ok(nosig.ok && !nosig.signed_vc && nosig.verify_url === null, 'no key → saved without a document');
  const rv = await revokeOrgPledge(db, ORG.id, r.pledge.id, now); assert.equal(rv.ok, true); assert.equal(db.T.portal_org_horizon_pledges[0].status, 'revoked'); assert.ok(vcRow.revoked_at); assert.equal((await revokeOrgPledge(db, ORG.id, r.pledge.id, now)).ok, false, 'twice → not active');
  assert.equal((await revokeOrgPledge(db, '00000000-0000-4000-8000-000000000022', r.pledge.id, now)).ok, false, 'another org cannot revoke');
  assert.ok(/^ATH-OH-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(orgPledgeCode(() => 'Z9Z9')));
});

test('p28 cron: opens the org review on day 365 for org admins (one message each), nudges once at day 182, auto-archives after 30 days, resets a horizon whose pledge vanished; dry run writes nothing', async () => {
  const H = (o: any) => ({ organization_id: ORG.id, org_name: ORG.name, written_by: WHO.id, written_email: WHO.email, year_target: 2036, scenario_ar: 'نحن…', scenario_source: 'own', status: 'active', activated_at: ago(365), review_at: ago(0), reviewed_at: null, decision: null, options: [], meta: { chapters_then: 2, members_then: 7 }, ...o });
  const admins = [{ organization_id: ORG.id, email: 'a1@upm.edu.sa', full_name: 'أ', role: 'org_admin', status: 'confirmed' }, { organization_id: ORG.id, email: 'a2@upm.edu.sa', full_name: 'ب', role: 'org_admin', status: 'confirmed' }, ...M.map(e => ({ organization_id: ORG.id, email: e, full_name: null, role: 'learner', status: 'confirmed' }))];
  const mk = () => fakeDb({ portal_org_horizons: [H({}), H({ activated_at: ago(200), review_at: ago(-165) }), H({ status: 'review', review_at: ago(40) }), H({ activated_at: ago(100), review_at: ago(-265) }), H({ review_at: ago(1), meta: { orphan: true } })], portal_org_horizon_pledges: [{ horizon_id: 1, organization_id: ORG.id, org_name: ORG.name, kind: 'missions', title_ar: 'خمس مهمات', target: { people: 5 }, code: 'ATH-OH-1', signed_at: ago(365), expires_at: ago(0), status: 'active', meta: {} }, { horizon_id: 2, organization_id: ORG.id, org_name: ORG.name, kind: 'levels', title_ar: 'خمسة مستويات', target: { people: 5 }, code: 'ATH-OH-2', signed_at: ago(200), expires_at: ago(-165), status: 'active', meta: {} }, { horizon_id: 3, organization_id: ORG.id, org_name: ORG.name, kind: 'daily', title_ar: 'مواقف', target: { people: 5 }, code: 'ATH-OH-3', signed_at: ago(405), expires_at: ago(40), status: 'active', meta: {} }], portal_org_members: admins, portal_missions: M.slice(0, 5).map(e => ({ email: e, confirmed_at: ago(30), skills: [] })), portal_message_log: [], portal_notification_prefs: [], portal_org_journey_shares: [] });
  const dry = mk(); const d = await runOrgHorizon(dry, { dry: true, site: SITE, now: new Date(NOW) }); assert.deepEqual([d.opened, d.nudged, d.archived], [1, 1, 1]); assert.equal(dry.T.portal_org_horizons[0].status, 'active', 'dry run: untouched'); assert.equal(dry.T.portal_message_log.length, 0);
  const db = mk(); const r = await runOrgHorizon(db, { site: SITE, now: new Date(NOW) }); assert.equal(r.ok, true, r.errors.join('; ')); assert.deepEqual([r.opened, r.nudged, r.archived], [1, 1, 1]);
  const h1 = db.T.portal_org_horizons[0]; assert.equal(h1.status, 'review'); assert.ok(h1.meta.review_text.includes('«خمس مهمات»') && h1.meta.review_text.includes('وقع'), h1.meta.review_text); assert.equal(h1.meta.path_at_review.complete, true, '5 distinct members confirmed missions after signing'); assert.equal(h1.meta.members_now, 9);
  const logs = db.T.portal_message_log; assert.equal(logs.filter((l: any) => l.kind === 'org_horizon_review').length, 2, 'one review message per org admin — members are not messaged'); assert.ok(logs.every((l: any) => !M.includes(l.to_email)), 'learners never receive the review');
  assert.equal(logs.filter((l: any) => l.kind === 'org_horizon_midyear').length, 2); assert.ok(db.T.portal_org_horizons[1].meta.nudged_at);
  assert.equal(db.T.portal_org_horizons[2].status, 'archived'); assert.equal(db.T.portal_org_horizons[2].decision, 'archive'); assert.equal(db.T.portal_org_horizon_pledges[2].status, 'expired');
  assert.equal(db.T.portal_org_horizons[3].status, 'active', 'day 100: nothing yet'); assert.equal(db.T.portal_org_horizons[4].status, 'draft', 'pledge vanished → back to draft');
  const again = await runOrgHorizon(db, { site: SITE, now: new Date(NOW + 864e5) }); assert.deepEqual([again.opened, again.nudged, again.archived], [0, 0, 0], 'idempotent next day'); assert.equal(db.T.portal_message_log.length, 4);
});

test('p28 org journey: «عهد الجهة» becomes an org-level chapter (no quorum) at signing and at review; revoked pledges never appear; arc mentions it; kind label exists', () => {
  const ch = orgPledgeChapters([{ signed_at: ago(300), title_ar: 'خمس مهمات', kind: 'missions', status: 'reviewed', reviewed_at: ago(-65), decision: 'renew', complete: true, note_ar: 'صرنا نبدأ بموقف' }, { signed_at: ago(100), title_ar: 'مجلس', kind: 'council', status: 'revoked', reviewed_at: null, decision: null, complete: null, note_ar: null }, { signed_at: ago(10), title_ar: 'كتاب سنتنا', kind: 'yearbook', status: 'active', reviewed_at: null, decision: null, complete: null, note_ar: null }], quarterOf);
  assert.equal(ch.length, 3, 'signed + reviewed for the first, signed for the third, nothing for the revoked'); assert.ok(ch.every(c => c.kind === 'org_pledge' && c.people === null)); assert.ok(ch[1].title_ar.includes('جدّدت') && ch[1].what_ar.includes('وقع') && ch[1].note_ar === 'صرنا نبدأ بموقف', JSON.stringify(ch[1]));
  assert.ok(ch[0].what_ar.includes('«خمس مهمات»') && ch[0].what_ar.includes(ORG_PLEDGE_KIND_AR.missions), ch[0].what_ar); assert.equal(ORG_KIND_AR.org_pledge, 'عهد الجهة');
  const j = buildOrgJourney(oinp({ org_pledge_chapters: ch }), NOW); assert.equal(j.chapters.filter(c => c.kind === 'org_pledge').length, 3); assert.ok(j.arc_ar.includes('عاهدت نفسها'), j.arc_ar); assert.ok(j.chapters.every((c, i, a) => i === 0 || a[i - 1].at <= c.at), 'sorted by time');
  const alone = orgEligibility(j.chapters.filter(c => c.kind === 'org_pledge') as OrgChapter[], 7); assert.equal(alone.ok, true, 'org-level chapters count toward eligibility');
});

test('p28 vault + MCP: both org horizon tables registered (org-owned, anonymize, writer/signer named by role); vc kind list grows to 9; no new MCP tool', () => {
  const h = REGISTRY.find(r => r.table === 'portal_org_horizons')!; const p = REGISTRY.find(r => r.table === 'portal_org_horizon_pledges')!;
  assert.ok(h && p, 'registered'); assert.equal(h.policy, 'anonymize'); assert.equal(p.policy, 'anonymize'); assert.deepEqual(h.access, ['org']); assert.equal(h.userCol, 'written_by'); assert.equal(p.userCol, 'signed_by'); assert.deepEqual(p.piiCols, ['signed_email']); assert.ok(h.label_ar.includes('بصفتي مدير جهة'));
  const plan = erasurePlan(); assert.ok(plan.anonymize.some(x => x.table === 'portal_org_horizons') && plan.anonymize.some(x => x.table === 'portal_org_horizon_pledges'), 'erasure plan anonymizes, never deletes org pledges'); assert.ok(!plan.delete.some(x => x.table === 'portal_org_horizon_pledges'));
  assert.equal(new Set(REGISTRY.map(r => r.table)).size, REGISTRY.length, 'no duplicate table');
  assert.ok(!ALL_MCP_TOOLS.some(t => /org_horizon/.test(t.name)), 'P28 adds no MCP tool — org pledges stay inside the org (org_yearbook remains the public window)');
});
