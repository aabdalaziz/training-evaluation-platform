'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «شريط أخبار المنطقة» (هـ-1/4) — الشريط الذي طلبه المالك: نفس روح «الآن في أَثَر» في الرئيسة، مكرَّرًا في كلّ منطقة بأخبارها.
 *  · يقرأ /api/zone-news?zone= (أخبار الطاقم + أخبار آلية) · يدور كلّ ٧ ثوانٍ · يتوقّف عند التحويم واللمس · نقاط للتنقّل
 *  · حركة انزلاق ناعمة على منحنى أَثَر (لا قطع) · ثابت تحت خفض الحركة وفي غرف الامتحان (data-engrave=none)
 *  · لا يظهر إن لم تكن أخبار (صفر ضجيج) · في الرئيسة يبقى «مسرح الآن في أَثَر» كما هو
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Item = { id: string; kind: 'news' | 'auto'; title: string; body: string; href: string | null; tone: string; pinned: boolean };
const ZONE_AR: Record<string, string> = { miaar: 'الآن في مِعيار', iqra: 'الآن في اقْرَأْ', programs: 'الآن في البرامج', org: 'الآن في بوّابة الجهات', experts: 'الآن عند الخبراء', staff: 'الآن في مركز القيادة', portal: 'الآن في أَثَر' };
const TONE: Record<string, string> = { plum: 'linear-gradient(135deg,#3A1F36,#6A3350)', coral: 'linear-gradient(135deg,#D4614A,#E8795C)', sand: 'linear-gradient(135deg,#8A5A1E,#D9A866)', sea: 'linear-gradient(135deg,#3F7F79,#5EA8A0)' };
const cache = new Map<string, { at: number; items: Item[] }>();

export default function ZoneTape({ zone, compact = false, className = '' }: { zone: string; compact?: boolean; className?: string }) {
  const [items, setItems] = useState<Item[] | null>(() => cache.get(zone)?.items ?? null);
  const [i, setI] = useState(0); const [hold, setHold] = useState(false); const timer = useRef<number | null>(null);
  const load = useCallback(async () => {
    const c = cache.get(zone); if (c && Date.now() - c.at < 60_000) { setItems(c.items); return; }
    try { const r = await fetch(`/api/zone-news?zone=${encodeURIComponent(zone)}`, { cache: 'no-store' }); const j = await r.json(); const it: Item[] = j?.ok ? j.items : []; cache.set(zone, { at: Date.now(), items: it }); setItems(it); } catch { setItems([]); }
  }, [zone]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!items || items.length < 2 || hold) return;
    const reduce = typeof window !== 'undefined' && (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.engrave === 'none');
    if (reduce) return;
    timer.current = window.setInterval(() => setI((k) => (k + 1) % items.length), 7000);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [items, hold]);
  if (!items || !items.length || zone === 'home') return null;
  const it = items[i % items.length];
  const inner = <>
    <span className="zt-live" aria-hidden="true"><i /></span>
    <span className="zt-zone">{ZONE_AR[zone] || ZONE_AR.portal}</span>
    <span key={it.id} className="zt-item" style={{ ['--t' as string]: TONE[it.tone] || TONE.plum } as React.CSSProperties}>
      {it.pinned && <b className="zt-pin" title="مثبّت">●</b>}<strong>{it.title}</strong>{!compact && it.body && <small> — {it.body}</small>}
    </span>
    {items.length > 1 && <span className="zt-dots" role="tablist" aria-label="أخبار المنطقة">{items.map((x, k) => <button key={x.id} type="button" role="tab" aria-selected={k === i} className={k === i ? 'on' : ''} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setI(k); }} aria-label={`${k + 1}`} />)}</span>}
  </>;
  return (
    <div className={`zt ${compact ? 'compact' : ''} ${className}`} dir="rtl" data-testid="zone-tape" data-zone={zone} onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onTouchStart={() => setHold(true)} onTouchEnd={() => setHold(false)} aria-live="polite">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {it.href ? <Link href={it.href} className="zt-in" data-testid="zone-tape-link">{inner}</Link> : <div className="zt-in">{inner}</div>}
    </div>
  );
}

const CSS = `
.zt{max-width:1180px;margin:10px auto 0;padding:0 16px}
.zt-in{display:flex;align-items:center;gap:12px;min-height:44px;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.72);backdrop-filter:blur(6px);border:1px solid #EADFD6;box-shadow:0 8px 24px rgba(42,22,38,.06);color:#2A1626;text-decoration:none;overflow:hidden;transition:box-shadow .35s cubic-bezier(.2,.8,.2,1),transform .35s cubic-bezier(.2,.8,.2,1)}
a.zt-in:hover{box-shadow:0 14px 32px rgba(42,22,38,.12);transform:translateY(-1px)}
.zt-live{flex:none;width:10px;height:10px;border-radius:50%;background:#D4614A;position:relative}.zt-live i{position:absolute;inset:-4px;border-radius:50%;border:2px solid #D4614A;opacity:.5;animation:ztPing 1.8s ease-out infinite}
.zt-zone{flex:none;font-size:12px;font-weight:900;color:#8A5A1E;letter-spacing:.02em}
.zt-item{flex:1;min-width:0;display:flex;align-items:baseline;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:ztIn .6s cubic-bezier(.2,.8,.2,1)}
.zt-item strong{font-size:14px;font-weight:800;background:var(--t);-webkit-background-clip:text;background-clip:text;color:transparent}
.zt-item small{font-size:12.5px;color:#5C4858;overflow:hidden;text-overflow:ellipsis}
.zt-pin{color:#D9A866;font-size:9px}
.zt-dots{flex:none;display:flex;gap:5px}.zt-dots button{width:7px;height:7px;border-radius:50%;border:0;background:#D9CBC2;padding:0;cursor:pointer;transition:transform .3s,background .3s}.zt-dots button.on{background:#D4614A;transform:scale(1.35)}
.zt.compact .zt-in{min-height:36px;padding:4px 12px}.zt.compact .zt-zone{display:none}
@keyframes ztIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ztPing{0%{transform:scale(.6);opacity:.7}100%{transform:scale(1.8);opacity:0}}
@media(max-width:640px){.zt-item small{display:none}.zt-zone{font-size:11px}}
@media(prefers-reduced-motion:reduce){.zt-item,.zt-live i{animation:none}}
html[data-engrave="none"] .zt-live i{animation:none}
`;
