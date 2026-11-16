// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /api/verify/level?code=ATH-LV-XXXX-XXXX — P70: تحقّق عام من «صفحة المستوى — بكلمات المتدرّب» بالرمز والبصمة — البرنامج والمستوى · تاريخ الختم · السلامة · الإبطال (فوري ومعلَن) · الاستبدال بختم أحدث؛ والوجه العام (face=1) بما اختاره صاحبه فقط. لا بريد ولا هاتف ولا درجة. */
import { NextResponse } from 'next/server';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { createClient } from '@supabase/supabase-js';
import { verifyLevel } from '../../../../lib/level/store';
import { P70_NAMES_AR, CARD_AR } from '../../../../lib/level/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false }, global: { fetch: noStore } }) : null; };

export async function GET(req: Request) {
  const db = svc(); if (!db) return NextResponse.json({ success: false, error: 'server' }, { status: 500 });
  const rl = await rateLimit(db, `verify:level:${ipOf(req)}`, 60, 60); if (!rl.allowed) return tooMany(rl);
  const u = new URL(req.url); const code = String(u.searchParams.get('code') || ''); const face = u.searchParams.get('face') === '1';
  const r = await verifyLevel(db, code, { face });
  return NextResponse.json({ success: true, code: code.toUpperCase(), ...r, names: P70_NAMES_AR, card_ar: CARD_AR }, { headers: { 'Cache-Control': 'no-store' } });
}
