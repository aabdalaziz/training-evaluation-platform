// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P80 */
/**
 * /api/cron/backup — النسخة الاحتياطية اليومية (P80-ج)
 *  GET ?key=CRON_SECRET (أو Bearer) [&dry=1]  → يكتب daily/YYYY-MM-DD.json في حاوية portal-backups ويشذّب القديم.
 *  يُستدعى من المهمّة اليومية الموجودة (/api/followups/send) بلا كرون جديد، ويمكن تشغيله يدويًّا من المتصفّح بالمفتاح.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cronAuthorized } from '../../../../lib/shield/body';
import { runAutoBackup } from '../../../../lib/backup/auto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!URL_ || !SERVICE) return NextResponse.json({ success: false, error: 'إعدادات الخادم غير مكتملة' }, { status: 500 });
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const r = await runAutoBackup(db, { dry });
  return NextResponse.json({ success: r.ok, ...r }, { status: r.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } });
}
