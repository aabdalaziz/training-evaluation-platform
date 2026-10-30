// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** رحلة الجهة — قراءة أحداث المنسوبين المؤكَّدين من الجداول القائمة (لا جدول للفصول) + مقدمة كتاب السنة من كلمات الجهة وحدها */
import { lower } from '../councils/registry';
import { runAi, logAi } from '../ai/athar';
import { buildOrgJourney, ORG_INTRO_MAX_CHARS, quarterLabel } from './registry';
import type { OrgJourneyInput, OrgJourney, OrgEvent } from './registry';
import { quarterOf } from './registry';
import { orgPledgeChapters, ORG_PLEDGE_COLS } from '../org-horizon/registry';

const chunk = <T,>(a: T[], n = 200) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
const safe = (p: Promise<any>) => p.then((r: any) => (r && r.data) || [], () => []);

export async function loadOrgJourneyInput(db: any, orgId: string): Promise<OrgJourneyInput> {
  const { data: mem } = await db.from('portal_org_members').select('email,user_id').eq('organization_id', orgId).eq('status', 'confirmed').limit(5000);
  const rows = (mem || []) as { email: string; user_id: string | null }[];
  const members = Array.from(new Set(rows.map(m => lower(m.email)).filter(Boolean))); const userIds = Array.from(new Set(rows.map(m => m.user_id).filter(Boolean))) as string[];
  const emailOfUser = new Map<string, string>(); for (const m of rows) if (m.user_id) emailOfUser.set(m.user_id, lower(m.email));
  const daily: any[] = [], missions: any[] = [], joins: any[] = [], cases: any[] = [], atts: any[] = [], creds: any[] = [], pledges: any[] = [], pairs: any[] = [];
  for (const part of chunk(members)) {
    const [d, ms, j, c, a, cr, pl, pa, pb] = await Promise.all([
      safe(db.from('portal_daily_case_responses').select('email,created_at').in('email', part).order('created_at', { ascending: true }).limit(20000)),
      safe(db.from('portal_missions').select('email,confirmed_at,skills').in('email', part).not('confirmed_at', 'is', null).limit(5000)),
      safe(db.from('portal_council_members').select('email,council_id,joined_at,status').in('email', part).not('joined_at', 'is', null).limit(5000)),
      safe(db.from('portal_council_cases').select('author_email,returned_at,theme,council_id').in('author_email', part).not('returned_at', 'is', null).limit(5000)),
      safe(db.from('portal_council_attestations').select('to_email,decided_at,status').in('to_email', part).eq('status', 'approved').limit(5000)),
      safe(db.from('portal_credentials').select('email,issued_at,revoked_at').in('email', part).is('revoked_at', null).limit(5000)),
      safe(db.from('portal_horizon_pledges').select('email,signed_at,status').in('email', part).not('signed_at', 'is', null).limit(5000)),
      safe(db.from('portal_pair_pledges').select('a_email,signed_at,status').in('a_email', part).not('signed_at', 'is', null).limit(5000)),
      safe(db.from('portal_pair_pledges').select('b_email,signed_at,status').in('b_email', part).not('signed_at', 'is', null).limit(5000)),
    ]);
    daily.push(...d); missions.push(...ms); joins.push(...j); cases.push(...c); atts.push(...a); creds.push(...cr); pledges.push(...pl); pairs.push(...pa.map((r: any) => ({ email: r.a_email, signed_at: r.signed_at, status: r.status })), ...pb.map((r: any) => ({ email: r.b_email, signed_at: r.signed_at, status: r.status })));
  }
  const levels: any[] = []; for (const part of chunk(userIds)) levels.push(...await safe(db.from('portal_skill_levels').select('user_id,approved_at,approved_level').in('user_id', part).not('approved_at', 'is', null).limit(5000)));
  // أول موقف لكل شخص
  const first = new Map<string, string>(); for (const r of daily) { const e = lower(r.email); if (!first.has(e) || r.created_at < first.get(e)!) first.set(e, r.created_at); }
  // التوأمة: مجالس انضم إليها منسوبونا وضمّت جهة أخرى
  const councilIds = Array.from(new Set(joins.map(j => j.council_id).filter(Boolean))); const twinnings: { at: string; orgs: number }[] = [];
  for (const part of chunk(councilIds, 50)) {
    const cm = await safe(db.from('portal_council_members').select('council_id,organization_id,status').in('council_id', part).in('status', ['active', 'left']).limit(5000));
    for (const cid of part) { const orgs = new Set(cm.filter((m: any) => m.council_id === cid && m.organization_id).map((m: any) => m.organization_id)); if (orgs.size >= 2 && orgs.has(orgId)) { const at = joins.filter(j => j.council_id === cid).map(j => j.joined_at).sort()[0]; if (at) twinnings.push({ at, orgs: orgs.size }); } }
  }
  const [charters, contracts, orgPledges] = await Promise.all([
    safe(db.from('portal_org_charters').select('signed_at,status,meta').eq('organization_id', orgId).order('signed_at', { ascending: true }).limit(50)),
    safe(db.from('portal_impact_contracts').select('id,delivered_at,status').eq('organization_id', orgId).not('delivered_at', 'is', null).limit(200)),
    safe(db.from('portal_org_horizon_pledges').select(ORG_PLEDGE_COLS).eq('organization_id', orgId).not('signed_at', 'is', null).order('signed_at', { ascending: true }).limit(50)),
  ]);
  const contractIds = contracts.map((c: any) => c.id); const returned = new Set<string>();
  for (const part of chunk(contractIds, 100)) for (const r of await safe(db.from('portal_contract_releases').select('contract_id,milestone').in('contract_id', part).eq('milestone', 'return').limit(500))) returned.add(r.contract_id);
  const ev = (person: string, at: string, theme?: string | null): OrgEvent => ({ person: lower(person), at, theme: theme || null });
  return {
    members,
    daily_first: Array.from(first.entries()).map(([e, at]) => ev(e, at)),
    missions: missions.map(m => ev(m.email, m.confirmed_at)),
    joins: joins.filter(j => j.status !== 'applied' && j.status !== 'invited').map(j => ev(j.email, j.joined_at)),
    returns: cases.map(c => ev(c.author_email, c.returned_at, c.theme)),
    attestations: atts.map(a => ev(a.to_email, a.decided_at)),
    levels: levels.map(l => ev(emailOfUser.get(l.user_id) || l.user_id, l.approved_at)),
    credentials: creds.map(c => ev(c.email, c.issued_at)),
    pledges: pledges.filter(p => p.status !== 'revoked').map(p => ev(p.email, p.signed_at)),
    pairs: pairs.filter(p => p.status !== 'revoked').map(p => ev(p.email, p.signed_at)),
    charters: charters.map((c: any, i: number) => ({ signed_at: c.signed_at, renewed: i > 0 })),
    twinnings, contracts: contracts.map((c: any) => ({ delivered_at: c.delivered_at, returned: returned.has(c.id) })),
    org_pledge_chapters: orgPledgeChapters(orgPledges.map((p: any) => ({ signed_at: p.signed_at, title_ar: p.title_ar, kind: p.kind, status: p.status, reviewed_at: p.meta?.reviewed_at || null, decision: p.meta?.decision || null, complete: p.meta?.complete ?? null, note_ar: null })), quarterOf),
    // P28 — أحداث خام لدرب عهد الجهة (كل الإجابات · الانضمام بمعرّف المجلس · العودات بمعرّف المجلس)
    path_events: { daily: daily.map(r => ev(r.email, r.created_at)), joins: joins.filter(j => j.status !== 'applied' && j.status !== 'invited').map(j => ({ person: lower(j.email), at: j.joined_at, council: String(j.council_id || '') })), returns: cases.map(c => ({ person: lower(c.author_email), at: c.returned_at, council: c.council_id ? String(c.council_id) : null })) },
  };
}
export async function loadOrgJourney(db: any, orgId: string, now = Date.now()): Promise<OrgJourney> { return buildOrgJourney(await loadOrgJourneyInput(db, orgId), now); }

