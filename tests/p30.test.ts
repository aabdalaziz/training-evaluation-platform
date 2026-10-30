// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P30 — «عهد الممارس وجهته» («خطوة مني وخطوة من جهتي»): أهلية المنسوب (3 فصول) وأهلية الجهة (ميثاق نافذ) · «لماذا» 20–300 بلا بُرُد
//                 · ما يقترحه أَثَر للمنسوب ليطلبه من جهته (مقعد · اعتماد مستوى · اعتماد شهادة قرين · تأكيد المهام في 7 أيام) · درب الجهة من أفعالها المسجَّلة فقط
//                 · الزاوية: المنسوب لا يرى بريد موقّع الجهة · كلمات الآخر تُفتح بعد كلماتي · الملخص بلا بُرُد · الدعوة العمياء لا تظهر للمنسوب
//                 · الوثيقة الواحدة بحاملَين (kind=org_pair_pledge · شخص + جهة «بصفته» · بلا بُرُد ولا «لماذا» · Ed25519) · السحب يسحب الوثيقة
//                 · الكرون: انقضاء 14 يومًا · «خطوة … وقعت» للطرف الآخر مرة واحدة · منتصف السنة · فتح المراجعة · طيّ بعد 30 يومًا · فصل «عهد مع جهتي» في رحلتي · «عهود مع منسوبين» k=5 في رحلة الجهة · الخزنة · MCP
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORG_PAIR_MIN_CHAPTERS, ORG_PAIR_INVITE_DAYS, ORG_PAIR_PLEDGE_DAYS, ORG_PAIR_MIDYEAR_DAY, ORG_PAIR_REVIEW_WINDOW_DAYS, ORG_PAIR_CODE_PREFIX, ORG_PAIR_MISSION_SLA_DAYS, ORG_STEP_KIND_AR, MEMBER_KIND_AR, memberEligibility, orgEligibility, validateOrgInvite, validateOrgProposal, suggestForOrg, suggestForMember, memberPath, orgPath, stepState, orgViewFor, orgPairMirror, orgPairReviewText, orgPairSummary, orgInviteExpired, orgReviewOpen, jointDecision, orgPairCode, memberName, orgName, orgPairEvents, addDays } from '../lib/org-pair/registry';
import type { OrgPair, MemberStep, OrgStep, OrgWitness } from '../lib/org-pair/registry';
import { myOrg, isConfirmedMember, orgWitness, loadMemberOrgPairs, splitOrgPairs, orgAdmins, loadMemberOrgPairState } from '../lib/org-pair/load';
import { buildOrgPairDoc, activateOrgPair, revokeOrgPair } from '../lib/org-pair/pledge';
import { runOrgPair } from '../lib/org-pair/cron';
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
const M = { id: '00000000-0000-4000-8000-0000000000b2', email: 'noura@athar.university', name: 'نورة الشهري' };
const ADM = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ahmed@athar.university', name: 'أحمد بدوي' };
const ORG = '00000000-0000-4000-8000-000000000021'; const SK = 'sk-1'; const C1 = '00000000-0000-4000-8000-0000000000c1';

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
const chapter = (i: number, kind: Chapter['kind'] = 'daily'): Chapter => ({ key: `c${i}`, kind, at: ago(100 - i), title_ar: `فصل ${i}`, what_ar: '', quote_ar: null, level: null, ref: null, public_ok: true });
const emptyInput = (over: Partial<JourneyInput> = {}): JourneyInput => ({ events: [], daily: [], sims: [], missions: [], memberships: [], cases: [], attestations: [], levels: [], credentials: [], skills: { [SK]: 'قيادة التغيير' }, ...over } as any);
const mStep: MemberStep = { kind: 'mission', title_ar: 'مهمة واحدة يؤكّدها مشرفي من قلب العمل', why_ar: 'لأننا رأيناك تنقل ما تتعلمه إلى فريقك فعلًا', target: { count: 1 }, proposed_by: 'org', proposed_at: ago(366), accepted_at: ago(366), rework: 0 };
const oStep: OrgStep = { kind: 'missions', title_ar: 'تأكيد مهامي خلال 7 أيام — 3 مهام متتالية', why_ar: 'لأن انتظار التأكيد أسابيع يطفئ الأثر', target: { count: 3, sla_days: 7 }, proposed_by: 'member', proposed_at: ago(366), accepted_at: ago(366), rework: 0 };
const basePair = (over: Partial<OrgPair> = {}): OrgPair => ({ id: 'p1', created_at: ago(366), updated_at: ago(366), organization_id: ORG, org_name: 'جامعة أَثَر', status: 'active', invited_by: 'member', member_user_id: M.id, member_email: M.email, member_name: M.name, member_name_mode: 'first', invite_why_ar: 'لأن ما تعلمته هذه السنة أريد أن أردّه إلى جهتي', member_step: mStep, org_step: oStep, invited_at: ago(380), accepted_at: ago(375), member_signed_at: ago(366), org_signed_at: ago(366), org_signer_id: ADM.id, org_signer_email: ADM.email, signed_at: ago(365), expires_at: ago(0), review_at: ago(0), code: 'ATH-PO-TEST-0001', vc_issuance_id: null, member_review_ar: null, member_reviewed_at: null, member_decision: null, org_review_ar: null, org_reviewed_at: null, org_decision: null, reviewed_at: null, meta: {}, ...over });

