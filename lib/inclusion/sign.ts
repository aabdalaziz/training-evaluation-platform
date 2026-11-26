// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82-د */
/**
 * «مسار لغة الإشارة» — الصادق والممكن اليوم (لا يوجد تعرّف موثوق على الإشارة العربية في المتصفّح):
 *  (أ) فيديو إرشادي بلغة الإشارة لكلّ خطوة (يسجَّل مع مترجم بشري مرّة واحدة) — الروابط من متغيّر البيئة NEXT_PUBLIC_SIGN_VIDEOS
 *      بصيغة  checkin=https://… ;register=https://… ;evaluate=https://…   (فيديو mp4/webm أو صفحة YouTube/Vimeo للتضمين). إن غاب رابط الخطوة ظهر نصّها المبسَّط وشارة «قريبًا».
 *  (ب) «ساعدني بمكالمة فيديو»: واتساب فيديو مع فريق أَثَر (الرقم الرسمي) + طلب مسجَّل يصل إلى /admin/inclusion.
 *  (ج) نماذج بأيقونات كبيرة واختيارات بدل الكتابة (SignHelp يعرض الخطوات برموز).
 */
export type SignStep = { key: string; icon: string; title_ar: string; title_en: string; text_ar: string; video: string | null };
export const SIGN_WHATSAPP = '966564440406';
const BASE: Omit<SignStep, 'video'>[] = [
  { key: 'checkin', icon: '🪪', title_ar: 'تسجيل الحضور', title_en: 'Check-in', text_ar: '١) اكتب اسمك الثلاثي  ٢) جوالك أو بريدك  ٣) اضغط «تسجيل حضوري». أو أبرِز بطاقة أَثَر الرقمية ليمسحها الطاقم.' },
  { key: 'register', icon: '📝', title_ar: 'التسجيل في برنامج', title_en: 'Register', text_ar: '١) اختر البرنامج  ٢) اضغط «سجّل»  ٣) أكمل بياناتك  ٤) تصلك رسالة تأكيد.' },
  { key: 'evaluate', icon: '⭐', title_ar: 'تعبئة التقييم', title_en: 'Evaluation', text_ar: 'لكلّ سؤال خمس نجوم: نجمة = ضعيف، خمس نجوم = ممتاز. اضغط النجمة ثمّ «التالي».' },
  { key: 'certificate', icon: '🎓', title_ar: 'شهادتي', title_en: 'Certificate', text_ar: 'من «صفحتي» ← «شهاداتي» ← اضغط الشهادة ← «تنزيل». للتحقّق امسح رمز QR عليها.' },
  { key: 'live', icon: '🎥', title_ar: 'الغرفة الحيّة', title_en: 'Live room', text_ar: 'مقعد مترجم الإشارة مثبَّت وأكبر، والترجمة النصّية الحيّة أسفل الشاشة. اضغط ✋ لطلب الكلام.' },
];
/** يفكّ NEXT_PUBLIC_SIGN_VIDEOS إلى خريطة خطوة→رابط (روابط https فقط). */
export function parseSignVideos(env: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {}; for (const part of String(env || '').split(/[;\n,]/)) { const i = part.indexOf('='); if (i <= 0) continue; const k = part.slice(0, i).trim(); const v = part.slice(i + 1).trim(); if (/^[a-z_]+$/.test(k) && /^https:\/\//.test(v)) out[k] = v; } return out;
}
export function signSteps(env: string | undefined | null = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SIGN_VIDEOS : ''): SignStep[] { const m = parseSignVideos(env); return BASE.map((s) => ({ ...s, video: m[s.key] || null })); }
/** رابط YouTube → رابط تضمين؛ غيره كما هو (ملفّ فيديو mp4/webm). */
export function embedUrl(u: string): { kind: 'iframe' | 'video'; src: string } {
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/); if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}?rel=0` }; /* ضمن frame-src المسموح */
  return { kind: 'video', src: u };
}
export function whatsappVideoLink(page: string, lang: 'ar' | 'en' = 'ar'): string {
  const t = lang === 'ar' ? `السلام عليكم، أتواصل بلغة الإشارة وأحتاج مساعدة بمكالمة فيديو في: ${page}` : `Hello, I communicate in sign language and need a video-call help with: ${page}`;
  return `https://wa.me/${SIGN_WHATSAPP}?text=${encodeURIComponent(t)}`;
}
/** غرفة مكالمة فيديو فورية (Jitsi — المسموح في frame-src والمستعمل في الغرف الحيّة). */
export function signRoomUrl(seed = Math.random().toString(36).slice(2, 8)): string { return `https://meet.jit.si/athar-sign-${seed.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'help'}`; }
