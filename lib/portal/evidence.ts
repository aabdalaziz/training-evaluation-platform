// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — قاعدة الأدلة المؤسسية («الذاكرة الحية» · P14-أ) — دوال نقية (بلا شبكة/قاعدة) قابلة للاختبار
 *  الفكرة: كل مهارة وبرنامج وجلسة ومحاكٍ وقالب مهمة وقناة تعلّم وقطاع وجهة ومدرب وعقد أثر = عقدة؛ وكل دليل تعلّم = رابط موزون.
 *  الاستعلام بالأدلة: الذكاء الاصطناعي لا يكتب SQL — يختار قالبًا من «الأسئلة المؤسسية» المعتمدة ويستخرج معاملاته؛ القوالب تُنفَّذ هنا على الرسم البياني.
 *  الخصوصية: لا أسماء أشخاص في العقد؛ أعداد الأشخاص تُعرض للعامة فقط حين تكون ≥ 5 (PUBLIC_MIN_PEOPLE).
 */
import { evidenceFromEvent } from './profile';
import type { LearningEventRow, EvidenceKind } from './profile';
import type { Skill } from './skills';

export const PUBLIC_MIN_PEOPLE = 5;
export type NodeKind = 'skill' | 'program' | 'session' | 'scenario' | 'mission' | 'channel' | 'sector' | 'org' | 'trainer' | 'contract';
export type Rel = 'raised' | 'delivered' | 'invested' | 'needs' | 'targets' | 'belongs';
export type GraphNode = { id: string; kind: NodeKind; label_ar: string; label_en?: string | null; ref_id?: string | null; weight: number; people: number; meta: Record<string, unknown> };
export type GraphEdge = { src: string; dst: string; rel: Rel; weight: number; evidence: number; people: number; period_from: string | null; period_to: string | null; meta: Record<string, unknown> };
export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type GraphSources = {
  events: LearningEventRow[];
  skills: Pick<Skill, 'id' | 'code' | 'name_ar' | 'name_en' | 'level'>[] & { sector?: string | null; domain?: string | null }[];
  programs: { id: string; name_ar: string; name_en?: string | null; sector?: string | null }[];
  sessions: { id: string; title_ar: string; trainer_id?: string | null; sector?: string | null; skills?: string[] | null; program_id?: string | null; organization_id?: string | null }[];
  trainers: { id: string; full_name: string }[];
  scenarios: { id: string; title_ar: string; skills?: string[] | null }[];
  missions: { id: string; template_id?: string | null; title_ar: string; skills?: string[] | null; status?: string | null; program_id?: string | null }[];
  registrations: { session_id: string; organization?: string | null; user_id?: string | null }[];
  enrollments: { program_id: string; organization?: string | null; status?: string | null; user_id?: string | null }[];
  orgs: { id: string; name_ar: string; name_en?: string | null; sector?: string | null }[];
  sectors: { code: string; name_ar: string; name_en?: string | null }[];
  contracts: { id: string; title_ar: string; organization_id?: string | null; program_id?: string | null; status?: string | null }[];
  today: string;
};

export const CHANNEL_LABEL: Record<string, { ar: string; en: string }> = {
  program: { ar: 'إتمام البرامج', en: 'Program completion' }, credential: { ar: 'الشهادات', en: 'Credentials' }, session: { ar: 'الجلسات المباشرة', en: 'Live sessions' },
  simulation: { ar: 'المحاكيات', en: 'Simulations' }, mission: { ar: 'مهمات في قلب العمل', en: 'Workplace missions' }, daily_case: { ar: 'موقف اليوم', en: 'Daily case' },
  media: { ar: 'الأداء المُشاهَد', en: 'Observed performance' }, placement: { ar: 'اختبار مِعيار', en: 'Placement test' },
};
const TRANSFER_KINDS: EvidenceKind[] = ['mission', 'media', 'simulation'];
const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
// الأشخاص خلف إجابة: أكبر مجموعة فريدة لا مجموع الصفوف (الشخص الواحد قد يظهر في عدة قنوات/مهارات) — تقدير محافظ لا يبالغ
const distinctPeople = (rows: { people: number }[]) => rows.reduce((m, r) => Math.max(m, r.people || 0), 0);

// ---------------------------------------------------------------- العدد والمعدود بالعربية (3–10 جمع · 11–99 مفرد منصوب · المئات مفرد مجرور)
export function arCount(n: number, one: string, two: string, few: string, many: string, hundreds: string): string {
  const k = Math.max(0, Math.round(Number(n) || 0)); if (k === 1) return one; if (k === 2) return two; const m = k % 100;
  if (m >= 3 && m <= 10) return `${k} ${few}`; if (m >= 11) return `${k} ${many}`; if (k === 0) return `0 ${few}`; return `${k} ${hundreds}`;
}
export const evN = (n: number) => arCount(n, 'دليل واحد', 'دليلان', 'أدلة', 'دليلًا', 'دليل');
export const peopleN = (n: number) => arCount(n, 'شخص واحد', 'شخصان', 'أشخاص', 'شخصًا', 'شخص');
export const learnerN = (n: number) => arCount(n, 'متعلم واحد', 'متعلمان', 'متعلمين', 'متعلمًا', 'متعلم');

const slug = (s: string) => norm(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60);
const day = (iso: string) => (iso || '').slice(0, 10);

function channelOf(kind: EvidenceKind): string {
  if (kind === 'program_completed') return 'program'; if (kind === 'attended' || kind === 'activity') return 'session'; return kind;
}

