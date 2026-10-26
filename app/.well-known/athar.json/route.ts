// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /.well-known/athar.json — ملف المُصدِر (Open Badges 3.0 Profile) لبوابة أَثَر (P8-ج)
 * كل شهادة رقمية تشير إلى هذا العنوان بوصفه issuer؛ يحتوي أيضًا روابط الكتالوج المفتوح والتحقق.
 */
import { NextResponse } from 'next/server';
import { issuerProfile, normalizeSite } from '../../../lib/portal/open';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400', 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } }); }
export async function GET(req: Request) {
  const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
  return NextResponse.json(issuerProfile(site), { headers: HEADERS });
}
