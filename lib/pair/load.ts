// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** العهد المتقابل — القراءة من قاعدة البيانات: دائرتي · صاحبي · عهدي الحالي · الدربان */
import { lower } from '../councils/registry';
import { loadJourneyInput } from '../journey/load';
import { buildChapters } from '../journey/registry';
import type { Me } from '../journey/load';
import type { JourneyInput, Chapter } from '../journey/registry';
import type { PledgeKind } from '../horizon/registry';
import { PAIR_COLS, sideOf, other, stepFor, pairPath, stepState, pairEligibility, isLive, inviteExpired } from './registry';
import type { Pair, Side, Circle, StepState } from './registry';

const arr = <T>(r: any): T[] => ((r && r.data) || []) as T[];
const safe = (p: Promise<any>) => p.then((r: any) => r, () => ({ data: [] }));
const NIL = '00000000-0000-0000-0000-000000000000';
const orMe = (me: Me, userCol: string, emailCol: string) => `${userCol}.eq.${me.id},${emailCol}.ilike.${lower(me.email)}`;

export type Person = { id: string; email: string; name: string | null; found: boolean };
/** من البريد إلى حساب — إن لم يوجد: معرّف صفري (لا يكشف شيئًا للداعي) */
export async function resolvePerson(db: any, email: string): Promise<Person> {
  const e = lower(email);
  const r = await safe(db.from('profiles').select('id,email,full_name').ilike('email', e).limit(1));
  const row = arr<any>(r)[0];
  return row ? { id: row.id, email: e, name: row.full_name || null, found: true } : { id: NIL, email: e, name: null, found: false };
}
export async function personChapters(db: any, p: { id: string; email: string }): Promise<{ input: JourneyInput; chapters: Chapter[] }> {
  const input = await loadJourneyInput(db, { id: p.id, email: p.email });
  return { input, chapters: buildChapters(input) };
}

/** الدائرة المشتركة: مجلس يشاركانه (عضوان فاعلان) وإلا جهة واحدة (عضوان مؤكَّدان) — وإلا لا شيء */
export async function findCircle(db: any, me: Me, otherP: { id: string; email: string }): Promise<Circle | null> {
  const [m1, m2] = await Promise.all([
    safe(db.from('portal_council_members').select('council_id,status,left_at').or(orMe(me, 'user_id', 'email')).eq('status', 'active').is('left_at', null).limit(50)),
    safe(db.from('portal_council_members').select('council_id,status,left_at').or(orMe(otherP as Me, 'user_id', 'email')).eq('status', 'active').is('left_at', null).limit(50)),
  ]);
  const mine = new Set(arr<any>(m1).map(r => r.council_id).filter(Boolean)); const shared = arr<any>(m2).map(r => r.council_id).find(c => c && mine.has(c));
  if (shared) { const c = arr<any>(await safe(db.from('portal_councils').select('id,title_ar,status').eq('id', shared).limit(1)))[0]; return { kind: 'council', id: shared, title: c?.title_ar || null }; }
  const [o1, o2] = await Promise.all([
    safe(db.from('portal_org_members').select('organization_id').or(orMe(me, 'user_id', 'email')).eq('status', 'confirmed').limit(20)),
    safe(db.from('portal_org_members').select('organization_id').or(orMe(otherP as Me, 'user_id', 'email')).eq('status', 'confirmed').limit(20)),
  ]);
  const myOrgs = new Set(arr<any>(o1).map(r => r.organization_id).filter(Boolean)); const org = arr<any>(o2).map(r => r.organization_id).find(c => c && myOrgs.has(c));
  if (org) { const o = arr<any>(await safe(db.from('portal_organizations').select('id,name').eq('id', org).limit(1)))[0]; return { kind: 'org', id: org, title: o?.name || null }; }
  return null;
}

/** كل عهودي (بالمعرّف أو بالبريد) — الأحدث أولًا */
export async function loadMyPairs(db: any, me: Me): Promise<Pair[]> {
  const r = await safe(db.from('portal_pair_pledges').select(PAIR_COLS).or(`a_user_id.eq.${me.id},a_email.ilike.${lower(me.email)},b_user_id.eq.${me.id},b_email.ilike.${lower(me.email)}`).order('created_at', { ascending: false }).limit(60));
  return arr<Pair>(r).filter(p => !(p.meta && p.meta.blind && sideOf(p, me) === 'b'));
}
/** عهدي الحيّ (proposing|active|review) + الدعوات */
export function splitPairs(pairs: Pair[], me: Me, now = Date.now()) {
  const live = pairs.find(p => isLive(p.status) && !inviteExpired(p, now)) || null;
  const invitesIn = pairs.filter(p => p.status === 'invited' && sideOf(p, me) === 'b' && !inviteExpired(p, now));
  const inviteOut = pairs.find(p => p.status === 'invited' && sideOf(p, me) === 'a' && !inviteExpired(p, now)) || null;
  const past = pairs.filter(p => ['renewed', 'closed', 'revoked', 'expired'].includes(p.status) && !!p.accepted_at && !(p.meta && p.meta.blind)).slice(0, 12);
  return { live, invitesIn, inviteOut, past };
}

export type PairState = {
  me: Me; eligible: ReturnType<typeof pairEligibility>; chapters: number; chapter_kinds: string[]; input: JourneyInput;
  live: Pair | null; side: Side | null; invites_in: Pair[]; invite_out: Pair | null; past: Pair[];
  my_path: ReturnType<typeof pairPath> | null; my_state: StepState | null; partner_state: StepState | null; horizon_kind: PledgeKind | null;
};
/** الحالة الكاملة لطرف واحد — درب صاحبي يُحسب ويُختزل إلى حالة فقط */
export async function loadPairState(db: any, me: Me, now = Date.now()): Promise<PairState> {
  const [mineJ, pairs, hz] = await Promise.all([personChapters(db, me), loadMyPairs(db, me), safe(db.from('portal_horizon_pledges').select('kind,status').or(orMe(me, 'user_id', 'email')).eq('status', 'active').limit(1))]);
  const { live, invitesIn, inviteOut, past } = splitPairs(pairs, me, now);
  const side = live ? sideOf(live, me) : null;
  let my_path = null as PairState['my_path'], my_state: StepState | null = null, partner_state: StepState | null = null;
  if (live && side && live.signed_at && (live.status === 'active' || live.status === 'review')) {
    const ms = stepFor(live, side); const ps = stepFor(live, other(side));
    if (ms) { my_path = pairPath(ms, live.signed_at, mineJ.input, now); my_state = stepState(my_path, live.signed_at); }
    if (ps) partner_state = await partnerState(db, live, other(side), now);
  }
  return { me, eligible: pairEligibility(mineJ.chapters), chapters: mineJ.chapters.length, chapter_kinds: Array.from(new Set(mineJ.chapters.map(c => c.kind))), input: mineJ.input, live, side, invites_in: invitesIn, invite_out: inviteOut, past, my_path, my_state, partner_state, horizon_kind: (arr<any>(hz)[0]?.kind as PledgeKind) || null };
}
/** حالة خطوة طرف (يُستخدم للطرف الآخر وللمهام المجدولة) */
export async function partnerState(db: any, p: Pair, side: Side, now = Date.now()): Promise<StepState> {
  const st = stepFor(p, side); if (!st || !p.signed_at) return stepState(null);
  const who = side === 'a' ? { id: p.a_user_id, email: p.a_email } : { id: p.b_user_id || NIL, email: p.b_email };
  const { input } = await personChapters(db, who);
  return stepState(pairPath(st, p.signed_at, input, now), p.signed_at);
}
