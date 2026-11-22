// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «أقسام مركز القيادة» (هـ-3 و) — «الكلّ لا يرى الكلّ»:
 *  مركز القيادة خمسة بيوت بحسب المستوى الذي يديره الشخص، لكلّ بيت بابه وعلامته ولونه وغرفه:
 *  برامج أَثَر (يدير التنفيذ) · تقييم أَثَر (يدير المستوى) · جودة أَثَر (يدير الأثر) · إدارة أَثَر (يدير العلاقة) · نظام أَثَر (يدير المنصّة)
 *  · من يملك قسمًا واحدًا يدخله مباشرة؛ ومن يملك أكثر يعود إلى آخر قسم فتحه، ومن «الردهة» يبدّل.
 *  · داخل القسم لا تظهر إلّا غرفه + الغرف المشتركة (توقيعي · الإشعارات · الدليل · لوحة القيادة).
 *  · الغرفة الواحدة قد تسكن قسمين (شواهد الأثر: تقييم وجودة) — تبقى غرفةً واحدة بمصدر واحد.
 *  خالص (بلا React) حتى يُختبر ويُستعمل خادمًا وعميلًا.
 */
import { ROOMS, canOpen, roomFor, type Room } from './rooms';

export type WingKey = 'programs' | 'assess' | 'quality' | 'people' | 'system';
export type Wing = { key: WingKey; name: string; verb: string; line: string; zone: string; tone: string; tone_soft: string; tone_dark: string; hrefs: string[] };

export const WINGS: Wing[] = [
  { key: 'programs', name: 'برامج أَثَر', verb: 'يدير التنفيذ', line: 'البرامج والجلسات والقاعات والحقائب والحضور', zone: 'programs', tone: '#D4614A', tone_soft: '#FBEDE7', tone_dark: '#E8795C',
    hrefs: ['/admin/management', '/admin/catalog', '/admin/program-engineering', '/admin/resources', '/admin/live', '/admin/onair', '/admin/attendance', '/admin/readiness', '/admin/templates', '/admin/awards', '/admin/rehearsals', '/admin/sim', '/admin/councils', '/admin/pulse', '/admin/media', '/admin/missions', '/admin/inclusion'] },
  { key: 'assess', name: 'تقييم أَثَر', verb: 'يدير المستوى', line: 'مِعيار واقْرَأْ والتسكين والشواهد والشهادات', zone: 'miaar', tone: '#E8795C', tone_soft: '#FBEDE7', tone_dark: '#F3A58F',
    hrefs: ['/admin/miaar', '/admin/miaar/rating', '/admin/iqra', '/admin/placements', '/admin/needs', '/admin/evidence', '/admin/credentials', '/admin/certificates', '/admin/skills'] },
  { key: 'quality', name: 'جودة أَثَر', verb: 'يدير الأثر', line: 'قياس الأثر ونقله والمتابعة والتقارير وعقود الأثر', zone: 'pulse', tone: '#5EA8A0', tone_soft: '#E6F3F1', tone_dark: '#8FD0C8',
    hrefs: ['/command-center', '/admin/followup', '/admin/impact', '/admin/outcomes', '/admin/after', '/admin/loop', '/admin/contracts', '/admin/twin', '/admin/evidence', '/admin/reports', '/reports', '/reports/center', '/reports/chain', '/reports/program', '/reports/cohorts', '/reports/remote-survey', '/final-analysis', '/admin/sector-impact', '/admin/observatory'] },
  { key: 'people', name: 'إدارة أَثَر', verb: 'يدير العلاقة', line: 'التسجيل والمالية والوارد والاستشارات وهيئة أَثَر الاستشارية', zone: 'org', tone: '#6A3350', tone_soft: '#F3E8EF', tone_dark: '#B07A9A',
    hrefs: ['/admin/enrollments', '/admin/payments', '/admin/inbox', '/admin/consulting', '/admin/directory', '/admin/org/letters', '/admin/outreach'] },
  { key: 'system', name: 'نظام أَثَر', verb: 'يدير المنصّة', line: 'الأدوار والدرع والبيانات والتدقيق والصحّة', zone: 'staff', tone: '#D9A866', tone_soft: '#FBF4EE', tone_dark: '#F6D9A8',
    hrefs: ['/admin/roles', '/admin/shield', '/admin/vault', '/admin/data-lifecycle', '/admin/agents', '/admin/audit', '/admin/health', '/admin/backup', '/admin/access', '/admin/demo'] },
];
/** غرف مشتركة تظهر في كلّ قسم (ولا تُحسب قسمًا) */
export const SHARED_HREFS = ['/dashboard', '/admin/sign', '/admin/notifications', '/help'];
export const LOBBY_HREF = '/dashboard?lobby=1';
export const LAST_WING_KEY = 'athar_wing';

