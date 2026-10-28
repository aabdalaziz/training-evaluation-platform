// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P16 — «الإبلاغ متعدد القنوات»: حسم القنوات والبديل، ساعات الهدوء، تطبيع الهاتف، نص من HTML، رابط wa.me،
//                 توقيعات Webhooks (Meta/Svix)، تحليل الحالات، الكتالوج، نبض الوصول، ما تتعلمه الحلقة، المحرك notify مع db وهمية.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { planChannels, inQuietHours, quietEnds, normalizePhone, textFromHtml, extractUrl, waLink, channelEnv, notify, reachOf, channelEffect, CHANNEL_AR, STATUS_AR } from '../lib/portal/notify';
import type { ChannelEnv, Prefs } from '../lib/portal/notify';
import { templatePayload, verifyMetaSignature, verifyResendSignature, parseWhatsAppStatuses, parseResendEvent, applyStatuses, waConfig } from '../lib/portal/whatsapp';
import { WA_TEMPLATES, templateFor, waParams, kindLabel } from '../lib/portal/messages';
import { runOutreach, channelStats } from '../lib/portal/outreach-cron';

const ENV_ALL: ChannelEnv = { whatsapp: true, email: true, emailTest: false, push: true, from: 'أَثَر <noreply@athar.sa>', adminPhone: '966500000000', site: 'https://athar-portal.vercel.app' };
const ENV_TEST: ChannelEnv = { ...ENV_ALL, whatsapp: false, push: false, emailTest: true, from: 'Training Evaluation Platform <onboarding@resend.dev>' };
const P: Prefs = { email: 'a@x.sa', phone_e164: '966512345678', whatsapp_opt_in: true, preferred_channel: 'whatsapp', push_ok: true };

