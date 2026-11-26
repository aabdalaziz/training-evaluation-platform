// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82 */ /** اختبارات «أَثَر يقرأ»: تفسير المسح (روابط أَثَر · أرقام الشهادات · IBAN · MRZ) · توقيع بطاقة أَثَر الرقمية والتحقّق منها */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScan, ibanValid, normalizeIban, fmtIban, mrzCheck, parseMrz } from '../lib/reader/parse';
import { signPass, verifyPass, PASS_READERS, PASS_TTL_S } from '../lib/reader/card';

const SITE = 'https://athar-portal.com';

test('parseScan: روابط أَثَر تُفسَّر إلى نوع + مسار داخلي', () => {
  const v = parseScan('https://athar-portal.com/verify/ATH-2026-000123', SITE); assert.equal(v.kind, 'verify'); assert.equal(v.code, 'ATH-2026-000123'); assert.equal(v.href, '/verify/ATH-2026-000123');
  assert.equal(parseScan('https://athar-portal.com/credential/AB12CD34EF', SITE).kind, 'verify');
  const a = parseScan('https://athar-portal.com/attend/abc123XYZ_-', SITE); assert.equal(a.kind, 'attend'); assert.equal(a.href, '/attend/abc123XYZ_-');
  const g = parseScan('https://athar-portal.com/gate/p/ZN32-HCWZ', SITE); assert.equal(g.kind, 'permit'); assert.equal(g.code, 'ZN32-HCWZ');
  const u = parseScan('https://athar-portal.com/programs', SITE); assert.equal(u.kind, 'url'); assert.equal(u.href, '/programs');
  const x = parseScan('https://example.org/x', SITE); assert.equal(x.kind, 'url'); assert.equal(x.href, 'https://example.org/x'); assert.equal(x.label_ar, 'رابط خارجي');
});

test('parseScan: رقم شهادة · رمز تحقّق · بطاقة أَثَر · نصّ حرّ', () => {
  assert.equal(parseScan(' ath-2026-000123 ').kind, 'verify'); assert.equal(parseScan('ath-2026-000123').code, 'ATH-2026-000123');
  assert.equal(parseScan('ABCDEFGH23').kind, 'verify');
  assert.equal(parseScan('ATHAR1.eyJ2IjoxfQ.c2lnbmF0dXJlMTIz').kind, 'pass');
  assert.equal(parseScan('مرحبًا').kind, 'text'); assert.equal(parseScan('').kind, 'text');
});

test('IBAN: MOD-97 صحيح/خاطئ · طول سعودي 24 · تنسيق', () => {
  assert.equal(ibanValid('SA03 8000 0000 6080 1016 7519'), true);
  assert.equal(ibanValid('SA0380000000608010167518'), false);
  assert.equal(ibanValid('SA038000000060801016751'), false);
  assert.equal(ibanValid('GB82WEST12345698765432'), true);
  assert.equal(normalizeIban('sa03-8000-0000-6080-1016-7519'), 'SA0380000000608010167519');
  assert.equal(fmtIban('SA0380000000608010167519'), 'SA03 8000 0000 6080 1016 7519');
  const h = parseScan('SA03 8000 0000 6080 1016 7519'); assert.equal(h.kind, 'iban'); assert.equal(h.label_ar, 'IBAN سعودي');
});

test('MRZ: رقم التحقّق 7-3-1 · TD3 (جواز العيّنة الرسمي) · TD1 (هوية) · فشل عند تحريف', () => {
  assert.equal(mrzCheck('L898902C3'), 6); assert.equal(mrzCheck('740812'), 2); assert.equal(mrzCheck('120415'), 9); assert.equal(mrzCheck('ab'), -1);
  const td3 = parseMrz('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10');
  assert.ok(td3); assert.equal(td3!.doc_type, 'P'); assert.equal(td3!.number, 'L898902C3'); assert.equal(td3!.surname, 'ERIKSSON'); assert.equal(td3!.given, 'ANNA MARIA'); assert.equal(td3!.birth, '1974-08-12'); assert.equal(td3!.expiry, '2012-04-15'); assert.equal(td3!.sex, 'F'); assert.equal(td3!.valid, true);
  const td1 = parseMrz('I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<');
  assert.ok(td1); assert.equal(td1!.number, 'D23145890'); assert.equal(td1!.nationality, 'UTO'); assert.equal(td1!.checks.number, true); assert.equal(td1!.checks.birth, true); assert.equal(td1!.checks.expiry, true); assert.equal(td1!.valid, true);
  const bad = parseMrz('I<UTOD231458908<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<'); assert.ok(bad); assert.equal(bad!.checks.number, false); assert.equal(bad!.valid, false);
  const hit = parseScan('I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<'); assert.equal(hit.kind, 'mrz'); assert.equal(hit.label_ar, 'شريط هوية/إقامة');
  assert.equal(parseMrz('hello\nworld'), null);
});

