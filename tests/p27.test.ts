// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P27 — «أفق الممارس»: الأهلية (3 فصول) · المسودة المحلية من الفصول وكلمات الشخص · المهمات الثلاث (أنواع متمايزة · ما لم يُعَش أولًا · مستوى أعلى بواحد)
//                 · الدرب يُشتق من الأحداث بعد التوقيع فقط (مجلس 3 خطوات · 20 يومًا متمايزًا · مستوى · مهمة · شهادة قرين) · وثيقة Ed25519 kind=horizon بلا نص الأفق وبلا بريد · السحب
//                 · الكرون: فتح المراجعة في اليوم 365 · تذكير 182 مرة واحدة · طيّ بعد 30 يومًا · فصول «أفقي» في رحلة الممارس من الأحداث · فصل «عهود مع النفس» في رحلة الجهة (k=5) · الخزنة جدولان (حذف) · MCP my_horizon
import test from 'node:test';
import assert from 'node:assert/strict';
import { HORIZON_MIN_CHAPTERS, HORIZON_YEARS, PLEDGE_DAYS, REVIEW_WINDOW_DAYS, MIDYEAR_DAY, DAILY_PLEDGE_DAYS, PLEDGE_OPTIONS, eligibility, localScenario, validateScenario, proposePledges, validatePledgeChoice, validateReview, buildPath, reviewText, horizonSummary, yearTarget, addDays, pledgeCode } from '../lib/horizon/registry';
import type { Pledge, Horizon } from '../lib/horizon/registry';
import { buildPledgeDoc, signPledge, revokePledge } from '../lib/horizon/pledge';
import { runHorizon } from '../lib/horizon/cron';
import { buildChapters, buildJourney } from '../lib/journey/registry';
import type { JourneyInput, Chapter } from '../lib/journey/registry';
import { buildOrgChapters, ORG_KIND_AR } from '../lib/org-journey/registry';
import { REGISTRY, erasurePlan } from '../lib/vault/registry';
import { ALL_MCP_TOOLS, toolsFor } from '../lib/portal/mcp';
import { signerFromEnv, verifySignature, localResolver } from '../lib/portal/vc-server';
import { structuralChecks } from '../lib/portal/vc';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const SITE = 'https://athar-portal.vercel.app'; const DID = 'did:web:athar-portal.vercel.app';
const NOW = new Date('2026-10-30T08:00:00Z').getTime(); const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const ME = { id: '00000000-0000-4000-8000-000000000001', email: 'Admin@upm.edu.sa', name: 'أحمد' };
const SK = { id: '00000000-0000-4000-8000-000000000a01', name: 'التيسير' };

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

/** مدخلات رحلة: 3 فصول (أول موقف · مهمة مؤكَّدة · مستوى 3 معتمد) — أهلٌ للأفق */
function inp(over: Partial<JourneyInput> = {}): JourneyInput {
  return {
    events: [], daily: [{ created_at: ago(200), response: 'أصغيتُ أولًا ثم سألتُ عمّا لم يُقل.', band: 'capable', score: 3, case_title: 'اجتماع متوتر' }],
    sims: [], missions: [{ id: 'm1', title_ar: 'ورشة داخلية', confirmed_at: ago(150), submitted_at: ago(155), status: 'confirmed', skills: [SK.id] }],
    memberships: [], cases: [], attestations: [], levels: [{ skill_id: SK.id, approved_level: 3, approved_at: ago(100), computed_level: 3.4 }], credentials: [], skills: { [SK.id]: SK.name }, ...over,
  };
}