// ---------------------------------------------------------------- db وهمية صغيرة (select/eq/in/gte/lte/lt/order/limit/maybeSingle/single/insert/update/delete/upsert)
function fakeDb(seed: Record<string, any[]> = {}) {
  const T: Record<string, any[]> = { profiles: [], portal_contact_prefs: [], portal_push_subscriptions: [], portal_message_log: [], portal_missions: [], ...seed }; let nextId = 1;
  function q(table: string) {
    const rows = () => (T[table] = T[table] || []); const f: ((r: any) => boolean)[] = []; let op: 'select' | 'insert' | 'update' | 'delete' = 'select'; let payload: any = null; let lim = 0; let single: 'maybe' | 'one' | null = null;
    const run = () => {
      let out: any[];
      if (op === 'insert') { const list = (Array.isArray(payload) ? payload : [payload]).map((r: any) => ({ id: nextId++, ...r })); rows().push(...list); out = list; }
      else if (op === 'update') { out = rows().filter(r => f.every(x => x(r))); out.forEach(r => Object.assign(r, payload)); }
      else if (op === 'delete') { const del = rows().filter(r => f.every(x => x(r))); T[table] = rows().filter(r => !del.includes(r)); out = del; }
      else out = rows().filter(r => f.every(x => x(r)));
      if (lim) out = out.slice(0, lim);
      const data = single ? (out[0] ?? null) : out; return { data, error: single === 'one' && !out[0] ? { message: 'no rows' } : null, count: out.length };
    };
    const b: any = {
      select() { return b; }, eq(k: string, v: any) { f.push(r => r[k] === v); return b; }, in(k: string, v: any[]) { f.push(r => v.includes(r[k])); return b; },
      gte(k: string, v: any) { f.push(r => r[k] >= v); return b; }, lte(k: string, v: any) { f.push(r => r[k] <= v); return b; }, lt(k: string, v: any) { f.push(r => r[k] < v); return b; },
      order() { return b; }, limit(n: number) { lim = n; return b; }, maybeSingle() { single = 'maybe'; return b; }, single() { single = 'one'; return b; },
      insert(p: any) { op = 'insert'; payload = p; return b; }, update(p: any) { op = 'update'; payload = p; return b; }, delete() { op = 'delete'; return b; },
      upsert(p: any) { op = 'insert'; payload = p; return b; },
      then(res: any, rej: any) { return Promise.resolve(run()).then(res, rej); },
    };
    return b;
  }
  return { from: q, T };
}
const fetchOk = (bodyFor: (url: string) => any, failIf?: (url: string) => string | null) => (async (url: any) => { const u = String(url); const err = failIf?.(u); if (err) return new Response(JSON.stringify({ message: err, error: { message: err } }), { status: 403 }); return new Response(JSON.stringify(bodyFor(u)), { status: 200 }); }) as unknown as typeof fetch;
const RAW_ALL = { RESEND_API_KEY: 'k', WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1', REPORTS_FROM_EMAIL: 'أَثَر <noreply@athar.sa>', NEXT_PUBLIC_SITE_URL: 'https://athar-portal.vercel.app' } as unknown as NodeJS.ProcessEnv;

// ---------------------------------------------------------------- الأدوات
test('p16: normalizePhone يطبّع الأرقام السعودية والدولية ويرفض القصير', () => {
  assert.equal(normalizePhone('0512345678'), '966512345678', 'صيغة 05');
  assert.equal(normalizePhone('+966 51 234 5678'), '966512345678', 'صيغة دولية');
  assert.equal(normalizePhone('00966512345678'), '966512345678', 'صيغة 00');
  assert.equal(normalizePhone('512345678'), '966512345678', '9 أرقام تبدأ بـ5');
  assert.equal(normalizePhone('12345'), null, 'قصير'); assert.equal(normalizePhone(''), null, 'فارغ');
});
test('p16: textFromHtml يحوّل HTML إلى نص مقروء مع إبقاء الروابط، وextractUrl يفضّل رابط الموقع', () => {
  const html = '<div dir="rtl"><p>مرحبًا <b>أحمد</b>،</p><p>أُسندت إليك مهمة.</p><a href="https://athar-portal.vercel.app/m/abc">افتح المهمة</a> &amp; <a href="https://x.com/y">آخر</a></div>';
  const t = textFromHtml(html); assert.ok(t.includes('مرحبًا أحمد،'), 'نص'); assert.ok(t.includes('افتح المهمة https://athar-portal.vercel.app/m/abc'), 'رابط داخل النص'); assert.ok(t.includes('&') && !t.includes('&amp;'), 'فك الكيانات');
  assert.equal(extractUrl(html, 'https://athar-portal.vercel.app'), 'https://athar-portal.vercel.app/m/abc', 'رابط الموقع أولًا');
  assert.equal(extractUrl('<a href="https://x.com/y">a</a>', 'https://athar-portal.vercel.app'), 'https://x.com/y', 'وإلا الأول');
  assert.equal(extractUrl('no links'), null, 'بلا روابط');
});
test('p16: waLink يبني رابط wa.me بنص مشفَّر', () => { const u = waLink('0512345678', 'مرحبًا https://a.b/c'); assert.ok(u.startsWith('https://wa.me/966512345678?text='), u); assert.ok(u.includes(encodeURIComponent('مرحبًا')), 'مشفَّر'); });
test('p16: inQuietHours يحترم النافذة بتوقيت الرياض ويدعم العبور عبر منتصف الليل', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 28, (h - 3 + 24) % 24, 30)); // الرياض = UTC+3
  const p = { quiet_from: '22:00', quiet_to: '07:00' };
  assert.equal(inQuietHours(p, at(23)), true, '23:30 داخل'); assert.equal(inQuietHours(p, at(3)), true, '03:30 داخل'); assert.equal(inQuietHours(p, at(9)), false, '09:30 خارج');
  assert.equal(inQuietHours({ quiet_from: '13:00', quiet_to: '15:00' }, at(14)), true, 'نافذة نهارية'); assert.equal(inQuietHours(null, at(23)), false, 'بلا تفضيل');
  assert.equal(inQuietHours({ quiet_from: 'x', quiet_to: '07:00' }, at(23)), false, 'قيمة غير صالحة = لا هدوء');
  const ends = new Date(quietEnds(p, at(23))); assert.ok(ends.getTime() > at(23).getTime() && ends.getTime() - at(23).getTime() <= 8 * 3600000, 'ينتهي خلال ≤ 8 ساعات');
});
test('p16: planChannels — المفضّلة أولًا، فقط المضبوطة والمتاحة، وتنتهي باليد دائمًا', () => {
  assert.deepEqual(planChannels(P, ENV_ALL, { hasPush: true }), ['whatsapp', 'email', 'push', 'manual'], 'كل القنوات');
  assert.deepEqual(planChannels({ ...P, preferred_channel: 'email' }, ENV_ALL, { hasPush: false }), ['email', 'whatsapp', 'manual'], 'بريد أولًا بلا push');
  assert.deepEqual(planChannels({ ...P, whatsapp_opt_in: false }, ENV_ALL, { hasPush: false }), ['email', 'manual'], 'بلا موافقة = لا واتساب');
  assert.deepEqual(planChannels(P, { ...ENV_ALL, whatsapp: false }, { hasPush: false }), ['email', 'manual'], 'واتساب غير مضبوط');
  assert.deepEqual(planChannels({ email: 'a@x.sa' }, { ...ENV_ALL, email: false, whatsapp: false, push: false }, {}), ['manual'], 'لا شيء مضبوط = اليد فقط');
  assert.deepEqual(planChannels(null, ENV_ALL, { phone: '0512345678' }), ['manual'], 'هاتف بلا موافقة ولا بريد = اليد');
});
test('p16: channelEnv يكشف وضع الاختبار resend.dev ويطبّع هاتف الإداري', () => {
  const e = channelEnv({ RESEND_API_KEY: 'k', OUTREACH_ADMIN_PHONE: '0500000000' } as any); assert.equal(e.email, true); assert.equal(e.emailTest, true, 'resend.dev = اختبار'); assert.equal(e.whatsapp, false); assert.equal(e.adminPhone, '966500000000');
  assert.equal(channelEnv(RAW_ALL).emailTest, false, 'نطاق متحقَّق'); assert.equal(channelEnv(RAW_ALL).whatsapp, true);
});

