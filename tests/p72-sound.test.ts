// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P72 «ضبط الصوت» + «أول محاضرة» — القياسات الخالصة (إطار · تنبيه حيّ · قراءة ما بعد التسجيل · PCM كامل · التخزين الرقمي) + شكل المصدر: المسجّلات الستّة تحمل العدّاد، والممرّ يحمل «قالوا يوم دخلوا» أول أسبوع. القاعدتان 28–29. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripDataUrl } from '../lib/portal/media';
import { METER, meterFrame, bytesToSamples, levelHint, levelBar, takeQuality, analyzePcm, qualityMeta, parseQualityMeta, qualityLineAr, LEVEL_AR, MIC_CHECK } from '../lib/portal/audio-meter';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const sine = (sec: number, rate: number, amp: number, hz = 220) => { const n = Math.round(sec * rate); const out = new Float32Array(n); for (let i = 0; i < n; i += 1) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate); return out; };
const silence = (sec: number, rate: number) => new Float32Array(Math.round(sec * rate));
const concat = (...xs: Float32Array[]) => { const out = new Float32Array(xs.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of xs) { out.set(x, o); o += x.length; } return out; };
const frames = (n: number, rms: number, peak = rms * 1.4) => Array.from({ length: n }, () => ({ rms, peak }));

test('P72-أ: إطار — rms وذروة؛ بايتات المحلّل تتحوّل إلى عيّنات حول الصفر', () => {
  assert.deepEqual(meterFrame([]), { rms: 0, peak: 0 });
  const f = meterFrame([0.5, -0.5, 0.5, -0.5]); assert.equal(f.rms, 0.5); assert.equal(f.peak, 0.5);
  const s = bytesToSamples([128, 255, 0, 128]); assert.equal(s[0], 0); assert.ok(s[1] > 0.99 && s[2] < -0.99);
  assert.equal(meterFrame(bytesToSamples(new Array(512).fill(128))).rms, 0);
});

test('P72-أ: التنبيه الحيّ — صامت/خافت/جيد/مرتفع، والشريط لوغاريتمي 0..1', () => {
  assert.equal(levelHint(0.001, 0.002), 'silent'); assert.equal(levelHint(0.01, 0.02), 'quiet'); assert.equal(levelHint(0.1, 0.3), 'ok'); assert.equal(levelHint(0.5, 0.99), 'loud');
  assert.equal(levelBar(0), 0); assert.equal(levelBar(1), 1); assert.ok(levelBar(0.05) > 0.3 && levelBar(0.05) < 0.8);
  assert.equal(LEVEL_AR.ok, null); assert.match(LEVEL_AR.quiet!, /اقترب/); assert.match(LEVEL_AR.silent!, /الميكروفون/);
});

test('P72-أ: قراءة ما بعد التسجيل — الأحكام الخمسة والاقتراح لا المنع', () => {
  const ok = takeQuality(frames(100, 0.08), 10); assert.equal(ok.verdict, 'ok'); assert.equal(ok.suggest_redo, false); assert.equal(ok.voiced_sec, 10); assert.equal(ok.hint_ar, null);
  const empty = takeQuality(frames(100, 0.001), 10); assert.equal(empty.verdict, 'empty'); assert.equal(empty.level, 'silent'); assert.ok(empty.suggest_redo); assert.match(empty.hint_ar!, /أعد التسجيل؟/);
  const mostly = takeQuality([...frames(20, 0.08), ...frames(80, 0.001)], 10); assert.equal(mostly.verdict, 'mostly_silent'); assert.equal(mostly.voiced_sec, 2); assert.equal(mostly.silent_ratio, 0.8); assert.match(mostly.hint_ar!, /المسموع 2 ث/);
  const quiet = takeQuality(frames(100, 0.012), 10); assert.equal(quiet.verdict, 'quiet'); assert.equal(quiet.level, 'quiet');
  const clipped = takeQuality(frames(100, 0.4, 0.995), 10); assert.equal(clipped.verdict, 'clipped'); assert.equal(clipped.level, 'loud'); assert.equal(clipped.peak, 1);
  const unknown = takeQuality([], 10); assert.equal(unknown.verdict, 'unknown'); assert.equal(unknown.suggest_redo, false); assert.equal(qualityMeta(unknown), null);
  assert.equal(takeQuality(frames(10, 0.08), 0).verdict, 'unknown');
});

