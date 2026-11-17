'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «حجم القراءة» — ثلاث درجات لخطّ القراءة التعليمية (.read) تُحفظ على جهاز المتعلّم وحده (localStorage، بلا خادم). يضع data-read على <html>. */
import { useEffect, useState } from 'react';

const KEY = 'athar_read'; const STEPS = ['1', '2', '3'] as const;
export default function ReadSize({ label = 'حجم القراءة' }: { label?: string }) {
  const [v, setV] = useState<string>('1');
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s && (STEPS as readonly string[]).includes(s)) { setV(s); document.documentElement.dataset.read = s; } } catch { /* بلا تخزين */ } }, []);
  const pick = (s: string) => { setV(s); document.documentElement.dataset.read = s; try { localStorage.setItem(KEY, s); } catch { /* تجاهل */ } };
  return <div className="rs" role="group" aria-label={label} data-testid="read-size">{STEPS.map((s) => <button key={s} type="button" onClick={() => pick(s)} aria-pressed={v === s} aria-label={`${label} ${s}`} title={label}>أ</button>)}</div>;
}