// ---------------------------------------------------------------- واتساب و Webhooks
test('p16: templatePayload يبني رسالة قالب بمتغيرات نصية نظيفة', () => {
  const p: any = templatePayload('966512345678', 'athar_mission_assigned', ['أحمد', 'عنوان\nبسطر', '', 'https://a.b']);
  assert.equal(p.messaging_product, 'whatsapp'); assert.equal(p.type, 'template'); assert.equal(p.template.name, 'athar_mission_assigned'); assert.equal(p.template.language.code, 'ar');
  const vals = p.template.components[0].parameters.map((x: any) => x.text); assert.deepEqual(vals, ['أحمد', 'عنوان بسطر', '—', 'https://a.b'], 'لا أسطر جديدة ولا فراغ');
  assert.equal(waConfig({} as any), null, 'بلا مفاتيح = null'); assert.equal(waConfig(RAW_ALL)!.version, 'v26.0');
});
test('p16: verifyMetaSignature و verifyResendSignature (Svix) يقبلان التوقيع الصحيح ويرفضان غيره', () => {
  const body = '{"a":1}'; const sig = 'sha256=' + createHmac('sha256', 'secret').update(body).digest('hex');
  assert.equal(verifyMetaSignature(body, sig, 'secret'), true, 'Meta صحيح'); assert.equal(verifyMetaSignature(body, sig, 'other'), false, 'سر آخر'); assert.equal(verifyMetaSignature(body, null, 'secret'), false, 'بلا رأس'); assert.equal(verifyMetaSignature(body, sig, ''), false, 'بلا سر');
  const secret = 'whsec_' + Buffer.from('svix-key-bytes').toString('base64'); const id = 'msg_1', ts = String(Math.floor(Date.now() / 1000));
  const s1 = createHmac('sha256', Buffer.from('svix-key-bytes')).update(`${id}.${ts}.${body}`).digest('base64');
  assert.equal(verifyResendSignature(body, { id, timestamp: ts, signature: `v1,${s1}` }, secret), true, 'Svix صحيح');
  assert.equal(verifyResendSignature(body, { id, timestamp: ts, signature: `v1,bad v1,${s1}` }, secret), true, 'توقيعات متعددة');
  assert.equal(verifyResendSignature(body, { id, timestamp: String(Number(ts) - 10000), signature: `v1,${s1}` }, secret), false, 'طابع زمني قديم');
  assert.equal(verifyResendSignature(body, { id, timestamp: ts, signature: 'v1,xxx' }, secret), false, 'توقيع خاطئ');
});
test('p16: parseWhatsAppStatuses و parseResendEvent يحوّلان حمولة المزوّد إلى حالات موحَّدة', () => {
  const wa = parseWhatsAppStatuses({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'delivered', timestamp: '1793176000' }, { id: 'wamid.2', status: 'failed', errors: [{ title: 'Undeliverable', message: 'رقم غير مسجَّل' }] }, { id: 'x', status: 'weird' }] } }] }] });
  assert.equal(wa.length, 2); assert.equal(wa[0].status, 'delivered'); assert.ok(wa[0].at.startsWith('2026-10-28'), 'الطابع الزمني'); assert.equal(wa[1].status, 'failed'); assert.ok(wa[1].error!.includes('رقم غير مسجَّل'));
  assert.deepEqual(parseResendEvent({ type: 'email.delivered', created_at: '2026-10-28T10:00:00Z', data: { email_id: 'r1' } }), { provider_id: 'r1', status: 'delivered', at: '2026-10-28T10:00:00Z' });
  assert.equal(parseResendEvent({ type: 'email.bounced', data: { email_id: 'r2', bounce: { message: 'mailbox full' } } })!.status, 'failed'); assert.equal(parseResendEvent({ type: 'contact.created', data: {} }), null, 'حدث غير معني');
});
test('p16: applyStatuses لا تتراجع الحالة (read > delivered > sent) وتسجّل الفشل', async () => {
  const db = fakeDb({ portal_message_log: [{ id: 1, provider_id: 'p1', status: 'sent', errors: [] }, { id: 2, provider_id: 'p2', status: 'read', errors: [] }, { id: 3, provider_id: 'p3', status: 'sent', errors: [] }] });
  const n = await applyStatuses(db, [{ provider_id: 'p1', status: 'delivered', at: 't1' }, { provider_id: 'p2', status: 'delivered', at: 't2' }, { provider_id: 'p3', status: 'failed', error: 'bounce', at: 't3' }, { provider_id: 'nope', status: 'read', at: 't4' }]);
  assert.equal(n, 2, 'تحديثان فقط'); assert.equal(db.T.portal_message_log[0].status, 'delivered'); assert.equal(db.T.portal_message_log[0].delivered_at, 't1'); assert.equal(db.T.portal_message_log[1].status, 'read', 'لم تتراجع'); assert.equal(db.T.portal_message_log[2].status, 'failed'); assert.equal(db.T.portal_message_log[2].errors[0].error, 'bounce');
});

