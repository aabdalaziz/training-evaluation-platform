// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «تحدّث أو اطلب» — محلّل نيّات التنقّل (منطق خالص بلا متصفح): نصّ منطوق أو مكتوب → نيّة واحدة.
 *  يفهم الفصحى واللهجات الشائعة («روح»، «ودّيني»، «وين أنا»)، ويطابق أسماء الخدمات بالتطبيع العربي (همزات · تاء مربوطة · تشكيل · «ال»).
 *  القاعدة: الأمر الغامض لا يُنفَّذ — يعود unknown ويُعرض للمستخدم ما سُمع. */

export { LAST_KEY, CUR_KEY, ZOOM_KEY } from './voice-keys';

export type Intent =
  | { kind: 'go'; href: string; label: string }
  | { kind: 'home' } | { kind: 'back' } | { kind: 'where' } | { kind: 'resume_last' }
  | { kind: 'scroll'; dir: 'up' | 'down' | 'top' | 'bottom' }
  | { kind: 'read' } | { kind: 'next' } | { kind: 'time' } | { kind: 'stop' }
  | { kind: 'zoom'; dir: 'in' | 'out' }
  | { kind: 'search'; q: string }
  | { kind: 'help' }
  | { kind: 'unknown'; heard: string };

export type Destination = { href: string; label: string; aliases: string[]; admin?: boolean };
/** الوجهات العامة (مسارات موجودة فعلًا) — الاسم الرسمي أولًا ثم ما يقوله الناس */
export const DESTINATIONS: Destination[] = [
  { href: '/', label: 'الرئيسية', aliases: ['الرئيسية', 'الصفحة الرئيسية', 'البداية', 'البيت', 'الهوم'] },
  { href: '/services', label: 'الخدمات', aliases: ['الخدمات', 'خدمات اثر', 'كل الخدمات'] },
  { href: '/programs', label: 'البرامج', aliases: ['البرامج', 'البرامج التدريبية', 'الدورات', 'التدريب', 'دورات'] },
  { href: '/consulting', label: 'الاستشارات', aliases: ['الاستشارات', 'استشارة', 'الاستشاره'] },
  { href: '/resources', label: 'الحقائب', aliases: ['الحقائب', 'الحقائب التدريبية', 'المواد', 'المصادر'] },
  { href: '/live', label: 'البث المباشر', aliases: ['البث المباشر', 'البث', 'المباشر', 'لايف'] },
  { href: '/sim', label: 'المحاكيات', aliases: ['المحاكيات', 'المحاكي', 'محاكاة'] },
  { href: '/councils', label: 'المجالس', aliases: ['المجالس', 'مجلس', 'مجالس اثر'] },
  { href: '/on-air', label: 'على الهواء', aliases: ['على الهواء', 'الهواء', 'اون اير'] },
  { href: '/experts', label: 'الخبراء', aliases: ['الخبراء', 'الخبير', 'بوابة الخبراء'] },
  { href: '/trainers', label: 'المدرّبون', aliases: ['المدربون', 'المدربين', 'المدرب', 'بوابة المدربين'] },
  { href: '/observatory', label: 'المرصد', aliases: ['المرصد', 'مرصد المهارات'] },
  { href: '/2062', label: 'أَثَر 2062', aliases: ['2062', 'الفين واثنين وستين', 'المستقبل', 'اثر 2062'] },
  { href: '/about', label: 'عن أَثَر', aliases: ['عن اثر', 'من نحن', 'عن المنصة', 'تعريف'] },
  { href: '/contact', label: 'تواصل', aliases: ['تواصل', 'اتصل', 'اتصل بنا', 'تواصل معنا', 'التواصل'] },
  { href: '/ai', label: 'الذكاء الاصطناعي المسؤول', aliases: ['الذكاء الاصطناعي', 'الذكاء', 'سياسة الذكاء'] },
  { href: '/privacy', label: 'الخصوصية', aliases: ['الخصوصية', 'سياسة الخصوصية', 'البيانات'] },
  { href: '/accessibility', label: 'الوصولية', aliases: ['الوصولية', 'اثر للجميع', 'التيسيرات', 'ذوي الاعاقة'] },
  { href: '/help', label: 'المساعدة', aliases: ['المساعدة', 'مساعدة', 'الدعم', 'ساعدني', 'الاسئلة الشائعة'] },
  { href: '/verify', label: 'التحقق من شهادة', aliases: ['التحقق من شهادة', 'التحقق', 'تحقق من الشهادة', 'الشهادات', 'تحقق'] },
  { href: '/login', label: 'الدخول', aliases: ['الدخول', 'تسجيل الدخول', 'سجل دخول', 'دخول', 'حسابي'] },
  { href: '/me', label: 'مساحتي', aliases: ['مساحتي', 'صفحتي', 'ملفي', 'مساحة'] },
  { href: '/me/day', label: 'دفتر اليوم', aliases: ['دفتر اليوم', 'دفتري', 'يومي', 'ماذا عندي اليوم', 'غاب امس', 'الغائبون', 'صباحي'] }, /* P51 */
  { href: '/me/day#dy-word', label: 'كلمة بصوتي', aliases: ['كلمة بصوتي', 'سجل كلمة', 'سجّل كلمة', 'كلمة صوتية', 'قلها بصوتي', 'قُلها بصوتي'] }, /* P55 */
  { href: '/me/day#replies', label: 'ردود على كلمتي', aliases: ['ردود كلمتي', 'ردود على كلمتي', 'الردود على كلمتي', 'ردود المتعلمين', 'من رد علي', 'شغل امانات اليوم', 'شغّل أمانات اليوم', 'امانات اليوم', 'الامانات الصوتية', 'اسمع امانات اليوم'] }, /* P53 · P54 */
  { href: '/me/skills', label: 'ملفي المهاري', aliases: ['ملفي المهاري', 'مهاراتي', 'المهارات'] },
  { href: '/me/twin', label: 'توأمي المهاري', aliases: ['توامي المهاري', 'توامي', 'التوام'] },
  { href: '/me/missions', label: 'مهماتي', aliases: ['مهماتي', 'المهمات', 'مهامي'] },
  { href: '/me/journey', label: 'رحلتي', aliases: ['رحلتي', 'الرحلة'] },
  { href: '/me/card', label: 'بطاقتي', aliases: ['بطاقتي', 'البطاقة'] },
  { href: '/me/data', label: 'بياناتي', aliases: ['بياناتي', 'خزنتي', 'الخزنة'] },
  { href: '/hub', label: 'الردهة', aliases: ['الردهة', 'الرَدهة', 'ردهة'] },
  { href: '/org', label: 'بوابة الجهات', aliases: ['بوابة الجهات', 'الجهات', 'المؤسسات', 'جهتي'] },
  { href: '/miaar', label: 'مِعيار', aliases: ['معيار', 'اختبار تحديد المستوى', 'تحديد المستوى', 'حدد مستواك', 'الاختبار', 'اختبار اللغة', 'مستواي'] },
  { href: '/miaar/trust', label: 'سجلّ الصدق', aliases: ['سجل الصدق', 'الصدق', 'موثوقية معيار'] },
  { href: '/dashboard', label: 'لوحة التحكم', aliases: ['لوحة التحكم', 'اللوحة', 'الداشبورد'], admin: true },
  { href: '/admin/sign', label: 'توقيعي', aliases: ['توقيعي', 'ما ينتظر توقيعي', 'ينتظر توقيعي', 'التوقيعات', 'التوقيعات المعلقة'], admin: true }, /* P50 */
  { href: '/admin/org/letters', label: 'رسالة الشهر', aliases: ['رسالة الشهر', 'رسائل الشهر', 'رسائل الجهات', 'الرسالة الشهرية', 'التقرير الشهري للجهة'], admin: true }, /* P52 */
  { href: '/admin/miaar', label: 'إدارة مِعيار', aliases: ['ادارة معيار', 'لوحة معيار', 'معيار الادارة'], admin: true },
  { href: '/admin/miaar/bank', label: 'بنك البنود', aliases: ['بنك البنود', 'البنك', 'بنك الاسئلة', 'البنود'], admin: true },
  { href: '/admin/miaar/forms', label: 'النماذج', aliases: ['النماذج', 'المخططات', 'نماذج الاختبار'], admin: true },
  { href: '/admin/miaar/invites', label: 'الدعوات', aliases: ['الدعوات', 'دعوات معيار', 'الدعوه'], admin: true },
  { href: '/admin/miaar/balance', label: 'الميزان', aliases: ['الميزان', 'ميزان معيار', 'الموثوقية'], admin: true },
  { href: '/admin/miaar/rating', label: 'التصحيح', aliases: ['التصحيح', 'قائمة التصحيح', 'المصحح', 'غرفة التصحيح'], admin: true },
  { href: '/admin/miaar/ledger', label: 'سجلّ مِعيار', aliases: ['السجل', 'سجل معيار', 'سجل النتائج', 'ادارة النتائج', 'الارشيف', 'قرار التسكين'], admin: true },
  { href: '/admin/roles', label: 'الأدوار', aliases: ['الادوار', 'الصلاحيات'], admin: true },
  { href: '/admin/vault', label: 'خزنة أَثَر', aliases: ['خزنة اثر', 'الخزنه', 'خزنة'], admin: true },
  { href: '/admin/shield', label: 'درع أَثَر', aliases: ['درع اثر', 'الدرع', 'الامان'], admin: true },
  { href: '/admin/placements', label: 'التسكين', aliases: ['التسكين', 'تسكين المتقدمين'], admin: true },
  { href: '/admin/inbox', label: 'الوارد', aliases: ['الوارد', 'صندوق الوارد', 'الرسائل'], admin: true },
];

