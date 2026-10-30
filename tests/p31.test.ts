// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P31 — «هيئة أَثَر» («سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر»): تنقية السيرة وحدودها · شروط الاعتماد (الصورة والموافقة إلزاميتان) · الظهور العام بمفاتيح الأقسام (لا بريد ولا هاتف)
//                 · البحث (معتمد+مدرج فقط · ترتيب آخر تحديث ثم الاسم · 60/صفحة · لا نجوم) · «ما شهده أَثَر» من السجلات فقط (مدرب منصة التقييم · رئاسة مجالس · اعتمادات · مهام · عقود · ميثاق الجهة)
//                 · الرموز ATH-HM/EX/TR/CO · عقد التعاون: الأجر إلزامي (0 مقبول) · تعديل مرة واحدة · الانتقالات · وثيقة ATH-CO بحاملَين بلا أجر · شهادة ATH-EX موقَّعة Ed25519 وتتحقق
//                 · الكرون: دعوة مدربي منصة التقييم مرة واحدة · تذكير سنوي مرة في السنة · خزنة أَثَر تعرف الجدولين
import test from 'node:test';
import assert from 'node:assert/strict';
import { SUMMARY_MIN, SEARCH_PAGE, CODE_PREFIX_MEMBER, CODE_PREFIX_EXPERT, CODE_PREFIX_TRAINER, CODE_PREFIX_COLLAB, DEFAULT_VISIBILITY, SECTIONS, sanitizeProfileInput, profileIssues, canSubmit, isPublic, publicView, cardView, ownerView, searchPlain, matches, sortProfiles, search, witnessLines, witnessCounts, EMPTY_WITNESS, memberCode, cardCode, collabCode, slugFor, privatePhotoPath, publicPhotoPath, mimeOfPath, sanitizeEngagementInput, engagementIssues, memberTransition, staffTransition, engagementMemberView, engagementFacts, prefillFromLegacyTrainer, summaryOf } from '../lib/directory/registry';
import type { Profile, Engagement } from '../lib/directory/registry';
import { witnessFacts, loadMyProfile, legacyTrainer } from '../lib/directory/load';
import { buildCardDoc, buildCollabDoc, issueCard, signEngagement } from '../lib/directory/card';
import { runDirectory } from '../lib/directory/cron';
import { REGISTRY, erasurePlan } from '../lib/vault/registry';
import { signerFromEnv, verifySignature, localResolver } from '../lib/portal/vc-server';
import { structuralChecks } from '../lib/portal/vc';

const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
const SITE = 'https://athar-portal.vercel.app'; const DID = 'did:web:athar-portal.vercel.app';
const NOW = new Date('2026-10-30T08:00:00Z'); const ago = (d: number) => new Date(NOW.getTime() - d * 864e5).toISOString();
const ME = { id: '00000000-0000-4000-8000-0000000000b2', email: 'noura@athar.university', name: 'د. نورة الشهري' };
const rnd = (() => { let i = 0; return () => `Q${(++i).toString().padStart(3, '0')}`; })();

