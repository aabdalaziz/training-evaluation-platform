// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «دليل أَثَر» (P41) — التطبيع العربي، النوايا، الترتيب، الصلاحيات، التجميع */
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAr, tokens, parseIntent, rank, suggestions, groupHits, ROUTES, COMMANDS, allowed } from '../lib/portal/search';

test('P41 normalizeAr: همزات/تاء مربوطة/تشكيل/أرقام هندية', () => {
  assert.equal(normalizeAr('الإِدَارَةُ'), 'اداره', 'strip al + tashkeel + ta marbuta');
  assert.equal(normalizeAr('مِعْيَار'), 'معيار', 'tashkeel');
  assert.equal(normalizeAr('آفاق ٢٠٦٢'), 'افاق 2062', 'alef madda + arabic digits');
  assert.equal(normalizeAr('  Programs  '), 'programs', 'latin lowercase trim');
  assert.deepEqual(tokens('المِعيار والشهادة'), ['معيار', 'والشهاده'], 'tokens drop al-');
});

test('P41 parseIntent: رموز معروفة', () => {
  assert.equal(parseIntent('ml-7k2q-9mx4').href, '/miaar/result/ML-7K2Q-9MX4', 'result code');
  assert.equal(parseIntent('AR-RD-B1-012').need, 'staff', 'bank item is staff only');
  assert.equal(parseIntent('someone@upm.edu.sa').kind, 'email', 'email');
  assert.equal(parseIntent('كيف أحصل على شهادة؟').kind, 'ask', 'arabic question mark');
  assert.equal(parseIntent('كيف أحصل على شهادة؟').value, 'كيف أحصل على شهادة', 'question stripped');
  assert.equal(parseIntent('AB12CD34').href, '/verify/AB12CD34', 'verify code');
  assert.equal(parseIntent('معيار').kind, 'none', 'plain word');
});

test('P41 rank: مِعيار بأي رسم، والمرادفات القديمة تصل إلى الاسم الرسمي', () => {
  const guest = { user: false, staff: false, lang: 'ar' as const };
  assert.equal(rank('معيار', ROUTES, guest)[0].href, '/miaar', 'miaar first');
  assert.equal(rank('المِعيار', ROUTES, guest)[0].href, '/miaar', 'with al + tashkeel');
  assert.equal(rank('miaar', ROUTES, guest)[0].href, '/miaar', 'latin');
  assert.ok(rank('مصنع البرامج', ROUTES, { ...guest, staff: true }).some(h => h.href === '/admin/program-engineering'), 'old narrative name → official page');
  assert.ok(rank('الميسر', ROUTES, guest).some(h => h.href === '/sim'), 'synonym');
  assert.equal(rank('xyzqq', ROUTES, guest).length, 0, 'no junk');
});

test('P41 allowed: الإدارة لا تظهر للزائر ولا للمستخدم العادي', () => {
  const guest = { user: false, staff: false, lang: 'ar' as const }, userC = { user: true, staff: false, lang: 'ar' as const }, staffC = { user: true, staff: true, lang: 'ar' as const };
  assert.equal(rank('لوحة', ROUTES, guest).some(h => h.group === 'admin'), false, 'guest sees no admin');
  assert.equal(rank('لوحة', ROUTES, userC).some(h => h.group === 'admin'), false, 'user sees no admin');
  assert.ok(rank('لوحة', ROUTES, staffC).some(h => h.href === '/dashboard'), 'staff sees dashboard');
  assert.equal(rank('ملفي', ROUTES, guest).some(h => h.group === 'me'), false, 'guest sees no /me');
  assert.ok(rank('ملفي', ROUTES, userC).some(h => h.href === '/me/skills'), 'user sees /me/skills');
  assert.ok(allowed({ need: undefined }, guest), 'public allowed');
});

test('P41 recent + suggestions + groups', () => {
  const ctx = { user: false, staff: false, lang: 'ar' as const, recent: ['help'] };
  assert.equal(suggestions(ctx)[0].id, 'help', 'recent first');
  assert.ok(suggestions({ user: false, staff: true }).some(e => e.id === 'dashboard'), 'staff defaults');
  const hits = rank('اختبار', [...COMMANDS, ...ROUTES], ctx);
  const g = groupHits(hits); assert.ok(g.length >= 1 && g[0].group === 'command', 'commands group first');
  assert.ok(ROUTES.every(r => r.href.startsWith('/') && r.ar && r.en), 'every route well-formed');
  assert.equal(new Set(ROUTES.map(r => r.id)).size, ROUTES.length, 'unique ids');
});

test('P41 rank: الكلمة الكاملة في العنوان الرسمي تسبق المرادف', () => {
  const guest = { user: false, staff: false, lang: 'ar' as const };
  assert.equal(rank('الحقائب', ROUTES, guest)[0].href, '/resources', 'الحقائب → المستودع لا الخدمات');
  assert.equal(rank('الاستشارات', ROUTES, guest)[0].href, '/consulting', 'الاستشارات → صفحة الاستشارات');
});
