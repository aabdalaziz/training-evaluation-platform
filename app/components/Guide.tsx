'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «دليل أَثَر» (P41) — البحث في كل صفحة: الغلاف الخفيف (زر عائم + Ctrl+K + حدث window «athar:guide»).
 *  اللوحة نفسها (GuidePanel) تُحمَّل عند أول فتح فقط حتى لا تثقل أي صفحة — «خِفّة أَثَر» (P40).
 *  GuideButton: زر الترويسة (PortalShell · GlobalNavigation · مِعيار) يرسل الحدث فقط.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Nadi from './Nadi'; /* «نادِ»: تحدّث أو اطلب — الأوامر الصوتية للتنقّل في كل صفحة */
const GuidePanel = dynamic(() => import('./GuidePanel'), { ssr: false });

type Lang = 'ar' | 'en';
const HIDE_ON = ['/room/', '/offline', '/m/', '/attend', '/survey', '/evaluate'];
const LABEL: Record<Lang, string> = { ar: 'البحث في أَثَر', en: 'Search Athar' };

export function GuideButton({ lang = 'ar', className = '', compact = false }: { lang?: Lang; className?: string; compact?: boolean }) {
  return (
    <button type="button" className={`gd-trigger ${compact ? 'compact' : ''} ${className}`} onClick={() => window.dispatchEvent(new CustomEvent('athar:guide'))} aria-label={LABEL[lang]} title={`${LABEL[lang]} — Ctrl K`} data-testid="guide-open">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
      {!compact && <span>{lang === 'ar' ? 'بحث' : 'Search'}</span>}{!compact && <kbd aria-hidden="true">Ctrl K</kbd>}
    </button>
  );
}

export default function Guide() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false); const lastFocus = useRef<HTMLElement | null>(null); const openRef = useRef(false); openRef.current = open; const initialQ = useRef('');
  const openGuide = useCallback(() => { lastFocus.current = document.activeElement as HTMLElement; setOpen(true); }, []);
  const close = useCallback(() => { setOpen(false); setTimeout(() => lastFocus.current?.focus?.(), 0); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) { e.preventDefault(); setOpen(o => { if (!o) lastFocus.current = document.activeElement as HTMLElement; return !o; }); } else if (e.key === 'Escape' && openRef.current) { e.preventDefault(); close(); } };
    const onEvt = (e: Event) => { const q = (e as CustomEvent).detail?.query; initialQ.current = typeof q === 'string' ? q : ''; openGuide(); };
    window.addEventListener('keydown', onKey); window.addEventListener('athar:guide', onEvt);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('athar:guide', onEvt); };
  }, [openGuide, close]);
  useEffect(() => { setOpen(false); }, [pathname]);
  if (HIDE_ON.some(p => pathname.startsWith(p))) return null;
  const lang: Lang = 'ar'; /* تسمية الزر العائم؛ اللوحة تكتشف لغة الصفحة بنفسها */
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <button type="button" className="gd-fab" onClick={openGuide} aria-label={LABEL[lang]} title={`${LABEL[lang]} — Ctrl K`} data-testid="guide-fab">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
      </button>
      {open && <GuidePanel onClose={close} initialQuery={initialQ.current} />}
      <Nadi />
    </>
  );
}

const CSS = `
.gd-trigger{display:inline-flex;align-items:center;gap:7px;border:1px solid #cbd5e1;background:#fff;color:#0f2a4e;border-radius:12px;padding:7px 12px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;line-height:1}
.gd-trigger:hover{border-color:#0b8a83;color:#0b8a83}.gd-trigger kbd{font:inherit;font-size:10px;font-weight:900;border:1px solid #cbd5e1;border-radius:6px;padding:1px 5px;color:#64748b;background:#f8fafc}
.gd-trigger.compact{padding:8px;border-radius:10px}.gd-trigger:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
.gd-fab{position:fixed;bottom:18px;inset-inline-end:18px;z-index:9050;width:48px;height:48px;border-radius:999px;border:0;background:#0f2a4e;color:#fff;box-shadow:0 10px 26px rgba(15,42,78,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s}
.gd-fab:hover{transform:translateY(-2px);background:#0b8a83}.gd-fab:focus-visible{outline:3px solid #c9a24b;outline-offset:3px}
@media(min-width:761px){.gd-fab{width:42px;height:42px;opacity:.9}}
@media print{.gd-fab,.gd-back{display:none!important}}
`;