/** تطبيع عربي للمطابقة: تشكيل · همزات · تاء مربوطة · ألف مقصورة · تطويل · ترقيم · «ال» التعريف */
export function normalizeCmd(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}
const stripAl = (w: string) => w.replace(/^(و|ف)?(ال|لل|بال|وال|فال)/, '');
const toks = (s: string) => normalizeCmd(s).split(' ').filter(Boolean);
const bare = (s: string) => toks(s).map(stripAl).filter((w) => w.length > 1);

/** أفعال الحركة وحروف الوصل التي تُحذف قبل مطابقة الوجهة */
const GO_WORDS = ['افتح', 'افتحي', 'فتح', 'روح', 'رح', 'اذهب', 'اذهبي', 'انتقل', 'انتقلي', 'خذني', 'خدني', 'وديني', 'وصلني', 'وريني', 'اعرض', 'اعرضي', 'شغل', 'ابدا', 'ابدأ', 'ادخل', 'ادخلني', 'دخلني', 'صفحة', 'صفحه', 'قسم', 'خدمة', 'خدمه', 'بوابة', 'بوابه', 'على', 'الى', 'الي', 'إلى', 'ل', 'لي', 'عند', 'في', 'من فضلك', 'لو سمحت', 'ابي', 'ابغى', 'اريد', 'بدي', 'عايز', 'ممكن', 'يا اثر', 'اثر'];
const hasAny = (n: string, list: string[]) => list.some((p0) => { const p = normalizeCmd(p0); return n === p || n.startsWith(p + ' ') || n.endsWith(' ' + p) || n.includes(' ' + p + ' '); });

