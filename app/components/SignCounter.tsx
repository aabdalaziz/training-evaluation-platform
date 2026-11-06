'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P50 «توقيعي» — عدّاد التوقيع ✍️ في الصدفة: للطاقم والمدرّبين وأصحاب الأبواب فقط (الخادم يقرّر: 403 → لا يُعرض شيء).
 *  يقرأ /api/admin/sign?light=1 كل 60 ث (الخادم يحتفظ بذاكرة 45 ث) ويفتح /admin/sign. لا أسماء، عدد فقط.
 */
import { useCallback, useEffect, useState } from 'react';
import { sbLazy } from '../../lib/supabase/lazy';

export const SIGN_EVENT = 'athar:sign-changed';
type Light = { total: number; oldest_days: number | null };
let denied = false; /* جلسة لا تملك «توقيعي» — لا نعيد السؤال في الصفحة نفسها */

export function SignCounter({ lang = 'ar', tone = 'light' }: { lang?: 'ar' | 'en'; tone?: 'light' | 'strip' }) {
  const ar = lang === 'ar'; const [d, setD] = useState<Light | null>(null);
  const refresh = useCallback(async () => {
    if (denied) return; try { const db = await sbLazy(); const { data } = await db.auth.getSession(); const tk = data.session?.access_token; if (!tk) return;
      const r = await fetch('/api/admin/sign?light=1', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); if (r.status === 403 || r.status === 401) { denied = r.status === 403; setD(null); return; }
      const j = await r.json().catch(() => null); if (j?.success) setD({ total: Number(j.total) || 0, oldest_days: j.oldest_days ?? null }); } catch { /* صامت */ }
  }, []);
  useEffect(() => { void refresh(); const iv = setInterval(() => void refresh(), 60000); const onVis = () => { if (document.visibilityState === 'visible') void refresh(); };
    /* لوحة «توقيعي» تبثّ العدد الجديد بعد كل توقيع — العدّاد يتحدّث فورًا بلا طلب */
    const onSign = (e: Event) => { const t = (e as CustomEvent).detail?.total; if (typeof t === 'number') setD((p) => ({ total: t, oldest_days: (e as CustomEvent).detail?.oldest_days ?? p?.oldest_days ?? null })); else void refresh(); };
    document.addEventListener('visibilitychange', onVis); window.addEventListener(SIGN_EVENT, onSign); return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener(SIGN_EVENT, onSign); }; }, [refresh]);
  if (!d) return null;
  const label = ar ? `توقيعي — ينتظر توقيعك ${d.total}` : `My signatures — ${d.total} pending`;
  return <a href="/admin/sign" className={`sc-link ${tone} ${d.total ? 'has' : ''}`} aria-label={label} title={label} data-testid="sign-counter" data-total={d.total}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <span aria-hidden="true" className="sc-ic">✍️</span>
    {tone === 'strip' && <span className="sc-txt">{ar ? 'توقيعي' : 'Sign'}</span>}
    {d.total > 0 && <b data-testid="sign-count">{d.total > 99 ? '99+' : d.total}</b>}
  </a>;
}

const CSS = `
.sc-link{display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1.5px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:999px;min-width:36px;height:36px;padding:0 8px;text-decoration:none;position:relative;font:inherit}
.sc-link.has{border-color:#c9a24b;background:#fffbeb}.sc-ic{font-size:16px;line-height:1}.sc-link b{min-width:18px;height:18px;border-radius:999px;background:#b45309;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}
.sc-link.strip{height:30px;border-radius:8px;font-size:12.5px;font-weight:800}.sc-txt{line-height:1}
@media (max-width:640px){.sc-link.light .sc-ic{font-size:15px}}
`;
export default SignCounter;
