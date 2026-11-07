// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /api/verify/map?code=ATH-MP-XXXX-XXXX — P58: تحقّق عام من «خريطة أثري <سنة>» بالرمز والبصمة — السنة · تاريخ التوقيع · السلامة · الإبطال · والأعداد؛ الخريطة نفسها فقط إن جعلها صاحبها عامة (بلا أسماء ولا عناوين حسّاسة) */
import { NextResponse } from 'next/server';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { createClient } from '@supabase/supabase-js';
import { verifyMap } from '../../../../lib/map/store';
import { RULE_AR, KIND_AR, layout } from '../../../../lib/map/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' }); /* لا ذاكرة تخزين لطلبات القراءة — حالة اللقطة (عامة/مُبطلة) يجب أن تُقرأ طازجة */
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false }, global: { fetch: noStore } }) : null; };

export async function GET(req: Request) {
  const db = svc(); if (!db) return NextResponse.json({ success: false, error: 'server' }, { status: 500 });
  const rl = await rateLimit(db, `verify:map:${ipOf(req)}`, 60, 60); if (!rl.allowed) return tooMany(rl);
  const code = String(new URL(req.url).searchParams.get('code') || '');
  const r = await verifyMap(db, code);
  const lay = r.body ? layout(r.body.stations.map((s) => ({ ...s, public_ar: s.title_ar, skills: [] }))) : undefined;
  return NextResponse.json({ success: true, code: code.toUpperCase(), ...r, layout: lay, rules: RULE_AR, kinds: KIND_AR }, { headers: { 'Cache-Control': 'no-store' } });
}
