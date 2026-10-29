// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /.well-known/privacy.json — إشعار الخصوصية بصيغة آلية للوكلاء والجهات (P22 خزنة أَثَر): يُولَّد من سجل المعالجة نفسه.
 */
import { NextResponse } from 'next/server';
import { privacyJson, orgFromEnv } from '../../../lib/vault/notice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400', 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } }); }
export async function GET(req: Request) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
  return NextResponse.json(privacyJson(orgFromEnv(process.env, site)), { headers: HEADERS });
}
