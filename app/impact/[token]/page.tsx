import { notFound } from 'next/navigation';
import { ImpactForm } from './ImpactForm';

export const dynamic = 'force-dynamic';

/** S6: الرمز العام حروف/أرقام فقط (6–16؛ makeToken يولّد 8) — أيّ شكل آخر يُعاد له 404 بدل صفحة 200 */
const TOKEN_RE = /^[A-Z0-9]{6,16}$/;

export default function ImpactPage({ params, searchParams }: { params: { token: string }; searchParams?: { phase?: string } }) {
  let raw = '';
  try { raw = decodeURIComponent(params.token || ''); } catch { notFound(); }
  const token = raw.trim().toUpperCase();
  if (!TOKEN_RE.test(token)) notFound();
  const phase = searchParams?.phase === 'pre' || searchParams?.phase === 'post' ? searchParams.phase : null;
  return <ImpactForm token={token} initialPhase={phase} />;
}
