// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/practice/<ML-XXXX-XXXX> — «مِران» (م10): بطاقة تمرين اليوم · شريط 14 يومًا · مرآة التحسّن · الجاهزية. خاصّة بحامل الرمز؛ لا فهرسة. */
import type { Metadata } from 'next';
import PracticeApp from '../PracticeApp';
import { miaarFontClass } from '../../fonts';

export const metadata: Metadata = { title: 'مِران — تدريبك اليومي · مِعيار من أَثَر', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { code: string } }) {
  return <PracticeApp code={decodeURIComponent(params.code || '').toUpperCase().slice(0, 20)} fontClass={miaarFontClass} />;
}
