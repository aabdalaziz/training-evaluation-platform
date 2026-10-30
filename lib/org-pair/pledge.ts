// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** عهد الممارس وجهته — الوثيقة الواحدة بحاملَين: شخص + جهة (ATH-PO): تُصدَر حين يوقّع المنسوب ومدير الجهة · الموقّع عن الجهة يظهر بصفته لا ببريده · لا «لماذا» · تُسحب بنقرة من أيّ طرف */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { lower } from '../councils/registry';
import { ORG_PAIR_VERSION, ORG_PAIR_PLEDGE_DAYS, ORG_PAIR_COLS, MEMBER_KIND_AR, ORG_STEP_KIND_AR, addDays, orgPairCode, memberName, orgName } from './registry';
import type { OrgPair, MemberStep, OrgStep } from './registry';

export function buildOrgPairDoc(inp: { code: string; memberName: string; orgName: string; memberStep: MemberStep; orgStep: OrgStep; site: string; did: string; now?: Date; expires: string; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`; const name = `${inp.memberName} · ${inp.orgName}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Practitioner–Organization Pledge — عهد الممارس وجهته',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), validUntil: inp.expires,
    credentialSubject: { type: ['AchievementSubject'], name,
      achievement: { id: `${inp.site}/me/pair`, type: ['Achievement'], name: `Practitioner–organization pledge (${inp.memberStep.kind} ↔ ${inp.orgStep.kind}) — one step each, for one year`, achievementType: 'Badge',
        description: 'A mutual pledge between a practitioner and their organization at Athar. The organization asked the practitioner for one concrete, platform-witnessable personal step for one year; the practitioner asked the organization for one platform-witnessable act towards them (a peer-council seat, a human level approval, a peer attestation approval, or timely mission confirmations). The practitioner signed in their own name; an organization administrator signed in their capacity. Both paths are derived from recorded events only; the two review together after 365 days. The words each wrote to the other are private and not part of this document.',
        criteria: { narrative: `${inp.memberName}: «${inp.memberStep.title_ar}» · ${inp.orgName}: «${inp.orgStep.title_ar}»` } },
      result: [{ type: ['Result'], resultDescription: 'member_step', value: inp.memberStep.kind }, { type: ['Result'], resultDescription: 'organization_step', value: inp.orgStep.kind }, { type: ['Result'], resultDescription: 'review_at', value: inp.expires.slice(0, 10) }] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'org_pair_pledge', code: inp.code, holder: name, holders: [{ name: inp.memberName, role: 'practitioner', step: { kind: inp.memberStep.kind, kind_ar: MEMBER_KIND_AR[inp.memberStep.kind], title_ar: inp.memberStep.title_ar } }, { name: inp.orgName, role: 'organization', signed_as_ar: 'بصفته مدير الجهة', step: { kind: inp.orgStep.kind, kind_ar: ORG_STEP_KIND_AR[inp.orgStep.kind], title_ar: inp.orgStep.title_ar } }], version: ORG_PAIR_VERSION, verify_url: url, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

/** يُستدعى حين يكتمل التوقيعان: يُصدر الوثيقة ويُفعّل العهد ويسجّل حدثًا للمنسوب */
export async function activateOrgPair(db: any, p: OrgPair, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; pair: OrgPair; verify_url: string | null; signed_vc: boolean } | { ok: false; error: string }> {
  if (!p.member_step || !p.org_step) return { ok: false, error: 'الخطوتان غير مكتملتين' };
  const code = orgPairCode(rnd); const signedAt = now.toISOString(); const expires = addDays(now, ORG_PAIR_PLEDGE_DAYS); const mName = memberName(p), oName = orgName(p);
  let vcId: string | null = null; let signedVc = false;
  if (signer) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'org_pair_pledge', credential_id: null, user_id: p.member_user_id, email: lower(p.member_email), full_name: `${mName} · ${oName}`, title_ar: `عهد الممارس وجهته — ${mName} و${oName}`, kid: signer.kid, vc: {}, digest: '', issued_at: signedAt, expires_at: expires, issued_by: p.org_signer_id || p.member_user_id }).select('id,status_index').single();
    if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
    const vc = await signDocument(buildOrgPairDoc({ code, memberName: mName, orgName: oName, memberStep: p.member_step, orgStep: p.org_step, site, did, now, expires, statusIndex: Number((ins as any).status_index) }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id); vcId = (ins as any).id; signedVc = true;
  }
  const { data, error } = await db.from('portal_org_pair_pledges').update({ status: 'active', code, vc_issuance_id: vcId, signed_at: signedAt, expires_at: expires, review_at: expires, updated_at: signedAt }).eq('id', p.id).select(ORG_PAIR_COLS).single();
  if (error || !data) return { ok: false, error: error?.message || 'تعذّر تفعيل العهد' };
  await db.from('portal_learning_events').insert({ user_id: p.member_user_id, email: lower(p.member_email), verb: 'pledged', object_type: 'org_pair', object_id: p.id, skills: p.member_step.target.skill_id ? [p.member_step.target.skill_id] : [], context: { code, kind: p.member_step.kind, title_ar: p.member_step.title_ar, org_kind: p.org_step.kind, org: oName, review_at: expires } }).then(() => null, () => null);
  return { ok: true, pair: data as OrgPair, verify_url: signedVc ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null, signed_vc: signedVc };
}

/** سحب العهد من أيّ طرف — تُسحب الوثيقة معه */
export async function revokeOrgPair(db: any, p: OrgPair, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  if (p.status !== 'active' && p.status !== 'review' && p.status !== 'proposing') return { ok: false, error: 'العهد ليس حيًّا' };
  const { error } = await db.from('portal_org_pair_pledges').update({ status: 'revoked', updated_at: now.toISOString(), meta: { ...(p.meta || {}), revoked_at: now.toISOString() } }).eq('id', p.id); if (error) return { ok: false, error: error.message };
  if (p.vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', p.vc_issuance_id).then(() => null, () => null);
  return { ok: true };
}
