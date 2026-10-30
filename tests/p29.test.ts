// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P29 — «العهد المتقابل»: الأهلية (3 فصول لكل طرف) · الدعوة (بريد · لماذا 20–300 · لا أدعو نفسي) · الدائرة (مجلس مشترك ثم جهة واحدة وإلا لا شيء)
//                 · الدعوة العمياء لا تظهر للمدعوّ وتظهر للداعي · الاقتراح من خيارات المنصة فقط · التوقيع · الوثيقة الواحدة بحاملَين (kind=pair_pledge · بلا بُرُد · Ed25519 تتحقق)
//                 · حالة خطوة صاحبي (وقعت / لم تقع) · المرآة بلا حكم · كلمات المراجعة تُفتح بعد كلماتي · قرار مشترك (renew فقط إن اتفقا) · السحب يسحب الوثيقة
//                 · الكرون: انقضاء 14 يومًا · «خطوة صاحبك وقعت» مرة واحدة · منتصف السنة مرة · فتح المراجعة 365 · طيّ بعد 30 يومًا · فصول «عهد متقابل» في رحلتي بلا اسم · «عهود متقابلة» في رحلة الجهة بنصاب 5 · الخزنة · MCP
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAIR_MIN_CHAPTERS, PAIR_INVITE_DAYS, PAIR_PLEDGE_DAYS, PAIR_MIDYEAR_DAY, PAIR_REVIEW_WINDOW_DAYS, PAIR_CODE_PREFIX, pairEligibility, validateInvite, validateProposal, validateSign, validatePairReview, sideOf, nameFor, viewFor, stepState, quarterLabel, pairMirror, pairReviewText, jointDecision, inviteExpired, reviewOpen, meetsHorizon, pairSummary, pairCode, addDays } from '../lib/pair/registry';
import type { Pair, PairStep } from '../lib/pair/registry';
import { findCircle, loadMyPairs, splitPairs, resolvePerson, partnerState } from '../lib/pair/load';
import { buildPairDoc, activatePair, revokePair } from '../lib/pair/pledge';
import { runPair } from '../lib/pair/cron';
import { buildChapters, buildJourney } from '../lib/journey/registry';
import type { JourneyInput, Chapter } from '../lib/journey/registry';
import { buildOrgChapters, ORG_KIND_AR } from '../lib/org-journey/registry';
import { REGISTRY, erasurePlan } from '../lib/vault/registry';
import { ALL_MCP_TOOLS } from '../lib/portal/mcp';
import { signerFromEnv, verifySignature, localResolver } from '../lib/portal/vc-server';
import { structuralChecks } from '../lib/portal/vc';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const SITE = 'https://athar-portal.vercel.app'; const DID = 'did:web:athar-portal.vercel.app';
const NOW = new Date('2026-10-30T08:00:00Z').getTime(); const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const A = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ahmed@athar.university', name: 'أحمد بدوي' };
const B = { id: '00000000-0000-4000-8000-0000000000b2', email: 'Noura@athar.university', name: 'نورة الشهري' };
const C1 = '00000000-0000-4000-8000-0000000000c1'; const ORG = '00000000-0000-4000-8000-000000000021';

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
const chapter = (i: number, kind: Chapter['kind'] = 'daily'): Chapter => ({ key: `c${i}`, kind, at: ago(100 - i), title_ar: `فصل ${i}`, what_ar: '', quote_ar: null, level: null, ref: null, public_ok: true });
const stepA: PairStep = { kind: 'mission', title_ar: 'مهمة واحدة يؤكّدها مشرفي من قلب العمل', why_ar: 'لأنني رأيتك تنقل ما تتعلمه إلى فريقك فعلًا', target: { count: 1 }, proposed_by: 'b', proposed_at: ago(366), accepted_at: ago(366), rework: 0 };
const stepB: PairStep = { kind: 'daily', title_ar: 'عشرون موقفًا بكلماتي', why_ar: 'لأن كلماتك في المواقف تعلّمني أكثر من أي تقرير', target: { days: 20 }, proposed_by: 'a', proposed_at: ago(366), accepted_at: ago(366), rework: 0 };
const basePair = (over: Partial<Pair> = {}): Pair => ({ id: 'p1', created_at: ago(366), updated_at: ago(366), status: 'active', circle_kind: 'council', circle_id: C1, circle_title: 'مجلس قادة التحول', a_user_id: A.id, a_email: A.email, a_name: A.name, a_name_mode: 'first', b_user_id: B.id, b_email: B.email.toLowerCase(), b_name: B.name, b_name_mode: 'full', invite_why_ar: 'لأنك من القلائل الذين يعودون بما حدث لا بما خُطط', a_step: stepA, b_step: stepB, invited_at: ago(368), accepted_at: ago(367), a_signed_at: ago(366), b_signed_at: ago(365), signed_at: ago(365), expires_at: ago(0), review_at: ago(0), a_review_ar: null, b_review_ar: null, a_reviewed_at: null, b_reviewed_at: null, a_decision: null, b_decision: null, reviewed_at: null, code: 'ATH-MP-AAAA-BBBB', vc_issuance_id: null, meta: {}, ...over });

