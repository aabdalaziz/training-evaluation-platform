// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — محفظة القدرة السيادية (P17) — طبقة الخادم: مفاتيح Ed25519 (node:crypto فقط)، التوقيع، التحقق، قائمة الحالة
 *  • المفتاح الخاص: VC_SIGNING_KEY = بذرة Ed25519 (32 بايت) base64 — لا يُخزَّن في قاعدة البيانات أبدًا.
 *  • kid = did:web:<host>#<publicKeyMultibase> (تدوير المفتاح يغيّر kid؛ المفاتيح القديمة تبقى منشورة في did.json للتحقق من الماضي).
 */
import { createPrivateKey, createPublicKey, createHash, randomBytes, sign as edSign, verify as edVerify, type KeyObject } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { CRYPTOSUITE, b64url, b64urlDecode, bitAt, bitstring, buildStatusListDoc, decodeProofValue, didWeb, documentDigest, encodeProofValue, hashDataToSign, multikey, multikeyToRaw, structuralChecks, summarize, type Proof, type VerifyCheck, type VerifyResult } from './vc';

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
export const sha256: (d: Uint8Array) => Promise<Uint8Array> = async d => new Uint8Array(createHash('sha256').update(d).digest());

export type Signer = { priv: KeyObject; pub: Uint8Array; multibase: string; did: string; kid: string; site: string };
export function keyFromSeed(seedB64: string): { priv: KeyObject; pub: Uint8Array; multibase: string } {
  const seed = Buffer.from(String(seedB64 || '').trim(), 'base64'); if (seed.length !== 32) throw new Error('VC_SIGNING_KEY يجب أن يكون بذرة Ed25519 من 32 بايت بترميز base64');
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(priv).export({ format: 'der', type: 'spki' }) as Buffer; const pub = new Uint8Array(spki.subarray(spki.length - 32));
  return { priv, pub, multibase: multikey(pub) };
}
export const generateSeed = () => randomBytes(32).toString('base64');
export function publicKeyObject(raw: Uint8Array): KeyObject { return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(raw)]), format: 'der', type: 'spki' }); }
export function signerFromEnv(env: NodeJS.ProcessEnv, site: string): Signer | null {
  const seed = env.VC_SIGNING_KEY; if (!seed) return null; const k = keyFromSeed(seed); const did = didWeb(site); return { ...k, did, kid: `${did}#${k.multibase}`, site };
}
export const vcConfigured = (env: NodeJS.ProcessEnv) => !!env.VC_SIGNING_KEY;

export async function signDocument<T extends Record<string, any>>(doc: T, s: Signer, created = new Date()): Promise<T & { proof: Proof }> {
  const options: Omit<Proof, 'proofValue'> = { type: 'DataIntegrityProof', cryptosuite: CRYPTOSUITE, created: created.toISOString(), verificationMethod: s.kid, proofPurpose: 'assertionMethod' };
  const data = await hashDataToSign(doc, options, sha256); const sig = edSign(null, Buffer.from(data), s.priv);
  const { proof: _old, ...unsecured } = doc as any; return { ...unsecured, proof: { ...options, proofValue: encodeProofValue(new Uint8Array(sig)) } };
}

export type KeyResolver = (verificationMethod: string) => Promise<string | null>; // → publicKeyMultibase
/** يتحقق من التوقيع فقط (البنية + المفتاح + Ed25519) — الحالة تُفحص على حدة */
export async function verifySignature(doc: any, resolve: KeyResolver): Promise<VerifyCheck> {
  try {
    const p = doc?.proof; const mb = await resolve(String(p?.verificationMethod || '')); if (!mb) return { key: 'signature', ok: false, ar: 'مفتاح التوقيع غير منشور لدى المُصدِر', en: 'Verification key not published by the issuer' };
    const raw = multikeyToRaw(mb); const data = await hashDataToSign(doc, { type: p.type, cryptosuite: p.cryptosuite, created: p.created, verificationMethod: p.verificationMethod, proofPurpose: p.proofPurpose }, sha256);
    const ok = edVerify(null, Buffer.from(data), publicKeyObject(raw), Buffer.from(decodeProofValue(String(p.proofValue))));
    return { key: 'signature', ok, ar: ok ? 'التوقيع صحيح — الوثيقة لم تُعدَّل منذ توقيعها' : 'التوقيع غير صحيح — الوثيقة عُدِّلت أو لم توقَّع بهذا المفتاح', en: ok ? 'Signature valid — document unmodified' : 'Invalid signature — modified or not signed by this key' };
  } catch (e: any) { return { key: 'signature', ok: false, ar: `تعذّر التحقق: ${e?.message || e}`, en: `Verification failed: ${e?.message || e}` }; }
}
export async function verifyDocument(doc: any, resolve: KeyResolver, status: (doc: any) => Promise<VerifyCheck | null>, now = new Date()): Promise<VerifyResult> {
  const checks = structuralChecks(doc, now); const structOk = checks.filter(c => c.key !== 'validity').every(c => c.ok);
  if (structOk) checks.push(await verifySignature(doc, resolve)); else checks.push({ key: 'signature', ok: false, ar: 'لم يُفحص التوقيع لخلل في البنية', en: 'Signature not checked (structure)' });
  const st = await status(doc); if (st) checks.push(st);
  return { ok: checks.every(c => c.ok !== false), checks, summary: structOk ? summarize(doc) : null };
}