const under = (p: string, h: string) => p === h || p.startsWith(h + '/');
export const wingByKey = (k: string | null | undefined): Wing | undefined => WINGS.find(w => w.key === k);
export const isShared = (href: string) => SHARED_HREFS.some(h => under(href, h));
/** الأقسام التي تسكنها غرفة (الأطول مطابقةً أوّلًا؛ /admin/miaar/rating قبل /admin/miaar) */
export function wingsOfHref(href: string): Wing[] {
  const hit = WINGS.filter(w => w.hrefs.some(h => under(href, h)));
  if (hit.length) return hit;
  /* غرفة غير مصنَّفة تحت /admin → نظام أَثَر (أضيق باب)؛ /reports/* → الجودة */
  if (href.startsWith('/reports')) return [WINGS[2]];
  if (href.startsWith('/admin')) return [WINGS[4]];
  return [];
}
/** غرف القسم المعروفة في خريطة الغرف */
export const roomsOfWing = (w: Wing): Room[] => ROOMS.filter(r => w.hrefs.some(h => under(r.href, h)));
/** غرفة «اختصاص»: تُفتح بصلاحية مسمّاة لا بمجرد كوني طاقمًا — هي ما يحدّد قسمي */
const specialty = (r: Room, perms: string[]) => r.perms.some(p => p !== 'admin' && p !== 'staff' && (perms.includes(p) || perms.includes(`${p.split('.')[0]}.*`)));
/** أقسامي: ما فيه غرفة اختصاص واحدة على الأقل (الصلاحية الكاملة تفتح الخمسة)؛ طاقم بلا اختصاص → الأقسام التي فيها غرف طاقم */
export function wingsFor(perms: string[] | null | undefined, staff: boolean): Wing[] {
  if (!perms) return [];
  if (perms.includes('*')) return WINGS;
  const mine = WINGS.filter(w => roomsOfWing(w).some(r => specialty(r, perms)));
  if (mine.length) return mine;
  return WINGS.filter(w => roomsOfWing(w).some(r => canOpen(r, perms, staff)));
}
/** القسم الذي نقف فيه الآن: غرفة بقسم واحد → هو؛ غرفة بقسمين → آخر قسم فتحته إن كان أحدهما؛ غرفة مشتركة → آخر قسم أو أوّل أقسامي */
export function resolveWing(pathname: string, mine: Wing[], last: string | null | undefined): Wing | null {
  const here = wingsOfHref(pathname).filter(w => mine.some(m => m.key === w.key));
  const l = mine.find(m => m.key === last) || null;
  if (here.length === 1) return here[0];
  if (here.length > 1) return (l && here.some(h => h.key === l.key) ? l : here[0]);
  if (!mine.length) return null;
  return l || (mine.length === 1 ? mine[0] : null);
}
/** روابط القسم المسموح بها لي (+ المشتركة)، بترتيب الخريطة */
export function hrefsInWing(w: Wing | null, hrefs: string[]): string[] {
  if (!w) return hrefs;
  return hrefs.filter(h => isShared(h) || w.hrefs.some(x => under(h, x)));
}
export const readLastWing = (): string | null => { try { return typeof window === 'undefined' ? null : window.localStorage.getItem(LAST_WING_KEY); } catch { return null; } };
export const writeLastWing = (k: string) => { try { if (typeof window !== 'undefined') window.localStorage.setItem(LAST_WING_KEY, k); } catch { /* لا شيء */ } };
/** فحص الاكتمال (للاختبار): كلّ غرفة في الخريطة لها قسم أو مشتركة */
export const unassignedRooms = (): string[] => ROOMS.map(r => r.href).filter(h => !isShared(h) && wingsOfHref(h).length === 0);
export { roomFor };
