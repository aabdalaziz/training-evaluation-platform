// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P13-ج: القناة الواحدة (تحقق الوسائط، اختيار الترميز، درجة النص المفرَّغ، دليل الأداء المُشاهَد 0.6→0.85) · غرف أَثَر الصغيرة (الرموز، التوزيع الثابت، قاعدة من يبدأ العرض، المؤقت)
import test from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_LIMITS, pickMime, VIDEO_MIME_CANDIDATES, baseMime, extFor, kindFor, validateMedia, mediaPath, mediaEvidenceEvent, transcriptScore, wordCount, fmtDuration, roomCode, isRoomCode, roomUrl, hashStr, assignRoom, roomCountFor, shouldOffer, roomTimeLeft, ROOM_DEFAULT_PROMPT } from '../lib/portal/media';
import type { MediaRow } from '../lib/portal/media';
import { evidenceFromEvent, EVIDENCE_WEIGHT, MEDIA_APPROVED_WEIGHT, computeSkillLevels } from '../lib/portal/profile';

const SKILL = '11111111-1111-4111-8111-111111111111';
const meta = new Map([[SKILL, { level: 3, code: 'ATH-X-001' }]]);
const row = (over: Partial<MediaRow> = {}): MediaRow => ({ id: '22222222-2222-4222-8222-222222222222', user_id: 'u1', email: 'a@b.c', kind: 'video', duration_sec: 45, transcript: 'أولًا أتحدث مع الزميل ثم أتحقق من النتائج، ولن أفوّض الوكيل في الشكاوى.', context_type: 'daily_case', context_id: '2026-10-28', skill_ids: [SKILL], title: 'تفويض مفتوح', status: 'uploaded', ...over });

test('P13-ج · الوسائط: الحدود والتحقق من النوع والحجم والمدة', () => {
  assert.equal(MEDIA_LIMITS.maxSeconds, 90, 'الحد 90 ثانية'); assert.equal(MEDIA_LIMITS.retentionDays, 180, 'الاحتفاظ 180 يومًا');
  assert.equal(baseMime('video/webm;codecs=vp8,opus'), 'video/webm', 'النوع الأساسي بلا codecs');
  assert.equal(extFor('video/mp4'), 'mp4', 'امتداد mp4'); assert.equal(extFor('audio/mp4'), 'm4a', 'امتداد m4a'); assert.equal(extFor('video/webm;codecs=vp9'), 'webm', 'امتداد webm');
  assert.equal(kindFor('audio/ogg'), 'audio', 'صوت'); assert.equal(kindFor('video/quicktime'), 'video', 'فيديو');
  const ok = validateMedia({ mime: 'video/webm;codecs=vp8,opus', bytes: 500000, duration_sec: 60, context_type: 'daily_case' }); assert.ok(ok.ok, 'ملف صالح يمرّ'); if (ok.ok) { assert.equal(ok.kind, 'video', 'نوعه فيديو'); assert.equal(ok.ext, 'webm', 'امتداده webm'); }
  assert.ok(!validateMedia({ mime: 'image/png', bytes: 100, duration_sec: 1 }).ok, 'الصور مرفوضة هنا');
  assert.ok(!validateMedia({ mime: 'video/webm', bytes: MEDIA_LIMITS.maxBytes + 1, duration_sec: 10 }).ok, 'الحجم الزائد مرفوض');
  assert.ok(!validateMedia({ mime: 'video/webm', bytes: 1000, duration_sec: 120 }).ok, 'المدة الزائدة مرفوضة');
  assert.ok(!validateMedia({ mime: 'video/webm', bytes: 1000, duration_sec: 10, context_type: 'weird' }).ok, 'السياق المجهول مرفوض');
  assert.equal(mediaPath('u1', 'm1', 'webm'), 'u1/m1.webm', 'مسار التخزين تحت مجلد المستخدم');
});

test('P13-ج · اختيار ترميز التسجيل: أول نوع يدعمه المتصفح، أو null', () => {
  assert.equal(pickMime(VIDEO_MIME_CANDIDATES, m => m.startsWith('video/mp4')), 'video/mp4;codecs=avc1,mp4a.40.2', 'Safari → mp4');
  assert.equal(pickMime(VIDEO_MIME_CANDIDATES, m => m === 'video/webm'), 'video/webm', 'webm العام');
  assert.equal(pickMime(VIDEO_MIME_CANDIDATES, () => false), null, 'لا دعم → null');
  assert.equal(pickMime(VIDEO_MIME_CANDIDATES, () => { throw new Error('x'); }), null, 'استثناء المتصفح لا يكسر');
});

test('P13-ج · درجة النص المفرَّغ: شفافة ومرتبطة بالخطوات والأطراف والتحقق وما لن يُفعل', () => {
  const good = transcriptScore('أولًا أجتمع مع الزميل والفريق وأشرح لهم أن المتدربين يستحقون ردًّا بشريًا في الشكاوى. ثم أضع حدودًا: الوكيل يردّ على الأسئلة الإجرائية فقط، ولن أفوّضه في طلبات الاسترداد. بعد ذلك أتابع عينة أسبوعية من الردود وأتحقق من مؤشر الرضا، وأخيرًا أراجع القرار بعد شهر مع الفريق كله.', ['الزميل', 'الفريق', 'المتدربون']);
  assert.ok(good.score >= 80, `ردّ كامل يحصل على درجة عالية (${good.score})`); assert.equal(good.notes_ar.length, 0, 'بلا ملاحظات');
  const weak = transcriptScore('أوافق.', ['الزميل']); assert.ok(weak.score <= 15, `ردّ قصير درجة منخفضة (${weak.score})`); assert.ok(weak.notes_ar.length >= 4, 'ملاحظات تطويرية واضحة');
  assert.equal(wordCount('  كلمة   أخرى  '), 2, 'عدّ الكلمات'); assert.equal(fmtDuration(75), '1:15', 'تنسيق المدة'); assert.equal(fmtDuration(0), '0:00', 'صفر');
});

