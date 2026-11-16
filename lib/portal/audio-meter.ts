// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P72-أ «ضبط الصوت» — قياسات صوتية خالصة تعمل في جهاز المتعلّم (وفي جهاز المقيِّم عند الاستماع) — بلا خادم ولا ذكاء اصطناعي.
 *  - meterFrame(samples)           : إطار واحد (≈100 ms) → rms + peak
 *  - levelHint(rms, peak)          : silent | quiet | ok | loud  — تنبيه حيّ أثناء التسجيل («اقترب من الميكروفون»…)
 *  - takeQuality(frames, sec)      : قراءة ما بعد التسجيل: المدة المسموعة، نسبة الصمت، الذروة، حكم لطيف + جملة عربية/إنجليزية
 *  - analyzePcm(samples, rate)     : من مخزن PCM كامل (decodeAudioData عند المقيِّم أو في الاختبارات) → takeQuality
 *  - qualityMeta(q)                : رقمان صغيران يُخزَّنان اختياريًّا في jsonb قائم (voiced_sec, peak, level) — لا يدخلان أي تقييم
 *  القاعدة 28: التنبيه اقتراح لا منع؛ القرار للمتعلّم؛ لا يدخل أي مقياس صوتي في الدرجة.
 */
export const METER = { frameMs: 100, silentRms: 0.003, quietRms: 0.02, voicedRms: 0.01, clipPeak: 0.98, clipRatio: 0.05, minVoicedSec: 0.5, mostlySilent: 0.7 } as const;

export type Frame = { rms: number; peak: number };
export type Level = 'silent' | 'quiet' | 'ok' | 'loud';
export type Verdict = 'unknown' | 'empty' | 'mostly_silent' | 'quiet' | 'clipped' | 'ok';
export type TakeQuality = { verdict: Verdict; voiced_sec: number; silent_ratio: number; peak: number; level: Level; hint_ar: string | null; hint_en: string | null; suggest_redo: boolean };

export function meterFrame(samples: ArrayLike<number>): Frame {
  const n = samples.length; if (!n) return { rms: 0, peak: 0 };
  let sum = 0; let peak = 0;
  for (let i = 0; i < n; i += 1) { const v = Number(samples[i]) || 0; sum += v * v; const a = v < 0 ? -v : v; if (a > peak) peak = a; }
  return { rms: Math.sqrt(sum / n), peak: Math.min(1, peak) };
}
/** بايتات AnalyserNode.getByteTimeDomainData (0..255، الصفر عند 128) → عيّنات -1..1 */
export function bytesToSamples(bytes: ArrayLike<number>): Float32Array { const out = new Float32Array(bytes.length); for (let i = 0; i < bytes.length; i += 1) { const v = Number(bytes[i]); out[i] = ((Number.isFinite(v) ? v : 128) - 128) / 128; } return out; }

export function levelHint(rms: number, peak: number): Level { if (peak >= METER.clipPeak) return 'loud'; if (rms < METER.silentRms) return 'silent'; if (rms < METER.quietRms) return 'quiet'; return 'ok'; }
export const LEVEL_AR: Record<Level, string | null> = { silent: 'لا يصل صوت — تأكّد من الميكروفون', quiet: 'صوتك خافت — اقترب من الميكروفون', ok: null, loud: 'صوتك مرتفع جدًا — ابتعد قليلًا' };
export const LEVEL_EN: Record<Level, string | null> = { silent: 'No sound reaching the mic — check it', quiet: 'Too quiet — move closer to the mic', ok: null, loud: 'Too loud — move back a little' };
/** 0..1 لشريط المستوى (لوغاريتمي لطيف حتى يتحرّك مع الكلام العادي) */
export const levelBar = (rms: number) => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(rms, 1e-5)) + 60) / 60));

