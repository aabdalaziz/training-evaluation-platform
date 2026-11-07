// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P53-ب «أرسل من بريدك» — مسوَّدات بريد النتائج اليدوية (قبل تفعيل النطاق/Resend) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resultMailDraft, bulkMailText, firstName, resultUrl, readMailed, markMailed, MAILED_KEY, SITE_DEFAULT } from '../lib/miaar/mail-draft';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('P53-ب: الاسم الأول · رابط البطاقة · مسوَّدة واحدة (الموضوع · النصّ · mailto) بلا درجات وبلا بريد في النصّ', () => {
  assert.equal(firstName('د. ريم بنت سعد الدوسري'), 'ريم'); assert.equal(firstName('  '), ''); assert.equal(firstName(null), ''); assert.equal(firstName('Ahmed Abdelaziz'), 'Ahmed');
  assert.equal(resultUrl('ATH-7Q2K', 'https://x.sa/'), 'https://x.sa/miaar/result/ATH-7Q2K'); assert.equal(resultUrl('c1'), `${SITE_DEFAULT}/miaar/result/c1`);
  assert.equal(resultMailDraft({ name: 'ريم', email: 'reem@x.sa', code: null }), null, 'بلا رمز → لا مسوَّدة');
  assert.equal(resultMailDraft({ name: 'ريم', email: '', code: 'K1' }), null, 'بلا بريد → لا مسوَّدة');
  const d = resultMailDraft({ name: 'ريم الدوسري', email: 'reem@x.sa', code: 'ATH-7Q2K', demonstrated: 'A2', program_name: 'العربية للمبتدئين', classroom: 'A-101' }, { site: 'https://athar-portal.vercel.app', org: 'جامعة أَثَر', sender: 'د. أحمد' })!;
  assert.equal(d.to, 'reem@x.sa'); assert.match(d.subject, /مِعيار/); assert.match(d.body, /^السلام عليكم ريم،/); assert.match(d.body, /مستواك المثبت: A2\./); assert.match(d.body, /تسكينك في: العربية للمبتدئين — شعبة A-101/);
  assert.ok(d.body.includes('https://athar-portal.vercel.app/miaar/result/ATH-7Q2K')); assert.match(d.body, /لك وحدك/); assert.match(d.body, /فريق جامعة أَثَر — د\. أحمد/);
  assert.ok(!/\d+%/.test(d.body), 'لا نسب مئوية في البريد'); assert.ok(!d.body.includes('reem@x.sa'), 'لا يُكرَّر البريد في النصّ'); assert.ok(!/\n\n\n/.test(d.body), 'لا أسطر فارغة مزدوجة');
  assert.ok(d.mailto.startsWith('mailto:reem%40x.sa?subject=')); assert.ok(d.mailto.includes('&body=')); assert.equal(decodeURIComponent(d.mailto.split('&body=')[1]), d.body); assert.ok(d.mailto.length < 2000, 'ضمن حدود mailto في المتصفّحات');
  const d2 = resultMailDraft({ name: null, email: 'a@x.sa', code: 'K2' })!; assert.match(d2.body, /^السلام عليكم،/); assert.match(d2.body, /فريق أَثَر\.$/); assert.ok(!d2.body.includes('مستواك المثبت'));
});

test('P53-ب: النصّ المجمَّع — رسالة لكل طالب وحده · فاصل · تخطّي من لا رمز له · لا تكرار', () => {
  const rows = [
    { name: 'ريم', email: 'reem@x.sa', code: 'K1', demonstrated: 'A1' }, { name: 'بدر', email: 'badr@x.sa', code: 'K2', demonstrated: 'B1' },
    { name: 'هند', email: 'hind@x.sa', code: null }, { name: 'ريم', email: 'reem@x.sa', code: 'K1' },
  ];
  const b = bulkMailText(rows, { site: 'https://s.sa' }); assert.equal(b.count, 2); assert.equal(b.skipped, 1);
  assert.equal(b.text.split('─'.repeat(40)).length, 2, 'فاصل واحد بين رسالتين'); assert.match(b.text, /إلى: reem@x\.sa\nالموضوع: /); assert.ok(b.text.includes('https://s.sa/miaar/result/K2'));
  assert.ok(!/reem@x\.sa[\s\S]*badr@x\.sa[\s\S]*reem@x\.sa/.test(b.text), 'لا تكرار للمتقدّم نفسه');
  assert.deepEqual(bulkMailText([]), { text: '', count: 0, skipped: 0 });
});

test('P53-ب: علامة «أُرسلت» محلية (localStorage) — قراءة/وضع/إزالة · تتحمّل تخزينًا معطَّلًا أو قيمة فاسدة', () => {
  const mem = new Map<string, string>(); const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  assert.deepEqual(readMailed(st), {}); assert.deepEqual(readMailed(null), {}); mem.set(MAILED_KEY, '{bad'); assert.deepEqual(readMailed(st), {}); mem.set(MAILED_KEY, '[]'); assert.deepEqual(readMailed(st), {}, 'مصفوفة ليست سجلًّا'); mem.delete(MAILED_KEY);
  const t = new Date('2026-11-07T06:00:00Z'); const m1 = markMailed(st, 'K1', t); assert.equal(m1.K1, t.toISOString()); assert.equal(JSON.parse(mem.get(MAILED_KEY)!).K1, t.toISOString());
  markMailed(st, 'K2', t); const m3 = markMailed(st, 'K1', t, false); assert.deepEqual(Object.keys(m3), ['K2']); assert.deepEqual(Object.keys(readMailed(st)), ['K2']);
  const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } }; assert.doesNotThrow(() => markMailed(broken, 'K9'));
});

test('P53-ب: التكامل — السجلّ يحمل الزرّين وعلامة «أُرسلت» · بلا خادم · بلا اعتماديات', () => {
  const lg = read('app/admin/miaar/Ledger.tsx');
  assert.match(lg, /from '\.\.\/\.\.\/\.\.\/lib\/miaar\/mail-draft'/); assert.match(lg, /data-testid="lg-mail"/); assert.match(lg, /data-testid="lg-mail-copy"/); assert.match(lg, /data-mailed=\{m \? '1' : '0'\}/);
  assert.match(lg, /navigator\.clipboard\.writeText/); assert.match(lg, /readMailed\(window\.localStorage\)/); assert.match(lg, /لا BCC/);
  const lib = read('lib/miaar/mail-draft.ts'); assert.ok(!/from ['"]/.test(lib.replace(/\/\*[\s\S]*?\*\//g, '')), 'المكتبة صرفة بلا استيراد'); assert.match(lib, /Manual placement result notice/);
  const idx = read('tests/index.ts'); assert.match(idx, /p53b-mail-draft\.test/);
});
