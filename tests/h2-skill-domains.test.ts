// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// هـ-2 (ب) — مجالات الخبرة الحيّة: البذرة · التسجيل · رموز المهارات للمجال الجديد · التحقّق · التجميع في قائمة الهيئة
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAINS, registerDomains, activeDomains, nextSkillCode, validateDomain, domainPayload, domainLabel, domainTone, validateSkill, EMPTY_SKILL } from '../lib/portal/skills';
import { groupByDomain } from '../app/components/Directory';

test('البذرة: المجالات الثمانية حاضرة بترتيبها وبادئاتها', () => {
  assert.equal(DOMAINS.length >= 8, true);
  assert.deepEqual(DOMAINS.slice(0, 8).map(d => d.value), ['arabic', 'pedagogy', 'leadership', 'quality', 'data_ai', 'digital', 'research', 'wellbeing']);
  assert.equal(DOMAINS.find(d => d.value === 'quality')!.prefix, 'QA');
  assert.equal(domainLabel('quality', 'ar'), 'الجودة والتقييم'); // المعجم: التقييم لا القياس
});

test('مجال جديد من القاعدة يُسجَّل ويظهر فورًا للجميع (المصفوفة المشتركة)', () => {
  const n0 = DOMAINS.length;
  registerDomains([{ code: 'finance', name_ar: 'المالية والاستثمار', name_en: 'Finance & investment', prefix: 'FN', tone: 'gold', sort: 90, active: true }]);
  assert.equal(DOMAINS.length, n0 + 1);
  assert.equal(domainLabel('finance', 'ar'), 'المالية والاستثمار');
  assert.equal(domainLabel('finance', 'en'), 'Finance & investment');
  assert.equal(domainTone('finance'), 'gold');
  assert.equal(DOMAINS[DOMAINS.length - 1].value, 'finance'); // بعد wellbeing (80) بترتيب sort
  // إعادة التسجيل تُحدِّث ولا تكرّر
  registerDomains([{ code: 'finance', name_ar: 'المالية', name_en: 'Finance', prefix: 'FN', tone: 'gold', sort: 90, active: true }]);
  assert.equal(DOMAINS.filter(d => d.value === 'finance').length, 1);
  assert.equal(domainLabel('finance', 'ar'), 'المالية');
});

test('رمز المهارة الأولى في المجال الجديد يستعمل بادئته: ATH-FN-001 ثم 002', () => {
  assert.equal(nextSkillCode('finance', []), 'ATH-FN-001');
  assert.equal(nextSkillCode('finance', [{ code: 'ATH-FN-001' }, { code: 'ATH-QA-007' }]), 'ATH-FN-002');
  assert.equal(nextSkillCode('quality', [{ code: 'ATH-QA-007' }]), 'ATH-QA-008');
  // مهارة في المجال الجديد تجتاز التحقّق
  assert.equal(validateSkill({ ...EMPTY_SKILL, code: 'ATH-FN-001', name_ar: 'قراءة القوائم المالية', name_en: 'Reading financial statements', domain: 'finance' }), null);
  assert.equal(validateSkill({ ...EMPTY_SKILL, code: 'ATH-ZZ-001', name_ar: 'مهارة', name_en: 'skill', domain: 'ghost' }), 'المجال غير صالح');
});

test('صفوف مشوّهة من القاعدة تُهمَل أو تُصحَّح بلا كسر', () => {
  const n0 = DOMAINS.length;
  registerDomains([{ code: 'Bad Code!', name_ar: 'x' }, { code: 'green_energy', name_ar: 'الطاقة الخضراء', prefix: 'toolong', tone: 'neon' }]);
  assert.equal(DOMAINS.length, n0 + 1);
  const g = DOMAINS.find(d => d.value === 'green_energy')!;
  assert.equal(g.prefix, 'GR'); assert.equal(g.tone, 'navy'); assert.equal(g.label.en, 'الطاقة الخضراء'); assert.equal(g.active, true);
  registerDomains([{ code: 'green_energy', name_ar: 'الطاقة الخضراء', name_en: 'Green energy', prefix: 'GE', tone: 'ok', sort: 95, active: false }]);
  assert.equal(activeDomains().some(d => d.value === 'green_energy'), false);
});

test('التحقّق من نموذج المجال الجديد وتجهيز الصفّ', () => {
  const ex = [{ value: 'arabic', prefix: 'AR' }];
  assert.equal(validateDomain({ code: 'Finance', name_ar: 'المالية', name_en: 'Finance', prefix: 'fn', tone: 'gold' }, ex), null);
  assert.match(validateDomain({ code: 'arabic', name_ar: 'المالية', name_en: 'Finance', prefix: 'FN', tone: 'gold' }, ex)!, /مستخدم/);
  assert.match(validateDomain({ code: 'finance', name_ar: 'المالية', name_en: 'Finance', prefix: 'AR', tone: 'gold' }, ex)!, /بادئة/);
  assert.match(validateDomain({ code: 'finance', name_ar: 'ما', name_en: 'Finance', prefix: 'FN', tone: 'gold' }, ex)!, /العربي/);
  assert.match(validateDomain({ code: 'finance', name_ar: 'المالية', name_en: 'Finance', prefix: 'FN', tone: 'neon' }, ex)!, /اللون/);
  const p = domainPayload({ code: ' Finance ', name_ar: ' المالية ', name_en: 'Finance', prefix: 'fn', tone: 'gold' });
  assert.equal(p.code, 'finance'); assert.equal(p.prefix, 'FN'); assert.equal(p.active, true); assert.equal(p.sort > 80, true);
});

test('قائمة «مجال الخبرة» تتجمّع بالمجال الحيّ — المجال الجديد مجموعة جديدة تلقائيًا', () => {
  const g = groupByDomain([
    { id: '1', domain: 'arabic', domain_ar: 'اللغة العربية' }, { id: '2', domain: 'finance', domain_ar: 'المالية' }, { id: '3', domain: 'arabic', domain_ar: 'اللغة العربية' }, { id: '4', domain: 'mystery', domain_ar: '' },
  ]);
  assert.deepEqual(g.map(x => [x.domain_ar, x.items.length]), [['اللغة العربية', 2], ['المالية', 1], ['mystery', 1]]);
});
