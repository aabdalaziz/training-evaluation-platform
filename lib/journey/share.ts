// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** رحلة الممارس — النسخة القابلة للمشاركة: كشف انتقائي → وثيقة Ed25519 (ATH-J) → /journey/<code> · إلغاء · قراءة عامة */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { lower } from '../councils/registry';
import { JOURNEY_VERSION, SHARE_MONTHS, selectPublic, displayName, shareCode, addMonths } from './registry';
import type { Chapter, PublicChapter } from './registry';

export const SHARE_COLS = 'id,created_at,user_id,email,code,display_name,name_mode,chapter_keys,chapters,include_quotes,intro_ar,status,expires_at,revoked_at,views,vc_issuance_id,meta';
export type Share = { id: string; created_at: string; user_id: string; email: string; code: string; display_name: string; name_mode: 'full' | 'short'; chapter_keys: string[]; chapters: PublicChapter[]; include_quotes: boolean; intro_ar: string | null; status: 'active' | 'revoked' | 'expired'; expires_at: string; revoked_at: string | null; views: number; vc_issuance_id: string | null; meta: any };

export function buildJourneyDoc(inp: { code: string; name: string; chapters: PublicChapter[]; intro: string | null; site: string; did: string; now?: Date; expires: string; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar Practitioner Journey — رحلة الممارس',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), validUntil: inp.expires,
    credentialSubject: { type: ['AchievementSubject'], name: inp.name,
      achievement: { id: `${inp.site}/journey/${encodeURIComponent(inp.code)}`, type: ['Achievement'], name: `Practitioner Journey v${JOURNEY_VERSION} — ${inp.chapters.length} chapters`, achievementType: 'Badge',
        description: 'A selectively disclosed, chronologically ordered record of real learning events at Athar (daily cases answered in the holder’s own words, supervisor-confirmed workplace missions, peer-council cases and returns, approved peer attestations, human-approved skill levels and credentials). Each chapter is derived from a recorded event; nothing is self-asserted. The holder chose which chapters to disclose.',
        criteria: { narrative: inp.intro || 'Chapters are generated from recorded events only; the holder selected which to disclose.' } },
      result: inp.chapters.map(c => ({ type: ['Result'], resultDescription: c.key, value: c.at.slice(0, 10) })) },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'journey', code: inp.code, holder: inp.name, version: JOURNEY_VERSION, chapters: inp.chapters.map(c => ({ key: c.key, at: c.at, title_ar: c.title_ar, what_ar: c.what_ar, quote_ar: c.quote_ar, level: c.level })), intro_ar: inp.intro, public_url: `${inp.site}/journey/${encodeURIComponent(inp.code)}`, verify_url: url, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

export async function createShare(db: any, me: { id: string; email: string; name: string }, chapters: Chapter[], opt: { chapter_keys: string[]; name_mode: 'full' | 'short'; include_quotes: boolean; intro_ar: string | null }, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; share: Share; url: string; verify_url: string | null; signed_vc: boolean } | { ok: false; error: string }> {
  const pub = selectPublic(chapters, opt.chapter_keys, opt.include_quotes); if (!pub.length) return { ok: false, error: 'لا فصول قابلة للنشر في اختيارك' };
  const name = displayName(me.name, me.email, opt.name_mode); const code = shareCode(rnd); const expires = addMonths(now, SHARE_MONTHS);
  let vcId: string | null = null; let signedVc = false;
  if (signer) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'journey', credential_id: null, user_id: me.id, email: lower(me.email), full_name: name, title_ar: `رحلة الممارس — ${name}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: expires, issued_by: me.id }).select('id,status_index').single();
    if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
    const vc = await signDocument(buildJourneyDoc({ code, name, chapters: pub, intro: opt.intro_ar, site, did, now, expires, statusIndex: Number((ins as any).status_index) }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id); vcId = (ins as any).id; signedVc = true;
  }
  const row = { user_id: me.id, email: lower(me.email), code, display_name: name, name_mode: opt.name_mode, chapter_keys: pub.map(c => c.key), chapters: pub, include_quotes: opt.include_quotes, intro_ar: opt.intro_ar, status: 'active', expires_at: expires, vc_issuance_id: vcId, meta: { version: JOURNEY_VERSION } };
  const { data, error } = await db.from('portal_journey_shares').insert(row).select(SHARE_COLS).single(); if (error || !data) return { ok: false, error: error?.message || 'تعذّر حفظ النسخة' };
  await db.from('portal_learning_events').insert({ user_id: me.id, email: lower(me.email), verb: 'shared', object_type: 'journey', object_id: (data as any).id, skills: [], context: { code, chapters: pub.length, name_mode: opt.name_mode } }).then(() => null, () => null);
  return { ok: true, share: data as Share, url: `${site}/journey/${encodeURIComponent(code)}`, verify_url: signedVc ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null, signed_vc: signedVc };
}

export async function revokeShare(db: any, me: { id: string }, id: string, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  const { data: s } = await db.from('portal_journey_shares').select(SHARE_COLS).eq('id', id).eq('user_id', me.id).maybeSingle(); if (!s) return { ok: false, error: 'النسخة غير موجودة' };
  if ((s as Share).status !== 'active') return { ok: false, error: 'النسخة ملغاة أصلًا' };
  const { error } = await db.from('portal_journey_shares').update({ status: 'revoked', revoked_at: now.toISOString() }).eq('id', id); if (error) return { ok: false, error: error.message };
  if ((s as Share).vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', (s as Share).vc_issuance_id).then(() => null, () => null);
  return { ok: true };
}

export async function myShares(db: any, me: { id: string }): Promise<Share[]> {
  const { data } = await db.from('portal_journey_shares').select(SHARE_COLS).eq('user_id', me.id).order('created_at', { ascending: false }).limit(20); return ((data || []) as Share[]).map(normalize);
}
const normalize = (s: Share): Share => ({ ...s, chapters: Array.isArray(s.chapters) ? s.chapters : [], chapter_keys: Array.isArray(s.chapter_keys) ? s.chapter_keys : [] });

/** القراءة العامة بالرمز — فعّالة وغير منتهية فقط؛ تُحتسب المشاهدة */
export async function publicShare(db: any, code: string, site: string, now = Date.now(), countView = true): Promise<{ ok: true; journey: { code: string; name: string; intro_ar: string | null; chapters: PublicChapter[]; created_at: string; expires_at: string; version: string; verify_url: string | null; views: number } } | { ok: false; status: number; error: string }> {
  const c = String(code || '').trim().toUpperCase(); if (!/^ATH-J-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) return { ok: false, status: 400, error: 'رمز غير صالح' };
  const { data } = await db.from('portal_journey_shares').select(SHARE_COLS).eq('code', c).maybeSingle(); const s = data ? normalize(data as Share) : null;
  if (!s) return { ok: false, status: 404, error: 'لا رحلة بهذا الرمز' };
  if (s.status !== 'active') return { ok: false, status: 410, error: 'ألغى صاحب الرحلة هذه النسخة' };
  if (new Date(s.expires_at).getTime() <= now) return { ok: false, status: 410, error: 'انتهت صلاحية هذه النسخة' };
  if (countView) await db.from('portal_journey_shares').update({ views: (s.views || 0) + 1 }).eq('id', s.id).then(() => null, () => null);
  return { ok: true, journey: { code: s.code, name: s.display_name, intro_ar: s.intro_ar, chapters: s.chapters, created_at: s.created_at, expires_at: s.expires_at, version: String(s.meta?.version || JOURNEY_VERSION), verify_url: s.vc_issuance_id ? `${site}/verify/vc?code=${encodeURIComponent(s.code)}` : null, views: (s.views || 0) + (countView ? 1 : 0) } };
}
