// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * تثبيت النطاق الرسمي وقت التشغيل (2026-11-15).
 *  next.config.js يثبّت NEXT_PUBLIC_SITE_URL في الحزم وقت البناء، لكن الدوال التي تستلم كائن process.env كاملًا
 *  (securityTxt · channelEnv · vault notices · policy …) تقرأ القيمة الحيّة من بيئة Vercel — وهي ما زالت على النطاق القديم
 *  لتعذّر تعديلها من اللوحة (رمز التحقّق). هذا الملف يعمل مرة عند إقلاع كل خادم/دالة على Vercel ويُصحّح القيمة قبل أي طلب.
 *  محليًا (بلا VERCEL) لا يغيّر شيئًا حتى تبقى اختبارات E2E على 127.0.0.1.
 */
export const CANONICAL_SITE = 'https://athar-portal.com';
export const LEGACY_HOSTS = ['athar.university', 'www.athar.university', 'athar-portal.vercel.app', 'training-evaluation-platform.vercel.app'];

/** يعيد القيمة الصحيحة للمتغير: على Vercel النطاق الرسمي دائمًا؛ محليًا القيمة كما هي */
export function resolveSiteEnv(env: { VERCEL?: string; NEXT_PUBLIC_SITE_URL?: string }): string | undefined {
  if (env.VERCEL) return CANONICAL_SITE;
  const cur = String(env.NEXT_PUBLIC_SITE_URL || '').trim();
  try { if (cur && LEGACY_HOSTS.includes(new URL(cur).hostname)) return CANONICAL_SITE; } catch { /* قيمة غير صالحة — تُترك */ }
  return cur || undefined;
}

/* ملاحظة: نستخدم مفتاحًا مركَّبًا حتى لا يستبدل Next وقت البناء `process.env.NEXT_PUBLIC_SITE_URL` بنصّ ثابت (env: في next.config) */
const KEY = ['NEXT_PUBLIC', 'SITE_URL'].join('_');
export async function register(): Promise<void> {
  const env = process.env as Record<string, string | undefined>;
  const v = resolveSiteEnv({ VERCEL: env.VERCEL, NEXT_PUBLIC_SITE_URL: env[KEY] });
  if (v && env[KEY] !== v) env[KEY] = v;
}