test('P30 الأهلية: 3 فصول للمنسوب · ميثاق نافذ للجهة · الثوابت · الرمز ATH-PO · «لماذا» بلا بُرُد', () => {
  assert.equal(ORG_PAIR_MIN_CHAPTERS, 3, '3 فصول'); assert.equal(ORG_PAIR_PLEDGE_DAYS, 365, 'سنة'); assert.equal(ORG_PAIR_INVITE_DAYS, 14, '14 يومًا'); assert.equal(ORG_PAIR_MIDYEAR_DAY, 182, 'منتصف'); assert.equal(ORG_PAIR_REVIEW_WINDOW_DAYS, 30, 'نافذة'); assert.equal(ORG_PAIR_CODE_PREFIX, 'ATH-PO', 'بادئة'); assert.equal(ORG_PAIR_MISSION_SLA_DAYS, 7, 'مهلة التأكيد');
  assert.equal(memberEligibility([chapter(1), chapter(2)]).ok, false, 'فصلان لا يكفيان'); assert.match(memberEligibility([chapter(1), chapter(2)]).read_ar, /فصلان/, 'يقول فصلان'); assert.equal(memberEligibility([chapter(1), chapter(2), chapter(3)]).ok, true, '3 فصول تكفي');
  assert.equal(orgEligibility(null, NOW).reason, 'no_charter', 'بلا ميثاق'); assert.equal(orgEligibility({ status: 'active', expires_at: ago(1) }, NOW).reason, 'expired', 'منتهٍ'); assert.equal(orgEligibility({ status: 'revoked', expires_at: null }, NOW).ok, false, 'مسحوب'); assert.equal(orgEligibility({ status: 'active', expires_at: addDays(new Date(NOW), 100) }, NOW).ok, true, 'نافذ');
  assert.match(orgPairCode(() => 'XY12'), /^ATH-PO-XY12-XY12$/, 'شكل الرمز');
  assert.ok(validateOrgInvite({ why_ar: 'قصير' }), 'قصيرة'); assert.ok(validateOrgInvite({ why_ar: 'كلمات كافية لكن فيها بريد x@y.sa هنا' }), 'لا بُرُد'); assert.ok(validateOrgInvite({ why_ar: 'لأن ما تعلمته أريد أن أردّه إلى جهتي', name_mode: 'x' }), 'وضع اسم'); assert.equal(validateOrgInvite({ why_ar: 'لأن ما تعلمته أريد أن أردّه إلى جهتي', name_mode: 'anon' }), null, 'صالحة');
  assert.ok(validateOrgProposal({ index: 2, why_ar: 'لأننا رأيناك تنقل ما تتعلمه إلى فريقك' }, [{ kind: 'seat' }]), 'خارج الخيارات'); assert.equal(validateOrgProposal({ index: 0, why_ar: 'لأننا رأيناك تنقل ما تتعلمه إلى فريقك' }, [{ kind: 'seat' }]), null, 'صالح');
  assert.equal(Object.keys(ORG_STEP_KIND_AR).length, 4, 'أربعة أفعال للجهة'); assert.equal(MEMBER_KIND_AR.mission ? 1 : 0, 1, 'أنواع المنسوب من P27');
  assert.equal(memberName(basePair()), 'نورة', 'الاسم الأول'); assert.equal(memberName(basePair({ member_name_mode: 'anon' })), 'ممارس', 'بلا اسم'); assert.equal(orgName(basePair({ org_name: null })), 'الجهة', 'جهة بلا اسم');
});

