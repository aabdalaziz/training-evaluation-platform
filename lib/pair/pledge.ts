// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** العهد المتقابل — الوثيقة الواحدة بتوقيعين (ATH-MP): تُصدَر حين يوقّع الطرفان · حاملان · لا بُرُد · الخطوتان والتاريخان فقط · تُسحب بنقرة من أيّ طرف */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { lower } from '../councils/registry';
import { PAIR_VERSION, PAIR_PLEDGE_DAYS, PAIR_COLS, PAIR_KIND_AR, CIRCLE_AR, addDays, pairCode, nameFor } from './registry';
import type { Pair, PairStep } from './registry';

export function buildPairDoc(inp: { code: string; aName: string; bName: string; aStep: PairStep; bStep: PairStep; circle_kind: 'council' | 'org'; site: string; did: string; now?: Date; expires: string; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`; const name = `${inp.aName} · ${inp.bName}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Mutual Pledge — العهد المتقابل',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), validUntil: inp.expires,
    credentialSubject: { type: ['AchievementSubject'], name,
      achievement: { id: `${inp.site}/me/pair`, type: ['Achievement'], name: `Mutual pledge (${inp.aStep.kind} ↔ ${inp.bStep.kind}) — one step each, for one year`, achievementType: 'Badge',
        description: 'A mutual pledge signed by two practitioners from one circle (a shared peer council or one organization) at Athar. Each asked the other for one concrete, platform-witnessable step for one year; each confirmed the step asked of them and signed. Both paths are derived from recorded events only; the two review together after 365 days. The words each wrote to the other are private and not part of this document.',
        criteria: { narrative: `${inp.aName}: «${inp.aStep.title_ar}» · ${inp.bName}: «${inp.bStep.title_ar}»` } },
      result: [{ type: ['Result'], resultDescription: 'holder_a_step', value: inp.aStep.kind }, { type: ['Result'], resultDescription: 'holder_b_step', value: inp.bStep.kind }, { type: ['Result'], resultDescription: 'circle', value: inp.circle_kind }, { type: ['Result'], resultDescription: 'review_at', value: inp.expires.slice(0, 10) }] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'pair_pledge', code: inp.code, holder: name, holders: [{ name: inp.aName, step: { kind: inp.aStep.kind, kind_ar: PAIR_KIND_AR[inp.aStep.kind], title_ar: inp.aStep.title_ar } }, { name: inp.bName, step: { kind: inp.bStep.kind, kind_ar: PAIR_KIND_AR[inp.bStep.kind], title_ar: inp.bStep.title_ar } }], circle: inp.circle_kind, circle_ar: CIRCLE_AR[inp.circle_kind], version: PAIR_VERSION, verify_url: url, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

/** يُستدعى حين يكتمل التوقيعان: يُصدر الوثيقة ويُفعّل العهد ويسجّل حدثًا لكل طرف */
export async function activatePair(db: any, p: Pair, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; pair: Pair; verify_url: string | null; signed_vc: boolean } | { ok: false; error: string }> {
  if (!p.a_step || !p.b_step) return { ok: false, error: 'الخطوتان غير مكتملتين' };
  const code = pairCode(rnd); const signedAt = now.toISOString(); const expires = addDays(now, PAIR_PLEDGE_DAYS); const aName = nameFor(p, 'a'), bName = nameFor(p, 'b');
  let vcId: string | null = null; let signedVc = false;
  if (signer) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'pair_pledge', credential_id: null, user_id: p.a_user_id, email: lower(p.a_email), full_name: `${aName} · ${bName}`, title_ar: `العهد المتقابل — ${aName} و${bName}`, kid: signer.kid, vc: {}, digest: '', issued_at: signedAt, expires_at: expires, issued_by: p.a_user_id }).select('id,status_index').single();
    if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
    const vc = await signDocument(buildPairDoc({ code, aName, bName, aStep: p.a_step, bStep: p.b_step, circle_kind: p.circle_kind, site, did, now, expires, statusIndex: Number((ins as any).status_index) }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id); vcId = (ins as any).id; signedVc = true;
  }
  const { data, error } = await db.from('portal_pair_pledges').update({ status: 'active', code, vc_issuance_id: vcId, signed_at: signedAt, expires_at: expires, review_at: expires, updated_at: signedAt, meta: { ...(p.meta || {}), chapters_then: p.meta?.chapters_then || null } }).eq('id', p.id).select(PAIR_COLS).single();
  if (error || !data) return { ok: false, error: error?.message || 'تعذّر تفعيل العهد' };
  const ctx = (side: 'a' | 'b') => { const s = side === 'a' ? p.a_step! : p.b_step!; return { code, kind: s.kind, title_ar: s.title_ar, circle: p.circle_kind, review_at: expires }; };
  await db.from('portal_learning_events').insert({ user_id: p.a_user_id, email: lower(p.a_email), verb: 'pledged', object_type: 'pair', object_id: p.id, skills: p.a_step.target.skill_id ? [p.a_step.target.skill_id] : [], context: ctx('a') }).then(() => null, () => null);
  if (p.b_user_id) await db.from('portal_learning_events').insert({ user_id: p.b_user_id, email: lower(p.b_email), verb: 'pledged', object_type: 'pair', object_id: p.id, skills: p.b_step.target.skill_id ? [p.b_step.target.skill_id] : [], context: ctx('b') }).then(() => null, () => null);
  return { ok: true, pair: data as Pair, verify_url: signedVc ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null, signed_vc: signedVc };
}

/** سحب العهد من أيّ طرف — تُسحب الوثيقة معه */
export async function revokePair(db: any, p: Pair, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  if (p.status !== 'active' && p.status !== 'review' && p.status !== 'proposing') return { ok: false, error: 'العهد ليس حيًّا' };
  const { error } = await db.from('portal_pair_pledges').update({ status: 'revoked', updated_at: now.toISOString(), meta: { ...(p.meta || {}), revoked_at: now.toISOString() } }).eq('id', p.id); if (error) return { ok: false, error: error.message };
  if (p.vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', p.vc_issuance_id).then(() => null, () => null);
  return { ok: true };
}
