// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P95: صفحة التحقّق بثلاث لغات + رابط QR الفرنسيّ + مِعيار ?lang */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickVerifyLang, programLabel, kindLabel, issuerLabel, VERIFY_T, verifyDir } from '../lib/certificates/verify-i18n';
import { verifyUrl } from '../lib/certificates/issue';
import { FRANCE } from '../lib/cohorts/france';

test('P95 verify i18n — pure functions', () => {
  assert.equal(pickVerifyLang('fr', 'en', 'ar-SA'), 'fr');
  assert.equal(pickVerifyLang(null, 'en', 'fr-FR'), 'en');
  assert.equal(pickVerifyLang(null, null, 'fr-FR'), 'fr');
  assert.equal(pickVerifyLang('de', 'xx', 'zh'), 'ar');
  assert.equal(verifyDir('ar'), 'rtl'); assert.equal(verifyDir('fr'), 'ltr');
  assert.equal(programLabel(FRANCE.certificate.programNameAr, 'fr'), FRANCE.certificate.programNameFr);
  assert.equal(programLabel(FRANCE.certificate.programNameAr, 'ar'), FRANCE.certificate.programNameAr);
  assert.equal(programLabel('برنامج آخر', 'en'), 'برنامج آخر'); assert.equal(programLabel(null, 'fr'), '—');
  assert.equal(issuerLabel('أَثَر', 'fr'), 'Athar'); assert.equal(issuerLabel('أَثَر', 'ar'), 'أَثَر');
  assert.equal(kindLabel('completion', 'fr'), 'Certificat de réussite'); assert.equal(kindLabel('completion', 'ar'), 'شهادة إتمام');
  for (const l of ['ar', 'fr', 'en'] as const) { const T = VERIFY_T[l]; assert.ok(T.title && T.hint && T.none && T.valid('X').includes('X') && T.revoked('1/1/2026').includes('1/1/2026')); }
  assert.ok(verifyUrl('ABC', 'fr').endsWith('/verify/ABC?lang=fr'));
  assert.ok(verifyUrl('ABC', 'en').endsWith('/verify/ABC')); assert.ok(verifyUrl('ABC').endsWith('/verify/ABC'));
  const fr = JSON.stringify(FRANCE); assert.ok(!/arabe\/anglais|Arabic\/English/.test(fr), 'cert language text fixed');
});
test('P95 — wiring: /verify pages use the dictionary, /france passes ?lang to Miaar, MiaarApp honours ?lang', () => {
  const read = (f: string) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const card = read('app/verify/[code]/VerifyCard.tsx'); const idx = read('app/verify/page.tsx');
  assert.ok(card.includes('useVerifyLang') && card.includes('data-testid="vf-lang"') && !card.includes('dir="rtl"'));
  assert.ok(idx.includes('VerifyLangSwitch') && idx.includes('?lang=${lang}') && !idx.includes('dir="rtl"'));
  assert.ok(read('app/france/page.tsx').includes('${FRANCE.links.miaar}?lang=${lang}'));
  assert.ok(read('app/miaar/MiaarApp.tsx').includes("get('lang')"));
});