test('بطاقة أَثَر: توقيع ← تحقّق · رفض التلاعب والمفتاح الآخر والانتهاء · المفتاح السابق يُقبل · لا بيانات شخصية في الرمز', async () => {
  const env = { CRON_SECRET: 'k1' }; const uid = '101bdcac-95cc-46df-8ca9-96a2b1c903c1'; const now = 1_800_000_000;
  const t = await signPass(uid, env, now); assert.ok(t.startsWith('ATHAR1.')); assert.equal(parseScan(t).kind, 'pass'); assert.ok(t.length < 200);
  assert.equal(Buffer.from(t.split('.')[1], 'base64url').toString('utf8').includes('@'), false);
  const p = await verifyPass(t, env, now + 10); assert.ok(p); assert.equal(p!.u, uid); assert.equal(p!.e, now + PASS_TTL_S);
  assert.equal(await verifyPass(t, env, now + PASS_TTL_S + 1), null);
  assert.equal(await verifyPass(t, { CRON_SECRET: 'k2' }, now), null);
  assert.equal(await verifyPass(t.slice(0, -1) + (t.endsWith('A') ? 'B' : 'A'), env, now), null);
  assert.ok(await verifyPass(t, { CRON_SECRET: 'k2', TOKEN_SECRET_PREV: 'k1' }, now));
  assert.equal(await verifyPass('ATHAR1.x.y', env, now), null); assert.equal(await verifyPass(null, env), null);
  await assert.rejects(() => signPass('not-a-uuid', env));
  assert.ok(PASS_READERS.includes('TRAINER') && !PASS_READERS.includes('LEARNER'));
});

/* P82-ب: الإملاء الصوتي → قيمة حقل */
import { wordsToDigits, speechToPhone, speechToEmail, speechToName, fromSpeech, voiceCommand, toAsciiDigits } from '../lib/voice/dictate';
test('إملاء: كلمات الأرقام والأرقام الهندية → جوال · بريد منطوق → عنوان · اسم نظيف · أوامر', () => {
  assert.equal(toAsciiDigits('٠٥٦٤٤٤٠٤٠٦'), '0564440406');
  assert.equal(wordsToDigits('صفر خمسة ستة أربعة مرتين'), '0 5 6 44');
  assert.equal(speechToPhone('صفر خمسة ستة أربعة أربعة أربعة صفر أربعة صفر ستة'), '0564440406');
  assert.equal(speechToPhone('٠٥٦ ٤٤٤ ٠٤٠٦'), '0564440406');
  assert.equal(speechToPhone('زائد تسعة ستة ستة 564440406'), '+966564440406');
  assert.equal(speechToPhone('00966 564440406'), '+966564440406');
  assert.equal(speechToEmail('أحمد آت جيميل دوت كوم').endsWith('@gmail.com'), true);
  assert.equal(speechToEmail('info at athar-portal dot com'), 'info@athar-portal.com');
  assert.equal(speechToEmail('ahmed badawi at gmail'), 'ahmedbadawi@gmail.com');
  assert.equal(speechToName('  أحمد   محمد بدوي.'), 'أحمد محمد بدوي');
  assert.equal(speechToName('anna maria eriksson'), 'Anna Maria Eriksson');
  assert.equal(fromSpeech('number', 'خمسة وعشرون 25'), '25');
  assert.equal(voiceCommand('التالي'), 'next'); assert.equal(voiceCommand('نعم.'), 'next'); assert.equal(voiceCommand('أعد'), 'repeat'); assert.equal(voiceCommand('رجوع'), 'back'); assert.equal(voiceCommand('أرسل'), 'submit'); assert.equal(voiceCommand('تخطى'), 'skip'); assert.equal(voiceCommand('أحمد'), null);
});