test('P30 ما يقترحه أَثَر للمنسوب ليطلبه من جهته: أربعة أفعال تشهدها المنصة · مرتّبة بما ينقصه · 3 كحد أقصى · لا تكرار', () => {
  const none = suggestForOrg(emptyInput()); assert.equal(none.length, 3, 'ثلاثة'); assert.equal(none[0].kind, 'seat', 'لا مجلس → المقعد أولًا'); assert.equal(new Set(none.map(o => o.kind)).size, 3, 'بلا تكرار'); assert.ok(none.some(o => o.kind === 'missions'), 'تأكيد المهام دائمًا متاح');
  const lv = suggestForOrg(emptyInput({ levels: [{ skill_id: SK, computed_level: 3.4, approved_level: 1, approved_at: ago(300) }] as any, memberships: [{ council_id: C1, joined_at: ago(50), status: 'active', council_title: 'مجلس' }] as any }));
  assert.equal(lv[0].kind, 'level', 'في مجلس + مستوى محسوب أعلى من المعتمد → الاعتماد أولًا'); assert.match(lv[0].title_ar, /قيادة التغيير/, 'اسم المهارة'); assert.equal(lv[0].target.to, 3, 'إلى المستوى المحسوب'); assert.ok(lv.some(o => o.kind === 'attestation'), 'في مجلس → اعتماد شهادة قرين'); assert.equal(lv.some(o => o.kind === 'seat'), false, 'له مجلس → لا مقعد');
  const ms = suggestForOrg(emptyInput({ missions: [{ id: 'm', title_ar: 'x', submitted_at: ago(30), confirmed_at: ago(2), status: 'confirmed', skills: [] }] as any })); assert.equal(ms.find(o => o.kind === 'missions')!.target.sla_days, 7, 'المهلة في الهدف');
  const forMember = suggestForMember([chapter(1), chapter(2), chapter(3)], emptyInput()); assert.ok(forMember.length >= 1 && forMember.every(o => MEMBER_KIND_AR[o.kind]), 'خيارات الجهة للمنسوب من محرّك P27');
});

test('P30 درب الجهة من أفعالها المسجَّلة: مقعد (طلب يذكره + جلوس) · اعتماد مستوى بعد التوقيع فقط · شهادة قرين معتمدة · مهام مؤكَّدة في 7 أيام (المتأخرة لا تُحسب)', () => {
  const signed = ago(300);
  const w = (input: JourneyInput, seats: OrgWitness['seat_requests'] = []): OrgWitness => ({ input, seat_requests: seats });
  const seat: OrgStep = { ...oStep, kind: 'seat', target: { count: 1 } };
  const p0 = orgPath(seat, signed, w(emptyInput()), NOW); assert.equal(p0.complete, false, 'لا شيء'); assert.equal(p0.steps.length, 2, 'خطوتان'); assert.match(p0.read_ar, /لم يقع/, 'نص لم يقع');
  const p1 = orgPath(seat, signed, w(emptyInput(), [{ created_at: ago(200), status: 'open', matched_council_id: null, includes_member: true }, { created_at: ago(310), status: 'matched', matched_council_id: C1, includes_member: true }]), NOW);
  assert.equal(p1.steps[0].done, true, 'طُلب مقعد باسمه بعد التوقيع'); assert.equal(p1.steps[0].at, ago(200), 'الطلب القديم قبل التوقيع لا يُحسب'); assert.equal(p1.complete, false, 'لم يجلس بعد');
  const p2 = orgPath(seat, signed, w(emptyInput({ memberships: [{ council_id: C1, joined_at: ago(150), status: 'active', council_title: 'مجلس القادة' }] as any }), [{ created_at: ago(200), status: 'matched', matched_council_id: C1, includes_member: true }]), NOW); assert.equal(p2.complete, true, 'جلس'); assert.match(p2.steps[1].detail_ar || '', /مجلس القادة/, 'اسم المجلس'); assert.match(p2.read_ar, /وقع/, 'وقع');
  const s2 = stepState(p2, signed); assert.equal(s2.complete, true, 'الحالة: وقعت'); assert.equal(s2.done, 2, 'خطوتان تمّتا');
  const lvl: OrgStep = { ...oStep, kind: 'level', target: { skill_id: SK, skill_ar: 'قيادة التغيير', to: 3, from: 1 } as any };
  assert.equal(orgPath(lvl, signed, w(emptyInput({ levels: [{ skill_id: SK, computed_level: 3.2, approved_level: 3, approved_at: ago(320) }] as any })), NOW).complete, false, 'اعتماد قبل التوقيع لا يُحسب');
  assert.equal(orgPath(lvl, signed, w(emptyInput({ levels: [{ skill_id: SK, computed_level: 3.2, approved_level: 3, approved_at: ago(100) }] as any })), NOW).complete, true, 'اعتماد بعد التوقيع يُحسب');
  const att: OrgStep = { ...oStep, kind: 'attestation', target: { count: 1 } };
  const pa = orgPath(att, signed, w(emptyInput({ attestations: [{ status: 'approved', decided_at: ago(90), created_at: ago(95), skill_id: SK }] as any })), NOW); assert.equal(pa.complete, true, 'شهادة اعتُمدت بعد العهد'); assert.match(pa.steps[0].detail_ar || '', /قيادة التغيير/, 'المهارة');
  const missions = [{ id: '1', title_ar: 'أ', submitted_at: ago(250), confirmed_at: ago(247), status: 'confirmed', skills: [] }, { id: '2', title_ar: 'ب', submitted_at: ago(200), confirmed_at: ago(180), status: 'confirmed', skills: [] }, { id: '3', title_ar: 'ج', submitted_at: ago(100), confirmed_at: ago(99), status: 'confirmed', skills: [] }, { id: '4', title_ar: 'د', submitted_at: ago(20), confirmed_at: null, status: 'submitted', skills: [] }];
  const pm = orgPath(oStep, signed, w(emptyInput({ missions: missions as any })), NOW); assert.equal(pm.steps.length, 3, '3 مهام'); assert.equal(pm.steps.filter(s => s.done).length, 2, 'اثنتان في مهلتها (الثانية تأخّرت 20 يومًا والرابعة معلّقة 20 يومًا)'); assert.equal(pm.complete, false, 'لم تكتمل'); assert.match(pm.steps[2].detail_ar || '', /تأخّرت/, 'يذكر المتأخرة بلا حكم');
  missions[1].confirmed_at = ago(195); const pm2 = orgPath(oStep, signed, w(emptyInput({ missions: missions as any })), NOW); assert.equal(pm2.complete, true, 'ثلاث في مهلتها → وقعت'); assert.ok(pm2.quarters.length >= 1 && pm2.quarters.length <= 4, 'أرباع');
  const mp = memberPath(mStep, signed, emptyInput({ missions: [{ id: 'x', title_ar: 'مهمة', submitted_at: ago(60), confirmed_at: ago(50), status: 'confirmed', skills: [] }] as any }), NOW); assert.equal(mp.complete, true, 'درب المنسوب — محرّك P27');
});