test('p27 eligibility + local scenario + validators: no horizon before 3 real chapters; the draft is first-person, future-tense, from own words only', () => {
  assert.equal(HORIZON_MIN_CHAPTERS, 3); assert.equal(HORIZON_YEARS, 10); assert.equal(PLEDGE_DAYS, 365); assert.equal(REVIEW_WINDOW_DAYS, 30); assert.equal(PLEDGE_OPTIONS, 3); assert.equal(yearTarget(NOW), 2036);
  const few = buildChapters(inp({ missions: [], levels: [] })); const e0 = eligibility(few); assert.equal(e0.ok, false); assert.equal(e0.chapters, 1); assert.ok(e0.read_ar.includes('فصل واحد'), e0.read_ar);
  const ch = buildChapters(inp()); const e1 = eligibility(ch); assert.equal(e1.ok, true, 'ثلاثة فصول: ' + ch.map(c => c.key).join(','));
  const s = localScenario(ch, ['أصغيتُ أولًا ثم سألتُ عمّا لم يُقل.'], 2036);
  assert.ok(s.startsWith('في 2036 أنظر إلى الوراء'), s); assert.ok(s.includes('التيسير') && s.includes('مستواي 3'), 'من المستوى المعتمد'); assert.ok(s.includes('«أصغيتُ أولًا'), 'من كلماته'); assert.ok(s.includes('عهد واحد في كل سنة')); assert.ok(s.length <= 1200);
  assert.equal(localScenario([], [], 2036), '');
  assert.ok(validateScenario({ scenario_ar: 'قصير' })!.includes('80')); assert.equal(validateScenario({ scenario_ar: s, source: 'local' }), null); assert.ok(validateScenario({ scenario_ar: 'x'.repeat(1300) })!.includes('1200')); assert.ok(validateScenario({ scenario_ar: s, source: 'robot' }));
  assert.ok(validateReview({ note_ar: 'قصير', decision: 'renew' })!.includes('20')); assert.ok(validateReview({ note_ar: 'تغيّر فيّ أنني صرتُ أسأل قبل أن أجيب.', decision: 'later' })!.includes('renew')); assert.equal(validateReview({ note_ar: 'تغيّر فيّ أنني صرتُ أسأل قبل أن أجيب.', decision: 'archive' }), null);
});

test('p27 three pledges: distinct kinds, what was never lived comes first, level = approved + 1 on the highest sub-5 skill, exactly three, choice validation', () => {
  const i = inp(); const ch = buildChapters(i); const opts = proposePledges(ch, i);
  assert.equal(opts.length, 3, 'ثلاث خطوات'); assert.equal(new Set(opts.map(o => o.kind)).size, 3, 'أنواع متمايزة');
  assert.equal(opts[0].kind, 'council', 'لم يجلس إلى مجلس → أولًا'); assert.ok(opts[0].title_ar.includes('أنضم') && opts[0].target.steps === 3);
  const lv = opts.find(o => o.kind === 'level')!; assert.ok(lv, 'خيار المستوى'); assert.equal(lv.target.to, 4); assert.equal(lv.target.from, 3); assert.equal(lv.target.skill_ar, SK.name); assert.ok(lv.title_ar.includes('من 3 إلى 4'));
  assert.ok(!opts.some(o => o.kind === 'mission'), 'المهمة عاشها → ليست من الثلاث الأولى');
  // بلا مستوى وبلا شيء: مجلس · مهمة · شهادة قرين (ثم اليومي رابعًا)
  const bare = proposePledges([], { levels: [], skills: {} }); assert.deepEqual(bare.map(o => o.kind), ['council', 'mission', 'credential']);
  // عاش كل شيء: عودة ثانية · مهمة ثانية · 20 يومًا
  const all: Chapter[] = ['council', 'return', 'mission', 'attestation'].map(k => ({ key: k, kind: k as any, at: ago(10), title_ar: k, what_ar: '', quote_ar: null, level: null, ref: null, public_ok: true }));
  const rich = proposePledges(all, { levels: [{ skill_id: SK.id, approved_level: 5, approved_at: ago(1), computed_level: 5 }], skills: {} }); assert.deepEqual(rich.map(o => o.kind), ['daily', 'mission', 'council']); assert.equal(rich[0].target.days, DAILY_PLEDGE_DAYS);
  assert.ok(validatePledgeChoice({ index: 7 }, opts)!.includes('اختر')); assert.ok(validatePledgeChoice({ index: 0, title_ar: 'قصير' }, opts)); assert.ok(validatePledgeChoice({ index: 0, title_ar: 'راسلني على me@x.com' }, opts)!.includes('بُرُد')); assert.equal(validatePledgeChoice({ index: '1', title_ar: 'أعود إلى مجلسي بما حدث فعلًا' }, opts), null);
});

