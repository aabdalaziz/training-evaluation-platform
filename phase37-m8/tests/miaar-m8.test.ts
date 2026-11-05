// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م8 «شاهِد» — الأوضاع والفاصل · التحقّق من اللقطة · تنظيف meta · ملخّص المؤشّرات الثلاثي · كتلة النزاهة · ضبط الدعوة (proctor_mode) · ما يُعلَن للمتقدّم · الدرب */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WITNESS_MODES, WITNESS_MODE_AR, isWitnessMode, usesCamera, intervalFor, witnessPublic, decodeFrame, framePath, cleanMeta, integritySummary, integrityBlock, INTEGRITY, INTEGRITY_AR, isIntegrity, CLIENT_KINDS, EVENT_KINDS, FRAME_MAX_BYTES, FRAMES_MAX, RETENTION_DAYS, WITNESS_TITLE } from '../lib/miaar/witness';
import type { WitnessEvent } from '../lib/miaar/witness';
import { validateCreate } from '../lib/miaar/invites';
import { crumbsFor } from '../lib/portal/way';

const ev = (kind: WitnessEvent['kind'], at: string, meta: Record<string, any> = {}, media = false): WitnessEvent => ({ session_id: 's1', seq: 0, kind, at, media_path: media ? `witness/s1/${at}.jpg` : null, meta });
const jpeg = (bytes: number) => { const b = Buffer.alloc(bytes, 0x11); b[0] = 0xff; b[1] = 0xd8; return b.toString('base64'); };

test('م8: الأوضاع الثلاثة · الفاصل الافتراضي والمخصّص (20–90) · القاعة بلا كاميرا · العنوان الرسمي', () => {
  assert.deepEqual([...WITNESS_MODES], ['room', 'camera', 'remote']); assert.ok(isWitnessMode('remote') && !isWitnessMode('video'));
  assert.equal(usesCamera('room'), false); assert.equal(usesCamera('camera'), true); assert.equal(usesCamera('remote'), true);
  assert.equal(intervalFor('room'), 0); assert.equal(intervalFor('camera'), 45); assert.equal(intervalFor('remote'), 30); assert.equal(intervalFor('camera', 60), 60); assert.equal(intervalFor('remote', 5), 30); assert.equal(intervalFor('remote', 120), 30);
  assert.equal(WITNESS_MODE_AR.camera, 'قاعة + شاهِد'); assert.equal(WITNESS_TITLE.ar, 'سجلّ نزاهة الاختبار — مراقبة مصوَّرة'); assert.equal(RETENTION_DAYS, 90);
  const pub = witnessPublic({ proctor_mode: 'remote', witness_interval: 25 }); assert.equal(pub.camera, true); assert.equal(pub.identity, true); assert.equal(pub.fullscreen, true); assert.equal(pub.interval, 25);
  const room = witnessPublic({ proctor_mode: null }); assert.equal(room.mode, 'room'); assert.equal(room.camera, false); assert.equal(room.identity, false);
});

test('م8: اللقطة — JPEG صغيرة فقط (≤ 16 KB · رأس FFD8) · مسار المخزن · حدود اللقطات', () => {
  assert.equal(decodeFrame('').ok, false); assert.equal((decodeFrame('not-base64!!') as any).error, 'frame_bad');
  const png = Buffer.alloc(900, 1); png[0] = 0x89; assert.equal((decodeFrame(png.toString('base64')) as any).error, 'frame_not_jpeg');
  const ok = decodeFrame('data:image/jpeg;base64,' + jpeg(9000)); assert.ok(ok.ok && ok.buf.length === 9000);
  assert.equal((decodeFrame(jpeg(FRAME_MAX_BYTES + 10)) as any).error, 'frame_too_big'); assert.equal((decodeFrame(jpeg(100)) as any).error, 'frame_bad');
  assert.equal(framePath('abc', 7, 'frame'), 'witness/abc/0007-frame.jpg'); assert.ok(FRAMES_MAX >= 120);
  assert.ok(CLIENT_KINDS.includes('frame') && !CLIENT_KINDS.includes('whisper') && !CLIENT_KINDS.includes('verdict')); assert.ok(EVENT_KINDS.includes('whisper'));
});

