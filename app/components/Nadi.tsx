'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* «نادِ» (تحدّث أو اطلب) — الغلاف الخفيف في كل صفحة: زرّ ميكروفون عائم فوق زرّ البحث + اختصار Alt+M + حدث window «athar:speak».
   اللوحة نفسها (التعرّف الصوتي داخل المتصفح · حقل الطلب الكتابي · التنفيذ) تُحمَّل عند أول ضغطة فقط (ميزانية P40). */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LAST_KEY, CUR_KEY, ZOOM_KEY } from '../../lib/portal/voice-keys';
import { recordWay } from '../../lib/portal/way';
import { fetchMyPolicy, kioskWatch, clearPolicyCache, KIOSK_KEY } from '../../lib/org/policy-client';
import { supabase } from '../../lib/supabase/client';

const NadiPanel = dynamic(() => import('./NadiPanel'), { ssr: false, loading: () => null });

export default function Nadi() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [voiceOff, setVoiceOff] = useState(false);
  const openIt = useCallback(() => setOpen(true), []);
  /* P67 سياسة الجهة: «لا صوت» يُخفي الزرّ · «وضع الكشك» يُخرج بعد خمول ويعيد إلى باب الجهة (الخادم يحكم دائمًا؛ هذا للواجهة) */
  useEffect(() => {
    let stop = () => { /* لا كشك */ }; let alive = true;
    (async () => {
      try {
        const { data } = await supabase().auth.getSession(); const tok = data.session?.access_token || null; if (!tok) { clearPolicyCache(); return; }
        const p = await fetchMyPolicy(tok); if (!alive) return; setVoiceOff(!!p.voice_off);
        const mins = p.kiosk_minutes || Number(localStorage.getItem(KIOSK_KEY) || 0) || 0;
        if (mins) stop = kioskWatch(mins, () => { const slug = String(data.session?.user?.user_metadata?.org_slug || ''); clearPolicyCache(); void supabase().auth.signOut().finally(() => { window.location.href = slug ? `/enter?o=${slug}` : '/enter'; }); });
      } catch { /* بلا سياسة */ }
    })();
    return () => { alive = false; stop(); };
  }, [pathname]);
  useEffect(() => {
    /* «خذني حيث توقفت»: نحفظ الصفحة السابقة محليًا فقط (لا شيء يُرسل) */
    try { const cur = localStorage.getItem(CUR_KEY); if (cur && cur !== pathname) localStorage.setItem(LAST_KEY, cur); localStorage.setItem(CUR_KEY, pathname); } catch { /* خاص */ }
    recordWay(pathname); setOpen(false);
  }, [pathname]);
  useEffect(() => { /* استعادة حجم الخط الذي اختاره المستخدم بصوته */ try { const z = Number(localStorage.getItem(ZOOM_KEY) || 0) || 0; if (z) document.documentElement.style.fontSize = `${100 + z * 10}%`; } catch { /* */ } }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) { e.preventDefault(); setOpen((o) => !o); } };
    const onEvt = () => openIt();
    window.addEventListener('keydown', onKey); window.addEventListener('athar:nadi', onEvt);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('athar:nadi', onEvt); };
  }, [openIt]);
  if (pathname === '/enter' || pathname.startsWith('/enter/')) return null; /* P67: باب الدخول بالرمز صفحة كشك نظيفة — لا نادِ قبل معرفة سياسة الجهة */
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!voiceOff && <button type="button" className={`nd-fab${open ? ' on' : ''}`} onClick={() => setOpen((o) => !o)} aria-label="نادِ أَثَر — تحدّث أو اطلب للتنقّل" title="نادِ — تحدّث أو اطلب (Alt M)" aria-expanded={open} aria-controls="nadi-panel" data-testid="nadi-fab">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
      </button>}
      {open && !voiceOff && <NadiPanel onClose={() => setOpen(false)} />}
    </>
  );
}

const CSS = `
.nd-fab{position:fixed;bottom:74px;inset-inline-end:18px;z-index:9050;width:48px;height:48px;border-radius:999px;border:0;background:#0b8a83;color:#fff;box-shadow:0 10px 26px rgba(11,138,131,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,background .15s}
.nd-fab:hover{transform:translateY(-2px);background:#0f2a4e}.nd-fab.on{background:#c9a24b;color:#0f2a4e}.nd-fab:focus-visible{outline:3px solid #c9a24b;outline-offset:3px}
@media(min-width:761px){.nd-fab{width:42px;height:42px;bottom:68px;opacity:.92}}
@media print{.nd-fab{display:none!important}}
@media(prefers-reduced-motion:reduce){.nd-fab{transition:none}}
`;
