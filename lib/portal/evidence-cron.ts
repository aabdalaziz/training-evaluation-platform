// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — قاعدة الأدلة المؤسسية: القراءة من الجداول الموجودة وإعادة بناء الرسم البياني (P14-أ)
 *  refreshGraph(db): يقرأ لقطات محدودة الحجم من 13 جدولًا موجودًا → buildGraph → يستبدل portal_graph_nodes/edges دفعة واحدة
 *  loadGraph(db): يحمّل الرسم البياني المخزَّن (للاستعلام والكوكبة والخيوط العامة)
 *  ensureWeeklyLesson(db, today): مسودة «درس الأسبوع» (محليًا) إن لم توجد لهذا الأسبوع — تنتظر اعتماد إنسان
 *  يعمل داخل سلسلة Cron اليومية القائمة — بلا Cron جديد.
 */
import { buildGraph, graphRows, lessonDraft, weekStart } from './evidence';
import type { Graph, GraphSources, EntityIndex } from './evidence';

const LIM = { events: 20000, rows: 3000 };
const safe = async <T,>(p: PromiseLike<{ data: T | null; error?: any }>, fb: T): Promise<T> => { try { const r = await p; return (r && !r.error && r.data) ? (r.data as T) : fb; } catch { return fb; } };

export async function loadSources(db: any, today: string): Promise<GraphSources> {
  const [events, skills, programs, sessions, trainers, scenarios, missions, registrations, enrollments, orgs, sectors, contracts] = await Promise.all([
    safe<any[]>(db.from('portal_learning_events').select('id,at,user_id,email,verb,object_type,object_id,skills,context').order('at', { ascending: false }).limit(LIM.events), []),
    safe<any[]>(db.from('portal_skills').select('id,code,name_ar,name_en,level,sector,domain').eq('active', true).limit(LIM.rows), []),
    safe<any[]>(db.from('programs').select('id,name_ar,name_en,sector').is('archived_at', null).limit(LIM.rows), []).then(async r => r.length ? r : safe<any[]>(db.from('programs').select('id,name_ar,name_en').is('archived_at', null).limit(LIM.rows), [])),
    safe<any[]>(db.from('portal_sessions').select('id,title_ar,trainer_id,sector,skills,program_id,organization_id').limit(LIM.rows), []),
    safe<any[]>(db.from('trainers').select('id,name').limit(LIM.rows), []).then(r => r.map((t: any) => ({ id: t.id, full_name: String(t.name || t.full_name || 'مدرب') }))),
    safe<any[]>(db.from('portal_scenarios').select('id,title_ar,skills').limit(LIM.rows), []),
    safe<any[]>(db.from('portal_missions').select('id,template_id,title_ar,skills,status,program_id').limit(LIM.rows), []),
    safe<any[]>(db.from('portal_session_registrations').select('session_id,organization,user_id').limit(LIM.rows), []),
    safe<any[]>(db.from('portal_enrollments').select('program_id,organization,status,user_id').limit(LIM.rows), []),
    safe<any[]>(db.from('portal_organizations').select('id,name_ar,name_en,sector').eq('active', true).limit(LIM.rows), []),
    safe<any[]>(db.from('portal_sectors').select('code,name_ar,name_en').eq('active', true).limit(200), []),
    safe<any[]>(db.from('portal_impact_contracts').select('id,title_ar,organization_id,program_id,status').limit(LIM.rows), []),
  ]);
  return { events, skills, programs, sessions, trainers, scenarios, missions, registrations, enrollments, orgs, sectors, contracts, today } as GraphSources;
}

export async function refreshGraph(db: any, opts: { dry?: boolean; now?: Date } = {}): Promise<{ ok: boolean; nodes: number; edges: number; dry: boolean; error?: string }> {
  const now = opts.now || new Date(); const dry = !!opts.dry;
  try {
    const src = await loadSources(db, now.toISOString().slice(0, 10)); const g = buildGraph(src); const rows = graphRows(g, now.toISOString());
    if (!dry) {
      await db.from('portal_graph_edges').delete().gte('id', 0); await db.from('portal_graph_nodes').delete().neq('id', '');
      for (let i = 0; i < rows.nodes.length; i += 500) await db.from('portal_graph_nodes').insert(rows.nodes.slice(i, i + 500));
      for (let i = 0; i < rows.edges.length; i += 500) await db.from('portal_graph_edges').insert(rows.edges.slice(i, i + 500));
    }
    return { ok: true, nodes: g.nodes.length, edges: g.edges.length, dry };
  } catch (e: any) { return { ok: false, nodes: 0, edges: 0, dry, error: String(e?.message || e).slice(0, 200) }; }
}

export async function loadGraph(db: any): Promise<Graph> {
  const [nodes, edges] = await Promise.all([safe<any[]>(db.from('portal_graph_nodes').select('id,kind,label_ar,label_en,ref_id,weight,people,meta').order('weight', { ascending: false }).limit(5000), []), safe<any[]>(db.from('portal_graph_edges').select('src,dst,rel,weight,evidence,people,period_from,period_to,meta').order('weight', { ascending: false }).limit(20000), [])]);
  return { nodes: nodes.map(n => ({ ...n, weight: Number(n.weight) || 0, people: Number(n.people) || 0, meta: n.meta || {} })), edges: edges.map(e => ({ ...e, weight: Number(e.weight) || 0, evidence: Number(e.evidence) || 0, people: Number(e.people) || 0, meta: e.meta || {} })) };
}

/** فهرس الكيانات لاستخراج معاملات السؤال — من الرسم البياني نفسه (بلا استعلامات إضافية) */
export function entityIndexFrom(g: Graph): EntityIndex {
  const pick = (kind: string) => g.nodes.filter(n => n.kind === kind);
  return { skills: pick('skill').map(n => ({ id: n.ref_id || n.id.slice(6), name_ar: n.label_ar, name_en: n.label_en, code: String((n.meta as any)?.code || '') })), sectors: pick('sector').map(n => ({ code: n.ref_id || n.id.slice(7), name_ar: n.label_ar, name_en: n.label_en })), orgs: pick('org').map(n => ({ id: n.ref_id || n.id.slice(4), name_ar: n.label_ar, name_en: n.label_en })), programs: pick('program').map(n => ({ id: n.ref_id || n.id.slice(8), name_ar: n.label_ar, name_en: n.label_en })) };
}

export async function ensureWeeklyLesson(db: any, today: string, g?: Graph, opts: { dry?: boolean } = {}): Promise<{ ok: boolean; created: boolean; week: string; title?: string; error?: string }> {
  const week = weekStart(today);
  try {
    const { data: ex } = await db.from('portal_graph_lessons').select('id').eq('week', week).limit(1); if ((ex || []).length) return { ok: true, created: false, week };
    const graph = g || await loadGraph(db); const d = lessonDraft(graph, today); if (!d) return { ok: true, created: false, week };
    if (!opts.dry) await db.from('portal_graph_lessons').insert({ week: d.week, title_ar: d.title_ar, body_ar: d.body_ar, evidence: d.evidence, status: 'draft', source: 'local' });
    return { ok: true, created: true, week, title: d.title_ar };
  } catch (e: any) { return { ok: false, created: false, week, error: String(e?.message || e).slice(0, 200) }; }
}
