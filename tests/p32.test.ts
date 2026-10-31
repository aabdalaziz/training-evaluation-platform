// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P32 — «أَثَر للجميع» / «أَثَر يلبّي احتياجاتي»: الاحتياجات بكلمات الحاجة · «يناسبني» · k≥5 · مُضاعِف الوقت 1.5 في العهود
//                 · «نسخة أبسط» (محلي + بصمة الأصل + لا عرض قبل الاعتماد) · الترجمة الحيّة (دمج السطور · مقعد المترجم أولًا)
//                 · بلاغات الوصول · تعهّد الشمول في أفق الجهة · سياق شامل في «موقف اليوم» · خزنة أَثَر · بيان الوصول صادق
import test from 'node:test';
import assert from 'node:assert/strict';
import { NEEDS, NEED_LABEL, NEED_EFFECT_AR, FEATURES, FEATURE_LABEL, ACCESS_K, ACCESS_TIME_FACTOR, cleanNeeds, cleanFeatures, fitsNeeds, accessAttr, timeFactor, extendedDays, kAnon, textHash, localSimplify, parseSimplify, buildSimplifyPrompt, mergeCaption, orderTiles, validateReport, ACCESS_STATEMENT, PRIVACY_ACCESS_AR, isSimpleSource } from '../lib/inclusion/registry';
import type { CaptionMsg } from '../lib/inclusion/registry';
import { moreTimeEmails, pairTimeFactor, rowFactor, accessStats, requestSimpleText, getSimpleText, inclusionEvents, sharedNeedsFor, loadSourceText } from '../lib/inclusion/load';
import { inviteExpired, PAIR_INVITE_DAYS } from '../lib/pair/registry';
import { orgInviteExpired, ORG_PAIR_INVITE_DAYS } from '../lib/org-pair/registry';
import { splitPairs } from '../lib/pair/load';
import { proposeOrgPledges, buildOrgPath, ORG_PLEDGE_KIND_AR } from '../lib/org-horizon/registry';
import { INCLUSIVE_HINT_AR, inclusiveContextDay, buildCasePrompt } from '../lib/portal/daily-case';
import { REGISTRY, erasurePlan } from '../lib/vault/registry';
import { SERVICES, SERVICE_AR } from '../lib/directory/registry';
import { AI_LIMITS, AI_PURPOSE_LABEL } from '../lib/ai/prompts';

const NOW = new Date('2026-10-31T08:00:00Z'); const ago = (d: number) => new Date(NOW.getTime() - d * 864e5).toISOString();

function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {}; for (const [k, v] of Object.entries(seed)) T[k] = v.map((r, i) => ({ id: r.id ?? `${k}-${i + 1}`, ...r }));
  const table = (t: string) => (T[t] = T[t] || []);
  const match = (r: any, f: any): boolean => {
    switch (f.op) {
      case 'eq': return String(r[f.c]) === String(f.v);
      case 'in': return f.v.map(String).includes(String(r[f.c]));
      case 'is': return r[f.c] == null;
      default: return true;
    }
  };
  const db: any = {
    T, from: (t: string) => {
      const q: any = { _f: [], _limit: 0, _single: false, _op: 'select', _payload: null, _conflict: null };
      const run = () => {
        const rows = table(t);
        if (q._op === 'insert') { const arr = Array.isArray(q._payload) ? q._payload : [q._payload]; const ins = arr.map((p: any) => ({ id: rows.length + 1, created_at: NOW.toISOString(), ...p })); rows.push(...ins); return { data: q._single ? ins[0] : ins, error: null }; }
        if (q._op === 'upsert') { const p = q._payload; const keys = String(q._conflict || 'id').split(','); const ex = rows.find(r => keys.every(k => String(r[k]) === String(p[k]))); if (ex) { Object.assign(ex, p); return { data: ex, error: null }; } const row = { id: rows.length + 1, created_at: NOW.toISOString(), ...p }; rows.push(row); return { data: row, error: null }; }
        let sel = rows.filter(r => q._f.every((f: any) => match(r, f)));
        if (q._op === 'update') { for (const r of sel) Object.assign(r, q._payload); return { data: q._single ? sel[0] || null : sel, error: null }; }
        if (q._op === 'delete') { for (const r of sel) rows.splice(rows.indexOf(r), 1); return { data: sel, error: null }; }
        if (q._limit) sel = sel.slice(0, q._limit);
        return { data: q._single ? sel[0] || null : sel, error: null };
      };
      q.select = () => q; q.order = () => q; q.limit = (n: number) => { q._limit = n; return q; }; q.maybeSingle = () => { q._single = true; return q; }; q.single = q.maybeSingle;
      q.eq = (c: string, v: any) => { q._f.push({ op: 'eq', c, v }); return q; }; q.in = (c: string, v: any[]) => { q._f.push({ op: 'in', c, v }); return q; }; q.is = (c: string) => { q._f.push({ op: 'is', c }); return q; };
      q.insert = (p: any) => { q._op = 'insert'; q._payload = p; return q; }; q.update = (p: any) => { q._op = 'update'; q._payload = p; return q; }; q.delete = () => { q._op = 'delete'; return q; };
      q.upsert = (p: any, o: any) => { q._op = 'upsert'; q._payload = p; q._conflict = o?.onConflict || null; return q; };
      q.then = (res: any, rej: any) => Promise.resolve(run()).then(res, rej);
      return q;
    },
  };
  return db;
}

