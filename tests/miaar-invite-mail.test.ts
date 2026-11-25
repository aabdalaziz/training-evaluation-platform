// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P76 «رسول مِعيار» — بناء رسالة الدعوة (ar/en/fr) وإرسالها: تجديد الرمز، التخطّي، التسجيل، الجماعية بقائمة بريد */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildInviteMail, mailText, parseEmails, sendInviteMail, mailFreshLinks } from '../lib/miaar/invite-mail';

const invite: any = { id: 'i1', code: 'XZ89FDXX', kind: 'personal', label_ar: 'الانغماس اللغوي — مجموعة فرنسا', lang: 'fr', exam_mode: 'adaptive', status: 'open', purpose: 'placement', opens_at: null, expires_at: '2026-12-03T20:59:00.000Z', mail_count: 0 };
const SITE = 'https://athar-portal.com';

test('نصوص ar/en/fr كاملة وغيرها يرث en', () => {
  for (const l of ['ar', 'en', 'fr']) { const m = mailText(l); assert.ok(m.subject.includes('{label}') && m.button && m.one_time.length > 30 && m.report.includes('ML-XXXX')); }
  assert.equal(mailText('de').button, mailText('en').button);
});

test('الرسالة الفرنسية: الموضوع والرابط والاسم والموعد والتحذير من التحويل', () => {
  const m = buildInviteMail({ invite, url: `${SITE}/miaar/d/XZ89FDXX?t=abc`, name: 'Camille Dupont', timeZone: 'Europe/Paris' });
  assert.ok(m.subject.startsWith('ATHAR |') && m.subject.includes('مجموعة فرنسا'));
  assert.ok(m.html.includes('Bonjour Camille Dupont,') && m.text.includes('Bonjour Camille Dupont,'));
  assert.ok(m.html.includes('href="https://athar-portal.com/miaar/d/XZ89FDXX?t=abc"'));
  assert.ok(m.html.includes('dir="ltr"') && m.text.includes('3 décembre 2026'));
  assert.ok(m.html.includes('usage unique') && m.html.includes('Commencer le test'));
  assert.ok(m.html.includes('athar-portal.com') && m.html.includes('Mi’yar'));
});

test('العربية RTL بلا اسم · الجماعية بلا تحذير الاستخدام الواحد · الهروب من HTML', () => {
  const ar = buildInviteMail({ invite: { ...invite, lang: 'ar', kind: 'group', label_ar: 'دفعة <ديسمبر>' }, url: `${SITE}/miaar/d/XZ89FDXX` });
  assert.ok(ar.html.includes('dir="rtl"') && ar.html.includes('أهلًا بك،') && !ar.html.includes('مرة واحدة') && ar.html.includes('&lt;ديسمبر&gt;') && !ar.html.includes('<ديسمبر>'));
  assert.ok(ar.subject.startsWith('أَثَر |'));
});

test('نافذة زمنية (opens_at) → سطر الجلسة بدل آخر موعد', () => {
  const m = buildInviteMail({ invite: { ...invite, opens_at: '2026-11-29T11:00:00.000Z', expires_at: '2026-11-29T15:00:00.000Z' }, url: 'u', timeZone: 'Europe/Paris' });
  assert.ok(m.text.includes('Votre session') && m.text.includes('12:00') && m.text.includes('16:00') && !m.text.includes('À faire avant'));
});

test('parseEmails: أسطر/فواصل/أسماء، صغير الحروف، بلا تكرار', () => {
  assert.deepEqual(parseEmails('Sara <Sara@X.com>\njohn@y.org, john@y.org; bad'), ['sara@x.com', 'john@y.org']);
});

