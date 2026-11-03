// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P39 — «أصوات حول الشهادة»: الرسالة (نافذتها · الختم · الفتح مع محطة السنة) · البرنامج يردّ (المُطلِق بخمسة مختلفين · تنقية العرض · المسودّة المحلية)
//                 · محطة الجهة (خمسة منسوبين · النافذة · لا تعديل) · القياس (الالتحاق ↔ بعد · سطر البرنامج من خمسة بالكلمات) · فصل رحلة الجهة · الخزنة
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P39_NAMES_AR, LETTER_MIN, LETTER_MAX, letterWindow, letterPhase, canWriteLetter, cleanLetter, shouldUnseal,
  OFFER_K, noChancePeople, offerTrigger, cleanOffer, localOfferDraft, parseOfferDraft,
  ORG_STATES, ORG_STATE_AR, canWriteOrgStation, cleanOrgStation, orgSaidLine,
  measureOf, programMeasureLine, orgAfterChapters,
} from '../lib/after/voices';
import { REGISTRY, NON_PERSONAL_TABLES } from '../lib/vault/registry';
import { ORG_KIND_AR } from '../lib/org-journey/registry';

const at = (d: string) => new Date(`${d}T12:00:00Z`);
const END = '2026-07-30';

test('الأسماء: أصوات حول الشهادة · متابعة أثر التدريب — المستوى الثاني · رسالة إلى نفسي بعد سنة · البرنامج يردّ · محطة الجهة', () => {
  assert.equal(P39_NAMES_AR.phase, 'أصوات حول الشهادة'); assert.equal(P39_NAMES_AR.letter, 'رسالة إلى نفسي بعد سنة'); assert.equal(P39_NAMES_AR.offer, 'البرنامج يردّ'); assert.equal(P39_NAMES_AR.org, 'محطة الجهة');
  assert.equal(P39_NAMES_AR.official, 'متابعة أثر التدريب — المستوى الثاني'); assert.equal(LETTER_MIN, 40); assert.equal(LETTER_MAX, 600); assert.equal(OFFER_K, 5);
});

test('الرسالة: نافذتها من end−7 إلى end+44 · تُفتح مع محطة السنة (end+351) · لا كتابة قبل/بعد · مختومة لا تُعدَّل', () => {
  const w = letterWindow(END); assert.deepEqual(w, { opens: '2026-07-23', closes: '2026-09-12', unseals: '2027-07-16' });
  assert.equal(letterPhase(END, null, at('2026-07-22')), 'future'); assert.equal(letterPhase(END, null, at('2026-07-23')), 'open'); assert.equal(letterPhase(END, null, at('2026-09-12')), 'open'); assert.equal(letterPhase(END, null, at('2026-09-13')), 'missed');
  assert.equal(letterPhase(END, { opened_at: null }, at('2026-12-01')), 'sealed'); assert.equal(letterPhase(END, { opened_at: '2027-07-16T00:00:00Z' }, at('2027-08-01')), 'opened');
  assert.equal(canWriteLetter(END, null, at('2026-08-01')).ok, true); assert.equal(canWriteLetter(END, null, at('2026-10-01')).ok, false); assert.equal(canWriteLetter(END, { opened_at: null }, at('2026-08-01')).ok, false, 'لا تُعدَّل بعد الختم');
  assert.equal(shouldUnseal(END, { opened_at: null }, at('2027-07-15')), false); assert.equal(shouldUnseal(END, { opened_at: null }, at('2027-07-16')), true); assert.equal(shouldUnseal(END, { opened_at: 'x' }, at('2028-01-01')), false, 'مرة واحدة');
  assert.equal(cleanLetter('قصير').ok, false); const c = cleanLetter('أتمنى أن أكون قد طبّقت خطة المتابعة مع فريقي وراسلتُ a@b.sa عن النتائج كلها بصراحة'); assert.ok(c.ok && !c.text_ar.includes('a@b.sa'), 'البريد يُحجب');
});

test('البرنامج يردّ: خمسة مختلفون كتبوا «لم تسنح» (لا تكرار الشخص) · تنقية العرض والرابط · مسودّة محلية بلا أسماء', () => {
  const r = (email: string, state: any, station = 90) => ({ state, written_at: '2026-10-20T00:00:00Z', user_id: null, email, station } as any);
  const four = [r('a@x', 'no_chance'), r('a@x', 'no_chance', 30), r('b@x', 'no_chance'), r('c@x', 'no_chance'), r('d@x', 'no_chance'), r('e@x', 'applied')];
  assert.equal(noChancePeople(four), 4); assert.equal(offerTrigger(four).ready, false); assert.match(offerTrigger(four).line_ar, /كتب 4/);
  const five = [...four, r('f@x', 'no_chance')]; assert.equal(offerTrigger(five).ready, true); assert.match(offerTrigger(five).line_ar, /هل يردّ البرنامج/);
  assert.equal(cleanOffer({ title_ar: 'و', text_ar: 'x' }).ok, false); assert.equal(cleanOffer({ title_ar: 'ورشة تطبيق', text_ar: 'نلتقي لنطبّق معًا موقفًا حقيقيًا من عملكم.', link: 'http://evil' }).ok, false, 'http ممنوع');
  const ok = cleanOffer({ title_ar: 'ورشة تطبيق', text_ar: 'نلتقي لنطبّق معًا موقفًا حقيقيًا من عملكم.', link: '/live' }); assert.ok(ok.ok && ok.o.link === '/live');
  const d = localOfferDraft('قيادة الصف', ['لم أجد وقتًا للتطبيق مع ضغط الجدول', 'انتقلت لقسم آخر']); assert.match(d.title_ar, /ورشة تطبيق — قيادة الصف/); assert.match(d.text_ar, /كتب 2 منكم/); assert.ok(d.text_ar.length <= 400);
  assert.deepEqual(parseOfferDraft({ title_ar: '', text_ar: 'قصير' }, d), d, 'يعود للمحلي إن قصّر الذكاء');
});

