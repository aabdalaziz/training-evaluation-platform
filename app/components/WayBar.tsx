'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* «الطريق» — شريط تنقّل موحّد تحت الرأس في كل صفحة غير الرئيسية: سهم رجوع (تاريخ المتصفح وإلا المسار الأب) · الرئيسية · فتات الطريق.
   WCAG: nav معنون، aria-current على الصفحة الحالية، أهداف لمس ≥ 36px، حلقة تركيز ظاهرة. يُخفى عند قفل المسار (أثناء اختبار مِعيار) عبر wayLock. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { crumbsFor, parentOf, showWay, recordWay, hasWayHistory, type Crumb } from '../../lib/portal/way';

const LOCK_EVENT = 'athar:waylock';
/** قفل الشريط أثناء مهمة لا يجوز مغادرتها بسهو (اختبار جارٍ) */
export function setWayLock(locked: boolean): void { if (typeof window === 'undefined') return; (window as any).__wayLock = locked; window.dispatchEvent(new CustomEvent(LOCK_EVENT, { detail: locked })); }

/** onBack: رجوع داخل تطبيق متعدّد الخطوات (مثل خطوات مِعيار) بدل تاريخ المتصفح · extra: فتات إضافية للخطوة الحالية · lock: إخفاء أثناء مهمة جارية */
export default function WayBar({ lang = 'ar', tone = 'light', onBack, extra, lock }: { lang?: 'ar' | 'en'; tone?: 'light' | 'dark'; onBack?: (() => void) | null; extra?: string[]; lock?: boolean }) {
  const pathname = usePathname() || '/'; const router = useRouter();
  const [locked, setLocked] = useState(false);
  /* شريط واحد فقط في الصفحة: حين يعرضه الرأس العام (GlobalNavigation) وغلاف البوابة (PortalShell) معًا، يختفي الثاني — إلا إن كان يحمل خصوصية (onBack/extra) فيختفي الأول */
  const ref = useRef<HTMLElement>(null); const [dup, setDup] = useState(false);
  useEffect(() => {
    const all = Array.from(document.querySelectorAll('[data-testid="way-bar"]')); if (all.length < 2 || !ref.current) { setDup(false); return; }
    const special = !!(onBack || (extra && extra.length)); const idx = all.indexOf(ref.current);
    setDup(special ? false : all.some((el, i) => i !== idx && el.getAttribute('data-way-special') === '1') || idx > 0);
  }, [pathname, onBack, extra]);
  useEffect(() => { recordWay(pathname); }, [pathname]);
  useEffect(() => { setLocked(!!(window as any).__wayLock); const on = (e: Event) => setLocked(!!(e as CustomEvent).detail); window.addEventListener(LOCK_EVENT, on); return () => window.removeEventListener(LOCK_EVENT, on); }, []);
  if (!showWay(pathname) || locked || lock) return null;
  const special = !!(onBack || (extra && extra.length));
  const base = crumbsFor(pathname, lang); const ar = lang === 'ar';
  const crumbs: Crumb[] = extra && extra.length ? [...base.map((c) => ({ ...c, current: false })), ...extra.map((label, i) => ({ href: `${pathname}#${i}`, label, current: i === extra.length - 1 }))] : base;
  const back = () => {
    if (onBack) { onBack(); return; }
    if (hasWayHistory()) { router.back(); return; }
    router.push(parentOf(pathname));
  };
  return (
    <nav ref={ref} className={`way ${tone}`} aria-label={ar ? 'مسار الصفحة' : 'Page path'} data-testid="way-bar" data-way-special={special ? '1' : undefined} dir={ar ? 'rtl' : 'ltr'} hidden={dup}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <button type="button" className="way-back" onClick={back} data-testid="way-back" aria-label={ar ? 'رجوع إلى الصفحة السابقة' : 'Back to previous page'}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: ar ? 'none' : 'scaleX(-1)' }}><path d="M14 6l6 6-6 6M20 12H4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span>{ar ? 'رجوع' : 'Back'}</span>
      </button>
      <ol className="way-crumbs">
        {crumbs.map((c, i) => <li key={c.href}>{i > 0 && <span className="way-sep" aria-hidden="true">›</span>}{c.current ? <span aria-current="page" className="way-cur">{c.label}</span> : c.dead ? <span className="way-dead">{c.label}</span> : <Link href={c.href} className="way-link">{i === 0 && <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>}{c.label}</Link>}</li>)}
      </ol>
    </nav>
  );
}
const CSS = `
.way{display:flex;align-items:center;gap:10px;padding:6px max(18px,calc((100% - 1200px)/2));font-size:13px;line-height:1.3;border-bottom:1px solid rgba(15,42,78,.08);background:rgba(255,255,255,.7);backdrop-filter:blur(6px);position:relative;z-index:5}
.way.dark{background:rgba(15,42,78,.55);border-color:rgba(255,255,255,.12);color:#fff}
.way-back{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid rgba(15,42,78,.18);background:#fff;color:#0f2a4e;font:inherit;font-weight:700;cursor:pointer;flex:none}
.way-back:hover{background:#f3f6fa}.way-back:focus-visible,.way-link:focus-visible{outline:none;box-shadow:0 0 0 3px #fff,0 0 0 6px #0b8a83}
.way.dark .way-back{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.3);color:#fff}
.way-crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:4px;list-style:none;margin:0;padding:0;min-width:0}
.way-crumbs li{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.way-dead{color:#64748b}
.way-link{display:inline-flex;align-items:center;gap:4px;color:#0b8a83;text-decoration:none;padding:6px 4px;border-radius:6px;min-height:36px}
.way-link:hover{text-decoration:underline}.way.dark .way-link{color:#dfeeea}
.way-sep{color:#8a97a8;margin:0 2px}.way-cur{color:#0f2a4e;font-weight:700;padding:6px 4px}.way.dark .way-cur{color:#fff}
@media (max-width:640px){.way{font-size:12px}.way-back span{display:none}.way-back{padding:0 10px}.way-crumbs li:not(:last-child):not(:first-child){display:none}}
@media print{.way{display:none}}
.way[hidden]{display:none}
`;
