// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** عهد الممارس وجهته — القراءة من قاعدة البيانات: جهتي · ميثاقها · عهدي معها · دربان (المنسوب من أحداثه · الجهة من أفعالها تجاهه) */
import { lower } from '../councils/registry';
import { loadJourneyInput } from '../journey/load';
import { buildChapters } from '../journey/registry';
import type { Me } from '../journey/load';
import type { JourneyInput, Chapter } from '../journey/registry';
import { ORG_PAIR_COLS, memberEligibility, orgEligibility, isLive, orgInviteExpired, memberPath, orgPath, stepState } from './registry';
import type { OrgPair, OrgWitness } from './registry';
import type { StepState } from '../pair/registry';
import type { Path } from '../horizon/registry';

const arr = <T>(r: any): T[] => ((r && r.data) || []) as T[];
const safe = (p: Promise<any>) => p.then((r: any) => r, () => ({ data: [] }));
const NIL = '00000000-0000-0000-0000-000000000000';
const orMe = (me: { id: string; email: string }, userCol: string, emailCol: string) => `${userCol}.eq.${me.id || NIL},${emailCol}.ilike.${lower(me.email)}`;

export type OrgLite = { id: string; name_ar: string; charter: { status: string; expires_at: string | null; signed_at: string | null } | null };
/** جهتي: أول عضوية مؤكَّدة (منسوب أو مدير) + ميثاقها الأحدث */
export async function myOrg(db: any, me: Me): Promise<OrgLite | null> {
  const mem = arr<any>(await safe(db.from('portal_org_members').select('organization_id,role').or(orMe(me, 'user_id', 'email')).eq('status', 'confirmed').limit(5)));
  const orgId = mem[0]?.organization_id; if (!orgId) return null;
  return loadOrgLite(db, orgId);
}
export async function loadOrgLite(db: any, orgId: string): Promise<OrgLite | null> {
  const [o, c] = await Promise.all([safe(db.from('portal_organizations').select('id,name_ar').eq('id', orgId).limit(1)), safe(db.from('portal_org_charters').select('status,expires_at,signed_at').eq('organization_id', orgId).order('signed_at', { ascending: false }).limit(1))]);
  const org = arr<any>(o)[0]; if (!org) return null; const ch = arr<any>(c)[0] || null;
  return { id: org.id, name_ar: org.name_ar, charter: ch ? { status: ch.status, expires_at: ch.expires_at || null, signed_at: ch.signed_at || null } : null };
}
/** هل هذا الشخص منسوب مؤكَّد في الجهة؟ (أيّ دور) */
export async function isConfirmedMember(db: any, orgId: string, who: { id: string; email: string }): Promise<{ ok: boolean; user_id: string | null; name: string | null }> {
  const r = arr<any>(await safe(db.from('portal_org_members').select('user_id,full_name,email').eq('organization_id', orgId).eq('status', 'confirmed').or(orMe(who, 'user_id', 'email')).limit(1)))[0];
  return r ? { ok: true, user_id: r.user_id || null, name: r.full_name || null } : { ok: false, user_id: null, name: null };
}
export async function memberChapters(db: any, p: { id: string; email: string }): Promise<{ input: JourneyInput; chapters: Chapter[] }> {
  const input = await loadJourneyInput(db, { id: p.id || NIL, email: p.email }); return { input, chapters: buildChapters(input) };
}
/** ما تشهده المنصة عن أفعال الجهة تجاه المنسوب: طلبات المقاعد التي تذكره + مدخلات رحلته */
export async function orgWitness(db: any, orgId: string, member: { id: string; email: string }, input?: JourneyInput): Promise<OrgWitness> {
  const [inp, sr] = await Promise.all([input ? Promise.resolve(input) : loadJourneyInput(db, { id: member.id || NIL, email: member.email }), safe(db.from('portal_org_seat_requests').select('created_at,status,matched_council_id,people').eq('organization_id', orgId).order('created_at', { ascending: true }).limit(200))]);
  const e = lower(member.email);
  return { input: inp, seat_requests: arr<any>(sr).map(r => ({ created_at: r.created_at, status: r.status, matched_council_id: r.matched_council_id || null, includes_member: Array.isArray(r.people) && r.people.some((x: any) => lower(x?.email) === e) })) };
}