function median(xs: number[]): number { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

export function takeQuality(frames: Frame[], sec: number): TakeQuality {
  const total = frames.length; const dur = Math.max(0, Number(sec) || 0);
  if (!total || !dur) return { verdict: 'unknown', voiced_sec: 0, silent_ratio: 0, peak: 0, level: 'ok', hint_ar: null, hint_en: null, suggest_redo: false };
  const voiced = frames.filter((f) => f.rms >= METER.voicedRms); const peak = Math.min(1, Math.max(0, ...frames.map((f) => f.peak)));
  const voicedSec = Math.round((voiced.length / total) * dur * 10) / 10; const silentRatio = Math.round((1 - voiced.length / total) * 100) / 100;
  const clipped = frames.filter((f) => f.peak >= METER.clipPeak).length / total; const med = median(voiced.map((f) => f.rms));
  let verdict: Verdict = 'ok';
  if (voicedSec < METER.minVoicedSec) verdict = 'empty'; else if (clipped >= METER.clipRatio) verdict = 'clipped'; else if (silentRatio > METER.mostlySilent) verdict = 'mostly_silent'; else if (med < METER.quietRms) verdict = 'quiet';
  const level: Level = verdict === 'empty' ? 'silent' : verdict === 'clipped' ? 'loud' : verdict === 'quiet' ? 'quiet' : 'ok';
  const AR: Record<Verdict, string | null> = { unknown: null, ok: null, empty: 'لم يُسجَّل صوت مسموع — تأكّد من الميكروفون ثم أعد التسجيل؟', mostly_silent: `أغلب التسجيل صمت (المسموع ${voicedSec} ث) — أعد التسجيل؟`, quiet: 'التسجيل خافت — اقترب من الميكروفون وأعد التسجيل؟', clipped: 'الصوت مرتفع ومشوّش — ابتعد قليلًا وأعد التسجيل؟' };
  const EN: Record<Verdict, string | null> = { unknown: null, ok: null, empty: 'No audible speech recorded — check the mic and record again?', mostly_silent: `Mostly silence (${voicedSec}s audible) — record again?`, quiet: 'Too quiet — move closer and record again?', clipped: 'Too loud and distorted — move back and record again?' };
  return { verdict, voiced_sec: voicedSec, silent_ratio: silentRatio, peak: Math.round(peak * 100) / 100, level, hint_ar: AR[verdict], hint_en: EN[verdict], suggest_redo: verdict !== 'ok' };
}

/** PCM كامل (قناة واحدة) → إطارات 100 ms → القراءة. يُستخدم عند المقيِّم (decodeAudioData) وفي اختبارات الوحدة */
export function analyzePcm(samples: ArrayLike<number>, sampleRate: number, frameMs: number = METER.frameMs): TakeQuality {
  const step = Math.max(1, Math.floor((sampleRate * frameMs) / 1000)); const frames: Frame[] = [];
  for (let i = 0; i < samples.length; i += step) { const slice: number[] = []; for (let j = i; j < Math.min(samples.length, i + step); j += 1) slice.push(Number(samples[j]) || 0); frames.push(meterFrame(slice)); }
  return takeQuality(frames, samples.length / Math.max(1, sampleRate));
}

/** رقمان (وكلمة) للتخزين الاختياري في jsonb قائم — أرقام فقط، لا صوت ولا نص */
export type QualityMeta = { voiced_sec: number; peak: number; level: Level };
export function qualityMeta(q: TakeQuality | null | undefined): QualityMeta | null { if (!q || q.verdict === 'unknown') return null; return { voiced_sec: q.voiced_sec, peak: q.peak, level: q.level }; }
export function parseQualityMeta(v: unknown): QualityMeta | null {
  if (!v || typeof v !== 'object') return null; const o = v as Record<string, unknown>; const vs = Number(o.voiced_sec); const pk = Number(o.peak); const lv = String(o.level || '');
  if (!Number.isFinite(vs) || vs < 0 || vs > 600 || !Number.isFinite(pk) || pk < 0 || pk > 1 || !['silent', 'quiet', 'ok', 'loud'].includes(lv)) return null;
  return { voiced_sec: Math.round(vs * 10) / 10, peak: Math.round(pk * 100) / 100, level: lv as Level };
}
/** سطر المقيِّم: يميّز «لم يتكلّم» عن «لم يُسمع» — لا يدخل الدرجة */
export function qualityLineAr(m: QualityMeta | null, sec?: number | null): string | null {
  if (!m) return null; const lvl = m.level === 'ok' ? 'مستوى جيد' : m.level === 'quiet' ? 'مستوى خافت' : m.level === 'loud' ? 'مستوى مرتفع/مشوّش' : 'لا صوت مسموع';
  return `المسموع ${m.voiced_sec} ث${sec ? ` من ${sec}` : ''} · ${lvl} (قراءة آلية من الجهاز — لا تدخل الدرجة)`;
}
export const MIC_CHECK = { seconds: 3, storageKey: 'athar_mic_ok' } as const;
