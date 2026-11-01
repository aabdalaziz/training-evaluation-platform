// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «خِفّة أَثَر» (P40) — واجهة الصفحة الرئيسية الواحدة.
 *  كانت الرئيسية تنادي /api/advisor و /api/evidence?threads=1 (دالتان باردتان) عند كل فتح.
 *  هنا نداء واحد يجمع الاثنين على الخادم ويُخزَّن على حافة Vercel 60 ثانية (ويُقدَّم القديم 5 دقائق أثناء التجديد)،
 *  فلا يلمس الزائر إقلاعًا باردًا، ولا تُستدعى قاعدة البيانات أكثر من مرة في الدقيقة لكل منطقة.
 *  GET /api/home → { success, now, programs, sessions, counters, threads, lesson, nodes }
 */
import { NextResponse } from 'next/server';
import { GET as advisorGet } from '../advisor/route';
import { GET as evidenceGet } from '../evidence/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const safe = async (p: Promise<Response | undefined>) => { try { const r = await p; if (!r) return {}; return (await r.json()) as Record<string, unknown>; } catch { return {}; } };
  const [a, e] = await Promise.all([
    safe(advisorGet(new Request(`${origin}/api/advisor`, { headers: { accept: 'application/json' } }))),
    safe(evidenceGet(new Request(`${origin}/api/evidence?threads=1`, { headers: { accept: 'application/json' } }))),
  ]);
  return NextResponse.json({ success: true, now: a.now || new Date().toISOString(), programs: a.programs || [], sessions: a.sessions || [], counters: a.counters || { resources: 0, credentials: 0, sims: 0 }, threads: Array.isArray(e.threads) ? e.threads : [], lesson: e.lesson || null, nodes: e.nodes || 0 },
    { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' } });
}