test('P29 أهلية العهد المتقابل: 3 فصول لكل طرف · القواعد الثابتة', () => {
  assert.equal(PAIR_MIN_CHAPTERS, 3, '3 فصول'); assert.equal(PAIR_PLEDGE_DAYS, 365, 'سنة'); assert.equal(PAIR_INVITE_DAYS, 14, '14 يومًا'); assert.equal(PAIR_MIDYEAR_DAY, 182, 'منتصف'); assert.equal(PAIR_REVIEW_WINDOW_DAYS, 30, 'نافذة'); assert.equal(PAIR_CODE_PREFIX, 'ATH-MP', 'بادئة');
  assert.equal(pairEligibility([chapter(1), chapter(2)]).ok, false, 'فصلان لا يكفيان'); assert.match(pairEligibility([chapter(1), chapter(2)]).read_ar, /فصلان/, 'يقول فصلان');
  assert.equal(pairEligibility([chapter(1), chapter(2), chapter(3)]).ok, true, '3 فصول تكفي');
  assert.match(pairCode(() => 'XY12'), /^ATH-MP-XY12-XY12$/, 'شكل الرمز');
});

test('P29 التحقق: الدعوة (بريد · لماذا · لا أدعو نفسي) · الاقتراح من الخيارات فقط · التوقيع · المراجعة', () => {
  assert.ok(validateInvite({ email: 'x', why_ar: 'كلمات كافية لماذا أنت تحديدًا هنا' }, A.email), 'بريد غير صالح');
  assert.match(validateInvite({ email: A.email.toUpperCase(), why_ar: 'كلمات كافية لماذا أنت تحديدًا هنا' }, A.email) || '', /غيرك/, 'لا أدعو نفسي');
  assert.ok(validateInvite({ email: B.email, why_ar: 'قصير' }, A.email), 'لماذا قصيرة'); assert.ok(validateInvite({ email: B.email, why_ar: 'ك'.repeat(301) }, A.email), 'لماذا طويلة');
  assert.equal(validateInvite({ email: B.email, why_ar: 'لأنك من القلائل الذين يعودون بما حدث', name_mode: 'anon' }, A.email), null, 'دعوة صالحة'); assert.ok(validateInvite({ email: B.email, why_ar: 'لأنك من القلائل الذين يعودون بما حدث', name_mode: 'x' }, A.email), 'وضع اسم غير معروف');
  const opts = [{ kind: 'mission' as const, title_ar: 'مهمة', why_ar: 'لأن', target: {} }];
  assert.ok(validateProposal({ index: 1, why_ar: 'لأنني رأيتك تنقل ما تتعلمه إلى فريقك' }, opts), 'خارج الخيارات'); assert.ok(validateProposal({ index: 0, why_ar: 'قصير' }, opts), 'لماذا قصيرة');
  assert.ok(validateProposal({ index: 0, why_ar: 'لأنني رأيتك تنقل ما تتعلمه x@y.sa إلى فريقك' }, opts), 'لا بُرُد في النص'); assert.equal(validateProposal({ index: 0, why_ar: 'لأنني رأيتك تنقل ما تتعلمه إلى فريقك', title_ar: 'مهمة يؤكّدها مشرفي' }, opts), null, 'اقتراح صالح');
  assert.ok(validateSign({ title_ar: 'قصير' }), 'صياغة قصيرة'); assert.equal(validateSign({}), null, 'بلا صياغة = موافقة'); assert.equal(validateSign({ title_ar: 'عشرون موقفًا بكلماتي أنا' }), null, 'صياغة صالحة');
  assert.ok(validatePairReview({ note_ar: 'قصير', decision: 'renew' }), 'مراجعة قصيرة'); assert.ok(validatePairReview({ note_ar: 'تغيّر فيّ أنني صرت أعود بما حدث', decision: 'archive' }), 'قرار غير معروف'); assert.equal(validatePairReview({ note_ar: 'تغيّر فيّ أنني صرت أعود بما حدث', decision: 'close' }), null, 'مراجعة صالحة');
});