// ---------------------------------------------------------------- قاعدة بيانات وهمية
function fakeDb(inv: any, recipients: any[]) {
  const updates: Array<{ table: string; patch: any; id: string }> = [];
  const db: any = {
    _updates: updates,
    from(table: string) {
      const q: any = { _f: {} as Record<string, any>, _patch: null as any,
        select() { return q; }, order() { return q; }, in() { return q; },
        eq(k: string, v: any) { q._f[k] = v; if (q._patch) { updates.push({ table, patch: q._patch, id: v }); if (table === 'placement_invite_recipients') { const r = recipients.find((x) => x.id === v); if (r) Object.assign(r, q._patch); } return Promise.resolve({ error: null }); } return q; },
        update(p: any) { q._patch = p; return q; },
        maybeSingle: async () => ({ data: table === 'placement_invites' ? inv : recipients.find((x) => x.id === q._f.id) || null }),
        then(res: any) { const data = table === 'placement_invite_recipients' ? recipients.filter((x) => x.invite_id === (q._f.invite_id || x.invite_id)) : []; return Promise.resolve({ data, error: null }).then(res); },
      };
      return q;
    },
  };
  return db;
}
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const okNotify = (log: any[]) => async (_db: any, msg: any) => { log.push(msg); return { ok: true, channel: 'email', error: null }; };

test('شخصية: رمز جديد لكل مستحقّ، تخطّي من بدأ/أنهى/سبق إرساله، وتسجيل mailed_at', async () => {
  const rec = [
    { id: 'r1', invite_id: 'i1', email: 'a@x.com', name: 'A', token_hash: 'old1', opened_at: null, started_at: null, report_id: null, mailed_at: null, mail_count: 0 },
    { id: 'r2', invite_id: 'i1', email: 'b@x.com', name: 'B', token_hash: 'old2', opened_at: '2026-11-25T10:00:00Z', started_at: '2026-11-25T10:01:00Z', report_id: null, mailed_at: null, mail_count: 0 },
    { id: 'r3', invite_id: 'i1', email: 'c@x.com', name: 'C', token_hash: 'old3', opened_at: null, started_at: null, report_id: 'rep', mailed_at: null, mail_count: 0 },
    { id: 'r4', invite_id: 'i1', email: 'd@x.com', name: null, token_hash: 'old4', opened_at: null, started_at: null, report_id: null, mailed_at: '2026-11-24T10:00:00Z', mail_count: 1 },
  ];
  const db = fakeDb(invite, rec); const log: any[] = []; let n = 0;
  const r = await sendInviteMail(db, 'i1', { site: SITE, notifyFn: okNotify(log), tokenFn: () => `tok${++n}`, now: new Date('2026-11-25T12:00:00Z') });
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.sent, 1); assert.equal(r.failed, 0); assert.deepEqual(r.skipped, { finished: 1, started: 1, mailed: 1 });
  assert.equal(log.length, 1); assert.equal(log[0].kind, 'miaar_invite'); assert.equal(log[0].to.email, 'a@x.com'); assert.equal(log[0].url, `${SITE}/miaar/d/XZ89FDXX?t=tok1`); assert.equal(log[0].ref, 'i1');
  assert.equal(rec[0].token_hash, sha('tok1')); assert.equal(rec[0].mail_count, 1); assert.ok(rec[0].mailed_at); assert.equal(rec[0].mail_channel, 'email');
  assert.equal(rec[3].token_hash, 'old4', 'لم يُجدَّد رمز من سبق إرساله في وضع unsent');
  assert.ok(db._updates.some((u: any) => u.table === 'placement_invites' && u.patch.mail_count === 1));
  assert.ok(r.note_ar.includes('أُرسل 1') && r.note_ar.includes('أُبطلت'));
});