// ---------------------------------------------------------------- الاحتياجات والسمات
test('P32: الاحتياجات عشرة بكلمات الحاجة — لا تشخيص ولا كلمة «إعاقة» في العبارة · لكلٍّ أثر معلن', () => {
  assert.equal(NEEDS.length, 10);
  for (const n of NEEDS) { assert.ok(NEED_LABEL[n].ar.length > 3, n); assert.ok(!/إعاق|مرض|متلازم|توحّد|توحد/.test(NEED_LABEL[n].ar), `لا تشخيص في ${n}`); assert.ok(NEED_EFFECT_AR[n].length > 10, `أثر ${n}`); }
  assert.deepEqual(cleanNeeds(['low_vision', 'x', 'low_vision', 'more_time', 5]), ['low_vision', 'more_time']);
  assert.deepEqual(cleanNeeds('nope'), []);
  assert.equal(accessAttr(['motor', 'bogus' as any, 'focus']), 'motor focus');
});
test('P32: سمات البرامج تسعة · «يناسبني» يتطلب سمة لكل احتياج معني · الاحتياجات التي لا تحتاج سمة لا تمنع', () => {
  assert.equal(FEATURES.length, 9); for (const f of FEATURES) assert.ok(FEATURE_LABEL[f].ar && FEATURE_LABEL[f].en, f);
  assert.deepEqual(cleanFeatures(['captions', 'zzz', 'captions']), ['captions']);
  assert.equal(fitsNeeds(['captions'], ['hard_hearing']), true);
  assert.equal(fitsNeeds(['remote_option'], ['hard_hearing']), false);
  assert.equal(fitsNeeds([], []), true);
  assert.equal(fitsNeeds(null, ['low_bandwidth']), false);
  assert.equal(fitsNeeds(['captions', 'simple_materials'], ['hard_hearing', 'simple']), true);
  assert.equal(fitsNeeds(['captions'], ['hard_hearing', 'simple']), false);
});

