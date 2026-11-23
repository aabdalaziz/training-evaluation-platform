'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * ستار الأثر (هوية v1.2): العلامة الكاملة النابضة + الاسم + الأبواب، تظهر مرّة في الجلسة عند أول دخول وتختفي حين تكتمل الصفحة (≤ 1.6 ث)،
 *  وتعود بعد سكون 3 دقائق (لمسة أو مفتاح أو تمرير يرفعها). لا تظهر أبدًا: في شاشة التقييم/المشاهدة (data-engrave=none)، أثناء الكتابة في حقل،
 *  مع صوت/فيديو يعمل، مع prefers-reduced-motion، أو حين تكون نافذة غير مرئية. زر «تخطّي» دائمًا.
 */
import { useEffect, useState } from 'react';
import { MARK_PATHS, MARK_ARCS } from './Brand';

const KEY = 'athar_veil_seen'; const IDLE_MS = 180000;
export default function AtharVeil({ doors = ['مِعيار', 'اقْرَأْ', 'البرامج', 'تحقّق'] }: { doors?: string[] }) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch { /* ignore */ }
    if (reduce) return;
    const blocked = () => {
      const h = document.documentElement; if (h.dataset.engrave === 'none') return true;
      const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || (a as HTMLElement).isContentEditable)) return true;
      if ([...document.querySelectorAll('audio,video')].some(m => !(m as HTMLMediaElement).paused)) return true;
      if (document.hidden) return true;
      return false;
    };
    let first = false; try { first = sessionStorage.getItem(KEY) !== '1'; } catch { /* ignore */ }
    let t: ReturnType<typeof setTimeout> | null = null;
    if (first && !blocked()) {
      setShow(true); try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
      const done = () => setTimeout(() => setShow(false), 900);
      if (document.readyState === 'complete') done(); else window.addEventListener('load', done, { once: true });
      t = setTimeout(() => setShow(false), 1600); /* سقف: لا يحجب أكثر من 1.6 ث */
    }
    let idle: ReturnType<typeof setTimeout> | null = null;
    const arm = () => { if (idle) clearTimeout(idle); idle = setTimeout(() => { if (!blocked()) setShow(true); }, IDLE_MS); };
    const wake = () => { setShow(false); arm(); };
    const evs: (keyof DocumentEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    evs.forEach(e => document.addEventListener(e, wake, { passive: true }));
    arm();
    return () => { if (t) clearTimeout(t); if (idle) clearTimeout(idle); evs.forEach(e => document.removeEventListener(e, wake)); };
  }, []);
  if (!mounted) return null;
  return (
    <div className={`ath-veil ${show ? '' : 'hide'}`} aria-hidden={!show} data-testid="athar-veil" onClick={() => setShow(false)}>
      <svg viewBox="0 30 240 180" aria-hidden="true">
        <defs><linearGradient id="veilg" gradientUnits="userSpaceOnUse" x1="120" y1="192" x2="120" y2="60"><stop offset="0" stopColor="#6A3350" /><stop offset=".42" stopColor="#8E4A68" /><stop offset=".72" stopColor="#D4614A" /><stop offset="1" stopColor="#D9A866" /></linearGradient></defs>
        {['', 'b', 'c'].map(k => <g key={k} className={`ath-veil-echo ${k}`}>{MARK_ARCS.map((d, i) => <path key={i} d={d} />)}</g>)}
        {MARK_PATHS.map((d, i) => <path key={i} d={d} fill="url(#veilg)" />)}
        <rect x="115.5" y="97.54" width="9" height="9" rx="1.26" transform="rotate(45 120 102.035)" fill="#E8795C" />
        <rect x="112.5" y="63.12" width="15" height="15" rx="2.1" transform="rotate(45 120 70.617)" fill="#D9A866" />
      </svg>
      <b>أَثَر</b>
      <small>نبني القدرة ونُثبت الأثر</small>
      <div className="ath-veil-doors">{doors.map(d => <span key={d}>{d}</span>)}</div>
      <button type="button" onClick={() => setShow(false)}>تخطّي</button>
    </div>
  );
}
