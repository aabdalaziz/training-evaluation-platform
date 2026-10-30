// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** رحلة الممارس — قراءة المدخلات من قاعدة البيانات (كلها جداول موجودة) + مقدمة اختيارية بالذكاء الاصطناعي من كلمات المستخدم نفسه */
import { runAi, logAi } from '../ai/athar';
import { lower } from '../councils/registry';
import { buildJourney, INTRO_MAX_CHARS, attachPeers } from './registry';
import { loadOrgJourney } from '../org-journey/load';
import type { JourneyInput, Journey, Chapter } from './registry';

export type Me = { id: string; email: string; name?: string };
const orMe = (me: Me, userCol: string, emailCol: string) => `${userCol}.eq.${me.id},${emailCol}.ilike.${lower(me.email)}`;
const arr = <T>(r: any): T[] => ((r && r.data) || []) as T[];
const safe = (p: Promise<any>) => p.then((r: any) => r, () => ({ data: [] }));

export async function loadJourneyInput(db: any, me: Me): Promise<JourneyInput> {
  const [ev, dl, sm, ms, mm, cs, at, lv, cr] = await Promise.all([
    safe(db.from('portal_learning_events').select('at,verb,object_type,object_id,skills,context').or(orMe(me, 'user_id', 'email')).order('at', { ascending: true }).limit(3000)),
    safe(db.from('portal_daily_case_responses').select('case_id,created_at,response,band,score').or(orMe(me, 'user_id', 'email')).order('created_at', { ascending: true }).limit(400)),
    safe(db.from('portal_sim_runs').select('id,created_at,ended_at,status,score').or(orMe(me, 'user_id', 'email')).order('created_at', { ascending: true }).limit(200)),
    safe(db.from('portal_missions').select('id,title_ar,confirmed_at,submitted_at,status,skills').or(orMe(me, 'user_id', 'email')).limit(300)),
    safe(db.from('portal_council_members').select('council_id,joined_at,status').or(orMe(me, 'user_id', 'email')).limit(50)),
    safe(db.from('portal_council_cases').select('id,created_at,title_ar,commitment_ar,committed_at,return_ar,return_outcome,returned_at,theme').or(orMe(me, 'author_user_id', 'author_email')).order('created_at', { ascending: true }).limit(200)),
    safe(db.from('portal_council_attestations').select('created_at,decided_at,status,skill_id').or(orMe(me, 'to_user_id', 'to_email')).eq('status', 'approved').limit(200)),
    safe(db.from('portal_skill_levels').select('skill_id,approved_level,approved_at,computed_level').eq('user_id', me.id).not('approved_at', 'is', null).limit(200)),
    safe(db.from('portal_credentials').select('id,title_ar,kind,issued_at,verify_code,level,revoked_at').or(orMe(me, 'user_id', 'email')).is('revoked_at', null).order('issued_at', { ascending: true }).limit(200)),
  ]);
  const daily = arr<any>(dl); const caseIds = Array.from(new Set(daily.map(d => d.case_id).filter(Boolean)));
  const memberships = arr<any>(mm).filter(m => m.council_id); const councilIds = Array.from(new Set(memberships.map(m => m.council_id)));
  const skillIds = new Set<string>(); for (const m of arr<any>(ms)) for (const s of m.skills || []) skillIds.add(s); for (const a of arr<any>(at)) skillIds.add(a.skill_id); for (const l of arr<any>(lv)) skillIds.add(l.skill_id);
  const [dc, cc, sk] = await Promise.all([
    caseIds.length ? safe(db.from('portal_daily_cases').select('id,title_ar').in('id', caseIds)) : { data: [] },
    councilIds.length ? safe(db.from('portal_councils').select('id,title_ar').in('id', councilIds)) : { data: [] },
    skillIds.size ? safe(db.from('portal_skills').select('id,name_ar').in('id', Array.from(skillIds))) : { data: [] },
  ]);
  const dTitle = new Map(arr<any>(dc).map(x => [x.id, x.title_ar])); const cTitle = new Map(arr<any>(cc).map(x => [x.id, x.title_ar])); const skills: Record<string, string> = {}; for (const s of arr<any>(sk)) skills[s.id] = s.name_ar;
  return {
    events: arr<any>(ev).map(e => ({ at: e.at, verb: e.verb, object_type: e.object_type, object_id: String(e.object_id), skills: e.skills || [], context: e.context || {} })),
    daily: daily.map(d => ({ created_at: d.created_at, response: d.response || '', band: d.band || null, score: d.score ?? null, case_title: dTitle.get(d.case_id) || null })),
    sims: arr<any>(sm), missions: arr<any>(ms).map(m => ({ ...m, skills: m.skills || [] })),
    memberships: memberships.map(m => ({ council_id: m.council_id, council_title: cTitle.get(m.council_id) || null, joined_at: m.joined_at || null, status: m.status })),
    cases: arr<any>(cs), attestations: arr<any>(at), levels: arr<any>(lv), credentials: arr<any>(cr), skills,
  };
}
export async function loadJourney(db: any, me: Me, now = Date.now(), withPeers = true): Promise<Journey> {
  const j = buildJourney(await loadJourneyInput(db, me), now); if (!withPeers || !j.chapters.length) return j;
  // الفصل المشترك (P26): إن كنتُ منسوبًا مؤكَّدًا لجهة، أُلحق بكل فصل عدد زملائي الذين عاشوا فصلًا مثله في الربع نفسه (من فصول الجهة k ≥ 5 فقط)
  try {
    const { data: mem } = await db.from('portal_org_members').select('organization_id').eq('status', 'confirmed').or(orMe(me, 'user_id', 'email')).limit(1); const orgId = (mem as any[])?.[0]?.organization_id;
    if (!orgId) return j; const { data: org } = await db.from('portal_organizations').select('name_ar').eq('id', orgId).maybeSingle(); const oj = await loadOrgJourney(db, orgId, now);
    return { ...j, chapters: attachPeers(j.chapters, oj.chapters, String((org as any)?.name_ar || 'جهتك')) };
  } catch { return j; }
}

