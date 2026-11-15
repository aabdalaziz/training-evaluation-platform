// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/proctor/<invite_code>?t=<token> — P68-ب-2 «ختم المراقب»: يُفتح بمسح QR على نسخة المراقب المطبوعة — بلا دخول؛ الرمز الموقَّع هو الهوية */
import type { Metadata } from 'next';
import ProctorStamp from './ProctorStamp';

export const metadata: Metadata = { title: 'ختم المراقب — مِعيار', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Page({ params, searchParams }: { params: { code: string }; searchParams: { t?: string } }) {
  const code = decodeURIComponent(params.code || '').toUpperCase().slice(0, 40);
  const t = typeof searchParams?.t === 'string' ? searchParams.t.slice(0, 64) : '';
  return <ProctorStamp code={code} token={t} />;
}
