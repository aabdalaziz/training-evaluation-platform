// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/d/<code>[?t=token] — دخول عبر دعوة (جماعية برمز قصير أو شخصية برمز + رمز خاص). الدعوة تُقرأ على الخادم عبر /api/miaar?invite= */
import type { Metadata } from 'next';
import MiaarApp from '../../MiaarApp';
import { miaarFontClass } from '../../fonts';

export const metadata: Metadata = { title: 'دعوة إلى مِعيار', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function Page({ params, searchParams }: { params: { code: string }; searchParams: { t?: string } }) {
  const code = decodeURIComponent(params.code || '').toUpperCase().slice(0, 16);
  const t = typeof searchParams?.t === 'string' ? searchParams.t.slice(0, 80) : null;
  return <MiaarApp inviteCode={code} inviteToken={t} fontClass={miaarFontClass} />;
}