/** عهود المنسوب مع جهته (الأحدث أولًا) */
export async function loadMemberOrgPairs(db: any, me: Me): Promise<OrgPair[]> {
  return arr<OrgPair>(await safe(db.from('portal_org_pair_pledges').select(ORG_PAIR_COLS).or(orMe(me, 'member_user_id', 'member_email')).order('created_at', { ascending: false }).limit(40)));
}
/** كل عهود الجهة (لمديرها) */
export async function loadOrgPairs(db: any, orgId: string): Promise<OrgPair[]> {
  return arr<OrgPair>(await safe(db.from('portal_org_pair_pledges').select(ORG_PAIR_COLS).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(300)));
}
export function splitOrgPairs(rows: OrgPair[], now = Date.now()) {
  const live = rows.find(p => isLive(p.status) && !orgInviteExpired(p, now)) || null;
  const invites = rows.filter(p => p.status === 'invited' && !orgInviteExpired(p, now));
  const past = rows.filter(p => ['renewed', 'closed', 'revoked', 'expired'].includes(p.status) && !!p.accepted_at).slice(0, 12);
  return { live, invites, past };
}

export type OrgPairPaths = { member_path: Path | null; member_state: StepState | null; org_path: Path | null; org_state: StepState | null };
/** الدربان لعهد نشط — يُحسبان معًا ثم يُختزل درب الطرف الآخر إلى حالة في الواجهة */
export async function orgPairPaths(db: any, p: OrgPair, now = Date.now(), input?: JourneyInput): Promise<OrgPairPaths> {
  if (!p.signed_at || !(p.status === 'active' || p.status === 'review')) return { member_path: null, member_state: null, org_path: null, org_state: null };
  const member = { id: p.member_user_id || NIL, email: p.member_email };
  const w = await orgWitness(db, p.organization_id, member, input);
  const mp = p.member_step ? memberPath(p.member_step, p.signed_at, w.input, now) : null; const op = p.org_step ? orgPath(p.org_step, p.signed_at, w, now) : null;
  return { member_path: mp, member_state: mp ? stepState(mp, p.signed_at) : null, org_path: op, org_state: op ? stepState(op, p.signed_at) : null };
}

export type MemberOrgPairState = {
  me: Me; org: OrgLite | null; is_org_admin: boolean; eligible: ReturnType<typeof memberEligibility>; org_eligible: ReturnType<typeof orgEligibility>; chapters: number; chapter_kinds: string[]; input: JourneyInput;
  live: OrgPair | null; invites_in: OrgPair[]; invite_out: OrgPair | null; past: OrgPair[]; paths: OrgPairPaths;
};
/** حالة المنسوب الكاملة */
export async function loadMemberOrgPairState(db: any, me: Me, now = Date.now()): Promise<MemberOrgPairState> {
  const [org, mineJ, rows] = await Promise.all([myOrg(db, me), memberChapters(db, me), loadMemberOrgPairs(db, me)]);
  const adm = org ? arr<any>(await safe(db.from('portal_org_members').select('id').eq('organization_id', org.id).eq('role', 'org_admin').eq('status', 'confirmed').or(orMe(me, 'user_id', 'email')).limit(1))).length > 0 : false;
  const { live, invites, past } = splitOrgPairs(rows, now);
  const paths = live ? await orgPairPaths(db, live, now, mineJ.input) : { member_path: null, member_state: null, org_path: null, org_state: null };
  return { me, org, is_org_admin: adm, eligible: memberEligibility(mineJ.chapters), org_eligible: orgEligibility(org?.charter || null, now), chapters: mineJ.chapters.length, chapter_kinds: Array.from(new Set(mineJ.chapters.map(c => c.kind))), input: mineJ.input, live, invites_in: invites.filter(p => p.invited_by === 'org' && !(p.meta || {}).blind), invite_out: invites.find(p => p.invited_by === 'member') || null, past, paths };
}
/** مديرو الجهة المؤكَّدون (لإشعارات الجهة — داخل المنصة/push) */
export async function orgAdmins(db: any, orgId: string): Promise<{ email: string; name: string | null; user_id: string | null }[]> {
  return arr<any>(await safe(db.from('portal_org_members').select('email,full_name,user_id').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').limit(20))).map(r => ({ email: lower(r.email), name: r.full_name || null, user_id: r.user_id || null }));
}
