// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P8-ج: تجميع مؤشرات الأثر القطاعي، السرد، Excel، الكتالوج المفتوح وJSON-LD، جواز المهارات (بناء وتقسيم الصفحات وPDF)
import test from 'node:test';
import assert from 'node:assert/strict';
import { wmean, improvementPct, satisfactionPct, totals, programRows, orgRows, skillRows, sectorRows, narrative, scopeLabel, impactSheets, periodPresets, validateFilters, rpcParams, EMPTY_REPORT } from '../lib/portal/impact';
import type { ImpactReport } from '../lib/portal/impact';
import { normalizeSite, courseJsonLd, eventJsonLd, catalogProgram, catalogSession, catalogResource, organizationJsonLd, issuerProfile, personJsonLd, catalogEnvelope, catalogItemList, jsonLdScript, sessionEnd, courseMode, hoursDuration, availability } from '../lib/portal/open';
import { buildPassport, paginate, passportFilename, jpegsToPortraitPdf } from '../lib/portal/passport';
import type { Skill } from '../lib/portal/skills';
import type { SkillLevelRow, Credential } from '../lib/portal/profile';

const R: ImpactReport = { ...EMPTY_REPORT, ok: true, generated_at: '2026-11-25T10:00:00Z', from: '2026-01-01', to: '2026-11-25', scope: { programs: 2, learners: 30, skills: 2 },
  programs: [
    { id: 'p1', name_ar: 'دبلوم إعداد المعلمين', sector: 'education', program_type: 'diploma', hours: 40, cefr_level: 'B2', start_date: '2026-09-01', learners: 20, pending: 3, orgs: 2, credentials: 12, skills: ['s1', 's2'], attendance: { sessions: 10, present: 170 }, satisfaction: { n: 18, mean: 4.5 }, prepost: { pre_n: 20, pre: 50, post_n: 18, post: 70 }, transfer: { n: 10, mean: 72 } },
    { id: 'p2', name_ar: 'ورشة الذكاء الاصطناعي', sector: 'health', program_type: 'workshop', hours: 6, learners: 10, pending: 0, orgs: 1, credentials: 4, skills: ['s2'], attendance: { sessions: 2, present: 16 }, satisfaction: { n: 2, mean: 3.5 }, prepost: { pre_n: 0, pre: null, post_n: 0, post: null }, transfer: { n: 0, mean: null } },
  ],
  orgs: [{ id: 'o1', name_ar: 'وزارة التعليم', sector: 'education', city: 'الرياض', learners: 15, enrollments: 18, credentials: 9, members: 40, avg_level: 3.6 }, { id: 'o2', name_ar: 'مستشفى', sector: 'health', learners: 8, enrollments: 8, credentials: 0, members: 10, avg_level: null }],
  skills: [{ id: 's1', code: 'ATH-PD-001', name_ar: 'تصميم التعلم', name_en: 'Learning design', domain: 'pedagogy', saqf_level: 5, learners: 20, avg_level: 3.4, approved: 5, proven: 14, programs: 1 }, { id: 's2', code: 'ATH-DA-001', name_ar: 'أساسيات الذكاء الاصطناعي', name_en: 'AI basics', domain: 'data_ai', sdaia_code: 'SDAIA-AI-1', learners: 25, avg_level: 2.8, approved: 0, proven: 9, programs: 2 }],
  sectors: [{ code: 'education', name_ar: 'التعليم', name_en: 'Education', programs: 1, orgs: 1, learners: 22 }, { code: 'health', name_ar: 'الصحة', name_en: 'Health', programs: 1, orgs: 1, learners: 8 }, { code: 'energy', name_ar: 'الطاقة', name_en: 'Energy', programs: 0, orgs: 0, learners: 0 }],
  placements: { B1: 5, A2: 3 }, credentials: { total: 16, by_kind: { program_completion: 12, attendance: 4 } }, events: { total: 120, downloads: 40, sessions: 50, assessed: 20, completed: 10 } };
const F = { from: '2026-01-01', to: '2026-11-25', sector: 'education', skill: '', org: '' };