function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = {}; for (const [k, v] of Object.entries(seed)) T[k] = v.map((r, i) => ({ id: `${k}-${i + 1}`, ...r }));
  const table = (t: string) => (T[t] = T[t] || []);
  const match = (r: any, f: any): boolean => {
    switch (f.op) {
      case 'eq': return r[f.c] === f.v || String(r[f.c]) === String(f.v);
      case 'neq': return String(r[f.c]) !== String(f.v);
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
const FULL = { faces: ['expert', 'trainer'], name_ar: 'د. نورة الشهري', name_en: 'Noura Alshehri', title_ar: 'مستشارة تطوير مؤسسي', city: 'المدينة المنورة', languages: ['ar', 'en'], summary_ar: 'مستشارة تطوير مؤسسي عملت مع جامعات وجهات حكومية على تصميم أنظمة الجودة وبناء القدرات، وتؤمن أن الأثر يُقاس في الميدان لا في القاعة. '.repeat(2), achievements: ['قادت تحوّل نظام الجودة في جامعة أَثَر', 'صمّمت برنامج قادة المستقبل'], education: [{ degree: 'دكتوراه', field: 'إدارة تعليمية', institution: 'جامعة أَثَر', year: '2015' }], experience: [{ role: 'مستشارة', organization: 'جامعة أَثَر', from: '2016', to: '', line: 'تطوير الأنظمة' }], certifications: [{ name: 'PMP', issuer: 'PMI', year: '2018', number: 'SECRET-123' }], publications: [{ title: 'دليل الجودة', type: 'كتاب', year: '2020', url: 'https://example.org/q' }], skill_ids: ['sk-1', 'sk-2'], sectors: ['edu', 'gov'], services: ['consulting', 'training', 'bogus'], modes: ['remote', 'hybrid'], coverage: ['المدينة المنورة', 'الرياض'], visibility: { certifications: false, nope: true }, witness_hidden: false, status: 'approved', email: 'hack@x', staff_only: { notes: 'x' } };
const prof = (over: Partial<Profile> = {}): Profile => ({ id: 'pr-1', created_at: ago(40), updated_at: ago(2), user_id: ME.id, email: ME.email, status: 'approved', listed: true, slug: 'noura-alshehri-q001', code: 'ATH-HM-Q001-Q002', ...sanitizeProfileInput(FULL), skill_names: ['قيادة التغيير', 'ضمان الجودة'], photo_path: 'directory/u/photo.jpg', photo_public_path: 'directory/noura-alshehri-q001.jpg', photo_consent_at: ago(30), summary_en: null, title_en: null, staff_only: { availability: 'فبراير', notes: 'ملاحظة داخلية سرية' }, staff_note_ar: null, search_plain: '', submitted_at: ago(35), approved_at: ago(30), approved_by: 'adm', suspended_at: null, card_expert: { code: 'ATH-EX-AAAA-BBBB', vc_issuance_id: 'vc1', issued_at: ago(30) }, card_trainer: null, legacy_trainer_id: null, meta: {}, ...over } as Profile);
const pub = (p: string) => `https://cdn.test/${p}`;

test('P31 تنقية السيرة: الحدود · الخدمات المعروفة فقط · لا حالة ولا بريد ولا حقول طاقم · مفاتيح الأقسام المعروفة فقط', () => {
  const s = sanitizeProfileInput(FULL) as any;
  assert.equal(s.status, undefined, 'لا status'); assert.equal(s.email, undefined, 'لا email'); assert.equal(s.staff_only, undefined, 'لا staff_only');
  assert.deepEqual(s.services, ['consulting', 'training'], 'خدمة مجهولة تُسقط'); assert.deepEqual(s.visibility, { certifications: false }, 'مفتاح مجهول يُسقط');
  assert.equal(s.publications[0].url, 'https://example.org/q', 'رابط https يبقى'); assert.equal(sanitizeProfileInput({ publications: [{ title: 'x', url: 'javascript:alert(1)' }] }).publications![0].url, undefined, 'رابط غير http يُسقط');
  assert.equal(sanitizeProfileInput({ achievements: Array(20).fill('إنجاز') }).achievements!.length, 1, 'التكرار يُزال ثم الحد 10'); assert.equal(sanitizeProfileInput({ achievements: Array.from({ length: 20 }, (_, i) => `إنجاز ${i}`) }).achievements!.length, 10, 'حد 10 إنجازات');
  assert.equal(sanitizeProfileInput({ summary_ar: 'أ'.repeat(2000) }).summary_ar!.length, 1200, 'الملخص ≤ 1200'); assert.equal(sanitizeProfileInput({ skill_ids: Array.from({ length: 12 }, (_, i) => `s${i}`) }).skill_ids!.length, 8, 'حد 8 مهارات');
});

test('P31 شروط الاعتماد: الصورة والموافقة إلزاميتان · مسودة فارغة ترفض · السيرة الكاملة تمرّ', () => {
  const empty = profileIssues(sanitizeProfileInput({})); assert.ok(empty.length >= 8, `مسودة فارغة: ${empty.length} مشكلة`); assert.ok(empty.some(i => i.includes('الصورة إلزامية')), 'الصورة إلزامية');
  const noConsent = profileIssues({ ...sanitizeProfileInput(FULL), photo_path: 'x.jpg' }); assert.deepEqual(noConsent, ['وافق على ظهور صورتك في الدليل (الموافقة إلزامية للاعتماد)'], 'الموافقة إلزامية');
  assert.equal(canSubmit(prof()), true, 'سيرة كاملة جاهزة'); assert.ok(profileIssues({ ...prof(), summary_ar: 'قصير' })[0].includes(String(SUMMARY_MIN)), 'الملخص القصير يُذكر الحد');
});

test('P31 الظهور العام: معتمد+مدرج+صورة بموافقة · لا بريد ولا staff_only ولا meta · مفاتيح الأقسام · رقم الشهادة المهنية لا يظهر', () => {
  assert.equal(isPublic(prof()), true); assert.equal(isPublic(prof({ listed: false })), false, 'مسحوبة'); assert.equal(isPublic(prof({ status: 'submitted' })), false, 'غير معتمدة'); assert.equal(isPublic(prof({ photo_consent_at: null })), false, 'بلا موافقة'); assert.equal(isPublic(prof({ photo_public_path: null })), false, 'بلا صورة منشورة');
  const v = publicView(prof(), pub) as any; const j = JSON.stringify(v);
  assert.ok(!j.includes(ME.email) && !j.includes('سرية') && !j.includes('SECRET-123') && !/"meta"/.test(j), 'لا بريد ولا ملاحظات طاقم ولا رقم شهادة ولا meta');
  assert.deepEqual(v.certifications, [], 'قسم مطفأ لا يظهر'); assert.equal(v.achievements.length, 2, 'قسم افتراضي يظهر'); assert.equal(v.photo_url, 'https://cdn.test/directory/noura-alshehri-q001.jpg', 'رابط الصورة العامة');
  const noPhoto = publicView(prof({ visibility: { photo: false } }), pub); assert.equal(noPhoto.photo_url, null, 'إطفاء الصورة يخفيها');
  const c = cardView(prof(), pub) as any; assert.equal(c.skill_names.length, 2); assert.equal(c.summary_ar, undefined, 'البطاقة بلا ملخص'); assert.equal(c.cards.expert.code, 'ATH-EX-AAAA-BBBB');
  const o = ownerView(prof()) as any; assert.equal(o.staff_only, undefined, 'المالك لا يرى حقول الطاقم'); assert.equal(o.is_public, true); assert.equal(o.email, ME.email, 'المالك يرى بريده');
  assert.equal(SECTIONS.length, 10); assert.equal(DEFAULT_VISIBILITY.photo, true);
});

test('P31 البحث: نص · وجه · مهارة · قطاع · خدمة · نمط · مدينة — الترتيب آخر تحديث ثم الاسم · 60 في الصفحة · لا حقل تقييم', () => {
  const a = prof({ id: 'a', name_ar: 'أحمد', updated_at: ago(5), search_plain: searchPlain({ name_ar: 'أحمد', title_ar: 'مدرب جودة', city: 'جدة' } as any, ['ضمان الجودة'], ['التعليم']) });
  const b = prof({ id: 'b', name_ar: 'بدر', updated_at: ago(1), faces: ['trainer'], skill_ids: ['sk-9'], sectors: ['health'], services: ['training'], modes: ['onsite'], city: 'الرياض', search_plain: 'بدر مدرب الرياض الصحة' });
  const c = prof({ id: 'c', name_ar: 'آمنة', updated_at: ago(5), search_plain: 'آمنة' });
  const all = [a, b, c];
  assert.deepEqual(sortProfiles(all).map(p => p.id), ['b', 'c', 'a'], 'آخر تحديث ثم الاسم');
  assert.equal(matches(a, { q: 'جودة' }), true); assert.equal(matches(b, { q: 'جودة' }), false); assert.equal(matches(a, { face: 'trainer' }), true, 'أحمد بوجهين'); assert.equal(matches(b, { face: 'expert' }), false);
  assert.equal(matches(b, { skill: 'sk-9' }), true); assert.equal(matches(a, { skill: 'sk-9' }), false); assert.equal(matches(b, { sector: 'health', mode: 'onsite', service: 'training', city: 'الرياض' }), true); assert.equal(matches(b, { city: 'جدة' }), false);
  const r = search(all, { q: '' }, 1); assert.equal(r.total, 3); assert.equal(SEARCH_PAGE, 60);
  const many = Array.from({ length: 130 }, (_, i) => prof({ id: `m${i}`, name_ar: `عضو ${i}`, updated_at: ago(i) })); const p2 = search(many, {}, 2); assert.equal(p2.items.length, 60); assert.equal(p2.pages, 3); assert.equal(p2.items[0].id, 'm60');
  assert.ok(!('rating' in a) && !('stars' in a) && !('featured' in a) && !('rank' in a), 'لا تقييم ولا نجوم ولا تمييز');
});

test('P31 «ما شهده أَثَر»: سطور من الأعداد فقط · فارغ = لا سطور · أعداد البطاقة · عقود منجَزة بحسب النوع', () => {
  assert.deepEqual(witnessLines(EMPTY_WITNESS), []);
  const lines = witnessLines({ ...EMPTY_WITNESS, programs: 7, classrooms: 9, program_years: ['2022', '2026'], councils_chaired: 1, attestations_approved: 2, levels_approved: 12, missions_confirmed: 3, engagements_consult: 1, engagements_train: 2, engagement_years: ['2026', '2026'], org_charter: 'جامعة أَثَر' });
  const txt = lines.map(l => l.text).join(' | ');
  assert.ok(txt.includes('قدّم 7 برامج تدريبية (9 شعبة) بين 2022 و2026'), txt); assert.ok(txt.includes('يسّر مجلس أقران واحدًا')); assert.ok(txt.includes('اعتمد شهادتَي قرين')); assert.ok(txt.includes('اعتمد 12 مستوى مهارة')); assert.ok(txt.includes('أكّد بصفته مشرفًا 3 مهام')); assert.ok(txt.includes('استشارة واحدة وتدريبان')); assert.ok(txt.includes('«جامعة أَثَر» وقّعت ميثاق أَثَر'));
  assert.deepEqual(witnessCounts({ ...EMPTY_WITNESS, programs: 2, engagements_consult: 1, engagements_train: 1 }), { programs: 2, councils: 0, attestations: 0, levels: 0, missions: 0, engagements: 2 });
  const ef = engagementFacts([{ kind: 'consult', status: 'completed', completed_at: '2026-03-01' }, { kind: 'train', status: 'settled', completed_at: '2025-05-01' }, { kind: 'train', status: 'active', completed_at: null }, { kind: 'consult', status: 'cancelled', completed_at: '2026-01-01' }]);
  assert.deepEqual(ef, { engagements_consult: 1, engagements_train: 1, engagement_years: ['2025', '2026'] }, 'المنجَز والمسوّى فقط');
});

test('P31 «ما شهده أَثَر» من الجداول: مدرب منصة التقييم (شُعب → برامج → سنوات) · رئاسة مجلس · اعتمادات · مهام مؤكَّدة · ميثاق الجهة', async () => {
  const db = fakeDb({
    trainers: [{ id: 't1', name: 'د. نورة الشهري', email: ME.email }], classrooms: [{ program_id: 'p1', trainer_id: 't1' }, { program_id: 'p1', trainer_id: 't1' }, { program_id: 'p2', trainer_id: 't1' }, { program_id: 'p3', trainer_id: 't9' }],
    programs: [{ id: 'p1', start_date: '2023-02-01' }, { id: 'p2', start_date: '2026-01-10' }].map(p => ({ ...p })),
    portal_council_members: [{ council_id: 'c1', email: ME.email, role: 'chair', status: 'active' }, { council_id: 'c2', email: ME.email, role: 'member', status: 'active' }],
    portal_council_attestations: [{ approved_by: ME.id, status: 'approved' }, { approved_by: ME.id, status: 'pending' }, { approved_by: 'other', status: 'approved' }],
    portal_skill_levels: [{ user_id: 'x', approved_by: ME.id, approved_at: ago(3) }, { user_id: 'y', approved_by: ME.id, approved_at: null }],
    portal_missions: [{ status: 'confirmed', confirmed_by: ME.email.toUpperCase() }, { status: 'submitted', confirmed_by: ME.email }],
    portal_org_members: [{ organization_id: 'org-21', user_id: ME.id, email: ME.email, role: 'org_admin', status: 'confirmed' }], portal_org_charters: [{ organization_id: 'org-21', status: 'active' }], portal_organizations: [{ name_ar: 'جامعة أَثَر' }],
  });
  db.T.programs.forEach((p: any, i: number) => { p.id = ['p1', 'p2'][i]; }); db.T.portal_organizations[0].id = 'org-21';
  const legacy = await legacyTrainer(db, ME.email); assert.equal(legacy?.id, 't1');
  const f = await witnessFacts(db, ME, legacy, [{ kind: 'consult', status: 'completed', completed_at: '2026-05-05' } as any]);
  assert.equal(f.classrooms, 3); assert.equal(f.programs, 2); assert.deepEqual(f.program_years, ['2023', '2026']); assert.equal(f.councils_chaired, 1, 'رئاسة فقط'); assert.equal(f.attestations_approved, 1); assert.equal(f.levels_approved, 1); assert.equal(f.missions_confirmed, 1, 'المؤكَّدة فقط · بريد بلا حساسية حالة'); assert.equal(f.org_charter, 'جامعة أَثَر'); assert.equal(f.engagements_consult, 1);
  const pre = prefillFromLegacyTrainer(legacy!, f); assert.deepEqual(pre.faces, ['trainer']); assert.ok(pre.summary_ar!.includes('قدّم برنامجين تدريبيَّين (3 شعبة) بين 2023 و2026') && pre.summary_ar!.startsWith('مدرب في أَثَر:'), pre.summary_ar);
  const none = await witnessFacts(fakeDb(), { id: 'nobody', email: 'x@y.z' }, null, []); assert.deepEqual(none, EMPTY_WITNESS, 'لا سجلات = لا شهادة');
  const mine = await loadMyProfile(fakeDb({ portal_directory_profiles: [{ user_id: 'other', email: ME.email, created_at: ago(2) }, { user_id: ME.id, email: 'old@x.y', created_at: ago(1) }] }), ME); assert.equal(mine?.user_id, ME.id, 'سيرتي بمعرّفي أولًا');
  assert.deepEqual(summaryOf(prof(), true), { version: 'p31.1', status: 'approved', faces: ['expert', 'trainer'], listed: true, legacy_trainer: true, slug: 'noura-alshehri-q001' });
});

test('P31 الرموز والمسارات: ATH-HM/EX/TR/CO · slug من الاسم اللاتيني أو member · مسار الصورة الخاص والعام · نوع الملف', () => {
  const r = () => 'ABCD';
  assert.equal(memberCode(r), `${CODE_PREFIX_MEMBER}-ABCD-ABCD`); assert.equal(cardCode('expert', r), `${CODE_PREFIX_EXPERT}-ABCD-ABCD`); assert.equal(cardCode('trainer', r), `${CODE_PREFIX_TRAINER}-ABCD-ABCD`); assert.equal(collabCode(r), `${CODE_PREFIX_COLLAB}-ABCD-ABCD`);
  assert.equal(slugFor({ name_en: 'Dr. Noura  Al-Shehri!', code: 'ATH-HM-Q1Q1-Z9Z9' }), 'dr-noura-al-shehri-z9z9'); assert.equal(slugFor({ name_en: null, code: null }, r), 'member-abcd');
  assert.match(privatePhotoPath('u1', 'image/png'), /^directory\/u1\/photo-[a-z0-9]+\.png$/); assert.equal(publicPhotoPath('noura-q1', 'image/webp'), 'directory/noura-q1.webp'); assert.equal(mimeOfPath('a/b.png'), 'image/png'); assert.equal(mimeOfPath('a/b.jpg'), 'image/jpeg');
});

test('P31 عقد التعاون: الأجر إلزامي (0 مقبول) · العملة · التواريخ · انتقالات العضو (تعديل مرة واحدة) · انتقالات الطاقم · عرض العضو بلا رمز داخلي', () => {
  const base = { kind: 'train', title_ar: 'ورشة قيادة التغيير — جامعة أَثَر', scope_ar: 'ورشة يومين لقادة الأقسام في جامعة أَثَر بالمدينة المنورة', deliverables: ['حقيبة', 'تقرير'], start_at: '2026-12-01', end_at: '2026-12-02', mode: 'onsite', currency: 'sar' };
  assert.equal(engagementIssues(sanitizeEngagementInput(base)), 'حدّد أجر هذا المشروع (0 مقبول للتطوعي)'); assert.equal(engagementIssues(sanitizeEngagementInput({ ...base, fee_amount: 0 })), null, 'صفر مقبول'); assert.equal(sanitizeEngagementInput({ ...base, fee_amount: '12000.456' }).fee_amount, 12000.46); assert.equal(sanitizeEngagementInput(base).currency, 'SAR', 'عملة غير صالحة → SAR');
  assert.equal(engagementIssues(sanitizeEngagementInput({ ...base, fee_amount: 1, end_at: '2026-11-01' })), 'تاريخ النهاية قبل البداية'); assert.equal(engagementIssues(sanitizeEngagementInput({ ...base, fee_amount: 1, scope_ar: 'قصير' })), 'نطاق المهمة 20 حرفًا على الأقل');
  const e = (over: Partial<Engagement> = {}): Engagement => ({ id: 'e1', created_at: ago(1), updated_at: ago(1), profile_id: 'pr-1', user_id: ME.id, email: ME.email, ...sanitizeEngagementInput({ ...base, fee_amount: 5000 }), status: 'proposed', change_note_ar: null, token: 'tok-secret', member_signed_at: null, athar_signed_at: null, completed_at: null, settled_at: null, code: null, vc_issuance_id: null, created_by: 'adm', meta: {}, ...over } as Engagement);
  assert.equal(memberTransition(e(), 'sign'), null); assert.equal(memberTransition(e(), 'change'), null); assert.ok(memberTransition(e({ meta: { changes: 1 } }), 'change')!.includes('مرة واحدة')); assert.equal(memberTransition(e({ meta: { changes: 1 } }), 'sign'), null, 'التوقيع بعد التعديل'); assert.ok(memberTransition(e({ status: 'active' }), 'sign'));
  assert.equal(staffTransition(e(), 'update'), null); assert.equal(staffTransition(e({ status: 'changes_requested' }), 'update'), null); assert.ok(staffTransition(e({ status: 'active' }), 'update')); assert.equal(staffTransition(e({ status: 'active' }), 'complete'), null); assert.ok(staffTransition(e(), 'complete')); assert.equal(staffTransition(e({ status: 'completed' }), 'settle'), null); assert.ok(staffTransition(e({ status: 'settled' }), 'cancel')); assert.equal(staffTransition(e({ status: 'active' }), 'cancel'), null);
  const v = engagementMemberView(e({ code: 'ATH-CO-X-Y', vc_issuance_id: 'vc' }), SITE) as any; assert.equal(v.token, undefined); assert.equal(v.created_by, undefined); assert.equal(v.fee_amount, 5000, 'العضو طرف فيرى الأجر'); assert.equal(v.changes_left, 1); assert.equal(v.verify_url, `${SITE}/verify/vc?code=ATH-CO-X-Y`); assert.equal(v.status_ar, 'بانتظار توقيعك');
});

test('P31 الوثائق: شهادة التوثيق ATH-EX (kind=directory_card · بلا بريد · أعداد الشهادة) تُوقَّع وتتحقق · عقد ATH-CO بحاملَين وبلا أجر · التوقيع يفعّل العقد', async () => {
  const signer = signerFromEnv({ VC_SIGNING_KEY: K1 } as any, SITE)!; assert.ok(signer, 'موقّع');
  const facts = { ...EMPTY_WITNESS, programs: 4, councils_chaired: 1 };
  const doc = buildCardDoc({ code: 'ATH-EX-Q001-Q002', face: 'expert', profile: prof(), facts, site: SITE, did: DID, now: NOW, statusIndex: 3 }) as any;
  assert.equal(doc._athar.kind, 'directory_card'); assert.equal(doc._athar.face_ar, 'خبير استشاري'); assert.deepEqual(doc._athar.witnessed, witnessCounts(facts)); assert.equal(doc.credentialStatus.statusListIndex, '3'); assert.ok(!JSON.stringify(doc).includes(ME.email), 'لا بريد في الوثيقة'); assert.ok(doc._athar.page.endsWith('/experts/noura-alshehri-q001'));
  const db = fakeDb(); const r = await issueCard(db, prof(), 'trainer', facts, signer, SITE, DID, rnd, 'adm', NOW); assert.ok(r.ok, 'إصدار'); if (!r.ok) return;
  assert.ok(r.card.code.startsWith('ATH-TR-'), r.card.code); const row = db.T.portal_vc_issuances[0]; assert.equal(row.kind, 'directory_card'); assert.ok(row.title_ar.includes('مدرب'));
  assert.equal(structuralChecks(row.vc).filter((c: any) => !c.ok).length, 0, 'بنية سليمة'); assert.equal((await verifySignature(row.vc, localResolver(signer, []))).ok, true, 'التوقيع يتحقق'); assert.ok(row.digest.length === 64, 'بصمة');
  const unsigned = await issueCard(fakeDb(), prof(), 'expert', facts, null, SITE, DID, rnd, 'adm', NOW); assert.ok(unsigned.ok && unsigned.card.vc_issuance_id === null, 'بلا مفتاح: رمز بلا وثيقة');
  const eng: Engagement = { id: 'e1', created_at: ago(1), updated_at: ago(1), profile_id: 'pr-1', user_id: ME.id, email: ME.email, kind: 'consult', consulting_request_id: null, title_ar: 'مراجعة نظام الجودة — جامعة أَثَر', scope_ar: 'مراجعة شاملة لنظام الجودة في الكليات الصحية بجامعة أَثَر', deliverables: ['تقرير تشخيصي', 'خطة تحسين'], start_at: '2026-11-15', end_at: '2027-01-15', mode: 'hybrid', fee_amount: 48000, currency: 'SAR', terms_ar: 'دفعتان', status: 'proposed', change_note_ar: null, token: 'tok-secret', member_signed_at: null, athar_signed_at: null, completed_at: null, settled_at: null, code: null, vc_issuance_id: null, created_by: 'adm', meta: {} };
  const cdoc = buildCollabDoc({ code: 'ATH-CO-Q001-Q002', e: eng, memberName: ME.name, site: SITE, did: DID, now: NOW, statusIndex: 1 }) as any; const cj = JSON.stringify(cdoc);
  assert.equal(cdoc._athar.holders.length, 2); assert.equal(cdoc._athar.holders[1].signed_as_ar, 'بصفتها'); assert.ok(cdoc._athar.holder.includes('بوابة التميز'), 'أَثَر بصفته القانونية'); assert.ok(!cj.includes('48000') && !/fee_amount|tok-secret|دفعتان/.test(cj), 'لا أجر ولا رمز ولا شروط في الوثيقة'); assert.equal(cdoc.validUntil, '2027-01-15T23:59:59.000Z');
  const db2 = fakeDb({ portal_directory_engagements: [{ ...eng }] }); db2.T.portal_directory_engagements[0].id = 'e1';
  const s = await signEngagement(db2, eng, prof(), signer, SITE, DID, rnd, NOW); assert.ok(s.ok, 'توقيع'); if (!s.ok) return;
  assert.equal(s.engagement.status, 'active'); assert.equal(s.engagement.member_signed_at, NOW.toISOString()); assert.equal(s.engagement.athar_signed_at, NOW.toISOString()); assert.ok(s.engagement.code!.startsWith('ATH-CO-')); assert.equal(db2.T.portal_vc_issuances[0].kind, 'collaboration'); assert.ok(s.verify_url!.includes('/verify/vc?code=ATH-CO-'));
  assert.equal((await verifySignature(db2.T.portal_vc_issuances[0].vc, localResolver(signer, []))).ok, true, 'وثيقة العقد تتحقق');
});

test('P31 الكرون: دعوة مدربي منصة التقييم مرة واحدة لكل بريد (لا لمن له سيرة) · التذكير السنوي مرة في السنة · المعاينة لا تكتب', async () => {
  const seed = () => fakeDb({
    trainers: [{ name: 'د. أحمد الحربي', email: 'ahmed@athar.university' }, { name: 'أ. سارة', email: null }, { name: 'د. محمد', email: 'm.otaibi@example.com' }, { name: 'نورة', email: ME.email }],
    portal_directory_profiles: [{ ...prof(), updated_at: ago(400), meta: {} }, { ...prof({ id: 'x' }), email: 'fresh@x.y', user_id: 'u9', updated_at: ago(10) }, { ...prof({ id: 'y' }), email: 'draft@x.y', user_id: 'u8', status: 'draft', updated_at: ago(900) }],
    portal_message_log: [{ kind: 'directory_invite', ref_id: 'directory:invite:m.otaibi@example.com', to_email: 'm.otaibi@example.com', subject: 'x', status: 'sent', created_at: ago(30) }],
  });
  const dry = await runDirectory(seed(), { dry: true, site: SITE, now: NOW }); assert.ok(dry.ok); if (!dry.ok) return;
  assert.equal(dry.invited, 1, 'أحمد فقط (نورة لها سيرة · محمد دُعي · سارة بلا بريد)'); assert.equal(dry.reminded, 1, 'المعتمدة القديمة فقط'); assert.equal(dry.skipped_invites, 2);
  const db = seed(); const live = await runDirectory(db, { dry: false, site: SITE, now: NOW }); assert.ok(live.ok && live.invited === 1 && live.reminded === 1, JSON.stringify(live));
  const logs = db.T.portal_message_log; assert.ok(logs.some((l: any) => l.kind === 'directory_invite' && l.ref_id === 'directory:invite:ahmed@athar.university' && /me\/directory/.test(l.payload?.text || '')), 'دعوة أحمد برابط سيرته');
  assert.ok(logs.some((l: any) => l.kind === 'directory_reminder' && l.to_email === ME.email), 'تذكير نورة'); assert.equal(db.T.portal_directory_profiles[0].meta.reminded_at, NOW.toISOString(), 'سُجّل التذكير');
  const again = await runDirectory(db, { dry: false, site: SITE, now: new Date(NOW.getTime() + 864e5) }); assert.ok(again.ok && again.invited === 0 && again.reminded === 0, 'لا تكرار في اليوم التالي');
});

test('P31 خزنة أَثَر تعرف الجدولين: السيرة تُحذف · العقود تُجهَّل · لا تكرار', () => {
  const p = REGISTRY.find(r => r.table === 'portal_directory_profiles'); const e = REGISTRY.find(r => r.table === 'portal_directory_engagements');
  assert.ok(p && p.policy === 'delete' && p.basis === 'consent' && p.access.includes('public'), 'السيرة: موافقة · حذف · عامة'); assert.ok(e && e.policy === 'anonymize' && e.basis === 'contract', 'العقود: عقد · تجهيل');
  const plan = erasurePlan() as any; assert.ok(plan.delete.some((x: any) => x.table === 'portal_directory_profiles') && plan.anonymize.some((x: any) => x.table === 'portal_directory_engagements'), 'خطة النسيان');
  assert.equal(new Set(REGISTRY.map(r => r.table)).size, REGISTRY.length, 'لا تكرار');
});
