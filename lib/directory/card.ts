// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هيئة أَثَر (P31) — الوثائق الموقَّعة Ed25519:
 *  - «شهادة توثيق عضو هيئة أَثَر» ATH-EX (خبير استشاري) / ATH-TR (مدرب): تصدر عند اعتماد الطاقم — بلا انتهاء، تُسحب عند الإيقاف. تحمل الاسم والوجه والمجالات وتاريخ الاعتماد وأعداد «ما شهده أَثَر» يومها. لا بريد.
 *  - «عقد تعاون» ATH-CO: وثيقة واحدة بحاملَين (عضو الهيئة + أَثَر) تصدر حين يوقّع العضو ويوقّع أَثَر بصفته — تحمل العنوان والنطاق والمدة والطرفين، ولا تحمل الأجر.
 */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { BRAND } from '../portal/content';
import { FACE_AR, cardCode, collabCode, witnessCounts, lower } from './registry';
import type { Profile, Face, Engagement, WitnessFacts } from './registry';

export function buildCardDoc(inp: { code: string; face: Face; profile: Pick<Profile, 'name_ar' | 'name_en' | 'title_ar' | 'skill_names' | 'sectors' | 'services' | 'slug'>; facts: WitnessFacts; site: string; did: string; now?: Date; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`; const page = `${inp.site}/${inp.face === 'expert' ? 'experts' : 'trainers'}/${inp.profile.slug || ''}`; const counts = witnessCounts(inp.facts);
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: inp.face === 'expert' ? 'Athar Faculty — Consulting Expert · عضو هيئة أَثَر — خبير استشاري' : 'Athar Faculty — Trainer · عضو هيئة أَثَر — مدرب',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(),
    credentialSubject: { type: ['AchievementSubject'], name: inp.profile.name_ar,
      achievement: { id: page, type: ['Achievement'], name: `Member of the Athar Faculty (${inp.face}) — ${inp.profile.title_ar}`, achievementType: 'Membership',
        description: 'Athar staff reviewed this person’s self-documented CV (summary, achievements, education, experience, certifications, publications) and approved their listing in the Athar Faculty directory. The platform-witnessed record (programs delivered, peer councils chaired, attestations and levels approved, missions confirmed, collaboration engagements completed) is derived from recorded events and is never self-reported.',
        criteria: { narrative: `${inp.profile.title_ar} · ${inp.profile.skill_names.slice(0, 5).join(' · ')}` } },
      result: [{ type: ['Result'], resultDescription: 'face', value: inp.face }, { type: ['Result'], resultDescription: 'expertise', value: inp.profile.skill_names.join(' | ') }, { type: ['Result'], resultDescription: 'sectors', value: inp.profile.sectors.join(' | ') }, { type: ['Result'], resultDescription: 'witnessed', value: JSON.stringify(counts) }] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'directory_card', code: inp.code, holder: inp.profile.name_ar, face: inp.face, face_ar: FACE_AR[inp.face], title_ar: inp.profile.title_ar, skills: inp.profile.skill_names, sectors: inp.profile.sectors, services: inp.profile.services, witnessed: counts, approved_at: now.toISOString().slice(0, 10), page },
  };
}

export type IssuedCard = { code: string; vc_issuance_id: string | null; issued_at: string };
/** يُصدر بطاقة وجه واحد (يستدعيه الاعتماد لكل وجه مختار) */
export async function issueCard(db: any, p: Profile, face: Face, facts: WitnessFacts, signer: Signer | null, site: string, did: string, rnd: () => string, approvedBy: string | null, now = new Date()): Promise<{ ok: true; card: IssuedCard } | { ok: false; error: string }> {
  const code = cardCode(face, rnd); const issuedAt = now.toISOString();
  if (!signer) return { ok: true, card: { code, vc_issuance_id: null, issued_at: issuedAt } };
  const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'directory_card', credential_id: null, user_id: p.user_id, email: lower(p.email), full_name: p.name_ar, title_ar: `شهادة توثيق عضو هيئة أَثَر — ${FACE_AR[face]} — ${p.name_ar}`, kid: signer.kid, vc: {}, digest: '', issued_at: issuedAt, expires_at: null, issued_by: approvedBy || p.user_id }).select('id,status_index').single();
  if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الشهادة' };
  const vc = await signDocument(buildCardDoc({ code, face, profile: p, facts, site, did, now, statusIndex: Number((ins as any).status_index) }), signer, now);
  await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id);
  return { ok: true, card: { code, vc_issuance_id: (ins as any).id, issued_at: issuedAt } };
}
export async function revokeCards(db: any, p: Profile, now = new Date()): Promise<void> {
  for (const c of [p.card_expert, p.card_trainer]) if (c?.vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', c.vc_issuance_id).then(() => null, () => null);
}

export function buildCollabDoc(inp: { code: string; e: Pick<Engagement, 'kind' | 'title_ar' | 'scope_ar' | 'deliverables' | 'start_at' | 'end_at' | 'mode'>; memberName: string; site: string; did: string; now?: Date; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`; const athar = `${BRAND.name.ar} — ${BRAND.legal.ar}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Collaboration Agreement — عقد تعاون مع أَثَر',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), ...(inp.e.end_at ? { validUntil: `${inp.e.end_at}T23:59:59.000Z` } : {}),
    credentialSubject: { type: ['AchievementSubject'], name: `${inp.memberName} · ${athar}`,
      achievement: { id: `${inp.site}/me/directory`, type: ['Achievement'], name: `Collaboration agreement (${inp.e.kind}) — ${inp.e.title_ar}`, achievementType: 'Badge',
        description: 'A per-assignment collaboration agreement between a member of the Athar Faculty and Athar (CenterGate for Excellence). The member signed by name; Athar signed in its capacity. Scope, deliverables and dates are recorded here; the fee is agreed per project and is never part of this document.',
        criteria: { narrative: `${inp.e.title_ar} — ${inp.e.scope_ar.slice(0, 400)}` } },
      result: [{ type: ['Result'], resultDescription: 'kind', value: inp.e.kind }, { type: ['Result'], resultDescription: 'period', value: `${inp.e.start_at || '—'} → ${inp.e.end_at || '—'}` }, { type: ['Result'], resultDescription: 'deliverables', value: String(inp.e.deliverables.length) }] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'collaboration', code: inp.code, holder: `${inp.memberName} · ${athar}`, holders: [{ name: inp.memberName, role: 'faculty_member' }, { name: athar, role: 'athar', signed_as_ar: 'بصفتها' }], title_ar: inp.e.title_ar, kind_ar: inp.e.kind === 'train' ? 'تدريب' : 'استشارة', mode: inp.e.mode, start_at: inp.e.start_at, end_at: inp.e.end_at, deliverables: inp.e.deliverables },
  };
}
/** توقيع العضو → توقيع أَثَر بصفته → الوثيقة → العقد جارٍ */
export async function signEngagement(db: any, e: Engagement, p: Profile, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; engagement: Engagement; verify_url: string | null } | { ok: false; error: string }> {
  const code = collabCode(rnd); const iso = now.toISOString(); let vcId: string | null = null;
  if (signer) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'collaboration', credential_id: null, user_id: p.user_id, email: lower(p.email), full_name: `${p.name_ar} · ${BRAND.name.ar}`, title_ar: `عقد تعاون — ${e.title_ar}`, kid: signer.kid, vc: {}, digest: '', issued_at: iso, expires_at: e.end_at ? `${e.end_at}T23:59:59.000Z` : null, issued_by: p.user_id }).select('id,status_index').single();
    if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار وثيقة العقد' };
    const vc = await signDocument(buildCollabDoc({ code, e, memberName: p.name_ar, site, did, now, statusIndex: Number((ins as any).status_index) }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id); vcId = (ins as any).id;
  }
  const { data, error } = await db.from('portal_directory_engagements').update({ status: 'active', member_signed_at: iso, athar_signed_at: iso, code, vc_issuance_id: vcId, updated_at: iso }).eq('id', e.id).select('*').single();
  if (error || !data) return { ok: false, error: error?.message || 'تعذّر حفظ التوقيع' };
  return { ok: true, engagement: data as Engagement, verify_url: vcId ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null };
}
export async function revokeEngagementDoc(db: any, e: Engagement, now = new Date()) { if (e.vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', e.vc_issuance_id).then(() => null, () => null); }
