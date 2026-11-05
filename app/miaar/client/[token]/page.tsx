// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/client/<token> — «بوابة الجهة» (م7 «عُبور للجهات»): لوحة قراءة فقط برابط سرّي لمنسّق الجهة الطالبة — بلا حساب، لا فهرسة. */
import type { Metadata } from 'next';
import ClientBoard from '../ClientBoard';
import { miaarFontClass } from '../../fonts';

export const metadata: Metadata = { title: 'بوابة الجهة — خدمة الاختبار المعياري · مِعيار', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: { token: string } }) {
  return <ClientBoard token={decodeURIComponent(params.token || '').slice(0, 64)} fontClass={miaarFontClass} />;
}