test('p27 path: derived only from events after signing — council 3 steps, 20 distinct days, level reached, mission confirmed, attestation; quarterly mirror; review text without judgement', () => {
  const signed = ago(100);
  // مجلس: انضمام قبل العهد يُحتسب كخطوة «كنتَ عضوًا» · قضية وعودة بعد العهد
  const i = inp({ memberships: [{ council_id: 'c1', council_title: 'مجلس التيسير', joined_at: ago(300), status: 'active' }], cases: [{ id: 'k1', created_at: ago(60), title_ar: 'اجتماع صعب', commitment_ar: 'سأصغي', committed_at: ago(58), return_ar: 'نجح', return_outcome: 'succeeded', returned_at: ago(40), theme: 'conflict' }, { id: 'k0', created_at: ago(200), title_ar: 'قديمة', commitment_ar: null, committed_at: null, return_ar: null, return_outcome: null, returned_at: ago(190), theme: null }] });
  const pc = buildPath({ kind: 'council', target: { steps: 3 }, signed_at: signed }, i, NOW);
  assert.equal(pc.steps.length, 3); assert.ok(pc.steps[0].done && pc.steps[0].detail_ar!.includes('قبل العهد')); assert.ok(pc.steps[1].done && pc.steps[1].detail_ar!.includes('اجتماع صعب'), 'القضية القديمة لا تُحتسب'); assert.ok(pc.steps[2].done && pc.steps[2].detail_ar!.includes('نجحتُ')); assert.equal(pc.complete, true); assert.ok(pc.read_ar.includes('وقع'));
  assert.equal(pc.quarters.length, 2, 'ربعان منذ العهد (100 يوم)'); assert.ok(pc.quarters[0].text_ar.includes('حمل موقف') || pc.quarters[1].text_ar.includes('حمل موقف'));
  // يومي: 25 ردًّا في 12 يومًا متمايزًا بعد العهد + 30 قبله
  const daily = [...Array.from({ length: 25 }, (_, k) => ({ created_at: new Date(NOW - (k % 12) * 864e5 - 3600e3 * (k % 3)).toISOString(), response: 'x', band: null, score: null, case_title: null })), ...Array.from({ length: 30 }, (_, k) => ({ created_at: ago(120 + k), response: 'x', band: null, score: null, case_title: null }))];
  const pd = buildPath({ kind: 'daily', target: { days: 20 }, signed_at: signed }, inp({ daily }), NOW); assert.equal(pd.complete, false); assert.ok(pd.steps[0].label_ar.includes('12 من 20'), pd.steps[0].label_ar); assert.ok(pd.read_ar.includes('0 من 1') === false && pd.read_ar.includes('لم يقع'), pd.read_ar);
  // مستوى: اعتماد 4 قبل العهد لا يكفي؛ بعده يكفي
  const pl0 = buildPath({ kind: 'level', target: { skill_id: SK.id, skill_ar: SK.name, to: 4 }, signed_at: signed }, inp({ levels: [{ skill_id: SK.id, approved_level: 4, approved_at: ago(150), computed_level: 4 }] }), NOW); assert.equal(pl0.complete, false); assert.ok(pl0.steps[0].detail_ar!.includes('المعتمد 4'));
  const pl1 = buildPath({ kind: 'level', target: { skill_id: SK.id, skill_ar: SK.name, to: 4 }, signed_at: signed }, inp({ levels: [{ skill_id: SK.id, approved_level: 4, approved_at: ago(20), computed_level: 4 }] }), NOW); assert.equal(pl1.complete, true);
  // مهمة: مسلَّمة بلا تأكيد = خطوة أولى فقط
  const pm = buildPath({ kind: 'mission', target: { count: 1 }, signed_at: signed }, inp({ missions: [{ id: 'm2', title_ar: 'جديدة', confirmed_at: null, submitted_at: ago(5), status: 'submitted', skills: [] }, { id: 'm1', title_ar: 'قديمة', confirmed_at: ago(150), submitted_at: ago(155), status: 'confirmed', skills: [] }] }), NOW); assert.equal(pm.steps[0].done, true); assert.equal(pm.steps[1].done, false); assert.equal(pm.complete, false); assert.ok(pm.read_ar.includes('1 من 2'));
  // شهادة قرين
  const pa = buildPath({ kind: 'credential', target: { count: 1 }, signed_at: signed }, inp({ attestations: [{ created_at: ago(30), decided_at: ago(25), status: 'approved', skill_id: SK.id }] }), NOW); assert.equal(pa.complete, true); assert.ok(pa.steps[0].detail_ar!.includes(SK.name));
  const t = reviewText('أحمد', { title_ar: 'أعود بما حدث', signed_at: signed }, pc, 3, 7); assert.ok(t.includes('أحمد،') && t.includes('«أعود بما حدث»') && t.includes('3 فصلًا، واليوم 7') && t.includes('ليس فشلًا'), t);
  const sum = horizonSummary({ status: 'active', year_target: 2036, scenario_ar: 'سرّي جدًا', review_at: ago(-265) } as any, { kind: 'council', title_ar: 'أعود', code: 'ATH-HZ-AAAA-BBBB', signed_at: signed, expires_at: ago(-265), status: 'active' } as any, pc, { ok: true, chapters: 3, min: 3 });
  assert.ok(!JSON.stringify(sum).includes('سرّي'), 'الملخص لا يحمل نص الأفق'); assert.equal(sum.scenario_chars, 9); assert.equal(sum.pledge!.kind_ar, 'مجلس أقران'); assert.equal(sum.path!.complete, true);
});

