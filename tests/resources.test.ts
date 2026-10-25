// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P5: المهارات والقطاعات والجهات + مستودع الحقائب (قرار الوصول، الفلاتر، التحقق، Excel)
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAINS, SKILL_LEVELS, CEFR, SAQF_LEVELS, SECTORS_FALLBACK, domainLabel, skillLevelLabel, skillName, sectorName, frameworkBadges, nextSkillCode, EMPTY_SKILL, validateSkill, skillPayload, skillToForm, EMPTY_ORG, validateOrg, orgPayload, skillsSheet, orgsSheet } from '../lib/portal/skills';
import type { Skill, Organization } from '../lib/portal/skills';
import { RES_TYPES, RES_LEVELS, RES_DELIVERY, RES_LANGS, RES_ACCESS, RES_STATUS, typeLabel, typeIcon, levelLabel, accessLabel, statusLabel, resTitle, resSummary, resBody, fmtSize, fileKind, storageName, EMPTY_FILTERS, filterResources, sortResources, accessState, ACCESS_MSG, EMPTY_RES, validateResource, resourcePayload, resourceToForm, resourcesSheet, eventsSheet, resourceStats } from '../lib/portal/resources';
import type { Resource, LearningEvent } from '../lib/portal/resources';
import { SERVICES, NAV, serviceBySlug } from '../lib/portal/content';
import { ICON_PATHS } from '../lib/ui/icons';

const S = (o: Partial<Skill>): Skill => ({ id: 'sk', code: 'ATH-PD-001', name_ar: 'تصميم', name_en: 'Design', domain: 'pedagogy', level: 3, active: true, ...o });
const R = (o: Partial<Resource>): Resource => ({ id: 'r', created_at: '2026-11-01T00:00:00Z', title_ar: 'حقيبة', type: 'package', skills: [], level: 'foundation', delivery: 'self', ai_ready: false, lang: 'ar', access: 'public', version: '1.0', tags: [], status: 'published', downloads: 0, views: 0, ...o });

test('skills: catalogs are complete and bilingual', () => {
  assert.equal(DOMAINS.length, 8); assert.equal(SKILL_LEVELS.length, 5); assert.equal(CEFR.length, 6); assert.equal(SAQF_LEVELS.length, 8); assert.equal(SECTORS_FALLBACK.length, 12);
  for (const d of DOMAINS) { assert.ok(d.label.ar && d.label.en && d.tone); }
  assert.equal(domainLabel('data_ai', 'ar'), 'البيانات والذكاء الاصطناعي'); assert.equal(domainLabel('data_ai', 'en'), 'Data & AI'); assert.equal(domainLabel('zzz', 'ar'), 'zzz');
  assert.equal(skillLevelLabel(5, 'en'), 'Expert'); assert.equal(skillLevelLabel(9, 'ar'), '9');
  assert.equal(skillName(S({}), 'en'), 'Design'); assert.equal(skillName(S({ name_en: '' }), 'en'), 'تصميم');
  assert.equal(sectorName('gov', [], 'ar'), 'القطاع الحكومي'); assert.equal(sectorName('gov', [{ code: 'gov', name_ar: 'حكومي', name_en: 'Gov', sort: 1, active: true }], 'en'), 'Gov'); assert.equal(sectorName(null, [], 'ar'), ''); assert.equal(sectorName('x', [], 'ar'), 'x');
});

test('skills: framework badges and code generation', () => {
  assert.deepEqual(frameworkBadges({ saqf_level: 5, sdaia_code: 'SDAIA-AI-2', cefr_level: 'B2' }).map(b => b.label), ['SAQF 5', 'SDAIA-AI-2', 'CEFR B2']);
  assert.equal(frameworkBadges({ saqf_level: null, sdaia_code: null, cefr_level: null }).length, 0);
  assert.equal(nextSkillCode('pedagogy', []), 'ATH-PD-001');
  assert.equal(nextSkillCode('pedagogy', [{ code: 'ATH-PD-001' }, { code: 'ATH-PD-007' }, { code: 'ATH-AR-009' }]), 'ATH-PD-008');
  assert.equal(nextSkillCode('data_ai', [{ code: 'ATH-DA-002' }]), 'ATH-DA-003');
  assert.equal(nextSkillCode('wellbeing', []), 'ATH-WB-001');
});

