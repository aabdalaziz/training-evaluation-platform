// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — محفظة القدرة السيادية (P17) — الطبقة النقية (تعمل في المتصفح والخادم معًا؛ لا node:crypto هنا)
 *  • JCS (RFC 8785) تقنين JSON · base58btc · Multikey (Ed25519) · did:web
 *  • Data Integrity Proof بـ cryptosuite «eddsa-jcs-2022»: بيانات التوقيع = sha256(تهيئة الإثبات) || sha256(الوثيقة بلا إثبات)
 *  • بناء الوثائق: شهادة (Open Badges 3.0 / VC 2.0) · «لقطة قدرة» موقَّعة · قائمة حالة (Bitstring Status List)
 *  التحقق في المتصفح يستخدم WebCrypto؛ التوقيع في الخادم عبر vc-server.ts.
 */
import type { Credential } from './profile';
import type { Skill } from './skills';

export const CRYPTOSUITE = 'eddsa-jcs-2022';
export const VC_CONTEXTS = ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'];
export const SNAPSHOT_DAYS = 90;
export const STATUS_LIST_BITS = 131072; // الحد الأدنى في المعيار (16 KB)
export type Sha256 = (data: Uint8Array) => Promise<Uint8Array>;
export type Proof = { type: 'DataIntegrityProof'; cryptosuite: string; created: string; verificationMethod: string; proofPurpose: 'assertionMethod'; proofValue: string };

// ---------- JCS (RFC 8785) ----------
export function jcs(v: any): string {
  if (v === null || typeof v === 'boolean') return String(v);
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('JCS: non-finite number'); return JSON.stringify(v); }
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(x => (x === undefined ? 'null' : jcs(x))).join(',') + ']';
  if (typeof v === 'object') { const keys = Object.keys(v).filter(k => v[k] !== undefined).sort(); return '{' + keys.map(k => JSON.stringify(k) + ':' + jcs(v[k])).join(',') + '}'; }
  throw new Error('JCS: unsupported type ' + typeof v);
}
export const utf8 = (s: string) => new TextEncoder().encode(s);
export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array { const o = new Uint8Array(a.length + b.length); o.set(a, 0); o.set(b, a.length); return o; }
export const hex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');

// ---------- base58btc / multibase / multikey ----------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58encode(bytes: Uint8Array): string {
  const digits: number[] = []; for (const b of bytes) { let carry = b; for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; } while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; } }
  let s = ''; for (const b of bytes) { if (b === 0) s += '1'; else break; } for (let i = digits.length - 1; i >= 0; i--) s += B58[digits[i]]; return s;
}
export function b58decode(s: string): Uint8Array {
  const bytes: number[] = []; for (const ch of s) { const v = B58.indexOf(ch); if (v < 0) throw new Error('base58: bad char'); let carry = v; for (let j = 0; j < bytes.length; j++) { carry += bytes[j] * 58; bytes[j] = carry & 255; carry >>= 8; } while (carry) { bytes.push(carry & 255); carry >>= 8; } }
  let zeros = 0; for (const ch of s) { if (ch === '1') zeros++; else break; } return Uint8Array.from([...new Array(zeros).fill(0), ...bytes.reverse()]);
}
const ED_PREFIX = [0xed, 0x01];
export function multikey(pub: Uint8Array): string { if (pub.length !== 32) throw new Error('Ed25519 public key must be 32 bytes'); return 'z' + b58encode(Uint8Array.from([...ED_PREFIX, ...pub])); }
export function multikeyToRaw(mb: string): Uint8Array { if (!mb || mb[0] !== 'z') throw new Error('multibase: expected base58btc (z)'); const b = b58decode(mb.slice(1)); if (b.length !== 34 || b[0] !== 0xed || b[1] !== 0x01) throw new Error('multikey: not an Ed25519 public key'); return b.slice(2); }
export const encodeProofValue = (sig: Uint8Array) => 'z' + b58encode(sig);
export function decodeProofValue(pv: string): Uint8Array { if (!pv || pv[0] !== 'z') throw new Error('proofValue: expected base58btc (z)'); const s = b58decode(pv.slice(1)); if (s.length !== 64) throw new Error('proofValue: Ed25519 signature must be 64 bytes'); return s; }
/** بصمة قصيرة للعرض البشري: آخر 8 أحرف من المفتاح العام */
export const keyFingerprint = (mb: string) => mb.slice(-8).toUpperCase();

