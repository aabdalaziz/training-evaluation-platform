// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م8-ب «قاعة الشاهد» — الافتراضي العام · حلّ الوضع (جلسة ← دعوة ← افتراضي) · المكان والمدينة · مفاتيح التجميع · الترتيب (الأسوأ أولًا) · التولّي · الدرب */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMode, witnessPublic, FACTORY_DEFAULT_MODE, SETTINGS_KEY_DEFAULT_MODE, WITNESS_MODE_AR } from '../lib/miaar/witness';
import { HALL_TITLE, HALL_RECENT_MIN, HALL_CLAIM_HOURS, CLAIMS_KEY, GROUP_AR, keysFor, sortHall, groupHall, type HallRow } from '../lib/miaar/hall';
import { validateCreate, publicWitness } from '../lib/miaar/invites';
import { normalizeCandidate } from '../lib/miaar/registry';
import { crumbsFor } from '../lib/portal/way';
import { NON_PERSONAL_TABLES } from '../lib/vault/registry';

const row = (p: Partial<HallRow>): HallRow => ({
  session_id: p.session_id || 's', name: 'ن', email: 'n@x.sa', status: 'active', started_at: '2026-11-05T08:00:00Z', expires_at: '2026-11-05T09:00:00Z', finished_at: null, remaining_s: 600, elapsed_s: 300,
  mode: 'camera', mode_ar: 'قاعة + شاهِد', exam: 'A1', level: 'A1', section: null, invite_id: null, invite_label: null, purpose: null, classroom_id: null, classroom_label: null, client_name: null, location: null, city: null,
  report_id: null, access_code: null, integrity: null, witness: null, room_key: 'solo', room_label: 'فردي', place_key: 'p', place_label: 'مكان', ...p,
});
const wit = (level: string, camera: 'on' | 'off' | 'none' = 'on') => ({ level, level_ar: level, signals: 0, frames: 1, last_frame_at: null, last_frame_url: null, camera, counters: {}, pulse: [] });

test('م8-ب: المراقبة صفة لكل اختبار — المصنع «قاعة + شاهِد» · الجلسة تثبّت الوضع · الدعوة تتجاوز الافتراضي فقط إن حدّدت', () => {
  assert.equal(FACTORY_DEFAULT_MODE, 'camera'); assert.equal(SETTINGS_KEY_DEFAULT_MODE, 'witness_default_mode');
  assert.equal(resolveMode(null, null, 'camera'), 'camera');                           /* فردي بلا دعوة → الافتراضي */
  assert.equal(resolveMode(null, { proctor_mode: null }, 'camera'), 'camera');         /* دعوة عامة لم تحدّد → الافتراضي */
  assert.equal(resolveMode(null, { proctor_mode: 'room' }, 'camera'), 'room');         /* الدعوة حدّدت صراحةً */
  assert.equal(resolveMode({ proctor_mode: 'remote' }, { proctor_mode: 'room' }, 'camera'), 'remote'); /* المثبَّت على الجلسة يسبق الجميع */
  assert.equal(resolveMode({ proctor_mode: 'video' }, { proctor_mode: 'x' }, 'room'), 'room');
  const pub = witnessPublic({ proctor_mode: null }, 'camera'); assert.equal(pub.mode, 'camera'); assert.equal(pub.camera, true); assert.equal(pub.interval, 45); assert.equal(pub.identity, false);
  const p2 = publicWitness(witnessPublic({ proctor_mode: 'remote' }, 'camera')); assert.equal(p2.mode, 'remote'); assert.equal(p2.identity, true); assert.equal(p2.fullscreen, true);
});

test('م8-ب: الدعوة — proctor_mode فارغ = يتبع الافتراضي · «المكان» ≤ 120 · مدينة المتعلّم ≤ 60 (اختيارية — بلا IP ولا موقع)', () => {
  const base = { kind: 'group', label_ar: 'دعوة عامة', lang: 'en', exam_mode: 'adaptive' };
  const a = validateCreate({ ...base, proctor_mode: '', location: '  فرع جدة —   قاعة 2 ' }); assert.ok(a.ok); assert.equal((a as any).row.proctor_mode, undefined); assert.equal((a as any).row.location, 'فرع جدة — قاعة 2');
  const b = validateCreate({ ...base, proctor_mode: 'room', location: 'x'.repeat(200) }); assert.ok(b.ok); assert.equal((b as any).row.proctor_mode, 'room'); assert.equal((b as any).row.location.length, 120);
  const c = validateCreate({ ...base, location: '' }); assert.ok(c.ok); assert.equal((c as any).row.location, undefined);
  const cand = normalizeCandidate({ name: 'ليان', email: 'L@x.sa', city: '  المدينة   المنورة ' }); assert.equal(cand?.city, 'المدينة المنورة');
  assert.equal(normalizeCandidate({ name: 'ليان', email: 'l@x.sa' })?.city, undefined);
});

