// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P17 — «محفظة القدرة السيادية»: JCS (RFC 8785)، base58/multikey، did:web، توقيع eddsa-jcs-2022 والتحقق،
//                 كشف التلاعب، وثيقة DID، بناء الشهادة واللقطة، قائمة الحالة (bitstring + gzip)، الملخص، التخزين مع db وهمية.
import test from 'node:test';
import assert from 'node:assert/strict';
import { jcs, b58encode, b58decode, multikey, multikeyToRaw, didWeb, didWebUrl, didDocument, buildCredentialDoc, buildSnapshotDoc, structuralChecks, summarize, bitstring, bitAt, b64url, b64urlDecode, keyFingerprint, decodeProofValue, snapshotCode } from '../lib/portal/vc';
import { keyFromSeed, generateSeed, signerFromEnv, signDocument, verifySignature, verifyDocument, encodeStatusList, decodeStatusList, statusBit, signedStatusList, localResolver, ensureKeyRow, signAndStoreCredential, sha256 } from '../lib/portal/vc-server';

const SITE = 'https://athar-portal.vercel.app'; const SEED = Buffer.alloc(32, 7).toString('base64');
const signer = () => signerFromEnv({ VC_SIGNING_KEY: SEED } as any, SITE)!;
const SK = [{ id: 's1', code: 'ATH-AR-003', name_ar: 'تدريس العربية للناطقين بغيرها', name_en: 'Teaching Arabic to non-native speakers', saqf_level: '6', cefr_level: null, sdaia_code: null }];
const CRED: any = { id: 'c1', user_id: 'u1', email: 'reem@example.com', full_name: 'ريم الدوسري', kind: 'program_completion', title_ar: 'شهادة إتمام', title_en: 'Completion', description_ar: null, program_id: 'p3', session_id: null, skills: ['s1'], level: 'B2', hours: 120, verify_code: 'ATH-REEM-0002', issued_at: '2026-10-15T08:00:00.000Z', valid_until: null, revoked_at: null, revoke_reason: null, issued_by: 'u1' };

