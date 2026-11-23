// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KidPlay } from '../../../components/kids/KidPlay';

export const metadata: Metadata = { title: 'بَيان — هيّا نلعب', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** هـ-6-و — منطقة لعب الطفل: بوّابة الكبار ثم الجلسة بوضع الطفل، في جلسة وليّ الأمر */
export default function KidsPlayPage({ params }: { params: { child: string } }) {
  return <Suspense fallback={null}><KidPlay childId={params.child} /></Suspense>;
}