/** يبني الرسم البياني من لقطات الجداول الموجودة — نقي وحتمي */
export function buildGraph(src: GraphSources): Graph {
  const nodes = new Map<string, GraphNode & { _people: Set<string> }>(); const edges = new Map<string, GraphEdge & { _people: Set<string> }>();
  const node = (id: string, kind: NodeKind, label_ar: string, label_en?: string | null, ref_id?: string | null, meta: Record<string, unknown> = {}) => {
    let n = nodes.get(id); if (!n) { n = { id, kind, label_ar: norm(label_ar) || id, label_en: label_en ? norm(label_en) : null, ref_id: ref_id || null, weight: 0, people: 0, meta, _people: new Set() }; nodes.set(id, n); } return n;
  };
  const edge = (s: string, d: string, rel: Rel, w: number, at?: string | null, person?: string | null, transfer = false) => {
    const k = `${s}|${d}|${rel}`; let e = edges.get(k);
    if (!e) { e = { src: s, dst: d, rel, weight: 0, evidence: 0, people: 0, period_from: null, period_to: null, meta: { transfer: 0 }, _people: new Set() }; edges.set(k, e); }
    e.weight = Math.round((e.weight + w) * 1000) / 1000; e.evidence += 1; if (transfer) (e.meta as any).transfer = Number((e.meta as any).transfer || 0) + 1;
    const dd = at ? day(at) : null; if (dd) { if (!e.period_from || dd < e.period_from) e.period_from = dd; if (!e.period_to || dd > e.period_to) e.period_to = dd; }
    if (person) { e._people.add(person); nodes.get(s)?._people.add(person); nodes.get(d)?._people.add(person); }
    const ns = nodes.get(s), nd = nodes.get(d); if (ns) ns.weight = Math.round((ns.weight + w) * 1000) / 1000; if (nd) nd.weight = Math.round((nd.weight + w) * 1000) / 1000;
  };
  // عقد أساسية
  const skillMeta = new Map<string, { level: number; code: string }>();
  for (const s of src.skills as any[]) { node(`skill:${s.id}`, 'skill', s.name_ar, s.name_en, s.id, { code: s.code, level: s.level, sector: s.sector || null, domain: s.domain || null }); skillMeta.set(s.id, { level: Number(s.level) || 3, code: String(s.code || '') }); }
  for (const c of src.sectors) node(`sector:${c.code}`, 'sector', c.name_ar, c.name_en, c.code);
  for (const p of src.programs) node(`program:${p.id}`, 'program', p.name_ar, p.name_en, p.id, { sector: p.sector || null });
  for (const o of src.orgs) node(`org:${o.id}`, 'org', o.name_ar, o.name_en, o.id, { sector: o.sector || null });
  for (const t of src.trainers) node(`trainer:${t.id}`, 'trainer', t.full_name, null, t.id);
  for (const s of src.sessions) node(`session:${s.id}`, 'session', s.title_ar, null, s.id, { sector: s.sector || null, program_id: s.program_id || null });
  for (const sc of src.scenarios) node(`scenario:${sc.id}`, 'scenario', sc.title_ar, null, sc.id);
  const missionTpl = new Map<string, { tpl: string; title: string }>();
  for (const m of src.missions) { const tpl = m.template_id || slug(m.title_ar) || m.id; missionTpl.set(m.id, { tpl, title: m.title_ar }); node(`mission:${tpl}`, 'mission', m.title_ar, null, tpl); }
  for (const k of Object.keys(CHANNEL_LABEL)) node(`channel:${k}`, 'channel', CHANNEL_LABEL[k].ar, CHANNEL_LABEL[k].en, k);
  // القطاع يحتاج المهارة
  for (const s of src.skills as any[]) if (s.sector && nodes.has(`sector:${s.sector}`)) edge(`sector:${s.sector}`, `skill:${s.id}`, 'needs', 1);
  // المدرب قدّم الجلسة · الجلسة تنتمي للبرنامج · الجلسة تحمل مهارات
  for (const s of src.sessions) { if (s.trainer_id && nodes.has(`trainer:${s.trainer_id}`)) edge(`trainer:${s.trainer_id}`, `session:${s.id}`, 'delivered', 1); if (s.program_id && nodes.has(`program:${s.program_id}`)) edge(`session:${s.id}`, `program:${s.program_id}`, 'belongs', 1); }
  // الأحداث التعليمية → أدلة موزونة
  const sessionBySkillEvent = new Map<string, string>(); // activity/session events → session id
  for (const s of src.sessions) sessionBySkillEvent.set(s.id, s.id);
  for (const ev of src.events) {
    const ctx = ev.context || {}; const person = ev.user_id || ev.email || null;
    for (const { skill_id, e } of evidenceFromEvent(ev, skillMeta as any)) {
      if (e.kind === 'viewed') continue; if (!nodes.has(`skill:${skill_id}`)) continue;
      const transfer = TRANSFER_KINDS.includes(e.kind) && !!(ctx.confirmed || ctx.approved);
      const ch = channelOf(e.kind); edge(`channel:${ch}`, `skill:${skill_id}`, 'raised', e.weight, ev.at, person, transfer);
      let srcId: string | null = null;
      if (e.kind === 'program_completed' || e.kind === 'credential') { const pid = ctx.program_id || (ev.object_type === 'program' ? ev.object_id : null); if (pid && nodes.has(`program:${pid}`)) srcId = `program:${pid}`; }
      else if (e.kind === 'attended' || e.kind === 'activity') { const sid = ctx.session_id || (ev.object_type === 'session' ? ev.object_id : null); if (sid && nodes.has(`session:${sid}`)) srcId = `session:${sid}`; }
      else if (e.kind === 'simulation') { const sc = ctx.scenario_id || null; if (sc && nodes.has(`scenario:${sc}`)) srcId = `scenario:${sc}`; }
      else if (e.kind === 'mission') { const m = missionTpl.get(ev.object_id); if (m) srcId = `mission:${m.tpl}`; }
      if (srcId) {
        edge(srcId, `skill:${skill_id}`, 'raised', e.weight, ev.at, person, transfer);
        if (srcId.startsWith('session:')) { const s = src.sessions.find(x => `session:${x.id}` === srcId); if (s?.trainer_id && nodes.has(`trainer:${s.trainer_id}`)) edge(`trainer:${s.trainer_id}`, `skill:${skill_id}`, 'raised', e.weight, ev.at, person, transfer); if (s?.program_id && nodes.has(`program:${s.program_id}`)) edge(`program:${s.program_id}`, `skill:${skill_id}`, 'raised', e.weight * 0.5, ev.at, person, transfer); }
      }
    }
  }
  // الجهات استثمرت في البرامج/الجلسات (بالاسم) · عقود الأثر تستهدف البرامج
  const orgByName = new Map<string, string>(); for (const o of src.orgs) { orgByName.set(norm(o.name_ar).toLowerCase(), o.id); if (o.name_en) orgByName.set(norm(o.name_en).toLowerCase(), o.id); }
  const orgOf = (name?: string | null) => { const k = norm(name).toLowerCase(); return k ? orgByName.get(k) || null : null; };
  for (const en of src.enrollments) { const oid = orgOf(en.organization); if (oid && nodes.has(`program:${en.program_id}`)) edge(`org:${oid}`, `program:${en.program_id}`, 'invested', en.status === 'accepted' || en.status === 'approved' ? 1 : 0.5, null, en.user_id || en.organization || null); }
  for (const r of src.registrations) { const oid = orgOf(r.organization); if (oid && nodes.has(`session:${r.session_id}`)) edge(`org:${oid}`, `session:${r.session_id}`, 'invested', 0.5, null, r.user_id || null); }
  for (const c of src.contracts) { node(`contract:${c.id}`, 'contract', c.title_ar, null, c.id, { status: c.status || null }); if (c.organization_id && nodes.has(`org:${c.organization_id}`)) edge(`org:${c.organization_id}`, `contract:${c.id}`, 'targets', 1); if (c.program_id && nodes.has(`program:${c.program_id}`)) edge(`contract:${c.id}`, `program:${c.program_id}`, 'targets', 1); }
  const outNodes: GraphNode[] = []; for (const n of nodes.values()) { const { _people, ...rest } = n; outNodes.push({ ...rest, people: _people.size }); }
  const outEdges: GraphEdge[] = []; for (const e of edges.values()) { const { _people, ...rest } = e; outEdges.push({ ...rest, people: _people.size }); }
  // نحذف العقد المعزولة عديمة الوزن (ما عدا القنوات والقطاعات والمهارات لتبقى الخريطة مقروءة)
  const linked = new Set<string>(); for (const e of outEdges) { linked.add(e.src); linked.add(e.dst); }
  return { nodes: outNodes.filter(n => linked.has(n.id) || n.kind === 'channel' || n.kind === 'skill' || n.kind === 'sector').sort((a, b) => b.weight - a.weight), edges: outEdges.sort((a, b) => b.weight - a.weight) };
}

// ====================================================================== أدوات القراءة
export function nodeMap(g: Graph): Map<string, GraphNode> { return new Map(g.nodes.map(n => [n.id, n])); }
export function edgesFrom(g: Graph, src: string, rel?: Rel): GraphEdge[] { return g.edges.filter(e => e.src === src && (!rel || e.rel === rel)); }
export function edgesTo(g: Graph, dst: string, rel?: Rel): GraphEdge[] { return g.edges.filter(e => e.dst === dst && (!rel || e.rel === rel)); }
const r1 = (n: number) => Math.round(n * 10) / 10; const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export function transferOf(e: GraphEdge): number { return Number((e.meta as any)?.transfer || 0); }

