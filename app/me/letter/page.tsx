'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/letter — «رسالة إلى نفسي بعد سنة — إلى مَن سأكون» (P62 · الاسم الرسمي: الرسالة المؤجَّلة للمتدرّب) — داخل صدفة البوابة؛ تبني على رسالة «رحلتي» (P25) وجدولها نفسه */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';

const SelfLetter = dynamic(() => import('./SelfLetter'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function SelfLetterPage() { return <PortalShell><SelfLetter /></PortalShell>; }