test('وضع unopened: يعيد لمن أُرسل له ولم يفتح، ويتخطّى من فتح', async () => {
  const rec = [
    { id: 'r1', invite_id: 'i1', email: 'a@x.com', name: 'A', token_hash: 'o', opened_at: null, started_at: null, report_id: null, mailed_at: '2026-11-24T10:00:00Z', mail_count: 1 },
    { id: 'r2', invite_id: 'i1', email: 'b@x.com', name: 'B', token_hash: 'o', opened_at: '2026-11-24T11:00:00Z', started_at: null, report_id: null, mailed_at: '2026-11-24T10:00:00Z', mail_count: 1 },
  ];
  const db = fakeDb(invite, rec); const log: any[] = [];
  const r = await sendInviteMail(db, 'i1', { site: SITE, mode: 'unopened', notifyFn: okNotify(log), tokenFn: () => 'z', now: new Date('2026-11-25T12:00:00Z') });
  assert.ok(r.ok); if (!r.ok) return; assert.equal(r.sent, 1); assert.equal(log[0].to.email, 'a@x.com'); assert.equal(rec[0].mail_count, 2);
});

test('فشل القناة الآلية (manual) → failed ويُسجَّل الخطأ ولا يُحدَّث mailed_at', async () => {
  const rec = [{ id: 'r1', invite_id: 'i1', email: 'a@x.com', name: 'A', token_hash: 'o', opened_at: null, started_at: null, report_id: null, mailed_at: null, mail_count: 0 }];
  const db = fakeDb(invite, rec);
  const r = await sendInviteMail(db, 'i1', { site: SITE, notifyFn: async () => ({ ok: true, channel: 'manual', error: 'RESEND_API_KEY غير مضبوط' }), tokenFn: () => 'z', now: new Date('2026-11-25T12:00:00Z') });
  assert.ok(r.ok); if (!r.ok) return; assert.equal(r.sent, 0); assert.equal(r.failed, 1); assert.equal(rec[0].mailed_at, null); assert.ok(String(rec[0].mail_error).includes('RESEND'));
});

test('حراسة: دعوة مغلقة أو منتهية لا تُرسَل · جماعية بلا بريد ترفض · جماعية بقائمة ترسل الرابط العام', async () => {
  const closed = await sendInviteMail(fakeDb({ ...invite, status: 'closed' }, []), 'i1', { site: SITE, notifyFn: okNotify([]) }); assert.equal(closed.ok, false);
  const expired = await sendInviteMail(fakeDb(invite, []), 'i1', { site: SITE, notifyFn: okNotify([]), now: new Date('2026-12-05T00:00:00Z') }); assert.equal(expired.ok, false);
  const g = { ...invite, kind: 'group', code: 'ZN32HCWZ' };
  const none = await sendInviteMail(fakeDb(g, []), 'i1', { site: SITE, notifyFn: okNotify([]), now: new Date('2026-11-25T12:00:00Z') }); assert.equal(none.ok, false);
  const log: any[] = []; const r = await sendInviteMail(fakeDb(g, []), 'i1', { site: SITE, emails: ['x@y.com', 'z@y.com'], notifyFn: okNotify(log), now: new Date('2026-11-25T12:00:00Z') });
  assert.ok(r.ok); if (!r.ok) return; assert.equal(r.sent, 2); assert.ok(log.every((m) => m.url === `${SITE}/miaar/d/ZN32HCWZ`)); assert.ok(!log[0].html.includes('usage unique'));
});

test('mailFreshLinks: بعد الإنشاء يرسل الروابط كما هي ويربطها بالمستلمين', async () => {
  const rec = [{ id: 'r1', invite_id: 'i1', email: 'a@x.com', name: 'A', token_hash: 'h', opened_at: null, started_at: null, report_id: null, mailed_at: null, mail_count: 0 }];
  const db = fakeDb(invite, rec); const log: any[] = [];
  const r = await mailFreshLinks(db, invite, [{ email: 'A@x.com', name: 'A', url: `${SITE}/miaar/d/XZ89FDXX?t=fresh` }], { site: SITE, notifyFn: okNotify(log), now: new Date('2026-11-25T12:00:00Z') });
  assert.ok(r.ok); if (!r.ok) return; assert.equal(r.sent, 1); assert.equal(log[0].url, `${SITE}/miaar/d/XZ89FDXX?t=fresh`); assert.equal(rec[0].token_hash, 'h', 'لا تجديد للرمز'); assert.equal(rec[0].mail_count, 1);
});
