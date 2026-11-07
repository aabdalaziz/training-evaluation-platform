// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P60 «لأن… بصوتك» (خريطتك مسموعة) — النواة النقيّة (بلا قاعدة بيانات)
 *  الاسم الرسمي: التعليل الصوتي لخيوط خريطة الأثر / Spoken rationale on impact-map threads
 *  المبدأ: الصوت هُويّة — لا يسافر أبدًا (لا للمدرّب في «نسيج الشعبة»، ولا للجهة، ولا لصفحة التحقّق). النصّ وحده يسافر.
 *  الملف: athar-media/map-voice/<user_id>/<thread_row_id>.<ext> — ملف واحد لكل خيط، الجديد يستبدل القديم،
 *  ويُحذف مع حذف الخيط أو استبعاده. لا تطهير زمني: يبقى ما بقي الخيط.
 */
/* ملف خفيف يُستورد في المتصفّح أيضًا — لذلك لا يستورد word-reply (سلسلة خادم ثقيلة)؛ الحدود مطابقة لـ VOICE_LIMITS (P54) ويحرسها اختبار */
export const MAP_VOICE_LIMITS = { maxSeconds: 15, maxBytes: 512 * 1024, perHour: 10, signedSeconds: 300, bucket: 'athar-media', prefix: 'map-voice' } as const;
const MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac'] as const;
const voiceBase = (m: string) => String(m || '').split(';')[0].trim().toLowerCase();
export const voiceExt = (mime: string) => { const m = voiceBase(mime); return m === 'audio/mp4' || m === 'audio/x-m4a' || m === 'audio/aac' ? 'm4a' : m === 'audio/ogg' ? 'ogg' : m === 'audio/mpeg' ? 'mp3' : m === 'audio/wav' ? 'wav' : 'webm'; };
export const MAP_VOICE_TITLE = { ar: 'لأن… بصوتك', sub_ar: 'خريطتك مسموعة', official_ar: 'التعليل الصوتي لخيوط خريطة الأثر', official_en: 'Spoken rationale on impact-map threads' } as const;
/** الجملة الثابتة أسفل الخريطة */
export const VOICE_FOOT_AR = 'صوتك لك وحدك؛ كلمتك المكتوبة هي ما يسافر.';

/** ما يُخزَّن في portal_map_threads.note_voice */
export type MapVoiceStored = { path: string; sec: number; bytes: number; mime: string; at: string };
/** ما يصل إلى واجهة المتعلّم (بلا مسار) */
export type MapVoicePublic = { sec: number; at: string };

const clean = (s: string) => String(s || '').replace(/[^0-9a-zA-Z-]/g, '');
/** مسار الملف — معرّفان مُنقّيان؛ لا يقبل أي حرف غريب */
export function mapVoicePath(userId: string, threadRowId: string, ext: string): string {
  const u = clean(userId); const t = clean(threadRowId); const e = String(ext || 'webm').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'webm';
  if (!u || !t) throw new Error('bad ids');
  return `${MAP_VOICE_LIMITS.prefix}/${u}/${t}.${e}`;
}
/** قراءة آمنة للحقل jsonb (قد يكون {} أو تالفًا) */
export function voiceOfRow(v: unknown): MapVoiceStored | null {
  if (!v || typeof v !== 'object') return null; const o = v as Record<string, unknown>;
  const path = typeof o.path === 'string' ? o.path : ''; const sec = Number(o.sec || 0);
  if (!path.startsWith(`${MAP_VOICE_LIMITS.prefix}/`) || !(sec > 0)) return null;
  return { path, sec: Math.round(sec), bytes: Number(o.bytes || 0) || 0, mime: typeof o.mime === 'string' ? o.mime : 'audio/webm', at: typeof o.at === 'string' ? o.at : '' };
}
export const toPublic = (v: MapVoiceStored | null): MapVoicePublic | null => (v ? { sec: v.sec, at: v.at } : null);
/** التحقّق من الملف المرفوع — الحدود نفسها (≤ 15 ث · ≤ 512 KB · أنواع الصوت المعروفة) */
export function validateMapVoice(input: { mime: string; bytes: number; sec: number }): { ok: true; mime: string; ext: string; sec: number } | { ok: false; error: string } {
  const mime = voiceBase(input.mime); if (!(MIMES as readonly string[]).includes(mime)) return { ok: false, error: 'صيغة الصوت غير مدعومة (webm · m4a · ogg · mp3 · wav)' };
  const bytes = Number(input.bytes) || 0; if (bytes < 200) return { ok: false, error: 'التسجيل فارغ — أعِد المحاولة' }; if (bytes > MAP_VOICE_LIMITS.maxBytes) return { ok: false, error: `التسجيل أكبر من ${Math.round(MAP_VOICE_LIMITS.maxBytes / 1024)} ك.ب` };
  const sec = Math.round(Number(input.sec) || 0); if (sec < 1) return { ok: false, error: 'التسجيل أقصر من ثانية' }; if (sec > MAP_VOICE_LIMITS.maxSeconds + 1) return { ok: false, error: `«لأن…» بصوتك ${MAP_VOICE_LIMITS.maxSeconds} ثانية كحدّ أقصى` };
  return { ok: true, mime, ext: voiceExt(mime), sec: Math.min(sec, MAP_VOICE_LIMITS.maxSeconds) };
}

/** عدد الخيوط المُبقاة التي لها صوت */
export const countVoices = (threads: { status: string; voice?: MapVoicePublic | null }[]) => threads.filter((t) => t.status === 'kept' && !!t.voice).length;
/** سطر لقطة السنة — عدد فقط، الصوت نفسه لا يدخل اللقطة */
export function snapshotVoiceLine(n: number): string | null {
  if (!(n > 0)) return null;
  if (n === 1) return 'خيط واحد من خيوطك بصوتك';
  if (n === 2) return 'خيطان من خيوطك بصوتك';
  return `${n} من خيوطك بصوتك`;
}

/** «اسمع خريطتك»: قائمة تشغيل بترتيب الزمن — الخيوط ذات الصوت تُسمع بصوت صاحبها، والباقي يُقرأ نصًّا في المتصفّح (فتكون الرحلة كاملة دائمًا) */
export type PlayItem = { key: string; from: string; to: string; title_ar: string; note_ar: string; voice: boolean; sec: number; at: string | null };
export function playlistOf(threads: { from: string; to: string; status: string; note_ar: string | null; decided_at: string | null; voice?: MapVoicePublic | null }[], stations: { key: string; title_ar: string }[]): PlayItem[] {
  const title = new Map(stations.map((s) => [s.key, s.title_ar]));
  return threads.filter((t) => t.status === 'kept' && title.has(t.from) && title.has(t.to))
    .map((t) => ({ key: `${t.from}>${t.to}`, from: t.from, to: t.to, title_ar: `${title.get(t.from)} ⟵ ${title.get(t.to)}`, note_ar: t.note_ar || '', voice: !!t.voice, sec: t.voice?.sec || 0, at: t.decided_at || null }))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
}
/** المدّة التقريبية للرحلة المسموعة (الصوت بمدّته، والنصّ ≈ 2.5 كلمة/ثانية) */
export const playlistSeconds = (items: PlayItem[]) => items.reduce((s, i) => s + (i.voice ? i.sec : Math.max(2, Math.ceil(i.note_ar.split(/\s+/).filter(Boolean).length / 2.5))), 0);