// ---------- did:web ----------
export function didWeb(site: string): string { const u = new URL(site); return `did:web:${encodeURIComponent(u.host)}`; }
/** did:web:host[:path] → عنوان وثيقة DID (المعيار: https دائمًا؛ ونسمح بـ http لمضيف محلي) */
export function didWebUrl(did: string): string {
  const m = /^did:web:([^:]+)((?::[^:]+)*)$/.exec(did); if (!m) throw new Error('not a did:web');
  const host = decodeURIComponent(m[1]); const path = m[2] ? m[2].split(':').filter(Boolean).map(decodeURIComponent).join('/') : '';
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(host); const base = `${local ? 'http' : 'https'}://${host}`;
  return path ? `${base}/${path}/did.json` : `${base}/.well-known/did.json`;
}
export function didDocument(did: string, keys: { kid: string; publicKeyMultibase: string; retired_at?: string | null }[], site: string) {
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: did, alsoKnownAs: [`${site}/.well-known/athar.json`],
    verificationMethod: keys.map(k => ({ id: k.kid, type: 'Multikey', controller: did, publicKeyMultibase: k.publicKeyMultibase, ...(k.retired_at ? { revoked: k.retired_at } : {}) })),
    assertionMethod: keys.map(k => k.kid),
    service: [{ id: `${did}#verify`, type: 'LinkedVerifiablePresentation', serviceEndpoint: `${site}/verify/vc` }, { id: `${did}#issuer`, type: 'OpenBadgeIssuerProfile', serviceEndpoint: `${site}/.well-known/athar.json` }],
  };
}

// ---------- بيانات التوقيع (eddsa-jcs-2022) ----------
export async function hashDataToSign(doc: any, proofOptions: Omit<Proof, 'proofValue'> & Record<string, any>, sha256: Sha256): Promise<Uint8Array> {
  const { proof: _p, ...unsecured } = doc || {}; const cfg: any = { ...proofOptions }; delete cfg.proofValue; if (unsecured['@context']) cfg['@context'] = unsecured['@context'];
  const h1 = await sha256(utf8(jcs(cfg))); const h2 = await sha256(utf8(jcs(unsecured))); return concatBytes(h1, h2);
}
export async function documentDigest(doc: any, sha256: Sha256): Promise<string> { const { proof: _p, ...unsecured } = doc || {}; return hex(await sha256(utf8(jcs(unsecured)))); }