// ---------------------------------------------------------------- k≥5 والوقت
test('P32: kAnon يُسقط كل بند أقل من 5 والمجموع لا يظهر دون 5', () => {
  const r = kAnon({ a: 7, b: 4, c: 0, d: 12 } as Record<string, number>);
  assert.deepEqual(r.items.map(x => x.key), ['d', 'a']); assert.equal(r.total, 23);
  assert.equal(kAnon({ a: 2, b: 2 } as Record<string, number>).total, null);
  assert.equal(ACCESS_K, 5);
});
test('P32: مُضاعِف الوقت 1.5 — الدعوة التي تنقضي في 14 يومًا تبقى حتى 21 لمن أعلن «وقتًا أطول»', () => {
  assert.equal(timeFactor(true), 1.5); assert.equal(timeFactor(false), 1); assert.equal(extendedDays(14, 1.5), 21); assert.equal(ACCESS_TIME_FACTOR, 1.5);
  const p = { status: 'invited' as const, invited_at: ago(16), accepted_at: null };
  assert.equal(inviteExpired(p, NOW.getTime()), true, 'بلا مُضاعِف: انقضت');
  assert.equal(inviteExpired(p, NOW.getTime(), 1.5), false, 'بالمُضاعِف: ما زالت حيّة');
  assert.equal(inviteExpired({ ...p, invited_at: ago(22) }, NOW.getTime(), 1.5), true, 'بعد 21 يومًا تنقضي');
  const o = { status: 'proposing' as const, invited_at: ago(40), accepted_at: ago(15) };
  assert.equal(orgInviteExpired(o, NOW.getTime()), true); assert.equal(orgInviteExpired(o, NOW.getTime(), 1.5), false);
  assert.equal(PAIR_INVITE_DAYS, 14); assert.equal(ORG_PAIR_INVITE_DAYS, 14);
});
test('P32: moreTimeEmails/pairTimeFactor — يكفي أحد الطرفين · splitPairs يُبقي الدعوة الحيّة بالمُضاعِف', async () => {
  const db = fakeDb({ portal_access_profiles: [{ user_id: 'u9', email: 'sami@athar.university', needs: ['more_time', 'low_vision'] }, { user_id: 'u8', email: 'x@athar.university', needs: ['focus'] }] });
  const set = await moreTimeEmails(db, ['Sami@athar.university', 'x@athar.university', null]);
  assert.deepEqual(Array.from(set), ['sami@athar.university']);
  assert.equal(await pairTimeFactor(db, ['noura@athar.university', 'sami@athar.university']), 1.5);
  assert.equal(await pairTimeFactor(db, ['noura@athar.university']), 1);
  assert.equal(rowFactor(set, ['SAMI@athar.university']), 1.5);
  const me = { id: 'u1', email: 'noura@athar.university' } as any;
  const pair: any = { id: 'p1', status: 'invited', invited_at: ago(16), accepted_at: null, a_user_id: 'u9', a_email: 'sami@athar.university', b_user_id: 'u1', b_email: 'noura@athar.university', meta: {} };
  assert.equal(splitPairs([pair], me, NOW.getTime()).invitesIn.length, 0, 'بلا مجموعة: انقضت');
  assert.equal(splitPairs([pair], me, NOW.getTime(), set).invitesIn.length, 1, 'بالمجموعة: حيّة');
});

