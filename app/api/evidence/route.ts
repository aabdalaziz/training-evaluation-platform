// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/evidence — قاعدة الأدلة المؤسسية («الذاكرة الحية» · أَثَر · P14-أ)
 *  GET  ?threads=1                       → 3 خيوط أثر عامة مجهّلة لليوم (بلا تسجيل · مجموعات ≥ 5 فقط · يُخزَّن 10 دقائق)
 *  GET  ?graph=1                         → الكوكبة + الإحصاءات + دروس الأسبوع + آخر الأسئلة (طاقم)
 *  GET  ?node=<id>                       → قصة عقدة في ثلاث جمل (طاقم)
 *  POST { action:'ask', question }       → الاستعلام بالأدلة: توجيه محلي → (عند الحاجة) توجيه بالذكاء الاصطناعي إلى قالب معتمد → تنفيذ على الرسم البياني (طاقم)
 *  POST { action:'refresh' }             → إعادة بناء الرسم البياني الآن (طاقم) — ويعمل تلقائيًا في Cron اليومي
 *  POST { action:'lesson', id, status }  → اعتماد/رفض درس الأسبوع (طاقم)
 *  POST { action:'lesson_draft' }        → إنشاء مسودة درس هذا الأسبوع إن لم توجد (طاقم)
 *  الذكاء الاصطناعي لا يكتب SQL — يختار قالبًا ومعاملاته فقط؛ كل الأرقام من الرسم البياني.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, logAi, aiUsage } from '../../../lib/ai/athar';
import { buildEvidenceRoutePrompt, parseEvidencePick } from '../../../lib/ai/prompts';
import type { EvidencePick } from '../../../lib/ai/prompts';
import { TEMPLATES, TEMPLATE_IDS, matchTemplate, runTemplate, publicThreads, constellation, nodeStory, nodeMap } from '../../../lib/portal/evidence';
import type { EvidenceAnswer, Params } from '../../../lib/portal/evidence';
import { loadGraph, refreshGraph, entityIndexFrom, ensureWeeklyLesson } from '../../../lib/portal/evidence-cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const PUBLIC_HEADERS = { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200', 'Access-Control-Allow-Origin': '*' };

