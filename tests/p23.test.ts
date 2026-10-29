// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P23 — «مجالس أَثَر»: الميثاق والثوابت · النصاب ودوران الكرسي · المُوفِّق (5–7 من ≥ 2 جهة، تقارب المستوى) · كاتب المجلس (تجهيل · ملخص محلي · أنماط)
//                 · المرآة (مقارنة الذات) · شهادات الأقران (تحقق · إنشاء · مَن يعتمد · اعتماد → وزن الدليل) · الشهادة (أهلية · وثيقة موقَّعة) · إغلاق الدورة · الحارس الزمني · الدائرة العامة المجهولة · الخزنة
import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNCIL_MIN, COUNCIL_MAX, MIN_ORGS, CYCLE_WEEKS, RETURN_DAYS, BADGE_CYCLES, K_ANON, CHARTER_AR, CHARTER_VERSION, quorum, nextChair, localThemes, publicCircle, feedFromPosts, cycleEnd, returnDue, THEMES_AR, themeLabel } from '../lib/councils/registry';
import type { Member, Case, Council, Attestation } from '../lib/councils/registry';
import { proposeCouncils } from '../lib/councils/match';
import { anonymizeThread, localScribe, scribePrompt } from '../lib/councils/scribe';
import { mirrorFromRows, mirrorLines, EMPTY_MIRROR } from '../lib/councils/mirror';
import { validateAttestation, createAttestation, approversFor, canDecide, decideAttestation, peerEvent, PEER_WEIGHT, PEER_APPROVED_WEIGHT } from '../lib/councils/attest';
import { badgeStats, badgeEligibility, buildCouncilBadgeDoc, issueBadge, badgeCode } from '../lib/councils/badge';
import { closeCycle, runCouncils } from '../lib/councils/cron';
import { EVIDENCE_WEIGHT, EVIDENCE_LABEL, evidenceFromEvent } from '../lib/portal/profile';
import { PERSONAL_SCOPES, PSCOPE_LABEL } from '../lib/portal/oauth';
import { REGISTRY, NON_PERSONAL_TABLES, erasurePlan } from '../lib/vault/registry';
import { signerFromEnv, verifySignature, localResolver } from '../lib/portal/vc-server';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const CID = '00000000-0000-4000-8000-0000000000c1'; const ORG1 = '00000000-0000-4000-8000-000000000021'; const ORG2 = '00000000-0000-4000-8000-000000000023'; const SK = '00000000-0000-4000-8000-0000000000a1';
const U = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

