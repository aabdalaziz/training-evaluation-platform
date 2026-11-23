'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** زرّ «كيف يصنع بَيان أثرًا؟» — يفتح النسخة (ب) من افتتاحية بَيان في طبقة كاملة (لا شيء يُرسَل) */
import { useState } from 'react';
import { BayanIntro } from './BayanIntro';

export function IntroButton({ className, style, label = 'كيف يصنع بَيان أثرًا؟ ▶ (3 دقائق)' }: { className?: string; style?: React.CSSProperties; label?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={className} style={style} onClick={() => setOpen(true)} data-testid="intro-parents-open">{label}</button>
    {open && <BayanIntro mode="parents" onDone={() => setOpen(false)} onSkip={() => setOpen(false)} />}
  </>;
}