test('P29 الطرفان: sideOf بالمعرّف أو بالبريد · الاسم بالوضع المختار · كلمات صاحبي تُفتح بعد كلماتي فقط', () => {
  const p = basePair({ a_review_ar: 'تغيّرتُ', a_reviewed_at: ago(1), a_decision: 'renew' });
  assert.equal(sideOf(p, A), 'a', 'الداعي a'); assert.equal(sideOf(p, { id: 'x', email: 'NOURA@athar.university' }), 'b', 'المدعوّ بالبريد'); assert.equal(sideOf(p, { id: 'z', email: 'z@z.sa' }), null, 'غريب');
  assert.equal(nameFor(p, 'a'), 'أحمد', 'الاسم الأول'); assert.equal(nameFor(p, 'b'), 'نورة الشهري', 'الاسم الكامل'); assert.equal(nameFor({ ...p, b_name_mode: 'anon' }, 'b'), 'ممارس', 'بلا اسم');
  const vb = viewFor(p, 'b'); assert.equal(vb.partner_review_ar, null, 'b لم يكتب → لا يرى كلمات a'); assert.equal(vb.a_review_ar, null, 'ولا في الحقل الخام'); assert.equal(vb.partner_name, 'أحمد', 'اسم صاحبه');
  const vb2 = viewFor({ ...p, b_reviewed_at: ago(0), b_review_ar: 'أنا أيضًا' }, 'b'); assert.equal(vb2.partner_review_ar, 'تغيّرتُ', 'بعد أن كتب يرى');
  const va = viewFor(p, 'a'); assert.equal(va.a_review_ar, 'تغيّرتُ', 'كلماتي تبقى لي'); assert.equal(va.partner_review_ar, null, 'b لم يكتب بعد');
});

test('P29 حالة الخطوة · الربع · المرآة بلا حكم · نص المراجعة · التقاء العهود · القرار المشترك · المهل', () => {
  const inp: JourneyInput = { events: [], daily: [], sims: [], missions: [{ id: 'm1', title_ar: 'مهمة', confirmed_at: ago(200), submitted_at: ago(210), status: 'confirmed', skills: [] }], memberships: [], cases: [], attestations: [], levels: [], credentials: [], skills: {} } as any;
  const { buildPath } = require('../lib/horizon/registry');
  const path = buildPath({ kind: 'mission', target: { count: 1 }, signed_at: ago(365) }, inp, NOW); const st = stepState(path, ago(365));
  assert.equal(st.complete, true, 'وقعت'); assert.match(st.read_ar, /وقعت في الربع الثاني/, 'ربع الوقوع'); assert.equal(quarterLabel(ago(365), ago(300)), 'الربع الأول من العهد', 'ربع أول'); assert.equal(quarterLabel(ago(365), ago(10)), 'الربع الأخير من العهد', 'ربع أخير');
  const none = stepState(buildPath({ kind: 'daily', target: { days: 20 }, signed_at: ago(365) }, inp, NOW), ago(365)); assert.equal(none.complete, false, 'لم تقع'); assert.equal(none.read_ar, 'لم تقع بعد', 'نص لم تقع');
  assert.equal(stepState(null).read_ar, 'لم تُوقَّع بعد', 'بلا توقيع');
  const m = pairMirror(ago(200), st, none, 'نورة', NOW); assert.match(m, /مرّ نصف العهد/, 'نصف'); assert.match(m, /خطوتك وقعت/, 'خطوتي'); assert.match(m, /خطوة نورة لم تقع بعد/, 'خطوة صاحبي'); assert.match(m, /لا حكم هنا/, 'بلا حكم'); assert.doesNotMatch(m, /%/, 'لا نسبة');
  const rt = pairReviewText({ name: 'أحمد', step: stepA, state: st }, { name: 'نورة', step: stepB, state: none }, ago(365), 3, 7); assert.match(rt, /طلب نورة منك: «مهمة واحدة/, 'ما طُلب مني'); assert.match(rt, /3 فصول، واليوم 7 فصول/, 'الفصول'); assert.match(rt, /ليس فشلًا/, 'بلا حكم');
  assert.equal(meetsHorizon(stepA, 'mission'), true, 'التقاء'); assert.equal(meetsHorizon(stepA, 'daily'), false, 'لا التقاء'); assert.equal(meetsHorizon(null, 'mission'), false, 'بلا خطوة');
  assert.equal(jointDecision('renew', null), null, 'ينتظر'); assert.equal(jointDecision('renew', 'renew'), 'renew', 'اتفقا'); assert.equal(jointDecision('renew', 'close'), 'close', 'أحدهما يطوي → طيّ');
  assert.equal(inviteExpired({ status: 'invited', invited_at: ago(13), accepted_at: null }, NOW), false, '13 يومًا'); assert.equal(inviteExpired({ status: 'invited', invited_at: ago(14), accepted_at: null }, NOW), true, '14 يومًا'); assert.equal(inviteExpired({ status: 'proposing', invited_at: ago(30), accepted_at: ago(15) }, NOW), true, 'مهلة الاقتراح');
  assert.equal(reviewOpen({ status: 'active', review_at: ago(1) }, NOW), true, 'المراجعة مفتوحة'); assert.equal(reviewOpen({ status: 'active', review_at: addDays(new Date(NOW), 1) }, NOW), false, 'ليست بعد');
  const sm = pairSummary(basePair(), 'a', st, none, 0); assert.equal((sm as any).my_step.kind, 'mission', 'خطوتي'); assert.ok(!JSON.stringify(sm).includes('نورة') && !JSON.stringify(sm).includes('@'), 'لا أسماء ولا بُرُد في الملخص');
});

