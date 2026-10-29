// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «صدى الجهة» (P24) — خادم فقط: يجمع آثار منسوبي الجهة في مجالس أَثَر (قضايا · مداولات · كاتب المجلس · شهادات) و«موقف اليوم»،
 *  ويبني الخيوط المجهولة (k ≥ 5) والمرآة الذاتية، ثم «إحاطة 90 ثانية» — ذكاء اصطناعي على أرقام ونصوص مجهولة فقط (لا نص قضية، لا أسماء)، وبدونه إحاطة محلية.
 */
import { runAi, logAi } from '../ai/athar';
import { lower } from '../councils/registry';
import { buildEcho, localBrief, ECHO_DAYS, MIRROR_DAYS, K_ORG, BRIEF_SECONDS } from './registry';
import type { EchoInput, OrgEcho } from './registry';

const chunk = <T,>(a: T[], n = 200) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

export async function loadEchoInput(db: any, orgId: string, now = Date.now()): Promise<EchoInput> {
  const { data: mem } = await db.from('portal_org_members').select('email').eq('organization_id', orgId).eq('status', 'confirmed').limit(5000);
  const members = Array.from(new Set(((mem || []) as any[]).map(m => lower(m.email)).filter(Boolean)));
  const since = new Date(now - 2 * MIRROR_DAYS * 864e5).toISOString(); const sinceDaily = new Date(now - 2 * ECHO_DAYS * 864e5).toISOString();
  const cases: any[] = []; const posts: any[] = []; const atts: any[] = []; let daily: any[] = [];
  for (const part of chunk(members)) {
    const [{ data: c }, { data: p }, { data: a }, { data: d }] = await Promise.all([
      db.from('portal_council_cases').select('id,author_email,created_at,theme,status,committed_at,return_due_at,returned_at,return_outcome').in('author_email', part).gte('created_at', since).limit(2000),
      db.from('portal_council_posts').select('case_id,email,kind,created_at').in('email', part).gte('created_at', since).limit(5000),
      db.from('portal_council_attestations').select('to_email,status,created_at,decided_at').in('to_email', part).gte('created_at', since).limit(2000),
      db.from('portal_daily_case_responses').select('email,created_at').in('email', part).gte('created_at', sinceDaily).limit(5000).then((r: any) => r, () => ({ data: [] })),
    ]);
    cases.push(...((c || []) as any[])); posts.push(...((p || []) as any[])); atts.push(...((a || []) as any[])); daily = daily.concat((d || []) as any[]);
  }
  // قضايا تداول فيها منسوبونا لكن أصحابها من جهات أخرى: نحتاج موضوعها فقط (لا نصّها) لعدّ الخيوط
  const known = new Set(cases.map(c => c.id)); const extraIds = Array.from(new Set(posts.map(p => p.case_id).filter(id => !known.has(id))));
  for (const part of chunk(extraIds)) { const { data: c } = await db.from('portal_council_cases').select('id,author_email,created_at,theme,status,committed_at,return_due_at,returned_at,return_outcome').in('id', part).limit(500); cases.push(...((c || []) as any[])); }
  const ids = cases.map(c => c.id); const scribes: any[] = [];
  for (const part of chunk(ids)) { const { data: s } = await db.from('portal_council_scribe').select('case_id,pivotal_questions,unsaid_ar,patterns').in('case_id', part).limit(2000); scribes.push(...((s || []) as any[]).map(x => ({ case_id: x.case_id, pivotal_questions: Array.isArray(x.pivotal_questions) ? x.pivotal_questions.map(String) : [], unsaid_ar: x.unsaid_ar || null, patterns: Array.isArray(x.patterns) ? x.patterns : [] }))); }
  const cut = now - ECHO_DAYS * 864e5; const dp = new Set(daily.filter(d => new Date(d.created_at).getTime() >= cut).map(d => lower(d.email))).size; const dpp = new Set(daily.filter(d => new Date(d.created_at).getTime() < cut).map(d => lower(d.email))).size;
  return { members, cases, posts, scribes, attestations: atts, daily_people: dp, daily_people_prev: dpp };
}

export async function orgEcho(db: any, orgId: string, now = Date.now()): Promise<OrgEcho> { return buildEcho(await loadEchoInput(db, orgId, now), now, K_ORG); }

/** «إحاطة 90 ثانية» للقيادة — من الخيوط والمرآة فقط (أرقام + سؤال محوري مجهول) */
export async function orgBrief(db: any, orgName: string, e: OrgEcho, actor?: { id: string; email: string; staff?: boolean }): Promise<{ text: string; source: 'ai' | 'local'; model: string | null; seconds: number }> {
  const local = () => localBrief(orgName, e);
  const facts = JSON.stringify({ org: orgName, window_days: e.window_days, people_active: e.people_active, people_total: e.people_total, quorum_ok: e.quorum_ok, threads: e.threads.map(t => ({ topic: t.label_ar, people: t.people, cases: t.cases, questions: t.questions, advice: t.advice, returns: t.returns, pivotal_question: t.pivotal_question, unsaid: t.unsaid })), below_k: e.below_k, mirror: e.mirror.map(m => ({ what: m.label_ar, now: m.now, prev: m.prev, unit: m.unit })) });
  const res = await runAi<string>({
    system: `أنت «كاتب الجهة» في أَثَر. اكتب إحاطة شفهية لقيادة الجهة تُقرأ في ${BRIEF_SECONDS} ثانية تقريبًا (150–190 كلمة) بالعربية الفصحى الدافئة، من الحقائق المعطاة فقط. القواعد: لا أسماء ولا جهات أخرى ولا مقارنة بغير الجهة نفسها؛ لا تقييم لأشخاص؛ لا تختلق أرقامًا؛ إن لم يكتمل النصاب (quorum_ok=false) فقل ذلك بصدق واقترح مقعدًا إضافيًا؛ اختم بجملة واحدة تذكّر بأن هذه الأرقام أدوات تعلّم لا تقييم وظيفي. أعد النص فقط بلا عناوين ولا JSON.`,
    user: facts, parse: raw => { const t = String(raw || '').trim(); return t.length >= 80 && t.length <= 2500 && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(t) ? t : null; }, local, budgetMs: 20000, fast: true,
  });
  if (actor && db) await logAi(db, { user_id: actor.id, email: actor.email, role: actor.staff ? 'staff' : 'org_admin', purpose: 'org_brief', result: res, context: { kind: 'org_echo_brief', threads: e.threads.length, quorum_ok: e.quorum_ok } }).catch(() => null);
  const words = res.data.split(/\s+/).length; return { text: res.data, source: res.source, model: res.model, seconds: Math.round(words / 2.1) };
}