function serviceDb() { const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!URL_ || !SERVICE) return null; return createClient(URL_, SERVICE, { auth: { persistSession: false } }); }
async function staffCtx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const db = serviceDb();
  if (!URL_ || !ANON || !db) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('هذه الصفحة للطاقم', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role } };
}
const dayIndex = (d = new Date()) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get('threads')) {
    const db = serviceDb(); if (!db) return NextResponse.json({ success: true, threads: [] }, { headers: PUBLIC_HEADERS });
    const g = await loadGraph(db); const [{ data: lesson }] = await Promise.all([db.from('portal_graph_lessons').select('week,title_ar,body_ar').eq('status', 'approved').order('week', { ascending: false }).limit(1).maybeSingle()]);
    return NextResponse.json({ success: true, threads: publicThreads(g, dayIndex()), lesson: lesson || null, nodes: g.nodes.filter(n => n.weight > 0).length }, { headers: PUBLIC_HEADERS });
  }
  const c = await staffCtx(req); if ('error' in c) return c.error; const { db } = c;
  const node = u.searchParams.get('node');
  if (node) { const g = await loadGraph(db); return NextResponse.json({ success: true, node: nodeMap(g).get(node) || null, story: nodeStory(g, node) }); }
  const g = await loadGraph(db);
  const [{ data: lessons }, { data: recent }, { data: meta }] = await Promise.all([
    db.from('portal_graph_lessons').select('id,week,title_ar,body_ar,evidence,status,created_at').order('week', { ascending: false }).limit(12),
    db.from('portal_evidence_queries').select('id,created_at,question,template,answer,source,ok').order('created_at', { ascending: false }).limit(12),
    db.from('portal_graph_nodes').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const stats = { nodes: g.nodes.length, edges: g.edges.length, skills: g.nodes.filter(n => n.kind === 'skill' && n.weight > 0).length, people: Math.max(0, ...g.nodes.filter(n => n.kind === 'channel').map(n => n.people)), evidence: g.edges.filter(e => e.rel === 'raised' && e.src.startsWith('channel:')).reduce((s, e) => s + e.evidence, 0), updated_at: (meta as any)?.updated_at || null };
  return NextResponse.json({ success: true, stats, constellation: constellation(g), lessons: lessons || [], recent: recent || [], templates: TEMPLATES.map(t => ({ id: t.id, title_ar: t.title_ar, example_ar: t.example_ar })) });
}

export async function POST(req: Request) {
  const c = await staffCtx(req); if ('error' in c) return c.error; const { db, user } = c;
  const body = await req.json().catch(() => ({})); const action = String(body?.action || '');
  if (action === 'refresh') { const r = await refreshGraph(db); const l = await ensureWeeklyLesson(db, new Date().toISOString().slice(0, 10)); return NextResponse.json({ success: r.ok, refresh: r, lesson: l }); }
  if (action === 'lesson_draft') { const l = await ensureWeeklyLesson(db, new Date().toISOString().slice(0, 10)); return NextResponse.json({ success: l.ok, lesson: l }); }
  if (action === 'lesson') {
    const id = String(body?.id || ''); const status = String(body?.status || ''); if (!id || !['approved', 'rejected'].includes(status)) return bad('بيانات ناقصة');
    const { error } = await db.from('portal_graph_lessons').update({ status, decided_by: user.id, decided_at: new Date().toISOString() }).eq('id', id); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true });
  }
  if (action === 'ask') {
    const question = String(body?.question || '').replace(/\s+/g, ' ').trim().slice(0, 400); if (question.length < 4) return bad('اكتب سؤالًا أوضح');
    const g = await loadGraph(db); if (!g.nodes.length) return NextResponse.json({ success: true, answer: null, empty: true, error: 'الذاكرة فارغة — اضغط «حدّث الذاكرة الآن» أولًا.' });
    const idx = entityIndexFrom(g); const local = matchTemplate(question, idx);
    let answer: EvidenceAnswer | null = null; let source: 'local' | 'ai' = 'local'; let model: string | null = null; let pick: EvidencePick | null = null;
    const needsOk = !local.template.needs || local.template.needs.every(n => (local.params as any)[n]);
    if (local.score >= 3 && needsOk) answer = local.template.run(g, local.params);
    else {
      const usage = await aiUsage(db, user.id, 'evidence_query');
      if (usage.allowed) {
        const p = buildEvidenceRoutePrompt(question, TEMPLATES.map(t => ({ id: t.id, title_ar: t.title_ar, example_ar: t.example_ar, needs: t.needs as string[] | undefined })), { skills: idx.skills.map(x => ({ id: x.id, name: x.name_ar })), sectors: idx.sectors.map(x => ({ code: x.code, name: x.name_ar })), orgs: idx.orgs.map(x => ({ id: x.id, name: x.name_ar })), programs: idx.programs.map(x => ({ id: x.id, name: x.name_ar })) });
        const res = await runAi<EvidencePick | null>({ system: p.system, user: p.user, parse: raw => parseEvidencePick(raw, TEMPLATE_IDS), local: () => null, budgetMs: 15000, fast: true });
        await logAi(db, { user_id: user.id, email: user.email, role: 'staff', purpose: 'evidence_query', result: res, context: { question } });
        if (res.source === 'ai' && res.data) { pick = res.data; const params: Params = { skill: pick.skill || local.params.skill, sector: pick.sector || local.params.sector, org: pick.org || local.params.org, program: pick.program || local.params.program, year: pick.year || local.params.year }; const a = runTemplate(pick.template, g, params); if (a) { answer = a; source = 'ai'; model = res.model; } }
      }
      if (!answer) { const fb = needsOk ? local.template : TEMPLATES.find(t => t.id === 'year_summary')!; answer = fb.run(g, needsOk ? local.params : {}); }
    }
    const { data: saved } = await db.from('portal_evidence_queries').insert({ user_id: user.id, email: user.email, question, template: answer.template, params: answer.params, answer, source, ok: answer.rows.length > 0 }).select('id').maybeSingle();
    return NextResponse.json({ success: true, answer, source, model, query_id: (saved as any)?.id || null, routed_by: source === 'ai' ? 'ai' : 'local', local_score: local.score });
  }
  return bad('إجراء غير معروف');
}
