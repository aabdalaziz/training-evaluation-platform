// P91 «شهادة عربيّ/فرنسيّ لمجموعة فرنسا + التأخير 8:30»
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KIND_LABEL, ISSUER_FR, periodFr, fmtDateFr, WISH_FR, FOOTER_FR } from '../lib/certificates/render';
import { certLocale, certProfile, profileMeta } from '../lib/certificates/locale';
import { previewData, rowToData } from '../lib/certificates/issue';
import { FRANCE, T } from '../lib/cohorts/france';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('P91: تسميات الأنواع الثلاثة بالفرنسيّة + سطر المُصدِر', () => {
  for (const k of ['completion', 'attendance', 'appreciation'] as const) { assert.ok(KIND_LABEL[k].fr.startsWith('Certificat'), k); assert.ok(KIND_LABEL[k].verb_fr.length > 10); }
  assert.equal(KIND_LABEL.completion.fr, 'Certificat de réussite'); assert.match(ISSUER_FR, /^Athar — Portail/);
});

test('P91: certLocale — فرنسا ← fr باسم البرنامج الفرنسيّ؛ غيرها ← en باسم name_en', () => {
  assert.deepEqual(certLocale(FRANCE.programId, 'Arabic Immersion Program'), { lang2: 'fr', program_en: FRANCE.certificate.programNameFr });
  assert.equal(FRANCE.certificate.programNameFr, 'Programme d’immersion en arabe — Décembre 2026'); assert.equal(FRANCE.certificate.programNameAr, 'برنامج الانغماس اللغوي — ديسمبر 2026');
  assert.ok(!/فرنسا|سنبل|Sunbul|France/.test(FRANCE.certificate.programNameAr + FRANCE.certificate.programNameFr), 'بلا «مجموعة فرنسا (أ. عمرو سنبل)»');
  assert.deepEqual(certLocale('other', 'Some Program'), { lang2: 'en', program_en: 'Some Program' });
  assert.deepEqual(certLocale(null, null), { lang2: 'en', program_en: null });
});

test('P91: lang2 يسري في المعاينة وفي إعادة الرسم من الصفّ (meta.lang2)', () => {
  const base: any = { kind: 'completion', recipient_name: 'Inès', program_name: 'برنامج' };
  assert.equal(previewData(base, 'Programme X', 'fr').lang2, 'fr'); assert.equal(previewData(base, 'Program X').lang2, null);
  const row: any = { kind: 'completion', recipient_name: 'Inès', recipient_name_en: 'Ines', program_name: 'برنامج', meta: { program_en: 'Programme X', lang2: 'fr' }, verify_code: 'ABC', serial: 'ATH-1', issued_at: '2026-12-26' };
  const d = rowToData(row); assert.equal(d.lang2, 'fr'); assert.equal(d.program_en, 'Programme X');
  assert.equal(rowToData({ ...row, meta: {} }).lang2, null, 'الشهادات القديمة بلا lang2 → إنجليزيّة كما كانت');
  const r = read('lib/certificates/render.ts'); assert.ok(r.includes("fr ? K.fr : K.en") && r.includes('fr ? ISSUER_FR') && r.includes('K.verb_fr'));
  const a = read('app/admin/certificates/page.tsx'); assert.equal((a.match(/certProfile\(/g) || []).length, 1);
});

test('P91: التأخير بعد 8:30 في إعدادات فرنسا ونصوصها الثلاث — ولا أثر لـ8:15', () => {
  assert.equal(FRANCE.lateAfter, '08:30');
  const all = JSON.stringify([T.en.steps, T.fr.steps, T.ar.steps]);
  assert.ok(/08:30|08h30/.test(all) && !/8:15|8h15/.test(all));
  assert.ok(!/8:15|8h15/.test(read('lib/cohorts/france.ts')));
});

test('P91: ملفّ شهادة فرنسا — بلا شعبة ولا مدرّب · «متمنين لها» · التوقيعان المطلوبان · يُحفظ في meta ويُعاد منه', () => {
  const p = certProfile(FRANCE.programId, 'x');
  assert.equal(p.hide_classroom, true); assert.equal(p.hide_trainer, true); assert.equal(p.wish_to, 'لها');
  assert.deepEqual(p.sign1, { name: 'د/ أحمد عبدالعزيز', title: 'المدير الأكاديمي', title_fr: 'Directeur académique' }); assert.deepEqual(p.sign2, { name: 'د/ عبدالله العتيبي', title: 'المدير العام', title_fr: 'Directeur général' });
  const other = certProfile('other', 'P'); assert.ok(!other.hide_classroom && !other.hide_trainer && !other.wish_to && !other.sign1, 'البرامج الأخرى كما كانت');
  const m = profileMeta(p); assert.equal(m.lang2, 'fr'); assert.equal(m.wish_to, 'لها');
  const row: any = { kind: 'completion', recipient_name: 'إيناس', program_name: 'برنامج', meta: m, verify_code: 'A', serial: 'S', issued_at: '2026-12-26' };
  const d = rowToData(row); assert.equal(d.wish_to, 'لها'); assert.deepEqual(d.sign2, p.sign2);
  const pv = previewData({ kind: 'completion', recipient_name: 'إيناس', program_name: 'برنامج', meta: m } as any, p.program_en, p.lang2); assert.equal(pv.sign1?.title, 'المدير الأكاديمي');
  const r = read('lib/certificates/render.ts'); assert.ok(r.includes("d.wish_to || 'لهم'") && r.includes('d.sign1 ? d.sign1.name'));
  const a = read('app/admin/certificates/page.tsx'); assert.ok(a.includes('prof.hide_classroom ? null') && a.includes('prof.hide_trainer ? null') && a.includes('profileMeta(prof)'));
});

test('P91: فرنسيّة كاملة — الفترة والساعات، الختام، المسمّيات، سطر التحقّق', () => {
  assert.equal(fmtDateFr('2026-12-06'), '6 décembre 2026');
  assert.equal(periodFr('2026-12-06', '2026-12-26', 60), 'Du 6 au 26 décembre 2026 · 60 heures de formation');
  assert.equal(periodFr('2026-11-30', '2026-12-04', null), 'Du 30 novembre 2026 au 4 décembre 2026');
  assert.equal(periodFr('2026-12-06', null, 20), 'Le 6 décembre 2026 · 20 heures de formation'); assert.equal(periodFr(null, null, null), '');
  assert.match(WISH_FR, /vœux/); assert.match(FOOTER_FR, /athar-portal\.com\/verify/);
  const r = read('lib/certificates/render.ts'); for (const k of ['periodFr(d.start, d.end', 'WISH_FR, W / 2', 'FOOTER_FR, W / 2', 'titleFr', "fr ? 160 : 200"]) assert.ok(r.includes(k), k);
});