test('P13-ج · دليل الأداء المُشاهَد في التوأم المهاري: 0.6 عند الرفع · 0.85 بعد الاعتماد · يُستبعد عند الرفض', () => {
  assert.equal(EVIDENCE_WEIGHT.media, 0.6, 'وزن الرفع'); assert.equal(MEDIA_APPROVED_WEIGHT, 0.85, 'وزن الاعتماد');
  const ev = mediaEvidenceEvent(row(), 72, '2026-10-28T09:00:00Z'); assert.equal(ev.verb, 'assessed', 'الفعل'); assert.equal(ev.object_type, 'media', 'النوع'); assert.deepEqual(ev.skills, [SKILL], 'المهارات');
  const up = evidenceFromEvent(ev, meta); assert.equal(up.length, 1, 'دليل واحد للمهارة'); assert.equal(up[0].e.kind, 'media', 'نوعه media'); assert.equal(up[0].e.weight, 0.6, 'وزن 0.6'); assert.equal(up[0].e.level, 3, '72% → المستوى الأساسي'); assert.ok(up[0].e.label?.includes('فيديو'), 'الوسم يذكر الفيديو');
  const ap = evidenceFromEvent(mediaEvidenceEvent(row({ status: 'approved' }), 90), meta); assert.equal(ap[0].e.weight, 0.85, 'بعد الاعتماد 0.85'); assert.equal(ap[0].e.level, 4, '90% → مستوى أعلى');
  const rj = evidenceFromEvent(mediaEvidenceEvent(row({ status: 'rejected' }), 90), meta); assert.equal(rj.length, 0, 'المرفوض لا يدخل الحساب');
  const levels = computeSkillLevels('u1', [mediaEvidenceEvent(row({ status: 'approved' }), 90, '2026-10-28T09:00:00Z')], meta, new Date('2026-10-29T00:00:00Z'));
  assert.equal(levels.length, 1, 'مستوى واحد'); assert.equal(levels[0].computed_level, 4, 'المستوى المحسوب 4'); assert.ok(levels[0].confidence > 0, 'ثقة موجبة');
  const noScore = evidenceFromEvent(mediaEvidenceEvent(row({ transcript: null }), null), meta); assert.equal(noScore[0].e.level, 3, 'بلا نص → المستوى الأساسي');
});

test('P13-ج · غرف أَثَر: رمز من 6 حروف بلا التباس، رابط، وتحقق', () => {
  for (let i = 0; i < 200; i++) { const c = roomCode(); assert.ok(isRoomCode(c), `رمز صالح ${c}`); assert.ok(!/[O0I1]/.test(c), `بلا O/0/I/1: ${c}`); }
  let k = 0; const seq = [0, 0.5, 0.99, 0.25, 0.75, 0.1]; assert.equal(roomCode(() => seq[k++ % seq.length]), 'AS9J2D', 'حتمي مع مولّد ثابت');
  assert.ok(isRoomCode('ar9hv4'), 'يقبل الأحرف الصغيرة'); assert.ok(!isRoomCode('ABC'), 'قصير مرفوض'); assert.ok(!isRoomCode('ABCO12'), 'حروف ملتبسة مرفوضة');
  assert.equal(roomUrl('https://athar-portal.vercel.app/', 'AR9HV4'), 'https://athar-portal.vercel.app/room/AR9HV4', 'رابط الغرفة');
});

test('P13-ج · توزيع ثابت على الغرف + عدد الغرف + من يبدأ العرض + المؤقت', () => {
  const rooms = [{ code: 'AAAAAA' }, { code: 'BBBBBB' }, { code: 'CCCCCC' }];
  const a1 = assignRoom('user-1', rooms); const a2 = assignRoom('user-1', rooms); assert.ok(a1 && a2 && a1.code === a2.code, 'نفس الشخص → نفس الغرفة');
  const spread = new Set(Array.from({ length: 60 }, (_, i) => assignRoom(`u${i}`, rooms)!.code)); assert.equal(spread.size, 3, '60 شخصًا يتوزعون على الغرف الثلاث');
  assert.equal(assignRoom('x', []), null, 'بلا غرف → null'); assert.equal(hashStr('abc'), hashStr('abc'), 'تجزئة حتمية'); assert.notEqual(hashStr('abc'), hashStr('abd'), 'تجزئة حساسة');
  assert.equal(roomCountFor(0), 1, 'لا أحد → غرفة واحدة'); assert.equal(roomCountFor(9), 3, '9 → 3 غرف'); assert.equal(roomCountFor(10), 4, '10 → 4 غرف'); assert.equal(roomCountFor(500), 12, 'سقف 12');
  assert.ok(shouldOffer('a', 'b'), 'الأصغر يبدأ'); assert.ok(!shouldOffer('b', 'a'), 'الأكبر ينتظر'); assert.ok(shouldOffer('a', 'b') !== shouldOffer('b', 'a'), 'طرف واحد فقط يبدأ');
  const r = { created_at: '2026-10-28T10:00:00Z', minutes: 5 }; assert.equal(roomTimeLeft(r, Date.parse('2026-10-28T10:02:00Z')), 180, 'بقي 3 دقائق'); assert.equal(roomTimeLeft(r, Date.parse('2026-10-28T10:09:00Z')), 0, 'لا سالب');
  assert.ok(ROOM_DEFAULT_PROMPT.breakout.includes('سطر واحد'), 'سؤال الغرفة الافتراضي يطلب سطرًا واحدًا');
});