test('skills: validation + payload round-trip', () => {
  assert.equal(validateSkill({ ...EMPTY_SKILL }), 'الرمز يجب أن يكون بصيغة ATH-XX-000');
  assert.equal(validateSkill({ ...EMPTY_SKILL, code: 'ATH-PD-010' }), 'الاسم العربي مطلوب (3 أحرف على الأقل)');
  assert.equal(validateSkill({ ...EMPTY_SKILL, code: 'ATH-PD-010', name_ar: 'مهارة', name_en: 'Sk' }), 'الاسم الإنجليزي مطلوب');
  const ok = { ...EMPTY_SKILL, code: 'ath-pd-010', name_ar: 'مهارة', name_en: 'Skill', saqf_level: '5', cefr_level: 'B1', sdaia_code: ' X-1 ' };
  assert.equal(validateSkill(ok), null); assert.equal(validateSkill({ ...ok, saqf_level: '9' }), 'مستوى SAQF بين 1 و8'); assert.equal(validateSkill({ ...ok, cefr_level: 'Z9' }), 'مستوى CEFR غير صالح'); assert.equal(validateSkill({ ...ok, level: 0 }), 'المستوى بين 1 و5');
  const p = skillPayload(ok); assert.equal(p.code, 'ATH-PD-010'); assert.equal(p.saqf_level, 5); assert.equal(p.sdaia_code, 'X-1'); assert.equal(p.sector, null); assert.ok(p.updated_at);
  const f = skillToForm(S({ saqf_level: 6, sdaia_code: null, cefr_level: 'C1', sector: 'gov', description_ar: 'د' }));
  assert.equal(f.saqf_level, '6'); assert.equal(f.sdaia_code, ''); assert.equal(f.cefr_level, 'C1'); assert.equal(f.sector, 'gov'); assert.equal(f.description_ar, 'د');
});

test('organizations: validation + payload', () => {
  assert.equal(validateOrg({ ...EMPTY_ORG }), 'اسم الجهة مطلوب');
  assert.equal(validateOrg({ ...EMPTY_ORG, name_ar: 'وزارة', contact_email: 'bad' }), 'بريد جهة الاتصال غير صالح');
  assert.equal(validateOrg({ ...EMPTY_ORG, name_ar: 'وزارة', email_domain: 'not a domain' }), 'نطاق البريد غير صالح (مثال: moe.gov.sa)');
  assert.equal(validateOrg({ ...EMPTY_ORG, name_ar: 'وزارة', email_domain: 'MOE.gov.sa', contact_email: 'A@B.co' }), null);
  const p = orgPayload({ ...EMPTY_ORG, name_ar: ' وزارة ', email_domain: 'MOE.gov.sa', contact_email: 'A@B.co' }); assert.equal(p.name_ar, 'وزارة'); assert.equal(p.email_domain, 'moe.gov.sa'); assert.equal(p.contact_email, 'a@b.co'); assert.equal(p.name_en, null);
  const o: Organization = { id: 'o1', name_ar: 'وزارة التعليم', name_en: 'MoE', sector: 'gov', email_domain: 'moe.gov.sa', active: true };
  const sh = orgsSheet([o], SECTORS_FALLBACK); assert.equal(sh.rows.length, 2); assert.equal(sh.rows[1][2], 'القطاع الحكومي'); assert.equal(sh.rows[1][7], 'moe.gov.sa');
  const sk = skillsSheet([S({ saqf_level: 5 })], []); assert.equal(sk.rows[1][0], 'ATH-PD-001'); assert.equal(sk.rows[1][5], 5); assert.equal(sk.rows[1][9], 'نعم');
});

test('resources: catalogs, labels, icons exist', () => {
  assert.equal(RES_TYPES.length, 8); assert.equal(RES_LEVELS.length, 3); assert.equal(RES_DELIVERY.length, 3); assert.equal(RES_LANGS.length, 3); assert.equal(RES_ACCESS.length, 5); assert.equal(Object.keys(RES_STATUS).length, 3);
  for (const tp of RES_TYPES) assert.ok(tp.icon in ICON_PATHS, `icon ${tp.icon}`);
  assert.equal(typeLabel('assessment', 'ar'), 'أداة تقويم'); assert.equal(typeLabel('assessment', 'en'), 'Assessment tool'); assert.equal(typeIcon('video'), 'play'); assert.equal(typeIcon('zzz'), 'folder');
  assert.equal(levelLabel('advanced', 'en'), 'Advanced'); assert.equal(accessLabel('org', 'ar'), 'لجهة محددة'); assert.equal(statusLabel('draft', 'en'), 'Draft');
  assert.equal(resTitle(R({ title_en: 'Kit' }), 'en'), 'Kit'); assert.equal(resTitle(R({ title_en: null }), 'en'), 'حقيبة');
  assert.equal(resSummary(R({ summary_ar: 'م' }), 'en'), 'م'); assert.deepEqual(resBody(R({ body_ar: 'أ\n\nب \n' }), 'ar'), ['أ', 'ب']);
  for (const k of Object.keys(ACCESS_MSG)) assert.ok(ACCESS_MSG[k as keyof typeof ACCESS_MSG].ar.length > 10);
});

