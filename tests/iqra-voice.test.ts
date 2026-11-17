// «صوت أَثَر الواحد»: الدوالّ النقية في lib/iqra/voice.ts (البحث عن المقاطع، الشخصيّات) — بلا متصفّح.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findCue, lineCues, roles, dabtOf, type Cues } from '../lib/iqra/voice';

const C: Cues = { v: 1, code: 'A1-U08-L04', src: '/iqra/audio/A1-U08-L04.mp3', level: 'A1', rate: '-20%', dur: 30, cast: 'athar-voices-1', cues: [
  { k: 'intro', s: 0, e: 5 },
  { k: 'line', i: 0, r: '', g: 'n', a: '', s: 5, e: 6 },
  { k: 'line', i: 1, r: 'ليلى', g: 'f', a: 'woman', s: 6, e: 9, d: 'السَّلَامُ عَلَيْكُمْ يَا عَمِّ.' },
  { k: 'line', i: 2, r: 'أبو سعد', g: 'm', a: 'man', s: 9, e: 13 },
  { k: 'line', i: 3, r: 'ليلى', g: 'f', a: 'woman', s: 13, e: 15 },
  { k: 'card', t: 'كيلو', s: 15, e: 16 }, { k: 'ex', t: 'كيلو عجوة لجدّتي فاطمة.', s: 16, e: 18 },
  { k: 'dict', t: 'بكم كيلو العجوة؟', s: 18, e: 20 }, { k: 'pic', t: 'اسمع: «نوف تزن التمر». اختر الصورة', s: 20, e: 22 }, { k: 'gex', t: 'تفضّلي مئة ريال.', s: 22, e: 24 },
] };

test('findCue: السطر برقمه والبطاقة/الإملاء/الصورة بنصّها والمدخل بلا مفتاح', () => {
  assert.equal(findCue(C, 'intro', '')?.s, 0);
  assert.equal(findCue(C, 'line', 2)?.r, 'أبو سعد');
  assert.equal(findCue(C, 'line', 9), null);
  assert.equal(findCue(C, 'card', 'كيلو')?.s, 15);
  assert.equal(findCue(C, 'ex', 'كيلو عجوة لجدّتي فاطمة.')?.e, 18);
  assert.equal(findCue(C, 'dict', 'بكم كيلو العجوة؟')?.s, 18);
  assert.equal(findCue(C, 'pic', 'اسمع: «نوف تزن التمر». اختر الصورة')?.s, 20);
  assert.equal(findCue(C, 'gex', 'تفضّلي مئة ريال.')?.s, 22);
  assert.equal(findCue(null, 'card', 'كيلو'), null);
  assert.equal(findCue(C, 'card', 'غير موجودة'), null);
});
test('lineCues/roles: الشخصيّات بترتيب الظهور وعدد أسطرها، بلا الراوي', () => {
  assert.equal(lineCues(C).length, 4);
  assert.deepEqual(roles(C), [{ r: 'ليلى', g: 'f', a: 'woman', n: 2 }, { r: 'أبو سعد', g: 'm', a: 'man', n: 1 }]);
  assert.deepEqual(roles(null), []);
});
test('dabtOf: الصورة المضبوطة إن وُجدت في المقطع وإلّا null', () => { assert.equal(dabtOf(findCue(C, 'line', 1)), 'السَّلَامُ عَلَيْكُمْ يَا عَمِّ.'); assert.equal(dabtOf(findCue(C, 'line', 2)), null); assert.equal(dabtOf(null), null); });
