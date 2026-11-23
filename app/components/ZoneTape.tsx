'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «حزام أَثَر» — شريط أخبار البوّابة (هـ-1/4د)
 *  · شريط واحد مكرَّر في كلّ الصفحات، بحركة مِعيار نفسها (مسار ينزلق بلا توقّف، نسختان متتاليتان للدوران المتّصل، يتوقّف بالتحويم وبزرّ)
 *  · البنية: [شعار أَثَر + اسم المنطقة] خبر ✦ خبر ✦ خبر ✦✦✦ [شعار أَثَر + اسم المنطقة] خبر ✦ خبر ✦✦✦ …
 *  · «الدائرة»: الأخبار تأتي من خلف البوّابة — صغيرة باهتة عند الطرفين، كاملة أمام الناظر في الوسط — ثم تعود إلى الخلف (أسطوانة تدور، تُحسب بالـ rAF)
 *  · يقرأ /api/zone-news?zone=all (أخبار الطاقم لكلّ المناطق + الآلية) · ساكن تمامًا مع خفض الحركة وفي غرف الامتحان
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ZoneMark } from './ZoneMark';

type Item = { id: string; kind: 'news' | 'auto'; zone?: string; title: string; body: string; href: string | null; tone: string; pinned: boolean };
type Group = { zone: string; label: string; items: Item[] };
export const ZONE_LABEL: Record<string, string> = { miaar: 'مِعيار', iqra: 'اقْرَأْ', programs: 'البرامج', org: 'الجهات', experts: 'خبراء أَثَر', staff: 'الطاقم', portal: 'أَثَر' };
const ZONE_ORDER = ['portal', 'miaar', 'iqra', 'programs', 'org', 'experts', 'staff'];
const cache = new Map<string, { at: number; items: Item[] }>();

/** تجميع الأخبار بالمنطقة بترتيب ثابت — خالص، قابل للاختبار */
export function groupByZone(items: Item[]): Group[] {
  const m = new Map<string, Item[]>();
  for (const it of items) { const z = it.zone && ZONE_LABEL[it.zone] ? it.zone : 'portal'; if (!m.has(z)) m.set(z, []); m.get(z)!.push(it); }
  return ZONE_ORDER.filter((z) => m.has(z)).map((z) => ({ zone: z, label: ZONE_LABEL[z], items: m.get(z)! }));
}

export default function ZoneTape({ zone = 'all', compact = false, className = '' }: { zone?: string; compact?: boolean; className?: string }) {
  const [items, setItems] = useState<Item[] | null>(() => cache.get(zone)?.items ?? null);
  const [paused, setPaused] = useState(false); const [still, setStill] = useState(false);
  const view = useRef<HTMLDivElement | null>(null); const track = useRef<HTMLDivElement | null>(null);
  const load = useCallback(async () => {
    const c = cache.get(zone); if (c && Date.now() - c.at < 60_000) { setItems(c.items); return; }
    try { const r = await fetch(`/api/zone-news?zone=${encodeURIComponent(zone)}`, { cache: 'no-store' }); const j = await r.json(); const it: Item[] = j?.ok ? j.items : []; cache.set(zone, { at: Date.now(), items: it }); setItems(it); } catch { setItems([]); }
  }, [zone]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const calc = () => setStill(mq.matches || document.documentElement.dataset.engrave === 'none');
    calc(); mq.addEventListener?.('change', calc); const mo = new MutationObserver(calc); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-engrave'] });
    return () => { mq.removeEventListener?.('change', calc); mo.disconnect(); };
  }, []);

  /* «الدائرة»: كلّ عنصر يُقاس بُعده عن مركز الشريط فيُصغَّر ويخفت كلّما ابتعد — كأنّه يدور على أسطوانة خلف البوّابة */
  useEffect(() => {
    if (!items || !items.length || still) return;
    const v = view.current, tr = track.current; if (!v || !tr) return;
    let raf = 0; let kids: { el: HTMLElement; c: number }[] = []; let vw = 0, vl = 0;
    const measure = () => { const vr = v.getBoundingClientRect(); vw = vr.width; vl = vr.left; const t0 = tr.getBoundingClientRect().left; kids = Array.from(tr.querySelectorAll<HTMLElement>('.ab-row > *')).map((el) => { const r = el.getBoundingClientRect(); return { el, c: r.left - t0 + r.width / 2 }; }); };
    const tick = () => {
      const tl = tr.getBoundingClientRect().left; const half = vw / 2 || 1; const vc = vl + half;
      for (const k of kids) {
        const x = tl + k.c; const t = Math.max(-1.15, Math.min(1.15, (x - vc) / half)); const d = t * t;
        if (Math.abs(x - vc) > half * 1.3) { if (k.el.style.opacity !== '0') k.el.style.opacity = '0'; continue; }
        k.el.style.transform = `translateY(${(-5 * d).toFixed(1)}px) scale(${(1 - 0.2 * d).toFixed(3)})`; k.el.style.opacity = (1 - 0.62 * Math.min(1, d)).toFixed(2);
      }
      raf = requestAnimationFrame(tick);
    };
    measure(); raf = requestAnimationFrame(tick); const ro = new ResizeObserver(measure); ro.observe(v);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [items, still]);

  if (!items || !items.length) return null;
  const groups = groupByZone(items); const n = items.length + groups.length;
  const row = (rp: number) => (
    <div className="ab-row" aria-hidden={rp === 1} key={rp}>
      {groups.map((g) => (
        <Fragment key={g.zone + rp}>
          <span className="ab-brand"><ZoneMark zone={g.zone} size={20} light /><b>{g.label}</b></span>
          {g.items.map((it, k) => (
            <Fragment key={it.id + rp}>
              {k > 0 && <i className="ab-sep" aria-hidden="true">✦</i>}
              {it.href ? <Link href={it.href} className={`ab-item ${it.tone}`} tabIndex={rp === 1 ? -1 : 0}>{it.pinned && <em aria-hidden="true">●</em>}<strong>{it.title}</strong>{!compact && it.body && <small>{it.body}</small>}</Link>
                : <span className={`ab-item ${it.tone}`}>{it.pinned && <em aria-hidden="true">●</em>}<strong>{it.title}</strong>{!compact && it.body && <small>{it.body}</small>}</span>}
            </Fragment>
          ))}
          <i className="ab-sep3" aria-hidden="true">✦✦✦</i>
        </Fragment>
      ))}
    </div>
  );
  return (
    <div className={`ab ${paused ? 'paused' : ''} ${still ? 'still' : ''} ${compact ? 'compact' : ''} ${className}`} dir="rtl" data-testid="zone-tape" data-n={items.length} aria-label="حزام أَثَر — أخبار البوّابة">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span className="ab-k"><i aria-hidden="true" />الآن في أَثَر</span>
      <div className="ab-view" ref={view}>
        <div className="ab-track" ref={track} style={{ animationDuration: `${Math.max(24, Math.round(n * 4.5))}s` }}>{row(0)}{row(1)}</div>
      </div>
      {!still && <button type="button" className="ab-btn" aria-pressed={paused} onClick={() => setPaused((p) => !p)} aria-label={paused ? 'تشغيل الشريط' : 'إيقاف الشريط'} data-testid="zone-tape-pause">{paused ? '▶' : '❚❚'}</button>}
    </div>
  );
}

