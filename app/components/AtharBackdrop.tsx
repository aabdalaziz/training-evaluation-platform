'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * خلفية أَثَر (هوية v1.2): «ورق أَثَر» — نسيج العلامة الصغيرة بخطوط رفيعة بشفافية ≈4% ثابت خلف المحتوى، ولمعة واحدة كل 14 ث.
 *  الدرجة تُقرأ من <html data-engrave="full|soft|none">: full افتراضيًا · soft في صفحات العمل · none في شاشة التقييم والمشاهدة الحيّة والطباعة.
 *  المنطقة من <html data-zone> (home · miaar · iqra · org · experts · staff) — تضبط لون الصدى والأفق.
 *  مفتاح المستخدم «تبسيط الخلفية» (localStorage athar_plain=1) يخفي الورق والشعاع.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SOFT = ['/admin', '/command-center', '/pay', '/me/', '/org/', '/evaluate', '/hub', '/dashboard'];
const NONE = ['/live', '/on-air', '/miaar/proctor'];
export function zoneOf(path: string): string {
  if (path === '/' ) return 'home';
  if (path.startsWith('/miaar')) return 'miaar';
  if (path.startsWith('/iqra')) return 'iqra';
  if (path.startsWith('/org')) return 'org';
  if (path.startsWith('/experts') || path.startsWith('/councils')) return 'experts';
  if (path.startsWith('/admin') || path.startsWith('/command-center')) return 'staff';
  if (path.startsWith('/me/diploma')) return 'diploma';
  return 'portal';
}
export function engraveOf(path: string): 'full' | 'soft' | 'none' {
  if (NONE.some(p => path.startsWith(p))) return 'none';
  if (SOFT.some(p => path.startsWith(p))) return 'soft';
  return 'full';
}

export default function AtharBackdrop({ dark = false }: { dark?: boolean }) {
  const path = usePathname() || '/';
  useEffect(() => {
    const h = document.documentElement;
    h.dataset.zone = zoneOf(path);
    /* شاشة التقييم تضبط none بنفسها (MiaarApp) — لا نكتب فوقها هنا */
    if (h.dataset.engraveLock !== '1') h.dataset.engrave = engraveOf(path);
    try { h.dataset.atharPlain = localStorage.getItem('athar_plain') === '1' ? '1' : '0'; } catch { /* ignore */ }
  }, [path]);
  return <div className={`ath-paper ${dark ? 'dark' : ''}`} aria-hidden="true" data-testid="athar-paper" />;
}

/** يُستدعى من شاشات التقييم/المشاهدة: يقفل الدرجة على none ما دامت الشاشة مفتوحة */
export function lockEngrave(on: boolean) {
  const h = document.documentElement;
  if (on) { h.dataset.engraveLock = '1'; h.dataset.engrave = 'none'; }
  else { delete h.dataset.engraveLock; h.dataset.engrave = engraveOf(location.pathname); }
}
