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

/** شارة الباب (P42-ب): للداخلين أصحاب صفة فقط — «بابي · مدير الجودة» → وجهتهم. لا تكلّف الزائر شيئًا (لا Supabase بلا جلسة مخزَّنة). */
export function DoorBadge({ lang }: { lang: Lang }) {
  const [b, setB] = useState<{ landing: string; name_ar: string; name_en: string } | null>(null);
  useEffect(() => {
    try {
      if (!hasStoredSession()) return;
      const c = sessionStorage.getItem('athar_door_badge'); if (c) { const j = JSON.parse(c); if (j && j.ts && Date.now() - j.ts < 600000) { if (j.badge) setB(j.badge); return; } }
      void sbLazy().then(sb => sb.auth.getSession()).then(async ({ data }) => {
        const tk = data.session?.access_token; if (!tk) return;
        const j = await fetch('/api/roles', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null);
        const roles: string[] = j?.roles || []; const cat: any[] = j?.catalog || [];
        const main = cat.find(c => c.landing === j?.landing) || cat[0];
        const badge = roles.length && main && !['PARTICIPANT', 'TRAINEE', 'STUDENT'].includes(main.code) ? { landing: j.landing || '/hub', name_ar: cat.length > 1 ? `${main.name_ar} +${cat.length - 1}` : main.name_ar, name_en: cat.length > 1 ? `${main.name_en} +${cat.length - 1}` : main.name_en } : null;
        try { sessionStorage.setItem('athar_door_badge', JSON.stringify({ ts: Date.now(), badge })); } catch { /* ignore */ }
        if (badge) setB(badge);
      });
    } catch { /* ignore */ }
  }, []);
  if (!b) return null;
  return <Link href={b.landing} className="pt-doorbadge" data-testid="shell-door-badge" title={lang === 'ar' ? 'بابي' : 'My door'}><span className="pt-doordot" aria-hidden="true" /><b>{lang === 'ar' ? 'بابي' : 'My door'}</b><small>{lang === 'ar' ? b.name_ar : b.name_en}</small></Link>;
}
