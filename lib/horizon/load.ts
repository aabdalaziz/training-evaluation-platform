// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** أفق الممارس — قراءة الحالة (أفق · عهد · درب) من قاعدة البيانات + مسودة الأفق بالذكاء الاصطناعي من كلمات الشخص وفصوله فقط */
import { runAi, logAi } from '../ai/athar';
import { loadJourneyInput } from '../journey/load';
import { buildChapters } from '../journey/registry';
import type { Chapter, JourneyInput } from '../journey/registry';
import { HORIZON_COLS, PLEDGE_COLS, MAX_SCENARIO_CHARS, MIN_SCENARIO_CHARS, buildPath, eligibility, localScenario, yearTarget } from './registry';
import type { Horizon, Pledge, Path } from './registry';

export type Me = { id: string; email: string; name?: string };
export type HorizonState = { input: JourneyInput; chapters: Chapter[]; elig: ReturnType<typeof eligibility>; horizon: Horizon | null; pledge: Pledge | null; path: Path | null; past: { horizon: Horizon; pledge: Pledge | null }[] };

const norm = (h: any): Horizon => ({ ...h, options: Array.isArray(h.options) ? h.options : [], meta: h.meta || {} });

/** الأفق الجاري = آخر أفق ليس archived/renewed؛ العهد الجاري = عهد هذا الأفق غير المسحوب */
export async function loadHorizonState(db: any, me: Me, now = Date.now()): Promise<HorizonState> {
  const [input, hsRaw, psRaw] = await Promise.all([
    loadJourneyInput(db, me),
    db.from('portal_horizons').select(HORIZON_COLS).eq('user_id', me.id).order('created_at', { ascending: false }).limit(12).then((r: any) => r.data || [], () => []),
    db.from('portal_horizon_pledges').select(PLEDGE_COLS).eq('user_id', me.id).order('created_at', { ascending: false }).limit(24).then((r: any) => r.data || [], () => []),
  ]);
  const hs = hsRaw as any[]; const ps = psRaw as Pledge[];
  const chapters = buildChapters(input); const elig = eligibility(chapters);
  const all = hs.map(norm); const current = all.find(h => h.status === 'draft' || h.status === 'active' || h.status === 'review') || null;
  const pledgeOf = (h: Horizon) => ps.find(p => p.horizon_id === h.id && p.status !== 'revoked') || ps.find(p => p.horizon_id === h.id) || null;
  const pledge = current ? (ps.find(p => p.horizon_id === current.id && p.status !== 'revoked') || null) : null;
  const path = pledge && pledge.signed_at ? buildPath(pledge, input, now) : null;
  const past = all.filter(h => h !== current && (h.status === 'archived' || h.status === 'renewed')).map(h => ({ horizon: h, pledge: pledgeOf(h) }));
  return { input, chapters, elig, horizon: current, pledge, path, past };
}

/** مسودة «أنا في 2036» — من فصول الشخص وتعليقاته واقتباساته فقط؛ تُعلَّم «بالذكاء الاصطناعي» ولا تُحفظ إلا بقرار صاحبها */
export async function scenarioDraft(db: any, me: Me, chapters: Chapter[], notes: string[], year = yearTarget(), useAi = true): Promise<{ text: string; source: 'ai' | 'local'; model: string | null }> {
  const own = [...notes, ...chapters.map(c => c.quote_ar || '')].filter(Boolean).slice(0, 12);
  const local = () => localScenario(chapters, own, year);
  if (!useAi) return { text: local(), source: 'local', model: null };
  const facts = JSON.stringify({ year, chapters: chapters.map(c => ({ at: c.at.slice(0, 10), title: c.title_ar, what: c.what_ar, level: c.level ? { skill: c.level.skill_ar, to: c.level.to } : null })), own_words: own });
  const res = await runAi<string>({
    system: `أنت كاتب يساعد ممارسًا على أن يكتب نفسه بعد عشر سنوات — في ${year} — بصوته هو. اكتب «أفقًا» بضمير المتكلم وبصيغة الحاضر كأنه يعيش ${year} الآن (مثل: «في ${year} أنظر إلى الوراء…»)، في 90–150 كلمة بالعربية الفصحى الهادئة، مشتقًا من الفصول المعطاة ومن كلمات صاحبها (own_words) فقط. المطلوب صورة إنسانية لطريقة عمله وأثره في الناس لا قائمة إنجازات. ممنوع: المناصب والألقاب، الأرقام الكبيرة، الأسماء والجهات، التقييم أو النصح، اختراع حدث لا أصل له في الفصول. لا تبدأ بـ«أنا». أعد النص فقط.`,
    user: facts, parse: raw => { const t = String(raw || '').trim(); return t.length >= MIN_SCENARIO_CHARS && t.length <= MAX_SCENARIO_CHARS && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(t) ? t : null; }, local, budgetMs: 20000, fast: true,
  });
  if (db) await logAi(db, { user_id: me.id, email: me.email, role: 'learner', purpose: 'learner_plan', result: res, context: { kind: 'horizon_scenario', chapters: chapters.length, year } }).catch(() => null);
  return { text: res.data, source: res.source, model: res.model };
}