test('P30 الزاوية: المنسوب لا يرى بريد موقّع الجهة · كلمات الآخر تُفتح بعد كلماتي · المرآة بلا حكم · نص المراجعة · الملخص بلا بُرُد · المهل · القرار المشترك', () => {
  const p = basePair({ org_review_ar: 'تغيّر فينا أننا صرنا نؤكّد في أسبوع', org_reviewed_at: ago(1), org_decision: 'renew' });
  const vm = orgViewFor(p, 'member'); assert.equal(vm.org_signer_email, null, 'بريد الموقّع مخفيّ عن المنسوب'); assert.equal(vm.org_signer_id, null, 'ومعرّفه'); assert.equal(vm.partner_review_ar, null, 'لم يكتب → لا يرى كلمات الجهة'); assert.equal(vm.org_review_ar, null, 'ولا في الحقل الخام'); assert.equal(vm.org_name_shown, 'جامعة أَثَر', 'اسم الجهة');
  const vm2 = orgViewFor({ ...p, member_reviewed_at: ago(0), member_review_ar: 'أنا أيضًا' }, 'member'); assert.equal(vm2.partner_review_ar, 'تغيّر فينا أننا صرنا نؤكّد في أسبوع', 'بعد أن كتب يرى');
  const vo = orgViewFor({ ...p, member_review_ar: 'كلماتي', member_reviewed_at: ago(0) }, 'org'); assert.equal(vo.org_signer_email, ADM.email, 'الجهة ترى موقّعها'); assert.equal(vo.partner_review_ar, 'كلماتي', 'الجهة كتبت → ترى كلمات المنسوب'); assert.equal(vo.member_name_shown, 'نورة', 'اسم المنسوب بوضعه');
  const done = stepState(memberPath(mStep, ago(200), emptyInput({ missions: [{ id: 'x', title_ar: 'م', submitted_at: ago(60), confirmed_at: ago(50), status: 'confirmed', skills: [] }] as any }), NOW), ago(200)); const none = stepState(orgPath(oStep, ago(200), { input: emptyInput(), seat_requests: [] }, NOW), ago(200));
  const mm = orgPairMirror(ago(200), done, none, 'نورة', 'جامعة أَثَر', 'member', NOW); assert.match(mm, /مرّ نصف العهد/, 'نصف'); assert.match(mm, /خطوتك وقعت/, 'خطوتي'); assert.match(mm, /خطوة جامعة أَثَر لم تقع بعد/, 'خطوة الجهة'); assert.match(mm, /لا حكم هنا/, 'بلا حكم'); assert.doesNotMatch(mm, /%/, 'لا نسبة');
  const mo = orgPairMirror(ago(200), done, none, 'نورة', 'جامعة أَثَر', 'org', NOW); assert.match(mo, /خطوة نورة وقعت/, 'للجهة: خطوة المنسوب'); assert.match(mo, /وخطوتكم لم تقع بعد/, 'للجهة: خطوتكم');
  const rt = orgPairReviewText('member', p, done, none, 3, 7); assert.match(rt, /طلبت منك جامعة أَثَر: «مهمة واحدة/, 'ما طُلب مني'); assert.match(rt, /3 فصول، واليوم 7 فصول/, 'الفصول'); assert.match(rt, /ليس فشلًا/, 'بلا حكم');
  const ro = orgPairReviewText('org', p, done, none, 3, 7); assert.match(ro, /طلبتم من نورة/, 'للجهة'); assert.doesNotMatch(ro, /فصول، واليوم/, 'الجهة لا ترى عدد فصول المنسوب');
  const sm = orgPairSummary(p, done, none, 0); assert.equal((sm as any).my_step.kind, 'mission', 'خطوتي'); assert.equal((sm as any).org_step.kind_ar, ORG_STEP_KIND_AR.missions, 'نوع خطوة الجهة بالعربية'); assert.ok(!JSON.stringify(sm).includes('@'), 'لا بُرُد في الملخص'); assert.equal((orgPairSummary(null, null, null, 2) as any).invites_in, 2, 'بلا عهد: عدد الدعوات');
  assert.equal(jointDecision('renew', null), null, 'ينتظر'); assert.equal(jointDecision('renew', 'renew'), 'renew', 'اتفقا'); assert.equal(jointDecision('close', 'renew'), 'close', 'أحدهما يطوي → طيّ');
  assert.equal(orgInviteExpired({ status: 'invited', invited_at: ago(13), accepted_at: null }, NOW), false, '13 يومًا'); assert.equal(orgInviteExpired({ status: 'invited', invited_at: ago(14), accepted_at: null }, NOW), true, '14 يومًا'); assert.equal(orgInviteExpired({ status: 'proposing', invited_at: ago(30), accepted_at: ago(15) }, NOW), true, 'مهلة الاقتراح');
  assert.equal(orgReviewOpen({ status: 'active', review_at: ago(1) }, NOW), true, 'مفتوحة'); assert.equal(orgReviewOpen({ status: 'active', review_at: addDays(new Date(NOW), 1) }, NOW), false, 'ليست بعد');
  assert.equal(orgPairEvents([basePair(), basePair({ status: 'revoked' }), basePair({ signed_at: null })]).length, 1, 'أحداث رحلة الجهة: الموقَّع غير المسحوب فقط');
});

