// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/certificate/<ML-XXXX-XXXX> — «شهادة اجتياز المستوى» (م6 «عُبور»): A4 ثنائية اللغة برمز التحقّق نفسه. خاصّة بحامل الرمز؛ لا فهرسة. */
import type { Metadata } from 'next';
import Certificate from '../Certificate';
import { miaarFontClass } from '../../fonts';

export const metadata: Metadata = { title: 'شهادة اجتياز المستوى — مِعيار', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { code: string } }) {
  return <Certificate code={decodeURIComponent(params.code || '').toUpperCase().slice(0, 20)} fontClass={miaarFontClass} />;
}
