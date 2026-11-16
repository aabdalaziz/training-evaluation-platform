// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «خِفّة أَثَر» (P40) — واجهة الصفحة الرئيسة الواحدة.
 *  كانت الرئيسة تنادي /api/advisor و /api/evidence?threads=1 (دالتان باردتان) عند كل فتح.
 *  هنا نداء واحد يجمع الاثنين على الخادم ويُخزَّن على حافة Vercel 60 ثانية (ويُقدَّم القديم 5 دقائق أثناء التجديد)،
 *  فلا يلمس الزائر إقلاعًا باردًا، ولا تُستدعى قاعدة البيانات أكثر من مرة في الدقيقة لكل منطقة.
 *  GET /api/home → { success, now, programs, sessions, counters, threads, lesson, nodes, heard, why }
 *  P75: why = «لماذا جاؤوا» (سطور الدخول المأذونة من مسكَّنين — 20 شخصًا و5 شُعب).
 *  P74: heard = «سمعناكم» (آخر 7 سطور ساعات مختومة من كل الشُّعب — بلا أسماء؛ لا يظهر دون 20 مشاركًا و5 شُعب).
 */
import { NextResponse } from 'next/server';
import { GET as advisorGet } from '../advisor/route';
import { GET as evidenceGet } from '../evidence/route';
import { createClient } from '@supabase/supabase-js';
import { heardThread } from '../../../lib/hour/store';
import { whyThread } from '../../../lib/first/entry'; /* P75 «لماذا جاؤوا» */

const EMPTY_HEARD = { shown: false, items: [], sections: 0, people: 0, week_sections: 0, week_people: 0, head_ar: '', why: 'empty' as const };
const EMPTY_WHY = { shown: false, items: [], people: 0, sections: 0, head_ar: '', why: 'empty' as const };
function serviceDb() { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const K = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!U || !K) return null; return createClient(U, K, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...(init || {}), cache: 'no-store' }) } }); }
async function whySafe() { try { const db = serviceDb(); return db ? await whyThread(db) : EMPTY_WHY; } catch { return EMPTY_WHY; } }
async function heardSafe() { try { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const K = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!U || !K) return EMPTY_HEARD; const db = createClient(U, K, { auth: { persistSession: false }, global: { fetch: (i: any, init?: any) => fetch(i, { ...(init || {}), cache: 'no-store' }) } }); return await heardThread(db); } catch { return EMPTY_HEARD; } }

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const safe = async (p: Promise<Response | undefined>) => { try { const r = await p; if (!r) return {}; return (await r.json()) as Record<string, unknown>; } catch { return {}; } };
  const [a, e, heard, why] = await Promise.all([
    safe(advisorGet(new Request(`${origin}/api/advisor`, { headers: { accept: 'application/json' } }))),
    safe(evidenceGet(new Request(`${origin}/api/evidence?threads=1`, { headers: { accept: 'application/json' } }))),
    heardSafe(),
    whySafe(),
  ]);
  return NextResponse.json({ success: true, now: a.now || new Date().toISOString(), programs: a.programs || [], sessions: a.sessions || [], counters: a.counters || { resources: 0, credentials: 0, sims: 0 }, threads: Array.isArray(e.threads) ? e.threads : [], lesson: e.lesson || null, nodes: e.nodes || 0, heard, why },
    { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' } });
}
