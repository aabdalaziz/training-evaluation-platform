// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/councils/public — «الدوائر الحيّة» (P23): المجالس المنعقدة كدوائر مجهولة — المجال · عدد الأعضاء والجهات · القضية الجارية بموضوعها العام · نبض المداولة
 *  + خريطة الحكمة (k ≥ 5 أشخاص و≥ 2 جهة) + أعداد كلية + الميثاق. بلا أسماء ولا جهات ولا نصوص. CORS مفتوح · كاش 5 دقائق.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COUNCIL_COLS, MEMBER_COLS, CHARTER_AR, CHARTER_VERSION, COUNCIL_MIN, COUNCIL_MAX, CYCLE_WEEKS, RETURN_DAYS, K_ANON, publicCircle, feedFromPosts, THEMES_AR } from '../../../../lib/councils/registry';
import type { Council, Member, Case } from '../../../../lib/councils/registry';
import { wisdom } from '../../../../lib/councils/wisdom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const H = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };

export async function GET() {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!U || !S) return NextResponse.json({ success: false, error: 'server' }, { status: 500 });
  const db = createClient(U, S);
  const [{ data: cc }, { data: mm }, { data: cs }, { data: ps }, { data: att }] = await Promise.all([
    db.from('portal_councils').select(COUNCIL_COLS).in('status', ['active', 'proposed']).order('created_at', { ascending: false }).limit(60),
    db.from('portal_council_members').select(MEMBER_COLS).not('council_id', 'is', null).limit(2000),
    db.from('portal_council_cases').select('id,council_id,status,created_at,theme,returned_at,return_outcome').limit(3000),
    db.from('portal_council_posts').select('case_id,kind,email,created_at').gte('created_at', new Date(Date.now() - 60 * 864e5).toISOString()).limit(5000),
    db.from('portal_council_attestations').select('id,status').limit(5000),
  ]);
  const members = (mm || []) as Member[]; const cases = (cs || []) as Case[]; const feed = feedFromPosts((ps || []) as any[]);
  const circles = ((cc || []) as Council[]).map(c => publicCircle(c, members.filter(m => m.council_id === c.id), cases.filter(x => x.council_id === c.id), feed));
  const w = await wisdom(db, K_ANON);
  const totals = { councils_active: circles.filter(c => c.status === 'active').length, councils_forming: circles.filter(c => c.status === 'proposed').length, members: new Set(members.filter(m => m.status === 'active').map(m => m.email.toLowerCase())).size, orgs: new Set(members.filter(m => m.status === 'active' && m.organization_id).map(m => m.organization_id)).size, cases: cases.length, returns: cases.filter(x => x.returned_at).length, attestations_approved: ((att || []) as any[]).filter(a => a.status === 'approved').length, outcomes: { succeeded: cases.filter(x => x.return_outcome === 'succeeded').length, struggled: cases.filter(x => x.return_outcome === 'struggled').length, reframed: cases.filter(x => x.return_outcome === 'reframed').length } };
  return NextResponse.json({ success: true, generated_at: new Date().toISOString(), circles, wisdom: w, totals, themes: THEMES_AR.map(t => ({ code: t.code, label: t.label })), charter: { version: CHARTER_VERSION, clauses: CHARTER_AR }, rules: { size: `${COUNCIL_MIN}–${COUNCIL_MAX}`, min_orgs: 2, cycle_weeks: CYCLE_WEEKS, return_days: RETURN_DAYS, k_anonymity: K_ANON }, privacy_ar: 'ما يُنشر هنا مجهول دائمًا: لا أسماء ولا جهات ولا نصوص؛ الأنماط تُنشر فقط حين يقف خلفها 5 أشخاص من جهتين على الأقل.' }, { headers: H });
}