test('P30 القراءة: جهتي وميثاقها · منسوب مؤكَّد · شهادة المنصة (طلب مقعد يذكر بريده) · مديرو الجهة · الدعوة العمياء لا تظهر للمنسوب · عهد حيّ واحد', async () => {
  const db = fakeDb({
    portal_organizations: [{ id: ORG, name_ar: 'جامعة أَثَر' }],
    portal_org_charters: [{ organization_id: ORG, status: 'active', signed_at: ago(100), expires_at: addDays(new Date(NOW), 265) }],
    portal_org_members: [{ organization_id: ORG, user_id: ADM.id, email: ADM.email, full_name: ADM.name, role: 'org_admin', status: 'confirmed' }, { organization_id: ORG, user_id: M.id, email: M.email, full_name: M.name, role: 'member', status: 'confirmed' }, { organization_id: ORG, user_id: 'u9', email: 'pending@athar.university', full_name: 'م', role: 'member', status: 'pending' }],
    portal_org_seat_requests: [{ organization_id: ORG, created_at: ago(5), status: 'open', matched_council_id: null, people: [{ email: 'NOURA@athar.university', name: 'نورة' }] }, { organization_id: ORG, created_at: ago(9), status: 'open', matched_council_id: null, people: [{ email: 'other@athar.university' }] }],
    portal_org_pair_pledges: [
      basePair({ id: 'blind', status: 'invited', invited_by: 'org', member_step: null, org_step: null, signed_at: null, invited_at: ago(1), meta: { blind: true, blind_reason: 'not_eligible' } }),
      basePair({ id: 'real', status: 'invited', invited_by: 'org', member_step: null, org_step: null, signed_at: null, invited_at: ago(2) }),
      basePair({ id: 'old', status: 'invited', invited_by: 'org', member_step: null, org_step: null, signed_at: null, invited_at: ago(20) }),
      basePair({ id: 'live', status: 'active', signed_at: ago(10), review_at: addDays(new Date(NOW), 355) }),
      basePair({ id: 'past', status: 'closed', reviewed_at: ago(400) }),
    ],
  });
  db.T.portal_org_pair_pledges.forEach((r: any) => { /* المعرّفات من البذرة */ });
  const org = await myOrg(db, M as any); assert.equal(org?.name_ar, 'جامعة أَثَر', 'جهتي'); assert.equal(org?.charter?.status, 'active', 'ميثاقها'); assert.equal(await myOrg(db, { id: 'zz', email: 'ghost@x.sa' } as any), null, 'بلا جهة');
  assert.equal((await isConfirmedMember(db, ORG, { id: '', email: 'NOURA@athar.university' })).ok, true, 'منسوب مؤكَّد (بلا حساسية حالة)'); assert.equal((await isConfirmedMember(db, ORG, { id: '', email: 'pending@athar.university' })).ok, false, 'غير مؤكَّد');
  const w = await orgWitness(db, ORG, M, emptyInput()); assert.equal(w.seat_requests.length, 2, 'طلبا مقاعد'); assert.equal(w.seat_requests.filter(r => r.includes_member).length, 1, 'واحد يذكر بريده'); assert.equal(w.seat_requests.find(r => r.includes_member)!.created_at, ago(5), 'هو الأحدث');
  const admins = await orgAdmins(db, ORG); assert.equal(admins.length, 1, 'مدير واحد'); assert.equal(admins[0].email, ADM.email, 'بريده');
  const rows = await loadMemberOrgPairs(db, M as any); assert.equal(rows.length, 5, 'كل صفوفي'); const sp = splitOrgPairs(rows, NOW); assert.equal(sp.live?.id, 'live', 'العهد الحيّ'); assert.equal(sp.invites.map(i => i.id).sort().join(), 'blind,real', 'الدعوات القائمة (العمياء هنا خام؛ تُرشَّح في الحالة)'); assert.equal(sp.past.length, 1, 'السابقة');
  const st = await loadMemberOrgPairState(db, M as any, NOW); assert.equal(st.invites_in.some(i => i.id === 'blind'), false, 'العمياء لا تظهر للمنسوب'); assert.equal(st.invites_in.some(i => i.id === 'real'), true, 'الحقيقية تظهر'); assert.equal(st.is_org_admin, false, 'ليس مديرًا'); assert.equal(st.org_eligible.ok, true, 'الجهة مؤهَّلة'); assert.equal(st.eligible.ok, false, 'بلا فصول في هذه البذرة'); assert.equal(st.live?.id, 'live', 'الحيّ'); assert.ok(st.paths.member_path && st.paths.org_path, 'دربان');
  const adm = await loadMemberOrgPairState(db, ADM as any, NOW); assert.equal(adm.is_org_admin, true, 'المدير يُعرف');
});

