// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P44 — «البرنامج الذي لم يُكتب بعد» (الاحتياج التدريبي المعلَن): التنظيف · خمسة تُعلِن · الرؤية · التأييد/التبنّي/السحب/الإحياء · الطيّ الهادئ · المقاعد الأولى · سطر الميلاد · الخزنة · الطريق
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  P44_NAMES_AR, NEED_MIN, NEED_MAX, NEED_K, FOLD_DAYS, PRIORITY_HOURS, PITCH_MAX, STATUSES, STATUS_AR, SOURCE_AR, PUBLIC_STATUSES,
  cleanNeed, cleanPitch, supportsBandAr, bornLineAr, visibleTo, isMine, canSupport, canAdopt, canWithdraw, canRevive, shouldFold, addHours, priorityState, sortNeeds, needView, boardSummaryAr, needFromStationText, needFromOfferText,
} from '../lib/needs/registry';
import type { NeedRow } from '../lib/needs/registry';
import { REGISTRY } from '../lib/vault/registry';
import { SECTORS_2062 } from '../lib/portal/lexicon';
import { crumbsFor } from '../lib/portal/way';

const SECTORS = SECTORS_2062.map(s => s.code);
const row = (o: Partial<NeedRow> = {}): NeedRow => ({ id: 'n1', created_at: '2026-11-01T10:00:00Z', user_id: 'u1', email: 'a@x.sa', sector: 'education', text_ar: 'التعامل مع ولي أمر غاضب في اجتماع مدرسي دون تصعيد', source: 'practitioner', source_ref: null, organization_id: null, org_named: false, status: 'seed', supports: 0, opened_at: null, adopter_user_id: null, adopter_email: null, adopter_kind: null, adopter_name_ar: null, pitch_ar: null, adopted_at: null, draft_id: null, program_id: null, born_at: null, priority_until: null, folded_at: null, revived_at: null, withdrawn_at: null, merged_into: null, ...o });
const me = { id: 'u1', email: 'a@x.sa' }; const other = { id: 'u2', email: 'b@x.sa' }; const staff = { id: 'u9', email: 's@x.sa', staff: true };

