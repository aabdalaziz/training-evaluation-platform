// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** أفق الجهة — عهد الجهة: توقيع الخطوة الواحدة وثيقةً Ed25519 (ATH-OH) باسم الجهة صالحة 365 يومًا · السحب بنقرة · الكشف انتقائي (اسم الجهة وعنوان العهد وتاريخه ومن وقّعه بصفته — الأفق لا يدخل الوثيقة) */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { lower } from '../councils/registry';
import { ORG_HORIZON_VERSION, ORG_PLEDGE_DAYS, ORG_PLEDGE_COLS, ORG_PLEDGE_KIND_AR, addDays, orgPledgeCode } from './registry';
import type { OrgPledge, OrgPledgeOption } from './registry';

export function buildOrgPledgeDoc(inp: { code: string; orgName: string; signerName: string; option: OrgPledgeOption; year: number; site: string; did: string; now?: Date; expires: string; statusIndex: number | null; orgId: string }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Organization Horizon Pledge — عهد الجهة',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), validUntil: inp.expires,
    credentialSubject: { type: ['AchievementSubject'], name: inp.orgName,
      achievement: { id: `${inp.site}/org?tab=horizon`, type: ['Achievement'], name: `Organization horizon pledge (${inp.option.kind}) — one step for one year toward ${inp.year}`, achievementType: 'Badge',
        description: 'A one-year pledge signed on behalf of an organization at Athar: one concrete step its confirmed members can be witnessed taking (two members in one peer council and a return, five supervisor-confirmed workplace missions, five members each answering five daily cases, five human-approved skill levels, five approved peer attestations, or a signed yearbook with three or more chapters). The path is derived from recorded events after signing — distinct people counts only, never names; the organization reviews it after 365 days and renews or archives.',
        criteria: { narrative: inp.option.title_ar } },
      result: [{ type: ['Result'], resultDescription: 'pledge_kind', value: inp.option.kind }, { type: ['Result'], resultDescription: 'review_at', value: inp.expires.slice(0, 10) }, { type: ['Result'], resultDescription: 'signed_by_role', value: 'org_admin' }] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'org_horizon', code: inp.code, org: inp.orgName, org_id: inp.orgId, signed_by: inp.signerName, version: ORG_HORIZON_VERSION, pledge: { kind: inp.option.kind, kind_ar: ORG_PLEDGE_KIND_AR[inp.option.kind], title_ar: inp.option.title_ar, target: inp.option.target }, year_target: inp.year, verify_url: url, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

export async function signOrgPledge(db: any, who: { id: string; email: string; name: string }, org: { id: string; name: string }, horizonId: string, option: OrgPledgeOption, year: number, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; pledge: OrgPledge; verify_url: string | null; signed_vc: boolean } | { ok: false; error: string }> {
  const code = orgPledgeCode(rnd); const expires = addDays(now, ORG_PLEDGE_DAYS); const signerName = who.name || who.email.split('@')[0];
  let vcId: string | null = null; let signedVc = false;
  if (signer) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'org_horizon', credential_id: null, user_id: who.id, email: lower(who.email), full_name: org.name, title_ar: `عهد الجهة — ${option.title_ar.slice(0, 80)}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: expires, issued_by: who.id }).select('id,status_index').single();
    if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
    const vc = await signDocument(buildOrgPledgeDoc({ code, orgName: org.name, signerName, option, year, site, did, now, expires, statusIndex: Number((ins as any).status_index), orgId: org.id }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id); vcId = (ins as any).id; signedVc = true;
  }
  const row = { horizon_id: horizonId, organization_id: org.id, org_name: org.name, kind: option.kind, title_ar: option.title_ar, target: option.target, code, signed_by: who.id, signed_email: lower(who.email), signed_at: now.toISOString(), expires_at: expires, status: 'active', vc_issuance_id: vcId, meta: { version: ORG_HORIZON_VERSION, why_ar: option.why_ar, signer_name: signerName } };
  const { data, error } = await db.from('portal_org_horizon_pledges').insert(row).select(ORG_PLEDGE_COLS).single(); if (error || !data) return { ok: false, error: error?.message || 'تعذّر حفظ العهد' };
  return { ok: true, pledge: data as OrgPledge, verify_url: signedVc ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null, signed_vc: signedVc };
}

export async function revokeOrgPledge(db: any, orgId: string, pledgeId: string, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  const { data: p } = await db.from('portal_org_horizon_pledges').select(ORG_PLEDGE_COLS).eq('id', pledgeId).eq('organization_id', orgId).maybeSingle(); if (!p) return { ok: false, error: 'العهد غير موجود' };
  if ((p as OrgPledge).status !== 'active') return { ok: false, error: 'العهد ليس نشطًا' };
  const { error } = await db.from('portal_org_horizon_pledges').update({ status: 'revoked', revoked_at: now.toISOString() }).eq('id', pledgeId); if (error) return { ok: false, error: error.message };
  if ((p as OrgPledge).vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', (p as OrgPledge).vc_issuance_id).then(() => null, () => null);
  return { ok: true };
}