test('resources: file helpers', () => {
  assert.equal(fmtSize(0, 'ar'), '—'); assert.equal(fmtSize(900, 'en'), '900 B'); assert.equal(fmtSize(1536, 'en'), '1.5 KB'); assert.equal(fmtSize(5 * 1024 * 1024, 'ar'), '5.0 م.ب'); assert.equal(fmtSize(120 * 1024 * 1024, 'en'), '120 MB');
  assert.equal(fileKind('a.PDF'), 'pdf'); assert.equal(fileKind('x.docx'), 'doc'); assert.equal(fileKind('x.pptx'), 'slides'); assert.equal(fileKind('x.xlsx'), 'sheet'); assert.equal(fileKind('x.mp4'), 'video'); assert.equal(fileKind('x.bin', 'image/png'), 'image'); assert.equal(fileKind('x.zip'), 'zip'); assert.equal(fileKind('x.unknown'), 'file');
  const n = storageName('دليل المدرب (نسخة 2).pdf'); assert.ok(/^[0-9a-z]+-/.test(n)); assert.ok(!n.includes(' ')); assert.ok(n.endsWith('.pdf')); assert.ok(n.includes('دليل_المدرب'));
  assert.ok(storageName('!!!').endsWith('-file') || storageName('!!!').length > 2);
});

test('resources: filters and sorting', () => {
  const sk = [S({ id: 's1', code: 'ATH-AR-001', name_ar: 'التواصل الشفهي', name_en: 'Spoken' }), S({ id: 's2', code: 'ATH-DA-002', name_ar: 'الذكاء الاصطناعي', name_en: 'AI' })];
  const rows = [
    R({ id: 'a', title_ar: 'حقيبة العربية', type: 'package', sector: 'edu_k12', level: 'foundation', lang: 'ar', skills: ['s1'], published_at: '2026-11-02T00:00:00Z', program_id: 'p1' }),
    R({ id: 'b', title_ar: 'دليل الذكاء', title_en: 'AI guide', type: 'guide', sector: 'tech', level: 'advanced', lang: 'both', skills: ['s2'], tags: ['ai', 'تعليم'], published_at: '2026-11-05T00:00:00Z' }),
    R({ id: 'c', title_ar: 'أداة تقويم', type: 'assessment', sector: 'edu_k12', level: 'intermediate', lang: 'en', skills: [], published_at: '2026-11-01T00:00:00Z' }),
  ];
  const f = (o: Partial<typeof EMPTY_FILTERS>) => filterResources(rows, { ...EMPTY_FILTERS, ...o }, sk).map(r => r.id);
  assert.deepEqual(f({}), ['a', 'b', 'c']);
  assert.deepEqual(f({ type: 'guide' }), ['b']); assert.deepEqual(f({ sector: 'edu_k12' }), ['a', 'c']); assert.deepEqual(f({ level: 'advanced' }), ['b']);
  assert.deepEqual(f({ lang: 'ar' }), ['a', 'b'], 'bilingual items match any language'); assert.deepEqual(f({ lang: 'en' }), ['b', 'c']);
  assert.deepEqual(f({ skill: 's1' }), ['a']); assert.deepEqual(f({ program: 'p1' }), ['a']);
  assert.deepEqual(f({ q: 'ai' }), ['b']); assert.deepEqual(f({ q: 'الشفهي' }), ['a'], 'search matches skill names'); assert.deepEqual(f({ q: 'تعليم' }), ['b'], 'search matches tags'); assert.deepEqual(f({ q: 'ATH-DA' }), ['b']);
  assert.deepEqual(sortResources(rows).map(r => r.id), ['b', 'a', 'c']);
});