// ---------------------------------------------------------------- نسخة أبسط
test('P32: «نسخة أبسط» — البصمة تتغيّر بتغيّر الأصل · المحلي يقطّع الجمل · parse يرفض القصير · الموجّه يمنع الإضافة', () => {
  assert.notEqual(textHash('نص أول'), textHash('نص ثانٍ')); assert.equal(textHash(' نص   أول '), textHash('نص أول'));
  const s = localSimplify('يهدف البرنامج إلى تمكين المشاركين من تصميم التدريب، كما يتناول أدوات القياس، حيث يُعقد خلال ثلاثة أيام.');
  assert.ok(s.split('\n').length >= 2, 'جمل أقصر'); assert.ok(!/^كما|^حيث/m.test(s), 'حذف أدوات الربط الثقيلة');
  assert.equal(parseSimplify({ simple_ar: 'قصير' }), null); assert.equal(parseSimplify({ simple_ar: 'هذا نص بسيط يكفي طوله.' })?.simple_ar, 'هذا نص بسيط يكفي طوله.');
  const p = buildSimplifyPrompt('نص'); assert.ok(/لا تضف معلومة/.test(p.system)); assert.ok(/JSON/.test(p.system));
  assert.equal(isSimpleSource('program_intro'), true); assert.equal(isSimpleSource('anything'), false);
});
test('P32: requestSimpleText يحمّل الأصل من القاعدة · يحفظ pending · لا يعيد التوليد لنفس الأصل · يعيد التوليد إن تغيّر الأصل · daily_case بالتاريخ فقط', async () => {
  const db = fakeDb({ programs: [{ id: 'p1', intro_ar: 'يهدف البرنامج إلى تمكين المشاركين من تصميم التدريب، كما يتناول أدوات القياس.', objectives_ar: null, is_public: true }], portal_daily_cases: [{ id: 'c1', day: '2026-10-28', scene_ar: 'قاعة تدريب', role_ar: 'أنت مدرب', situation_ar: 'متدرب كفيف لم تصله المواد قبل الجلسة.', ask_ar: 'ماذا تفعل؟' }] });
  const r1 = await requestSimpleText(db, { id: 'u1' }, 'program_intro', 'p1');
  assert.equal(r1.created, true); assert.equal(r1.text?.status, 'pending'); assert.equal(r1.source, 'local');
  const r2 = await requestSimpleText(db, { id: 'u2' }, 'program_intro', 'p1'); assert.equal(r2.created, false); assert.equal(r2.source, 'cache');
  db.T.programs[0].intro_ar = 'نص جديد تمامًا بعد تعديل البرنامج من الطاقم.';
  const r3 = await requestSimpleText(db, { id: 'u2' }, 'program_intro', 'p1'); assert.equal(r3.created, true, 'الأصل تغيّر → نسخة جديدة pending');
  assert.equal(db.T.portal_access_texts.length, 1, 'صف واحد لكل مصدر (upsert)');
  assert.equal(await loadSourceText(db, 'daily_case', 'not-a-date'), null); assert.ok((await loadSourceText(db, 'daily_case', '2026-10-28') || '').includes('كفيف'));
  assert.equal(await loadSourceText(db, 'program_objectives', 'p1'), null, 'لا أهداف → لا نص');
  assert.equal((await getSimpleText(db, 'program_intro', 'p1'))?.status, 'pending');
  const miss = await requestSimpleText(db, { id: 'u1' }, 'program_intro', 'nope'); assert.equal(miss.text, null); assert.ok(miss.error);
});

// ---------------------------------------------------------------- الترجمة الحيّة ومقعد المترجم
test('P32: mergeCaption — سطر لكل متكلّم · الأحدث يستبدل · القديم يسقط بعد 7 ثوانٍ · 3 سطور كحد', () => {
  const t0 = 1_000_000; const m = (from: string, text: string, at: number, final = false): CaptionMsg => ({ type: 'caption', from, text, final, at });
  let L: CaptionMsg[] = []; L = mergeCaption(L, m('a', 'مرح', t0, false), t0); L = mergeCaption(L, m('a', 'مرحبًا بكم', t0 + 500, true), t0 + 500);
  assert.equal(L.length, 1); assert.equal(L[0].text, 'مرحبًا بكم');
  L = mergeCaption(L, m('b', 'شكرًا', t0 + 1000), t0 + 1000); assert.equal(L.length, 2);
  L = mergeCaption(L, m('c', 'سؤال', t0 + 8000), t0 + 8000); assert.deepEqual(L.map(x => x.from), ['c'], 'سقط a و b بعد TTL');
  L = []; for (const f of ['a', 'b', 'c', 'd']) L = mergeCaption(L, m(f, f, t0), t0); assert.equal(L.length, 3);
});
test('P32: orderTiles — مترجم الإشارة أولًا مهما كان ترتيب الوصول', () => {
  const t = orderTiles([{ id: '1', role: 'member' as const }, { id: '2', role: 'interpreter' as const }, { id: '3' }]);
  assert.equal(t[0].id, '2'); assert.deepEqual(t.slice(1).map(x => x.id), ['1', '3']);
});

