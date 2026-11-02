'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هوية أَثَر المشتركة (P43-أ «أَثَر الواحد»): الشعار + شارة الباب
 *  تعيش في ملف صغير مستقل حتى يستعملها غلاف البوابة (PortalShell) وشريط «مركز قيادة أَثَر» (GlobalNavigation)
 *  معًا دون أن يحمل أيٌّ منهما الآخر — وبلا كلفة على الزائر (لا Supabase بلا جلسة مخزَّنة).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { sbLazy, hasStoredSession } from '../../lib/supabase/lazy';
import { BRAND } from '../../lib/portal/content';
import type { Lang } from '../../lib/portal/content';

/** شعار أَثَر: حلقات أثر متدرجة + الاسم */
export function AtharMark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  const c1 = light ? '#fff' : BRAND.colors.navy, c2 = light ? '#c9a24b' : BRAND.colors.teal;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke={c1} strokeWidth="2.5" opacity=".25" />
      <circle cx="24" cy="24" r="14" fill="none" stroke={c1} strokeWidth="2.5" opacity=".55" />
      <circle cx="24" cy="24" r="7" fill={c2} />
      <circle cx="24" cy="24" r="2.5" fill={light ? c1 : '#fff'} />
    </svg>
  );
}

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
  return <Link href={b.landing} className="pt-doorbadge" data-testid="shell-door-badge" title={lang === 'ar' ? 'بابي' : 'My door'}><span className="pt-doordot" aria-hidden="true" /><b>{lang === 'ar' ? 'بابي' : 'My door'}</b><small>{lang === 'ar' ? b.name_ar : b.name_en}</small></Link>;
}
