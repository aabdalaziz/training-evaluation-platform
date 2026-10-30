// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** رحلة الجهة — «كتاب السنة»: فصول مختارة (أعداد لا أسماء) → وثيقة Ed25519 (ATH-OY) → /org-journey/<code> · إلغاء · قراءة عامة · قائمة الكتب في المجالس */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { lower } from '../councils/registry';
import { ORG_JOURNEY_VERSION, ORG_SHARE_MONTHS, ORG_SHARE_CODE_PREFIX, selectOrgPublic, orgShareCode, addMonths } from './registry';
import type { OrgChapter, OrgPublicChapter } from './registry';
import type { OrgLite } from '../org-impact/charter';

export const ORG_SHARE_COLS = 'id,created_at,organization_id,org_name,code,year_label,chapter_keys,chapters,intro_ar,status,expires_at,revoked_at,views,vc_issuance_id,published_by,published_email,show_in_councils,meta';
export type OrgShare = { id: string; created_at: string; organization_id: string; org_name: string; code: string; year_label: string; chapter_keys: string[]; chapters: OrgPublicChapter[]; intro_ar: string | null; status: 'active' | 'revoked' | 'expired'; expires_at: string; revoked_at: string | null; views: number; vc_issuance_id: string | null; published_by: string | null; published_email: string | null; show_in_councils: boolean; meta: any };
export type Yearbook = { code: string; org_name: string; year_label: string; intro_ar: string | null; chapters: OrgPublicChapter[]; created_at: string; expires_at: string; version: string; verify_url: string | null; views: number; k: number };