/** مقدمة كتاب السنة — من تعليقات الجهة («ما تغيّر فينا») وفصولها المعدودة فقط؛ لا بيانات أفراد تصل إلى النموذج */
export async function orgIntro(db: any, who: { id: string; email: string }, orgName: string, j: OrgJourney, notes: { chapter_key: string; body_ar: string }[]): Promise<{ text: string; source: 'ai' | 'local'; model: string | null }> {
  const own = notes.map(n => n.body_ar).filter(Boolean).slice(0, 12); const local = () => localOrgIntro(orgName, j, own);
  const facts = JSON.stringify({ org: orgName, year: j.year_label, chapters: j.chapters.map(c => ({ quarter: quarterLabel(c.quarter), title: c.title_ar, people: c.people })), own_words: own });
  const res = await runAi<string>({
    system: `أنت كاتب يساعد جهة على تقديم «كتاب سنتها» بصيغة الجمع (نحن). اكتب مقدمة من 80–130 كلمة بالعربية الفصحى الهادئة من الوقائع المعطاة (أعداد أشخاص وحقب) ومن كلمات الجهة نفسها (own_words) فقط. ممنوع: الأسماء، المبالغة، المقارنة بجهات أخرى، اختراع حدث، تحويل الأعداد إلى نسب أو ترتيب. لا تبدأ بـ«نحن». أعد النص فقط.`,
    user: facts, parse: raw => { const t = String(raw || '').trim(); return t.length >= 80 && t.length <= ORG_INTRO_MAX_CHARS && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(t) ? t : null; }, local, budgetMs: 20000, fast: true,
  });
  if (db) await logAi(db, { user_id: who.id, email: who.email, role: 'org_admin', purpose: 'learner_plan', result: res, context: { kind: 'org_yearbook_intro', chapters: j.chapters.length } }).catch(() => null);
  return { text: res.data, source: res.source, model: res.model };
}
export function localOrgIntro(orgName: string, j: OrgJourney, own: string[]): string {
  if (!j.chapters.length) return `كتاب سنة «${orgName}» ما زال في صفحته الأولى.`;
  const first = j.chapters[0]; const last = j.chapters[j.chapters.length - 1]; const q = own.find(s => s.length >= 20 && s.length <= 200);
  return `${j.arc_ar} بدأ كتاب «${orgName}» لسنة ${j.year_label} بفصل «${first.title_ar}» (${quarterLabel(first.quarter)})، وآخر ما كُتب فيه «${last.title_ar}».${q ? ` بكلماتنا: «${q}».` : ''} ما هنا أعداد أشخاص لا أسماء، ولا فصل من أقل من خمسة — هذا ما تعلّمناه، لا ما أنجزناه.`;
}
