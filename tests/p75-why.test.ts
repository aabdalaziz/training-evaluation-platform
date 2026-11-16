/**
 * P75 «لماذا جاؤوا» — اختبارات المكتبة النقية lib/first/why.ts
 *  المرشّح · شارة الخطّ · الأقفال الأربعة (الإذن، التسكين، المرشّح، استبعاد الجهة) · العتبتان · شخص = سطر · التبدّل اليومي · الترويسة
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WHY_LIMITS, P75_NAMES_AR, scriptOf, dirOf, SCRIPT_AR, entryPublicFilter, whyOf, dayKey, type EntryLite } from '../lib/first/why';
import { entryEchoLine } from '../lib/first/entry-pure';
import { parseCommand } from '../lib/portal/voice';

const NOW = new Date('2026-12-21T06:00:00Z');
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
const TEXTS = [
  'جئتُ لأقرأ القرآن بفهم، ولأتكلّم مع جيراني في المدينة',
  'I came because my grandmother spoke Arabic and I never understood her',
  'Je suis venu pour travailler dans un hôpital à Djeddah',
  'Я приехал, чтобы читать арабскую поэзию без перевода',
  'मैं यहाँ इसलिए आया क्योंकि मेरे दोस्त अरबी बोलते हैं',
  '我来这里是为了和我的同事用阿拉伯语交流',
  'أريد أن أفهم خطبة الجمعة من دون مترجم',
  'Vim porque quero ensinar árabe aos meus filhos',
  'Geldim çünkü Arapça öğrenmek çocukluk hayalimdi',
  'جئت لأكمل دراستي العليا هنا، واللغة هي الباب',
  'I want to read my contract before I sign it next time',
  'لأن أمي كانت تحلم أن أتكلم لغتها الثانية',
  'Vine para entender a mis pacientes en urgencias',
  'Ich kam, um den Koran in seiner Sprache zu hören',
  'أريد أن أعلّم أطفالي من دون أن أخجل من لهجتي',
  'I came to stop nodding politely when I do not understand',
  'جئت لأني أحب الشعر العربي وأريد أن أكتبه',
  'Przyjechałem, żeby rozmawiać z rodziną mojej żony',
  'لأعمل في المستشفى وأفهم مرضاي من دون وسيط',
  'I came for work, I stayed for the people who wrote these lines',
  'Vengo a estudiar ingeniería y necesito la lengua del aula',
  'أتيت لأن صديقي قال إن اللغة تفتح البيوت لا الأبواب فقط',
];
function rows(n: number, sections: number, opts: Partial<EntryLite> = {}): EntryLite[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, text: i < TEXTS.length ? TEXTS[i] : `${TEXTS[i % TEXTS.length]} — ${i}`, email: `u${i}@x.sa`, classroom_id: `c${i % sections}`, org_id: 'org-1', public_ok: true, at: iso(i % 30), ...opts }));
}

test('P75: الثوابت والأسماء', () => {
  assert.deepEqual([WHY_LIMITS.people, WHY_LIMITS.sections, WHY_LIMITS.items, WHY_LIMITS.days, WHY_LIMITS.cacheSec], [20, 5, 7, 365, 600]);
  assert.equal(P75_NAMES_AR.why, 'لماذا جاؤوا'); assert.equal(P75_NAMES_AR.why_en, 'Why they came'); assert.match(P75_NAMES_AR.consent, /لا الصوت/); assert.equal(P75_NAMES_AR.copy_tail, '— متعلّم في أَثَر');
});

test('P75: المرشّح — يرفض البريد والرابط وأرقام الهاتف والقِصر والطول والتكرار', () => {
  assert.equal(entryPublicFilter('جئت لأتعلم العربية وأعمل هنا'), 'جئت لأتعلم العربية وأعمل هنا');
  assert.equal(entryPublicFilter('  جئت   لأتعلم\nالعربية  '), 'جئت لأتعلم العربية');
  assert.equal(entryPublicFilter('قصير'), null);
  assert.equal(entryPublicFilter('a'.repeat(161)), null);
  assert.equal(entryPublicFilter('راسلني على ahmed@example.com رجاءً'), null);
  assert.equal(entryPublicFilter('see https://example.com for my story'), null);
  assert.equal(entryPublicFilter('زوروا موقعي www.mysite.sa اليوم'), null);
  assert.equal(entryPublicFilter('اتصلوا بي 0501234567 في أي وقت'), null);
  assert.equal(entryPublicFilter('رقمي 05 0123 4567 للتواصل'), null);
  assert.equal(entryPublicFilter('جئت في سنة 2026 لأتعلم'), 'جئت في سنة 2026 لأتعلم'); /* أربعة أرقام مسموحة */
  assert.equal(entryPublicFilter('هههههههههه جئت لأتعلم'), null);
  assert.equal(entryPublicFilter('!!! ??? ... --- ***'), null);
  assert.equal(entryPublicFilter(null), null); assert.equal(entryPublicFilter(''), null);
});

test('P75: شارة الخطّ لا اللغة — والاتجاه يتبعها', () => {
  assert.equal(scriptOf('جئت لأتعلم العربية'), 'arabic'); assert.equal(dirOf('arabic'), 'rtl');
  assert.equal(scriptOf('I came to learn'), 'latin'); assert.equal(dirOf('latin'), 'ltr');
  assert.equal(scriptOf('Я приехал учиться'), 'cyrillic'); assert.equal(scriptOf('我来学习阿拉伯语'), 'cjk');
  assert.equal(scriptOf('मैं सीखने आया'), 'devanagari'); assert.equal(scriptOf('나는 배우러 왔다'), 'hangul'); assert.equal(scriptOf('ฉันมาเรียน'), 'thai');
  assert.equal(scriptOf('جئت to learn العربية هنا'), 'arabic'); /* الأغلب يغلب */
  for (const k of Object.keys(SCRIPT_AR)) assert.ok(SCRIPT_AR[k as keyof typeof SCRIPT_AR].length > 2);
});