test('م8-ب: مفاتيح التجميع — القاعة (قاعة دراسية ← دعوة ← فردي) · المكان (حقل المكان ← عن بُعد + مدينة ← القاعة ← مقرّ الجهة)', () => {
  const k1 = keysFor({ invite_id: 'i1', invite_label: 'دعوة', classroom_id: 'c1', classroom_label: 'ENG-A1 · شعبة 2', client_name: null, location: null, city: null, mode: 'camera' });
  assert.equal(k1.room_key, 'c:c1'); assert.equal(k1.room_label, 'ENG-A1 · شعبة 2'); assert.equal(k1.place_label, 'ENG-A1 · شعبة 2');
  const k2 = keysFor({ invite_id: 'i2', invite_label: 'دعوة الجهة', classroom_id: null, classroom_label: null, client_name: 'شركة النور', location: 'مقرّ الرياض — الدور 3', city: null, mode: 'room' });
  assert.equal(k2.room_key, 'i:i2'); assert.equal(k2.room_label, 'الجهة: شركة النور'); assert.equal(k2.place_key, 'p:مقرّ الرياض — الدور 3');
  const k3 = keysFor({ invite_id: null, invite_label: null, classroom_id: null, classroom_label: null, client_name: null, location: null, city: 'جدة', mode: 'remote' });
  assert.equal(k3.room_key, 'solo'); assert.equal(k3.room_label, 'اختبار فردي (بلا دعوة)'); assert.equal(k3.place_label, 'عن بُعد — جدة');
  const k4 = keysFor({ invite_id: null, invite_label: null, classroom_id: null, classroom_label: null, client_name: null, location: null, city: null, mode: 'camera' });
  assert.equal(k4.place_label, 'فردي — مكان غير محدَّد');
  assert.deepEqual(Object.keys(GROUP_AR), ['single', 'room', 'place']); assert.equal(GROUP_AR.place, 'حسب الأماكن');
});

test('م8-ب: الترتيب — النشط قبل المنتهي · يستحق المراجعة ← إشارات ← هادئ · الكاميرا المنقطعة أولًا · ثم الأحدث', () => {
  const rows = [
    row({ session_id: 'calm-old', witness: wit('calm'), started_at: '2026-11-05T07:00:00Z' }),
    row({ session_id: 'done-review', status: 'finished', witness: wit('review') }),
    row({ session_id: 'review', witness: wit('review') }),
    row({ session_id: 'watch-camoff', witness: wit('watch', 'off') }),
    row({ session_id: 'watch', witness: wit('watch') }),
    row({ session_id: 'calm-new', witness: wit('calm'), started_at: '2026-11-05T08:30:00Z' }),
    row({ session_id: 'nowit' }),
  ];
  assert.deepEqual(sortHall(rows).map((r) => r.session_id), ['review', 'watch-camoff', 'watch', 'calm-new', 'nowit', 'calm-old', 'done-review']);
  const g = groupHall([row({ session_id: 'a', room_key: 'c:1', room_label: 'شعبة 1' }), row({ session_id: 'b', room_key: 'c:2', room_label: 'شعبة 2', witness: wit('review') }), row({ session_id: 'c', room_key: 'c:1', room_label: 'شعبة 1' })], 'room');
  assert.equal(g.length, 2); assert.equal(g[0].label, 'شعبة 2'); assert.equal(g[0].review, 1); assert.equal(g[1].rows.length, 2);
  assert.equal(groupHall(rows, 'single').length, 1); assert.equal(groupHall(rows, 'single')[0].label, 'كل الممتحنين');
});

test('م8-ب: الأسماء والثوابت — المركز الرسمي · 10 دقائق للمنتهين · التولّي ساعتان · الدرب · الخزنة', () => {
  assert.equal(HALL_TITLE.ar, 'مركز المراقبة الإلكترونية للاختبارات'); assert.equal(HALL_TITLE.en, 'Examination Proctoring Center');
  assert.equal(HALL_RECENT_MIN, 10); assert.equal(HALL_CLAIM_HOURS, 2); assert.equal(CLAIMS_KEY, 'hall_claims'); assert.equal(WITNESS_MODE_AR.camera, 'قاعة + شاهِد');
  const cr = crumbsFor('/admin/miaar/hall', 'ar'); assert.equal(cr[cr.length - 1].label, 'قاعة الشاهد');
  assert.ok((NON_PERSONAL_TABLES as readonly string[]).includes('miaar_settings'));
});