// ---------------------------------------------------------------- الكتالوج
test('p16: الكتالوج — 7 قوالب بأسماء ثابتة، وكل نوع رسالة يجد قالبه ومتغيراته بعدد صحيح', () => {
  assert.equal(WA_TEMPLATES.length, 7); assert.equal(new Set(WA_TEMPLATES.map(t => t.name)).size, 7, 'أسماء فريدة');
  for (const t of WA_TEMPLATES) { const n = (t.body_ar.match(/\{\{\d+\}\}/g) || []).length; assert.equal(n, t.vars.length, `${t.name}: عدد المتغيرات = عدد {{n}}`); assert.ok(t.body_ar.includes('أَثَر'), `${t.name} يذكر أَثَر`); }
  assert.equal(templateFor('mission_assigned').name, 'athar_mission_assigned'); assert.equal(templateFor('mission').name, 'athar_mission_assigned'); assert.equal(templateFor('live_reminder').name, 'athar_live_reminder'); assert.equal(templateFor('certificate_issued').name, 'athar_certificate'); assert.equal(templateFor('contract').name, 'athar_contract_release'); assert.equal(templateFor('invoice').name, 'athar_notice');
  for (const k of ['mission_assigned', 'mission_reminder', 'mission_confirm', 'live_reminder', 'certificate', 'contract', 'invoice', 'xyz']) { const ps = waParams(k, { name: 'أحمد', subject: 'أَثَر | موضوع', url: 'https://a.b' }); assert.equal(ps.length, templateFor(k).vars.length, `${k}: عدد المعلمات`); assert.ok(ps.every(Boolean), `${k}: لا معلمة فارغة`); }
  assert.deepEqual(waParams('mission_assigned', { name: '', subject: 's', url: 'u', title: 'مهمة', due: '10 أيام' }), ['بك', 'مهمة', '10 أيام', 'u']);
  assert.equal(kindLabel('mission_reminder'), 'تذكير بمهمة'); assert.equal(kindLabel('unknown_kind'), 'unknown_kind');
  assert.equal(Object.keys(CHANNEL_AR).length, 4); assert.equal(Object.keys(STATUS_AR).length, 7);
});

