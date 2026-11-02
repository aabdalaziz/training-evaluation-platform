// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** مِعيار م4-ب «غرفة الأداء» — المنطق الخالص: اختيار المهام بمستوى المتقدّم، تحقّق الكتابة/التحدّث، كتلة التقرير، التقدير البشري، المستوى العام */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taskItemFrom, publicTask, targetLevels, pickTasks, validateWriting, validateSpeaking, productiveBlock, humanRatingFrom, overallWithProductive, mediaPathFor, isAccommodation, AUDIO_MAX_BYTES } from '../lib/miaar/performance';
import { levelFromReport, PRODUCTIVE_KEY } from '../lib/miaar/room';
import { parseCommand } from '../lib/portal/voice';

const row = (code: string, level: string, skill: 'writing' | 'speaking', extra: Record<string, unknown> = {}) => ({ id: `id-${code}`, item_code: code, level, skill, question_text: `مهمة ${code} — اكتب أو تحدّث`, item_type: `${skill}_task`, task: { genre: 'email', prompt_en: 'Write an email', tips_ar: ['ابدأ بتحية'], sample_ar: 'إجابة نموذجية سرّية', ...extra }, media_path: null, media_alt: null, descriptor_code: null });
const bank = [row('AR-WR-A1-001', 'A1', 'writing'), row('AR-WR-A1-002', 'A1', 'writing'), row('AR-WR-B1-001', 'B1', 'writing'), row('AR-SP-A2-001', 'A2', 'speaking'), row('AR-SP-B2-001', 'B2', 'speaking'), row('AR-WR-PRE-001', 'PRE_A1', 'writing')].map((r) => taskItemFrom(r)!).filter(Boolean);