export function buildOrgJourneyDoc(inp: { code: string; org: OrgLite; year_label: string; chapters: OrgPublicChapter[]; intro: string | null; site: string; did: string; now?: Date; expires: string; statusIndex: number | null; k: number }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`; const pub = `${inp.site}/org-journey/${encodeURIComponent(inp.code)}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Organization Yearbook — كتاب السنة',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), validUntil: inp.expires,
    credentialSubject: { type: ['AchievementSubject'], name: inp.org.name_ar,
      achievement: { id: pub, type: ['Achievement'], name: `Organization Yearbook ${inp.year_label} v${ORG_JOURNEY_VERSION} — ${inp.chapters.length} chapters`, achievementType: 'Badge',
        description: `A selectively disclosed, chronological record of what an organization's confirmed members collectively learned at Athar in a year. Every chapter aggregates a recorded event kind over a quarter and is published only when at least ${inp.k} distinct people took part (k-anonymity); it carries counts and the organization's own words — never names, never individual texts. Nothing is self-asserted; the organization chose which chapters to disclose.`,
        criteria: { narrative: inp.intro || 'Chapters are derived from recorded events of confirmed members only (k ≥ 5 per chapter); the organization selected which to disclose.' } },
      result: inp.chapters.map(c => ({ type: ['Result'], resultDescription: c.key, value: c.people === null ? c.at.slice(0, 10) : String(c.people) })) },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'org_journey', code: inp.code, holder: inp.org.name_ar, organization_id: inp.org.id, year_label: inp.year_label, k: inp.k, version: ORG_JOURNEY_VERSION, chapters: inp.chapters.map(c => ({ key: c.key, kind: c.kind, quarter: c.quarter, at: c.at, people: c.people, title_ar: c.title_ar, what_ar: c.what_ar, note_ar: c.note_ar })), intro_ar: inp.intro, public_url: pub, verify_url: url, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

export async function createOrgShare(db: any, org: OrgLite, who: { id: string; email: string }, chapters: OrgChapter[], notes: Record<string, string>, opt: { chapter_keys: string[]; intro_ar: string | null; year_label: string; show_in_councils: boolean }, signer: Signer | null, site: string, did: string, rnd: () => string, k: number, now = new Date()): Promise<{ ok: true; share: OrgShare; url: string; verify_url: string | null; signed_vc: boolean } | { ok: false; error: string }> {
  const pub = selectOrgPublic(chapters, opt.chapter_keys, notes); if (!pub.length) return { ok: false, error: 'لا فصول قابلة للنشر في اختياركم' };
  const code = orgShareCode(rnd); const expires = addMonths(now, ORG_SHARE_MONTHS);
  let vcId: string | null = null; let signedVc = false;
  if (signer) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'org_journey', credential_id: null, user_id: null, email: null, full_name: org.name_ar, title_ar: `كتاب السنة ${opt.year_label} — ${org.name_ar}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: expires, issued_by: who.id }).select('id,status_index').single();
    if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
    const vc = await signDocument(buildOrgJourneyDoc({ code, org, year_label: opt.year_label, chapters: pub, intro: opt.intro_ar, site, did, now, expires, statusIndex: Number((ins as any).status_index), k }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id); vcId = (ins as any).id; signedVc = true;
  }
  const row = { organization_id: org.id, org_name: org.name_ar, code, year_label: opt.year_label, chapter_keys: pub.map(c => c.key), chapters: pub, intro_ar: opt.intro_ar, status: 'active', expires_at: expires, vc_issuance_id: vcId, published_by: who.id, published_email: lower(who.email), show_in_councils: opt.show_in_councils, meta: { version: ORG_JOURNEY_VERSION, k } };
  const { data, error } = await db.from('portal_org_journey_shares').insert(row).select(ORG_SHARE_COLS).single(); if (error || !data) return { ok: false, error: error?.message || 'تعذّر حفظ الكتاب' };
  return { ok: true, share: normalize(data as OrgShare), url: `${site}/org-journey/${encodeURIComponent(code)}`, verify_url: signedVc ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null, signed_vc: signedVc };
}

export async function revokeOrgShare(db: any, orgId: string, id: string, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  const { data: s } = await db.from('portal_org_journey_shares').select(ORG_SHARE_COLS).eq('id', id).eq('organization_id', orgId).maybeSingle(); if (!s) return { ok: false, error: 'الكتاب غير موجود' };
  if ((s as OrgShare).status !== 'active') return { ok: false, error: 'الكتاب ملغى أصلًا' };
  const { error } = await db.from('portal_org_journey_shares').update({ status: 'revoked', revoked_at: now.toISOString() }).eq('id', id); if (error) return { ok: false, error: error.message };
  if ((s as OrgShare).vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', (s as OrgShare).vc_issuance_id).then(() => null, () => null);
  return { ok: true };
}

export async function orgShares(db: any, orgId: string): Promise<OrgShare[]> {
  const { data } = await db.from('portal_org_journey_shares').select(ORG_SHARE_COLS).eq('organization_id', orgId).order('created_at', { ascending: false }).limit(20); return ((data || []) as OrgShare[]).map(normalize);
}
const normalize = (s: OrgShare): OrgShare => ({ ...s, chapters: Array.isArray(s.chapters) ? s.chapters : [], chapter_keys: Array.isArray(s.chapter_keys) ? s.chapter_keys : [] });
const toYearbook = (s: OrgShare, site: string, views: number): Yearbook => ({ code: s.code, org_name: s.org_name, year_label: s.year_label, intro_ar: s.intro_ar, chapters: s.chapters, created_at: s.created_at, expires_at: s.expires_at, version: String(s.meta?.version || ORG_JOURNEY_VERSION), verify_url: s.vc_issuance_id ? `${site}/verify/vc?code=${encodeURIComponent(s.code)}` : null, views, k: Number(s.meta?.k || 5) });

/** القراءة العامة بالرمز — فعّال وغير منتهٍ فقط؛ تُحتسب المشاهدة */
export async function publicYearbook(db: any, code: string, site: string, now = Date.now(), countView = true): Promise<{ ok: true; yearbook: Yearbook } | { ok: false; status: number; error: string }> {
  const c = String(code || '').trim().toUpperCase(); if (!new RegExp(`^${ORG_SHARE_CODE_PREFIX}-[A-Z0-9]{4}-[A-Z0-9]{4}$`).test(c)) return { ok: false, status: 400, error: 'رمز غير صالح' };
  const { data } = await db.from('portal_org_journey_shares').select(ORG_SHARE_COLS).eq('code', c).maybeSingle(); const s = data ? normalize(data as OrgShare) : null;
  if (!s) return { ok: false, status: 404, error: 'لا كتاب بهذا الرمز' };
  if (s.status !== 'active') return { ok: false, status: 410, error: 'سحبت الجهة هذا الكتاب' };
  if (new Date(s.expires_at).getTime() <= now) return { ok: false, status: 410, error: 'انتهت صلاحية هذا الكتاب' };
  if (countView) await db.from('portal_org_journey_shares').update({ views: (s.views || 0) + 1 }).eq('id', s.id).then(() => null, () => null);
  return { ok: true, yearbook: toYearbook(s, site, (s.views || 0) + (countView ? 1 : 0)) };
}

/** رفّ الكتب العامة (صفحة المجالس): الكتب الفعّالة التي اختارت جهاتها الظهور — آخر كتاب لكل جهة */
export async function publicYearbooks(db: any, site: string, now = Date.now(), limit = 24): Promise<Yearbook[]> {
  const { data } = await db.from('portal_org_journey_shares').select(ORG_SHARE_COLS).eq('status', 'active').eq('show_in_councils', true).gt('expires_at', new Date(now).toISOString()).order('created_at', { ascending: false }).limit(200);
  const seen = new Set<string>(); const out: Yearbook[] = [];
  for (const raw of ((data || []) as OrgShare[])) { if (seen.has(raw.organization_id)) continue; seen.add(raw.organization_id); out.push(toYearbook(normalize(raw), site, raw.views || 0)); if (out.length >= limit) break; }
  return out;
}