test('p27 pledge document: Ed25519 kind=horizon verifies, carries pledge title/kind/review date only (no horizon text, no email), 365 d, revoke kills VC; second pledge impossible while active is the route rule', async () => {
  const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, SITE)!; const db = fakeDb({ portal_vc_issuances: [], portal_horizon_pledges: [], portal_learning_events: [] }); const now = new Date(NOW);
  const opt = { kind: 'council' as const, title_ar: 'أنضم إلى مجلس أقران وأعود بما حدث', why_ar: 'لم تجلس بعد', target: { steps: 3 } };
  const r = await signPledge(db, ME, 'h1', opt, 2036, signer, SITE, DID, () => 'AB12', now); assert.ok(r.ok, 'توقيع'); if (!r.ok) return;
  assert.equal(r.pledge.code, 'ATH-HZ-AB12-AB12'); assert.equal(r.pledge.expires_at, addDays(now, PLEDGE_DAYS)); assert.equal(r.pledge.status, 'active'); assert.equal(r.signed_vc, true); assert.equal(r.verify_url, `${SITE}/verify/vc?code=ATH-HZ-AB12-AB12`);
  const iss = db.T.portal_vc_issuances[0]; assert.equal(iss.kind, 'horizon'); assert.equal(iss.email, 'admin@upm.edu.sa'); const vc = iss.vc;
  assert.equal(vc._athar.kind, 'horizon'); assert.equal(vc._athar.pledge.title_ar, opt.title_ar); assert.equal(vc._athar.year_target, 2036); assert.equal(vc.credentialSubject.name, 'أحمد'); assert.ok(vc.credentialStatus); assert.ok(vc.credentialSubject.result.some((x: any) => x.resultDescription === 'review_at'));
  const txt = JSON.stringify(vc); assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(txt), 'لا بريد'); assert.ok(!txt.includes('scenario'), 'لا نص أفق');
  assert.ok(structuralChecks(vc, now).every(c => c.ok), JSON.stringify(structuralChecks(vc, now).filter(c => !c.ok))); assert.equal((await verifySignature(vc, localResolver(signer, []))).ok, true);
  assert.ok(!buildPledgeDoc({ code: 'ATH-HZ-ZZZZ-ZZZZ', name: 'x', option: opt, year: 2036, site: SITE, did: DID, now, expires: r.pledge.expires_at!, statusIndex: null }).credentialStatus);
  assert.equal(db.T.portal_learning_events[0].verb, 'pledged'); assert.equal(db.T.portal_learning_events[0].object_type, 'horizon');
  const rv = await revokePledge(db, ME, r.pledge.id, now); assert.ok(rv.ok); assert.equal(db.T.portal_horizon_pledges[0].status, 'revoked'); assert.ok(iss.revoked_at, 'الوثيقة أُلغيت'); assert.equal((await revokePledge(db, ME, r.pledge.id, now)).ok, false, 'لا سحب مرتين');
  assert.equal((await revokePledge(db, { id: 'someone-else' }, r.pledge.id, now)).ok, false, 'ليس عهده');
  const nosig = await signPledge(fakeDb({ portal_horizon_pledges: [] }), ME, 'h1', opt, 2036, null, SITE, DID, () => 'CD34', now); assert.ok(nosig.ok && !nosig.signed_vc && nosig.verify_url === null, 'بلا مفتاح: يُحفظ العهد بلا وثيقة');
  assert.match(pledgeCode(() => 'Q1W2'), /^ATH-HZ-Q1W2-Q1W2$/);
});