test('P29 الدائرة: مجلس مشترك (عضوان فاعلان) ثم جهة واحدة (مؤكَّدان) وإلا لا شيء · resolvePerson بلا كشف', async () => {
  const db = fakeDb({
    profiles: [{ id: A.id, email: A.email, full_name: A.name }, { id: B.id, email: B.email.toLowerCase(), full_name: B.name }],
    portal_councils: [{ id: C1, title_ar: 'مجلس قادة التحول', status: 'active' }],
    portal_council_members: [{ council_id: C1, user_id: A.id, email: A.email, status: 'active', left_at: null }, { council_id: C1, user_id: B.id, email: B.email.toLowerCase(), status: 'active', left_at: null }],
    portal_organizations: [{ id: ORG, name: 'جامعة أَثَر' }],
    portal_org_members: [{ organization_id: ORG, user_id: A.id, email: A.email, status: 'confirmed' }, { organization_id: ORG, user_id: B.id, email: B.email.toLowerCase(), status: 'confirmed' }],
  });
  const c = await findCircle(db, A, B); assert.equal(c?.kind, 'council', 'المجلس أولًا'); assert.equal(c?.title, 'مجلس قادة التحول', 'عنوان المجلس');
  db.T.portal_council_members[1].status = 'left'; const c2 = await findCircle(db, A, B); assert.equal(c2?.kind, 'org', 'ثم الجهة'); assert.equal(c2?.title, 'جامعة أَثَر', 'اسم الجهة');
  db.T.portal_org_members[1].status = 'pending'; assert.equal(await findCircle(db, A, B), null, 'لا دائرة');
  const found = await resolvePerson(db, 'NOURA@athar.university'); assert.equal(found.found, true, 'وجدناها'); assert.equal(found.id, B.id, 'معرّفها');
  const nf = await resolvePerson(db, 'ghost@nowhere.sa'); assert.equal(nf.found, false, 'لا حساب'); assert.equal(nf.id, '00000000-0000-0000-0000-000000000000', 'معرّف صفري — لا كشف');
});

