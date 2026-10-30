// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** أفق الممارس — العهد: توقيع الخطوة الواحدة وثيقةً Ed25519 (ATH-HZ) صالحة 365 يومًا · السحب بنقرة · الكشف انتقائي (عنوان العهد وتاريخه فقط — الأفق لا يدخل الوثيقة) */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { lower } from '../councils/registry';
import { HORIZON_VERSION, PLEDGE_DAYS, PLEDGE_COLS, PLEDGE_KIND_AR, addDays, pledgeCode } from './registry';
import type { Pledge, PledgeOption } from './registry';

export function buildPledgeDoc(inp: { code: string; name: string; option: PledgeOption; year: number; site: string; did: string; now?: Date; expires: string; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Horizon Pledge — عهد الأفق',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), validUntil: inp.expires,
    credentialSubject: { type: ['AchievementSubject'], name: inp.name,
      achievement: { id: `${inp.site}/me/horizon`, type: ['Achievement'], name: `Horizon pledge (${inp.option.kind}) — one step for one year toward ${inp.year}`, achievementType: 'Badge',
        description: 'A self-pledge signed by the holder at Athar: one concrete step for one year (join a peer council and return with what happened, a supervisor-confirmed workplace mission, twenty daily cases answered in the holder’s own words, a higher human-approved skill level, or an approved peer attestation). The path is derived from recorded events only; the holder reviews it after 365 days. The holder’s ten-year horizon text is private and not part of this document.',
        criteria: { narrative: inp.option.title_ar } },
      result: [{ type: ['Result'], resultDescription: 'pledge_kind', value: inp.option.kind }, { type: ['Result'], resultDescription: 'review_at', value: inp.expires.slice(0, 10) }] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'horizon', code: inp.code, holder: inp.name, version: HORIZON_VERSION, pledge: { kind: inp.option.kind, kind_ar: PLEDGE_KIND_AR[inp.option.kind], title_ar: inp.option.title_ar, target: inp.option.target }, year_target: inp.year, verify_url: url, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

export async function signPledge(db: any, me: { id: string; email: string; name: string }, horizonId: string, option: PledgeOption, year: number, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; pledge: Pledge; verify_url: string | null; signed_vc: boolean } | { ok: false; error: string }> {
  const code = pledgeCode(rnd); const expires = addDays(now, PLEDGE_DAYS); const name = me.name || me.email.split('@')[0];
  let vcId: string | null = null; let signedVc = false;
  if (signer) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'horizon', credential_id: null, user_id: me.id, email: lower(me.email), full_name: name, title_ar: `عهد الأفق — ${option.title_ar.slice(0, 80)}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: expires, issued_by: me.id }).select('id,status_index').single();
    if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
    const vc = await signDocument(buildPledgeDoc({ code, name, option, year, site, did, now, expires, statusIndex: Number((ins as any).status_index) }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id); vcId = (ins as any).id; signedVc = true;
  }
  const row = { horizon_id: horizonId, user_id: me.id, email: lower(me.email), kind: option.kind, title_ar: option.title_ar, target: option.target, code, signed_at: now.toISOString(), expires_at: expires, status: 'active', vc_issuance_id: vcId, meta: { version: HORIZON_VERSION, why_ar: option.why_ar } };
  const { data, error } = await db.from('portal_horizon_pledges').insert(row).select(PLEDGE_COLS).single(); if (error || !data) return { ok: false, error: error?.message || 'تعذّر حفظ العهد' };
  await db.from('portal_learning_events').insert({ user_id: me.id, email: lower(me.email), verb: 'pledged', object_type: 'horizon', object_id: horizonId, skills: option.target.skill_id ? [option.target.skill_id] : [], context: { code, kind: option.kind, review_at: expires } }).then(() => null, () => null);
  return { ok: true, pledge: data as Pledge, verify_url: signedVc ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null, signed_vc: signedVc };
}

export async function revokePledge(db: any, me: { id: string }, pledgeId: string, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  const { data: p } = await db.from('portal_horizon_pledges').select(PLEDGE_COLS).eq('id', pledgeId).eq('user_id', me.id).maybeSingle(); if (!p) return { ok: false, error: 'العهد غير موجود' };
  if ((p as Pledge).status !== 'active') return { ok: false, error: 'العهد ليس نشطًا' };
  const { error } = await db.from('portal_horizon_pledges').update({ status: 'revoked', revoked_at: now.toISOString() }).eq('id', pledgeId); if (error) return { ok: false, error: error.message };
  if ((p as Pledge).vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', (p as Pledge).vc_issuance_id).then(() => null, () => null);
  return { ok: true };
}