test('impact: weighted means, improvement, satisfaction pct', () => {
  assert.equal(wmean([{ mean: 4, n: 10 }, { mean: 2, n: 10 }]), 3); assert.equal(wmean([{ mean: null, n: 5 }, { mean: 5, n: 0 }]), null); assert.equal(wmean([]), null);
  assert.equal(improvementPct(50, 70), 40); assert.equal(improvementPct(0, 70), null); assert.equal(improvementPct(null, 70), null); assert.equal(improvementPct(80, 60), -25);
  assert.equal(satisfactionPct(5), 100); assert.equal(satisfactionPct(1), 0); assert.equal(satisfactionPct(4.5), 87.5); assert.equal(satisfactionPct(null), null);
});
test('impact: totals aggregate programs, attendance, pre/post, placements', () => {
  const t = totals(R);
  assert.equal(t.learners, 30); assert.equal(t.programs, 2); assert.equal(t.orgs, 2); assert.equal(t.hours, 40 * 20 + 6 * 10); assert.equal(t.pending, 3); assert.equal(t.credentials, 16);
  assert.deepEqual(t.attendance, { sessions: 12, present: 186, expected: 220, rate: 84.5 });
  assert.equal(t.satisfaction.mean, 4.4); assert.equal(t.satisfaction.n, 20);
  assert.equal(t.prepost.pre, 50); assert.equal(t.prepost.post, 70); assert.equal(t.prepost.improvement, 40);
  assert.equal(t.transfer.mean, 72); assert.equal(t.skillsProven, 23); assert.equal(t.skillsApproved, 5);
  assert.deepEqual(t.placements, { total: 8, levels: [{ level: 'A2', n: 3 }, { level: 'B1', n: 5 }] });
  const e = totals(EMPTY_REPORT); assert.equal(e.learners, 0); assert.equal(e.attendance.rate, null); assert.equal(e.satisfaction.mean, null); assert.equal(e.prepost.improvement, null);
});
test('impact: rows sorted and derived', () => {
  const p = programRows(R); assert.equal(p[0].id, 'p1'); assert.equal(p[0].attendanceRate, 85); assert.equal(p[0].improvement, 40); assert.equal(p[0].hoursDelivered, 800); assert.equal(p[1].improvement, null); assert.equal(p[1].attendanceRate, 80);
  const o = orgRows(R); assert.equal(o[0].id, 'o1'); assert.equal(o[0].credPerLearner, 0.6); assert.equal(o[1].credPerLearner, 0);
  const s = skillRows(R); assert.equal(s[0].code, 'ATH-DA-001'); assert.equal(s[1].provenPct, 70);
  const sec = sectorRows(R); assert.deepEqual(sec.map(x => x.code), ['education', 'health']);
});
test('impact: narrative + scope label + sheets', () => {
  const t = totals(R); const ar = narrative(t, 'ar', 'هذه السنة'); assert.ok(ar[0].includes('30 متعلمًا') && ar[0].includes('860 ساعة')); assert.ok(ar.some(x => x.includes('84.5%'))); assert.ok(ar.some(x => x.includes('+40%'))); assert.ok(ar.some(x => x.includes('B1 (5)')));
  const en = narrative(t, 'en', 'this year'); assert.ok(en[0].startsWith('During this year, 30 learners'));
  const empty = narrative(totals(EMPTY_REPORT), 'ar', 'x'); assert.equal(empty.length, 2); assert.ok(empty[1].includes('لا توجد بيانات'));
  assert.equal(scopeLabel(F, { sector: 'التعليم' }, 'ar'), 'الفترة 2026-01-01 → 2026-11-25 · قطاع: التعليم'); assert.equal(scopeLabel({ ...F, from: '', to: '', sector: '' }, {}, 'en'), 'all time');
  const sheets = impactSheets(R, F, { sector: 'التعليم' }); assert.deepEqual(sheets.map(s => s.name), ['الملخص', 'البرامج', 'مقارنة الجهات', 'المهارات', 'القطاعات']);
  assert.equal(sheets[1].rows.length, 3); assert.equal(sheets[1].rows[1][0], 'دبلوم إعداد المعلمين'); assert.equal(sheets[2].rows[1][7], 3.6); assert.equal(sheets[4].rows.length, 3);
  assert.ok(sheets[0].rows.some(r => r[0] === 'الخلاصة'));
});
test('impact: period presets, filter validation, rpc params', () => {
  const p = periodPresets(new Date('2026-11-25T08:00:00Z')); assert.equal(p[0].from, '2026-10-01'); assert.equal(p[1].from, '2026-08-28'); assert.equal(p[2].from, '2026-01-01'); assert.equal(p[3].from, '');
  assert.equal(validateFilters(F), null); assert.ok(validateFilters({ ...F, from: '2026/01/01' })); assert.ok(validateFilters({ ...F, from: '2026-12-01' }));
  assert.deepEqual(rpcParams({ from: '', to: '', sector: '', skill: '', org: '' }), { p_from: null, p_to: null, p_sector: null, p_skill: null, p_org: null }); assert.equal(rpcParams(F).p_sector, 'education');
});

