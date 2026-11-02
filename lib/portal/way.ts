// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «الطريق» — خريطة أسماء المسارات لشريط التنقّل الموحّد (رجوع · الرئيسية · مسار الصفحة). منطق خالص قابل للاختبار. */
export type Crumb = { href: string; label: string; current: boolean };
type L = { ar: string; en: string };
/** أسماء المقاطع المعروفة (المقطع الأول أو المركّب) — الأسماء الرسمية كما في القوائم */
const NAMES: Record<string, L> = {
  services: { ar: 'الخدمات', en: 'Services' }, programs: { ar: 'البرامج', en: 'Programs' }, consulting: { ar: 'الاستشارات', en: 'Consulting' },
  resources: { ar: 'الحقائب', en: 'Resources' }, live: { ar: 'البث المباشر', en: 'Live' }, sim: { ar: 'المحاكيات', en: 'Simulators' }, councils: { ar: 'المجالس', en: 'Councils' },
  about: { ar: 'عن أَثَر', en: 'About' }, contact: { ar: 'تواصل', en: 'Contact' }, ai: { ar: 'الذكاء الاصطناعي المسؤول', en: 'Responsible AI' },
  me: { ar: 'مساحتي', en: 'My space' }, org: { ar: 'بوابة الجهات', en: 'Organizations' }, hub: { ar: 'الردهة', en: 'Hall' }, login: { ar: 'الدخول', en: 'Sign in' }, join: { ar: 'الانضمام', en: 'Join' },
  help: { ar: 'المساعدة', en: 'Help' }, verify: { ar: 'التحقق من شهادة', en: 'Verify' }, credential: { ar: 'الشهادة', en: 'Credential' }, pay: { ar: 'الدفع', en: 'Payment' }, p: { ar: 'صفحة عامة', en: 'Public page' },
  accessibility: { ar: 'الوصولية', en: 'Accessibility' }, miaar: { ar: 'مِعيار', en: 'Mi‘yar' }, 'miaar/result': { ar: 'النتيجة', en: 'Result' }, 'miaar/trust': { ar: 'سجلّ الصدق', en: 'Trust record' }, 'miaar/d': { ar: 'دعوة', en: 'Invitation' },
  admin: { ar: 'الإدارة', en: 'Admin' }, 'admin/miaar': { ar: 'مِعيار', en: 'Mi‘yar' }, 'admin/miaar/bank': { ar: 'بنك البنود', en: 'Item bank' }, 'admin/miaar/forms': { ar: 'منشئ النماذج', en: 'Form builder' },
  'admin/miaar/invites': { ar: 'الدعوات', en: 'Invitations' }, 'admin/miaar/balance': { ar: 'الميزان', en: 'Balance' }, 'admin/miaar/rating': { ar: 'التصحيح', en: 'Rating' },
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' }, reports: { ar: 'التقارير', en: 'Reports' }, 'command-center': { ar: 'مركز القيادة', en: 'Command center' },
  skills: { ar: 'ملفي المهاري', en: 'My skills' }, twin: { ar: 'توأمي المهاري', en: 'My twin' }, missions: { ar: 'مهماتي', en: 'My missions' }, after: { ar: 'ما بعد البرنامج', en: 'After the program' }, pair: { ar: 'رفيقي', en: 'My pair' },
  trust: { ar: 'سجلّ الصدق', en: 'Trust' }, result: { ar: 'النتيجة', en: 'Result' }, bank: { ar: 'بنك البنود', en: 'Item bank' }, forms: { ar: 'النماذج', en: 'Forms' }, invites: { ar: 'الدعوات', en: 'Invitations' }, balance: { ar: 'الميزان', en: 'Balance' }, rating: { ar: 'التصحيح', en: 'Rating' },
};
const HOME: L = { ar: 'الرئيسية', en: 'Home' };
/** مقطع يبدو رمزًا/معرّفًا (uuid · ML-XXXX-XXXX · أرقام · رموز طويلة) → يُعرض باسم عام لا بقيمته */
export const looksLikeId = (seg: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^ML-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(seg) || /^\d+$/.test(seg) || (/^[A-Za-z0-9_]{16,}$/.test(seg) && !NAMES[seg]);
const DETAIL: L = { ar: 'التفاصيل', en: 'Details' };
const pick = (l: L, lang: 'ar' | 'en') => (lang === 'ar' ? l.ar : l.en);
/** فتات الطريق من المسار: «الرئيسية › مِعيار › النتيجة» — المركّب يسبق المفرد (admin/miaar قبل miaar) */
export function crumbsFor(pathname: string, lang: 'ar' | 'en' = 'ar'): Crumb[] {
  const clean = (pathname || '/').split('?')[0].split('#')[0]; const segs = clean.split('/').filter(Boolean);
  const out: Crumb[] = [{ href: '/', label: pick(HOME, lang), current: segs.length === 0 }];
  let href = '';
  segs.forEach((seg, i) => {
    href += `/${seg}`; const key2 = segs.slice(Math.max(0, i - 2), i + 1).join('/'); const key1 = segs.slice(Math.max(0, i - 1), i + 1).join('/');
    const named = NAMES[key2] || NAMES[key1] || NAMES[seg];
    const label = named ? pick(named, lang) : looksLikeId(seg) ? pick(DETAIL, lang) : decodeURIComponent(seg).replace(/[-_]+/g, ' ');
    out.push({ href, label, current: i === segs.length - 1 });
  });
  return out;
}
/** المسار الأب للرجوع حين لا يوجد تاريخ متصفح صالح (أو جاء الزائر من رابط خارجي) */
export function parentOf(pathname: string): string {
  const segs = (pathname || '/').split('?')[0].split('/').filter(Boolean); if (segs.length <= 1) return '/';
  return '/' + segs.slice(0, -1).join('/');
}
/** هل يُظهَر الشريط في هذا المسار؟ الرئيسية لها بطلها، ولوحة التحكم لها قائمتها الجانبية */
export const showWay = (pathname: string): boolean => !!pathname && pathname !== '/' && !pathname.startsWith('/dashboard');

/** سجلّ الطريق داخل التبويب (sessionStorage): يميّز الرجوع الحقيقي عن القفز لصفحة أب — لأن document.referrer لا يتغيّر مع تنقّل SPA */
export function updateStack(stack: readonly string[], pathname: string): string[] {
  if (!pathname) return [...stack]; const last = stack[stack.length - 1];
  if (last === pathname) return [...stack];
  if (stack.length >= 2 && stack[stack.length - 2] === pathname) return stack.slice(0, -1); /* رجوع بزر المتصفح */
  return [...stack.slice(-39), pathname];
}
const STACK_KEY = 'athar:way-stack';
export function recordWay(pathname: string): void {
  if (typeof window === 'undefined') return;
  try { const cur = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]'); sessionStorage.setItem(STACK_KEY, JSON.stringify(updateStack(Array.isArray(cur) ? cur : [], pathname))); } catch { /* خاص */ }
}
/** هل يوجد سجلّ داخل الموقع يصلح للرجوع إليه؟ */
export function hasWayHistory(): boolean {
  if (typeof window === 'undefined') return false;
  try { const cur = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]'); return Array.isArray(cur) && cur.length > 1 && window.history.length > 1; } catch { return false; }
}
