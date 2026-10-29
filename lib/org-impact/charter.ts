// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «ميثاق الجهة» (P24) — خادم فقط: توقيع الجهة السنوي على تعهّداتها تجاه منسوبيها في مجالس أَثَر
 *  وثيقة Open Badges 3.0 موقَّعة Ed25519 بمفتاح أَثَر نفسه (did:web) — تُتحقق من /verify/vc?code=ATH-OC-… مثل أي شهادة أَثَر.
 *  الحامل هو الجهة (لا شخص)؛ ويُذكر الموقِّع بصفته فقط. الإلغاء يُعلِّم صف الإصدار (revoked_at) فتفشل قائمة الحالة.
 */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { ORG_CHARTER_AR, ORG_CHARTER_VERSION, ORG_CHARTER_MONTHS, ORG_CHARTER_COLS, charterCode, charterState, addMonths, publicCharter } from './registry';
import type { OrgCharter } from './registry';

export type OrgLite = { id: string; name_ar: string; name_en?: string | null; sector?: string | null };

export function buildOrgCharterDoc(inp: { code: string; org: OrgLite; signer_title: string | null; site: string; did: string; now?: Date; expires: string; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Organization Charter — ميثاق الجهة في مجالس أَثَر',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), validUntil: inp.expires,
    credentialSubject: { type: ['AchievementSubject'], name: inp.org.name_ar, identifier: [{ type: 'IdentityObject', identityType: 'identifier', hashed: false, identityHash: inp.org.id }],
      achievement: { id: `${inp.site}/councils#org-charter`, type: ['Achievement'], name: `Organization Charter v${ORG_CHARTER_VERSION}`, achievementType: 'Badge',
        description: 'The organization pledged, for one year, that its people may take part in Athar peer councils inside working hours, that council confidentiality is respected (Chatham House rule), that council mirrors, deliberations and peer attestations are never used in performance appraisal, promotion or sanction, and that it will not ask for names behind anonymized organization echo (k ≥ 5).',
        criteria: { narrative: ORG_CHARTER_AR.map(c => `${c.title}: ${c.body}`).join(' | ') } },
      result: ORG_CHARTER_AR.map(c => ({ type: ['Result'], resultDescription: c.id, value: 'pledged' })) },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'org_charter', code: inp.code, holder: inp.org.name_ar, organization_id: inp.org.id, signer_title: inp.signer_title, version: ORG_CHARTER_VERSION, verify_url: url, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

export async function currentCharter(db: any, orgId: string): Promise<OrgCharter | null> {
  const { data } = await db.from('portal_org_charters').select(ORG_CHARTER_COLS).eq('organization_id', orgId).order('signed_at', { ascending: false }).limit(1);
  const row = ((data || []) as OrgCharter[])[0] || null; return row ? { ...row, clauses: Array.isArray(row.clauses) ? row.clauses : [] } : null;
}

/** توقيع الميثاق — مدير جهة مؤكَّد (أو الطاقم نيابةً مع ذكر ذلك). إن وُجد ميثاق فعّال يُجدَّد (الجديد يسري من اليوم، والقديم يُعلَّم expired) */
export async function signCharter(db: any, org: OrgLite, who: { id: string; email: string; name: string; title: string | null; staff?: boolean }, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; charter: OrgCharter; verify_url: string | null; signed_vc: boolean } | { ok: false; error: string }> {
  const prev = await currentCharter(db, org.id); const st = charterState(prev, now.getTime());
  if (prev && st.signed && !st.renew_soon) return { ok: false, error: `ميثاق جهتكم فعّال حتى ${prev.expires_at.slice(0, 10)} — يُجدَّد في آخر 30 يومًا منه` };
  const expires = addMonths(now, ORG_CHARTER_MONTHS); const code = charterCode(rnd);
  let vcId: string | null = null; let signedVc = false;
  if (signer) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'org_charter', credential_id: null, user_id: null, email: null, full_name: org.name_ar, title_ar: `ميثاق الجهة — ${org.name_ar}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: expires, issued_by: who.id }).select('id,status_index').single();
    if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
    const vc = await signDocument(buildOrgCharterDoc({ code, org, signer_title: who.title, site, did, now, expires, statusIndex: Number((ins as any).status_index) }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id); vcId = (ins as any).id; signedVc = true;
  }
  const row = { organization_id: org.id, version: ORG_CHARTER_VERSION, clauses: ORG_CHARTER_AR.map(c => ({ id: c.id, title: c.title })), signer_user_id: who.id, signer_email: who.email, signer_name: who.name || null, signer_title: who.title, signed_at: now.toISOString(), expires_at: expires, status: 'active', vc_code: signedVc ? code : null, vc_issuance_id: vcId, meta: { by_staff: !!who.staff, renewed_from: prev?.id || null } };
  const { data, error } = await db.from('portal_org_charters').insert(row).select(ORG_CHARTER_COLS).single(); if (error || !data) return { ok: false, error: error?.message || 'تعذّر حفظ الميثاق' };
  if (prev && prev.status === 'active') await db.from('portal_org_charters').update({ status: 'expired' }).eq('id', prev.id).then(() => null, () => null);
  await db.from('portal_learning_events').insert({ user_id: who.id, email: who.email, verb: 'signed', object_type: 'org_charter', object_id: (data as any).id, skills: [], context: { organization_id: org.id, code: signedVc ? code : null, version: ORG_CHARTER_VERSION } }).then(() => null, () => null);
  return { ok: true, charter: data as OrgCharter, verify_url: signedVc ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null, signed_vc: signedVc };
}

export async function revokeCharter(db: any, orgId: string, who: { id: string }, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  const cur = await currentCharter(db, orgId); if (!cur || cur.status !== 'active') return { ok: false, error: 'لا ميثاق فعّالًا' };
  const { error } = await db.from('portal_org_charters').update({ status: 'revoked', revoked_at: now.toISOString(), revoked_by: who.id }).eq('id', cur.id); if (error) return { ok: false, error: error.message };
  if (cur.vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', cur.vc_issuance_id).then(() => null, () => null);
  return { ok: true };
}

/** الشارات العامة: الجهات الموقِّعة الفعّالة — أسماء الجهات فقط */
export async function charterBadges(db: any, now = Date.now()): Promise<ReturnType<typeof publicCharter>[]> {
  const { data } = await db.from('portal_org_charters').select(ORG_CHARTER_COLS).eq('status', 'active').gt('expires_at', new Date(now).toISOString()).order('signed_at', { ascending: false }).limit(500);
  const rows = ((data || []) as OrgCharter[]).map(r => ({ ...r, clauses: Array.isArray(r.clauses) ? r.clauses : [] })); if (!rows.length) return [];
  const latest = new Map<string, OrgCharter>(); for (const r of rows) if (!latest.has(r.organization_id)) latest.set(r.organization_id, r);
  const { data: orgs } = await db.from('portal_organizations').select('id,name_ar').in('id', Array.from(latest.keys())); const names = new Map(((orgs || []) as any[]).map(o => [o.id, o.name_ar]));
  return Array.from(latest.values()).map(c => publicCharter(c, names.get(c.organization_id) || 'جهة')).sort((a, b) => a.signed_at < b.signed_at ? 1 : -1);
}

/** هل جهة هذا الشخص موقِّعة؟ (للمنسوب في /me/council والوكلاء) */
export async function charterForPerson(db: any, me: { id: string; email: string }): Promise<{ organization_id: string; org_name: string; signed: boolean; expires_at: string | null; code: string | null } | null> {
  const { data: om } = await db.from('portal_org_members').select('organization_id').eq('status', 'confirmed').or(`email.ilike.${me.email},user_id.eq.${me.id}`).limit(1);
  const orgId = ((om || []) as any[])[0]?.organization_id; if (!orgId) return null;
  const [{ data: o }, c] = await Promise.all([db.from('portal_organizations').select('id,name_ar').eq('id', orgId).maybeSingle(), currentCharter(db, orgId)]);
  const st = charterState(c); return { organization_id: orgId, org_name: (o as any)?.name_ar || 'جهتك', signed: st.signed, expires_at: st.signed ? c!.expires_at : null, code: st.signed ? c!.vc_code : null };
}