// ====================================================================== الأسئلة المؤسسية (القوالب)
export type Params = { skill?: string | null; sector?: string | null; org?: string | null; program?: string | null; year?: number | null; trainer?: string | null };
export type Chain = { label: string; value: string };
export type EvidenceAnswer = { template: string; title_ar: string; answer_ar: string; chain: Chain[]; rows: { label: string; value: string; sub?: string; id?: string }[]; people: number; confidence: 'strong' | 'medium' | 'weak'; suggestions: string[]; params: Params };
export type Template = { id: string; title_ar: string; title_en: string; example_ar: string; keywords: string[]; needs?: (keyof Params)[]; run: (g: Graph, p: Params) => EvidenceAnswer };

const conf = (people: number, evidence: number): EvidenceAnswer['confidence'] => (people >= 20 && evidence >= 40 ? 'strong' : people >= 5 && evidence >= 8 ? 'medium' : 'weak');
const label = (g: Graph, id: string) => nodeMap(g).get(id)?.label_ar || id.split(':').slice(1).join(':');
const inYear = (e: GraphEdge, y?: number | null) => !y || !e.period_to || (e.period_from || e.period_to) <= `${y}-12-31` && e.period_to >= `${y}-01-01`;
const skillEdges = (g: Graph, p: Params, pred: (e: GraphEdge) => boolean) => g.edges.filter(e => e.rel === 'raised' && e.dst.startsWith('skill:') && (!p.skill || e.dst === `skill:${p.skill}`) && inYear(e, p.year) && pred(e));
const sumBy = (es: GraphEdge[], key: (e: GraphEdge) => string) => { const m = new Map<string, { w: number; ev: number; people: number; tr: number }>(); for (const e of es) { const k = key(e); const c = m.get(k) || { w: 0, ev: 0, people: 0, tr: 0 }; c.w += e.weight; c.ev += e.evidence; c.people = Math.max(c.people, e.people); c.tr += transferOf(e); m.set(k, c); } return [...m.entries()].sort((a, b) => b[1].w - a[1].w); };
const noData = (template: string, title_ar: string, p: Params, why: string): EvidenceAnswer => ({ template, title_ar, answer_ar: why, chain: [], rows: [], people: 0, confidence: 'weak', suggestions: ['أين أحدثنا فرقًا هذا العام؟', 'أي قناة تعلّم تنقل الأثر أكثر؟'], params: p });

