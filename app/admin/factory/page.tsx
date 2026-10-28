// أَثَر — المسار القديم /admin/factory → «هندسة البرامج التدريبية» (/admin/program-engineering) — تحويل دائم للروابط المحفوظة
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default function LegacyFactoryRedirect() { redirect('/admin/program-engineering'); }
