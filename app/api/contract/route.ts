// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/contract — الصفحة الحية لعقد الأثر (P12-ب) — عامة بالرمز، للقراءة فقط
 *  GET ?token=XXXX → { ok, contract (نسخة عامة: أعداد لا أسماء), state, releases, story, org, program }
 *  الرمز 24 خانة عشوائية يُرسل لجهة الاتصال عند التفعيل؛ لا يكشف بريدًا ولا اسم منسوب، ولا يُتيح أي كتابة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CONTRACT_COLS, rowToContract, stateFor } from '../../../lib/portal/contracts-cron';
import { publicContract, contractStory } from '../../../lib/portal/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const TOKEN_RE = /^[A-Za-z0-9]{16,40}$/;

export async function GET(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !SERVICE) return NextResponse.json({ success: false, error: 'إعدادات الخادم غير مكتملة' }, { status: 500 });
  const token = new URL(req.url).searchParams.get('token') || ''; if (!TOKEN_RE.test(token)) return NextResponse.json({ success: true, ok: false });
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data } = await db.from('portal_impact_contracts').select(CONTRACT_COLS).eq('token', token).maybeSingle(); if (!data || (data as any).status === 'draft') return NextResponse.json({ success: true, ok: false });
  const c = rowToContract(data);
  const [{ data: org }, { data: prog }] = await Promise.all([
    db.from('portal_organizations').select('name_ar,name_en,sector,city').eq('id', c.organization_id).maybeSingle(),
    c.program_id ? db.from('programs').select('name_ar,name_en,hours').eq('id', c.program_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  c.org_name = (org as any)?.name_ar || ''; c.program_name = (prog as any)?.name_ar || '';
  const { state, facts } = await stateFor(db, c);
  return NextResponse.json({ success: true, ok: true, contract: publicContract(c), state, releases: facts.releases.map(r => ({ milestone: r.milestone, pct: r.pct, amount: r.amount, memo_no: r.memo_no, released_at: r.released_at, note: r.note })), story: { ar: contractStory(c, state, 'ar'), en: contractStory(c, state, 'en') }, org: org || null, program: prog || null, generated_at: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
