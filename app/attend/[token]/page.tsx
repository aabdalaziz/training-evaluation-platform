import { CheckinForm } from './CheckinForm';

export const dynamic = 'force-dynamic';

export default function AttendPage({ params }: { params: { token: string } }) {
  return <CheckinForm token={decodeURIComponent(params.token || '').toUpperCase()} />;
}