export const TEMPLATES: Template[] = [
  { id: 'top_channel', title_ar: 'أي قناة تعلّم تنقل الأثر أكثر؟', title_en: 'Which learning channel transfers most?', example_ar: 'أي نوع نشاط أنتج أعلى نقل أثر؟', keywords: ['قناة', 'نوع نشاط', 'نقل الأثر', 'أنفع', 'أكثر أثرًا', 'أعلى أثر', 'channel', 'transfer'],
    run: (g, p) => { const rows = sumBy(skillEdges(g, p, e => e.src.startsWith('channel:')), e => e.src).filter(([, c]) => c.ev > 0).map(([k, c]) => ({ id: k, label: label(g, k), w: c.w, ev: c.ev, people: c.people, tr: c.tr, perPerson: c.people ? c.w / c.people : 0 })).sort((a, b) => b.tr / Math.max(1, b.ev) - a.tr / Math.max(1, a.ev) || b.perPerson - a.perPerson);
      if (!rows.length) return noData('top_channel', 'أي قناة تعلّم تنقل الأثر أكثر؟', p, 'لا أدلة بعد لهذه المعاملات — الذاكرة تنمو مع كل جلسة ومهمة ومحاكاة.');
      const top = rows[0]; const people = distinctPeople(rows); const ev = rows.reduce((s, r) => s + r.ev, 0);
      return { template: 'top_channel', title_ar: 'أي قناة تعلّم تنقل الأثر أكثر؟', params: p, people, confidence: conf(people, ev),
        answer_ar: `«${top.label}» هي القناة التي ينتقل منها التعلّم إلى العمل أكثر من غيرها: ${pct(top.tr, top.ev)}% من أدلتها مؤكَّدة بشريًا (مهمة مؤكَّدة/أداء معتمد)، بوزن ${r1(top.perPerson)} لكل متعلم${rows[1] ? ` — مقابل ${pct(rows[1].tr, rows[1].ev)}% في «${rows[1].label}»` : ''}.`,
        chain: [{ label: 'الأدلة', value: String(ev) }, { label: 'الأشخاص', value: String(people) }, { label: 'المعيار', value: 'نسبة الأدلة المؤكَّدة بشريًا ثم الوزن لكل متعلم' }],
        rows: rows.slice(0, 8).map(r => ({ id: r.id, label: r.label, value: `${pct(r.tr, r.ev)}% نقل`, sub: `${evN(r.ev)} · ${peopleN(r.people)} · ${r1(r.w)} وزنًا` })),
        suggestions: ['هل المحاكيات تنفع؟', 'كم نسبة ما انتقل إلى العمل؟', 'أين أحدثنا فرقًا هذا العام؟'] }; } },
  { id: 'top_programs_for_skill', title_ar: 'أي برنامج أثبت رفع هذه المهارة؟', title_en: 'Which program proved to raise this skill?', example_ar: 'أي برنامج يرفع مهارة التقويم؟', keywords: ['أي برنامج', 'برنامج يرفع', 'برامج', 'يرفع مهارة', 'program'], needs: ['skill'],
    run: (g, p) => { const title = `أي برنامج أثبت رفع «${label(g, `skill:${p.skill}`)}»؟`; const rows = sumBy(skillEdges(g, p, e => e.src.startsWith('program:')), e => e.src); if (!rows.length) return noData('top_programs_for_skill', title, p, 'لا برنامج يحمل أدلة على هذه المهارة بعد — جرّب «أي قناة تعلّم تنقل الأثر أكثر؟».');
      const [k, c] = rows[0]; const people = rows.reduce((s, [, x]) => Math.max(s, x.people), 0); const ev = rows.reduce((s, [, x]) => s + x.ev, 0);
      return { template: 'top_programs_for_skill', title_ar: title, params: p, people, confidence: conf(people, ev), answer_ar: `«${label(g, k)}» يحمل أقوى أدلة على رفع هذه المهارة: ${evN(c.ev)} من ${learnerN(c.people)} بوزن ${r1(c.w)}${c.tr ? `، منها ${c.tr} مؤكَّدة في العمل` : ''}.`,
        chain: [{ label: 'البرنامج', value: label(g, k) }, { label: 'المهارة', value: label(g, `skill:${p.skill}`) }, { label: 'الأدلة', value: `${c.ev} · ${peopleN(c.people)}` }], rows: rows.slice(0, 6).map(([id, x]) => ({ id, label: label(g, id), value: `${r1(x.w)} وزنًا`, sub: `${evN(x.ev)} · ${peopleN(x.people)}${x.tr ? ` · ${x.tr} نقل` : ''}` })), suggestions: ['أي مدرب يرفع هذه المهارة أكثر؟', 'أي الجهات تحتاج هذه المهارة؟'] }; } },
  { id: 'top_trainer_for_skill', title_ar: 'أي مدرب يرفع هذه المهارة أكثر؟', title_en: 'Which trainer raises this skill most?', example_ar: 'أي مدرب يرفع مهارة التقويم أسرع؟', keywords: ['مدرب', 'مدربة', 'ميسر', 'trainer'], needs: ['skill'],
    run: (g, p) => { const title = `أي مدرب يرفع «${label(g, `skill:${p.skill}`)}» أكثر؟`; const rows = sumBy(skillEdges(g, p, e => e.src.startsWith('trainer:')), e => e.src); if (!rows.length) return noData('top_trainer_for_skill', title, p, 'لا جلسات مباشرة بمدرب معروف تحمل أدلة على هذه المهارة بعد.');
      const [k, c] = rows[0]; const people = rows.reduce((s, [, x]) => Math.max(s, x.people), 0); const ev = rows.reduce((s, [, x]) => s + x.ev, 0);
      return { template: 'top_trainer_for_skill', title_ar: title, params: p, people, confidence: conf(people, ev), answer_ar: `جلسات «${label(g, k)}» أنتجت أعلى أدلة على هذه المهارة (${evN(c.ev)} من ${learnerN(c.people)}). هذا دليل على الجلسات لا حكم على الأشخاص — يُقرأ مع حجم الجلسات وطبيعة الحضور.`, chain: [{ label: 'المدرب', value: label(g, k) }, { label: 'الأدلة', value: String(c.ev) }, { label: 'تنبيه', value: 'مؤشر للتطوير، لا للتقييم الفردي' }], rows: rows.slice(0, 6).map(([id, x]) => ({ id, label: label(g, id), value: `${r1(x.w)} وزنًا`, sub: `${evN(x.ev)} · ${peopleN(x.people)}` })), suggestions: ['أي برنامج أثبت رفع هذه المهارة؟'] }; } },
  { id: 'org_year', title_ar: 'ماذا فعلت الجهة وأحدث فرقًا؟', title_en: 'What did the organization do that made a difference?', example_ar: 'ما الذي فعلته جامعة الأمير مقرن في 2026؟', keywords: ['الجهة', 'جامعة', 'وزارة', 'شركة', 'مركز', 'فعلته', 'organization'], needs: ['org'],
    run: (g, p) => { const oid = `org:${p.org}`; const title = `ماذا فعلت «${label(g, oid)}»${p.year ? ` في ${p.year}` : ''}؟`; const inv = edgesFrom(g, oid, 'invested'); const con = edgesFrom(g, oid, 'targets'); if (!inv.length && !con.length) return noData('org_year', title, p, 'لا سجل استثمار لهذه الجهة في البرامج أو الجلسات بعد (يُربط بالاسم كما يكتبه المسجّلون).');
      const progs = inv.filter(e => e.src === oid && e.dst.startsWith('program:')); const sess = inv.filter(e => e.dst.startsWith('session:')); const people = inv.reduce((s, e) => Math.max(s, e.people), 0);
      const skills = sumBy(g.edges.filter(e => e.rel === 'raised' && progs.some(pe => pe.dst === e.src) && inYear(e, p.year)), e => e.dst).slice(0, 3);
      return { template: 'org_year', title_ar: title, params: p, people, confidence: conf(people, inv.length + con.length), answer_ar: `«${label(g, oid)}» استثمرت في ${progs.length} برنامجًا و${sess.length} جلسة بمشاركة ${peopleN(people)}${con.length ? `، ولها ${con.length} عقد أثر` : ''}${skills.length ? `. أكثر ما تحرّك: ${skills.map(([k]) => `«${label(g, k)}»`).join('، ')}` : ''}.`, chain: [{ label: 'برامج', value: String(progs.length) }, { label: 'جلسات', value: String(sess.length) }, { label: 'عقود أثر', value: String(con.length) }], rows: [...progs.slice(0, 5).map(e => ({ id: e.dst, label: label(g, e.dst), value: `${e.people} مشاركًا`, sub: 'برنامج' })), ...con.slice(0, 3).map(e => ({ id: e.dst, label: label(g, e.dst), value: String((nodeMap(g).get(e.dst)?.meta as any)?.status || ''), sub: 'عقد أثر' }))], suggestions: ['ما حال عقود الأثر؟', 'ماذا نصمم بعد ذلك؟'] }; } },
  { id: 'skill_gaps', title_ar: 'أين الفجوات؟ (مطلوب ولا دليل عليه)', title_en: 'Where are the gaps?', example_ar: 'أين فشلنا؟', keywords: ['فجوات', 'فجوة', 'فشلنا', 'أضعف', 'نقص', 'لم ننجح', 'gap'],
    run: (g, p) => { const need = g.edges.filter(e => e.rel === 'needs' && (!p.sector || e.src === `sector:${p.sector}`)); const raised = sumBy(skillEdges(g, p, () => true), e => e.dst); const rm = new Map(raised); const rows = need.map(e => ({ id: e.dst, label: label(g, e.dst), w: rm.get(e.dst)?.w || 0, ev: rm.get(e.dst)?.ev || 0, people: rm.get(e.dst)?.people || 0 })).sort((a, b) => a.w - b.w);
      if (!rows.length) return noData('skill_gaps', 'أين الفجوات؟', p, 'لا مهارات مربوطة بقطاعات بعد.'); const zero = rows.filter(r => r.ev === 0); const people = distinctPeople(rows);
      return { template: 'skill_gaps', title_ar: 'أين الفجوات؟', params: p, people, confidence: conf(people, rows.reduce((s, r) => s + r.ev, 0)), answer_ar: `${zero.length} من ${rows.length} مهارة مطلوبة${p.sector ? ` في قطاع «${label(g, `sector:${p.sector}`)}»` : ''} بلا دليل واحد حتى الآن${zero.length ? `: ${zero.slice(0, 4).map(r => `«${r.label}»`).join('، ')}${zero.length > 4 ? '…' : ''}` : ''}. هذه هي الفجوة التي يجدر أن تبدأ بها هندسة البرامج.`, chain: [{ label: 'مهارات مطلوبة', value: String(rows.length) }, { label: 'بلا دليل', value: String(zero.length) }], rows: rows.slice(0, 8).map(r => ({ id: r.id, label: r.label, value: r.ev ? `${evN(r.ev)}` : 'لا دليل', sub: `${peopleN(r.people)}` })), suggestions: ['ماذا نصمم بعد ذلك؟', 'ما أكثر المهارات طلبًا في قطاع التعليم؟'] }; } },
  { id: 'sector_focus', title_ar: 'ما الذي يتحرك في هذا القطاع؟', title_en: 'What moves in this sector?', example_ar: 'ما أكثر المهارات التي تحرّكت في قطاع التعليم؟', keywords: ['قطاع', 'sector'], needs: ['sector'],
    run: (g, p) => { const sid = `sector:${p.sector}`; const title = `ما الذي يتحرك في قطاع «${label(g, sid)}»؟`; const needSkills = new Set(edgesFrom(g, sid, 'needs').map(e => e.dst)); const rows = sumBy(skillEdges(g, { ...p, sector: null }, e => needSkills.has(e.dst)), e => e.dst); if (!rows.length) return noData('sector_focus', title, p, 'لا أدلة بعد على مهارات هذا القطاع.'); const people = rows.reduce((s, [, x]) => Math.max(s, x.people), 0); const ev = rows.reduce((s, [, x]) => s + x.ev, 0);
      return { template: 'sector_focus', title_ar: title, params: p, people, confidence: conf(people, ev), answer_ar: `في قطاع «${label(g, sid)}» تحرّكت ${rows.length} مهارة بـ${evN(ev)} من ${peopleN(people)}؛ أكثرها «${label(g, rows[0][0])}».`, chain: [{ label: 'المهارات', value: String(rows.length) }, { label: 'الأدلة', value: String(ev) }], rows: rows.slice(0, 8).map(([id, x]) => ({ id, label: label(g, id), value: `${r1(x.w)} وزنًا`, sub: `${evN(x.ev)} · ${peopleN(x.people)}` })), suggestions: ['أين الفجوات في هذا القطاع؟', 'أي برنامج أثبت رفع هذه المهارة؟'] }; } },
  { id: 'program_impact', title_ar: 'ما أثر هذا البرنامج؟', title_en: 'What is this program’s impact?', example_ar: 'ما أثر دبلوم تعليم العربية؟', keywords: ['أثر برنامج', 'أثر دبلوم', 'أثر دورة', 'ما أثر', 'impact of'], needs: ['program'],
    run: (g, p) => { const pid = `program:${p.program}`; const title = `ما أثر «${label(g, pid)}»؟`; const rows = sumBy(edgesFrom(g, pid, 'raised'), e => e.dst); const orgs = edgesTo(g, pid, 'invested'); if (!rows.length) return noData('program_impact', title, p, 'لا أدلة مهارية مربوطة بهذا البرنامج بعد (تُربط عند الإتمام والشهادات والجلسات التابعة).'); const people = Math.max(...rows.map(([, x]) => x.people)); const ev = rows.reduce((s, [, x]) => s + x.ev, 0); const tr = rows.reduce((s, [, x]) => s + x.tr, 0);
      return { template: 'program_impact', title_ar: title, params: p, people, confidence: conf(people, ev), answer_ar: `«${label(g, pid)}» ترك ${evN(ev)} على ${rows.length} مهارة لدى ${learnerN(people)}${tr ? `، منها ${tr} انتقلت إلى العمل` : ''}${orgs.length ? `، واستثمرت فيه ${orgs.length} جهة` : ''}. أقوى أثره على «${label(g, rows[0][0])}».`, chain: [{ label: 'المهارات', value: String(rows.length) }, { label: 'الأدلة', value: String(ev) }, { label: 'نقل إلى العمل', value: String(tr) }], rows: rows.slice(0, 8).map(([id, x]) => ({ id, label: label(g, id), value: `${r1(x.w)} وزنًا`, sub: `${evN(x.ev)}` })), suggestions: ['أي قناة تعلّم تنقل الأثر أكثر؟'] }; } },
  { id: 'year_summary', title_ar: 'أين أحدثنا فرقًا؟', title_en: 'Where did we make a difference?', example_ar: 'أين أحدثنا فرقًا هذا العام؟', keywords: ['أحدثنا فرقًا', 'أحدثنا فرقا', 'هذا العام', 'السنة', 'ملخص', 'أين أثرنا', 'summary'],
    run: (g, p) => { const es = skillEdges(g, p, e => e.src.startsWith('channel:')); const skills = sumBy(es, e => e.dst); const chans = sumBy(es, e => e.src); const people = chans.reduce((s, [, x]) => Math.max(s, x.people), 0); const ev = es.reduce((s, e) => s + e.evidence, 0); const tr = es.reduce((s, e) => s + transferOf(e), 0); if (!ev) return noData('year_summary', 'أين أحدثنا فرقًا؟', p, 'لا أدلة في هذه الفترة.');
      return { template: 'year_summary', title_ar: `أين أحدثنا فرقًا${p.year ? ` في ${p.year}` : ''}؟`, params: p, people, confidence: conf(people, ev), answer_ar: `${evN(ev)} على ${skills.length} مهارة لدى ${peopleN(people)}؛ ${tr} منها انتقلت إلى العمل فعلًا (${pct(tr, ev)}%). أكثر ما تحرّك: ${skills.slice(0, 3).map(([k]) => `«${label(g, k)}»`).join('، ')} — وأنفع قناة «${label(g, chans[0][0])}».`, chain: [{ label: 'الأدلة', value: String(ev) }, { label: 'الأشخاص', value: String(people) }, { label: 'نقل إلى العمل', value: `${pct(tr, ev)}%` }], rows: skills.slice(0, 8).map(([id, x]) => ({ id, label: label(g, id), value: `${r1(x.w)} وزنًا`, sub: `${evN(x.ev)} · ${peopleN(x.people)}` })), suggestions: ['أي قناة تعلّم تنقل الأثر أكثر؟', 'أين الفجوات؟', 'ما حال عقود الأثر؟'] }; } },
  { id: 'transfer_rate', title_ar: 'كم نسبة ما انتقل إلى العمل؟', title_en: 'How much transferred to work?', example_ar: 'كم نسبة التعلّم الذي انتقل إلى العمل؟', keywords: ['انتقل', 'إلى العمل', 'نسبة النقل', 'تطبيق', 'transfer rate'],
    run: (g, p) => { const es = skillEdges(g, p, e => ['channel:mission', 'channel:media', 'channel:simulation'].includes(e.src)); const ev = es.reduce((s, e) => s + e.evidence, 0); const tr = es.reduce((s, e) => s + transferOf(e), 0); const people = es.reduce((s, e) => Math.max(s, e.people), 0); if (!ev) return noData('transfer_rate', 'كم نسبة ما انتقل إلى العمل؟', p, 'لا مهمات أو أداء مُشاهَد أو محاكيات بعد — هذه هي قنوات النقل الثلاث.'); const by = sumBy(es, e => e.src);
      return { template: 'transfer_rate', title_ar: 'كم نسبة ما انتقل إلى العمل؟', params: p, people, confidence: conf(people, ev), answer_ar: `${pct(tr, ev)}% من أدلة قنوات النقل الثلاث (مهمات العمل، الأداء المُشاهَد، المحاكيات) أُكِّدت بشريًا في العمل: ${tr} من ${ev} لدى ${peopleN(people)}.`, chain: [{ label: 'المؤكَّد', value: String(tr) }, { label: 'الكل', value: String(ev) }, { label: 'المعيار', value: 'تأكيد المشرف/اعتماد المراجع' }], rows: by.map(([id, x]) => ({ id, label: label(g, id), value: `${pct(x.tr, x.ev)}%`, sub: `${x.tr}/${x.ev}` })), suggestions: ['أي قناة تعلّم تنقل الأثر أكثر؟'] }; } },
  { id: 'fastest_growth', title_ar: 'أي مهارة تنمو أسرع الآن؟', title_en: 'Which skill grows fastest now?', example_ar: 'أي مهارة نمت أسرع في آخر 90 يومًا؟', keywords: ['أسرع', 'تنمو', 'نمت', 'آخر 90', 'الربع', 'momentum'],
    run: (g, p) => { const to = g.edges.reduce((m, e) => (e.period_to && e.period_to > m ? e.period_to : m), ''); if (!to) return noData('fastest_growth', 'أي مهارة تنمو أسرع الآن؟', p, 'لا أدلة مؤرخة بعد.'); const cut = new Date(new Date(to).getTime() - 90 * 86400000).toISOString().slice(0, 10); const recent = sumBy(skillEdges(g, p, e => e.src.startsWith('channel:') && !!e.period_to && e.period_to >= cut), e => e.dst); if (!recent.length) return noData('fastest_growth', 'أي مهارة تنمو أسرع الآن؟', p, 'لا أدلة في آخر 90 يومًا.'); const people = recent.reduce((s, [, x]) => Math.max(s, x.people), 0); const ev = recent.reduce((s, [, x]) => s + x.ev, 0);
      return { template: 'fastest_growth', title_ar: 'أي مهارة تنمو أسرع الآن؟', params: p, people, confidence: conf(people, ev), answer_ar: `في آخر 90 يومًا (حتى ${to}) تقدّمت «${label(g, recent[0][0])}» أكثر من غيرها بـ${evN(recent[0][1].ev)}${recent[1] ? `، تليها «${label(g, recent[1][0])}»` : ''}.`, chain: [{ label: 'النافذة', value: `${cut} → ${to}` }, { label: 'الأدلة', value: String(ev) }], rows: recent.slice(0, 8).map(([id, x]) => ({ id, label: label(g, id), value: `${evN(x.ev)}`, sub: `${peopleN(x.people)}` })), suggestions: ['أين أحدثنا فرقًا هذا العام؟'] }; } },
  { id: 'contracts_status', title_ar: 'ما حال عقود الأثر؟', title_en: 'How are impact contracts doing?', example_ar: 'ما حال عقود الأثر؟', keywords: ['عقود', 'عقد أثر', 'العقود', 'contracts'],
    run: (g, p) => { const cs = g.nodes.filter(n => n.kind === 'contract'); if (!cs.length) return noData('contracts_status', 'ما حال عقود الأثر؟', p, 'لا عقود أثر مسجّلة بعد.'); const by = new Map<string, number>(); for (const c of cs) by.set(String((c.meta as any).status || '—'), (by.get(String((c.meta as any).status || '—')) || 0) + 1);
      return { template: 'contracts_status', title_ar: 'ما حال عقود الأثر؟', params: p, people: 0, confidence: cs.length >= 3 ? 'medium' : 'weak', answer_ar: `${cs.length} عقد أثر: ${[...by.entries()].map(([k, v]) => `${v} ${k}`).join(' · ')}.`, chain: [{ label: 'العقود', value: String(cs.length) }], rows: cs.slice(0, 8).map(c => ({ id: c.id, label: c.label_ar, value: String((c.meta as any).status || ''), sub: edgesFrom(g, c.id, 'targets').map(e => label(g, e.dst)).join(' · ') })), suggestions: ['ماذا فعلت الجهة وأحدث فرقًا؟'] }; } },
  { id: 'who_needs', title_ar: 'أي الجهات تحتاج هذه المهارة؟', title_en: 'Which organizations need this skill?', example_ar: 'أي الجهات تحتاج مهارة التقويم؟', keywords: ['الجهات تحتاج', 'من يحتاج', 'جهات', 'تحتاج'], needs: ['skill'],
    run: (g, p) => { const sk = nodeMap(g).get(`skill:${p.skill}`); const sector = String((sk?.meta as any)?.sector || ''); const title = `أي الجهات تحتاج «${sk?.label_ar || ''}»؟`; const orgs = g.nodes.filter(n => n.kind === 'org' && (!sector || String((n.meta as any).sector || '') === sector)); const proved = new Set(skillEdges(g, p, e => e.src.startsWith('program:')).map(e => e.src)); const rows = orgs.map(o => ({ id: o.id, label: o.label_ar, inv: edgesFrom(g, o.id, 'invested').filter(e => proved.has(e.dst)).length, people: o.people })).sort((a, b) => a.inv - b.inv || b.people - a.people); if (!rows.length) return noData('who_needs', title, p, 'لا جهات في قطاع هذه المهارة بعد.');
      return { template: 'who_needs', title_ar: title, params: p, people: 0, confidence: rows.length >= 5 ? 'medium' : 'weak', answer_ar: `${rows.filter(r => !r.inv).length} من ${rows.length} جهة في قطاع هذه المهارة لم تستثمر بعد في برنامج أثبت رفعها — فرصة تواصل مبنية على دليل.`, chain: [{ label: 'القطاع', value: sector || 'كل القطاعات' }, { label: 'جهات', value: String(rows.length) }], rows: rows.slice(0, 8).map(r => ({ id: r.id, label: r.label, value: r.inv ? `${r.inv} برنامجًا مُثبتًا` : 'لم تستثمر بعد', sub: `${r.people} مشاركًا` })), suggestions: ['أي برنامج أثبت رفع هذه المهارة؟'] }; } },
  { id: 'simulation_effect', title_ar: 'هل المحاكيات تنفع؟', title_en: 'Do simulations work?', example_ar: 'هل المحاكيات تنفع؟', keywords: ['محاكيات', 'محاكاة', 'المحاكي', 'simulation'],
    run: (g, p) => { const es = skillEdges(g, p, e => e.src.startsWith('scenario:')); const by = sumBy(es, e => e.src); const ev = es.reduce((s, e) => s + e.evidence, 0); const tr = es.reduce((s, e) => s + transferOf(e), 0); const people = es.reduce((s, e) => Math.max(s, e.people), 0); if (!ev) return noData('simulation_effect', 'هل المحاكيات تنفع؟', p, 'لا محاكيات مكتملة بعد.');
      return { template: 'simulation_effect', title_ar: 'هل المحاكيات تنفع؟', params: p, people, confidence: conf(people, ev), answer_ar: `${by.length} محاكٍ أنتج ${evN(ev)} لدى ${peopleN(people)}، اعتمد المدربون ${tr} منها (${pct(tr, ev)}%). الأقوى: «${label(g, by[0][0])}».`, chain: [{ label: 'المحاكيات', value: String(by.length) }, { label: 'المعتمد', value: `${pct(tr, ev)}%` }], rows: by.slice(0, 8).map(([id, x]) => ({ id, label: label(g, id), value: `${evN(x.ev)}`, sub: `${x.tr} معتمدًا · ${peopleN(x.people)}` })), suggestions: ['أي قناة تعلّم تنقل الأثر أكثر؟'] }; } },
  { id: 'media_effect', title_ar: 'هل الأداء المُشاهَد يضيف؟', title_en: 'Does observed performance add?', example_ar: 'هل تسجيلات الفيديو تضيف دليلًا حقيقيًا؟', keywords: ['فيديو', 'الأداء المشاهد', 'المُشاهَد', 'تسجيلات', 'video'],
    run: (g, p) => { const es = skillEdges(g, p, e => e.src === 'channel:media'); const ev = es.reduce((s, e) => s + e.evidence, 0); const tr = es.reduce((s, e) => s + transferOf(e), 0); const people = es.reduce((s, e) => Math.max(s, e.people), 0); if (!ev) return noData('media_effect', 'هل الأداء المُشاهَد يضيف؟', p, 'لا تسجيلات أداء بعد.'); const sk = sumBy(es, e => e.dst);
      return { template: 'media_effect', title_ar: 'هل الأداء المُشاهَد يضيف؟', params: p, people, confidence: conf(people, ev), answer_ar: `${ev} تسجيل أداء من ${learnerN(people)}، اعتمد المراجعون ${tr} (${pct(tr, ev)}%). أكثر المهارات التي ظهرت فيه: «${label(g, sk[0][0])}».`, chain: [{ label: 'التسجيلات', value: String(ev) }, { label: 'المعتمد', value: `${pct(tr, ev)}%` }], rows: sk.slice(0, 8).map(([id, x]) => ({ id, label: label(g, id), value: `${x.ev} تسجيلًا`, sub: `${x.tr} معتمدًا` })), suggestions: ['كم نسبة ما انتقل إلى العمل؟'] }; } },
  { id: 'recommend_next', title_ar: 'ماذا نصمم بعد ذلك؟', title_en: 'What should we design next?', example_ar: 'ماذا نصمم بعد ذلك؟', keywords: ['نصمم', 'التالي', 'بعد ذلك', 'نبدأ', 'أولوية', 'next'],
    run: (g, p) => { const need = sumBy(g.edges.filter(e => e.rel === 'needs' && (!p.sector || e.src === `sector:${p.sector}`)), e => e.dst); const raised = new Map(sumBy(skillEdges(g, p, () => true), e => e.dst)); const rows = need.map(([id]) => ({ id, label: label(g, id), ev: raised.get(id)?.ev || 0, people: raised.get(id)?.people || 0, sectors: edgesTo(g, id, 'needs').length })).sort((a, b) => b.sectors - a.sectors || a.ev - b.ev); if (!rows.length) return noData('recommend_next', 'ماذا نصمم بعد ذلك؟', p, 'لا احتياجات قطاعية مسجّلة بعد.');
      const top = rows.slice(0, 3); return { template: 'recommend_next', title_ar: 'ماذا نصمم بعد ذلك؟', params: p, people: 0, confidence: rows.length >= 5 ? 'medium' : 'weak', answer_ar: `ابدأ بـ${top.map(r => `«${r.label}»`).join('، ')}: مهارات يطلبها ${top[0].sectors} قطاع${top[0].sectors > 1 ? 'ات' : ''} وتحمل ${evN(top[0].ev)} فقط. افتح هندسة البرامج التدريبية بها.`, chain: [{ label: 'المعيار', value: 'أعلى طلب قطاعي × أقل أدلة' }], rows: rows.slice(0, 8).map(r => ({ id: r.id, label: r.label, value: `${r.sectors} قطاع`, sub: r.ev ? `${evN(r.ev)}` : 'لا دليل' })), suggestions: ['أين الفجوات؟', 'أي الجهات تحتاج هذه المهارة؟'] }; } },
  { id: 'session_vs_program', title_ar: 'الجلسات المباشرة أم البرامج؟', title_en: 'Live sessions or programs?', example_ar: 'هل الجلسات المباشرة أنفع أم البرامج الكاملة؟', keywords: ['الجلسات أم', 'أم البرامج', 'مقارنة', 'جلسات مباشرة', 'versus'],
    run: (g, p) => { const a = skillEdges(g, p, e => e.src === 'channel:session'); const b = skillEdges(g, p, e => e.src === 'channel:program'); const agg = (es: GraphEdge[]) => ({ ev: es.reduce((s, e) => s + e.evidence, 0), w: es.reduce((s, e) => s + e.weight, 0), people: es.reduce((s, e) => Math.max(s, e.people), 0), skills: new Set(es.map(e => e.dst)).size }); const A = agg(a), B = agg(b); if (!A.ev && !B.ev) return noData('session_vs_program', 'الجلسات المباشرة أم البرامج؟', p, 'لا أدلة من القناتين بعد.');
      const per = (x: ReturnType<typeof agg>) => (x.people ? x.w / x.people : 0); const win = per(A) >= per(B) ? 'الجلسات المباشرة' : 'البرامج الكاملة'; return { template: 'session_vs_program', title_ar: 'الجلسات المباشرة أم البرامج؟', params: p, people: A.people + B.people, confidence: conf(A.people + B.people, A.ev + B.ev), answer_ar: `لكل متعلم: الجلسات المباشرة ${r1(per(A))} وزنًا على ${A.skills} مهارة، والبرامج ${r1(per(B))} وزنًا على ${B.skills} مهارة — الكفّة الآن لـ${win}. البرامج تبني العمق والجلسات تبني الاتساع؛ والأقوى هو الجمع بينهما.`, chain: [{ label: 'جلسات', value: `${evN(A.ev)} · ${peopleN(A.people)}` }, { label: 'برامج', value: `${evN(B.ev)} · ${peopleN(B.people)}` }], rows: [{ id: 'channel:session', label: 'الجلسات المباشرة', value: `${r1(per(A))}/شخص`, sub: `${A.skills} مهارة` }, { id: 'channel:program', label: 'البرامج الكاملة', value: `${r1(per(B))}/شخص`, sub: `${B.skills} مهارة` }], suggestions: ['أي قناة تعلّم تنقل الأثر أكثر؟'] }; } },
];
export const TEMPLATE_IDS = TEMPLATES.map(t => t.id);