const PROG = { id: 'p1', name_ar: 'دبلوم إعداد معلمي العربية', name_en: 'Arabic Teachers Diploma', status: 'ACTIVE', delivery_mode: 'remote', start_date: '2026-09-05', end_date: '2027-06-24', intro_ar: 'برنامج مكثف.\nسطر ثانٍ', objectives_ar: '- هدف 1\n- هدف 2', outcomes_ar: 'ناتج 1', audience_ar: 'المعلمون', fee: 12000, currency: 'SAR', seats: 30, program_type: 'diploma', is_public: true, registration_open: true, registration_deadline: '2026-12-31', hours: 120, cefr_level: 'B2', sector: 'education' };
const SK = [{ id: 's1', code: 'ATH-PD-001', name_ar: 'تصميم التعلم', name_en: 'Learning design', domain: 'pedagogy', saqf_level: 5 }];
test('open: site normalization + helpers', () => {
  assert.equal(normalizeSite('https://athar-portal.vercel.app/'), 'https://athar-portal.vercel.app'); assert.equal(normalizeSite('http://127.0.0.1:3100'), 'http://127.0.0.1:3100'); assert.equal(normalizeSite('garbage'), 'https://athar-portal.vercel.app'); assert.equal(normalizeSite(''), 'https://athar-portal.vercel.app');
  assert.equal(courseMode('remote'), 'online'); assert.equal(courseMode('hybrid'), 'blended'); assert.equal(courseMode(null), 'onsite'); assert.equal(hoursDuration(40), 'PT40H'); assert.equal(hoursDuration(0), undefined); assert.ok(availability('open').endsWith('InStock')); assert.ok(availability('full').endsWith('SoldOut'));
  assert.equal(sessionEnd({ starts_at: '2026-12-01T10:00:00Z', duration_min: 90 }), '2026-12-01T11:30:00.000Z'); assert.equal(sessionEnd({ starts_at: 'bad', duration_min: 1 }), undefined);
});
test('open: Course JSON-LD', () => {
  const c: any = courseJsonLd(PROG, 'https://x.sa', '2026-11-25', SK, { approved: 5 });
  assert.equal(c['@type'], 'Course'); assert.equal(c.name, 'Arabic Teachers Diploma'); assert.equal(c.alternateName, 'دبلوم إعداد معلمي العربية'); assert.equal(c.url, 'https://x.sa/programs/p1'); assert.equal(c.description, 'برنامج مكثف.');
  assert.deepEqual(c.teaches, ['Learning design']); assert.equal(c.educationalLevel, 'B2'); assert.equal(c.timeRequired, 'PT120H'); assert.equal(c.educationalCredentialAwarded, 'Diploma');
  assert.equal(c.offers.price, 12000); assert.equal(c.offers.priceCurrency, 'SAR'); assert.ok(c.offers.availability.endsWith('InStock')); assert.equal(c.offers.validThrough, '2026-12-31');
  assert.equal(c.hasCourseInstance[0].courseMode, 'online'); assert.equal(c.hasCourseInstance[0].location['@type'], 'VirtualLocation'); assert.deepEqual(c.about, ['هدف 1', 'هدف 2']);
  const free: any = courseJsonLd({ ...PROG, fee: 0, seats: 5, name_en: null, delivery_mode: 'onsite', location_ar: 'جدة' }, 'https://x.sa', '2026-11-25', [], { approved: 5 });
  assert.equal(free.name, 'دبلوم إعداد معلمي العربية'); assert.equal(free.alternateName, undefined); assert.equal(free.offers.category, 'Free'); assert.ok(free.offers.availability.endsWith('SoldOut')); assert.equal(free.hasCourseInstance[0].location.name, 'جدة'); assert.deepEqual(free.teaches, ['ناتج 1']);
  const noFee: any = courseJsonLd({ ...PROG, fee: null, start_date: null }, 'https://x.sa', '2026-11-25'); assert.equal(noFee.offers, undefined); assert.equal(noFee.hasCourseInstance, undefined);
});
test('open: Event JSON-LD + catalog shapes', () => {
  const s = { id: 'w1', kind: 'webinar', title_ar: 'ندوة', title_en: 'Webinar', description_ar: 'وصف', speaker_name: 'د. أحمد', starts_at: '2026-12-01T10:00:00Z', duration_min: 60, provider: 'teams', access: 'public', status: 'scheduled', skills: ['s1'], capacity: 100, lang: 'ar', program_id: 'p1' };
  const e: any = eventJsonLd(s, 'https://x.sa', { id: 'p1', name_ar: 'دبلوم' }, SK);
  assert.equal(e['@type'], 'Event'); assert.equal(e.startDate, '2026-12-01T10:00:00.000Z'); assert.equal(e.endDate, '2026-12-01T11:00:00.000Z'); assert.equal(e.duration, 'PT60M'); assert.equal(e.isAccessibleForFree, true); assert.equal(e.performer.name, 'د. أحمد'); assert.equal(e.superEvent['@id'], 'https://x.sa/programs/p1'); assert.equal(e.offers.price, 0); assert.ok(e.eventStatus.endsWith('EventScheduled'));
  const c: any = eventJsonLd({ ...s, kind: 'workshop', status: 'cancelled', access: 'registered' }, 'https://x.sa'); assert.equal(c['@type'], 'EducationEvent'); assert.ok(c.eventStatus.endsWith('EventCancelled')); assert.equal(c.isAccessibleForFree, false); assert.equal(c.offers, undefined);
  const cp: any = catalogProgram(PROG, 'https://x.sa', '2026-11-25', SK, [{ code: 'education', name_ar: 'التعليم', name_en: 'Education' }], { approved: 30 });
  assert.equal(cp.registration.state, 'full'); assert.equal(cp.registration.open, false); assert.equal(cp.sector.name.ar, 'التعليم'); assert.equal(cp.skills[0].code, 'ATH-PD-001'); assert.equal(cp.summary.ar, 'برنامج مكثف.'); assert.equal(cp.delivery, 'online'); assert.equal(cp.fee, 12000);
  const cs: any = catalogSession(s, 'https://x.sa', SK); assert.equal(cs.ends_at, '2026-12-01T11:00:00.000Z'); assert.equal(cs.recording, false); assert.equal(cs.skills.length, 1);
  const cr: any = catalogResource({ id: 'r1', title_ar: 'حقيبة', type: 'package', level: 'foundation', lang: 'ar', ai_ready: true, published_at: '2026-10-01T00:00:00Z', downloads: 7 }, 'https://x.sa'); assert.equal(cr.url, 'https://x.sa/resources/r1'); assert.equal(cr.ai_ready, true); assert.equal(cr.downloads, 7); assert.equal(cr.skills, undefined);
});
test('open: organization, issuer profile, person, envelope, script escaping', () => {
  const o: any = organizationJsonLd('https://x.sa'); assert.equal(o['@type'], 'EducationalOrganization'); assert.equal(o['@id'], 'https://x.sa/#organization'); assert.ok(o.founder.name.includes('Badawi')); assert.ok(Array.isArray(o.alternateName));
  const i: any = issuerProfile('https://x.sa'); assert.equal(i.id, 'https://x.sa/.well-known/athar.json'); assert.deepEqual(i.type, ['Profile']); assert.equal(i._athar.catalog, 'https://x.sa/api/catalog'); assert.ok(i._athar.copyright.includes('2026'));
  const p: any = personJsonLd({ public_id: 'ab12', display_name: 'سارة', headline: 'معلمة', city: 'جدة', skills: [{ code: 'x', name_ar: 'أ', name_en: 'A', computed_level: 3 }], credentials: [{ code: 'ATH-1111-2222', title_ar: 'إتمام', issued_at: '2026-11-10T00:00:00Z' }] }, 'https://x.sa');
  assert.equal(p['@type'], 'Person'); assert.deepEqual(p.knowsAbout, ['A']); assert.equal(p.hasCredential[0].url, 'https://x.sa/credential/ATH-1111-2222'); assert.equal(p.hasCredential[0].dateCreated, '2026-11-10'); assert.equal(p.affiliation, undefined);
  const env: any = catalogEnvelope('https://x.sa', { programs: [1], sessions: [], resources: [1, 2], sectors: [{ code: 'education', name_ar: 'التعليم', name_en: 'Education' }], skills: SK as any }, '2026-11-25T00:00:00Z');
  assert.equal(env.version, '1.0'); assert.deepEqual(env.counts, { programs: 1, sessions: 0, resources: 2, sectors: 1, skills: 1 }); assert.equal(env.issuer, 'https://x.sa/.well-known/athar.json'); assert.equal(env.links.jsonld, 'https://x.sa/api/catalog?format=jsonld'); assert.equal(env.skills[0].saqf_level, 5);
  const l: any = catalogItemList('https://x.sa', [{ a: 1 }, { b: 2 }]); assert.equal(l.numberOfItems, 2); assert.equal(l.itemListElement[1].position, 2);
  assert.equal(jsonLdScript({ x: '</script><b>' }), '{"x":"\\u003c/script>\\u003cb>"}');
});

