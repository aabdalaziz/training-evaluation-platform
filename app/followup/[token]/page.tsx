import { FollowupForm } from './FollowupForm';

export const dynamic = 'force-dynamic';

export default function FollowupPage({ params, searchParams }: { params: { token: string }; searchParams?: { role?: string; tn?: string; te?: string } }) {
  const role = searchParams?.role === 'supervisor' || searchParams?.role === 'trainee' || searchParams?.role === 'peer' ? searchParams.role : null;
  return <FollowupForm token={decodeURIComponent(params.token || '').toUpperCase()} initialRole={role} traineeName={searchParams?.tn || ''} traineeEmail={searchParams?.te || ''} />;
}
