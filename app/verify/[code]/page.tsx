import { VerifyCard } from './VerifyCard';

export const dynamic = 'force-dynamic';

export default function VerifyPage({ params }: { params: { code: string } }) {
  return <VerifyCard code={decodeURIComponent(params.code || '')} />;
}