test('resources: client-side access state mirrors SQL rules', () => {
  const anon = { user: null, approvedPrograms: [], orgIds: [] };
  const learner = { user: { id: 'u', email: 'x@moe.gov.sa' }, role: null, approvedPrograms: ['p1'], orgIds: ['o1'] };
  const trainer = { ...learner, role: 'TRAINER', approvedPrograms: [], orgIds: [] };
  assert.equal(accessState(R({ access: 'public' }), anon), 'ok');
  assert.equal(accessState(R({ access: 'public', status: 'draft' }), anon), 'not_found');
  assert.equal(accessState(R({ access: 'registered' }), anon), 'login'); assert.equal(accessState(R({ access: 'registered' }), learner), 'ok');
  assert.equal(accessState(R({ access: 'program', program_id: 'p1' }), learner), 'ok'); assert.equal(accessState(R({ access: 'program', program_id: 'p2' }), learner), 'program'); assert.equal(accessState(R({ access: 'program', program_id: null }), learner), 'ok');
  assert.equal(accessState(R({ access: 'org', organization_id: 'o1' }), learner), 'ok'); assert.equal(accessState(R({ access: 'org', organization_id: 'o9' }), learner), 'org'); assert.equal(accessState(R({ access: 'org', organization_id: null }), learner), 'ok');
  assert.equal(accessState(R({ access: 'staff' }), learner), 'staff'); assert.equal(accessState(R({ access: 'staff' }), trainer), 'ok'); assert.equal(accessState(R({ access: 'program', program_id: 'p9' }), trainer), 'ok');
});

test('resources: admin form validation + payload round-trip', () => {
  assert.equal(validateResource({ ...EMPTY_RES }), 'العنوان العربي مطلوب (4 أحرف على الأقل)');
  const base = { ...EMPTY_RES, title_ar: 'حقيبة تدريبية' };
  assert.equal(validateResource(base), null);
  assert.equal(validateResource({ ...base, access: 'program' }), 'اختر البرنامج المرتبط لمستوى الوصول «لمتدربي البرنامج»');
  assert.equal(validateResource({ ...base, access: 'org' }), 'اختر الجهة المرتبطة لمستوى الوصول «لجهة محددة»');
  assert.equal(validateResource({ ...base, access: 'org', organization_id: 'o1' }), null);
  assert.equal(validateResource({ ...base, version: 'v1' }), 'رقم الإصدار بصيغة 1.0 أو 2.1'); assert.equal(validateResource({ ...base, version: '2.1.3' }), null);
  assert.equal(validateResource({ ...base, skills: new Array(13).fill('s') }), 'الحد الأقصى 12 مهارة');
  const p = resourcePayload({ ...base, tags: ' تقويم ، CEFR, دليل ', title_en: ' ', program_id: '', cover_url: '' });
  assert.deepEqual(p.tags, ['تقويم', 'CEFR', 'دليل']); assert.equal(p.title_en, null); assert.equal(p.program_id, null); assert.equal(p.cover_url, null); assert.equal(p.version, '1.0');
  const f = resourceToForm(R({ tags: ['a', 'b'], skills: ['s1'], program_id: 'p1', ai_ready: true })); assert.equal(f.tags, 'a، b'); assert.deepEqual(f.skills, ['s1']); assert.equal(f.program_id, 'p1'); assert.equal(f.ai_ready, true);
});

test('resources: sheets and stats', () => {
  const sk = [S({ id: 's1', name_ar: 'تصميم البرامج' })];
  const rows = [R({ id: 'a', status: 'published', downloads: 5, views: 10, skills: ['s1'], sector: 'gov', ai_ready: true }), R({ id: 'b', status: 'draft', downloads: 1, views: 2 }), R({ id: 'c', status: 'archived' })];
  const st = resourceStats(rows); assert.deepEqual(st, { total: 3, published: 1, drafts: 1, downloads: 6, views: 12, aiReady: 1 });
  const sh = resourcesSheet(rows, sk, SECTORS_FALLBACK); assert.equal(sh.rows.length, 4); assert.equal(sh.rows[1][3], 'القطاع الحكومي'); assert.equal(sh.rows[1][8], 'تصميم البرامج'); assert.equal(sh.rows[1][9], 'نعم'); assert.equal(sh.rows[1][14], 5); assert.equal(sh.widths.length, sh.rows[0].length);
  const ev: LearningEvent[] = [{ id: 1, at: '2026-11-05T10:20:00Z', user_id: null, email: null, verb: 'downloaded', object_type: 'resource_file', object_id: 'f1', skills: [], context: { resource_id: 'a', file_name: 'guide.pdf' } }];
  const es = eventsSheet(ev, new Map([['a', 'حقيبة']])); assert.equal(es.rows[1][1], 'زائر'); assert.equal(es.rows[1][4], 'حقيبة'); assert.equal(es.rows[1][5], 'guide.pdf');
});

test('resources: portal content exposes the repository as live', () => {
  const s = serviceBySlug('resources')!; assert.equal(s.status, 'live'); assert.equal(s.cta.href, '/resources'); assert.equal((s as any).phase, undefined);
  assert.ok(NAV.some(n => n.href === '/resources')); assert.equal(SERVICES.filter(x => x.status === 'soon').length, 0);
});
