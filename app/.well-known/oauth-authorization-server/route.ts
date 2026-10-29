// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /.well-known/oauth-authorization-server — بيانات خادم التفويض (RFC 8414) لسفارة أَثَر (P20): أَثَر هو خادم التفويض وخادم المورد معًا على نطاق واحد */
import { NextResponse } from 'next/server';
import { normalizeSite } from '../../../lib/portal/open';
import { asMetadata } from '../../../lib/portal/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: H }); }
export async function GET(req: Request) { return NextResponse.json(asMetadata(normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin)), { headers: H }); }