test('محطة الجهة: لا تُفتح دون خمسة منسوبين · النافذة ±14 حول السنة · لا تعديل · تنقية بصيغة الجهة · سطر «وقالت الجهة»', () => {
  assert.deepEqual([...ORG_STATES], ['changed', 'partly', 'not_yet', 'cannot_judge']); assert.equal(ORG_STATE_AR.cannot_judge, 'لا نستطيع الحكم');
  assert.equal(canWriteOrgStation(END, 4, null, at('2027-07-30')).ok, false); assert.equal(canWriteOrgStation(END, 5, null, at('2027-07-15')).ok, false, 'قبل النافذة'); assert.equal(canWriteOrgStation(END, 5, null, at('2027-07-30')).ok, true);
  assert.equal(canWriteOrgStation(END, 5, { written_at: 'x' }, at('2027-07-30')).ok, false); assert.equal(canWriteOrgStation(END, 5, null, at('2027-08-20')).ok, false, 'فاتت');
  assert.equal(cleanOrgStation({ state: 'changed', text_ar: 'قصير' }).ok, false); const c = cleanOrgStation({ state: 'partly', text_ar: 'صار لدينا اجتماع أسبوعي لمراجعة المواقف الصفية، وتراجعت الإحالات الانضباطية في فصلين.', public: true }); assert.ok(c.ok && c.s.public);
  assert.match(orgSaidLine({ org_ar: 'جامعة أَثَر', state: 'partly', state_ar: 'تغيّر جزئي', text_ar: 'ن', written_at: 'x' }), /^وقالت جامعة أَثَر بعد سنة — تغيّر جزئي/);
});

test('القياس: الالتحاق ↔ أول قياس بعد البرنامج · سطر المتدرّب · سطر البرنامج من خمسة بالكلمات لا نسب', () => {
  const m = measureOf('A2', { level: 'B1', at: '2026-10-12T09:00:00Z', code: 'ML-AAAA-BBBB' }); assert.equal(m.steps, 1); assert.equal(m.line_ar, 'كنت A2 عند الالتحاق، وقِست B1 في 2026-10-12 — تقدّمت مستوى.');
  assert.equal(measureOf('PRE_A1', { level: 'A2', at: '2026-10-12', code: null }).steps, 2); assert.equal(measureOf('B1', { level: 'B1', at: '2026-10-12', code: null }).line_ar.includes('المستوى نفسه'), true);
  const none = measureOf('A2', null); assert.equal(none.has_after, false); assert.match(none.line_ar, /لم تقِس/);
  assert.equal(measureOf(null, null).entry_level, null);
  assert.equal(programMeasureLine([1, 1, 0, 1]).shown, false); const p = programMeasureLine([1, 2, 0, 1, 1]); assert.ok(p.shown && p.line_ar && !/%/.test(p.line_ar) && /أكثرهم تقدّموا/.test(p.line_ar), p.line_ar || '');
  assert.match(programMeasureLine([0, 0, 0, 1, 0]).line_ar || '', /ثبتوا على مستواهم/);
});

test('رحلة الجهة: فصل «قالت بعد سنة» (org_after) باسم في ORG_KIND_AR · الخزنة تعرف الجداول الأربعة', () => {
  assert.equal(ORG_KIND_AR.org_after, 'قالت بعد سنة');
  const ch = orgAfterChapters([{ program_ar: 'قيادة الصف', written_at: '2026-11-05T10:00:00Z', state: 'changed' }], iso => `${iso.slice(0, 4)}-Q4`); assert.equal(ch.length, 1); assert.equal(ch[0].kind, 'org_after'); assert.equal(ch[0].people, null); assert.match(ch[0].what_ar, /تغيّر ملموس/);
  const reg = new Set(REGISTRY.map(r => r.table)); assert.ok(reg.has('portal_after_letters') && reg.has('portal_after_offer_replies'), 'الجداول الشخصية في السجلّ');
  assert.ok(NON_PERSONAL_TABLES.includes('portal_after_offers') && NON_PERSONAL_TABLES.includes('portal_after_org_stations'), 'غير الشخصية');
  assert.equal(REGISTRY.find(r => r.table === 'portal_after_letters')!.access.join(','), 'self', 'الرسالة لا يراها غير صاحبها');
});
