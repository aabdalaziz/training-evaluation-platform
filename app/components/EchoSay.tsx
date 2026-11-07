'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * EchoSay — 🔊 يقرأ نصًّا قصيرًا بصوت الجهاز (Web Speech · بلا خادم · بلا رموز) · يُخفى إن لم يُدعم.
 *  يُستخدم في: تنبيهات المتعلّم (P56 صدى الأسبوع) · دفتر اليوم (بطاقة المدرّب) · رسالة الشهر (P57 نبض الشهر).
 *  CSS: .nt-echo-say (في Notices.tsx) و.ls-pulse .nt-echo-say (في LetterSheet.tsx).
 */
import { useEffect, useState } from 'react';

/** P56 «صدى الأسبوع» — 🔊 يقرأ الصدى بصوت الجهاز (بلا رموز) · يُخفى إن لم يُدعم */
export function EchoSay({ text, ar, testid = 'nt-echo-say' }: { text: string; ar: boolean; testid?: string }) {
  const [can, setCan] = useState(false); const [on, setOn] = useState(false); useEffect(() => { setCan(typeof window !== 'undefined' && 'speechSynthesis' in window); }, []);
  if (!can) return null;
  const say = () => { try { const ss = window.speechSynthesis; if (on) { ss.cancel(); setOn(false); return; } ss.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F399}\u{1F331}\u{270B}\u{1F550}\u{1FA9E}\u{2713}\u{FE0F}]/gu, '').replace(/ · /g, '، ').replace(/\s+/g, ' ')); u.lang = ar ? 'ar-SA' : 'en-GB'; u.rate = 0.95; u.onend = () => setOn(false); u.onerror = () => setOn(false); setOn(true); ss.speak(u); } catch { setOn(false); } };
  return <button type="button" className={`nt-echo-say ${on ? 'on' : ''}`} onClick={say} aria-pressed={on} data-testid={testid}>{on ? '⏹' : '🔊'} {ar ? (on ? 'أوقف' : 'اسمعه') : (on ? 'Stop' : 'Listen')}</button>;
}
