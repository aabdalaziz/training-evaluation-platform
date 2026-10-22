import { ImpactForm } from './ImpactForm';

export const dynamic = 'force-dynamic';

export default function ImpactPage({ params, searchParams }: { params: { token: string }; searchParams?: { phase?: string } }) {
  const phase = searchParams?.phase === 'pre' || searchParams?.phase === 'post' ? searchParams.phase : null;
  return <ImpactForm token={decodeURIComponent(params.token || '').toUpperCase()} initialPhase={phase} />;
}