test('P72-أ: PCM كامل (اصطناعي) — جملة ثم صمت، صمت تام، إشارة قاطعة', () => {
  const rate = 16000;
  const speech = analyzePcm(concat(silence(0.5, rate), sine(2, rate, 0.3), silence(0.5, rate)), rate); assert.equal(speech.verdict, 'ok'); assert.ok(speech.voiced_sec >= 1.8 && speech.voiced_sec <= 2.2, String(speech.voiced_sec)); assert.ok(Math.abs(speech.peak - 0.3) < 0.02);
  const dead = analyzePcm(silence(3, rate), rate); assert.equal(dead.verdict, 'empty');
  const half = analyzePcm(concat(sine(1, rate, 0.3), silence(9, rate)), rate); assert.equal(half.verdict, 'mostly_silent'); assert.equal(half.voiced_sec, 1);
  const hot = analyzePcm(sine(2, rate, 1.0), rate); assert.equal(hot.verdict, 'clipped');
  const whisper = analyzePcm(sine(2, rate, 0.015), rate); assert.equal(whisper.verdict, 'quiet');
});

test('P72-أ: التخزين الرقمي — رقمان وكلمة فقط، ورفض الشاذّ؛ وسطر المقيِّم لا يدخل الدرجة', () => {
  const m = qualityMeta(takeQuality(frames(50, 0.08, 0.31), 5)); assert.deepEqual(m, { voiced_sec: 5, peak: 0.31, level: 'ok' });
  assert.deepEqual(parseQualityMeta({ voiced_sec: '4.26', peak: 0.5, level: 'ok' }), { voiced_sec: 4.3, peak: 0.5, level: 'ok' });
  for (const bad of [null, 'x', { voiced_sec: -1, peak: 0.5, level: 'ok' }, { voiced_sec: 5, peak: 2, level: 'ok' }, { voiced_sec: 5, peak: 0.5, level: 'great' }, { voiced_sec: 9999, peak: 0.5, level: 'ok' }]) assert.equal(parseQualityMeta(bad), null);
  assert.equal(qualityLineAr(null), null); const line = qualityLineAr({ voiced_sec: 3.5, peak: 0.2, level: 'quiet' }, 12)!; assert.match(line, /المسموع 3\.5 ث من 12/); assert.match(line, /خافت/); assert.match(line, /لا تدخل الدرجة/);
  assert.equal(MIC_CHECK.seconds, 3); assert.equal(METER.frameMs, 100);
});