test('م8: تنظيف meta — مفاتيح لاتينية قصيرة · أرقام ونصوص قصيرة · 8 كحدّ أقصى', () => {
  const m = cleanMeta({ seconds: 12.3456, section: 'test', ok: true, bad_key$: 1, nested: { a: 1 }, long: 'x'.repeat(200), a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
  assert.equal(m.seconds, 12.35); assert.equal(m.section, 'test'); assert.equal(m.ok, true); assert.ok(!('bad_key$' in m) && !('nested' in m)); assert.equal(String(m.long).length, 80); assert.ok(Object.keys(m).length <= 8);
  assert.deepEqual(cleanMeta(null), {}); assert.deepEqual(cleanMeta('x'), {});
});

test('م8: ملخّص المؤشّرات — هادئ / إشارات / يستحق المراجعة · عدّ اللقطات · ثواني المغادرة · الأسباب بالعربية', () => {
  const calm = integritySummary([ev('frame', '2026-11-05T08:00:00Z', {}, true), ev('frame', '2026-11-05T08:01:00Z', {}, true), ev('section_start', '2026-11-05T08:00:01Z', { section: 'test' }, true)]);
  assert.equal(calm.level, 'calm'); assert.equal(calm.frames, 3); assert.equal(calm.signals, 0); assert.equal(calm.sections, 1); assert.equal(calm.last_frame_at, '2026-11-05T08:01:00Z');
  const watch = integritySummary([ev('frame', '2026-11-05T08:00:00Z', {}, true), ev('tab_hidden', '2026-11-05T08:02:00Z', { seconds: 8 }, true), ev('focus_lost', '2026-11-05T08:03:00Z', { seconds: 3 })]);
  assert.equal(watch.level, 'watch'); assert.equal(watch.tab_hidden, 1); assert.equal(watch.hidden_seconds, 8); assert.equal(watch.signals, 2); assert.equal(watch.level_ar, 'إشارات');
  const review = integritySummary([ev('tab_hidden', '2026-11-05T08:02:00Z', { seconds: 40 }), ev('tab_hidden', '2026-11-05T08:04:00Z', { seconds: 30 }), ev('screen_extended', '2026-11-05T08:00:00Z')]);
  assert.equal(review.level, 'review'); assert.equal(review.hidden_seconds, 70); assert.ok(review.reasons_ar.some((r) => r.includes('70 ثانية'))); assert.ok(review.reasons_ar.some((r) => r.includes('شاشة ثانية')));
  const cam = integritySummary([ev('camera_lost', '2026-11-05T08:00:00Z', { reason: 'dark' }), ev('camera_lost', '2026-11-05T08:01:00Z'), ev('camera_lost', '2026-11-05T08:02:00Z')]); assert.equal(cam.level, 'review'); assert.equal(cam.camera_lost, 3);
  assert.equal(integritySummary([]).level, 'calm'); assert.equal(integritySummary([]).first_at, null);
});

test('م8: كتلة النزاهة للبطاقة — الحالات الأربع · الملاحظة تظهر فقط لملاحظة/لاغٍ · لا كتلة بلا مراقبة', () => {
  assert.deepEqual([...INTEGRITY], ['pending', 'clear', 'note', 'invalid']); assert.equal(INTEGRITY_AR.invalid, 'لاغٍ'); assert.ok(isIntegrity('clear') && !isIntegrity('ok'));
  assert.equal(integrityBlock({ integrity_status: null }), null); assert.equal(integrityBlock(null), null);
  const p = integrityBlock({ integrity_status: 'pending' }); assert.equal(p?.الحالة, 'pending'); assert.equal(p?.الحالة_ar, 'قيد المراجعة'); assert.equal(p?.ملاحظة, null); assert.equal(p?.مصوَّرة, true);
  const c = integrityBlock({ integrity_status: 'clear', integrity_note: 'سرّي' }); assert.equal(c?.ملاحظة, null);
  const iv = integrityBlock({ integrity_status: 'invalid', integrity_note: 'شخص ثانٍ في الإطار', integrity_at: '2026-11-05T09:00:00Z' }); assert.equal(iv?.ملاحظة, 'شخص ثانٍ في الإطار'); assert.equal(iv?.status_en, 'Annulled'); assert.equal(iv?.في, '2026-11-05T09:00:00Z');
});

test('م8: ضبط الدعوة — proctor_mode يُقبل camera/remote فقط (room افتراضيًا) · الفاصل 20–90 · الدرب إلى غرفة الشاهد', () => {
  const base = { kind: 'group', label_ar: 'اختبار نهاية المستوى A1', lang: 'ar', exam_mode: 'comprehensive', blueprint_id: '00000000-0000-0000-0000-00000000f010', purpose: 'level_exit' } as any;
  const a = validateCreate({ ...base, proctor_mode: 'remote', witness_interval: 30 }); assert.ok(a.ok); assert.equal((a as any).row.proctor_mode, 'remote'); assert.equal((a as any).row.witness_interval, 30);
  const b = validateCreate({ ...base, proctor_mode: 'video', witness_interval: 5 }); assert.ok(b.ok); assert.equal((b as any).row.proctor_mode, undefined); assert.equal((b as any).row.witness_interval, undefined);
  const c = validateCreate({ ...base, proctor_mode: 'camera' }); assert.ok(c.ok); assert.equal((c as any).row.proctor_mode, 'camera');
  const cr = crumbsFor('/admin/miaar/witness', 'ar'); assert.equal(cr[cr.length - 1].label, 'غرفة الشاهد'); assert.equal(crumbsFor('/admin/miaar/witness', 'en').slice(-1)[0].label, 'Witness room');
});
