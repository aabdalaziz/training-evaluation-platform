import test from 'node:test';
import assert from 'node:assert/strict';
import { judge, normalizeAr, wordCount, TALK_COMMON, TALK_FORBIDDEN } from '../lib/kids/talk';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..');
const bayt = { role: 'answer' as const, accept: ['مكان', 'دولاب', 'رف', 'خزان', 'عند باب', 'جنب باب', 'في بيت', 'غرف', 'تحت سرير', 'رجلي', 'لابس'], alt: { accept: ['ما ادري', 'لا اعرف', 'ضاع', 'ما اعرف'], reply: { text: '', audio: '' } } };
const tell = { role: 'tell' as const, accept: ['بابا', 'ابي', 'اب', 'ماما', 'امي', 'ام', 'اخ', 'اخت', 'جد', 'عم', 'خال'] };
const correct = { role: 'correct' as const, accept: ['تحت', 'جنب', 'في بيت', 'باب في'] };
const hello = { role: 'hello' as const, accept: [] as string[] };

test('حَديثٌ مَعَ لُؤْلُؤ: التطبيع العربي', () => {
  assert.equal(normalizeAr('حِذائي في الدُّولابْ!'), 'حذاءي في دولاب');
  assert.equal(normalizeAr('الْبابُ فَوْقَ الْبَيْتْ'), 'باب فوق بيت');
  assert.equal(normalizeAr('  '), '');
  assert.equal(normalizeAr('123 ok'), '');
});

test('حَديثٌ مَعَ لُؤْلُؤ: المطابقة — 25 حالة (فصحى وعاميّة وصمت وضجيج)', () => {
  const cases: [Parameters<typeof judge>[0], string, string][] = [
    [hello, 'أهلا يا لؤلؤ', 'yes'], [hello, 'مرحبا', 'yes'], [hello, 'بسم الله', 'yes'], [hello, '', 'silent'],
    [bayt, 'حذائي في مكانه', 'yes'], [bayt, 'في الدولاب', 'yes'], [bayt, 'عند الباب', 'yes'], [bayt, 'جنب الباب', 'yes'],
    [bayt, 'تحت السرير', 'yes'], [bayt, 'في رجلي', 'yes'], [bayt, 'ما أدري', 'alt'], [bayt, 'لا أعرف', 'alt'],
    [bayt, 'قطة', 'no'], [bayt, '', 'silent'], [bayt, '…', 'silent'],
    [tell, 'بابا وماما', 'yes'], [tell, 'أبي وأمي وأختي', 'yes'], [tell, 'جدّتي', 'yes'], [tell, 'السيارة', 'no'],
    [correct, 'لا، الباب في البيت', 'yes'], [correct, 'غلط', 'yes'], [correct, 'تحت', 'yes'], [correct, 'نعم', 'no'],
    [correct, 'صح', 'no'], [correct, 'أيوه صحيح', 'no'],
  ];
  assert.equal(cases.length, 25);
  for (const [t, heard, want] of cases) assert.equal(judge(t, heard), want, `${t.role}: «${heard}»`);
});

test('حَديثٌ مَعَ لُؤْلُؤ: الأسطر المشتركة — موجودة صوتيًّا · ≤ 15 كلمة · قاعدة الوقف · لا كلمات محظورة', () => {
  for (const [k, L] of Object.entries(TALK_COMMON)) {
    const f = path.join(ROOT, 'public/kids/common/audio', L.audio.replace('common:', '') + '.mp3');
    assert.ok(fs.existsSync(f), k);
    assert.ok(wordCount(L.text) <= 15, k);
    const n = normalizeAr(L.text);
    for (const bad of TALK_FORBIDDEN) assert.ok(!n.includes(normalizeAr(bad)), `${k}: ${bad}`);
    const chunks = L.text.split(/[.!؟]+/).map(c => c.replace(/[»«]/g, '').trim()).filter(Boolean);
    for (const c of chunks) assert.ok(/[…،:]$/.test(c) || /[ْـاىيوءؤئةأإآ]$/.test(c), `${k}: «${c}»`);
  }
});

test('حَديثٌ مَعَ لُؤْلُؤ: talk.ts لا يستدعي الشبكة', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/kids/talk.ts'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon|https?:\/\//.test(src));
});

import { SESSIONS } from '../lib/kids/sessions';
import { kidsSnd } from '../lib/kids/types';
for (const S of SESSIONS) {
  test(`حَديثٌ مَعَ لُؤْلُؤ [${S.slug}]: 3 دورات (أجب/أخبرني/صحّح) + ختم · ≤ 15 كلمة · لا محظورات · قاعدة الوقف · 25+ جذعًا`, () => {
    const T = S.talk!; assert.ok(T);
    assert.deepEqual(T.turns.map(t => t.role), ['answer', 'tell', 'correct']);
    const lines = [...T.turns.flatMap(t => [t.q, t.yes, t.model, ...(t.alt ? [t.alt.reply] : [])]), T.final];
    for (const L of lines) {
      assert.ok(wordCount(L.text) <= 15 || L === T.final, L.text);
      const n = normalizeAr(L.text); for (const bad of TALK_FORBIDDEN) assert.ok(!n.includes(normalizeAr(bad)), `${bad}: ${L.text}`);
      for (const c of L.text.split(/[.!؟]+/).map(c => c.replace(/[»«]/g, '').trim()).filter(Boolean)) assert.ok(/[…،:]$/.test(c) || /[ْـاىيوءؤئةأإآ]$/.test(c), `وقف: «${c}»`);
    }
    assert.ok(T.turns.reduce((n, t) => n + t.accept.length, 0) >= 25);
    for (const t of T.turns) { assert.equal(judge(t, t.model.text), 'yes', `النموذج يطابق نفسه: ${t.model.text}`); assert.equal(judge(t, ''), 'silent'); }
  });
  test(`حَديثٌ مَعَ لُؤْلُؤ [${S.slug}]: أصوات الحوار موجودة`, () => {
    const T = S.talk!;
    const keys = [...T.turns.flatMap(t => [t.q.audio, t.yes.audio, t.model.audio, ...(t.alt ? [t.alt.reply.audio] : [])]), T.final.audio];
    const missing = keys.filter(k => !fs.existsSync(path.join(ROOT, 'public', kidsSnd(S.slug, k))));
    assert.deepEqual(missing, []);
  });
}
