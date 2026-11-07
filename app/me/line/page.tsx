'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /me/line — «سطري» (P66 · الاسم الرسمي: سجلّ التعلّم والتطبيق للمتدرّب) — يوم تدريب: سطر اليوم · فترة تطبيق: «البرنامج معك في موقعك» · آخر يوم الكتلة: التزامي حتى نلتقي */
import dynamic from 'next/dynamic';
import { PortalShell } from '../../components/PortalShell';

const LineDesk = dynamic(() => import('./LineDesk'), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
export default function LinePage() { return <PortalShell><LineDesk /></PortalShell>; }
