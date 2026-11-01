// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/result/<ML-XXXX-XXXX> — بطاقة المستوى برمز النتيجة (خاصّة بحاملها؛ لا فهرسة). للجهات: التحقق بالرمز نفسه. */
import type { Metadata } from 'next';
import MiaarApp from '../../MiaarApp';
import { miaarFontClass } from '../../fonts';

export const metadata: Metadata = { title: 'بطاقة المستوى — مِعيار', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { code: string } }) {
  return <MiaarApp fontClass={miaarFontClass} resultCode={decodeURIComponent(params.code || '').toUpperCase().slice(0, 20)} />;
}