// ---------------------------------------------------------------- بلاغات + إحصاءات + مشاركة مع الطاقم
test('P32: validateReport — صفحة تبدأ بـ/ · نص ≥ 5 · بريد صالح إن وُجد', () => {
  assert.equal(validateReport({ page: '/programs', text: 'زر التسجيل لا يُقرأ بقارئ الشاشة' }), null);
  assert.ok(validateReport({ page: 'programs', text: 'xxxxxx' })); assert.ok(validateReport({ page: '/x', text: 'قص' })); assert.ok(validateReport({ page: '/x', text: 'نص كافٍ هنا', contact: 'not-mail' }));
});
test('P32: accessStats — k≥5 على الأشخاص والاحتياجات · البرامج المهيَّأة تُعدّ · sharedNeedsFor يعيد من سمح فقط وبلا user_id', async () => {
  const profiles = Array.from({ length: 6 }, (_, i) => ({ user_id: `u${i}`, email: `m${i}@athar.university`, needs: i < 5 ? ['hard_hearing'] : ['motor'], share_staff: i % 2 === 0, helps_ar: i === 0 ? 'مقعد قرب الباب' : null }));
  const db = fakeDb({ portal_access_profiles: profiles, portal_access_reports: [{ status: 'open' }, { status: 'fixed' }, { status: 'fixed' }], portal_access_texts: [{ status: 'approved' }, { status: 'pending' }], programs: [{ id: 'p1', access_features: ['captions'] }, { id: 'p2', access_features: [] }] });
  const st = await accessStats(db);
  assert.equal(st.people, 6); assert.deepEqual(st.needs, [{ key: 'hard_hearing', n: 5 }], 'motor=1 لا يظهر'); assert.equal(st.reports.fixed, 2); assert.equal(st.simple_approved, 1); assert.equal(st.programs_ready, 1);
  const few = await accessStats(fakeDb({ portal_access_profiles: profiles.slice(0, 3) })); assert.equal(few.people, null); assert.equal(few.needs.length, 0);
  const sh = await sharedNeedsFor(db, profiles.map(p => p.email)); assert.equal(sh.length, 3); assert.ok(sh.every(x => !('user_id' in x))); assert.equal(sh.find(x => x.email === 'm0@athar.university')?.helps_ar, 'مقعد قرب الباب');
});

// ---------------------------------------------------------------- أفق الجهة: تعهّد الشمول
test('P32: «تعهّد الشمول» يُعرض فقط حين توجد برامج مهيَّأة · الدرب يعدّ منسوبين متمايزين قُبلوا بعد التوقيع', () => {
  const base = proposeOrgPledges([], 10); assert.ok(!base.some(o => o.kind === 'inclusion'), 'لا برامج مهيَّأة → لا خيار');
  const withInc = proposeOrgPledges([], 10, 6, { inclusive_programs: 2 }); assert.ok(withInc.some(o => o.kind === 'inclusion')); assert.ok(ORG_PLEDGE_KIND_AR.inclusion.includes('الشمول'));
  const pledge = { kind: 'inclusion' as const, target: { people: 5 }, signed_at: ago(30) };
  const inp: any = { members: ['a@x', 'b@x', 'c@x', 'd@x', 'e@x', 'f@x'], missions: [], daily: [], joins: [], returns: [], levels: [], attestations: [], yearbooks: [], inclusion: [{ person: 'a@x', at: ago(20) }, { person: 'a@x', at: ago(19) }, { person: 'b@x', at: ago(18) }, { person: 'zz@other', at: ago(17) }, { person: 'c@x', at: ago(40) }] };
  const path = buildOrgPath(pledge, inp, NOW.getTime());
  assert.equal(path.complete, false); assert.equal(path.steps[0].have, 2, 'a مرة واحدة · b · (c قبل التوقيع وzz ليس منسوبًا)'); assert.equal(path.steps[0].want, 5);
  inp.inclusion.push({ person: 'd@x', at: ago(10) }, { person: 'e@x', at: ago(9) }, { person: 'f@x', at: ago(8) });
  assert.equal(buildOrgPath(pledge, inp, NOW.getTime()).complete, true);
  assert.equal(buildOrgPath({ kind: 'inclusion', target: {}, signed_at: ago(1) }, { ...inp, inclusion: undefined }, NOW.getTime()).steps[0].have, 0, 'بلا أحداث لا ينهار');
});
test('P32: inclusionEvents — قبول في برنامج له access_features فقط · منسوبو الجهة فقط', async () => {
  const db = fakeDb({ programs: [{ id: 'p1', access_features: ['captions'] }, { id: 'p2', access_features: [] }], portal_enrollments: [{ email: 'a@athar.university', program_id: 'p1', status: 'approved', decided_at: ago(3) }, { email: 'a@athar.university', program_id: 'p2', status: 'approved', decided_at: ago(2) }, { email: 'b@athar.university', program_id: 'p1', status: 'pending' }, { email: 'out@other', program_id: 'p1', status: 'approved' }] });
  const ev = await inclusionEvents(db, ['a@athar.university', 'b@athar.university']);
  assert.deepEqual(ev.map(e => e.person), ['a@athar.university']);
  assert.deepEqual(await inclusionEvents(fakeDb({ programs: [{ id: 'p2', access_features: [] }] }), ['a@x']), []);
});

