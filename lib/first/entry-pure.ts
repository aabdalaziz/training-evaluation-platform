// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P71 «يوم دخلتُ» — الجزء الصرف (يُستورد من المتصفح والخادم معًا): الحدود · الأسماء · نصّ الشاشة · التحقّق · «قالوا يوم دخلوا» */
import { shuffleSeeded, cleanLine, arN } from '../calendar/registry';
const MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac'] as const;
const voiceBase = (m: string) => String(m || '').split(';')[0].trim().toLowerCase();
const voiceExt = (m: string) => m === 'audio/mp4' || m === 'audio/x-m4a' || m === 'audio/aac' ? 'm4a' : m === 'audio/ogg' ? 'ogg' : m === 'audio/mpeg' ? 'mp3' : m === 'audio/wav' ? 'wav' : m === 'audio/webm' ? 'webm' : '';

export const ENTRY_LIMITS = { textMin: 3, textMax: 200, voiceSec: 20, voiceBytes: 1024 * 1024, k: 5, show: 3, windowBeforeDays: 7, signedSeconds: 300, bucket: 'athar-media', prefix: 'entry-voice' } as const;
export const ENTRY_NAMES = { ar: { narrative: 'يوم دخلتُ', line: 'سطر الدخول', official: 'سطر الدخول — بكلمات المتعلّم يوم التسكين', echo: 'قالوا يوم دخلوا' }, en: { narrative: 'The day I entered', line: 'Entry line', official: "Entry Line — In the Learner's Own Words on Placement Day" } } as const;
export const ENTRY_COLS = 'id,email,session_id,report_id,user_id,invite_id,lang,body_text,voice,created_at,updated_at,public_ok'; /* P75 +public_ok */
export type EntryVoice = { path: string; sec: number; bytes: number; mime: string; at: string; quality?: { voiced_sec: number; peak: number; level: string } | null /* P72-أ: قراءة الجهاز — أرقام فقط، لا تدخل أي تقييم */ };
export type EntryRow = { id: number; email: string; session_id: string; report_id: string | null; user_id: string | null; invite_id: string | null; lang: string; body_text: string | null; voice: EntryVoice | Record<string, never> | null; created_at: string; updated_at: string; public_ok?: boolean | null };
export type EntryView = { id: number; text: string | null; lang: string; voice_sec: number | null; at: string; title_ar: string; public_ok: boolean /* P75 */ };

