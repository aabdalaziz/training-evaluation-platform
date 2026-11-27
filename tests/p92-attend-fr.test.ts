// P92 «صفحة الحضور /attend بالفرنسيّة لمجموعة فرنسا»
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFranceSession, attendTitleFr, ATTEND_PROGRAM_FR, cohortDays, FRANCE } from '../lib/cohorts/france';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('P92: الاستدلال على جلسة فرنسا من الرمز أو العنوان أو اسم البرنامج فقط', () => {
  assert.ok(isFranceSession({ token: 'FR01B6637B' }));
  assert.ok(isFranceSession({ token: 'fr15df5206' }));
  assert.ok(isFranceSession({ title: 'مجموعة فرنسا — اليوم 1 (الأحد 6 ديسمبر)' }));
  assert.ok(isFranceSession({ program_name_en: 'Arabic Immersion Program — France Cohort (A. Sunbul) — December 2026' }));
  assert.ok(!isFranceSession({ token: 'AB12CD34EF', title: 'جلسة 1', program_name: 'برنامج التقييم', program_name_en: 'Evaluation Program' }));
  assert.ok(!isFranceSession({ token: 'FRANCE' }));
});

test('P92: عنوان فرنسيّ مشتقّ من التاريخ (Jour n / 15 · jour date mois)', () => {
  const days = cohortDays(); assert.equal(days.length, 15);
  assert.equal(attendTitleFr('2026-12-06'), 'Jour 1 / 15 · dimanche 6 décembre');
  assert.equal(attendTitleFr('2026-12-24'), 'Jour 15 / 15 · jeudi 24 décembre');
  assert.equal(attendTitleFr('2026-12-11'), 'vendredi 11 décembre'); // ليس يوم دراسة → التاريخ فقط
  assert.equal(ATTEND_PROGRAM_FR, FRANCE.certificate.programNameFr);
});

test('P92: نصوص الصفحة الفرنسيّة ومبدّل اللغات الثلاث و8h30', () => {
  const f = read('app/attend/[token]/CheckinForm.tsx');
  assert.match(f, /fr: \{\s*kicker: 'Enregistrement de présence'/);
  assert.ok(f.includes("['fr', 'en', 'ar']") && f.includes("['ar', 'en']"));
  assert.ok(f.includes('8h30') && !f.includes('8h15'));
  assert.ok(f.includes("STATUS_FR") && f.includes("'En retard'"));
  assert.ok(f.includes('pickLang(q, saved, navigator.language)'));
  assert.ok(f.includes("lang={lang === 'ar' ? 'ar' : 'en'}"), 'SignHelp يبقى ar/en');
});