// ====================================================================== مطابقة السؤال بقالب (محليًا)
export type EntityIndex = { skills: { id: string; name_ar: string; name_en?: string | null; code?: string | null }[]; sectors: { code: string; name_ar: string; name_en?: string | null }[]; orgs: { id: string; name_ar: string; name_en?: string | null }[]; programs: { id: string; name_ar: string; name_en?: string | null }[] };
const low = (s: unknown) => norm(s).toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
function findEntity<T extends { name_ar: string; name_en?: string | null }>(q: string, list: T[], extra?: (x: T) => string | null | undefined): T | null {
  const lq = low(q); let best: { x: T; len: number } | null = null;
  for (const x of list) { const names = [x.name_ar, x.name_en || '', extra?.(x) || ''].map(low).filter(n => n.length >= 3); for (const n of names) if (lq.includes(n) && (!best || n.length > best.len)) best = { x, len: n.length }; }
  if (best) return best.x;
  // مطابقة جزئية: أغلبية الكلمات المميزة (≥ 5 أحرف) من اسم الكيان تظهر في السؤال؛ الأعلى تطابقًا يفوز
  const STOP = ['مهاره', 'برنامج', 'قطاع', 'جامعه', 'اداره', 'التعليم', 'العربيه', 'بالعربيه', '(اساسي)', '(متقدم)', 'للناطقين', 'بغيرها'];
  let part: { x: T; hits: number; total: number } | null = null;
  for (const x of list) {
    const words = low(x.name_ar).split(' ').filter(w => w.length >= 5 && !STOP.includes(w)); if (!words.length) continue;
    const hits = words.filter(w => lq.includes(w)).length; if (hits >= Math.max(1, Math.ceil(words.length / 2)) && (!part || hits > part.hits || (hits === part.hits && words.length < part.total))) part = { x, hits, total: words.length };
  }
  if (part) return part.x;
  return null;
}
export function extractParams(q: string, idx: EntityIndex): Params {
  const y = q.match(/\b(20[2-4][0-9])\b/); const skill = findEntity(q, idx.skills, x => x.code); const sector = findEntity(q, idx.sectors); const org = findEntity(q, idx.orgs); const program = findEntity(q, idx.programs);
  return { skill: skill?.id || null, sector: sector?.code || null, org: org?.id || null, program: program?.id || null, year: y ? Number(y[1]) : /هذا العام|هذه السنة|this year/.test(q) ? null : null };
}
export function matchTemplate(q: string, idx: EntityIndex): { template: Template; params: Params; score: number } {
  const lq = low(q); const params = extractParams(q, idx); let best: { template: Template; score: number } | null = null;
  for (const t of TEMPLATES) { let s = 0; for (const k of t.keywords) if (lq.includes(low(k))) s += Math.max(1, Math.min(4, low(k).split(' ').length * 1.5)); if (t.needs) for (const n of t.needs) s += params[n] ? 2 : -3; if (!best || s > best.score) best = { template: t, score: s }; }
  let chosen = best!; if (chosen.score <= 0) { chosen = { template: TEMPLATES.find(t => t.id === (params.program ? 'program_impact' : params.org ? 'org_year' : params.skill ? 'top_programs_for_skill' : params.sector ? 'sector_focus' : 'year_summary'))!, score: 1 }; }
  return { template: chosen.template, params, score: chosen.score };
}
export function runTemplate(id: string, g: Graph, p: Params): EvidenceAnswer | null { const t = TEMPLATES.find(x => x.id === id); if (!t) return null; if (t.needs?.some(n => !p[n])) return null; return t.run(g, p); }

