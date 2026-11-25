// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** بطاقة الترحيب قبل الموعد — openInvite يعيد preview عند not_open، ونصوص ar/en/fr، وصياغة الموعد بتوقيت الزائر */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openInvite, invitePreview } from '../lib/miaar/invites';
import { welcomeText, sessionLine, opensIn, fillW } from '../lib/miaar/welcome';

const row = { id: 'i1', code: 'SEVUANBP', kind: 'group', label_ar: 'الانغماس اللغوي — مجموعة فرنسا — جلسة الأحد', lang: 'fr', exam_mode: 'adaptive', status: 'open', purpose: 'placement', opens_at: '2026-11-29T11:00:00.000Z', expires_at: '2026-11-29T15:00:00.000Z', max_seats: 15, note: null, created_by: null, created_at: '2026-11-25T00:00:00Z', org_id: null, program_id: null } as any;
function fakeDb(r: any, recipient: any = null) {
  return { from(t: string) { const q: any = { _t: t, select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: t === 'placement_invites' ? r : recipient }) }; return q; } } as any;
}

test('not_open → preview كاملة بلا أسرار', async () => {
  const r = await openInvite(fakeDb(row), 'SEVUANBP', null);
  assert.equal(r.ok, false); if (r.ok) return;
  assert.equal(r.error, 'not_open'); assert.ok(r.preview);
  assert.equal(r.preview!.lang, 'fr'); assert.equal(r.preview!.opens_at, row.opens_at); assert.equal(r.preview!.expires_at, row.expires_at);
  assert.equal(r.preview!.label_ar, row.label_ar); assert.equal(r.preview!.recipient_name, null);
  assert.ok(!('token_hash' in r.preview!) && !('proctor_pin_hash' in r.preview!));
});

test('شخصية + رمز → اسم المستلمة في المعاينة', async () => {
  const r = await openInvite(fakeDb({ ...row, kind: 'personal' }, { name: 'Camille Dupont' }), 'SEVUANBP', 'tok');
  assert.equal(r.ok, false); if (r.ok) return; assert.equal(r.preview?.recipient_name, 'Camille Dupont');
});

test('invitePreview لا يكشف اسم العميل إلا للخدمة الخارجية', () => {
  assert.equal(invitePreview({ ...row, service_mode: 'internal', client_name: 'X' }).client_name, null);
  assert.equal(invitePreview({ ...row, service_mode: 'external', client_name: 'Lycée Y' }).client_name, 'Lycée Y');
});

test('نصوص الترحيب: ar/en/fr كاملة، وغيرها يرث en', () => {
  for (const l of ['ar', 'en', 'fr']) { const w = welcomeText(l); assert.ok(w.about_athar.length > 40 && w.about_miaar.includes('A1') && w.tips.length === 3 && w.luck && w.regards && w.team); }
  assert.equal(welcomeText('de').title, welcomeText('en').title);
  assert.ok(welcomeText('fr').about_athar.includes('ATHAR') && welcomeText('ar').about_miaar.includes('مِعيار'));
  assert.equal(fillW('{a}-{b}', { a: 1, b: 'x' }), '1-x');
});

test('موعد الجلسة بتوقيت باريس: الأحد 29 نوفمبر 12:00→16:00 (UTC+1)', () => {
  const s = sessionLine(row, 'fr', 'Europe/Paris'); assert.ok(s);
  assert.match(s!.main, /dimanche 29 novembre 2026/i); assert.match(s!.main, /12:00/); assert.match(s!.main, /16:00/); assert.equal(s!.extra, null);
  const r = sessionLine(row, 'ar', 'Asia/Riyadh'); assert.match(r!.main, /14:00/); assert.match(r!.main, /18:00/); assert.match(r!.main, /29/);
  const e = sessionLine(row, 'en', 'UTC'); assert.match(e!.main, /Sunday,? 29 November 2026/); assert.match(e!.main, /11:00/);
});

test('نافذة تمتد أيامًا → سطر «حتى»', () => {
  const s = sessionLine({ opens_at: '2026-11-29T11:00:00Z', expires_at: '2026-12-03T20:59:00Z' }, 'fr', 'Europe/Paris');
  assert.ok(s!.extra && /jusqu/.test(s!.extra) && /3 décembre/.test(s!.extra));
});

test('opensIn: أيام/ساعات/دقائق، وnull بعد الموعد', () => {
  const o = '2026-11-29T11:00:00Z';
  assert.equal(opensIn(o, 'fr', Date.parse('2026-11-27T10:30:00Z')), 'Ouverture dans 2 j');
  assert.equal(opensIn(o, 'en', Date.parse('2026-11-29T08:30:00Z')), 'Opens in 2 h 30 min');
  assert.equal(opensIn(o, 'ar', Date.parse('2026-11-29T10:59:30Z')), 'يُفتح بعد 1 دقيقة');
  assert.equal(opensIn(o, 'fr', Date.parse('2026-11-29T11:00:00Z')), null);
});

test('ثنائية اللغة بالطول: لغة الدعوة ثم العربية؛ والعربية وحدها إن كانت الدعوة عربية', async () => {
  const { welcomeLangs } = await import('../app/miaar/InviteWelcome');
  assert.deepEqual(welcomeLangs('fr'), ['fr', 'ar']); assert.deepEqual(welcomeLangs('en'), ['en', 'ar']); assert.deepEqual(welcomeLangs('ar'), ['ar']);
});