export function parseCommand(raw: string, ctx: { admin?: boolean; inExam?: boolean } = {}): Intent {
  const n = normalizeCmd(raw); if (!n) return { kind: 'unknown', heard: raw };
  /* نيّات ثابتة أولًا (قصيرة وقاطعة) */
  if (hasAny(n, ['اين انا', 'وين انا', 'انا فين', 'انا وين', 'في اي صفحه', 'في اي صفحة', 'اين نحن'])) return { kind: 'where' };
  if (hasAny(n, ['وين وقفت', 'اين توقفت', 'حيث توقفت', 'اخر صفحه', 'اخر صفحة', 'اكمل من حيث', 'كمل'])) return { kind: 'resume_last' };
  if (hasAny(n, ['ارجع', 'رجوع', 'رجعني', 'للخلف', 'الخلف', 'ارجعي', 'الصفحه السابقه', 'الصفحة السابقة', 'عودة', 'عوده', 'باك'])) return { kind: 'back' };
  if (hasAny(n, ['كم بقي', 'كم باقي', 'الوقت المتبقي', 'كم الوقت', 'باقي كم', 'بقي كم', 'الوقت'])) return { kind: 'time' };
  if (hasAny(n, ['اقرا', 'اقرأ', 'اقري', 'اقرالي', 'اقرا لي', 'اسمعني', 'سمعني', 'قراءه', 'قراءة'])) return { kind: 'read' };
  if (hasAny(n, ['اسكت', 'توقف', 'وقف', 'كفايه', 'كفاية', 'الغاء', 'الغ', 'ستوب', 'خلاص'])) return { kind: 'stop' };
  if (hasAny(n, ['التالي', 'السؤال التالي', 'السوال التالي', 'بعده', 'اللي بعده', 'التالية', 'التاليه', 'كمل للتالي'])) return { kind: 'next' };
  if (hasAny(n, ['كبر الخط', 'كبر', 'تكبير', 'اكبر'])) return { kind: 'zoom', dir: 'in' };
  if (hasAny(n, ['صغر الخط', 'صغر', 'تصغير', 'اصغر'])) return { kind: 'zoom', dir: 'out' };
  if (hasAny(n, ['اعلى الصفحه', 'اعلى الصفحة', 'اول الصفحه', 'اول الصفحة', 'فوق خالص', 'البدايه', 'البداية']) && !hasAny(n, GO_WORDS)) return { kind: 'scroll', dir: 'top' };
  if (hasAny(n, ['اخر الصفحه', 'اخر الصفحة', 'اسفل الصفحه', 'اسفل الصفحة', 'تحت خالص', 'النهايه', 'النهاية'])) return { kind: 'scroll', dir: 'bottom' };
  if (hasAny(n, ['فوق', 'اطلع', 'اصعد', 'لفوق', 'اعلى'])) return { kind: 'scroll', dir: 'up' };
  if (hasAny(n, ['تحت', 'انزل', 'نزل', 'لتحت', 'اسفل'])) return { kind: 'scroll', dir: 'down' };
  if (hasAny(n, ['ماذا اقول', 'ماذا يمكنني', 'الاوامر', 'الأوامر', 'ايش اقول', 'وش اقول', 'ساعدني هنا', 'كيف استخدم'])) return { kind: 'help' };
  const sm = n.match(/^(?:ابحث|ابحثي|بحث|دور|دوري|فتش|ابي ابحث|اريد ابحث)\s*(?:عن|علي|لي)?\s*(.+)$/);
  if (sm && sm[1].trim().length >= 2) { const rawWords = raw.trim().split(/\s+/); const q = rawWords.slice(rawWords.length - sm[1].trim().split(' ').length).join(' ').replace(/[؟?!.،]+$/g, ''); return { kind: 'search', q: q || sm[1].trim() }; }
  /* الوجهات: نحذف أفعال الحركة ثم نطابق أطول اسم مستعار تُغطّى كل كلماته */
  const goSet = new Set(GO_WORDS.flatMap((g) => bare(g))); const words = bare(n).filter((w) => !goSet.has(w) && !['من', 'فضلك', 'سمحت', 'لو'].includes(w));
  if (!words.length) return hasAny(n, ['الرئيسيه', 'الرئيسية', 'البيت', 'الهوم']) ? { kind: 'home' } : { kind: 'unknown', heard: raw };
  let best: { d: Destination; score: number } | null = null;
  for (const d of DESTINATIONS) {
    if (d.admin && !ctx.admin) continue;
    for (const a of d.aliases) {
      const aw = bare(a); if (!aw.length) continue;
      const covered = aw.every((w) => words.some((x) => x === w || (w.length >= 4 && (x.startsWith(w) || w.startsWith(x)))));
      if (!covered) continue;
      const score = aw.length * 10 + aw.join('').length - Math.abs(words.length - aw.length);
      if (!best || score > best.score) best = { d, score };
    }
  }
  if (best) return best.d.href === '/' ? { kind: 'home' } : { kind: 'go', href: best.d.href, label: best.d.label };
  return { kind: 'unknown', heard: raw };
}

