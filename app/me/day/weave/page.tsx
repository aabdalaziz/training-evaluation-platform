'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/day/weave — «نسيج الشعبة — ما نسجه متعلّموك معًا» (P59 · الاسم الرسمي: خريطة الأثر المجمَّعة للشعبة) — صفحة المدرّب داخل صدفة البوابة */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../../components/PortalShell';

const WeaveDesk = dynamic(() => import('./WeaveDesk'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function WeavePage() { return <PortalShell><WeaveDesk /></PortalShell>; }