test('P30 الوثيقة الواحدة بحاملَين: kind=org_pair_pledge · شخص + جهة «بصفته» · بلا بُرُد ولا «لماذا» · Ed25519 تتحقق · حدث للمنسوب باسم الجهة · السحب يسحب الوثيقة', async () => {
  const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, SITE)!; assert.ok(signer, 'موقّع');
  const p = basePair({ status: 'proposing', signed_at: null, expires_at: null, review_at: null, code: null });
  const db = fakeDb({ portal_org_pair_pledges: [p] }); db.T.portal_org_pair_pledges[0].id = 'p1';
  const r = await activateOrgPair(db, p, signer, SITE, DID, () => 'ABCD', new Date(NOW)); assert.ok(r.ok, 'تفعيل'); if (!r.ok) return;
  assert.equal(r.pair.status, 'active', 'نشط'); assert.equal(r.pair.code, 'ATH-PO-ABCD-ABCD', 'الرمز'); assert.equal(r.pair.review_at, addDays(new Date(NOW), 365), 'المراجعة بعد سنة'); assert.ok(r.verify_url?.includes('ATH-PO'), 'رابط التحقق');
  const vc = db.T.portal_vc_issuances[0]; assert.equal(vc.kind, 'org_pair_pledge', 'نوع الوثيقة'); assert.equal(vc.issued_by, ADM.id, 'أُصدرت بيد موقّع الجهة'); const doc = vc.vc; const txt = JSON.stringify(doc);
  assert.equal(/[\w.+-]+@[\w-]+\.[\w.]+/.test(txt), false, 'لا بُرُد في الوثيقة'); assert.ok(!txt.includes(p.invite_why_ar) && !txt.includes(mStep.why_ar) && !txt.includes(oStep.why_ar), 'لا كلمات «لماذا»');
  assert.equal(doc._athar.kind, 'org_pair_pledge', '_athar.kind'); assert.equal(doc._athar.holders.length, 2, 'حاملان'); assert.equal(doc._athar.holders[0].role, 'practitioner', 'شخص'); assert.equal(doc._athar.holders[1].role, 'organization', 'جهة'); assert.match(doc._athar.holders[1].signed_as_ar, /بصفته/, 'بصفته لا باسمه'); assert.equal(doc.credentialSubject.name, 'نورة · جامعة أَثَر', 'اسم الموضوع'); assert.match(doc.credentialSubject.achievement.criteria.narrative, /مهمة واحدة.*تأكيد مهامي/, 'الخطوتان');
  assert.equal(structuralChecks(doc).filter(c => !c.ok).length, 0, 'بنية سليمة'); assert.equal((await verifySignature(doc, localResolver(signer, []))).ok, true, 'التوقيع يتحقق');
  const ev = db.T.portal_learning_events; assert.equal(ev.length, 1, 'حدث واحد — للمنسوب'); assert.equal(ev[0].object_type, 'org_pair', 'org_pair'); assert.equal(ev[0].verb, 'pledged', 'pledged'); assert.equal(ev[0].context.org, 'جامعة أَثَر', 'اسم الجهة في السياق'); assert.equal(ev[0].context.org_kind, 'missions', 'نوع خطوة الجهة');
  const doc2 = buildOrgPairDoc({ code: 'ATH-PO-X-Y', memberName: 'ممارس', orgName: 'الجهة', memberStep: mStep, orgStep: oStep, site: SITE, did: DID, expires: addDays(new Date(NOW), 365), statusIndex: null }); assert.equal(doc2.credentialStatus, undefined, 'بلا حالة حين لا فهرس'); assert.equal(doc2._athar.holders[1].step.kind_ar, ORG_STEP_KIND_AR.missions, 'نوع بالعربية');
  const rv = await revokeOrgPair(db, r.pair, new Date(NOW + 1000)); assert.equal(rv.ok, true, 'سحب'); assert.equal(db.T.portal_org_pair_pledges[0].status, 'revoked', 'حالة'); assert.ok(db.T.portal_vc_issuances[0].revoked_at, 'الوثيقة مسحوبة');
  assert.equal((await revokeOrgPair(db, { ...r.pair, status: 'closed' } as OrgPair)).ok, false, 'المطوي لا يُسحب');
  const noSigner = await activateOrgPair(fakeDb({ portal_org_pair_pledges: [{ ...p, id: 'p2' }] }), { ...p, id: 'p2' }, null, SITE, DID, () => 'Q', new Date(NOW)); assert.ok(noSigner.ok && !noSigner.signed_vc && noSigner.pair.vc_issuance_id === null, 'بلا مفتاح: يُفعَّل بلا وثيقة');
  assert.equal((await activateOrgPair(db, { ...p, org_step: null }, signer, SITE, DID, () => 'Q', new Date(NOW))).ok, false, 'بلا خطوتين لا تفعيل');
});