// ====================================================================== الذاكرة الحية — خيوط عامة مجهّلة (3 يوميًا)
export type Thread = { icon: 'spark' | 'compass' | 'target'; text_ar: string; text_en: string };
export function publicThreads(g: Graph, dayIndex: number): Thread[] {
  const out: Thread[] = []; const es = g.edges.filter(e => e.rel === 'raised' && e.src.startsWith('channel:') && e.people >= PUBLIC_MIN_PEOPLE);
  if (!es.length) return out;
  const chans = sumBy(es, e => e.src).filter(([, c]) => c.people >= PUBLIC_MIN_PEOPLE); const skills = sumBy(es, e => e.dst).filter(([, c]) => c.people >= PUBLIC_MIN_PEOPLE);
  const en = (id: string) => nodeMap(g).get(id)?.label_en || label(g, id);
  if (skills.length) { const i = dayIndex % skills.length; const [k, c] = skills[i]; out.push({ icon: 'spark', text_ar: `${peopleN(c.people)} تركوا ${evN(c.ev)} على «${label(g, k)}» — مهارة تتحرك هذا الموسم.`, text_en: `${c.people} people left ${c.ev} pieces of evidence on “${en(k)}” — a skill on the move this season.` }); }
  const tr = chans.map(([k, c]) => ({ k, c, r: pct(c.tr, c.ev) })).filter(x => x.c.tr > 0).sort((a, b) => b.r - a.r);
  if (tr.length) out.push({ icon: 'target', text_ar: `${tr[0].r}% من أدلة «${label(g, tr[0].k)}» أُكِّدت في مكان العمل — التعلّم الذي يُرى يُنقل.`, text_en: `${tr[0].r}% of “${en(tr[0].k)}” evidence was confirmed at work — learning that is seen gets transferred.` });
  if (chans.length >= 2) { const [a, b] = [chans[0], chans[Math.min(chans.length - 1, 1 + (dayIndex % Math.max(1, chans.length - 1)))]]; if (a[0] !== b[0]) out.push({ icon: 'compass', text_ar: `«${label(g, a[0])}» تحمل ${evN(a[1].ev)} مقابل ${b[1].ev} في «${label(g, b[0])}» — الذاكرة تتعلّم أي الطرق أنفع.`, text_en: `“${en(a[0])}” carries ${a[1].ev} pieces of evidence vs ${b[1].ev} in “${en(b[0])}” — the memory learns which paths work.` }); }
  return out.slice(0, 3);
}