/* ───────── صرف ───────── */
/** النصّ بأي لغة: يُنظَّف من الوسوم والروابط، ويُرفض البريد والهاتف (لا نريد بيانات اتصال في سطر يعود يوم التخرّج) */
export function validateEntryText(v: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = cleanLine(v).slice(0, ENTRY_LIMITS.textMax);
  if (!text) return { ok: false, error: 'empty' };
  if ([...text].length < ENTRY_LIMITS.textMin) return { ok: false, error: 'too_short' };
  if (/@|\+?\d[\d\s-]{7,}\d/.test(text)) return { ok: false, error: 'no_contact' };
  return { ok: true, text };
}
export function validateEntryVoice(input: { mime: string; bytes: number; sec: number }): { ok: true; mime: string; ext: string; sec: number } | { ok: false; error: string } {
  const mime = voiceBase(input.mime); if (!(MIMES as readonly string[]).includes(mime)) return { ok: false, error: 'bad_voice' }; const ext = voiceExt(mime);
  const bytes = Number(input.bytes) || 0; if (bytes < 200) return { ok: false, error: 'empty' }; if (bytes > ENTRY_LIMITS.voiceBytes) return { ok: false, error: 'too_big' };
  const sec = Math.round(Number(input.sec) || 0); if (sec < 1) return { ok: false, error: 'too_short' }; if (sec > ENTRY_LIMITS.voiceSec + 1) return { ok: false, error: 'too_long' };
  return { ok: true, mime, ext, sec: Math.min(sec, ENTRY_LIMITS.voiceSec) };
}
/** نصّ الشاشة بلغة الواجهة (ar/en) — الكتابة نفسها بأي لغة */
export function entryPromptFor(lang: 'ar' | 'en'): { kicker: string; title: string; lead: string; placeholder: string; voice: string; save: string; skip: string; saved: string; note: string } {
  return lang === 'ar'
    ? { kicker: 'يوم دخلتُ', title: 'قبل أن تعرف نتيجتك — سطر واحد بلغتك أنت', lead: 'لماذا تتعلّم العربية؟ اكتبه بأي لغة تريد، أو قُله بصوتك في عشرين ثانية. لا يراه المصحّح ولا يغيّر نتيجتك — يعود إليك أنت: في أول درس، وعبر كل مستوى، ويوم تخرّجك.', placeholder: 'لماذا تتعلّم العربية؟ (≤ 200 حرف · أي لغة)', voice: 'قُله بصوتك (≤ 20 ث)', save: 'احفظ سطري', skip: 'أتجاوز الآن', saved: 'حُفظ سطرك — سيعود إليك يوم أول درس.', note: 'سطرك ملكك: تراه أنت وحدك، وتحذفه متى شئت.' }
    : { kicker: 'The day I entered', title: 'Before you see your result — one line, in your own language', lead: 'Why are you learning Arabic? Write it in any language, or say it in twenty seconds. Your rater never sees it and it does not change your result — it comes back to you: on your first day, across every level, and on your graduation day.', placeholder: 'Why are you learning Arabic? (≤ 200 characters · any language)', voice: 'Say it (≤ 20 s)', save: 'Save my line', skip: 'Skip for now', saved: 'Saved — it will come back to you on your first day.', note: 'This line is yours alone: only you see it, and you can delete it anytime.' };
}
/** للأستاذ: «قالوا يوم دخلوا» — k ≥ 5 · نصوص فقط كما كُتبت (بأي لغة) · بلا أسماء */
export type EchoItem = { id: number; text: string; public_ok: boolean }; /* P75: المعرّف للأستاذ كي يخفي عن الرئيسة — لا بريد */
export function entryEchoLine(texts: Array<string | EchoItem>, roster: number, seed: string): { shown: boolean; n: number; head_ar: string | null; lines: string[]; items: EchoItem[] } {
  const items0 = texts.map((t) => (typeof t === 'string' ? { id: 0, text: cleanLine(t), public_ok: false } : { ...t, text: cleanLine(t.text) })).filter((t) => t.text.length >= ENTRY_LIMITS.textMin); const n = items0.length;
  if (n < ENTRY_LIMITS.k) return { shown: false, n, head_ar: null, lines: [], items: [] };
  const seen = new Set<string>(); const uniq = items0.filter((t) => (seen.has(t.text) ? false : (seen.add(t.text), true))); const items = shuffleSeeded(uniq, `entry:${seed}`).slice(0, ENTRY_LIMITS.show); const lines = items.map((t) => t.text);
  return { shown: true, n, items, head_ar: `${n}${roster ? ` من ${roster}` : ''} — ${arN(n, 'سطر واحد', 'سطران', 'سطور', 'سطرًا')}، بلغاتهم كما كتبوها (بلا أسماء · لا يدخل أي تقييم):`, lines };
}
export const voiceOfEntry = (v: unknown): EntryVoice | null => (v && typeof v === 'object' && typeof (v as any).path === 'string' && (v as any).path ? (v as EntryVoice) : null);
export const entryView = (r: EntryRow): EntryView => ({ id: Number(r.id), text: r.body_text || null, lang: String(r.lang || 'ar'), voice_sec: voiceOfEntry(r.voice)?.sec ?? null, at: String(r.created_at), title_ar: 'قلتَ يوم دخلتَ', public_ok: r.public_ok === true });

