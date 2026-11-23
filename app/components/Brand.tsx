'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هوية أَثَر المشتركة (P43-أ «أَثَر الواحد»): الشعار + شارة الباب
 *  تعيش في ملف صغير مستقل حتى يستعملها غلاف البوّابة (PortalShell) وشريط «مركز قيادة أَثَر» (GlobalNavigation)
 *  معًا دون أن يحمل أيٌّ منهما الآخر — وبلا كلفة على الزائر (لا Supabase بلا جلسة مخزَّنة).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sbLazy, hasStoredSession } from '../../lib/supabase/lazy';
import { BRAND } from '../../lib/portal/content';
import type { Lang } from '../../lib/portal/content';

/** شعار أَثَر v1.2 (المَعلَم «ج» + شريط R1): قوس بخطّين جانبيين منتشرين، شريط تدرّج واحد متّصل (ليل → برقوقي → مرجاني → رملي)،
 *  معيّن مرجاني في القلب وقمّة رملية. `light` للسطوح الداكنة (الشريط يبدأ من برقوقي فاتح بدل الليل). الـ id فريد لكل نسخة حتى لا تتصادم التدرّجات. */
let markSeq = 0;
export function AtharMark({ size = 36, light = false, echo = false }: { size?: number; light?: boolean; echo?: boolean }) {
  const [uid] = useState(() => `am${++markSeq}`);
  const g = `${uid}g`;
  const stops = light ? ['#6A3350', '#8E4A68', '#D4614A', '#D9A866'] : ['#22101F', '#3A1F36', '#D4614A', '#D9A866'];
  return (
    <svg width={size} height={size} viewBox="0 30 240 180" aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs><linearGradient id={g} gradientUnits="userSpaceOnUse" x1="120" y1="192" x2="120" y2="60"><stop offset="0" stopColor={stops[0]} /><stop offset=".42" stopColor={stops[1]} /><stop offset=".72" stopColor={stops[2]} /><stop offset="1" stopColor={stops[3]} /></linearGradient></defs>
      {echo && <g className="ath-mark-echo"><path d="M1.4 49.2 A143.6 143.6 0 0 1 129.6 103.6" fill="none" stroke="#E8795C" strokeWidth="2.2" strokeLinecap="round" opacity=".5" /><path d="M238.6 49.2 A143.6 143.6 0 0 0 110.4 103.6" fill="none" stroke="#E8795C" strokeWidth="2.2" strokeLinecap="round" opacity=".5" /></g>}
      <path d="M72.0 192 A129.6 129.6 0 0 1 120.0 71.6 A129.6 129.6 0 0 1 168.0 192 L153.0 192 A114.6 114.6 0 0 0 120.0 87.9 A114.6 114.6 0 0 0 87.0 192 Z" fill={`url(#${g})`} />
      <path d="M72.0 74.9 A129.6 129.6 0 0 1 146.0 192 L131.0 192 A114.6 114.6 0 0 0 16.4 74.9 Z" fill={`url(#${g})`} />
      <path d="M168.0 74.9 A129.6 129.6 0 0 0 94.0 192 L109.0 192 A114.6 114.6 0 0 1 223.6 74.9 Z" fill={`url(#${g})`} />
      <rect x="115.5" y="97.54" width="9" height="9" rx="1.26" transform="rotate(45 120 102.035)" fill="#E8795C" />
      <rect x="112.5" y="63.12" width="15" height="15" rx="2.1" transform="rotate(45 120 70.617)" fill="#D9A866" />
    </svg>
  );
}
/** مسارات العلامة الخام (للستار والنقوش) */
export const MARK_PATHS = [
  'M72.0 192 A129.6 129.6 0 0 1 120.0 71.6 A129.6 129.6 0 0 1 168.0 192 L153.0 192 A114.6 114.6 0 0 0 120.0 87.9 A114.6 114.6 0 0 0 87.0 192 Z',
  'M72.0 74.9 A129.6 129.6 0 0 1 146.0 192 L131.0 192 A114.6 114.6 0 0 0 16.4 74.9 Z',
  'M168.0 74.9 A129.6 129.6 0 0 0 94.0 192 L109.0 192 A114.6 114.6 0 0 1 223.6 74.9 Z',
];
export const MARK_ARCS = ['M1.4 49.2 A143.6 143.6 0 0 1 129.6 103.6', 'M238.6 49.2 A143.6 143.6 0 0 0 110.4 103.6'];