/** الجملة التي يردّ بها أَثَر (تظهر وتُقرأ) */
export function describeIntent(i: Intent, lang: 'ar' | 'en' = 'ar'): string {
  const ar = lang === 'ar';
  switch (i.kind) {
    case 'go': return ar ? `أفتح ${i.label}` : `Opening ${i.label}`;
    case 'home': return ar ? 'أعود إلى الرئيسية' : 'Going home';
    case 'back': return ar ? 'أرجع خطوة' : 'Going back';
    case 'where': return ar ? 'أقرأ لك مكانك' : 'Reading your location';
    case 'resume_last': return ar ? 'أعيدك حيث توقفت' : 'Resuming where you left';
    case 'scroll': return ar ? (i.dir === 'up' ? 'أصعد' : i.dir === 'down' ? 'أنزل' : i.dir === 'top' ? 'إلى أعلى الصفحة' : 'إلى آخر الصفحة') : `Scrolling ${i.dir}`;
    case 'read': return ar ? 'أقرأ' : 'Reading';
    case 'next': return ar ? 'التالي' : 'Next';
    case 'time': return ar ? 'الوقت المتبقي' : 'Time left';
    case 'stop': return ar ? 'توقّفت' : 'Stopped';
    case 'zoom': return ar ? (i.dir === 'in' ? 'أكبّر الخط' : 'أصغّر الخط') : (i.dir === 'in' ? 'Larger text' : 'Smaller text');
    case 'search': return ar ? `أبحث عن «${i.q}»` : `Searching “${i.q}”`;
    case 'help': return ar ? 'أمثلة لما يمكنك قوله' : 'Examples of what you can say';
    default: return ar ? `لم أفهم: «${i.heard}»` : `Didn't get: “${i.heard}”`;
  }
}
/** أمثلة تُعرض للمستخدم (تختلف داخل الاختبار) */
export const EXAMPLES = (ctx: { admin?: boolean; inExam?: boolean }): string[] =>
  ctx.inExam ? ['اقرأ السؤال', 'التالي', 'كم بقي من الوقت؟', 'كبّر الخط']
  : ctx.admin ? ['افتح بنك البنود', 'قائمة التصحيح', 'الدعوات', 'أين أنا؟', 'ارجع']
  : ['افتح مِعيار', 'خذني إلى البرامج', 'أين أنا؟', 'ارجع', 'ابحث عن شهادة', 'كبّر الخط'];