// ====================================================================== درس الأسبوع (مسودة محلية — يعتمدها الإنسان)
export type Lesson = { week: string; title_ar: string; body_ar: string; evidence: Chain[] };
export function weekStart(iso: string): string { const d = new Date(iso + 'T00:00:00Z'); const dow = d.getUTCDay(); d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10); } // الأحد
export function lessonDraft(g: Graph, today: string): Lesson | null {
  // الدرس يُصاغ فقط حين تقف خلف قناته الأولى مجموعة ≥ 5 أشخاص فريدين (لا مجموع القنوات)
  const week = weekStart(today); const tc = TEMPLATES.find(t => t.id === 'top_channel')!.run(g, {}); const topPeople = tc.rows[0]?.id ? Math.max(0, ...edgesFrom(g, tc.rows[0].id, 'raised').map(e => e.people)) : 0;
  if (tc.rows.length >= 2 && topPeople >= PUBLIC_MIN_PEOPLE) return { week, title_ar: `ما يُؤكَّد في العمل يبدأ من «${tc.rows[0].label}»`, body_ar: tc.answer_ar + ' الدرس: صمّم كل برنامج بحيث ينتهي بدليل من هذه القناة.', evidence: tc.chain };
  const ys = TEMPLATES.find(t => t.id === 'year_summary')!.run(g, {}); if (ys.rows.length && ys.people >= PUBLIC_MIN_PEOPLE) return { week, title_ar: `أكثر ما تحرّك: «${ys.rows[0].label}»`, body_ar: ys.answer_ar, evidence: ys.chain };
  return null;
}

