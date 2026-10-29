// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P19 — «أَثَر في الجيب»: صندوق الأدلة (حدود، ترتيب، دمج بلا تكرار)، سياسات الكاش (جدول القرار الذي ينفّذه sw.js)،
//                 سطر الصدق بلا اتصال، قرار التثبيت الذكي، بطاقة القدرة (SVG آمن)، نبض الجيب، ومطابقة sw.js/manifest للعقد
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIMITS, POCKET_VERSION, applySync, canQueue, capabilityCard, cachePolicy, cardSvg, installDecision, isStale, newItem, offlineLine, pulseOf, syncPlan } from '../lib/portal/pocket';

const NOW = new Date('2026-10-29T09:00:00Z'); const iso = (h: number) => new Date(NOW.getTime() - h * 3600000).toISOString();

test('P19 الصندوق: حدود الحجم والعدد تُحترم بأسباب عربية', () => {
  assert.equal(canQueue('daily', { count: 0, textChars: 200 }).ok, true, 'ردّ عادي يُقبل');
  assert.equal(canQueue('daily', { count: LIMITS.outbox_items, textChars: 10 }).ok, false, 'الصندوق الممتلئ يرفض');
  assert.match(canQueue('mission', { count: 0, size: 2 * 1024 * 1024, mime: 'image/jpeg' }).reason_ar || '', /الصورة/, 'صورة 2MB ترفض بلا اتصال');
  assert.equal(canQueue('mission', { count: 0, size: 2.5 * 1024 * 1024, mime: 'audio/webm' }).ok, true, 'تسجيل 2.5MB يُقبل');
  assert.equal(canQueue('mission', { count: 0, size: 5 * 1024 * 1024, mime: 'audio/webm' }).ok, false, 'فوق 4MB يرفض دائمًا');
  assert.equal(canQueue('mission', { count: 0 }).ok, false, 'مهمة بلا ملف ولا نص: لا دليل');
  assert.equal(canQueue('daily', { count: 0, textChars: LIMITS.text_chars + 1 }).ok, false, 'نص أطول من الحد يرفض');
});
test('P19 الصندوق: الترتيب الأقدم أولًا، والميت يُستبعد، والدمج لا يكرّر', () => {
  const a = { ...newItem('daily', { day: '2026-10-28' }, new Date(iso(5))), tries: 0 }; const b = { ...newItem('daily', { day: '2026-10-29' }, new Date(iso(1))), tries: 0 }; const c = { ...newItem('mission', { token: 't' }, new Date(iso(9))), tries: LIMITS.max_tries };
  const plan = syncPlan([b, a, c]); assert.deepEqual(plan.send.map(x => x.id), [a.id, b.id], 'الأقدم أولًا'); assert.deepEqual(plan.dead.map(x => x.id), [c.id], 'المتجاوز للحد ميت');
  const r = applySync([a, b, c], [{ id: a.id, ok: true }, { id: b.id, ok: false, retry: true, error: 'HTTP 500' }, { id: c.id, ok: true, duplicate: true }]);
  assert.deepEqual(r.keep.map(x => [x.id, x.tries, x.last_error]), [[b.id, 1, 'HTTP 500']], 'الفاشل القابل للإعادة يبقى بعدّاد +1');
  assert.deepEqual(r.removed.map(x => x.why).sort(), ['duplicate', 'ok'], 'الناجح والمكرر يُحذفان');
  const r2 = applySync([b], [{ id: b.id, ok: false, retry: false, error: 'يوم غير صالح' }]); assert.equal(r2.keep.length, 0, 'الخطأ النهائي يُحذف'); assert.equal(r2.removed[0].why, 'rejected');
  const r3 = applySync([a, b], [{ id: a.id, ok: true }]); assert.equal(r3.keep.length, 1, 'ما لم يرد عنه جواب يبقى كما هو'); assert.equal(r3.keep[0].tries, 0);
  assert.notEqual(newItem('daily', {}).id, newItem('daily', {}).id, 'معرّفات فريدة');
});
test('P19 سياسات الكاش: جدول القرار الذي ينفّذه sw.js', () => {
  const o = 'https://athar-portal.vercel.app';
  assert.equal(cachePolicy('/_next/static/chunks/a.js', 'GET', 'same-origin', o), 'static');
  assert.equal(cachePolicy('/icons/icon-192.png', 'GET', 'same-origin', o), 'static');
  assert.equal(cachePolicy('/me/card', 'GET', 'navigate', o), 'navigate');
  assert.equal(cachePolicy('/api/pocket?view=bundle', 'GET', 'same-origin', o), 'api_swr');
  assert.equal(cachePolicy('/api/vc?view=mine', 'GET', 'same-origin', o), 'api_swr');
  assert.equal(cachePolicy('/api/daily', 'GET', 'same-origin', o), 'api_swr');
  assert.equal(cachePolicy('/api/m?token=abc', 'GET', 'same-origin', o), 'api_swr', 'موجز المهمة بالرمز يُخزَّن');
  assert.equal(cachePolicy('/.well-known/did.json', 'GET', 'same-origin', o), 'api_swr');
  assert.equal(cachePolicy('/api/vc?view=keys', 'GET', 'same-origin', o), 'bypass', 'واجهات الطاقم لا تُخزَّن');
  assert.equal(cachePolicy('/api/pocket?view=pulse', 'GET', 'same-origin', o), 'bypass', 'النبض لا يُخزَّن');
  assert.equal(cachePolicy('/api/daily', 'POST', 'same-origin', o), 'bypass', 'POST لا يُخزَّن أبدًا');
  assert.equal(cachePolicy('/share', 'POST', 'same-origin', o), 'share', 'share_target يُعترض');
  assert.equal(cachePolicy('https://evil.example/api/daily', 'GET', 'same-origin', o), 'bypass', 'أصل آخر يُتجاهل');
});
test('P19 الصدق بلا اتصال: السطر يعلن عمر النسخة وما لم يُفحص', () => {
  assert.match(offlineLine(null, true, 'ar', NOW), /حيّة/); assert.match(offlineLine(null, false, 'ar', NOW), /لا نسخة محلية/);
  const l = offlineLine(iso(3), false, 'ar', NOW); assert.match(l, /3 ساعة/, 'عمر النسخة بالساعات'); assert.match(l, /لم تُفحص/, 'يعلن أن الإلغاء لم يُفحص');
  assert.match(offlineLine(iso(50), false, 'ar', NOW), /2 يوم/); assert.match(offlineLine(iso(0.5), true, 'en', NOW), /30 min/);
  assert.equal(isStale(iso(49), NOW), true); assert.equal(isStale(iso(47), NOW), false); assert.equal(isStale(null, NOW), true);
});
test('P19 التثبيت الذكي: لا اقتراح قبل لحظة قيمة، ولا تكرار بعد الرفض، وتلميح iOS', () => {
  const base = { standalone: false, ios: false, canPrompt: true, dismissedAt: null, valueMoments: 0, now: NOW };
  assert.equal(installDecision(base), 'none', 'أول زيارة: لا اقتراح');
  assert.equal(installDecision({ ...base, valueMoments: 1 }), 'prompt', 'بعد لحظة قيمة: اقتراح');
  assert.equal(installDecision({ ...base, valueMoments: 3, standalone: true }), 'none', 'مثبَّت: لا شيء');
  assert.equal(installDecision({ ...base, valueMoments: 1, dismissedAt: iso(24 * 10) }), 'none', 'رُفض قبل 10 أيام: صمت');
  assert.equal(installDecision({ ...base, valueMoments: 1, dismissedAt: iso(24 * 40) }), 'prompt', 'بعد 30 يومًا يعود');
  assert.equal(installDecision({ ...base, valueMoments: 1, ios: true, canPrompt: false }), 'ios_hint', 'iOS: تلميح يدوي');
  assert.equal(installDecision({ ...base, valueMoments: 1, canPrompt: false }), 'none', 'بلا beforeinstallprompt: لا شيء');
});
test('P19 بطاقة القدرة: المعتمَد أولًا، QR فقط مع لقطة موقَّعة، وSVG يهرّب النص', () => {
  const levels = [{ name_ar: 'أ', level: 5, approved: false }, { name_ar: 'ب', level: 3, approved: true }, { name_ar: 'ج', level: 4, approved: false }, { name_ar: 'د', level: 2, approved: false }];
  const c = capabilityCard({ name: 'أحمد بدوي', email: 'a@b.c', levels, snapshot: { code: 'ATH-S-1-2', issued_at: '2026-10-01T00:00:00Z', expires_at: '2026-12-30T00:00:00Z' }, fingerprint: 'APJ36NI1', site: 'https://x.sa' });
  assert.deepEqual(c.top.map(t => t.name_ar), ['ب', 'أ', 'ج'], 'المعتمَد يتقدّم ثم الأعلى'); assert.equal(c.initials, 'أب'); assert.equal(c.verify_url, 'https://x.sa/verify/vc?code=ATH-S-1-2'); assert.equal(c.valid_until, '2026-12-30');
  const none = capabilityCard({ name: '', email: 'z@y.x', levels: [], snapshot: null, fingerprint: null, site: 'https://x.sa' }); assert.equal(none.verify_url, null); assert.equal(none.name, 'z@y.x'); assert.match(none.issued_line_ar, /لا لقطة/);
  const svg = cardSvg({ ...c, name: '<script>x</script>' }, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.ok(!svg.includes('<script>'), 'الاسم مهرَّب'); assert.ok(svg.includes('&lt;script&gt;'), 'تهريب HTML'); assert.ok(svg.includes('translate(40,120)'), 'QR موضوع'); assert.ok(svg.includes('key APJ36NI1'), 'بصمة المفتاح');
  assert.ok(!cardSvg(none, null).includes('translate(40,120)'), 'بلا لقطة: لا QR');
});
test('P19 نبض الجيب: التثبيتات والمزامنات المتأخرة والتفاعل', () => {
  const ev = [
    { verb: 'installed', object_type: 'pwa', at: iso(1) }, { verb: 'activated', object_type: 'pwa', at: iso(1), context: { version: 'athar-sw-v2' } }, { verb: 'activated', object_type: 'pwa', at: iso(2), context: { version: 'athar-sw-v2' } },
    { verb: 'synced', object_type: 'pocket', at: iso(1), context: { captured_at: iso(2) } }, { verb: 'synced', object_type: 'pocket', at: iso(0), context: { captured_at: iso(60) } }, { verb: 'rejected', object_type: 'pocket', at: iso(3) },
    { verb: 'acted', object_type: 'push', at: iso(1) }, { verb: 'sent', object_type: 'push', at: iso(5), context: { count: 4 } }, { verb: 'assessed', object_type: 'daily_case', at: iso(1) },
  ];
  const p = pulseOf(ev, NOW); assert.equal(p.installs, 1); assert.equal(p.synced, 2); assert.equal(p.late, 1, 'مزامنة التُقطت قبل 60 ساعة = متأخرة'); assert.equal(p.rejected, 1); assert.equal(p.push_acted, 1); assert.equal(p.push_sent, 4); assert.equal(p.act_rate, 25); assert.deepEqual(p.versions, { 'athar-sw-v2': 2 }); assert.equal(p.last_sync, iso(0));
  assert.equal(pulseOf([], NOW).act_rate, null, 'بلا إرسال: لا نسبة');
});
test('P19 العقد: sw.js و manifest يطابقان ما تعِد به الواجهة', () => {
  const sw = readFileSync('public/sw.js', 'utf8'); const mf = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.ok(sw.includes(`'${POCKET_VERSION}'`), 'إصدار عامل الخدمة = POCKET_VERSION');
  for (const u of ['/api/pocket?view=bundle', '/api/vc?view=mine', '/api/daily', '/.well-known/did.json', '/api/m?token=']) assert.ok(sw.includes(`'${u}'`), `sw.js يسمح بـ ${u}`);
  for (const k of ['X-Athar-Cache', 'X-Athar-Cached-At', 'athar-outbox', "'/share'", 'SKIP_WAITING', "'logout'", 'notificationclick', 'push_action', 'receiveShare']) assert.ok(sw.includes(k), `sw.js يحوي ${k}`);
  assert.ok(!/[^\x00-\x7F]/.test('X-Athar-Cache: stale'), 'ترويسات ASCII');
  assert.equal(mf.share_target.action, '/share'); assert.equal(mf.share_target.method, 'POST'); assert.equal(mf.share_target.params.files[0].name, 'files');
  assert.ok(mf.shortcuts.some((s: any) => s.url === '/me/card'), 'اختصار بطاقة القدرة'); assert.ok(mf.shortcuts.some((s: any) => s.url.startsWith('/offline')), 'اختصار الصندوق');
  assert.equal(mf.display, 'standalone'); assert.equal(mf.dir, 'rtl');
});
