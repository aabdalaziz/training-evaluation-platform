// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م8-ج «تعليمات الاختبار وإقرار الممتحن» — نصّ المصنع · التحليل · التحقّق من الإقرار · الإصدارات · عقد الـ API */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RULES_KEY, RULES_TITLE, RULES_MAX, DEFAULT_RULES_AR, DEFAULT_RULES_EN, FACTORY_RULES, getRules, setRules, resetRulesCache, validateAck, parseRules, countPoints } from '../lib/miaar/rules';

/* قاعدة وهمية صغيرة لـ miaar_settings */
function fakeDb(initial?: any) {
  const store = new Map<string, any>(); if (initial) store.set(RULES_KEY, initial);
  const db: any = {
    from: (t: string) => { assert.equal(t, 'miaar_settings'); return {
      select: () => ({ eq: (_k: string, key: string) => ({ maybeSingle: async () => ({ data: store.get(key) || null }) }) }),
      upsert: async (row: any) => { store.set(row.key, row); return { error: null }; },
    }; },
  };
  return { db, store };
}

test('م8-ج: نصّ المصنع — الإصدار 1 · عربي/إنجليزي · أقسام (قبل/أثناء/النتيجة/الخصوصية/الإقرار) · فقرة إقرار · ضمن الحدّ', () => {
  assert.equal(RULES_KEY, 'exam_instructions'); assert.equal(FACTORY_RULES.version, 1);
  assert.equal(RULES_TITLE.ar, 'تعليمات الاختبار وإقرار الممتحن');
  for (const txt of [DEFAULT_RULES_AR, DEFAULT_RULES_EN]) { assert.ok(txt.length > 400 && txt.length <= RULES_MAX); assert.ok(parseRules(txt).filter((b) => b.kind === 'h').length >= 5); assert.ok(countPoints(txt) >= 12); }
  assert.match(DEFAULT_RULES_AR, /## الإقرار/); assert.match(DEFAULT_RULES_AR, /أتعهّد/); assert.match(DEFAULT_RULES_EN, /## Declaration/);
  assert.match(DEFAULT_RULES_AR, /ذكاء اصطناعي/); assert.match(DEFAULT_RULES_AR, /حماية البيانات الشخصية/); /* PDPL */
  assert.equal(parseRules(DEFAULT_RULES_AR).filter((b) => b.kind === 'h').length, parseRules(DEFAULT_RULES_EN).filter((b) => b.kind === 'h').length, 'نفس عدد الأقسام بالعربية والإنجليزية');
});

test('م8-ج: parseRules — عنوان «## » · نقاط «- »/«• » تتجمّع في قائمة واحدة · السطر الفارغ يقطع القائمة · فقرة · countPoints', () => {
  const b = parseRules('## أ\n- 1\n- 2\n• 3\n\n- 4\nفقرة\n\n\n## ب\nنص');
  assert.deepEqual(b.map((x) => x.kind), ['h', 'ul', 'ul', 'p', 'h', 'p']);
  assert.deepEqual(b[1].items, ['1', '2', '3']); assert.deepEqual(b[2].items, ['4']); assert.equal(b[3].text, 'فقرة'); assert.equal(b[4].text, 'ب');
  assert.equal(countPoints('## أ\n- 1\n- 2\n• 3\n\n- 4\nفقرة'), 4); assert.equal(countPoints(''), 0); assert.deepEqual(parseRules(undefined as any), []);
});

test('م8-ج: validateAck — بلا إقرار/accepted≠true/إصدار غير صحيح → instructions_required · إصدار قديم → instructions_changed · صالح → {version, lang, at}', () => {
  for (const bad of [null, undefined, 'x', {}, { version: 1 }, { version: 1, accepted: 'true' }, { version: 0, accepted: true }, { version: 1.5, accepted: true }, { version: 'a', accepted: true }]) {
    const r = validateAck(bad, 1); assert.equal(r.ok, false); assert.equal((r as any).error, 'instructions_required');
  }
  const old = validateAck({ version: 1, accepted: true }, 2); assert.equal(old.ok, false); assert.equal((old as any).error, 'instructions_changed');
  const fut = validateAck({ version: 3, accepted: true }, 2); assert.equal((fut as any).error, 'instructions_changed');
  const ok = validateAck({ version: 2, accepted: true, lang: 'en' }, 2); assert.equal(ok.ok, true);
  if (ok.ok) { assert.equal(ok.ack.version, 2); assert.equal(ok.ack.lang, 'en'); assert.ok(!Number.isNaN(Date.parse(ok.ack.at))); }
  const ar = validateAck({ version: 2, accepted: true, lang: 'fr' }, 2); if (ar.ok) assert.equal(ar.ack.lang, 'ar', 'أي لغة غير en → ar');
});

test('م8-ج: getRules — بلا صفّ → المصنع (إصدار 1) · صفّ محفوظ → إصداره ونصّه · ذاكرة 30 ث تُصفَّر بـ resetRulesCache', async () => {
  resetRulesCache(); const { db } = fakeDb(); const r = await getRules(db); assert.equal(r.version, 1); assert.equal(r.ar, DEFAULT_RULES_AR);
  resetRulesCache(); const saved = fakeDb({ key: RULES_KEY, value: { version: 4, ar: 'نصّ 4 — الإقرار ' + 'x'.repeat(40), en: 'v4' }, updated_at: '2026-11-05T10:00:00Z', updated_by: 'admin@x.sa' });
  const r4 = await getRules(saved.db); assert.equal(r4.version, 4); assert.equal(r4.en, 'v4'); assert.equal(r4.updated_by, 'admin@x.sa');
  const again = await getRules(fakeDb().db); assert.equal(again.version, 4, 'من الذاكرة خلال 30 ث'); resetRulesCache();
});

test('م8-ج: setRules — يرفض القصير/بلا إقرار/فوق الحدّ · يرفع الإصدار +1 · الإنجليزي الفارغ → نصّ المصنع · updated_by · ثم getRules يعيده والإقرار القديم يصبح instructions_changed', async () => {
  resetRulesCache(); const { db, store } = fakeDb();
  assert.equal((await setRules(db, { ar: 'قصير', en: '' }, 'a')).ok, false);
  assert.equal((await setRules(db, { ar: 'نصّ طويل بلا فقرة تعهّد '.repeat(5), en: '' }, 'a')).ok, false, 'بلا كلمة إقرار');
  assert.equal((await setRules(db, { ar: 'الإقرار ' + 'x'.repeat(RULES_MAX), en: '' }, 'a')).ok, false, 'فوق الحدّ');
  assert.equal((await setRules(db, { ar: 42, en: '' }, 'a')).ok, false);
  const r = await setRules(db, { ar: '## قواعد\r\n- واحد\r\n## الإقرار\r\nأتعهّد بالأمانة في الاختبار كلّه.', en: '' }, 'admin@athar.sa');
  assert.equal(r.ok, true); if (!r.ok) return;
  assert.equal(r.rules.version, 2); assert.equal(r.rules.en, DEFAULT_RULES_EN); assert.ok(!r.rules.ar.includes('\r')); assert.equal(r.rules.updated_by, 'admin@athar.sa');
  assert.equal(store.get(RULES_KEY).value.version, 2);
  const cur = await getRules(db); assert.equal(cur.version, 2);
  assert.equal((validateAck({ version: 1, accepted: true }, cur.version) as any).error, 'instructions_changed');
  const r3 = await setRules(db, { ar: cur.ar, en: 'English v3' }, 'b'); assert.ok(r3.ok && r3.rules.version === 3 && r3.rules.en === 'English v3'); resetRulesCache();
});

test('م8-ج: عقد الـ API والواجهات — ?rules=1 عام · البدء يرفض بلا إقرار (428) · الإقرار يُحفظ على الجلسة · المحرِّر للطاقم · غرفة الشاهد تعرضه · الهجرة · الاختبارات الطرفية مرقَّعة', () => {
  const root = path.join(__dirname, '..'); const rd = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
  const api = rd('app/api/miaar/route.ts');
  assert.match(api, /rules=1|get\('rules'\)/); assert.match(api, /validateAck\(/); assert.match(api, /428/); assert.match(api, /instructionsAck/);
  const engine = rd('lib/miaar/engine.ts'); assert.match(engine, /instructionsAck/); assert.match(engine, /instructions_ack/);
  const app = rd('app/miaar/MiaarApp.tsx');
  assert.match(app, /'rules'/); assert.match(app, /instructions_ack/); assert.match(app, /instructions_changed/); assert.match(app, /mi-rules-agree/); assert.match(app, /mi-rules-go/); assert.match(app, /mi-rules-box/); assert.match(app, /speechSynthesis/);
  assert.ok(app.indexOf("setStep('rules')") < app.indexOf('async function afterRules'), 'التسجيل → التعليمات → ثم ملء الشاشة/المسبار');
  assert.match(app, /enterFullscreen\(\);\s+\/\* يجب أن يسبق أي await/); /* الإيماءة محفوظة على زرّ الإقرار */
  const adminRoute = rd('app/api/admin/miaar/rules/route.ts'); assert.match(adminRoute, /ADMINS\.includes/); assert.match(adminRoute, /miaar_rules_update/); assert.match(adminRoute, /setRules\(/);
  const editor = rd('app/admin/miaar/RulesEditor.tsx'); assert.match(editor, /mm-rules-save/); assert.match(editor, /mm-rules-preview/); assert.ok(!/<style>\{CSS\}<\/style>/.test(editor) || !/CSS = `[^`]*["'>]/.test(editor.split('const CSS')[1] || ''), 'لا اقتباسات ولا > داخل CSS المضمَّن');
  assert.match(rd('app/admin/miaar/AdminMiaar.tsx'), /<RulesEditor /);
  assert.match(rd('app/admin/miaar/WitnessRoom.tsx'), /wr-ack/); assert.match(rd('lib/miaar/witness.ts'), /instructions_ack/);
  const mig = rd('supabase/migrations/20270201_portal_miaar_m8c_rules.sql'); assert.match(mig, /add column if not exists instructions_ack jsonb/); assert.match(mig, /notify pgrst, 'reload schema'/); assert.match(mig, /as ack_col/);
  /* CSS المضمَّن في MiaarApp (كتلة م8-ج) بلا اقتباسات ولا > */
  const css = app.slice(app.indexOf('.mi-rules .mi-rules-card'), app.indexOf('.mi-note{color:var(--muted)')); assert.ok(css.length > 200 && !/["'>]/.test(css));
});
