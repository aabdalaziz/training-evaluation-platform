// أَثَر — المسار القديم /live/copilot/[id] → «الميسِّر الحي» (/live/facilitator/[id]) — تحويل دائم للروابط المحفوظة
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyCopilotRedirect({ params }: { params: { id: string } }) { redirect(`/live/facilitator/${params.id}`); }