test('P29 الدعوة العمياء لا تظهر للمدعوّ وتظهر للداعي · عهد حيّ واحد · فصل الدعوات', async () => {
  const blind = basePair({ id: 'bl', status: 'invited', b_user_id: B.id, a_step: null, b_step: null, signed_at: null, a_signed_at: null, b_signed_at: null, invited_at: ago(1), meta: { blind: true, blind_reason: 'not_in_circle' } });
  const real = basePair({ id: 'rl', status: 'invited', a_user_id: 'other', a_email: 'other@athar.university', a_name: 'سارة', b_user_id: B.id, a_step: null, b_step: null, signed_at: null, invited_at: ago(2) });
  const db = fakeDb({ portal_pair_pledges: [blind, real, basePair()] });
  const forB = await loadMyPairs(db, B); assert.equal(forB.some(p => p.id === 'bl'), false, 'العمياء لا تظهر لـ b'); assert.equal(forB.some(p => p.id === 'rl'), true, 'الحقيقية تظهر');
  const forA = await loadMyPairs(db, A); assert.equal(forA.some(p => p.id === 'bl'), true, 'الداعي يرى دعوته (بلا سبب)');
  const sp = splitPairs(forB, B, NOW); assert.equal(sp.live?.id, 'p1', 'العهد الحيّ'); assert.equal(sp.invitesIn.length, 1, 'دعوة واردة واحدة'); assert.equal(sp.invitesIn[0].id, 'rl', 'هي الحقيقية');
  const spA = splitPairs(forA, A, NOW); assert.equal(spA.inviteOut?.id, 'bl', 'دعوتي الصادرة (حتى العمياء)');
});

test('P29 الوثيقة الواحدة بحاملَين: kind=pair_pledge · بلا بُرُد · الخطوتان · Ed25519 تتحقق · حدث لكل طرف · السحب يسحب الوثيقة', async () => {
  const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, SITE)!; assert.ok(signer, 'موقّع');
  const p = basePair({ status: 'proposing', signed_at: null, expires_at: null, review_at: null, code: null, meta: { chapters_then: { a: 5, b: 3 } } });
  const db = fakeDb({ portal_pair_pledges: [p] }); db.T.portal_pair_pledges[0].id = 'p1';
  const r = await activatePair(db, p, signer, SITE, DID, () => 'ABCD', new Date(NOW)); assert.ok(r.ok, 'تفعيل'); if (!r.ok) return;
  assert.equal(r.pair.status, 'active', 'نشط'); assert.equal(r.pair.code, 'ATH-MP-ABCD-ABCD', 'الرمز'); assert.equal(r.pair.review_at, addDays(new Date(NOW), 365), 'المراجعة بعد سنة'); assert.ok(r.verify_url?.includes('ATH-MP'), 'رابط التحقق');
  const vc = db.T.portal_vc_issuances[0]; assert.equal(vc.kind, 'pair_pledge', 'نوع الوثيقة'); const doc = vc.vc; const txt = JSON.stringify(doc);
  assert.equal(/[\w.+-]+@[\w-]+\.[\w.]+/.test(txt), false, 'لا بُرُد في الوثيقة'); assert.ok(!txt.includes(p.invite_why_ar) && !txt.includes(stepA.why_ar), 'لا كلمات «لماذا» في الوثيقة');
  assert.equal(doc._athar.kind, 'pair_pledge', '_athar.kind'); assert.equal(doc._athar.holders.length, 2, 'حاملان'); assert.equal(doc.credentialSubject.name, 'أحمد · نورة الشهري', 'اسم الموضوع'); assert.match(doc.credentialSubject.achievement.criteria.narrative, /مهمة واحدة.*عشرون موقفًا/, 'الخطوتان');
  assert.equal(structuralChecks(doc).filter(c => !c.ok).length, 0, 'بنية سليمة'); assert.equal((await verifySignature(doc, localResolver(signer, []))).ok, true, 'التوقيع يتحقق');
  const ev = db.T.portal_learning_events; assert.equal(ev.length, 2, 'حدث لكل طرف'); assert.ok(ev.every((e: any) => e.object_type === 'pair' && e.verb === 'pledged'), 'pledged/pair'); assert.equal(ev[1].user_id, B.id, 'حدث b');
  const doc2 = buildPairDoc({ code: 'ATH-MP-X-Y', aName: 'ممارس', bName: 'ممارس', aStep: stepA, bStep: stepB, circle_kind: 'org', site: SITE, did: DID, expires: addDays(new Date(NOW), 365), statusIndex: null }); assert.equal(doc2._athar.circle_ar, 'جهة واحدة', 'الدائرة بالعربية'); assert.equal(doc2.credentialStatus, undefined, 'بلا حالة حين لا فهرس');
  const rv = await revokePair(db, r.pair, new Date(NOW + 1000)); assert.equal(rv.ok, true, 'سحب'); assert.equal(db.T.portal_pair_pledges[0].status, 'revoked', 'حالة'); assert.ok(db.T.portal_vc_issuances[0].revoked_at, 'الوثيقة مسحوبة');
  assert.equal((await revokePair(db, { ...r.pair, status: 'closed' } as Pair)).ok, false, 'المطوي لا يُسحب');
  const noSigner = await activatePair(fakeDb({ portal_pair_pledges: [{ ...p, id: 'p2' }] }), { ...p, id: 'p2' }, null, SITE, DID, () => 'Q', new Date(NOW)); assert.ok(noSigner.ok && !noSigner.signed_vc && noSigner.pair.vc_issuance_id === null, 'بلا مفتاح: يُفعَّل بلا وثيقة');
});