const CSS = `
.ab{position:relative;display:flex;align-items:center;min-height:42px;background:linear-gradient(90deg,#22101F,#3A1F36 50%,#22101F);color:#EADFD6;border-bottom:1px solid rgba(217,168,102,.35);font-size:13.5px;font-weight:700;overflow:hidden;isolation:isolate}
.ab::before{content:'';position:absolute;inset:0;background:radial-gradient(60% 140% at 50% 120%,rgba(217,168,102,.16),transparent 70%);pointer-events:none;z-index:0}
.ab-k{position:relative;z-index:2;flex:none;display:flex;align-items:center;gap:8px;padding:0 16px 0 18px;color:#D9A866;font-weight:900;letter-spacing:.02em;white-space:nowrap;background:linear-gradient(90deg,transparent,#22101F 30%);height:42px}
.ab-k i{width:8px;height:8px;border-radius:50%;background:#D4614A;box-shadow:0 0 0 0 rgba(212,97,74,.7);animation:abPing 1.8s infinite}
.ab-view{position:relative;z-index:1;flex:1;min-width:0;overflow:hidden;perspective:600px;mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.ab-track{position:relative;display:flex;width:max-content;animation:abRtl linear infinite;will-change:transform}
.ab-row{display:flex;flex:none;align-items:center;padding-inline-end:28px}
.ab-row>*{will-change:transform,opacity;transform-origin:center}
.ab-brand{flex:none;display:inline-flex;align-items:center;gap:7px;margin:0 10px 0 14px;padding:3px 12px 3px 8px;border-radius:999px;background:rgba(217,168,102,.14);border:1px solid rgba(217,168,102,.45);color:#F1D9A8;font-weight:900;font-size:12.5px;white-space:nowrap}
.ab-item{flex:none;display:inline-flex;align-items:baseline;gap:7px;white-space:nowrap;padding:0 4px;color:#FBF4EE;text-decoration:none;transition:color .25s}
.ab-item strong{font-weight:800}.ab-item small{font-size:12px;color:rgba(234,223,214,.72);font-weight:600}.ab-item em{font-style:normal;color:#D9A866;font-size:9px;align-self:center}
.ab-item.coral strong{color:#F0A48C}.ab-item.sand strong{color:#F1D9A8}.ab-item.sea strong{color:#8FD0C8}
a.ab-item:hover strong{text-decoration:underline;text-underline-offset:4px;text-decoration-color:#D9A866}
.ab-sep{flex:none;font-style:normal;color:#D9A866;font-size:10px;padding:0 14px;opacity:.9}
.ab-sep3{flex:none;font-style:normal;color:#D9A866;font-size:10px;letter-spacing:4px;padding:0 10px 0 22px;opacity:.95}
.ab:hover .ab-track,.ab:focus-within .ab-track,.ab.paused .ab-track{animation-play-state:paused}
.ab-btn{position:relative;z-index:2;flex:none;margin:0 8px 0 14px;width:30px;height:26px;border:1px solid rgba(255,255,255,.3);border-radius:8px;background:transparent;color:#fff;font-size:10px;cursor:pointer}
.ab.compact{min-height:36px;font-size:12.5px}.ab.compact .ab-k{height:36px}
.ab.still .ab-track{animation:none}.ab.still .ab-view{overflow-x:auto;mask-image:none;-webkit-mask-image:none;perspective:none}.ab.still .ab-row:last-child{display:none}.ab.still .ab-k i{animation:none}
@keyframes abRtl{from{transform:translateX(0)}to{transform:translateX(50%)}}
@keyframes abPing{0%{box-shadow:0 0 0 0 rgba(212,97,74,.7)}100%{box-shadow:0 0 0 10px rgba(212,97,74,0)}}
@media(max-width:640px){.ab-k{padding:0 12px}.ab-item small{display:none}}
`;