/** قاعدة وهمية في الذاكرة (نفس نمط P22) */
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {}; for (const [k, v] of Object.entries(seed)) T[k] = v.map((r, i) => ({ id: i + 1, ...r }));
  const rpcCalls: any[] = []; const table = (t: string) => (T[t] = T[t] || []);
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
    T, rpcCalls,
    rpc: async (name: string, args: any) => { rpcCalls.push({ name, args }); return { data: null, error: { message: 'no rpc in fake: ' + name } }; },
    from: (t: string) => {
      const q: any = { _f: [], _order: null, _limit: 0, _single: false, _op: 'select', _payload: null };
      const run = () => {
        const rows = table(t);
        if (q._op === 'insert') { const arr = Array.isArray(q._payload) ? q._payload : [q._payload]; const ins = arr.map((p: any) => ({ id: rows.length + 1 + Math.floor(Math.random() * 1e6), created_at: new Date().toISOString(), ...p })); rows.push(...ins); return { data: q._single ? ins[0] : ins, error: null }; }
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
const mem = (n: number, org: string, extra: Partial<Member> = {}): Member => ({ id: n, created_at: `2026-09-0${n}T00:00:00Z`, council_id: CID, user_id: U(n), email: `m${n}@x.sa`, full_name: `عضو ${n}`, organization_id: org, role: n === 1 ? 'chair' : 'member', status: 'active', charter_signed_at: '2026-09-10T00:00:00Z', joined_at: `2026-09-0${n}T00:00:00Z`, left_at: null, cycles_completed: 0, meta: {}, ...extra });
const council = (extra: Partial<Council> = {}): Council => ({ id: CID, created_at: '2026-09-01T00:00:00Z', title_ar: 'مجلس قادة الصف الأول', domain: 'leadership', sector_code: 'EDU', skill_ids: [SK], status: 'active', cycle_no: 1, cycle_weeks: 6, cycle_started_at: '2026-09-10T00:00:00Z', cycle_ends_at: '2026-10-22T00:00:00Z', chair_email: 'm1@x.sa', charter_version: CHARTER_VERSION, max_members: 7, min_orgs: 2, meta: {}, ...extra });
const five = () => [mem(1, ORG1), mem(2, ORG1), mem(3, ORG2), mem(4, ORG2), mem(5, ORG1)];

test('P23-1 الثوابت والميثاق: 5–7 أعضاء · ≥ 2 جهة · 6 أسابيع · عودة 14 يومًا · 3 دورات للشهادة · k≥5 · ميثاق من 6 بنود بلا تقييم رقمي', () => {
  assert.equal(COUNCIL_MIN, 5, 'min'); assert.equal(COUNCIL_MAX, 7, 'max'); assert.equal(MIN_ORGS, 2, 'orgs'); assert.equal(CYCLE_WEEKS, 6, 'weeks'); assert.equal(RETURN_DAYS, 14, 'return'); assert.equal(BADGE_CYCLES, 3, 'badge'); assert.equal(K_ANON, 5, 'k');
  assert.ok(CHARTER_AR.length >= 5, 'charter clauses'); assert.ok(CHARTER_AR.some(c => c.body.includes('يبقى')), 'confidentiality clause'); assert.ok(CHARTER_AR.some(c => c.id === 'ask_first'), 'ask-first clause');
  assert.equal(cycleEnd('2026-09-10T00:00:00Z').slice(0, 10), '2026-10-22', 'cycle end = +42d'); assert.equal(returnDue('2026-10-01T00:00:00Z').slice(0, 10), '2026-10-15', 'return +14d');
  assert.equal(THEMES_AR.length, 10, 'themes'); assert.equal(themeLabel('conflict'), 'إدارة الخلاف وتحويل الصراع إلى مصالح', 'label');
});

test('P23-2 النصاب ودوران الكرسي: ≥ 3 موقّعين من ≥ 2 جهة · الكرسي ينتقل لمن لم يرأس بعد بترتيب الانضمام', () => {
  const ms = five(); assert.deepEqual(quorum(ms), { signed: 5, orgs: 2, ok: true, full: true }, 'quorum full');
  assert.equal(quorum(ms.map(m => ({ ...m, organization_id: ORG1 }))).ok, false, 'one org → no quorum');
  assert.equal(quorum(ms.map((m, i) => ({ ...m, charter_signed_at: i < 2 ? m.charter_signed_at : null }))).ok, false, '2 signed → no quorum');
  assert.equal(nextChair(ms, 'm1@x.sa')!.email, 'm2@x.sa', 'next never-chaired by join order');
  const all = ms.map(m => ({ ...m, meta: { chaired_cycles: [1] } })); assert.equal(nextChair(all, 'm2@x.sa')!.email, 'm3@x.sa', 'all chaired → rotate');
  assert.equal(nextChair(ms.map(m => ({ ...m, status: 'left' as const })), 'm1@x.sa'), null, 'no active → null');
});

test('P23-3 المُوفِّق: يقترح 5 من ≥ 2 جهة بمستويات متقاربة، يستبعد من هم في مجلس منعقد، المتقدمون أولًا', () => {
  const cands = [
    { user_id: U(1), email: 'a@o1', full_name: 'أ', organization_id: ORG1, level: 3, evidence: 5, applied: true },
    { user_id: U(2), email: 'b@o1', full_name: 'ب', organization_id: ORG1, level: 3, evidence: 2 },
    { user_id: U(3), email: 'c@o2', full_name: 'ج', organization_id: ORG2, level: 3.5, evidence: 4 },
    { user_id: U(4), email: 'd@o2', full_name: 'د', organization_id: ORG2, level: 2.5, evidence: 1 },
    { user_id: U(5), email: 'e@o3', full_name: 'هـ', organization_id: 'o3', level: 3, evidence: 3 },
    { user_id: U(6), email: 'f@o1', full_name: 'و', organization_id: ORG1, level: 5, evidence: 9, in_council: true },
    { user_id: U(7), email: 'g@o1', full_name: 'ز', organization_id: ORG1, level: 1, evidence: 0 },
  ];
  const p = proposeCouncils(cands); assert.equal(p.length, 1, 'one proposal'); assert.equal(p[0].members.length, 5, 'size 5'); assert.ok(p[0].orgs >= 2, 'orgs ≥ 2');
  assert.ok(!p[0].members.some(m => m.email === 'f@o1'), 'in_council excluded'); assert.ok(p[0].members.some(m => m.email === 'a@o1'), 'applicant included'); assert.ok(p[0].level_spread <= 2, 'levels close');
  assert.equal(proposeCouncils(cands.slice(0, 4)).length, 0, '< 5 → nothing'); assert.equal(proposeCouncils(cands.slice(0, 5).map(c => ({ ...c, organization_id: ORG1 }))).length, 0, 'single org → nothing');
});

test('P23-4 كاتب المجلس: التجهيل يحذف الأسماء والبريد · الملخص المحلي يرصد «نُصح قبل أن يُسأل» · الأنماط من النص · موجه الذكاء يمنع الأسماء والحكم', () => {
  const c = { author_email: 'm1@x.sa', title_ar: 'خلاف مع مدير الإدارة حول التغيير', body_ar: 'الموقف…', commitment_ar: null, return_ar: null, return_outcome: null, status: 'open' as const };
  const posts = [{ email: 'm3@x.sa', kind: 'advice' as const, body_ar: 'راسل m1@x.sa مباشرة', created_at: '2026-10-01T01:00:00Z' }, { email: 'm2@x.sa', kind: 'advice' as const, body_ar: 'نصيحة ثانية', created_at: '2026-10-01T00:00:00Z' }];
  const a = anonymizeThread(c, posts); assert.ok(!a.text.includes('m1@x.sa') && !a.text.includes('m3@'), 'no emails'); assert.ok(a.text.includes('عضو 1') && a.text.includes('عضو 2'), 'numbered members'); assert.equal(a.participants, 2, 'participants');
  const s = localScribe(c, posts, 'deliberation'); assert.ok(s.unsaid_ar && s.unsaid_ar.includes('قبل أن يُسأل'), 'advice-before-question flagged'); assert.ok(s.patterns.includes('conflict') || s.patterns.includes('change') || s.patterns.includes('upward'), 'patterns from text');
  assert.deepEqual(localThemes('إرهاق واحتراق وتوازن'), ['wellbeing'], 'themes'); assert.equal(localThemes('').length, 0, 'empty');
  const pr = scribePrompt('return'); assert.ok(pr.system.includes('لا تحكم') || pr.system.includes('لا الحكم') || pr.system.includes('أسماء'), 'no-judgement/no-names rule in prompt'); assert.ok(pr.system.includes('JSON'), 'json output'); assert.equal(pr.parse('نص بلا json'), null, 'bad json → null'); assert.equal(pr.parse('{"summary_ar":"م","patterns":["conflict","zzz"]}')!.patterns.join(), 'conflict', 'unknown patterns dropped');
});

test('P23-5 المرآة: تحسب من الصفوف وتقارن بالذات لا بالآخرين', () => {
  const cases: Case[] = [{ id: 'c1', created_at: '2026-09-12T00:00:00Z', council_id: CID, cycle_no: 1, author_user_id: U(1), author_email: 'm1@x.sa', title_ar: 'ق', body_ar: 'ب', kind: 'text', media_id: null, status: 'returned', commitment_ar: 'سأفعل', committed_at: '2026-09-15T00:00:00Z', return_due_at: '2026-09-29T00:00:00Z', return_ar: 'فعلت', return_outcome: 'succeeded', returned_at: '2026-10-02T00:00:00Z', closed_at: null, theme: 'conflict' }];
  const posts: any[] = [{ id: 1, case_id: 'c1', council_id: CID, email: 'm1@x.sa', kind: 'question', body_ar: 'س', created_at: '2026-09-13T00:00:00Z' }, { id: 2, case_id: 'c1', council_id: CID, email: 'm1@x.sa', kind: 'advice', body_ar: 'ن', created_at: '2026-09-13T00:00:00Z' }, { id: 3, case_id: 'c1', council_id: CID, email: 'm1@x.sa', kind: 'advice', body_ar: 'ن', created_at: '2026-09-13T00:00:00Z' }, { id: 4, case_id: 'c1', council_id: CID, email: 'm2@x.sa', kind: 'question', body_ar: 'س', created_at: '2026-09-13T00:00:00Z' }];
  const m = mirrorFromRows('m1@x.sa', cases, posts, [{ to_email: 'm1@x.sa', from_email: 'm2@x.sa', status: 'approved', council_id: CID, cycle_no: 1 } as any], 1);
  assert.equal(m.questions, 1, 'q'); assert.equal(m.advice, 2, 'a'); assert.equal(m.commitments, 1, 'commit'); assert.equal(m.returns, 1, 'returns'); assert.equal(m.returns_late, 1, 'late'); assert.equal(m.received, 1, 'received');
  const lines = mirrorLines(m, { ...EMPTY_MIRROR, questions: 0 }); assert.ok(lines.find(l => l.key === 'ratio')!.tone === 'note', 'advice>questions → note'); assert.ok(lines.some(l => l.key === 'trend' && l.tone === 'good'), 'self-comparison trend');
  assert.ok(!lines.some(l => /m2@|عضو 2|أفضل من/.test(l.text)), 'no comparison with others');
  assert.equal(mirrorLines(EMPTY_MIRROR, null)[0].key, 'voice', 'silent member nudge');
});

test('P23-6 شهادة الأقران: لا لنفسك · لأعضاء نشطين · مهارة المجلس · دليل ≥ 20 حرفًا · لا تكرار · حدث تعلّم بوزن منخفض ثم يرتفع بالاعتماد', async () => {
  const ms = five(); const base = { council_id: CID, case_id: null, cycle_no: 1, from: { id: U(1), email: 'm1@x.sa' }, to_email: 'm3@x.sa', skill_id: SK, evidence_ar: 'رأيته يعيد صياغة الخلاف إلى مصالح مشتركة أمام الفريق' };
  assert.equal(validateAttestation(base, ms, [SK]), null, 'valid'); assert.ok(validateAttestation({ ...base, to_email: 'm1@x.sa' }, ms, [SK])!.includes('لنفسك'), 'self'); assert.ok(validateAttestation({ ...base, to_email: 'zz@x.sa' }, ms, [SK])!.includes('المشهود'), 'not member');
  assert.ok(validateAttestation({ ...base, skill_id: 'other' }, ms, [SK])!.includes('المهارة'), 'skill'); assert.ok(validateAttestation({ ...base, evidence_ar: 'جيد' }, ms, [SK])!.includes('20'), 'evidence length');
  const db = fakeDb({ portal_council_attestations: [], portal_learning_events: [] });
  const r1 = await createAttestation(db, base, ms, [SK], { skill_name: 'إدارة الخلاف' }); assert.ok(r1.ok && !r1.duplicate, 'created'); assert.equal(db.T.portal_learning_events.length, 1, 'event inserted'); assert.equal(db.T.portal_learning_events[0].verb, 'attested', 'verb'); assert.equal(db.T.portal_learning_events[0].context.approved, false, 'not approved yet');
  const r2 = await createAttestation(db, base, ms, [SK]); assert.ok(r2.ok && r2.duplicate, 'duplicate blocked'); assert.equal(db.T.portal_council_attestations.length, 1, 'one row');
  // الوزن: peer 0.4 → 0.75 بعد الاعتماد (أقل من approved 1.0 — لا يغيّر المستوى المعتمد)
  assert.equal(EVIDENCE_WEIGHT.peer, PEER_WEIGHT, 'peer weight registered'); assert.equal(PEER_APPROVED_WEIGHT, 0.75, 'approved weight'); assert.ok(EVIDENCE_LABEL.peer.ar.includes('أقران'), 'label');
  const ev = peerEvent(r1.ok ? r1.row : (null as any), true); const k = evidenceFromEvent({ verb: ev.verb, object_type: ev.object_type, context: ev.context, skills: ev.skills, at: new Date().toISOString() } as any, new Map()); assert.equal(k[0]?.e.kind, 'peer', 'event → peer evidence'); assert.equal(k[0]?.e.weight, PEER_APPROVED_WEIGHT, 'approved weight');
});

test('P23-7 مَن يعتمد: مدير جهة المشهود له أولًا · الطاقم احتياطًا · لا يعتمد أحد شهادة لنفسه · الاعتماد يحدّث الحدث', async () => {
  const db = fakeDb({ portal_org_members: [{ organization_id: ORG2, email: 'm3@x.sa', user_id: U(3), role: 'member', status: 'confirmed' }, { organization_id: ORG2, email: 'boss@x.sa', user_id: U(9), role: 'org_admin', status: 'confirmed' }], portal_council_attestations: [{ council_id: CID, case_id: null, cycle_no: 1, from_user_id: U(1), from_email: 'm1@x.sa', to_user_id: U(3), to_email: 'm3@x.sa', skill_id: SK, evidence_ar: 'دليل محدد طويل بما يكفي للاختبار', status: 'pending', event_id: 1 }], portal_learning_events: [{ user_id: U(3), email: 'm3@x.sa', verb: 'attested', object_type: 'council', object_id: '1', skills: [SK], context: { approved: false, peer: true } }] });
  const a = db.T.portal_council_attestations[0];
  const ap = await approversFor(db, a); assert.equal(ap.role, 'org_admin', 'org admin first'); assert.deepEqual(ap.emails, ['boss@x.sa'], 'boss');
  assert.equal(await canDecide(db, a, { id: U(9), email: 'boss@x.sa', staff: false }), 'org_admin', 'boss can'); assert.equal(await canDecide(db, a, { id: U(2), email: 'm2@x.sa', staff: false }), null, 'peer cannot'); assert.equal(await canDecide(db, a, { id: U(3), email: 'm3@x.sa', staff: true }), null, 'never self'); assert.equal(await canDecide(db, a, { id: 'st', email: 'staff@x.sa', staff: true }), 'staff', 'staff fallback'); assert.equal(await canDecide(db, a, { id: U(9), email: 'boss@x.sa', staff: true }), 'org_admin', 'org admin precedence even for staff');
  const noAdmin = fakeDb({ portal_org_members: [{ organization_id: ORG1, email: 'm2@x.sa', role: 'member', status: 'confirmed' }] }); assert.equal((await approversFor(noAdmin, { to_email: 'm2@x.sa', to_user_id: null })).role, 'staff', 'no admin → staff');
  const d = await decideAttestation(db, a.id, { by: { id: U(9), email: 'boss@x.sa' }, role: 'org_admin', approve: true }); assert.ok(d.ok, 'decided'); assert.equal(db.T.portal_council_attestations[0].status, 'approved', 'approved'); assert.equal(db.T.portal_council_attestations[0].approver_role, 'org_admin', 'role recorded'); assert.equal(db.T.portal_learning_events[0].context.approved, true, 'event upgraded');
  const again = await decideAttestation(db, a.id, { by: { id: 'st', email: 's@x' }, role: 'staff', approve: false }); assert.equal(again.ok, false, 'no double decision');
});

test('P23-8 شهادة عضو مجلس: الأهلية (3 دورات · 3 شهادات معتمدة · عودة) · وثيقة OpenBadge موقَّعة Ed25519 بأرقام فقط', async () => {
  const ms = [mem(1, ORG1, { cycles_completed: 2 }), { ...mem(1, ORG1, { cycles_completed: 1 }), id: 9, council_id: 'other' }];
  const cases: Case[] = [{ id: 'c', created_at: '', council_id: CID, cycle_no: 1, author_user_id: U(1), author_email: 'm1@x.sa', title_ar: 'سر', body_ar: 'سر', kind: 'text', media_id: null, status: 'closed', commitment_ar: 'x', committed_at: '', return_due_at: '', return_ar: 'y', return_outcome: 'succeeded', returned_at: '2026-10-01', closed_at: null, theme: null }];
  const atts = [1, 2, 3].map(i => ({ to_email: 'm1@x.sa', from_email: `m${i + 1}@x.sa`, status: 'approved' } as Attestation));
  const s = badgeStats('m1@x.sa', ms, cases, atts, 7); assert.equal(s.councils, 2, 'councils'); assert.equal(s.cycles, 3, 'cycles summed'); assert.equal(s.returns, 1, 'returns'); assert.equal(s.attestations_received, 3, 'received');
  assert.equal(badgeEligibility(s).ok, true, 'eligible'); const not = badgeEligibility({ ...s, cycles: 1, attestations_received: 1, returns: 0 }); assert.equal(not.ok, false, 'not'); assert.equal(not.missing_ar.length, 3, '3 missing');
  const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, 'https://athar.example'); assert.ok(signer, 'signer');
  const doc = buildCouncilBadgeDoc({ code: 'ATH-C-AAAA-BBBB', name: 'عضو 1', email: 'm1@x.sa', stats: s, site: 'https://athar.example', did: 'did:web:athar.example', statusIndex: null });
  const json = JSON.stringify(doc); assert.ok(!json.includes('سر'), 'no council content in badge'); assert.ok(json.includes('OpenBadgeCredential'), 'OB type'); assert.equal(doc.credentialSubject.result.find((r: any) => r.resultDescription === 'cycles_completed')!.value, '3', 'cycles in doc');
  const db = fakeDb({ portal_vc_issuances: [] }); let n = 0; const rnd = () => ['AAAA', 'BBBB', 'CCCC', 'DDDD'][n++ % 4];
  const r = await issueBadge(db, { id: U(1), email: 'm1@x.sa', name: 'عضو 1' }, s, signer!, 'https://athar.example', 'did:web:athar.example', rnd); assert.ok(r.ok && !r.existing, 'issued'); assert.ok(r.ok && r.code.startsWith('ATH-C-'), 'code prefix');
  const row = db.T.portal_vc_issuances[0]; assert.equal(row.kind, 'council_badge', 'kind'); assert.ok(row.vc?.proof, 'proof stored'); assert.ok(row.digest, 'digest stored');
  assert.equal((await verifySignature(row.vc, localResolver(signer!, []))).ok, true, 'Ed25519 verifies');
  const again = await issueBadge(db, { id: U(1), email: 'M1@x.sa', name: 'عضو 1' }, s, signer!, 'https://athar.example', 'did:web:athar.example', rnd); assert.ok(again.ok && again.existing, 'idempotent'); assert.equal(db.T.portal_vc_issuances.length, 1, 'one issuance');
});

test('P23-9 إغلاق الدورة: يُحتسب الفاعلون فقط · الكرسي يدور · الدورة التالية تبدأ بـ 6 أسابيع · الحارس الزمني يذكّر بالعودة ويغلق الدورات المنتهية ويصدر إشعارات', async () => {
  const ms = five(); const c = council();
  const db = fakeDb({ portal_councils: [{ ...c }], portal_council_members: ms.map(({ id: _id, ...m }) => m), portal_council_cases: [{ id: 'c1', council_id: CID, cycle_no: 1, author_email: 'm3@x.sa', status: 'committed', title_ar: 'ق', return_due_at: '2026-10-20T00:00:00Z', meta: {} }], portal_council_posts: [{ case_id: 'c1', council_id: CID, email: 'm1@x.sa', kind: 'question', body_ar: 'س', created_at: '2026-10-01T00:00:00Z' }, { case_id: 'c1', council_id: CID, email: 'm2@x.sa', kind: 'advice', body_ar: 'ن', created_at: '2026-10-01T00:00:00Z' }], portal_notifications: [], portal_contact_prefs: [] });
  const now = new Date('2026-10-23T00:00:00Z');
  const dry = await runCouncils(db, { dry: true, site: 'https://a.b', env: {}, now }); assert.equal(dry.cycles_closed, 1, 'dry: cycle due'); assert.equal(dry.return_reminders, 1, 'dry: late return'); assert.equal(db.T.portal_councils[0].cycle_no, 1, 'dry does not mutate');
  const r = await runCouncils(db, { site: 'https://a.b', env: {}, now }); assert.equal(r.cycles_closed, 1, 'closed'); assert.equal(r.return_reminders, 1, 'reminded');
  const cc = db.T.portal_councils[0]; assert.equal(cc.cycle_no, 2, 'next cycle'); assert.equal(cc.cycle_ends_at.slice(0, 10), '2026-12-04', '+42d'); assert.equal(cc.chair_email, 'm2@x.sa', 'chair rotated');
  const byEmail = (e: string) => db.T.portal_council_members.find((m: any) => m.email === e);
  assert.equal(byEmail('m1@x.sa').cycles_completed, 1, 'm1 counted (posted)'); assert.equal(byEmail('m3@x.sa').cycles_completed, 1, 'm3 counted (author)'); assert.equal(byEmail('m4@x.sa').cycles_completed, 0, 'silent m4 not counted'); assert.equal(byEmail('m1@x.sa').role, 'member', 'old chair demoted'); assert.equal(byEmail('m2@x.sa').role, 'chair', 'new chair');
  assert.equal(db.T.portal_council_cases[0].meta.reminded_stage, 'late', 'late stage stored');
  const r2 = await runCouncils(db, { site: 'https://a.b', env: {}, now }); assert.equal(r2.return_reminders, 0, 'no duplicate reminder'); assert.equal(r2.cycles_closed, 0, 'no re-close');
  const cl = await closeCycle(db, { ...c, ...db.T.portal_councils[0] }, new Date('2026-12-05T00:00:00Z')); assert.equal(cl.next_cycle, 3, 'manual close → 3'); assert.equal(cl.counted.length, 0, 'nothing active in cycle 2');
});

test('P23-10 الدائرة العامة المجهولة: لا أسماء ولا جهات ولا نص · نبض من المنشورات · مقاعد شاغرة', () => {
  const ms = five(); const c = council(); const now = new Date('2026-10-10T00:00:00Z').getTime();
  const cases: Case[] = [{ id: 'c1', created_at: '2026-10-05T00:00:00Z', council_id: CID, cycle_no: 1, author_user_id: U(1), author_email: 'm1@x.sa', title_ar: 'سري جدًا', body_ar: 'تفاصيل سرية', kind: 'text', media_id: null, status: 'open', commitment_ar: null, committed_at: null, return_due_at: null, return_ar: null, return_outcome: null, returned_at: null, closed_at: null, theme: 'conflict' }];
  const feed = feedFromPosts([{ case_id: 'c1', kind: 'question', email: 'm2@x.sa', created_at: '2026-10-09T12:00:00Z' }, { case_id: 'c1', kind: 'question', email: 'm3@x.sa', created_at: '2026-10-09T13:00:00Z' }, { case_id: 'c1', kind: 'evidence', email: 'm2@x.sa', created_at: '2026-10-09T14:00:00Z' }]);
  assert.deepEqual({ q: feed.c1.questions, e: feed.c1.evidence, v: feed.c1.voices }, { q: 2, e: 1, v: 2 }, 'feed');
  const pc = publicCircle(c, ms, cases, feed, now); const json = JSON.stringify(pc);
  assert.ok(!json.includes('m1@') && !json.includes('سري') && !json.includes(ORG1) && !json.includes('عضو 1'), 'anonymous'); assert.equal(pc.members, 5, 'members'); assert.equal(pc.orgs, 2, 'orgs'); assert.equal(pc.seats_open, 2, 'seats'); assert.equal(pc.pulse, 'lively', 'pulse'); assert.equal(pc.case!.theme_ar, themeLabel('conflict'), 'theme label only'); assert.equal(pc.case!.opened_days, 5, 'days');
  assert.equal(publicCircle(c, ms, [], {}, now).pulse, 'quiet', 'no case → quiet');
});

test('P23-11 التكامل: نطاق council:write للوكلاء · الخزنة تعرف الجداول الست · النسيان يجهّل المداولات ولا يحذف حكمة المجلس', () => {
  assert.ok(PERSONAL_SCOPES.includes('council:write' as any), 'scope'); assert.ok(PSCOPE_LABEL['council:write'].ar.includes('مجلس'), 'scope label');
  const tables = ['portal_council_members', 'portal_council_cases', 'portal_council_posts', 'portal_council_attestations']; for (const t of tables) assert.ok(REGISTRY.some(r => r.table === t), `registry ${t}`);
  assert.ok(NON_PERSONAL_TABLES.includes('portal_council_scribe'), 'scribe is non-personal (anonymized)');
  const plan = erasurePlan(); assert.ok(plan.anonymize.some(p => p.table === 'portal_council_cases'), 'cases anonymized not deleted (council memory stays)'); assert.ok(plan.anonymize.some(p => p.table === 'portal_council_posts'), 'posts anonymized');
  const att = REGISTRY.find(r => r.table === 'portal_council_attestations'); assert.ok(att && (att as any).alsoKeys && (att as any).alsoKeys.length, 'attestations erase both from/to keys');
});