test('P75: العتبتان — دون 5 شُعب لا يظهر، دون 20 شخصًا لا يظهر، وعندهما يظهر 7 سطور', () => {
  const few = whyOf(rows(30, 4), new Set(), NOW); assert.equal(few.shown, false); assert.equal(few.why, 'sections'); assert.equal(few.items.length, 0);
  const fewPeople = whyOf(rows(19, 5), new Set(), NOW); assert.equal(fewPeople.shown, false); assert.equal(fewPeople.why, 'people'); assert.equal(fewPeople.sections, 5);
  const ok = whyOf(rows(20, 5), new Set(), NOW); assert.equal(ok.shown, true); assert.equal(ok.why, 'ok'); assert.equal(ok.items.length, 7); assert.equal(ok.people, 20); assert.equal(ok.sections, 5);
  assert.equal(ok.head_ar, 'جاء إلينا 20 متعلّمًا من 5 شُعب وكتبوا لماذا');
  assert.equal(whyOf([], new Set(), NOW).why, 'empty');
  for (const it of ok.items) { assert.ok(it.text.length >= 12); assert.ok(['rtl', 'ltr'].includes(it.dir)); assert.ok(it.script_ar); assert.ok(!('email' in it) && !('classroom_id' in it) && !('at' in it) && !('id' in it)); }
});

test('P75: القفل 1 — بلا إذن لا يُحسب؛ القفل 2 — بلا شعبة لا يُحسب؛ 365 يومًا', () => {
  const base = rows(22, 5);
  assert.equal(whyOf(base.map((r) => ({ ...r, public_ok: false })), new Set(), NOW).why, 'empty');
  const noRoom = base.map((r, i) => (i < 3 ? { ...r, classroom_id: null } : r)); assert.equal(whyOf(noRoom, new Set(), NOW).people, 19);
  const old = base.map((r, i) => (i < 3 ? { ...r, at: iso(366) } : r)); assert.equal(whyOf(old, new Set(), NOW).people, 19);
  const voiceOnly = base.map((r, i) => (i < 3 ? { ...r, text: null } : r)); assert.equal(whyOf(voiceOnly, new Set(), NOW).people, 19);
});

test('P75: القفل 4 — جهة أوقفت خيوط الرئيسة تُستبعد كلها', () => {
  const mixed = rows(25, 5).map((r, i) => ({ ...r, org_id: i < 10 ? 'org-off' : 'org-1', classroom_id: i < 10 ? `x${i % 5}` : `c${i % 5}` }));
  const v = whyOf(mixed, new Set(['org-off']), NOW); assert.equal(v.people, 15); assert.equal(v.shown, false);
  assert.equal(whyOf(mixed, new Set(), NOW).people, 25);
});

test('P75: شخص واحد = سطر واحد (الأحدث)، وتكرار النصّ يُحذف', () => {
  const r = rows(24, 6);
  const dup = [...r, { ...r[0], id: 900, text: 'سطرٌ جديد كتبه نفس الشخص لاحقًا', at: iso(0) }, { ...r[1], id: 901, text: r[2].text }];
  const v = whyOf(dup, new Set(), NOW); assert.equal(v.people, 24);
  const texts = new Set(v.items.map((i) => i.text)); assert.equal(texts.size, v.items.length);
});

test('P75: التبدّل يومي — نفس اليوم نفس الترتيب، يومٌ آخر ترتيبٌ آخر (غالبًا)', () => {
  const r = rows(22, 5);
  const a = whyOf(r, new Set(), NOW).items.map((i) => i.text); const b = whyOf(r, new Set(), new Date(NOW.getTime() + 3600000)).items.map((i) => i.text);
  assert.deepEqual(a, b);
  const days = [1, 2, 3, 4, 5].map((d) => whyOf(r, new Set(), new Date(NOW.getTime() + d * 86400000)).items.map((i) => i.text).join('|'));
  assert.ok(new Set([a.join('|'), ...days]).size >= 3);
  assert.equal(dayKey(new Date('2026-12-21T21:30:00Z')), '2026-12-22'); /* منتصف ليل الرياض */
});

test('P75: صدى الأستاذ يحمل المعرّف وعلم الإذن (بلا بريد)', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, text: TEXTS[i], public_ok: i % 2 === 0 }));
  const e = entryEchoLine(items, 10, 's1'); assert.equal(e.shown, true); assert.equal(e.items.length, 3); assert.equal(e.lines.length, 3);
  for (const it of e.items) { assert.ok(it.id > 0); assert.equal(typeof it.public_ok, 'boolean'); assert.equal(Object.keys(it).sort().join(), 'id,public_ok,text'); }
  const legacy = entryEchoLine(TEXTS.slice(0, 5), 10, 's1'); assert.equal(legacy.shown, true); assert.ok(legacy.items.every((it) => it.id === 0 && it.public_ok === false));
});

test('P75: «نادِ» — «لماذا جاؤوا» تفتح /#why', () => {
  const ctx = { href: '/', role: 'learner', ar: true } as any;
  for (const s of ['أثر لماذا جاؤوا', 'يا اثر ليش جاوا', 'أثر سطور الدخول']) { const c: any = parseCommand(s, ctx); assert.equal(c?.href, '/#why', s); }
});