// ---------------------------------------------------------------- موقف اليوم · الخزنة · الهيئة · الذكاء الاصطناعي · البيان
test('P32: «موقف اليوم» — كل أربعاء سياق شامل: الشخص طرف كامل الأهلية والعائق في البيئة', () => {
  assert.equal(inclusiveContextDay('2026-11-04'), true, 'الأربعاء'); assert.equal(inclusiveContextDay('2026-11-05'), false); assert.equal(inclusiveContextDay('bad'), false);
  assert.ok(/كامل الأهلية/.test(INCLUSIVE_HINT_AR) && /لا موضوعًا للشفقة/.test(INCLUSIVE_HINT_AR));
  const f: any = { day: '2026-11-04', weekday_ar: 'الأربعاء', event: null, domain: 'judgment', family: 'ethics_meaning', skills: [], avoid_slugs: [] };
  assert.ok(buildCasePrompt(f).user.startsWith(INCLUSIVE_HINT_AR.slice(0, 10)), 'الأربعاء: التلميح في أول الموجّه');
  assert.ok(!buildCasePrompt({ ...f, day: '2026-11-05', weekday_ar: 'الخميس' }).user.includes('كامل الأهلية'), 'الخميس: بلا تلميح');
});
test('P32: خزنة أَثَر تعرف ملف «أَثَر يلبّي احتياجاتي»: حذف فوري · self فقط · لا وكلاء', () => {
  const e = REGISTRY.find(r => r.table === 'portal_access_profiles'); assert.ok(e, 'مسجّل'); assert.equal(e!.policy, 'delete'); assert.deepEqual(e!.access, ['self']); assert.equal(e!.basis, 'consent');
  const plan = erasurePlan(); assert.ok(JSON.stringify(plan).includes('portal_access_profiles'));
  for (const x of PRIVACY_ACCESS_AR) assert.ok(x.length > 10, 'سطر خصوصية');
});
test('P32: هيئة أَثَر تعرف خدمة «تدريب مهيَّأ للجميع» · الذكاء الاصطناعي يعلن access_simplify بحدّ 20', () => {
  assert.ok((SERVICES as readonly string[]).includes('inclusive_training')); assert.ok(SERVICE_AR.inclusive_training.includes('للجميع'));
  assert.equal(AI_LIMITS.access_simplify, 20); assert.ok(AI_PURPOSE_LABEL.access_simplify.ar.includes('يعتمدها الطاقم'));
});
test('P32: بيان الوصول صادق — يذكر WCAG 2.2 AA وثغرات معروفة (مِعيار · مترجم الإشارة · دقة الترجمة)', () => {
  assert.ok(ACCESS_STATEMENT.standard.includes('2.2') && ACCESS_STATEMENT.standard.includes('AA'));
  assert.ok(ACCESS_STATEMENT.known_gaps_ar.length >= 3); assert.ok(ACCESS_STATEMENT.known_gaps_ar.some(g => g.includes('مِعيار'))); assert.ok(ACCESS_STATEMENT.known_gaps_ar.some(g => g.includes('إشارة')));
  assert.ok(ACCESS_STATEMENT.commitments_ar.some(c => c.includes('لوحة المفاتيح')));
});
