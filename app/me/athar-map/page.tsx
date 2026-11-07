'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/athar-map — «خريطة أثرك — ما قاد إلى ماذا» (P58 · الاسم الرسمي: خريطة الأثر الذاتية للمتعلّم) — داخل صدفة البوابة؛ تختلف عن /me/map (خريطة الجدارات H1–H12) و/me/skills (الملف المهاري) */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';

const AtharMapDesk = dynamic(() => import('./AtharMapDesk'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function AtharMapPage() { return <PortalShell><AtharMapDesk /></PortalShell>; }