test('P29 الكرون: انقضاء 14 يومًا · «خطوة صاحبك وقعت» مرة واحدة · منتصف السنة مرة · فتح المراجعة 365 · طيّ بعد 30 يومًا (غير المراجِع = نطوي)', async () => {
  const inv = basePair({ id: 'inv', status: 'invited', invited_at: ago(15), a_step: null, b_step: null, signed_at: null, review_at: null });
  const fresh = basePair({ id: 'fresh', status: 'invited', invited_at: ago(3), a_step: null, b_step: null, signed_at: null, review_at: null });
  const prop = basePair({ id: 'prop', status: 'proposing', accepted_at: ago(15), signed_at: null, review_at: null });
  const mid = basePair({ id: 'mid', status: 'active', signed_at: ago(200), review_at: addDays(new Date(NOW), 165), expires_at: addDays(new Date(NOW), 165), b_step: { ...stepA, proposed_by: 'a' } });
  const due = basePair({ id: 'due', status: 'active', signed_at: ago(365), review_at: ago(0) });
  const stale = basePair({ id: 'stale', status: 'review', review_at: ago(31), a_decision: 'renew', a_reviewed_at: ago(20), a_review_ar: 'كلمات' });
  const db = fakeDb({ portal_pair_pledges: [inv, fresh, prop, mid, due, stale], portal_missions: [{ user_id: B.id, email: B.email.toLowerCase(), title_ar: 'مهمة', confirmed_at: ago(10), submitted_at: ago(12), status: 'confirmed', skills: [] }] });
  // أعِد المعرّفات كما في البذرة (fakeDb يرقّم تلقائيًا)
  db.T.portal_pair_pledges.forEach((r: any, i: number) => { r.id = [inv, fresh, prop, mid, due, stale][i].id; });
  const dry = await runPair(db, { dry: true, site: SITE, now: new Date(NOW) }); assert.equal(dry.expired, 2, 'جاف: دعوة + اقتراح منقضيان'); assert.equal(dry.nudged, 1, 'جاف: منتصف'); assert.equal(dry.opened, 1, 'جاف: فتح'); assert.equal(dry.closed, 1, 'جاف: طيّ'); assert.equal(db.T.portal_pair_pledges.find((r: any) => r.id === 'inv').status, 'invited', 'الجاف لا يكتب');
  const r1 = await runPair(db, { site: SITE, now: new Date(NOW) }); assert.equal(r1.errors.length, 0, `بلا أخطاء: ${r1.errors.join(' | ')}`);
  const by = (id: string) => db.T.portal_pair_pledges.find((r: any) => r.id === id);
  assert.equal(by('inv').status, 'expired', 'انقضت'); assert.equal(by('fresh').status, 'invited', 'الطازجة باقية'); assert.equal(by('prop').status, 'expired', 'مهلة الاقتراح انقضت');
  assert.equal(by('mid').meta.nudged_at ? 1 : 0, 1, 'نُبّه منتصف السنة'); assert.equal(by('due').status, 'review', 'فُتحت المراجعة'); assert.equal(by('stale').status, 'closed', 'طُويت — b لم يراجع'); assert.equal(by('stale').reviewed_at ? 1 : 0, 1, 'تاريخ الطيّ');
  assert.equal(r1.step_notices >= 1, true, 'خطوة b (مهمة مؤكَّدة بعد التوقيع) وقعت → إشعار a'); assert.equal(by('mid').meta.b_done_notified ? 1 : 0, 1, 'سُجّل الإشعار');
  const r2 = await runPair(db, { site: SITE, now: new Date(NOW + 864e5) }); assert.equal(r2.nudged, 0, 'لا تنبيه ثانٍ'); assert.equal(r2.step_notices, 0, 'لا إشعار ثانٍ'); assert.equal(r2.opened, 0, 'لا فتح ثانٍ');
  const st = await partnerState(db, by('mid'), 'b', NOW); assert.equal(st.complete, true, 'حالة b: وقعت'); const sa = await partnerState(db, by('mid'), 'a', NOW); assert.equal(sa.complete, false, 'حالة a: لم تقع');
});