test('P17 JCS: ترتيب المفاتيح وحذف undefined وعدم تغيير المصفوفات (RFC 8785)', () => {
  assert.equal(jcs({ b: 1, a: [3, { z: true, y: null }], c: 'x"y', d: undefined }), '{"a":[3,{"y":null,"z":true}],"b":1,"c":"x\\"y"}');
  assert.equal(jcs({ '\u20ac': 1, 'A': 2, 'a': 3 }), '{"A":2,"a":3,"€":1}', 'ترتيب بوحدات UTF-16');
  assert.equal(jcs(1e21), '1e+21'); assert.equal(jcs(0.1 + 0.2), '0.30000000000000004'); assert.throws(() => jcs(NaN), /non-finite/);
});
test('P17 base58btc: ذهاب وإياب مع الأصفار البادئة', () => {
  for (const arr of [[0, 0, 1, 2, 3], [255, 254, 0], [0], [], Array.from({ length: 64 }, (_, i) => (i * 37) % 256)]) { const b = Uint8Array.from(arr); assert.deepEqual(Array.from(b58decode(b58encode(b))), arr, `roundtrip ${arr.length}`); }
  assert.equal(b58encode(Uint8Array.from([0, 0, 0])), '111'); assert.throws(() => b58decode('0OIl'), /bad char/);
});
test('P17 multikey: مفتاح Ed25519 يبدأ بـ z6Mk ويُفك إلى 32 بايت', () => {
  const k = keyFromSeed(SEED); assert.match(k.multibase, /^z6Mk/, 'multicodec ed25519-pub'); assert.equal(multikeyToRaw(k.multibase).length, 32); assert.deepEqual(multikeyToRaw(multikey(k.pub)), k.pub);
  assert.throws(() => multikeyToRaw('z' + b58encode(Uint8Array.from([1, 2, 3]))), /not an Ed25519/); assert.equal(keyFingerprint(k.multibase).length, 8);
  assert.throws(() => keyFromSeed('abc'), /32 بايت/); const s2 = generateSeed(); assert.equal(Buffer.from(s2, 'base64').length, 32); assert.notEqual(keyFromSeed(s2).multibase, k.multibase);
});
test('P17 did:web: الاشتقاق من الموقع وعنوان الوثيقة (مع منفذ محلي)', () => {
  assert.equal(didWeb(SITE), 'did:web:athar-portal.vercel.app'); assert.equal(didWebUrl('did:web:athar-portal.vercel.app'), 'https://athar-portal.vercel.app/.well-known/did.json');
  assert.equal(didWeb('http://127.0.0.1:3100'), 'did:web:127.0.0.1%3A3100'); assert.equal(didWebUrl('did:web:127.0.0.1%3A3100'), 'http://127.0.0.1:3100/.well-known/did.json');
  assert.equal(didWebUrl('did:web:example.com:issuers:athar'), 'https://example.com/issuers/athar/did.json'); assert.throws(() => didWebUrl('did:key:z6Mk'), /not a did:web/);
  const s = signer(); const doc = didDocument(s.did, [{ kid: s.kid, publicKeyMultibase: s.multibase }, { kid: 'did:web:x#old', publicKeyMultibase: 'z6MkOLD', retired_at: '2026-01-01' }], SITE);
  assert.equal(doc.id, s.did); assert.equal(doc.verificationMethod.length, 2); assert.equal(doc.verificationMethod[0].type, 'Multikey'); assert.equal((doc.verificationMethod[1] as any).revoked, '2026-01-01'); assert.deepEqual(doc.assertionMethod, [s.kid, 'did:web:x#old']);
});
test('P17 توقيع eddsa-jcs-2022 ثم التحقق؛ أي تعديل يُسقط التوقيع؛ مفتاح آخر يفشل', async () => {
  const s = signer(); const doc = buildCredentialDoc(CRED, SK as any, SITE, s.did, 1); const vc = await signDocument(doc, s, new Date('2026-10-28T10:00:00Z'));
  assert.equal(vc.proof.type, 'DataIntegrityProof'); assert.equal(vc.proof.cryptosuite, 'eddsa-jcs-2022'); assert.equal(vc.proof.verificationMethod, s.kid); assert.equal(decodeProofValue(vc.proof.proofValue).length, 64);
  const resolve = localResolver(s, []); assert.equal((await verifySignature(vc, resolve)).ok, true, 'التوقيع الأصلي صحيح');
  const tampered = JSON.parse(JSON.stringify(vc)); tampered.credentialSubject.achievement.name = 'Doctorate'; assert.equal((await verifySignature(tampered, resolve)).ok, false, 'تعديل اسم الإنجاز يُسقط التوقيع');
  const reordered = JSON.parse(JSON.stringify({ proof: vc.proof, ...Object.fromEntries(Object.entries(vc).reverse()) })); assert.equal((await verifySignature(reordered, resolve)).ok, true, 'إعادة ترتيب المفاتيح لا تؤثر (JCS)');
  const other = signerFromEnv({ VC_SIGNING_KEY: generateSeed() } as any, SITE)!; assert.equal((await verifySignature(vc, localResolver(other, []))).ok, false, 'مفتاح غير منشور');
  const forged = { ...vc, proof: { ...vc.proof, verificationMethod: other.kid } }; assert.equal((await verifySignature(forged, localResolver(other, []))).ok, false, 'انتحال kid بمفتاح آخر');
  const full = await verifyDocument(vc, resolve, async () => ({ key: 'status', ok: true, ar: 'سارية', en: 'ok' })); assert.equal(full.ok, true); assert.equal(full.checks.length, 6); assert.equal(full.summary?.holder, 'ريم الدوسري'); assert.equal(full.summary?.kind, 'credential');
  const ex = await verifyDocument({ ...vc, validUntil: '2020-01-01T00:00:00Z' }, resolve, async () => null); assert.equal(ex.ok, false, 'منتهية'); assert.equal(ex.checks.find(c => c.key === 'validity')?.ok, false);
});
test('P17 الفحوص البنيوية: وثيقة غريبة، مفتاح لا ينتمي للمُصدِر', () => {
  const c1 = structuralChecks({ hello: 1 }); assert.equal(c1.find(c => c.key === 'structure')?.ok, false); assert.equal(c1.find(c => c.key === 'proof')?.ok, false);
  const s = signer(); const d = buildCredentialDoc(CRED, SK as any, SITE, s.did, null) as any; d.proof = { type: 'DataIntegrityProof', cryptosuite: 'eddsa-jcs-2022', verificationMethod: 'did:web:evil.example#z6Mkx', proofValue: 'z1' };
  assert.equal(structuralChecks(d).find(c => c.key === 'issuer')?.ok, false, 'kid من نطاق آخر'); assert.equal(structuralChecks(d).find(c => c.key === 'structure')?.ok, true);
});
test('P17 بناء الشهادة: OB 3.0 + المُصدِر did + قائمة الحالة + المواءمة', () => {
  const s = signer(); const d = buildCredentialDoc(CRED, SK as any, SITE, s.did, 42) as any;
  assert.deepEqual(d.type, ['VerifiableCredential', 'OpenBadgeCredential']); assert.equal(d.issuer.id, s.did); assert.equal(d.credentialStatus.statusListIndex, '42'); assert.equal(d.credentialStatus.statusListCredential, `${SITE}/api/vc?status=1`);
  assert.equal(d.credentialSubject.achievement.alignment[0].targetFramework, 'SAQF level 6'); assert.equal(d.credentialSubject.achievement.achievementType, 'Certificate'); assert.equal(d._athar.code, 'ATH-REEM-0002'); assert.equal(d.credentialSubject.name, 'ريم الدوسري');
  const n = buildCredentialDoc(CRED, SK as any, SITE, s.did, null) as any; assert.equal(n.credentialStatus, undefined);
});
test('P17 لقطة القدرة: 90 يومًا، نتائج لكل مهارة، الملخص يقرأ المستويات', () => {
  const s = signer(); const now = new Date('2026-10-28T10:00:00Z'); const code = snapshotCode(() => 'ABCD'); assert.equal(code, 'ATH-S-ABCD-ABCD');
  const d = buildSnapshotDoc({ code, name: 'Ahmed', email: 'admin@upm.edu.sa', levels: [{ skill: SK[0] as any, level: 4, approved: true, confidence: 62, evidence_count: 5 }], site: SITE, did: s.did, now, statusIndex: 7 }) as any;
  assert.equal(new Date(d.validUntil).getTime() - now.getTime(), 90 * 86400000); assert.equal(d.credentialSubject.result[0].value, '4'); assert.equal(d.credentialSubject.result[0].status, 'Completed'); assert.equal(d._athar.kind, 'snapshot');
  const sum = summarize(d); assert.equal(sum.kind, 'snapshot'); assert.equal(sum.skills[0].level, '4'); assert.equal(sum.skills[0].code, 'ATH-AR-003'); assert.equal(sum.holder, 'Ahmed'); assert.equal(sum.code, code);
});
test('P17 قائمة الحالة: bitstring 16KB، gzip + base64url، قراءة البت، وثيقة موقَّعة', async () => {
  const bits = bitstring([0, 9, 131071]); assert.equal(bits.length, 16384); assert.equal(bitAt(bits, 0), true); assert.equal(bitAt(bits, 1), false); assert.equal(bitAt(bits, 9), true); assert.equal(bitAt(bits, 131071), true); assert.equal(bitAt(bits, 999999), false);
  const enc = encodeStatusList([5, 77]); assert.equal(enc[0], 'u'); assert.ok(enc.length < 200, 'مضغوطة جدًا لقائمة شبه فارغة'); assert.equal(statusBit(enc, 5), true); assert.equal(statusBit(enc, 6), false); assert.equal(decodeStatusList(enc).length, 16384);
  const raw = Uint8Array.from([0, 1, 2, 250, 251, 252, 253]); assert.deepEqual(Array.from(b64urlDecode(b64url(raw))), Array.from(raw)); assert.equal(b64url(Uint8Array.from([251, 255])), '-_8');
  const s = signer(); const doc = await signedStatusList([3], s); assert.ok(doc.type.includes('BitstringStatusListCredential'), 'نوع القائمة'); assert.equal((await verifySignature(doc, localResolver(s, []))).ok, true);
});
test('P17 التخزين: ensureKeyRow يسجّل ويُقاعد؛ signAndStoreCredential يُنشئ صفًا واحدًا ثم يحدّثه', async () => {
  const rows: any = { portal_signing_keys: [{ kid: 'did:web:athar-portal.vercel.app#old', public_key_multibase: 'z6MkOLD', retired_at: null }], portal_vc_issuances: [], portal_credentials: [{ ...CRED }] }; const ops: string[] = [];
  const q = (t: string) => { const st: any = { f: [] as any[], payload: null as any, op: 'select' }; const b: any = {
    select: () => b, insert: (p: any) => { st.op = 'insert'; st.payload = p; return b; }, update: (p: any) => { st.op = 'update'; st.payload = p; return b; }, eq: (k: string, v: any) => { st.f.push([k, v]); return b; }, limit: () => b, order: () => b, maybeSingle: () => run(true), single: () => run(true),
    then: (res: any, rej: any) => run(false).then(res, rej) };
    const run = async (single: boolean) => { ops.push(`${st.op}:${t}`); let list = rows[t] as any[]; if (st.op === 'insert') { const r = { id: `i${list.length + 1}`, status_index: list.length + 1, ...st.payload }; list.push(r); return { data: r, error: null }; } const match = list.filter(r => st.f.every(([k, v]: any) => r[k] === v)); if (st.op === 'update') { for (const r of match) Object.assign(r, st.payload); return { data: match, error: null }; } return { data: single ? match[0] || null : match, error: null }; };
    return b; }; const db = { from: q };
  const s = signer(); await ensureKeyRow(db, s); assert.equal(rows.portal_signing_keys.length, 2); assert.ok(rows.portal_signing_keys[0].retired_at, 'القديم تقاعد'); assert.equal(rows.portal_signing_keys[1].kid, s.kid); await ensureKeyRow(db, s); assert.equal(rows.portal_signing_keys.length, 2, 'لا تكرار');
  const build = (idx: number | null) => buildCredentialDoc(CRED, SK as any, SITE, s.did, idx);
  const r1 = await signAndStoreCredential(db, CRED, s, build, 'u1'); assert.equal(rows.portal_vc_issuances.length, 1); assert.equal(r1.code, 'ATH-REEM-0002'); assert.equal(rows.portal_vc_issuances[0].vc.proof.cryptosuite, 'eddsa-jcs-2022'); assert.equal(rows.portal_vc_issuances[0].digest.length, 64); assert.equal(rows.portal_credentials[0].vc_kid, s.kid);
  const r2 = await signAndStoreCredential(db, CRED, s, build, 'u1'); assert.equal(rows.portal_vc_issuances.length, 1, 'إعادة التوقيع تحدّث الصف نفسه'); assert.equal(r2.vc.credentialStatus.statusListIndex, '1'); assert.equal((await verifySignature(r2.vc, localResolver(s, []))).ok, true);
  const h = await sha256(new TextEncoder().encode('abc')); assert.equal(Buffer.from(h).toString('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