test('P30 الكرون: انقضاء 14 يومًا · «خطوة المنسوب وقعت» للجهة و«خطوة الجهة وقعت» للمنسوب مرة واحدة · منتصف السنة مرة · فتح المراجعة · طيّ بعد 30 يومًا', async () => {
  const inv = basePair({ id: 'inv', status: 'invited', invited_at: ago(15), member_step: null, org_step: null, signed_at: null, review_at: null });
  const fresh = basePair({ id: 'fresh', status: 'invited', invited_at: ago(3), member_step: null, org_step: null, signed_at: null, review_at: null });
  const prop = basePair({ id: 'prop', status: 'proposing', accepted_at: ago(15), signed_at: null, review_at: null });
  const seatStep: OrgStep = { ...oStep, kind: 'seat', target: { count: 1 } };
  const mid = basePair({ id: 'mid', status: 'active', signed_at: ago(200), review_at: addDays(new Date(NOW), 165), expires_at: addDays(new Date(NOW), 165), org_step: seatStep });
  const due = basePair({ id: 'due', status: 'active', signed_at: ago(365), review_at: ago(0) });
  const stale = basePair({ id: 'stale', status: 'review', review_at: ago(31), member_decision: 'renew', member_reviewed_at: ago(20), member_review_ar: 'كلمات' });
  const db = fakeDb({
    portal_org_pair_pledges: [inv, fresh, prop, mid, due, stale],
    portal_org_members: [{ organization_id: ORG, user_id: ADM.id, email: ADM.email, full_name: ADM.name, role: 'org_admin', status: 'confirmed' }],
    portal_missions: [{ user_id: M.id, email: M.email, title_ar: 'مهمة', confirmed_at: ago(10), submitted_at: ago(12), status: 'confirmed', skills: [] }],
    portal_org_seat_requests: [{ organization_id: ORG, created_at: ago(150), status: 'matched', matched_council_id: C1, people: [{ email: M.email }] }],
    portal_council_members: [{ user_id: M.id, email: M.email, council_id: C1, joined_at: ago(120), status: 'active' }],
    portal_councils: [{ id: C1, title_ar: 'مجلس القادة' }],
  });
  db.T.portal_org_pair_pledges.forEach((r: any, i: number) => { r.id = [inv, fresh, prop, mid, due, stale][i].id; });
  const dry = await runOrgPair(db, { dry: true, site: SITE, now: new Date(NOW) }); assert.equal(dry.expired, 2, 'جاف: دعوة + اقتراح منقضيان'); assert.equal(dry.nudged, 1, 'جاف: منتصف'); assert.equal(dry.opened, 1, 'جاف: فتح'); assert.equal(dry.closed, 1, 'جاف: طيّ'); assert.equal(db.T.portal_org_pair_pledges.find((r: any) => r.id === 'inv').status, 'invited', 'الجاف لا يكتب');
  const r1 = await runOrgPair(db, { site: SITE, now: new Date(NOW) }); assert.equal(r1.errors.length, 0, `بلا أخطاء: ${r1.errors.join(' | ')}`);
  const by = (id: string) => db.T.portal_org_pair_pledges.find((r: any) => r.id === id);
  assert.equal(by('inv').status, 'expired', 'انقضت'); assert.equal(by('fresh').status, 'invited', 'الطازجة باقية'); assert.equal(by('prop').status, 'expired', 'مهلة الاقتراح انقضت');
  assert.equal(by('mid').meta.nudged_at ? 1 : 0, 1, 'نُبّه منتصف السنة'); assert.equal(by('due').status, 'review', 'فُتحت المراجعة'); assert.equal(by('stale').status, 'closed', 'طُويت — الجهة لم تراجع'); assert.equal(by('stale').reviewed_at ? 1 : 0, 1, 'تاريخ الطيّ');
  assert.equal(r1.step_notices, 3, 'mid: خطوة المنسوب (مهمة مؤكَّدة بعد التوقيع) وخطوة الجهة (مقعد + جلوس) · due: خطوة المنسوب'); assert.equal(by('due').meta.org_done_notified, undefined, 'due: مهمة واحدة في مهلتها من 3 → خطوة الجهة لم تقع'); assert.equal(by('mid').meta.member_done_notified ? 1 : 0, 1, 'سُجّل إشعار الجهة'); assert.equal(by('mid').meta.org_done_notified ? 1 : 0, 1, 'سُجّل إشعار المنسوب');
  const r2 = await runOrgPair(db, { site: SITE, now: new Date(NOW + 864e5) }); assert.equal(r2.nudged, 0, 'لا تنبيه ثانٍ'); assert.equal(r2.step_notices, 0, 'لا إشعار ثانٍ'); assert.equal(r2.opened, 0, 'لا فتح ثانٍ');
});