test('الأسماء والحدود: البرنامج الذي لم يُكتب بعد · الاحتياج التدريبي المعلَن · 20–200 · خمسة · 90 يومًا · 72 ساعة · 600', () => {
  assert.equal(P44_NAMES_AR.phase, 'البرنامج الذي لم يُكتب بعد'); assert.equal(P44_NAMES_AR.official, 'الاحتياج التدريبي المعلَن'); assert.equal(P44_NAMES_AR.me_too, 'وأنا أيضًا'); assert.equal(P44_NAMES_AR.page, 'ما يحتاجه الممارسون');
  assert.equal(NEED_MIN, 20); assert.equal(NEED_MAX, 200); assert.equal(NEED_K, 5); assert.equal(FOLD_DAYS, 90); assert.equal(PRIORITY_HOURS, 72); assert.equal(PITCH_MAX, 600);
  assert.equal(STATUSES.length, 7); for (const s of STATUSES) assert.ok(STATUS_AR[s], s); assert.deepEqual(PUBLIC_STATUSES, ['open', 'adopted', 'born']); assert.equal(SOURCE_AR.org, 'جهة');
});
test('التنظيف: القطاع من القاموس · الطول · حجب البريد والهاتف · الحافز ≤ 600', () => {
  assert.equal((cleanNeed({ sector: 'nope', text_ar: 'x'.repeat(30) }, SECTORS) as any).error, 'اختر القطاع');
  assert.ok(!(cleanNeed({ sector: 'education', text_ar: 'قصير' }, SECTORS) as any).ok);
  const c = cleanNeed({ sector: 'education', text_ar: '  أحتاج تدريبًا على   إدارة الصف راسلني a@b.sa أو 0501234567 ' }, SECTORS); assert.ok(c.ok); if (c.ok) { assert.ok(!c.n.text_ar.includes('a@b.sa')); assert.ok(!c.n.text_ar.includes('0501234567')); assert.ok(!c.n.text_ar.includes('  ')); }
  const long = cleanNeed({ sector: 'health', text_ar: 'ك'.repeat(400) }, SECTORS); assert.ok(long.ok && long.n.text_ar.length === NEED_MAX);
  assert.equal(cleanPitch('م'.repeat(700)).length, PITCH_MAX);
});
test('الشرائح بالكلمات: لا عدّاد تنافسي · سطر الميلاد يعدّ الكاتب مع المؤيّدين', () => {
  assert.equal(supportsBandAr(0), 'لم يؤيّدها أحد بعد'); assert.equal(supportsBandAr(1), 'أيّدها واحد — تنتظر خمسة'); assert.equal(supportsBandAr(4), 'أيّدها 4 — تنتظر خمسة'); assert.equal(supportsBandAr(5), 'أيّدها خمسة إلى تسعة'); assert.equal(supportsBandAr(60), 'أيّدها أكثر من خمسين');
  assert.equal(bornLineAr(5, 'التعليم'), 'وُلد هذا البرنامج من حاجة أعلنها 6 ممارسين في التعليم — لا من مكتب.'); assert.equal(bornLineAr(0, null), 'وُلد هذا البرنامج من حاجة أعلنها ممارس واحد — لا من مكتب.'); assert.ok(bornLineAr(11, 'الصحة').includes('12 ممارسًا'));
});
test('الرؤية: البذرة للمسجَّلين فقط · المعلَنة للعالم · المطويّة لصاحبها والطاقم · المسحوبة لصاحبها', () => {
  assert.equal(visibleTo(row(), null), false); assert.equal(visibleTo(row(), other), true); assert.equal(visibleTo(row({ status: 'open' }), null), true); assert.equal(visibleTo(row({ status: 'born' }), null), true);
  assert.equal(visibleTo(row({ status: 'folded' }), other), false); assert.equal(visibleTo(row({ status: 'folded' }), me), true); assert.equal(visibleTo(row({ status: 'folded' }), staff), true); assert.equal(visibleTo(row({ status: 'withdrawn' }), other), false);
  assert.ok(isMine(row(), { email: 'A@X.SA' })); assert.ok(!isMine(row(), other));
});
test('«وأنا أيضًا»: ليس لكاتبها · مرة واحدة · لا بعد الميلاد/الطيّ', () => {
  assert.equal((canSupport(row(), me, false) as any).error, 'هذه حاجتك — كاتبها محسوب معها'); assert.ok(canSupport(row(), other, false).ok); assert.equal((canSupport(row(), other, true) as any).error, 'أيّدتها من قبل');
  assert.ok(canSupport(row({ status: 'adopted' }), other, false).ok); assert.ok(!canSupport(row({ status: 'born' }), other, false).ok); assert.ok(!canSupport(row({ status: 'folded' }), other, false).ok);
});
test('التبنّي: هيئة معتمَدة أو طاقم · حاجة مفتوحة أو بذرة · لا مرتين', () => {
  assert.equal((canAdopt(row({ status: 'open' }), { faculty: false, staff: false }) as any).error, 'التبنّي لأعضاء هيئة أَثَر المعتمَدين وللطاقم');
  assert.ok(canAdopt(row({ status: 'open' }), { faculty: true, staff: false }).ok); assert.ok(canAdopt(row({ status: 'seed' }), { faculty: false, staff: true }).ok);
  assert.equal((canAdopt(row({ status: 'adopted' }), { faculty: true, staff: false }) as any).error, 'تبنّاها كاتب من قبل'); assert.ok(!canAdopt(row({ status: 'born' }), { faculty: true, staff: true }).ok);
});
test('السحب لصاحبها قبل التبنّي · الإحياء للمطويّة (صاحبها أو الطاقم)', () => {
  assert.ok(canWithdraw(row(), me).ok); assert.ok(canWithdraw(row({ status: 'folded' }), me).ok); assert.equal((canWithdraw(row({ status: 'adopted' }), me) as any).error, 'لا تُسحب بعد التبنّي'); assert.equal((canWithdraw(row(), other) as any).error, 'ليست حاجتك');
  assert.ok(canRevive(row({ status: 'folded' }), me).ok); assert.ok(canRevive(row({ status: 'folded' }), staff).ok); assert.ok(!canRevive(row({ status: 'folded' }), other).ok); assert.ok(!canRevive(row({ status: 'open' }), me).ok);
});
test('الطيّ الهادئ: 90 يومًا بلا متبنٍّ (من الإنشاء أو آخر إحياء) · لا تُطوى المتبنّاة', () => {
  const now = new Date('2026-11-01T10:00:00Z');
  assert.equal(shouldFold(row({ created_at: '2026-08-10T00:00:00Z' }), now), false); assert.equal(shouldFold(row({ created_at: '2026-07-01T00:00:00Z' }), now), true); assert.equal(shouldFold(row({ status: 'open', created_at: '2026-07-01T00:00:00Z' }), now), true);
  assert.equal(shouldFold(row({ created_at: '2026-07-01T00:00:00Z', revived_at: '2026-10-01T00:00:00Z' }), now), false); assert.equal(shouldFold(row({ status: 'adopted', created_at: '2026-01-01T00:00:00Z' }), now), false);
});
test('المقاعد الأولى: 72 ساعة من فتح التسجيل · فعّالة ثم تنقضي', () => {
  const t0 = new Date('2026-11-01T10:00:00Z'); const until = addHours(t0, PRIORITY_HOURS); assert.equal(until, '2026-11-04T10:00:00.000Z');
  assert.deepEqual(priorityState(row(), t0), { active: false, until: null }); assert.equal(priorityState(row({ priority_until: until }), new Date('2026-11-02T00:00:00Z')).active, true); assert.equal(priorityState(row({ priority_until: until }), new Date('2026-11-05T00:00:00Z')).active, false);
});
test('الترتيب بالأحدث لا بالأكثر تأييدًا · الملخّص بالكلمات (k≥5 للأرقام)', () => {
  const s = sortNeeds([row({ id: 'a', created_at: '2026-10-01T00:00:00Z', supports: 40 }), row({ id: 'b', created_at: '2026-10-05T00:00:00Z', supports: 0 }), row({ id: 'c', created_at: '2026-09-01T00:00:00Z', revived_at: '2026-10-09T00:00:00Z' })]);
  assert.deepEqual(s.map(x => x.id), ['c', 'b', 'a']);
  assert.equal(boardSummaryAr([]), 'الصفحة تبدأ بحاجتك.'); assert.equal(boardSummaryAr([row({ status: 'open' }), row({ status: 'open' })]), 'الصفحة تبدأ بحاجتك.');
  assert.equal(boardSummaryAr([...Array(5)].map(() => row({ status: 'open' })).concat([row({ status: 'adopted' }), row({ status: 'born' }), row({ status: 'born' })])), '5 حاجة تنتظر كاتبها · حاجة واحدة تبنّاها كاتب · برنامجان وُلدا من حاجة');
});
test('العرض العام: بلا بريد · الجهة باسمها إن أذنت وإلا «جهة في قطاع …» · الأفعال محسوبة · المسودّة للطاقم فقط', () => {
  const sectorAr = (c: string) => (c === 'education' ? 'التعليم' : c);
  const v = needView(row({ status: 'open', supports: 6, organization_id: 'o1', org_named: false }), { me: other as any, supported: false, sectorAr, orgName: 'جامعة أَثَر' });
  assert.ok(!JSON.stringify(v).includes('a@x.sa')); assert.equal(v.org_ar, 'جهة في التعليم'); assert.equal(v.can_support, true); assert.equal(v.can_adopt, false); assert.equal(v.can_withdraw, false); assert.equal(v.draft_id, null); assert.equal(v.band_ar, 'أيّدها خمسة إلى تسعة');
  const v2 = needView(row({ status: 'open', organization_id: 'o1', org_named: true, draft_id: 'd1' }), { me: { ...staff, faculty: true }, supported: true, sectorAr, orgName: 'جامعة أَثَر' }); assert.equal(v2.org_ar, 'جامعة أَثَر'); assert.equal(v2.can_adopt, true); assert.equal(v2.draft_id, 'd1'); assert.equal(v2.can_support, false);
  const v3 = needView(row(), { me: null, supported: false, sectorAr, orgName: null }); assert.equal(v3.can_support, false); assert.equal(v3.mine, false);
});
test('من محطة ومن ورشة: نصّ ≤ 200 بلا بريد · صيغة الورشة', () => {
  const t = needFromStationText('لم تسنح لي الفرصة لأن المدير رفض — راسلوني على me@x.sa ' + 'كلمة '.repeat(80)); assert.ok(t.length <= NEED_MAX); assert.ok(!t.includes('me@x.sa')); assert.ok(t.endsWith('…'));
  const o = needFromOfferText('تعليم العربية للناطقين بغيرها', 'ورشة تطبيق: تصميم درس تواصلي'); assert.ok(o.startsWith('ورشة تطبيق بعد برنامج «تعليم العربية للناطقين بغيرها»')); assert.ok(o.includes('طلبها خمسة'));
});
test('الخزنة والطريق: الجدولان في سجلّ الخزنة · /needs و/admin/needs لهما اسم في الطريق', () => {
  const t = REGISTRY.find(r => r.table === 'portal_needs'); const s = REGISTRY.find(r => r.table === 'portal_need_supports'); assert.ok(t && s); assert.equal(t!.policy, 'anonymize'); assert.equal(s!.policy, 'delete'); assert.ok(t!.access.includes('public'));
  const w = crumbsFor('/needs', 'ar'); assert.ok(JSON.stringify(w).includes('ما يحتاجه الممارسون')); const a = crumbsFor('/admin/needs', 'ar'); assert.ok(JSON.stringify(a).includes('الاحتياج المعلَن'));
});
