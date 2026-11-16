'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/hour[?classroom=<id>][&screen=1] — «ساعة الأثر» (P73 · الاسم الرسمي: لقاء التأمل الأسبوعي للشعبة) — داخل صدفة البوابة؛ وضع الشاشة بلا صدفة */
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
import { PortalShell } from '../../components/PortalShell';

const HourRoom = dynamic(() => import('./HourRoom'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function HourPage() {
  const [screen, setScreen] = useState(false);
  useEffect(() => { try { setScreen(new URLSearchParams(window.location.search).get('screen') === '1'); } catch { /* لا شيء */ } }, []);
  const room = <Suspense fallback={null}><HourRoom /></Suspense>; /* useSearchParams */
  if (screen) return room;
  return <PortalShell>{room}</PortalShell>;
}