export type VerifyCheck = { key: 'structure' | 'proof' | 'issuer' | 'signature' | 'validity' | 'status'; ok: boolean | null; ar: string; en: string };
export type VerifyResult = { ok: boolean; checks: VerifyCheck[]; summary?: VcSummary | null };
/** فحوص بنيوية بلا تشفير — تُستخدم في المتصفح والخادم قبل التوقيع */
export function structuralChecks(doc: any, now = new Date()): VerifyCheck[] {
  const out: VerifyCheck[] = [];
  const types: string[] = Array.isArray(doc?.type) ? doc.type : doc?.type ? [doc.type] : [];
  const okStruct = !!doc && typeof doc === 'object' && types.includes('VerifiableCredential') && !!doc.issuer && !!doc.credentialSubject;
  out.push({ key: 'structure', ok: okStruct, ar: okStruct ? 'وثيقة Verifiable Credential صالحة البنية' : 'ليست وثيقة Verifiable Credential (type/issuer/credentialSubject)', en: okStruct ? 'Well-formed Verifiable Credential' : 'Not a Verifiable Credential' });
  const p = doc?.proof; const okProof = !!p && p.type === 'DataIntegrityProof' && p.cryptosuite === CRYPTOSUITE && typeof p.proofValue === 'string' && typeof p.verificationMethod === 'string';
  out.push({ key: 'proof', ok: okProof, ar: okProof ? `إثبات ${CRYPTOSUITE} موجود` : 'لا إثبات تشفيري (proof) من النوع المدعوم', en: okProof ? `${CRYPTOSUITE} proof present` : 'No supported DataIntegrityProof' });
  const issuerId = typeof doc?.issuer === 'string' ? doc.issuer : doc?.issuer?.id; const okIss = okProof && typeof issuerId === 'string' && issuerId.startsWith('did:web:') && String(p.verificationMethod).startsWith(issuerId + '#');
  out.push({ key: 'issuer', ok: okIss, ar: okIss ? `المُصدِر ${issuerId}` : 'مفتاح التوقيع لا ينتمي إلى المُصدِر المعلَن', en: okIss ? `Issuer ${issuerId}` : 'Verification method does not belong to the issuer' });
  const from = doc?.validFrom ? new Date(doc.validFrom) : null; const until = doc?.validUntil ? new Date(doc.validUntil) : null;
  const okValid = (!from || from.getTime() <= now.getTime() + 300000) && (!until || until.getTime() >= now.getTime());
  out.push({ key: 'validity', ok: okValid, ar: okValid ? (until ? `سارية حتى ${until.toISOString().slice(0, 10)}` : 'بلا تاريخ انتهاء') : until && until < now ? `انتهت صلاحيتها في ${until.toISOString().slice(0, 10)}` : 'تاريخ بدء السريان في المستقبل', en: okValid ? 'Within validity period' : 'Outside validity period' });
  return out;
}
export type VcSummary = { title: string; holder: string; holderEmail: string; issuer: string; kind: 'credential' | 'snapshot' | 'status' | 'other'; validFrom: string; validUntil: string | null; skills: { name: string; code: string; framework: string; level?: string | null }[]; code: string; verifyUrl: string; fingerprint: string };
export function summarize(doc: any): VcSummary {
  const cs = doc?.credentialSubject || {}; const ach = cs.achievement || {}; const idf = Array.isArray(cs.identifier) ? cs.identifier[0] : null;
  const types: string[] = Array.isArray(doc?.type) ? doc.type : []; const kind: VcSummary['kind'] = types.includes('BitstringStatusListCredential') ? 'status' : doc?._athar?.kind === 'snapshot' ? 'snapshot' : types.includes('OpenBadgeCredential') ? 'credential' : 'other';
  const levels: Record<string, string> = {}; for (const r of (Array.isArray(cs.result) ? cs.result : [])) if (r?.resultDescription && r?.value != null) levels[String(r.resultDescription)] = String(r.value);
  const skills = (Array.isArray(ach.alignment) ? ach.alignment : []).map((a: any) => ({ name: String(a.targetDescription || a.targetName || ''), code: String(a.targetCode || ''), framework: String(a.targetFramework || ''), level: levels[String(a.targetCode || '')] ?? null }));
  const vm = String(doc?.proof?.verificationMethod || ''); const mb = vm.includes('#') ? vm.slice(vm.indexOf('#') + 1) : '';
  return { title: String(doc?.name || ach.name || ''), holder: String(cs.name || doc?._athar?.holder || ''), holderEmail: String(idf?.identityHash || ''), issuer: String(typeof doc?.issuer === 'string' ? doc.issuer : doc?.issuer?.name || doc?.issuer?.id || ''), kind, validFrom: String(doc?.validFrom || ''), validUntil: doc?.validUntil ? String(doc.validUntil) : null, skills, code: String(doc?._athar?.code || ''), verifyUrl: String(doc?._athar?.verify_url || doc?.id || ''), fingerprint: mb ? keyFingerprint(mb) : '' };
}