test('P29 رحلتي: فصل «عهد متقابل» من الأحداث بلا اسم الزميل · رحلة الجهة: «عهود متقابلة» بنصاب 5', () => {
  const inp: JourneyInput = { events: [{ at: ago(300), verb: 'pledged', object_type: 'pair', object_id: 'p1', skills: [], context: { code: 'ATH-MP-1', kind: 'mission', title_ar: 'مهمة واحدة', circle: 'council' } }, { at: ago(1), verb: 'reviewed', object_type: 'pair', object_id: 'p1', skills: [], context: { decision: 'renew', complete: true } }], daily: [], sims: [], missions: [], memberships: [], cases: [], attestations: [], levels: [], credentials: [], skills: {} } as any;
  const ch = buildChapters(inp); assert.equal(ch.filter(c => c.kind === 'pair').length, 2, 'فصلان'); assert.match(ch[0].what_ar, /زميل من مجلسي/, 'بلا اسم'); assert.ok(!ch[0].what_ar.includes('نورة'), 'لا اسم'); assert.equal(ch[0].public_ok, false, 'لا يُنشر'); assert.match(ch[1].title_ar, /جدّدناه/, 'التجديد');
  const j = buildJourney(inp, NOW); assert.equal(j.counts.pair, 2, 'العدّ'); assert.match(j.arc_ar, /عهد متقابل مع زميل/, 'القوس');
  const members = Array.from({ length: 6 }, (_, i) => `m${i}@athar.university`);
  const org = buildOrgChapters({ members, daily_first: [], missions: [], joins: [], returns: [], attestations: [], levels: [], credentials: [], charters: [], twinnings: [], contracts: [], pairs: members.slice(0, 5).map(m => ({ person: m, at: ago(10) })) } as any);
  assert.equal(org.chapters.filter(c => c.kind === 'pair').length, 1, 'فصل بخمسة'); assert.match(org.chapters.find(c => c.kind === 'pair')!.title_ar, /تعاهدوا مع زملاء/, 'العنوان'); assert.equal(ORG_KIND_AR.pair, 'عهود متقابلة', 'الاسم');
  const org4 = buildOrgChapters({ members, daily_first: [], missions: [], joins: [], returns: [], attestations: [], levels: [], credentials: [], charters: [], twinnings: [], contracts: [], pairs: members.slice(0, 4).map(m => ({ person: m, at: ago(10) })) } as any); assert.equal(org4.chapters.filter(c => c.kind === 'pair').length, 0, 'أربعة لا يكفون');
});

test('P29 الخزنة: الجدول مسجَّل بطرفين (تجهيل) · MCP my_horizon يذكر العهد المتقابل', () => {
  const r = REGISTRY.find(x => x.table === 'portal_pair_pledges')!; assert.ok(r, 'مسجَّل'); assert.equal(r.policy, 'anonymize', 'تجهيل لا حذف — كلمات صاحبه تبقى له'); assert.equal(r.alsoKeys?.[0]?.emailCol, 'b_email', 'الطرف الثاني'); assert.ok(r.piiCols.includes('a_name') && r.piiCols.includes('b_name'), 'الاسمان');
  const plan = erasurePlan(); assert.ok(plan.anonymize.some((x: any) => x.table === 'portal_pair_pledges'), 'في خطة النسيان (تجهيل)');
  const t = ALL_MCP_TOOLS.find(x => x.name === 'my_horizon')!; assert.match(t.description, /pair/, 'يذكر pair'); assert.equal(ALL_MCP_TOOLS.some(x => x.name.includes('pair')), false, 'لا أداة MCP جديدة');
});