/** صفاتي وصلاحياتي (P43-ب): قراءة واحدة من /api/roles لكل جلسة (ذاكرة الجلسة 10 دقائق، مفتاحها ذيل الرمز حتى لا تختلط جلستان)،
 *  يتشاركها شارة الباب وشريط مركز القيادة وغلاف AdminShell. الزائر بلا جلسة مخزَّنة لا يدفع شيئًا. */
export type MyRoles = { roles: string[]; landing: string; permissions: string[]; staff: boolean; catalog: { code: string; name_ar: string; name_en: string; landing: string; scope: string }[]; email: string };
const ROLES_KEY = 'athar_my_roles'; const ROLES_TTL = 600000;
let inflight: Promise<MyRoles | null> | null = null;
export async function loadMyRoles(): Promise<MyRoles | null> {
  try {
    if (!hasStoredSession()) return null;
    const sb = await sbLazy(); const { data } = await sb.auth.getSession(); const tk = data.session?.access_token; if (!tk) return null;
    const sig = tk.slice(-12);
    try { const c = sessionStorage.getItem(ROLES_KEY); if (c) { const j = JSON.parse(c); if (j && j.sig === sig && Date.now() - j.ts < ROLES_TTL && j.data) return j.data as MyRoles; } } catch { /* ignore */ }
    if (!inflight) inflight = fetch('/api/roles', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).then(j => {
      if (!j?.success) return null;
      const d: MyRoles = { roles: j.roles || [], landing: j.landing || '/hub', permissions: j.permissions || [], staff: !!j.staff, catalog: j.catalog || [], email: j.email || '' };
      try { sessionStorage.setItem(ROLES_KEY, JSON.stringify({ ts: Date.now(), sig, data: d })); } catch { /* ignore */ }
      return d;
    }).catch(() => null).finally(() => { inflight = null; });
    return await inflight;
  } catch { return null; }
}
export function invalidateMyRoles() { try { sessionStorage.removeItem(ROLES_KEY); sessionStorage.removeItem('athar_door_badge'); } catch { /* ignore */ } }
/** null = لم تُقرأ بعد (أو زائر) */
export function useMyRoles(): MyRoles | null {
  const [r, setR] = useState<MyRoles | null>(null);
  useEffect(() => { let alive = true; void loadMyRoles().then(d => { if (alive && d) setR(d); }); return () => { alive = false; }; }, []);
  return r;
}

/** شارة الباب (P42-ب): للداخلين أصحاب صفة فقط — «بابي · مدير الجودة» → وجهتهم. لا تكلّف الزائر شيئًا (لا Supabase بلا جلسة مخزَّنة). */
export function DoorBadge({ lang }: { lang: Lang }) {
  const my = useMyRoles();
  const b = (() => {
    if (!my) return null; const cat = my.catalog; const main = cat.find(c => c.landing === my.landing) || cat[0];
    if (!my.roles.length || !main || ['PARTICIPANT', 'TRAINEE', 'STUDENT'].includes(main.code)) return null;
    return { landing: my.landing || '/hub', name_ar: cat.length > 1 ? `${main.name_ar} +${cat.length - 1}` : main.name_ar, name_en: cat.length > 1 ? `${main.name_en} +${cat.length - 1}` : main.name_en };
  })();
  if (!b) return null;
  return <Link href={b.landing} className="pt-doorbadge" data-testid="shell-door-badge" title={lang === 'ar' ? 'صفحتي' : 'My page'}><span className="pt-doordot" aria-hidden="true" /><b>{lang === 'ar' ? 'صفحتي' : 'My page'}</b><small>{lang === 'ar' ? b.name_ar : b.name_en}</small></Link>;
}