// ---------- بناء الوثائق ----------
type SkillMeta = Pick<Skill, 'id' | 'code' | 'name_ar' | 'name_en' | 'saqf_level' | 'cefr_level' | 'sdaia_code'>;
export const frameworkOf = (s: Partial<SkillMeta>) => s.saqf_level ? `SAQF level ${s.saqf_level}` : s.cefr_level ? `CEFR ${s.cefr_level}` : s.sdaia_code ? `SDAIA ${s.sdaia_code}` : 'Athar skills taxonomy';
const alignment = (skills: SkillMeta[], site: string) => skills.map(s => ({ type: ['Alignment'], targetName: s.name_en || s.name_ar, targetCode: s.code, targetDescription: s.name_ar, targetFramework: frameworkOf(s), targetUrl: `${site}/skills#${s.code}` }));
export function issuerBlock(did: string, site: string) { return { id: did, type: ['Profile'], name: 'Athar · TRACE — Education, Training & Development Portal', url: site, otherIdentifier: [{ type: ['IdentifierEntry'], identifier: `${site}/.well-known/athar.json`, identifierType: 'url' }] }; }
export function statusEntry(site: string, index: number) { return { id: `${site}/api/vc?status=1#${index}`, type: 'BitstringStatusListEntry', statusPurpose: 'revocation', statusListIndex: String(index), statusListCredential: `${site}/api/vc?status=1` }; }

