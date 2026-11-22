'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * منظومة حركة أَثَر v1.2 — سبع حركات بإيقاع واحد (0.4–0.9 ث · cubic-bezier(.2,.8,.2,1)):
 *  Flip   بطاقة تنقلب لتكشف تفصيل ما على وجهها (المستويات · الإحصاءات · الشهادة · الخدمات · «لو خرجت اليوم»)
 *  useTilt ميل خفيف مع المؤشّر (الأبواب والبطاقات الكبيرة؛ معطّل على اللمس)
 *  Echo   صدى الأقواس حول حدث واحد في الشاشة (توقيع شاهد · نتيجة)
 *  CountUp أرقام حيّة تصعد (أبدًا لا للمال ولا للدرجات)
 *  Reveal ظهور القسم مرّة واحدة عند دخوله مجال الرؤية
 *  (شريط التبويب الممتدّ والنبض الحيّ: CSS فقط — .ath-tabink · .ath-live)
 *  القواعد: لوحة المفاتيح بـ aria-pressed؛ prefers-reduced-motion = سكون؛ شاشة التقييم (html[data-engrave=none]) = سكون تامّ.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

const EASE = 'cubic-bezier(.2,.8,.2,1)';

/** بطاقة تنقلب — الوجه = هويّة/لون، الظهر = التفصيل. يُقلب بالنقر أو Enter/Space، ويُعلن حالته بـ aria-pressed. */
export function Flip({ front, back, className = '', style, level, minHeight = 200, label, flipped, onFlip, testId }: {
  front: ReactNode; back: ReactNode; className?: string; style?: CSSProperties; level?: string; minHeight?: number; label?: string;
  flipped?: boolean; onFlip?: (v: boolean) => void; testId?: string;
}) {
  const [own, setOwn] = useState(false);
  const on = flipped ?? own;
  const toggle = () => { const v = !on; if (flipped === undefined) setOwn(v); onFlip?.(v); };
  return (
    <button type="button" className={`ath-flip ${className}`} style={{ minHeight, ...style }} aria-pressed={on} aria-label={label} onClick={toggle} data-level={level} data-testid={testId}>
      <div className="ath-flip-inner" style={{ minHeight }}>
        <div className="ath-face front">{front}</div>
        <div className="ath-face back">{back}</div>
      </div>
    </button>
  );
}

/** ميل خفيف يتبع المؤشّر (±6°). يعيد خصائص تُنشر على العنصر. معطّل على اللمس وعند خفض الحركة. */
export function useTilt(max = 6) {
  const ref = useRef<HTMLElement | null>(null);
  const [st, setSt] = useState<CSSProperties>({});
  const enabled = useRef(true);
  useEffect(() => { try { enabled.current = !window.matchMedia('(pointer:coarse)').matches && !window.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch { /* ignore */ } }, []);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!enabled.current) return; const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    setSt({ ['--rx' as string]: `${(-y * max).toFixed(2)}deg`, ['--ry' as string]: `${(x * max).toFixed(2)}deg` } as CSSProperties);
  };
  const onLeave = () => setSt({});
  return { ref, className: 'ath-tilt', style: st, onMouseMove: onMove, onMouseLeave: onLeave };
}

/** صدى الأقواس حول عنصر — واحد في الشاشة لا أكثر. */
export function Echo({ color, size = 24 }: { color?: string; size?: number }) {
  return <span className="ath-echo" aria-hidden="true" style={{ fontSize: size, ...(color ? { ['--zone-echo' as string]: color } : {}) } as CSSProperties}><i /><i /><i /></span>;
}

/** رقم حيّ يصعد إلى قيمته خلال 0.9 ث عند ظهوره — للأعداد الحيّة فقط (اعتمادات · حضور · جلسات). لا يُستعمل للمال ولا للدرجات. */
export function CountUp({ value, duration = 900, format, className }: { value: number; duration?: number; format?: (n: number) => string; className?: string }) {
  const [n, setN] = useState(0); const ref = useRef<HTMLSpanElement>(null); const done = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches || document.documentElement.dataset.engrave === 'none'; } catch { /* ignore */ }
    if (reduce) { setN(value); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done.current) return; done.current = true;
      const t0 = performance.now();
      const step = (t: number) => { const p = Math.min(1, (t - t0) / duration); const k = 1 - Math.pow(1 - p, 3); setN(Math.round(value * k)); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: .4 });
    io.observe(el); return () => io.disconnect();
  }, [value, duration]);
  useEffect(() => { if (done.current) setN(value); }, [value]);
  return <span ref={ref} className={className}>{format ? format(n) : n.toLocaleString('ar-EG')}</span>;
}

/** ظهور لطيف مرّة واحدة عند دخول القسم مجال الرؤية. */
export function Reveal({ children, className = '', as: Tag = 'div', delay = 0 }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'li' | 'article'; delay?: number }) {
  const ref = useRef<HTMLElement | null>(null); const [inView, setIn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIn(true); io.disconnect(); } }, { threshold: .15 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const T = Tag as any;
  return <T ref={ref} className={`ath-reveal ${inView ? 'in' : ''} ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>{children}</T>;
}

/** فاصل مقوّس — قوس العلامة بخط رفيع ومعيّن في وسطه بدل <hr> بين الأقسام الرئيسية. */
export function ArcDivider({ className = '' }: { className?: string }) {
  return (
    <svg className={`ath-divider ${className}`} viewBox="0 0 1200 18" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 16 Q 600 -10 1200 16" /><rect x="597" y="0" width="6" height="6" transform="rotate(45 600 3)" />
    </svg>
  );
}

/** أفق الأثر — قوسا الانتشار يمتدّان رفيعين عبر عرض الترويسة، وشعاع ضوء يسري عليهما كل 9 ثوانٍ (من الفيديو التعريفي). */
export function Horizon({ light = false, height = 140 }: { light?: boolean; height?: number }) {
  return (
    <div className={`ath-hz ${light ? 'light' : ''}`} aria-hidden="true" style={{ height }}>
      <svg viewBox="0 0 1280 160" preserveAspectRatio="none" style={{ height }}>
        <path d="M-20 158 Q 640 -80 1300 158" /><path d="M-20 124 Q 640 -40 1300 124" />
        <path className="ath-hzglow" d="M-20 158 Q 640 -80 1300 158" /><path className="ath-hzglow b" d="M-20 124 Q 640 -40 1300 124" />
      </svg>
    </div>
  );
}

export const ATHAR_EASE = EASE;
