'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/first?program=<id> — «أول يوم — قال من سبقك» (P64 · الاسم الرسمي: صفحة اليوم الأول للمتدرّب) — داخل صدفة البوابة؛ كلمة أَثَر ثم سطور من سبقك ثم سطرك «لماذا جئتُ» */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';

const FirstDesk = dynamic(() => import('./FirstDesk'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function FirstPage() { return <PortalShell><FirstDesk /></PortalShell>; }
