// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** أفق الجهة — قراءة الحالة (أفق · عهد · درب) من قاعدة البيانات + مسودة «نحن في 2036» بالذكاء الاصطناعي من فصول الجهة وكلماتها فقط */
import { runAi, logAi } from '../ai/athar';
import { inclusionEvents } from '../inclusion/load';
import { loadOrgJourneyInput } from '../org-journey/load';
import { buildOrgChapters } from '../org-journey/registry';
import type { OrgChapter, OrgJourneyInput } from '../org-journey/registry';
import { ORG_HORIZON_COLS, ORG_PLEDGE_COLS, ORG_MIN_SCENARIO_CHARS, ORG_MAX_SCENARIO_CHARS, buildOrgPath, orgEligibility, localOrgScenario, orgYearTarget } from './registry';
import type { OrgHorizon, OrgPledge, OrgPath, OrgPathInput } from './registry';

export type OrgHorizonState = { input: OrgJourneyInput; chapters: OrgChapter[]; members: number; elig: ReturnType<typeof orgEligibility>; horizon: OrgHorizon | null; pledge: OrgPledge | null; path: OrgPath | null; past: { horizon: OrgHorizon; pledge: OrgPledge | null }[] };
const norm = (h: any): OrgHorizon => ({ ...h, options: Array.isArray(h.options) ? h.options : [], meta: h.meta || {} });

/** مدخلات الدرب من مدخلات رحلة الجهة + كتب السنة الصادرة بعد التوقيع */
export async function orgPathInput(db: any, orgId: string, input: OrgJourneyInput, since: string | null): Promise<OrgPathInput> {
  let yearbooks: { at: string; chapters: number }[] = [];
  if (since) { const { data } = await db.from('portal_org_journey_shares').select('created_at,chapter_keys,status').eq('organization_id', orgId).gte('created_at', since).limit(50).then((r: any) => r, () => ({ data: [] })); yearbooks = ((data || []) as any[]).filter(s => s.status !== 'revoked').map(s => ({ at: s.created_at, chapters: Array.isArray(s.chapter_keys) ? s.chapter_keys.length : 0 })); }
  const pe = input.path_events || { daily: [], joins: [], returns: [] };
  const inclusion = await inclusionEvents(db, input.members).catch(() => []);
  return { members: input.members, missions: input.missions, daily: pe.daily, joins: pe.joins, returns: pe.returns, levels: input.levels, attestations: input.attestations, yearbooks, inclusion };
}

/** الأفق الجاري = آخر أفق ليس archived/renewed؛ العهد الجاري = عهد هذا الأفق غير المسحوب */
export async function loadOrgHorizonState(db: any, orgId: string, now = Date.now()): Promise<OrgHorizonState> {
  const [input, hsRaw, psRaw] = await Promise.all([
    loadOrgJourneyInput(db, orgId),
    db.from('portal_org_horizons').select(ORG_HORIZON_COLS).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(12).then((r: any) => r.data || [], () => []),
    db.from('portal_org_horizon_pledges').select(ORG_PLEDGE_COLS).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(24).then((r: any) => r.data || [], () => []),
  ]);
  const hs = hsRaw as any[]; const ps = psRaw as OrgPledge[];
  const chapters = buildOrgChapters(input).chapters; const elig = orgEligibility(chapters, input.members.length);
  const all = hs.map(norm); const current = all.find(h => h.status === 'draft' || h.status === 'active' || h.status === 'review') || null;
  const pledgeOf = (h: OrgHorizon) => ps.find(p => p.horizon_id === h.id && p.status !== 'revoked') || ps.find(p => p.horizon_id === h.id) || null;
  const pledge = current ? (ps.find(p => p.horizon_id === current.id && p.status !== 'revoked') || null) : null;
  const path = pledge && pledge.signed_at ? buildOrgPath(pledge, await orgPathInput(db, orgId, input, pledge.signed_at), now) : null;
  const past = all.filter(h => h !== current && (h.status === 'archived' || h.status === 'renewed')).map(h => ({ horizon: h, pledge: pledgeOf(h) }));
  return { input, chapters, members: input.members.length, elig, horizon: current, pledge, path, past };
}

/** مسودة «نحن في 2036» — من فصول الجهة وكلماتها («ما تغيّر فينا») فقط؛ تُعلَّم «بالذكاء الاصطناعي» ولا تُحفظ إلا باعتماد مدير الجهة */
export async function orgScenarioDraft(db: any, who: { id: string; email: string }, orgName: string, chapters: OrgChapter[], notes: string[], members: number, year = orgYearTarget(), useAi = true): Promise<{ text: string; source: 'ai' | 'local'; model: string | null }> {
  const own = notes.filter(Boolean).slice(0, 12); const local = () => localOrgScenario(orgName, chapters, own, members, year);
  if (!useAi) return { text: local(), source: 'local', model: null };
  const facts = JSON.stringify({ org: orgName, year, members, chapters: chapters.map(c => ({ at: c.at.slice(0, 10), title: c.title_ar, what: c.what_ar, people: c.people })), own_words: own });
  const res = await runAi<string>({
    system: `أنت كاتب يساعد جهةً (مؤسسة) على أن تكتب نفسها بعد عشر سنوات — في ${year} — بصوتها هي وبصيغة الجمع «نحن». اكتب «أفق الجهة» بصيغة الحاضر كأنها تعيش ${year} الآن (مثل: «في ${year} ننظر إلى الوراء…»)، في 100–170 كلمة بالعربية الفصحى الهادئة، مشتقًا من الفصول المعطاة (أعداد أشخاص وأحداث وقعت فعلًا) ومن كلمات الجهة نفسها (own_words) فقط. المطلوب صورة لطريقة عمل الجهة وأثرها في منسوبيها ومن يخدمونهم — لا قائمة إنجازات ولا خطة استراتيجية. ممنوع: الأسماء، المبالغة، المقارنة بجهات أخرى، اختراع حدث لم يُعطَ، الأرقام المالية، الشعارات، النسب المئوية، التراتيب. أعد النص فقط بلا عنوان ولا مقدمة.`,
    user: facts, parse: raw => { const t = String(raw || '').trim(); return t.length >= ORG_MIN_SCENARIO_CHARS && t.length <= ORG_MAX_SCENARIO_CHARS && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(t) ? t : null; }, local, budgetMs: 20000, fast: true,
  });
  if (db) await logAi(db, { user_id: who.id, email: who.email, role: 'org_admin', purpose: 'learner_plan', result: res, context: { kind: 'org_horizon_scenario', chapters: chapters.length, year } }).catch(() => null);
  return { text: res.data, source: res.source, model: res.model };
}
