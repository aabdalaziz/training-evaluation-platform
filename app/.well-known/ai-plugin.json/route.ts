// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// /.well-known/ai-plugin.json — بطاقة الاكتشاف الآلي لأَثَر (أَثَر للوكلاء · P14-ب): ما الأدوات، كيف التفويض، وما الحوكمة
import { NextResponse } from 'next/server';
import { pluginManifest } from '../../../lib/portal/agents';
import { normalizeSite } from '../../../lib/portal/open';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
  return NextResponse.json(pluginManifest(site), { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400', 'Access-Control-Allow-Origin': '*' } });
}
