// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «شهادة عضو مجلس» (P23) — بعد 3 دورات مكتملة و3 شهادات أقران معتمدة: وثيقة Open Badges 3.0 موقَّعة Ed25519 بمفتاح أَثَر نفسه (did:web)
 *  تحمل الأعداد (دورات · قضايا · عودات · شهادات) لا المحتوى — وتُتحقق من /verify/vc مثل أي شهادة أَثَر.
 */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { BADGE_CYCLES, BADGE_ATTESTATIONS, lower } from './registry';
import type { Member, Attestation, Case } from './registry';

export type BadgeStats = { councils: number; cycles: number; cases: number; returns: number; attestations_received: number; attestations_given: number; questions: number };
export function badgeStats(email: string, members: Member[], cases: Case[], atts: Attestation[], questions = 0): BadgeStats {
  const me = lower(email); const mine = members.filter(m => lower(m.email) === me && m.council_id);
  return { councils: new Set(mine.map(m => m.council_id)).size, cycles: mine.reduce((s, m) => s + (m.cycles_completed || 0), 0), cases: cases.filter(c => lower(c.author_email) === me).length, returns: cases.filter(c => lower(c.author_email) === me && c.returned_at).length, attestations_received: atts.filter(a => lower(a.to_email) === me && a.status === 'approved').length, attestations_given: atts.filter(a => lower(a.from_email) === me).length, questions };
}
export function badgeEligibility(s: BadgeStats): { ok: boolean; missing_ar: string[] } {
  const missing: string[] = [];
  if (s.cycles < BADGE_CYCLES) missing.push(`${BADGE_CYCLES - s.cycles} ${BADGE_CYCLES - s.cycles === 1 ? 'دورة' : 'دورات'} مكتملة إضافية`);
  if (s.attestations_received < BADGE_ATTESTATIONS) missing.push(`${BADGE_ATTESTATIONS - s.attestations_received} شهادة أقران معتمدة إضافية`);
  if (s.returns < 1) missing.push('عودة واحدة على الأقل بالتزامك');
  return { ok: missing.length === 0, missing_ar: missing };
}
export const badgeCode = (rnd: () => string) => `ATH-C-${rnd()}-${rnd()}`;

export function buildCouncilBadgeDoc(inp: { code: string; name: string; email: string; stats: BadgeStats; site: string; did: string; now?: Date; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Council Member — عضو مجلس أَثَر',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(),
    credentialSubject: { type: ['AchievementSubject'], name: inp.name, identifier: [{ type: 'IdentityObject', identityType: 'emailAddress', hashed: false, identityHash: inp.email }],
      achievement: { id: `${inp.site}/councils#member`, type: ['Achievement'], name: 'Council member (peer council)', achievementType: 'Badge',
        description: 'The holder completed at least three full peer-council cycles at Athar, returned on their own commitments, and received peer attestations of specific skills that were approved by a human reviewer (organization admin or Athar staff). Counts only — council content is confidential (Chatham House rule).',
        criteria: { narrative: `≥ ${BADGE_CYCLES} completed 6-week cycles · ≥ ${BADGE_ATTESTATIONS} approved peer attestations · ≥ 1 return on a commitment.` } },
      result: [
        { type: ['Result'], resultDescription: 'cycles_completed', value: String(inp.stats.cycles) }, { type: ['Result'], resultDescription: 'councils', value: String(inp.stats.councils) },
        { type: ['Result'], resultDescription: 'cases_brought', value: String(inp.stats.cases) }, { type: ['Result'], resultDescription: 'returns', value: String(inp.stats.returns) },
        { type: ['Result'], resultDescription: 'peer_attestations_received', value: String(inp.stats.attestations_received) }, { type: ['Result'], resultDescription: 'peer_attestations_given', value: String(inp.stats.attestations_given) },
      ] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'council_badge', code: inp.code, holder: inp.name, verify_url: url, stats: inp.stats, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

export async function issueBadge(db: any, user: { id: string; email: string; name: string }, stats: BadgeStats, signer: Signer, site: string, did: string, rnd: () => string): Promise<{ ok: true; code: string; vc: any; id: string; existing: boolean } | { ok: false; error: string }> {
  const { data: ex } = await db.from('portal_vc_issuances').select('id,code,vc').eq('kind', 'council_badge').ilike('email', lower(user.email)).is('revoked_at', null).limit(1);
  if ((ex || []).length) return { ok: true, code: ex[0].code, vc: ex[0].vc, id: ex[0].id, existing: true };
  const code = badgeCode(rnd); const now = new Date();
  const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'council_badge', credential_id: null, user_id: user.id, email: lower(user.email), full_name: user.name || null, title_ar: 'شهادة عضو مجلس أَثَر', kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: null, issued_by: user.id }).select('id,status_index').single();
  if (error || !ins) return { ok: false, error: error?.message || 'تعذّر الإصدار' };
  const vc = await signDocument(buildCouncilBadgeDoc({ code, name: user.name || user.email, email: lower(user.email), stats, site, did, now, statusIndex: Number((ins as any).status_index) }), signer, now);
  await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id);
  await db.from('portal_learning_events').insert({ user_id: user.id, email: lower(user.email), verb: 'issued', object_type: 'council_badge', object_id: (ins as any).id, skills: [], context: { code, ...stats } }).then(() => null, () => null);
  return { ok: true, code, vc, id: (ins as any).id, existing: false };
}