/** شهادة أَثَر → وثيقة OB 3.0 / VC 2.0 غير موقَّعة بعد (المُصدِر = did:web) */
export function buildCredentialDoc(c: Omit<Credential, 'badge'>, skills: SkillMeta[], site: string, did: string, statusIndex: number | null) {
  const url = `${site}/credential/${c.verify_code}`; const ach = c.kind === 'program_completion' ? 'Certificate' : c.kind === 'skill' ? 'Competency' : c.kind === 'placement' ? 'Assessment' : 'Badge';
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: c.title_en || c.title_ar,
    issuer: issuerBlock(did, site), validFrom: c.issued_at, ...(c.valid_until ? { validUntil: c.valid_until } : {}),
    credentialSubject: { type: ['AchievementSubject'], ...(c.full_name ? { name: c.full_name } : {}), identifier: [{ type: 'IdentityObject', identityType: 'emailAddress', hashed: false, identityHash: c.email }],
      achievement: { id: `${url}#achievement`, type: ['Achievement'], name: c.title_en || c.title_ar, description: c.description_ar || c.title_ar, achievementType: ach,
        criteria: { narrative: c.kind === 'program_completion' ? 'Completed the program with ≥80% attendance and the final evaluation.' : c.kind === 'placement' ? 'Achieved the stated CEFR level in the Mi‘yar adaptive placement test.' : 'Evidence recorded in the Athar learning record.' },
        ...(c.level ? { fieldOfStudy: String(c.level) } : {}), alignment: alignment(skills, site) },
      ...(c.hours ? { activityEndDate: c.issued_at, creditsEarned: c.hours } : {}) },
    evidence: [{ type: ['Evidence'], id: url, name: 'Living credential page', narrative: 'Live status, evidence chain and employer subscription on the Athar portal.' }],
    ...(statusIndex !== null ? { credentialStatus: statusEntry(site, statusIndex) } : {}),
    _athar: { kind: 'credential', code: c.verify_code, title_ar: c.title_ar, holder: c.full_name || '', verify_url: `${site}/verify/vc?code=${encodeURIComponent(c.verify_code)}`, issued_by: 'Athar · TRACE', owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

export type SnapshotLevel = { skill: SkillMeta; level: number; approved: boolean; confidence: number; evidence_count: number };
/** «لقطة قدرة» يُصدرها المتعلم بنفسه: مستوياته المعتمَدة/المحسوبة بتاريخ اليوم، صالحة 90 يومًا */
export function buildSnapshotDoc(inp: { code: string; name: string; email: string; levels: SnapshotLevel[]; site: string; did: string; now?: Date; statusIndex: number | null }) {
  const now = inp.now || new Date(); const until = new Date(now.getTime() + SNAPSHOT_DAYS * 86400000); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`;
  const skills = inp.levels.map(l => l.skill);
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: `Athar Capability Snapshot — ${now.toISOString().slice(0, 10)}`,
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(), validUntil: until.toISOString(),
    credentialSubject: { type: ['AchievementSubject'], name: inp.name, identifier: [{ type: 'IdentityObject', identityType: 'emailAddress', hashed: false, identityHash: inp.email }],
      achievement: { id: `${inp.site}/me/twin#snapshot`, type: ['Achievement'], name: 'Capability snapshot (self-issued, portal-signed)', achievementType: 'Competency',
        description: 'A dated statement of the holder’s skill levels (1–5) computed from evidence in the Athar learning record; levels marked approved were confirmed by a human reviewer.',
        criteria: { narrative: 'Levels are computed from weighted evidence (placement tests, observed performance, workflow missions, simulations, program completion) and optionally approved by staff.' }, alignment: alignment(skills, inp.site) },
      result: inp.levels.map(l => ({ type: ['Result'], resultDescription: l.skill.code, value: String(l.level), status: l.approved ? 'Completed' : 'InProgress', achievedLevel: `${inp.site}/skills#level-${l.level}` })) },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'snapshot', code: inp.code, holder: inp.name, verify_url: url, levels: inp.levels.map(l => ({ code: l.skill.code, name_ar: l.skill.name_ar, level: l.level, approved: l.approved, confidence: l.confidence, evidence: l.evidence_count, framework: frameworkOf(l.skill) })), expires_days: SNAPSHOT_DAYS, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

/** Bitstring Status List: بت = 1 يعني ملغاة. ترميز: gzip ثم base64url بسابقة u (يُمرَّر gzip من الخادم) */
export function bitstring(revoked: number[], bits = STATUS_LIST_BITS): Uint8Array { const out = new Uint8Array(bits >> 3); for (const i of revoked) if (i >= 0 && i < bits) out[i >> 3] |= 0x80 >> (i & 7); return out; }
export const bitAt = (bytes: Uint8Array, i: number) => i >= 0 && i < bytes.length * 8 ? ((bytes[i >> 3] >> (7 - (i & 7))) & 1) === 1 : false;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function b64url(bytes: Uint8Array): string { let s = ''; for (let i = 0; i < bytes.length; i += 3) { const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0); s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : ''); } return s; }
export function b64urlDecode(s: string): Uint8Array { const clean = s.replace(/[^A-Za-z0-9_-]/g, ''); const out: number[] = []; for (let i = 0; i < clean.length; i += 4) { const c = [0, 1, 2, 3].map(k => (i + k < clean.length ? B64.indexOf(clean[i + k]) : -1)); const n = ((c[0] & 63) << 18) | ((c[1] & 63) << 12) | ((Math.max(0, c[2]) & 63) << 6) | (Math.max(0, c[3]) & 63); out.push((n >> 16) & 255); if (c[2] >= 0) out.push((n >> 8) & 255); if (c[3] >= 0) out.push(n & 255); } return Uint8Array.from(out); }
export function buildStatusListDoc(site: string, did: string, encodedList: string, now = new Date()) {
  return { '@context': ['https://www.w3.org/ns/credentials/v2'], id: `${site}/api/vc?status=1`, type: ['VerifiableCredential', 'BitstringStatusListCredential'], issuer: did, validFrom: now.toISOString(),
    credentialSubject: { id: `${site}/api/vc?status=1#list`, type: 'BitstringStatusList', statusPurpose: 'revocation', encodedList } };
}
export const snapshotCode = (rnd: () => string) => `ATH-S-${rnd()}-${rnd()}`;
