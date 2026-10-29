// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /.well-known/security.txt — RFC 9116 (درع أَثَر P21): كيف يبلّغ الباحثون عن ثغرة.
 *  Expires يُحسب آليًا (نهاية الشهر بعد 11 شهرًا) فلا ينتهي الملف سهوًا؛ Contact من SECURITY_CONTACT أو NOTIFY_EMAILS/ADMIN_EMAILS أو صفحة البلاغ.
 */
import { securityTxt } from '../../../lib/shield/drill';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(securityTxt(process.env), { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
