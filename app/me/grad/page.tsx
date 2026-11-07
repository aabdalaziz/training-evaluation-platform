'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/grad?program=<id> — «يوم تخرّجي — بكلماتي» (P63 · الاسم الرسمي: صفحة التخرّج الذاتية للمتدرّب) — داخل صدفة البوابة؛ ما كتبه المتدرّب بيده في برنامجه + سطر التخرّج + ختم ATH-GD */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';

const GradDesk = dynamic(() => import('./GradDesk'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function GradPage() { return <PortalShell><GradDesk /></PortalShell>; }
