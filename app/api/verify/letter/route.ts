// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /api/verify/letter?code=ATH-ML-XXXX-XXXX — P52: تحقّق عام من «رسالة الشهر» بالرمز والبصمة — بلا محتوى (الجهة · الشهر · تاريخ التوقيع · صفة الموقِّع · سلامة البصمة) */
import { NextResponse } from 'next/server';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { svc } from '../../../../lib/org-impact/auth';
import { verifyLetter } from '../../../../lib/org-impact/letter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const db = svc(); if (!db) return NextResponse.json({ success: false, error: 'server' }, { status: 500 });
  const rl = await rateLimit(db, `verify:letter:${ipOf(req)}`, 60, 60); if (!rl.allowed) return tooMany(rl);
  const code = String(new URL(req.url).searchParams.get('code') || '');
  const r = await verifyLetter(db, code);
  return NextResponse.json({ success: true, code: code.toUpperCase(), ...r }, { headers: { 'Cache-Control': 'no-store' } });
}
