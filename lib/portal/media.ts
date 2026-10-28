// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — P13-ج: قناة واحدة (كتابة · صوت · فيديو) + غرف أَثَر الصغيرة — منطق خالص قابل للاختبار
import type { LearningEventRow } from './profile';

// ====================================================================== حدود الوسائط
/** 90 ثانية · 480p · 12 م.ب — كافية لأداء مُشاهَد، ورفيقة بالتخزين المجاني (≈150 تسجيلًا لكل 1 GB) */
export const MEDIA_LIMITS = { maxSeconds: 90, maxBytes: 12 * 1024 * 1024, width: 640, height: 480, retentionDays: 180 } as const;
export const MEDIA_MIMES = ['video/webm', 'video/mp4', 'video/quicktime', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'] as const;
export type MediaKind = 'video' | 'audio';
export type MediaContext = 'daily_case' | 'whatif' | 'advisor' | 'copilot_moment' | 'dialogue' | 'mission' | 'simulation' | 'free';
export const MEDIA_CONTEXTS: MediaContext[] = ['daily_case', 'whatif', 'advisor', 'copilot_moment', 'dialogue', 'mission', 'simulation', 'free'];
export const MEDIA_CONTEXT_LABEL: Record<MediaContext, { ar: string; en: string }> = {
  daily_case: { ar: 'موقف اليوم', en: 'Daily case' }, whatif: { ar: 'ماذا لو؟ — الجولة الثانية', en: 'What if — round two' }, advisor: { ar: 'مستشارك', en: 'Advisor' },
  copilot_moment: { ar: 'لحظة من جلسة حية', en: 'Live-session moment' }, dialogue: { ar: 'جلسة حوار', en: 'Dialogue' }, mission: { ar: 'مهمة من قلب العمل', en: 'Workflow mission' },
  simulation: { ar: 'محاكاة أداء', en: 'Performance simulation' }, free: { ar: 'تسجيل حر', en: 'Free recording' },
};
/** ترتيب المرشّحين لـ MediaRecorder — أول نوع يدعمه المتصفح */
export const VIDEO_MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'] as const;
export const AUDIO_MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'] as const;
export function pickMime(candidates: readonly string[], isSupported: (m: string) => boolean): string | null { for (const c of candidates) { try { if (isSupported(c)) return c; } catch { /* ignore */ } } return null; }
/** النوع الأساسي بلا codecs (للتخزين وقيود المخزن) */
export function baseMime(mime: string): string { return String(mime || '').split(';')[0].trim().toLowerCase(); }
export function extFor(mime: string): string { const b = baseMime(mime); if (b === 'video/mp4' || b === 'audio/mp4') return b.startsWith('video') ? 'mp4' : 'm4a'; if (b === 'video/quicktime') return 'mov'; if (b === 'audio/ogg') return 'ogg'; if (b === 'audio/mpeg') return 'mp3'; if (b === 'audio/wav') return 'wav'; return 'webm'; }
export function kindFor(mime: string): MediaKind { return baseMime(mime).startsWith('video/') ? 'video' : 'audio'; }

export type MediaValidation = { ok: true; mime: string; kind: MediaKind; ext: string } | { ok: false; error_ar: string };
/** تحقق خادمي من ملف الوسائط قبل الرفع */
export function validateMedia(input: { mime: string; bytes: number; duration_sec: number; context_type?: string }): MediaValidation {
  const mime = baseMime(input.mime);
  if (!(MEDIA_MIMES as readonly string[]).includes(mime)) return { ok: false, error_ar: 'نوع الملف غير مدعوم (فيديو webm/mp4 أو صوت webm/ogg/mp4).' };
  if (!(input.bytes > 0)) return { ok: false, error_ar: 'الملف فارغ.' };
  if (input.bytes > MEDIA_LIMITS.maxBytes) return { ok: false, error_ar: `حجم الملف يتجاوز ${Math.round(MEDIA_LIMITS.maxBytes / 1048576)} م.ب — سجّل مقطعًا أقصر.` };
  if (input.duration_sec > MEDIA_LIMITS.maxSeconds + 5) return { ok: false, error_ar: `المدة تتجاوز ${MEDIA_LIMITS.maxSeconds} ثانية.` };
  if (input.context_type && !MEDIA_CONTEXTS.includes(input.context_type as MediaContext)) return { ok: false, error_ar: 'سياق غير معروف.' };
  return { ok: true, mime, kind: kindFor(mime), ext: extFor(mime) };
}
export function mediaPath(userId: string, id: string, ext: string): string { return `${userId}/${id}.${ext}`; }

// ====================================================================== دليل الأداء المُشاهَد (التوأم المهاري)
export type MediaRow = { id: string; user_id: string; email?: string | null; kind: MediaKind; duration_sec: number; transcript?: string | null; context_type: MediaContext; context_id?: string | null; skill_ids: string[]; title?: string | null; status: 'uploaded' | 'approved' | 'rejected'; created_at?: string };
/** حدث تعلّم من تسجيل أداء: وزن 0.6 عند الرفع، 0.85 بعد اعتماد بشري؛ يُستبعد عند الرفض */
export function mediaEvidenceEvent(m: MediaRow, score: number | null, at = new Date().toISOString()): LearningEventRow {
  return { at, user_id: m.user_id, email: m.email || null, verb: 'assessed', object_type: 'media', object_id: m.id, skills: m.skill_ids || [],
    context: { kind: m.kind, duration_sec: m.duration_sec, context_type: m.context_type, context_id: m.context_id || null, title: m.title || MEDIA_CONTEXT_LABEL[m.context_type]?.ar || '', score, approved: m.status === 'approved', rejected: m.status === 'rejected', words: wordCount(m.transcript || '') } };
}
export function wordCount(s: string): number { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
/** درجة أولية من النص المفرّغ مقابل معايير سياقه (محلية، شفافة): طول كافٍ + ذكر أطراف + خطوات + تحقق */
export function transcriptScore(transcript: string, parties: string[] = []): { score: number; notes_ar: string[] } {
  const t = String(transcript || '').trim(); const words = wordCount(t); const notes: string[] = []; let score = 0;
  if (words >= 25) { score += 25; } else notes.push('التسجيل قصير — تحدّث عن القرار وأسبابه بوضوح.');
  if (words >= 60) score += 10;
  const hitParties = parties.filter(p => p && t.includes(p.replace(/^ال/, '').slice(0, 4))).length; if (hitParties > 0) { score += Math.min(20, 10 * hitParties); } else if (parties.length) notes.push('لم تذكر أطراف الموقف بأسمائهم.');
  if (/(أولًا|أولا|ثم|بعد ذلك|أخيرًا|أخيرا|الخطوة)/.test(t)) score += 15; else notes.push('رتّب خطواتك: أولًا… ثم… أخيرًا.');
  if (/(أتأكد|أتحقق|أراجع|أقيس|مؤشر|نتابع|أتابع)/.test(t)) score += 15; else notes.push('قل كيف ستتحقق لاحقًا أن قرارك عمل.');
  if (/(لن أ|لا أ|أرفض|أتجنب|ليس من)/.test(t)) score += 15; else notes.push('اذكر ما الذي لن تفعله ولماذا.');
  return { score: Math.max(0, Math.min(100, score)), notes_ar: notes };
}
export const MEDIA_STATUS_LABEL: Record<MediaRow['status'], { ar: string; en: string; tone: string }> = { uploaded: { ar: 'بانتظار المراجعة', en: 'Awaiting review', tone: 'gold' }, approved: { ar: 'معتمد', en: 'Approved', tone: 'teal' }, rejected: { ar: 'مرفوض', en: 'Rejected', tone: 'red' } };
export function fmtDuration(sec: number): string { const s = Math.max(0, Math.round(sec || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// ====================================================================== غرف أَثَر الصغيرة
export type RoomKind = 'breakout' | 'dialogue' | 'consult';
export type Room = { id: string; code: string; title: string; kind: RoomKind; session_id?: string | null; created_by?: string | null; prompt?: string | null; max_peers: number; minutes: number; status: 'open' | 'closed'; notes: { by: string; name?: string; text: string; at: string }[]; created_at: string; closed_at?: string | null };
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** رمز غرفة من 6 حروف بلا التباس (O/0 · I/1 مستبعدة) */
export function roomCode(rand: () => number = Math.random): string { let s = ''; for (let i = 0; i < 6; i++) s += ROOM_ALPHABET[Math.floor(rand() * ROOM_ALPHABET.length) % ROOM_ALPHABET.length]; return s; }
export function isRoomCode(s: string): boolean { return /^[A-HJ-NP-Z2-9]{6}$/.test(String(s || '').toUpperCase()); }
export function roomUrl(site: string, code: string): string { return `${String(site || '').replace(/\/$/, '')}/room/${code}`; }
/** تجزئة ثابتة لتوزيع المشاركين على الغرف توزيعًا مستقرًا (نفس الشخص → نفس الغرفة) */
export function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
export function assignRoom<T extends { code: string }>(userId: string, rooms: T[]): T | null { if (!rooms.length) return null; const open = rooms; return open[hashStr(String(userId || 'guest')) % open.length]; }
/** عدد الغرف المناسب لعدد المشاركين (3 لكل غرفة، بين 1 و12) */
export function roomCountFor(joined: number, perRoom = 3): number { return Math.max(1, Math.min(12, Math.ceil(Math.max(1, joined) / Math.max(2, perRoom)))); }
export const ROOM_KIND_LABEL: Record<RoomKind, { ar: string; en: string }> = { breakout: { ar: 'غرفة صغيرة من جلسة حية', en: 'Live-session breakout' }, dialogue: { ar: 'غرفة حوار', en: 'Dialogue room' }, consult: { ar: 'غرفة استشارة', en: 'Consultation room' } };
export const ROOM_DEFAULT_PROMPT: Record<RoomKind, string> = { breakout: 'ما أصعب جزء في هذا؟ — اتفقوا على سطر واحد تعودون به إلى الجلسة.', dialogue: 'كل واحد يروي موقفًا حقيقيًا من عمله هذا الأسبوع، والآخرون يسألون: «ماذا لو…؟»', consult: 'اعرض الحالة في دقيقتين، ثم اسمع قبل أن تردّ.' };
/** إشارات WebRTC عبر قناة البث الفورية: أنواع الرسائل */
export type SignalMsg = { type: 'hello' | 'offer' | 'answer' | 'ice' | 'bye'; from: string; to?: string; name?: string; sdp?: any; candidate?: any };
/** من يبدأ العرض؟ الطرف ذو المعرّف الأصغر يرسل offer (قاعدة حتمية تمنع التصادم) */
export function shouldOffer(me: string, other: string): boolean { return String(me) < String(other); }
export const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
export function roomTimeLeft(room: Pick<Room, 'created_at' | 'minutes'>, now = Date.now()): number { const end = Date.parse(room.created_at) + room.minutes * 60000; return Math.max(0, Math.round((end - now) / 1000)); }