test('P30 رحلتي: فصل «عهد مع جهتي» باسم الجهة · رحلة الجهة: «عهود مع منسوبين» من 5 منسوبين متمايزين · الخزنة · MCP', () => {
  const inp = emptyInput({ events: [
    { at: ago(300), verb: 'pledged', object_type: 'org_pair', object_id: 'p1', skills: [], context: { code: 'ATH-PO-A-B', kind: 'mission', title_ar: 'مهمة واحدة', org: 'جامعة أَثَر', org_kind: 'missions' } },
    { at: ago(1), verb: 'reviewed', object_type: 'org_pair', object_id: 'p1', skills: [], context: { decision: 'renew', complete: true, org: 'جامعة أَثَر' } },
    { at: ago(2), verb: 'revoked', object_type: 'org_pair', object_id: 'p1', skills: [], context: {} },
  ] as any });
  const ch = buildChapters(inp).filter(c => c.kind === 'org_pair'); assert.equal(ch.length, 2, 'فصلان: العهد والمراجعة (السحب ليس فصلًا)'); assert.match(ch[0].what_ar, /جامعة أَثَر/, 'الجهة باسمها'); assert.match(ch[0].what_ar, /بصفته/, 'المدير بصفته'); assert.match(ch[1].title_ar, /جدّدناه/, 'التجديد'); assert.equal(ch.every(c => c.public_ok === false), true, 'ليس للنشر');
  assert.match(JSON.stringify(buildJourney(inp, NOW)), /عهد مع جهتك/, 'في القراءة'); assert.equal(buildJourney(inp, NOW).counts.org_pair, 2, 'العدّ');
  const members = Array.from({ length: 6 }, (_, i) => `m${i}@athar.university`); const five = members.slice(0, 5).map(m => ({ person: m, at: ago(30) })); const dup = [...five, { person: members[0], at: ago(29) }];
  const base = { members, daily_first: [], missions: [], joins: [], returns: [], attestations: [], levels: [], credentials: [], charters: [], twinnings: [], contracts: [] } as any;
  assert.equal(buildOrgChapters({ ...base, org_pairs: five.slice(0, 4) }).chapters.filter(c => c.kind === 'org_pair').length, 0, '4 منسوبين لا يكفون'); const okc = buildOrgChapters({ ...base, org_pairs: dup }).chapters.filter(c => c.kind === 'org_pair'); assert.equal(okc.length, 1, '5 منسوبين متمايزين (التكرار لا يُحسب) → فصل'); assert.match(okc[0].title_ar, /تعاهدوا مع الجهة/, 'العنوان'); assert.equal(ORG_KIND_AR.org_pair, 'عهود مع منسوبين', 'الاسم');
  const v = REGISTRY.find(r => r.table === 'portal_org_pair_pledges')!; assert.ok(v, 'في الخزنة'); assert.equal(v.policy, 'anonymize', 'تجهيل لا حذف (وثيقة بطرفين)'); assert.ok(v.piiCols.includes('org_signer_email'), 'بريد موقّع الجهة من البيانات الشخصية'); assert.ok(v.access.includes('org'), 'الجهة ترى');
  const plan = erasurePlan() as any; assert.ok((plan.anonymize || []).some((x: any) => (x.table || x) === 'portal_org_pair_pledges'), 'خطة النسيان: تجهيل');
  const t = ALL_MCP_TOOLS.find((x: any) => x.name === 'my_horizon'); assert.ok(t, 'my_horizon موجودة — لا أداة جديدة'); assert.equal(ALL_MCP_TOOLS.some((x: any) => /org_pair/.test(x.name)), false, 'لا أداة MCP جديدة');
});