test('م4-ب: صفّ البنك → مهمة؛ الناقص يُرفض؛ النسخة العامة بلا إجابة نموذجية', () => {
  assert.equal(bank.length, 6); assert.equal(taskItemFrom({ ...row('X', 'A1', 'writing'), question_text: '' }), null, 'بلا نصّ'); assert.equal(taskItemFrom({ ...row('X', 'Z9', 'writing') }), null, 'مستوى غير صالح'); assert.equal(taskItemFrom({ ...row('X', 'A1', 'writing'), task: { genre: 'BAD GENRE' } }), null, 'مهمة غير صالحة');
  const p = publicTask(bank[0]) as any; assert.equal(p.sample_ar, undefined, 'الإجابة النموذجية لا تُرسل'); assert.equal(p.min_words, 20, 'حدود A1 الافتراضية'); assert.equal(p.time_seconds, 480);
});
test('م4-ب: المستويات المرشّحة والاختيار الثابت بالبذرة', () => {
  assert.deepEqual(targetLevels('B1'), ['B1', 'A2', 'B2']); assert.deepEqual(targetLevels('PRE_A1'), ['PRE_A1', 'A1']); assert.deepEqual(targetLevels('C2'), ['C2', 'C1']); assert.deepEqual(targetLevels('??'), ['A1', 'PRE_A1', 'A2']);
  const a = pickTasks(bank, 'A1', 'session-1'); assert.equal(a.picked.length, 2); assert.equal(a.picked[0].skill, 'writing'); assert.equal(a.picked[0].level, 'A1'); assert.equal(a.picked[1].skill, 'speaking'); assert.equal(a.picked[1].level, 'A2', 'لا تحدّث A1 → الأقرب A2');
  const b = pickTasks(bank, 'A1', 'session-1'); assert.deepEqual(b.picked.map((t) => t.code), a.picked.map((t) => t.code), 'البذرة نفسها → المهمة نفسها');
  const codes = new Set(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((s) => pickTasks(bank, 'A1', s).picked[0].code)); assert.equal(codes.size, 2, 'بذور مختلفة توزّع بين مهمتَي A1');
  const c1 = pickTasks(bank, 'C1', 'x'); assert.equal(c1.picked.length, 1, 'C1: لا كتابة قريبة (B2 لا يوجد، C2 لا يوجد) → التحدّث B2 فقط'); assert.equal(c1.picked[0].code, 'AR-SP-B2-001');
  assert.equal(pickTasks(bank, 'A1', 'x', ['speaking']).picked.length, 1, 'مهارة واحدة مطلوبة');
});
test('م4-ب: تحقّق الكتابة والتحدّث', () => {
  const task = publicTask(bank[0]); const ar = (n: number) => Array.from({ length: n }, (_, i) => ['أنا', 'أدرس', 'العربية', 'في', 'الجامعة', 'كل', 'يوم'][i % 7]).join(' ');
  assert.equal(validateWriting(task, '').ok, false); assert.equal((validateWriting(task, 'hello world this is english only text') as any).error, 'not_arabic');
  const ok = validateWriting(task, ar(30)); assert.ok(ok.ok && ok.words === 30 && ok.length === 'ok', 'ضمن المدى');
  const short = validateWriting(task, ar(5)); assert.ok(short.ok && short.length === 'short', 'القصير يُقبل ويُعلَّم');
  assert.equal((validateWriting(task, ar(80)) as any).error, 'over_limit', '40×1.6 = 64 → 80 مرفوض');
  const sp = publicTask(bank[3]);
  assert.equal((validateSpeaking(sp, { mime: 'video/mp4', bytes: 1000, duration_sec: 30 }) as any).error, 'bad_mime');
  assert.equal((validateSpeaking(sp, { mime: 'audio/webm;codecs=opus', bytes: AUDIO_MAX_BYTES + 1, duration_sec: 30 }) as any).error, 'too_big');
  assert.equal((validateSpeaking(sp, { mime: 'audio/webm', bytes: 1000, duration_sec: 120 }) as any).error, 'over_limit', 'A2 سقفه 60 ث (+5 سماحية)');
  const good = validateSpeaking(sp, { mime: 'audio/webm;codecs=opus', bytes: 40000, duration_sec: 32 }); assert.ok(good.ok && good.ext === 'webm' && good.mime === 'audio/webm' && good.length === 'ok');
  assert.ok(isAccommodation('typed_instead_of_speaking') && !isAccommodation('x')); assert.match(mediaPathFor('abc', 'speaking', 'webm'), /^performances\/abc\/speaking-\d+\.webm$/);
});
test('م4-ب: كتلة التقرير — قيد التصحيح · معتمد · لم تُقدَّم، بلا أسماء', () => {
  assert.equal(productiveBlock([]), null);
  const pending = productiveBlock([{ skill: 'writing', status: 'submitted', item_code: 'AR-WR-A1-001', level_target: 'A1', word_count: 33 }, { skill: 'speaking', status: 'skipped', item_code: 'AR-SP-A2-001', level_target: 'A2' }]) as any;
  assert.equal(pending.الحالة, 'قيد التصحيح'); assert.ok(pending.الوعد.includes('48 ساعة')); assert.equal(pending.الكتابة.الحالة, 'قيد التصحيح'); assert.equal(pending.الكتابة.عدد_الكلمات, 33); assert.equal(pending.التحدّث.الحالة, 'لم تُقدَّم'); assert.equal(pending.الكتابة.المستوى_المقدر, undefined, 'لا درجة قبل الإصدار');
  const hr = humanRatingFrom('writing', 'A1', { range: 3, accuracy: 4, coherence: 3, task: 3 }, '  أحسنت التحية والختام؛ انتبه للتاء المربوطة. ')!;
  assert.ok(hr && hr.estimated === 'A1' && hr.verdict_ar.length > 3 && hr.note_ar === 'أحسنت التحية والختام؛ انتبه للتاء المربوطة.');
  assert.equal(humanRatingFrom('writing', 'A1', { range: 3 }, null), null, 'أبعاد ناقصة'); assert.equal(humanRatingFrom('writing', 'A1', { range: 9, accuracy: 4, coherence: 3, task: 3 }, null), null, 'خارج السُّلّم');
  const rel = productiveBlock([{ skill: 'writing', status: 'released', item_code: 'AR-WR-A1-001', level_target: 'A1', word_count: 33, human_rating: hr, released_at: '2026-11-03T00:00:00Z' }]) as any;
  assert.equal(rel.الحالة, 'مكتمل'); assert.equal(rel.الوعد, null); assert.equal(rel.الكتابة.الحالة, 'معتمد'); assert.equal(rel.الكتابة.المستوى_المقدر, 'A1'); assert.equal(rel.الكتابة.الأبعاد['المدى اللغوي'], 3); assert.ok(rel.الكتابة.ما_قاله_المصحح.includes('أحسنت'));
  assert.equal(JSON.stringify(rel).includes('@'), false, 'لا بريد في الكتلة');
  const acc = productiveBlock([{ skill: 'speaking', status: 'submitted', item_code: 'X', level_target: 'A2', accommodation: 'typed_instead_of_speaking' }]) as any; assert.equal(acc.التحدّث.تيسير, 'كتب بدل أن يتحدّث');
});
test('م4-ب: المستوى العام مع الإنتاجي، ومستوى الغرفة من التقرير', () => {
  assert.equal(overallWithProductive('B2', []), 'B2'); assert.equal(overallWithProductive('B2', ['B1']), 'B2', 'فرق درجة واحدة لا يغيّر'); assert.equal(overallWithProductive('B2', ['A2', 'B1']), 'A2', 'فرق درجتين → الأدنى'); assert.equal(overallWithProductive('A1', ['C1']), 'A1', 'الإنتاجي الأعلى لا يرفع');
  assert.equal(levelFromReport({ ملخص_التسكين: { المستوى_المثبت: 'B1' } }), 'B1'); assert.equal(levelFromReport({ المستوى_العام: 'A2' }), 'A2'); assert.equal(levelFromReport({ المستوى_العام: 'ما قبل A1' }), 'PRE_A1'); assert.equal(levelFromReport(null), 'A1'); assert.equal(PRODUCTIVE_KEY, 'المهارات_الإنتاجية');
  assert.equal(parseCommand('افتح غرفة التصحيح', { admin: true }).kind, 'go', 'نادِ يعرف غرفة التصحيح');
});