const SKILLS: Skill[] = [
  { id: 's1', code: 'ATH-AR-004', name_ar: 'الاستماع', name_en: 'Listening', domain: 'arabic', level: 3, cefr_level: 'B1', active: true },
  { id: 's2', code: 'ATH-PD-001', name_ar: 'تصميم التعلم', name_en: 'Learning design', domain: 'pedagogy', level: 3, saqf_level: 5, active: true },
  { id: 's3', code: 'ATH-PD-002', name_ar: 'التقويم', name_en: 'Assessment', domain: 'pedagogy', level: 3, active: true },
];
const LV: SkillLevelRow[] = [
  { user_id: 'u1', skill_id: 's1', computed_level: 3.6, confidence: 80, evidence: [] }, { user_id: 'u1', skill_id: 's2', computed_level: 2.2, confidence: 30, evidence: [], approved_level: 4 }, { user_id: 'u1', skill_id: 's3', computed_level: 4.6, confidence: 50, evidence: [] }, { user_id: 'u1', skill_id: 'ghost', computed_level: 5, confidence: 90, evidence: [] },
];
const CR: Credential[] = [
  { id: 'c1', email: 'a@b.c', kind: 'program_completion', title_ar: 'إتمام الدبلوم', title_en: 'Diploma completion', skills: [], verify_code: 'ATH-AAAA-1111', issued_at: '2026-11-10T00:00:00Z', level: 'B2' },
  { id: 'c2', email: 'a@b.c', kind: 'attendance', title_ar: 'حضور ندوة', skills: [], verify_code: 'ATH-BBBB-2222', issued_at: '2026-10-01T00:00:00Z', revoked_at: '2026-10-05T00:00:00Z' },
];
test('passport: build from profile + levels + credentials', () => {
  const d = buildPassport({ profile: { public_id: 'ab12cd34', display_name: 'سارة أحمد', headline: 'معلمة لغة عربية', city: 'جدة', share_mode: 'link' }, levels: LV, skills: SKILLS, credentials: CR, site: 'https://x.sa/', lang: 'ar', now: new Date('2026-11-25T00:00:00Z') });
  assert.equal(d.name, 'سارة أحمد'); assert.equal(d.url, 'https://x.sa/p/ab12cd34'); assert.equal(d.qrText, d.url); assert.equal(d.sharePublic, true);
  assert.deepEqual(d.kpis, { skills: 3, strong: 1, approved: 1, credentials: 1 });
  assert.deepEqual(d.domains.map(x => x.items.length), [1, 2]); assert.equal(d.domains[1].items[0].code, 'ATH-PD-002'); assert.equal(d.domains[1].items[0].level, 5); assert.equal(d.domains[1].items[1].approved, true); assert.equal(d.domains[1].items[1].level, 4); assert.equal(d.domains[1].items[1].badges, 'SAQF 5');
  assert.equal(d.credentials.length, 1); assert.equal(d.credentials[0].code, 'ATH-AAAA-1111'); assert.equal(d.credentials[0].kind, 'إتمام برنامج'); assert.ok(d.footer.includes('2026'));
  const priv = buildPassport({ profile: { public_id: 'zz', share_mode: 'private' }, email: 'me@x.sa', levels: [], skills: [], credentials: [], site: 'https://x.sa', lang: 'en' });
  assert.equal(priv.name, 'me@x.sa'); assert.equal(priv.sharePublic, false); assert.equal(priv.qrText, 'https://x.sa/me/skills'); assert.ok(priv.verifyHint.startsWith('Profile is private')); assert.equal(priv.domains.length, 0);
  assert.equal(passportFilename(d), 'athar-skills-passport-سارة_أحمد.pdf'); assert.equal(passportFilename({ ...priv, name: '!!!' }), 'athar-skills-passport-zz.pdf');
});
test('passport: pagination splits long domains and credentials', () => {
  const many: SkillLevelRow[] = Array.from({ length: 40 }, (_, i) => ({ user_id: 'u', skill_id: `k${i}`, computed_level: 3, confidence: 40, evidence: [] }));
  const sk: Skill[] = many.map((l, i) => ({ id: l.skill_id, code: `ATH-PD-${String(i).padStart(3, '0')}`, name_ar: `مهارة ${i}`, name_en: `Skill ${i}`, domain: i < 30 ? 'pedagogy' : 'digital', level: 3, active: true }));
  const creds: Credential[] = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, email: 'a@b.c', kind: 'skill', title_ar: `شهادة ${i}`, skills: [], verify_code: `ATH-${i}`, issued_at: '2026-11-01T00:00:00Z' }));
  const d = buildPassport({ profile: { public_id: 'p', share_mode: 'public' }, levels: many, skills: sk, credentials: creds, site: 'https://x.sa', lang: 'ar' });
  const pages = paginate(d);
  assert.ok(pages.length >= 4, String(pages.length)); assert.equal(pages[0].cover, true); assert.equal(pages[0].domains.reduce((a, x) => a + x.items.length, 0), 13);
  const totalItems = pages.reduce((a, p) => a + p.domains.reduce((b, x) => b + x.items.length, 0), 0); assert.equal(totalItems, 40);
  const totalCreds = pages.reduce((a, p) => a + p.credentials.length, 0); assert.equal(totalCreds, 20); assert.ok(pages.every(p => p.credentials.length <= 18)); assert.equal(pages[pages.length - 1].total, pages.length); assert.equal(pages[0].index, 1);
  const small = paginate(buildPassport({ profile: { public_id: 'p', share_mode: 'public' }, levels: LV, skills: SKILLS, credentials: CR, site: 'https://x.sa', lang: 'ar' })); assert.equal(small.length, 1); assert.equal(small[0].credentials.length, 1);
  const empty = paginate(buildPassport({ profile: { public_id: 'p', share_mode: 'private' }, levels: [], skills: [], credentials: [], site: 'https://x.sa', lang: 'ar' })); assert.equal(empty.length, 1); assert.equal(empty[0].cover, true);
});
test('passport: portrait PDF writer produces a valid multi-page PDF', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegsToPortraitPdf([{ jpeg, w: 10, h: 14 }, { jpeg, w: 10, h: 14 }], 'جواز');
  const txt = new TextDecoder('latin1').decode(pdf);
  assert.ok(txt.startsWith('%PDF-1.4')); assert.ok(txt.includes('/Count 2')); assert.ok(txt.includes('/MediaBox [0 0 595.28 841.89]')); assert.ok(txt.includes('/Filter /DCTDecode')); assert.ok(txt.trimEnd().endsWith('%%EOF'));
  const startxref = Number(txt.match(/startxref\n(\d+)/)![1]); assert.equal(txt.slice(startxref, startxref + 4), 'xref');
  assert.ok(/\/Title <FEFF062c/i.test(txt)); // ج
});