// ---------------------------------------------------------------- المحرك
test('p16: notify — واتساب أولًا ينجح: صف واحد sent بمعرّف المزوّد', async () => {
  const db = fakeDb({ portal_contact_prefs: [P] }); const calls: string[] = [];
  const f = fetchOk(u => { calls.push(u); return u.includes('graph.facebook') ? { messages: [{ id: 'wamid.9' }] } : { id: 'r9' }; });
  const r = await notify(db, { kind: 'mission_assigned', to: { email: 'a@x.sa', name: 'أحمد' }, subject: 'مهمة', html: '<p>م <a href="https://athar-portal.vercel.app/m/t">افتح</a></p>', params: { title: 'إنّ وأخواتها', due: '10 أيام' } }, { env: RAW_ALL, fetchImpl: f, now: new Date(Date.UTC(2026, 9, 28, 9)) });
  assert.equal(r.channel, 'whatsapp'); assert.equal(r.status, 'sent'); assert.equal(r.provider_id, 'wamid.9'); assert.deepEqual(r.plan, ['whatsapp', 'email', 'manual']);
  assert.equal(calls.length, 1, 'لم يُجرَّب البريد'); const row = db.T.portal_message_log[0]; assert.equal(row.status, 'sent'); assert.equal(row.channel, 'whatsapp'); assert.deepEqual(row.payload.wa.params, ['أحمد', 'إنّ وأخواتها', '10 أيام', 'https://athar-portal.vercel.app/m/t']);
});
test('p16: notify — فشل واتساب ← البريد ينجح، والخطأ محفوظ', async () => {
  const db = fakeDb({ portal_contact_prefs: [P] });
  const f = fetchOk(u => u.includes('resend') ? { id: 'r1' } : {}, u => u.includes('graph.facebook') ? 'template not approved' : null);
  const r = await notify(db, { kind: 'notice', to: { email: 'a@x.sa' }, subject: 'إشعار', html: '<p>x</p>' }, { env: RAW_ALL, fetchImpl: f, now: new Date(Date.UTC(2026, 9, 28, 9)) });
  assert.equal(r.channel, 'email'); assert.equal(r.status, 'sent'); assert.equal(r.provider_id, 'r1');
  const row = db.T.portal_message_log[0]; assert.equal(row.errors.length, 1); assert.equal(row.errors[0].channel, 'whatsapp'); assert.ok(row.errors[0].error.includes('template not approved')); assert.equal(row.attempts, 1);
});
test('p16: notify — بريد الاختبار يُرفض ولا قناة أخرى ← قائمة اليد برسالة عربية واضحة (لا ضياع)', async () => {
  const db = fakeDb();
  const f = fetchOk(() => ({}), () => 'You can only send testing emails to your own email address');
  const r = await notify(db, { kind: 'mission_assigned', to: { email: 'b@hotmail.com' }, subject: 'مهمة', html: '<p>م <a href="https://athar-portal.vercel.app/m/t">افتح</a></p>' }, { env: { RESEND_API_KEY: 'k', NEXT_PUBLIC_SITE_URL: 'https://athar-portal.vercel.app' } as any, fetchImpl: f });
  assert.equal(r.channel, 'manual'); assert.equal(r.status, 'manual'); assert.ok(r.error!.includes('وضع الاختبار'), r.error!);
  const row = db.T.portal_message_log[0]; assert.equal(row.status, 'manual'); assert.equal(row.payload.url, 'https://athar-portal.vercel.app/m/t'); assert.ok(row.payload.text.includes('افتح'), 'نص جاهز للنسخ');
});
test('p16: notify — الرسالة نفسها لا تتكرر في قائمة اليد خلال 7 أيام (المرسِلون القدامى يعيدون المحاولة يوميًا)', async () => {
  const db = fakeDb(); const m = { kind: 'certificate_issued', to: { email: 'd@x.sa' }, subject: 'صدرت شهادتك', html: '<p>x</p>' };
  const r1 = await notify(db, m, { env: {} as any }); const r2 = await notify(db, m, { env: {} as any, now: new Date(Date.now() + 86400000) });
  assert.equal(db.T.portal_message_log.length, 1, 'صف واحد'); assert.equal(r2.duplicate, true); assert.equal(r2.id, r1.id);
  await notify(db, { ...m, subject: 'موضوع آخر' }, { env: {} as any }); assert.equal(db.T.portal_message_log.length, 2, 'موضوع مختلف = صف جديد');
});
test('p16: notify — لا قناة مضبوطة إطلاقًا ← يد مباشرة بلا أي نداء شبكة', async () => {
  const db = fakeDb(); let calls = 0; const f = (async () => { calls++; return new Response('{}'); }) as unknown as typeof fetch;
  const r = await notify(db, { kind: 'notice', to: { email: 'c@x.sa' }, subject: 'س', html: '<p>x</p>' }, { env: {} as any, fetchImpl: f });
  assert.equal(r.channel, 'manual'); assert.equal(calls, 0); assert.ok(r.error!.includes('لا قناة آلية'));
});
test('p16: notify — ساعات الهدوء تؤجّل واتساب/الإشعار وتترك البريد؛ وإن فشل البريد تبقى queued بموعد إعادة', async () => {
  const quiet: Prefs = { ...P, quiet_from: '22:00', quiet_to: '07:00' }; const night = new Date(Date.UTC(2026, 9, 28, 20, 30)); // 23:30 الرياض
  const db1 = fakeDb({ portal_contact_prefs: [quiet] }); const seen: string[] = [];
  const r1 = await notify(db1, { kind: 'notice', to: { email: 'a@x.sa' }, subject: 'س', html: '<p>x</p>' }, { env: RAW_ALL, fetchImpl: fetchOk(u => { seen.push(u); return { id: 'r' }; }), now: night });
  assert.equal(r1.channel, 'email', 'البريد لا يتأثر'); assert.ok(seen.every(u => u.includes('resend')), 'لم يُنادَ واتساب ليلًا');
  const db2 = fakeDb({ portal_contact_prefs: [quiet] });
  const r2 = await notify(db2, { kind: 'notice', to: { email: 'a@x.sa' }, subject: 'س', html: '<p>x</p>' }, { env: RAW_ALL, fetchImpl: fetchOk(() => ({}), () => 'down'), now: night });
  assert.equal(r2.status, 'queued', 'مؤجَّلة'); const row = db2.T.portal_message_log[0]; assert.equal(row.status, 'queued'); assert.ok(row.next_at > night.toISOString(), 'موعد إعادة لاحق');
  // الكرون صباحًا: واتساب ينجح
  const morning = new Date(Date.UTC(2026, 9, 29, 5)); // 08:00 الرياض
  const o = await runOutreach(db2, { env: RAW_ALL, now: morning, fetchImpl: fetchOk(u => u.includes('graph') ? { messages: [{ id: 'w' }] } : {}) });
  assert.equal(o.retried, 1); assert.equal(o.sent, 1); assert.equal(db2.T.portal_message_log[0].status, 'sent'); assert.equal(db2.T.portal_message_log[0].channel, 'whatsapp');
});
test('p16: runOutreach — dry لا يغيّر شيئًا، وينظّف الأقدم من 180 يومًا', async () => {
  const old = new Date(Date.now() - 200 * 86400000).toISOString();
  const db = fakeDb({ portal_message_log: [{ id: 1, status: 'done', created_at: old, plan: ['manual'], errors: [] }, { id: 2, status: 'queued', next_at: '2000-01-01', created_at: new Date().toISOString(), plan: ['email', 'manual'], errors: [], to_email: 'a@x.sa', subject: 's', payload: {} }] });
  const d = await runOutreach(db, { dry: true, env: {} as any }); assert.equal(d.dry, true); assert.equal(d.retried, 1); assert.equal(db.T.portal_message_log.length, 2, 'dry لا يحذف');
  const r = await runOutreach(db, { env: {} as any }); assert.equal(r.purged, 1); assert.equal(r.manual, 1, 'بلا قنوات → يد'); assert.equal(db.T.portal_message_log.length, 1);
});
test('p16: channelStats و reachOf و channelEffect — صادقة ولا تخمّن', () => {
  const s = channelStats([{ channel: 'email', status: 'sent', sent_at: 't1', created_at: 't0' }, { channel: 'email', status: 'delivered', sent_at: 't2', created_at: 't0' }, { channel: 'email', status: 'failed', sent_at: null, created_at: 't0' }, { channel: 'manual', status: 'manual', sent_at: null, created_at: 't0' }] as any);
  assert.equal(s.email.total, 3); assert.equal(s.email.sent, 2); assert.equal(s.email.delivered, 1); assert.equal(s.email.failed, 1); assert.equal(s.email.last_ok, 't2'); assert.equal(s.manual.manual, 1);
  assert.equal(reachOf('a@x.sa', P, ENV_ALL, []).level, 'green', 'واتساب بموافقة'); assert.equal(reachOf('a@x.sa', null, ENV_ALL, [{ status: 'read', channel: 'email' }]).level, 'green', 'قُرئت');
  assert.equal(reachOf('a@x.sa', null, ENV_ALL, []).level, 'yellow', 'بريد متحقَّق فقط'); assert.equal(reachOf('a@x.sa', null, ENV_TEST, []).level, 'grey', 'بريد اختبار = لا قناة'); assert.ok(reachOf('a@x.sa', null, ENV_TEST, []).why.includes('قائمة اليد'));
  const logs = Array.from({ length: 12 }, (_, i) => ({ kind: 'mission_assigned', ref_id: `m${i}`, channel: (i < 6 ? 'whatsapp' : 'email') as any, status: 'sent' as any }));
  const missions = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, status: i < 5 || i === 7 ? 'submitted' : 'assigned' }));
  const e = channelEffect(logs, missions); assert.equal(e.enough, true); assert.equal(e.lines.length, 2); assert.ok(e.lines[0].includes('واتساب: 83%'), e.lines[0]); assert.ok(e.lines[1].includes('بريد: 17%'), e.lines[1]);
  assert.equal(channelEffect(logs.slice(0, 4), missions).enough, false, 'أقل من 5 = لا دليل كافٍ');
});