// ====================================================================== كوكبة الأثر — تخطيط SVG حتمي
export type StarNode = GraphNode & { x: number; y: number; r: number };
export function constellation(g: Graph, w = 900, h = 520, max = 60): { stars: StarNode[]; links: { a: string; b: string; w: number; rel: Rel }[] } {
  const skills = g.nodes.filter(n => n.kind === 'skill' && n.weight > 0).slice(0, 24); const others = g.nodes.filter(n => n.kind !== 'skill' && n.kind !== 'sector' && n.weight > 0).slice(0, Math.max(0, max - skills.length));
  const cx = w / 2, cy = h / 2; const stars: StarNode[] = [];
  skills.forEach((n, i) => { const a = (i / Math.max(1, skills.length)) * Math.PI * 2; const rad = Math.min(w, h) * 0.22; stars.push({ ...n, x: Math.round(cx + Math.cos(a) * rad), y: Math.round(cy + Math.sin(a) * rad), r: Math.min(22, 8 + Math.sqrt(n.weight) * 1.6) }); });
  others.forEach((n, i) => { const a = (i / Math.max(1, others.length)) * Math.PI * 2 + 0.3; const rad = Math.min(w, h) * (n.kind === 'channel' ? 0.08 : 0.42); stars.push({ ...n, x: Math.round(cx + Math.cos(a) * rad * (n.kind === 'channel' ? 1 : 1 + (i % 3) * 0.06)), y: Math.round(cy + Math.sin(a) * rad * (n.kind === 'channel' ? 1 : 1 + ((i + 1) % 3) * 0.05)), r: Math.min(18, 5 + Math.sqrt(n.weight) * 1.2) }); });
  const ids = new Set(stars.map(s => s.id)); const links = g.edges.filter(e => ids.has(e.src) && ids.has(e.dst)).slice(0, 160).map(e => ({ a: e.src, b: e.dst, w: e.weight, rel: e.rel }));
  return { stars, links };
}
export const KIND_LABEL: Record<NodeKind, { ar: string; en: string }> = { skill: { ar: 'مهارة', en: 'Skill' }, program: { ar: 'برنامج', en: 'Program' }, session: { ar: 'جلسة', en: 'Session' }, scenario: { ar: 'محاكٍ', en: 'Simulation' }, mission: { ar: 'مهمة عمل', en: 'Mission' }, channel: { ar: 'قناة تعلّم', en: 'Channel' }, sector: { ar: 'قطاع', en: 'Sector' }, org: { ar: 'جهة', en: 'Organization' }, trainer: { ar: 'مدرب', en: 'Trainer' }, contract: { ar: 'عقد أثر', en: 'Impact contract' } };
/** قصة عقدة في ثلاث جمل */
export function nodeStory(g: Graph, id: string): string[] {
  const n = nodeMap(g).get(id); if (!n) return []; const out: string[] = []; const inn = edgesTo(g, id), outt = edgesFrom(g, id);
  out.push(`${KIND_LABEL[n.kind].ar} «${n.label_ar}» — ${peopleN(n.people)} و${inn.length + outt.length} رابطًا بوزن ${r1(n.weight)}.`);
  const raised = outt.filter(e => e.rel === 'raised').slice(0, 3); if (raised.length) out.push(`رفع: ${raised.map(e => `«${label(g, e.dst)}» (${e.evidence})`).join('، ')}.`);
  const by = inn.filter(e => e.rel === 'raised').slice(0, 3); if (by.length) out.push(`ارتفع عبر: ${by.map(e => `«${label(g, e.src)}» (${e.evidence})`).join('، ')}.`);
  const inv = inn.filter(e => e.rel === 'invested'); if (inv.length) out.push(`استثمرت فيه ${inv.length} جهة.`);
  return out.slice(0, 3);
}
/** صفوف الجداول لحفظ الرسم البياني */
export function graphRows(g: Graph, nowIso: string) { return { nodes: g.nodes.map(n => ({ ...n, updated_at: nowIso })), edges: g.edges.map(e => ({ ...e, updated_at: nowIso })) }; }