// ---------- قائمة الحالة ----------
export function encodeStatusList(revoked: number[]): string { return 'u' + b64url(new Uint8Array(gzipSync(Buffer.from(bitstring(revoked))))); }
export function decodeStatusList(encoded: string): Uint8Array { const s = String(encoded || ''); const body = s.startsWith('u') ? s.slice(1) : s; return new Uint8Array(gunzipSync(Buffer.from(b64urlDecode(body)))); }
export const statusBit = (encoded: string, index: number) => bitAt(decodeStatusList(encoded), index);
export async function signedStatusList(revoked: number[], s: Signer, now = new Date()) { return signDocument(buildStatusListDoc(s.site, s.did, encodeStatusList(revoked), now), s, now); }

/** محلّل مفاتيح محلي: يقبل المفتاح الحالي من البيئة + المفاتيح المنشورة في الجدول (بما فيها المتقاعدة) */
export function localResolver(current: Signer | null, published: { kid: string; public_key_multibase: string }[]): KeyResolver {
  return async vm => { if (current && vm === current.kid) return current.multibase; const row = published.find(k => k.kid === vm); if (row) return row.public_key_multibase; const i = vm.indexOf('#'); const frag = i >= 0 ? vm.slice(i + 1) : ''; return /^z6Mk/.test(frag) && published.some(k => k.public_key_multibase === frag) ? frag : null; };
}

// ---------- التخزين (Supabase عبر مفتاح الخدمة) ----------
export const SKILL_META_COLS = 'id,code,name_ar,name_en,saqf_level,cefr_level,sdaia_code';
/** يسجّل المفتاح الحالي في الجدول (مرة) ويُقاعد غيره — حتى تبقى كل المفاتيح منشورة في did.json */
export async function ensureKeyRow(db: any, s: Signer): Promise<void> {
  const { data } = await db.from('portal_signing_keys').select('kid,retired_at').limit(50); const rows = (data || []) as { kid: string; retired_at: string | null }[];
  if (!rows.some(r => r.kid === s.kid)) await db.from('portal_signing_keys').insert({ kid: s.kid, public_key_multibase: s.multibase, note: 'VC_SIGNING_KEY' });
  const now = new Date().toISOString(); for (const r of rows) if (r.kid !== s.kid && !r.retired_at) await db.from('portal_signing_keys').update({ retired_at: now }).eq('kid', r.kid);
  if (rows.some(r => r.kid === s.kid && r.retired_at)) await db.from('portal_signing_keys').update({ retired_at: null }).eq('kid', s.kid);
}
/** يوقّع شهادة ويخزّن الإصدار (صف واحد لكل شهادة؛ إعادة التوقيع تُحدّثه وتُبقي status_index) */
export async function signAndStoreCredential(db: any, c: any, s: Signer, buildDoc: (statusIndex: number | null) => Record<string, any>, issuedBy?: string | null): Promise<{ vc: any; code: string; id: string }> {
  const { data: existing } = await db.from('portal_vc_issuances').select('id,status_index,code').eq('credential_id', c.id).maybeSingle();
  let row = existing as { id: string; status_index: number; code: string } | null;
  if (!row) {
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code: c.verify_code, kind: 'credential', credential_id: c.id, user_id: c.user_id || null, email: c.email, full_name: c.full_name || null, title_ar: c.title_ar, kid: s.kid, vc: {}, digest: '', issued_at: c.issued_at, expires_at: c.valid_until || null, issued_by: issuedBy || null }).select('id,status_index,code').single();
    if (error) throw new Error(error.message); row = ins as any;
  }
  const vc = await signDocument(buildDoc(row!.status_index), s); const digest = await documentDigest(vc, sha256);
  const { error: e2 } = await db.from('portal_vc_issuances').update({ vc, digest, kid: s.kid, issued_at: new Date().toISOString(), revoked_at: c.revoked_at || null }).eq('id', row!.id); if (e2) throw new Error(e2.message);
  await db.from('portal_credentials').update({ vc_kid: s.kid, vc_signed_at: new Date().toISOString() }).eq('id', c.id);
  return { vc, code: row!.code, id: row!.id };
}