test('p27 cron: opens the review on day 365 (once, with text + event), nudges once at day 182, auto-archives reviews idle for 30 days; dry run counts only', async () => {
  const H = (o: Partial<Horizon>): any => ({ user_id: ME.id, email: 'admin@upm.edu.sa', full_name: 'أحمد', year_target: 2036, scenario_ar: 'x'.repeat(100), scenario_source: 'own', status: 'active', activated_at: ago(365), review_at: ago(0), reviewed_at: null, review_note_ar: null, decision: null, options: [], meta: { chapters_then: 2 }, ...o });
  const pl = (hid: any): any => ({ horizon_id: hid, user_id: ME.id, email: 'admin@upm.edu.sa', kind: 'daily', title_ar: 'عشرون موقفًا', target: { days: 20 }, code: 'ATH-HZ-AAAA-AAAA', signed_at: ago(365), expires_at: ago(0), status: 'active', vc_issuance_id: null, meta: {} });
  const db = fakeDb({ portal_horizons: [H({}), H({ activated_at: ago(200), review_at: ago(-165) }), H({ status: 'review', review_at: ago(40) }), H({ activated_at: ago(100), review_at: ago(-265) })], portal_horizon_pledges: [], portal_message_log: [], portal_notification_prefs: [], portal_contact_prefs: [], portal_learning_events: [], portal_daily_case_responses: [] });
  for (const h of db.T.portal_horizons) db.T.portal_horizon_pledges.push({ id: `p${h.id}`, ...pl(h.id) });
  const dry = await runHorizon(db, { dry: true, site: SITE, now: new Date(NOW) }); assert.deepEqual([dry.opened, dry.nudged, dry.archived], [1, 1, 1], JSON.stringify(dry)); assert.equal(db.T.portal_horizons[0].status, 'active', 'dry لا يغيّر');
  const live = await runHorizon(db, { site: SITE, now: new Date(NOW) }); assert.equal(live.errors.length, 0, live.errors.join(' | ')); assert.deepEqual([live.opened, live.nudged, live.archived], [1, 1, 1]);
  const h0 = db.T.portal_horizons[0]; assert.equal(h0.status, 'review'); assert.ok(h0.meta.review_text.includes('«عشرون موقفًا»') && h0.meta.review_text.includes('2 فصلًا'), h0.meta.review_text); assert.ok(h0.meta.review_opened_at);
  assert.ok(db.T.portal_horizons[1].meta.nudged_at, 'تذكير منتصف السنة'); assert.equal(db.T.portal_horizons[1].status, 'active');
  assert.equal(db.T.portal_horizons[2].status, 'archived'); assert.equal(db.T.portal_horizons[2].decision, 'archive'); assert.equal(db.T.portal_horizon_pledges[2].status, 'expired', 'عهد المراجعة المطوية ينتهي');
  assert.equal(db.T.portal_horizons[3].status, 'active', 'عهد عمره 100 يوم: لا شيء');
  assert.ok(db.T.portal_message_log.some((m: any) => m.kind === 'horizon_review') && db.T.portal_message_log.some((m: any) => m.kind === 'horizon_midyear'), 'رسالتان بالقنوات القائمة');
  assert.ok(db.T.portal_learning_events.some((e: any) => e.verb === 'review_opened' && e.object_type === 'horizon'));
  const again = await runHorizon(db, { site: SITE, now: new Date(NOW) }); assert.deepEqual([again.opened, again.nudged, again.archived], [0, 0, 0], 'لا تكرار');
});

