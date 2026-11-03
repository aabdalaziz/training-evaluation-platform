// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P45 — «بروفة» (التمرين التبادلي بين الممارسين): التنظيف · الآن/الموعد · الأهلية والدوائر · الإلغاء · الجملتان وتسليمهما · «كيف مرّ؟» · بطاقة الدور · الرؤية بلا أسماء · العام k≥5 · الخزنة · الطريق · نوع الغرفة
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P45_NAMES_AR, SITUATION_MIN, SITUATION_MAX, ROLE_MAX, KIND_MAX, SELF_MAX, ROOM_MINUTES, NOW_HOURS, SCHEDULE_DAYS, NOTES_HOURS, PUBLIC_K, STATUSES, STATUS_AR, MODE_AR, CIRCLE_AR, HOW_AR, SOURCE_AR,
  cleanRequest, cleanNote, isAsker, isPartner, shouldExpire, canAccept, canCancel, canNote, kindNoteDelivered, canAnswerHow, roleCardAr, roomTitleAr, toView, sortOpen, publicLearned, witnessLineAr, boardSummaryAr, situationFromNeed, situationFromStation, situationFromCase, addHours,
} from '../lib/rehearsal/registry';
import type { RehRow } from '../lib/rehearsal/registry';
import { REGISTRY } from '../lib/vault/registry';
import { SECTORS_2062 } from '../lib/portal/lexicon';
import { crumbsFor } from '../lib/portal/way';
import { ROOM_KIND_LABEL, ROOM_DEFAULT_PROMPT } from '../lib/portal/media';

const SECTORS = SECTORS_2062.map(s => s.code);
const NOW = new Date('2026-11-03T10:00:00Z');
const row = (o: Partial<RehRow> = {}): RehRow => ({ id: 'r1', created_at: '2026-11-03T09:00:00Z', user_id: 'u1', email: 'a@x.sa', name_ar: 'أحمد', sector: 'education', situation_ar: 'اجتماع مع ولي أمر غاضب يتّهمني بظلم ابنه أمام زملائي', my_role_ar: 'معلّم الصف', other_role_ar: 'ولي أمر غاضب', source: 'free', source_ref: null, mode: 'now', scheduled_at: null, real_at: null, circle: 'all', circle_ref: null, status: 'open', expires_at: '2026-11-03T11:00:00Z', partner_user_id: null, partner_email: null, partner_name_ar: null, accepted_at: null, room_code: null, done_at: null, how_went: null, how_went_at: null, reported_by: null, reported_at: null, ...o });
const me = { id: 'u1', email: 'a@x.sa' }; const other = { id: 'u2', email: 'b@x.sa', enrolled: true }; const staff = { id: 'u9', email: 's@x.sa', staff: true };
const sectorAr = (c: string) => (c === 'education' ? 'التعليم' : c === 'health' ? 'الصحة' : c);

