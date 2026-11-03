// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/growth/<ML-XXXX-XXXX> — «رحلة المتقدّم» (م5-ب): المحاولات على سُلّم واحد، المقارنة، حكم النموّ، شهادة النموّ، ختم النموّ. خاصّة بحامل الرمز؛ لا فهرسة. */
import type { Metadata } from 'next';
import Journey from '../Journey';
import { miaarFontClass } from '../../fonts';

export const metadata: Metadata = { title: 'رحلتك في مِعيار — النموّ', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { code: string } }) {
  return <Journey code={decodeURIComponent(params.code || '').toUpperCase().slice(0, 20)} fontClass={miaarFontClass} />;
}
