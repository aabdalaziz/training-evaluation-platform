'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/day — «دفتر اليوم» (P51 · الاسم الرسمي: سجلّ المدرّب اليومي) — صفحة صباح المدرّب داخل صدفة البوابة */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';

const DayBook = dynamic(() => import('./DayBook'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function DayPage() { return <PortalShell><DayBook /></PortalShell>; }