/** مقدمة الرحلة — من كلمات المستخدم نفسه (تعليقاته واقتباساته) لا من رأي النموذج؛ تُعلَّم «بالذكاء الاصطناعي» ويستطيع تعديلها قبل النشر */
export async function journeyIntro(db: any, me: Me, j: Journey, notes: { chapter_key: string; body_ar: string }[]): Promise<{ text: string; source: 'ai' | 'local'; model: string | null }> {
  const own = [...notes.map(n => n.body_ar), ...j.chapters.map(c => c.quote_ar || '')].filter(Boolean).slice(0, 12);
  const local = () => localIntro(j, own);
  const facts = JSON.stringify({ days: j.days, chapters: j.chapters.map(c => ({ at: c.at.slice(0, 10), title: c.title_ar, what: c.what_ar })), own_words: own });
  const res = await runAi<string>({
    system: `أنت كاتب يساعد ممارسًا على تقديم رحلته المهنية بصوته هو. اكتب «مقدمة الرحلة» بضمير المتكلم (أنا) في 70–110 كلمة بالعربية الفصحى الهادئة، من الوقائع المعطاة ومن كلمات صاحبها فقط (own_words). ممنوع: المبالغة، الألقاب، الأحكام على الآخرين، ذكر أسماء أو جهات، اختراع حدث غير موجود. لا تبدأ بـ«أنا». أعد النص فقط.`,
    user: facts, parse: raw => { const t = String(raw || '').trim(); return t.length >= 60 && t.length <= INTRO_MAX_CHARS && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(t) ? t : null; }, local, budgetMs: 20000, fast: true,
  });
  if (db) await logAi(db, { user_id: me.id, email: me.email, role: 'learner', purpose: 'learner_plan', result: res, context: { kind: 'journey_intro', chapters: j.chapters.length } }).catch(() => null);
  return { text: res.data, source: res.source, model: res.model };
}
export function localIntro(j: Journey, own: string[]): string {
  if (!j.chapters.length) return 'رحلتي تبدأ اليوم.';
  const first = j.chapters[0]; const last = j.chapters[j.chapters.length - 1];
  const q = own.find(s => s.length >= 20 && s.length <= 160);
  return `${j.arc_ar} بدأتُ بـ«${first.title_ar}»، وآخر ما كُتب في رحلتي «${last.title_ar}».${q ? ` بكلماتي يومها: «${q}».` : ''} ما هنا حدث فعلًا، وأنا من اخترتُ ما أكشفه.`;
}
export const chapterByKey = (chs: Chapter[], key: string) => chs.find(c => c.key === key) || null;
