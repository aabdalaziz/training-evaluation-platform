'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/level?level=<enrollment:level_no> — «بكلماتي عبر المستوى» (P70 · الاسم الرسمي: صفحة المستوى — بكلمات المشارك) — داخل صدفة البوّابة؛ ما كتبه وقاله المشارك في مستواه + سطر المستوى + ختم ATH-LV */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';

const LevelDesk = dynamic(() => import('./LevelDesk'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function LevelPage() { return <PortalShell><LevelDesk /></PortalShell>; }