test('P72-أ: شكل المصدر — المسجّل المشترك ومِعيار وسطر الدخول تحمل العدّاد؛ الخادم يقبل رقمين فقط؛ المقيِّم يقرأ في جهازه', () => {
  const vr = read('app/components/VoiceRecorder.tsx'); assert.match(vr, /useAudioMeter/); assert.match(vr, /<LevelBar/); assert.match(vr, /<QualityNote/); assert.match(vr, /quality\?: TakeQuality \| null/); assert.match(vr, /AUDIO_METER_CSS/);
  const am = read('app/components/AudioMeter.tsx'); assert.match(am, /createAnalyser/); assert.match(am, /getByteTimeDomainData/); assert.match(am, /data-testid=\{`\$\{testid\}-quality-redo`\}/); assert.match(am, /localStorage\.setItem\(MIC_CHECK\.storageKey/); assert.doesNotMatch(am, /fetch\(/, 'لا يرسل العدّاد شيئًا إلى الخادم');
  const pr = read('app/miaar/PerformanceRoom.tsx'); assert.match(pr, /<MicCheck ar=\{ar\} onDone/); assert.match(pr, /testid="room" \/>/); assert.match(pr, /onRedo=\{takes < \(task\.retakes \?\? 1\) \? retake : undefined\}/, 'إعادة التسجيل من التنبيه تحترم حدّ الإعادة الواحدة');
  const el = read('app/miaar/EntryLine.tsx'); assert.match(el, /qualityMeta\(q\)/); assert.match(el, /testid="mi-why" \/>/);
  const en = read('lib/first/entry.ts'); assert.match(en, /parseQualityMeta\(b\.quality\)/); const ep = read('lib/first/entry-pure.ts'); assert.match(ep, /quality\?: \{ voiced_sec: number; peak: number; level: string \} \| null/);
  const rt = read('app/admin/miaar/Rating.tsx'); assert.match(rt, /decodeAudioData/); assert.match(rt, /data-testid="rt-quality"/); assert.match(rt, /analyzePcm\(a\.getChannelData\(0\), a\.sampleRate\)/);
  const lib = read('lib/portal/audio-meter.ts'); assert.doesNotMatch(lib, /from\(|fetch\(|openai|gemini/i, 'المكتبة خالصة: لا قاعدة ولا شبكة ولا ذكاء اصطناعي');
});

test('P72-أ (إصلاح حيّ): data-URL من Chrome `audio/webm;codecs=opus` يُقشَر صحيحًا — النمط القديم كان يترك 15 بايت تالفة', () => {
  const payload = Buffer.from('hello voice').toString('base64');
  assert.equal(stripDataUrl(`data:audio/webm;codecs=opus;base64,${payload}`), payload); assert.equal(stripDataUrl(`data:audio/mp4;base64,${payload}`), payload); assert.equal(stripDataUrl(payload), payload); assert.equal(stripDataUrl(undefined), '');
  assert.equal(Buffer.from(stripDataUrl(`data:audio/webm;codecs=opus;base64,${payload}`), 'base64').toString(), 'hello voice');
  const legacy = `data:audio/webm;codecs=opus;base64,${payload}`.replace(/^data:[^;]+;base64,/, ''); assert.notEqual(Buffer.from(legacy, 'base64').toString(), 'hello voice', 'النمط القديم يفشل مع codecs');
  for (const f of ['lib/first/entry.ts', 'lib/miaar/room.ts']) { const src = read(f); assert.match(src, /stripDataUrl\(/, f); assert.doesNotMatch(src, /\[\^;\]\+;base64,/, f); }
});

test('P72-ب: شكل المصدر — الممرّ يحمل «قالوا يوم دخلوا» أول أسبوع (k ≥ 5، بلا أسماء) ومدخل كلمة الاستقبال لأستاذ المحاضرة', () => {
  const st = read('lib/diploma/store.ts'); assert.match(st, /import \{ sectionEntry, ENTRY_LIMITS \} from '\.\.\/first\/entry'/); assert.match(st, /export type CorridorFirst/); assert.match(st, /select\('id,email'\)\.eq\('classroom_id'/); assert.match(st, /ph === 'first' \|\| ph === 'week' \|\| \(ph === 'before' && daysBetweenKeys\(today, sd\) <= ENTRY_LIMITS\.windowBeforeDays\)/); assert.match(st, /welcome_href: isOwn \? `\/me\/day\?welcome=/); assert.match(st, /title_ar: 'أول محاضرة — قالوا يوم دخلوا'/);
  const db = read('app/me/day/DayBook.tsx'); assert.match(db, /data-testid="dy-corr-first"/); assert.match(db, /data-testid="dy-corr-first-line"/); assert.match(db, /data-testid="dy-corr-first-silent"/); assert.match(db, /data-testid="dy-corr-first-welcome"/); assert.match(db, /openWord\(room, 'all'\); setWelcome\(true\);/);
});
