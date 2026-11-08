// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «الطريق» — خريطة أسماء المسارات لشريط التنقّل الموحّد (رجوع · الرئيسية · مسار الصفحة). منطق خالص قابل للاختبار. */
export type Crumb = { href: string; label: string; current: boolean; /** مقطع بلا صفحة خاصة (مجلّد مسارات فقط) → يُعرض نصًّا لا رابطًا */ dead?: boolean };
/** مقاطع لا صفحة لها (تحتها صفحات ديناميكية فقط) — لا تُربَط في الفتات ولا يُرجَع إليها (كانت تعطي 404) */
export const NO_PAGE = new Set(['/attend', '/contract', '/credential', '/e', '/evaluate', '/followup', '/g', '/impact', '/join', '/journey', '/live/copilot', '/live/facilitator', '/m', '/m/confirm', '/miaar/d', '/miaar/result', '/miaar/growth', '/miaar/certificate', '/miaar/client', '/miaar/practice', '/me/reports/line', '/oauth', '/on-air/seasons/year', '/org-journey', '/p', '/pay', '/room', '/survey', '/verify/report']);
type L = { ar: string; en: string };
/** أسماء المقاطع المعروفة (المقطع الأول أو المركّب) — الأسماء الرسمية كما في القوائم */
const NAMES: Record<string, L> = {
  services: { ar: 'الخدمات', en: 'Services' }, programs: { ar: 'البرامج', en: 'Programs' }, consulting: { ar: 'الاستشارات', en: 'Consulting' },
  resources: { ar: 'الحقائب', en: 'Resources' }, live: { ar: 'البث المباشر', en: 'Live' }, sim: { ar: 'المحاكيات', en: 'Simulators' }, councils: { ar: 'المجالس', en: 'Councils' },
  about: { ar: 'عن أَثَر', en: 'About' }, contact: { ar: 'تواصل', en: 'Contact' }, ai: { ar: 'الذكاء الاصطناعي المسؤول', en: 'Responsible AI' },
  needs: { ar: 'ما يحتاجه الممارسون', en: 'What practitioners need' }, 'admin/needs': { ar: 'الاحتياج المعلَن', en: 'Declared needs' },
  rehearsal: { ar: 'بروفاتي', en: 'My rehearsals' }, 'me/rehearsal': { ar: 'بروفاتي', en: 'My rehearsals' }, 'admin/rehearsals': { ar: 'البروفات', en: 'Rehearsals' },
  'e': { ar: 'رابط تقويم', en: 'Evaluation link' }, 'evaluate': { ar: 'التقويم', en: 'Evaluation' }, 'evaluate/end': { ar: 'استبيان نهاية البرنامج', en: 'End-of-program survey' }, 'evaluate/daily': { ar: 'التقييم اليومي', en: 'Daily evaluation' }, 'evaluate/final': { ar: 'التقييم الختامي', en: 'Final evaluation' },   // P49
  'me/reports': { ar: 'تقاريري', en: 'My reports' }, 'me/accreditation': { ar: 'ملف الاعتماد الحيّ', en: 'Live accreditation file' }, 'admin/accreditation': { ar: 'ملفات الاعتماد', en: 'Accreditation files' }, 'verify/accreditation': { ar: 'التحقّق من ملف اعتماد', en: 'Verify accreditation file' }, 'me/reports/line': { ar: 'صفحتي في التقرير الختامي', en: 'My page in the final report' }, 'admin/reports': { ar: 'التقارير', en: 'Reports' }, 'verify/report': { ar: 'التحقّق من تقرير', en: 'Verify a report' },
  'me/first': { ar: 'أول يوم', en: 'First day' }, /* P64 */
  'me/line': { ar: 'سطري', en: 'My line' }, /* P66 */
  'me/diploma': { ar: 'هيكل الدبلوم', en: 'Diploma structure' }, /* P66-ب */
  me: { ar: 'مساحتي', en: 'My space' }, org: { ar: 'بوابة الجهات', en: 'Organizations' }, hub: { ar: 'الردهة', en: 'Hall' }, login: { ar: 'الدخول', en: 'Sign in' }, join: { ar: 'الانضمام', en: 'Join' },
  help: { ar: 'المساعدة', en: 'Help' }, verify: { ar: 'التحقق من شهادة', en: 'Verify' }, 'verify/policy': { ar: 'ختم سياسة الجهة', en: 'Policy seal' }, 'org/report': { ar: 'طباعة تقرير القيادة', en: 'Print leadership report' }, enter: { ar: 'الدخول بالرمز', en: 'Enter with code' }, credential: { ar: 'الشهادة', en: 'Credential' }, pay: { ar: 'الدفع', en: 'Payment' }, p: { ar: 'صفحة عامة', en: 'Public page' },
  accessibility: { ar: 'الوصولية', en: 'Accessibility' }, miaar: { ar: 'مِعيار', en: 'Mi‘yar' }, 'miaar/result': { ar: 'النتيجة', en: 'Result' }, 'miaar/practice': { ar: 'مِران', en: 'Practice' }, 'api/notices': { ar: 'التنبيهات', en: 'Notices' }, 'miaar/trust': { ar: 'سجلّ الصدق', en: 'Trust record' }, 'miaar/d': { ar: 'دعوة', en: 'Invitation' },
  admin: { ar: 'الإدارة', en: 'Admin' }, 'admin/miaar': { ar: 'مِعيار', en: 'Mi‘yar' }, 'admin/miaar/bank': { ar: 'بنك البنود', en: 'Item bank' }, 'admin/miaar/forms': { ar: 'منشئ النماذج', en: 'Form builder' },
  'admin/sign': { ar: 'توقيعي', en: 'My signatures' }, /* P50 */ 'me/day': { ar: 'دفتر اليوم', en: 'Day book' }, /* P51 */ 'admin/org': { ar: 'الجهات', en: 'Organizations' }, 'admin/org/letters': { ar: 'رسالة الشهر', en: 'Monthly letter' }, 'verify/letter': { ar: 'تحقّق من رسالة الشهر', en: 'Verify monthly letter' }, /* P52 */ 'me/athar-map': { ar: 'خريطة أثرك', en: 'Your impact map' }, 'verify/map': { ar: 'تحقّق من خريطة أثري', en: 'Verify impact map' }, /* P58 */ 'me/day/weave': { ar: 'نسيج الشعبة', en: 'Section weave' }, /* P59 */ 'me/letter': { ar: 'رسالة إلى نفسي', en: 'Letter to myself' }, 'me/grad': { ar: 'يوم تخرّجي', en: 'Graduation day' }, 'verify/grad': { ar: 'تحقّق من صفحة تخرّج', en: 'Verify graduation page' }, g: { ar: 'صفحة تخرّج', en: 'Graduation page' }, /* P63 */ /* P62 */ 'admin/miaar/invites': { ar: 'الدعوات', en: 'Invitations' }, 'admin/miaar/balance': { ar: 'الميزان', en: 'Balance' }, 'admin/miaar/rating': { ar: 'التصحيح', en: 'Rating' }, 'admin/miaar/ledger': { ar: 'السجلّ', en: 'Ledger' }, 'admin/miaar/growth': { ar: 'النموّ', en: 'Growth' }, 'miaar/growth': { ar: 'رحلة المتقدّم', en: 'Journey' }, 'admin/miaar/exit': { ar: 'نهاية المستوى', en: 'Level exit' }, 'miaar/certificate': { ar: 'شهادة اجتياز المستوى', en: 'Level certificate' }, 'miaar/client': { ar: 'بوابة الجهة', en: 'Client portal' }, 'admin/miaar/witness': { ar: 'غرفة الشاهد', en: 'Witness room' }, 'admin/miaar/hall': { ar: 'قاعة الشاهد', en: 'Proctoring hall' }, 'admin/miaar/syllabus': { ar: 'خريطة المنهج', en: 'Syllabus Map' },
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
    out.push({ href, label, current: i === segs.length - 1, ...(NO_PAGE.has(href) && i < segs.length - 1 ? { dead: true } : {}) });
  });
  return out;
}
/** المسار الأب للرجوع حين لا يوجد تاريخ متصفح صالح (أو جاء الزائر من رابط خارجي) */
export function parentOf(pathname: string): string {
  const segs = (pathname || '/').split('?')[0].split('/').filter(Boolean);
  for (let n = segs.length - 1; n >= 1; n--) { const p = '/' + segs.slice(0, n).join('/'); if (!NO_PAGE.has(p)) return p; }
  return '/';
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
