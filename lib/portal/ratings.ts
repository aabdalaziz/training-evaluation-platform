// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** هـ-1/4 — «تقييم الخدمة»: القواميس المشتركة بين الواجهة والـAPI (خالصة، قابلة للاختبار). */
export const RATING_SERVICES = ['miaar', 'iqra', 'program', 'diploma', 'payment', 'consulting', 'portal'] as const;
export type RatingService = typeof RATING_SERVICES[number];
export const SERVICE_AR: Record<RatingService, string> = { miaar: 'مِعيار', iqra: 'اقْرَأْ', program: 'البرنامج', diploma: 'الدبلوم', payment: 'الدفع', consulting: 'الاستشارة', portal: 'بوّابة أَثَر' };

/** وسوم جاهزة (المستفيد يختار حتى ٥) — من معجم أَثَر */
export const RATING_TAGS: { key: string; ar: string; tone: 'up' | 'down' }[] = [
  { key: 'clear', ar: 'واضح', tone: 'up' }, { key: 'fast', ar: 'سريع', tone: 'up' }, { key: 'fair', ar: 'منصف', tone: 'up' }, { key: 'useful', ar: 'نافع', tone: 'up' }, { key: 'beautiful', ar: 'جميل', tone: 'up' },
  { key: 'slow', ar: 'بطيء', tone: 'down' }, { key: 'confusing', ar: 'مُربك', tone: 'down' }, { key: 'hard', ar: 'صعب', tone: 'down' }, { key: 'bug', ar: 'خلل تقني', tone: 'down' }, { key: 'pricey', ar: 'السعر مرتفع', tone: 'down' },
];
export const STAR_WORDS = ['', 'ضعيف', 'مقبول', 'جيّد', 'جيّد جدًّا', 'ممتاز'];

/** قناع البريد للطاقم: a***z@g***.com */
export function maskEmail(e: string): string {
  const [u, d] = String(e || '').split('@'); if (!u || !d) return '***';
  const m = (s: string) => (s.length <= 2 ? s[0] + '*' : s[0] + '***' + s[s.length - 1]);
  const [dn, ...rest] = d.split('.'); return `${m(u)}@${m(dn)}${rest.length ? '.' + rest.join('.') : ''}`;
}
/** متوسّط مُنسَّق للعرض: ٤٫٨ */
export const fmtAvg = (avg: number) => new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(avg || 0);
/** عدد التقييمات بصيغة عربية سليمة */
export function fmtCount(n: number): string {
  const x = new Intl.NumberFormat('ar-EG').format(n);
  if (n === 1) return 'تقييم واحد'; if (n === 2) return 'تقييمان'; if (n >= 3 && n <= 10) return `${x} تقييمات`; return `${x} تقييمًا`;
}
/** نسبة الرضا (٤–٥ نجوم) من التوزيع [n1..n5] */
export function satisfaction(dist: number[]): number { const tot = dist.reduce((a, b) => a + b, 0); return tot ? Math.round(((dist[3] + dist[4]) / tot) * 100) : 0; }