test('الأسماء والحدود: بروفة · التمرين التبادلي بين الممارسين · 20–300 · 15 دقيقة · ساعتان · 7 أيام · 24 ساعة · k=5', () => {
  assert.equal(P45_NAMES_AR.phase, 'بروفة'); assert.equal(P45_NAMES_AR.official, 'التمرين التبادلي بين الممارسين'); assert.equal(P45_NAMES_AR.self, 'ما سأفعله مختلفًا'); assert.equal(P45_NAMES_AR.kind, 'جملة طيبة');
  assert.equal(SITUATION_MIN, 20); assert.equal(SITUATION_MAX, 300); assert.equal(ROLE_MAX, 80); assert.equal(KIND_MAX, 200); assert.equal(SELF_MAX, 300); assert.equal(ROOM_MINUTES, 15); assert.equal(NOW_HOURS, 2); assert.equal(SCHEDULE_DAYS, 7); assert.equal(NOTES_HOURS, 24); assert.equal(PUBLIC_K, 5);
  assert.equal(STATUSES.length, 6); for (const s of STATUSES) assert.ok(STATUS_AR[s], s); assert.equal(MODE_AR.now, 'الآن — على الهواء'); assert.equal(CIRCLE_AR.need, 'من أعلنوا الحاجة نفسها'); assert.equal(HOW_AR.stumbled, 'تعثّر — لكنني عرفت أين'); assert.equal(SOURCE_AR.case, 'من «كل يوم مهارة»');
});
test('التنظيف: القطاع · الموقف 20–300 بلا بريد/هاتف · الدور الآخر مطلوب · الآن = ساعتان', () => {
  assert.equal((cleanRequest({ sector: 'nope', situation_ar: 'x'.repeat(30), other_role_ar: 'مدير' }, SECTORS, NOW) as any).error, 'اختر القطاع');
  assert.ok(!(cleanRequest({ sector: 'education', situation_ar: 'قصير', other_role_ar: 'مدير' }, SECTORS, NOW) as any).ok);
  assert.ok(!(cleanRequest({ sector: 'education', situation_ar: 'م'.repeat(40), other_role_ar: '' }, SECTORS, NOW) as any).ok);
  const c = cleanRequest({ sector: 'education', situation_ar: '  اجتماع  مع ولي أمر غاضب راسلني a@b.sa أو 0501234567 ', other_role_ar: 'ولي أمر غاضب', my_role_ar: 'معلّم' }, SECTORS, NOW); assert.ok(c.ok);
  if (c.ok) { assert.ok(!c.r.situation_ar.includes('a@b.sa')); assert.ok(!c.r.situation_ar.includes('0501234567')); assert.equal(c.r.mode, 'now'); assert.equal(c.r.expires_at, addHours(NOW, NOW_HOURS)); assert.equal(c.r.circle, 'all'); assert.equal(c.r.scheduled_at, null); }
  const long = cleanRequest({ sector: 'health', situation_ar: 'ك'.repeat(500), other_role_ar: 'مريض' }, SECTORS, NOW); assert.ok(long.ok && long.r.situation_ar.length === SITUATION_MAX);
});
test('الموعد: في المستقبل · خلال 7 أيام · ينتهي بعده بنصف ساعة · الدائرة program/need تحتاج معرّفًا', () => {
  const past = cleanRequest({ sector: 'education', situation_ar: 'م'.repeat(40), other_role_ar: 'مدير', mode: 'scheduled', scheduled_at: '2026-11-03T09:00:00Z' }, SECTORS, NOW); assert.ok(!past.ok);
  const far = cleanRequest({ sector: 'education', situation_ar: 'م'.repeat(40), other_role_ar: 'مدير', mode: 'scheduled', scheduled_at: '2026-11-20T09:00:00Z' }, SECTORS, NOW); assert.ok(!far.ok);
  const ok = cleanRequest({ sector: 'education', situation_ar: 'م'.repeat(40), other_role_ar: 'مدير', mode: 'scheduled', scheduled_at: '2026-11-05T16:00:00Z', real_at: '2026-11-06T08:00:00Z', circle: 'program', circle_ref: 'p1' }, SECTORS, NOW); assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.r.scheduled_at, '2026-11-05T16:00:00.000Z'); assert.equal(ok.r.expires_at, '2026-11-05T16:30:00.000Z'); assert.equal(ok.r.real_at, '2026-11-06T08:00:00.000Z'); assert.equal(ok.r.circle, 'program'); assert.equal(ok.r.circle_ref, 'p1'); }
  assert.ok(!(cleanRequest({ sector: 'education', situation_ar: 'م'.repeat(40), other_role_ar: 'مدير', circle: 'need' }, SECTORS, NOW) as any).ok);
  assert.equal(cleanNote('kind_to_partner', 'م'.repeat(400)).ok && (cleanNote('kind_to_partner', 'م'.repeat(400)) as any).text.length, KIND_MAX); assert.ok(!cleanNote('to_self', 'x').ok);
});
test('الأهلية: ليس الطالب · مفتوحة وغير منتهية · طاقم/هيئة/مسجَّل · الدوائر (هيئة · برنامج · حاجة)', () => {
  assert.ok(!canAccept(row(), me, NOW).ok); assert.ok(canAccept(row(), other, NOW).ok); assert.ok(canAccept(row(), staff, NOW).ok);
  assert.ok(!canAccept(row(), { id: 'u3', email: 'c@x.sa' }, NOW).ok, 'غير مسجَّل');
  assert.ok(canAccept(row(), { id: 'u3', email: 'c@x.sa', faculty: true }, NOW).ok);
  assert.ok(!canAccept(row({ status: 'accepted' }), other, NOW).ok); assert.ok(!canAccept(row({ expires_at: '2026-11-03T09:30:00Z' }), other, NOW).ok);
  assert.ok(!canAccept(row({ circle: 'faculty' }), other, NOW).ok); assert.ok(canAccept(row({ circle: 'faculty' }), { ...other, faculty: true }, NOW).ok);
  assert.ok(!canAccept(row({ circle: 'program', circle_ref: 'p1' }), other, NOW).ok); assert.ok(canAccept(row({ circle: 'program', circle_ref: 'p1' }), { ...other, programs: ['p1'] }, NOW).ok); assert.ok(canAccept(row({ circle: 'program', circle_ref: 'p1' }), staff, NOW).ok);
  assert.ok(!canAccept(row({ circle: 'need', circle_ref: 'n1' }), other, NOW).ok); assert.ok(canAccept(row({ circle: 'need', circle_ref: 'n1' }), { ...other, needs: ['n1'] }, NOW).ok);
  assert.ok(shouldExpire(row({ expires_at: '2026-11-03T09:59:00Z' }), NOW)); assert.ok(!shouldExpire(row({ status: 'accepted', expires_at: '2026-11-03T09:59:00Z' }), NOW));
});
test('الإلغاء والجملتان والتسليم و«كيف مرّ؟»', () => {
  assert.ok(canCancel(row(), me).ok); assert.ok(!canCancel(row(), other).ok); assert.ok(!canCancel(row({ status: 'done' }), me).ok);
  const acc = row({ status: 'accepted', partner_user_id: 'u2', partner_email: 'b@x.sa', accepted_at: '2026-11-03T09:30:00Z' });
  assert.ok(isPartner(acc, other)); assert.ok(isAsker(acc, me)); assert.ok(!isAsker(acc, other));
  assert.ok(canNote(acc, me, NOW).ok); assert.ok(canNote(acc, other, NOW).ok); assert.ok(!canNote(acc, staff, NOW).ok); assert.ok(!canNote(row(), me, NOW).ok);
  const done = { ...acc, status: 'done' as const, done_at: '2026-11-03T09:50:00Z' };
  assert.ok(!canNote(done, me, new Date('2026-11-04T11:00:00Z')).ok, 'بعد 24 ساعة تُغلق');
  assert.ok(kindNoteDelivered(done, true, NOW)); assert.ok(!kindNoteDelivered(done, false, NOW)); assert.ok(kindNoteDelivered(done, false, new Date('2026-11-04T10:00:00Z')));
  assert.ok(canAnswerHow(done, me, NOW)); assert.ok(!canAnswerHow(done, other, NOW)); assert.ok(!canAnswerHow({ ...done, real_at: '2026-11-06T08:00:00Z' }, me, NOW)); assert.ok(canAnswerHow({ ...done, real_at: '2026-11-06T08:00:00Z' }, me, new Date('2026-11-06T09:00:00Z'))); assert.ok(!canAnswerHow({ ...done, how_went: 'stumbled' }, me, NOW));
});
test('بطاقة الدور وعنوان الغرفة', () => {
  const card = roleCardAr(row()); assert.ok(card.startsWith('الموقف: اجتماع')); assert.ok(card.includes('أنت تلعب: ولي أمر غاضب')); assert.ok(card.includes('وأنا معلّم الصف')); assert.ok(card.includes('يُعاد المشهد'));
  assert.equal(roomTitleAr(row()), 'بروفة: ولي أمر غاضب');
});
test('الرؤية: لا اسم قبل القبول · الاسمان للطرفين بعده · رمز الغرفة للطرفين فقط · الترتيب', () => {
  const v = toView(row(), { me: other, sectorAr }); assert.equal(v.asker_name_ar, null); assert.equal(v.room_code, null); assert.equal(v.mine, false); assert.equal(v.sector_ar, 'التعليم'); assert.ok(v.when_ar.startsWith('الآن'));
  const acc = row({ status: 'accepted', partner_user_id: 'u2', partner_email: 'b@x.sa', partner_name_ar: 'بدر', room_code: 'ABC234' });
  const vp = toView(acc, { me: other, sectorAr }); assert.equal(vp.asker_name_ar, 'أحمد'); assert.equal(vp.partner, true); assert.equal(vp.room_code, 'ABC234');
  const va = toView(acc, { me, sectorAr }); assert.equal(va.partner_name_ar, 'بدر'); assert.equal(va.mine, true);
  const vs = toView(acc, { me: { id: 'u7', email: 'z@x.sa' }, sectorAr }); assert.equal(vs.asker_name_ar, null); assert.equal(vs.room_code, null);
  const sorted = sortOpen([row({ id: 's', mode: 'scheduled', expires_at: '2026-11-04T10:30:00Z' }), row({ id: 'n2', expires_at: '2026-11-03T11:30:00Z' }), row({ id: 'n1', expires_at: '2026-11-03T11:00:00Z' })]); assert.deepEqual(sorted.map(r => r.id), ['n1', 'n2', 's']);
  assert.equal(JSON.stringify(v).includes('a@x.sa'), false, 'لا بريد في العرض');
});
test('العام k≥5: جمل «ما سأفعله مختلفًا» المأذونة فقط حين تبلغ خمسًا في القطاع · سطر الشهر بالكلمات', () => {
  const notes = [...Array(5)].map((_, i) => ({ sector: 'education', text_ar: `سأبدأ بالإنصات ${i}`, kind: 'to_self' as const, public_ok: true }));
  assert.equal(publicLearned(notes, sectorAr).length, 1); assert.equal(publicLearned(notes.slice(0, 4), sectorAr).length, 0);
  assert.equal(publicLearned([...notes.slice(0, 4), { ...notes[4], public_ok: false }], sectorAr).length, 0, 'بلا إذن لا تُحسب');
  assert.equal(publicLearned([...notes, { sector: 'health', text_ar: 'x', kind: 'kind_to_partner', public_ok: true }], sectorAr)[0].sector_ar, 'التعليم');
  assert.equal(witnessLineAr([], sectorAr), null); assert.equal(witnessLineAr([...Array(4)].map(() => ({ sector: 'education', other_role_ar: 'ولي أمر غاضب' })), sectorAr), null);
  const line = witnessLineAr([...Array(8)].map((_, i) => ({ sector: i < 6 ? 'education' : 'health', other_role_ar: i < 5 ? 'ولي أمر غاضب' : 'مريض قلق' })), sectorAr); assert.ok(line && line.includes('8 بروفات') && line.includes('«ولي أمر غاضب»') && line.includes('2 قطاعات'), line || '');
  assert.equal(boardSummaryAr([]), 'الصفحة تبدأ بموقفك.'); assert.ok(boardSummaryAr([row(), row({ status: 'done' })]).includes('طلب واحد'));
});
test('المصادر: من حاجة · قبل المحطة · من «كل يوم مهارة»', () => {
  assert.equal(situationFromNeed('  التعامل  مع ولي أمر غاضب '), 'التعامل مع ولي أمر غاضب');
  assert.ok(situationFromStation('إدارة الصف').includes('«إدارة الصف»'));
  const c = situationFromCase({ situation_ar: 'مريض يرفض الدواء', role_ar: 'ممرّض', parties_ar: [{ name_ar: 'مريض قلق' }, 'ابنه'] }); assert.equal(c.other_role_ar, 'مريض قلق'); assert.equal(c.my_role_ar, 'ممرّض');
});
test('الخزنة والطريق ونوع الغرفة', () => {
  assert.ok(REGISTRY.some(r => r.table === 'portal_rehearsals' && r.policy === 'anonymize' && r.piiCols.includes('name_ar'))); assert.ok(REGISTRY.some(r => r.table === 'portal_rehearsal_notes' && r.policy === 'delete'));
  assert.equal(new Set(REGISTRY.map(r => r.table)).size, REGISTRY.length, 'لا تكرار');
  assert.equal(crumbsFor('/me/rehearsal').at(-1)?.label, 'بروفاتي'); assert.equal(crumbsFor('/admin/rehearsals').at(-1)?.label, 'البروفات');
  assert.equal(ROOM_KIND_LABEL.rehearsal.ar, 'غرفة بروفة — التمرين التبادلي بين الممارسين'); assert.ok(ROOM_DEFAULT_PROMPT.rehearsal.includes('خمس عشرة دقيقة'));
});
