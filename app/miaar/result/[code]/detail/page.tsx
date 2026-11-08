// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/result/<ML-XXXX-XXXX>/detail — P68-ب «التقرير التفصيلي»: مهارات · واصفات CEFR · بنود (رمز · ✓/✗ · زمن) — خاصّ بحامل الرمز؛ لا فهرسة */
import type { Metadata } from 'next';
import DetailReport from '../../../DetailReport';
import { miaarFontClass } from '../../../fonts';

export const metadata: Metadata = { title: 'التقرير التفصيلي — مِعيار', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { code: string } }) {
  return <DetailReport fontClass={miaarFontClass} code={decodeURIComponent(params.code || '').toUpperCase().slice(0, 20)} />;
}