test('p27 integration: horizon chapters in the practitioner journey come from events (pledged/reviewed, own words quoted); org journey counts pledges with k=5; vault 2 tables (delete); MCP my_horizon personal read-only', () => {
  const i = inp({ events: [
    { at: ago(90), verb: 'pledged', object_type: 'horizon', object_id: 'h1', skills: [], context: { code: 'ATH-HZ-AAAA-BBBB', kind: 'council' } },
    { at: ago(1), verb: 'reviewed', object_type: 'horizon', object_id: 'h1', skills: [], context: { decision: 'renew', complete: true, title: 'أعود بما حدث', note_ar: 'صرتُ أسأل قبل أن أجيب.' } },
    { at: ago(50), verb: 'wrote', object_type: 'horizon', object_id: 'h1', skills: [], context: {} },
  ] });
  const j = buildJourney(i, NOW); const hz = j.chapters.filter(c => c.kind === 'horizon'); assert.equal(hz.length, 2, 'عهد + مراجعة (الكتابة ليست فصلًا)'); assert.equal(j.counts.horizon, 2);
  assert.equal(hz[0].key, 'horizon_pledged:h1'); assert.ok(hz[0].what_ar.includes('مجلس أقران') && hz[0].what_ar.includes('ATH-HZ-AAAA-BBBB'));
  assert.equal(hz[1].title_ar, 'راجعتُ عهدي وجدّدتُ أفقي'); assert.equal(hz[1].quote_ar, 'صرتُ أسأل قبل أن أجيب.'); assert.ok(hz[1].what_ar.includes('بشهادة الأحداث')); assert.ok(j.arc_ar.includes('عهد مع نفسك'));
  const P = (n: number) => `p${n}@moe.gov.sa`; const org = buildOrgChapters({ members: Array.from({ length: 8 }, (_, k) => P(k)), daily_first: [], missions: [], joins: [], returns: [], attestations: [], levels: [], credentials: [], charters: [], twinnings: [], contracts: [], pledges: Array.from({ length: 5 }, (_, k) => ({ person: P(k), at: ago(10 + k) })) });
  assert.equal(org.chapters.length, 1); assert.equal(org.chapters[0].kind, 'pledge'); assert.equal(org.chapters[0].people, 5); assert.ok(org.chapters[0].title_ar.includes('عاهدوا أنفسهم')); assert.ok(org.chapters[0].what_ar.includes('العدد فقط')); assert.equal(ORG_KIND_AR.pledge, 'عهود مع النفس');
  const four = buildOrgChapters({ members: [P(0), P(1), P(2), P(3), P(4)], daily_first: [], missions: [], joins: [], returns: [], attestations: [], levels: [], credentials: [], charters: [], twinnings: [], contracts: [], pledges: Array.from({ length: 4 }, (_, k) => ({ person: P(k), at: ago(10) })) }); assert.equal(four.chapters.length, 0); assert.equal(four.below[0].people, 4);
  for (const t of ['portal_horizons', 'portal_horizon_pledges']) { const e = REGISTRY.find(x => x.table === t)!; assert.ok(e, t); assert.equal(e.policy, 'delete'); assert.ok(e.access.includes('self')); }
  assert.ok(erasurePlan().delete.some(x => x.table === 'portal_horizons')); assert.equal(new Set(REGISTRY.map(r => r.table)).size, REGISTRY.length);
  const tool = ALL_MCP_TOOLS.find(x => x.name === 'my_horizon')!; assert.ok(tool); assert.equal(tool.kind, 'personal'); assert.equal(tool.pscope, 'wallet:read'); assert.equal(tool.annotations.readOnlyHint, true); assert.ok(!toolsFor('anon').some(x => x.name === 'my_horizon'), 'ليست عامة'); assert.ok(toolsFor('personal', ['wallet:read']).some(x => x.name === 'my_horizon')); assert.ok(tool.description.includes('/me/horizon'));
});
