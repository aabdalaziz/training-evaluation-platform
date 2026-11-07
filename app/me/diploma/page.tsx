'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/diploma?program=<id> — «هيكل الدبلوم» (P66-ب · الاسم الرسمي: هيكل الدبلوم: المستويات والمقرّرات والشُّعب وأساتذة المواد) — للطاقم ومنسّق الشعبة (تحرير) وأساتذة المواد (قراءة) */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';

const StructureDesk = dynamic(() => import('./StructureDesk'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function DiplomaPage() { return <PortalShell><StructureDesk /></PortalShell>; }
