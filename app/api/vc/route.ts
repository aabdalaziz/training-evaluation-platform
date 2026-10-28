// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/vc — محفظة القدرة السيادية (أَثَر · P17): شهادات قابلة للتحقق Open Badges 3.0 / W3C VC 2.0 موقَّعة Ed25519 (eddsa-jcs-2022)
 *  GET ?code=ATH-XXXX-XXXX | ATH-S-XXXX-XXXX (عام)  → وثيقة VC الموقَّعة نفسها (JSON خام قابل للتنزيل؛ شهادة لم توقَّع بعد تُوقَّع لحظيًا إن وُجد المفتاح)
 *  GET ?status=1                               (عام)  → Bitstring Status List Credential (الإلغاء) — موقَّعة
 *  GET ?view=keys                              (موظفون) → حالة مفتاح التوقيع والإصدارات وغير الموقَّع
 *  GET ?view=mine                              (أي مستخدم) → إصداراته (شهادات موقَّعة + لقطات)
 *  POST { action:'verify', vc }                (عام، محدود) → { ok, checks[], summary } — تحقق خادمي (احتياط للمتصفحات بلا Ed25519)
 *  POST { action:'snapshot' }                  (مستخدم)  → يُصدر «لقطة قدرة» موقَّعة بمستوياته اليوم (90 يومًا)
 *  POST { action:'revoke_snapshot', id }       (مستخدم)  → يلغي لقطة أصدرها
 *  POST { action:'sign_all' }                  (موظفون) → يوقّع كل الشهادات غير الموقَّعة (حتى 100 في النداء)
 *  POST { action:'resign', credential_id }     (موظفون) → إعادة توقيع شهادة (بعد تدوير المفتاح مثلًا)
 *  POST { action:'generate_key' }              (موظفون) → بذرة مفتاح جديدة تُعرض مرة واحدة لنسخها إلى Vercel (لا تُخزَّن)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { displayLevel, randomCode } from '../../../lib/portal/profile';
import { buildCredentialDoc, buildSnapshotDoc, buildStatusListDoc, didWeb, didWebUrl, documentDigest, keyFingerprint, multikey, snapshotCode, type SnapshotLevel, type VerifyCheck } from '../../../lib/portal/vc';
import { SKILL_META_COLS, encodeStatusList, ensureKeyRow, generateSeed, keyFromSeed, localResolver, sha256, signAndStoreCredential, signDocument, signedStatusList, signerFromEnv, statusBit, verifyDocument, type KeyResolver, type Signer } from '../../../lib/portal/vc-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const VC_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const hits = new Map<string, { n: number; t: number }>();
function allow(ip: string, limit: number): boolean { const now = Date.now(); const h = hits.get(ip); if (!h || now - h.t > 3600000) { hits.set(ip, { n: 1, t: now }); return true; } h.n++; return h.n <= limit; }
const ipOf = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
const ISS_COLS = 'id,code,kind,credential_id,user_id,email,full_name,title_ar,kid,status_index,issued_at,expires_at,revoked_at,created_at';

function service() { const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!URL_ || !SERVICE) return null; return createClient(URL_, SERVICE, { auth: { persistSession: false } }); }
async function who(req: Request, db: any): Promise<{ id: string; email: string; name: string; staff: boolean } | null> {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !URL_ || !ANON) return null; const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
}
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
async function signerOf(db: any, site: string): Promise<Signer | null> { const s = signerFromEnv(process.env, site); if (s) await ensureKeyRow(db, s); return s; }
async function skillsById(db: any, ids: string[]) { if (!ids.length) return [] as any[]; const { data } = await db.from('portal_skills').select(SKILL_META_COLS).in('id', ids); return (data || []) as any[]; }
const credDoc = (c: any, skills: any[], site: string, did: string) => (idx: number | null) => buildCredentialDoc(c, skills, site, did, idx);

/** مؤشرات الإلغاء لقائمة الحالة: إصدار مُلغى أو شهادته مُلغاة */
async function revokedIndices(db: any): Promise<number[]> {
  const [{ data: iss }, { data: rc }] = await Promise.all([db.from('portal_vc_issuances').select('status_index,revoked_at,credential_id').limit(5000), db.from('portal_credentials').select('id').not('revoked_at', 'is', null).limit(5000)]);
  const revokedCreds = new Set(((rc || []) as any[]).map(x => x.id)); return ((iss || []) as any[]).filter(r => r.revoked_at || (r.credential_id && revokedCreds.has(r.credential_id))).map(r => Number(r.status_index));
}
async function resolverFor(db: any, site: string, signer: Signer | null): Promise<KeyResolver> {
  const { data } = await db.from('portal_signing_keys').select('kid,public_key_multibase').limit(100); const local = localResolver(signer, (data || []) as any[]); const ourDid = didWeb(site);
  return async vm => { const l = await local(vm); if (l) return l; const did = vm.split('#')[0]; if (!did.startsWith('did:web:') || did === ourDid) return null;
    try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000); const r = await fetch(didWebUrl(did), { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(t); if (!r.ok) return null; const j = await r.json(); const m = (j.verificationMethod || []).find((x: any) => x.id === vm); return m?.publicKeyMultibase || null; } catch { return null; } };
}
function statusChecker(db: any, site: string): (doc: any) => Promise<VerifyCheck | null> {
  return async doc => {
    const cs = doc?.credentialStatus; const code = String(doc?._athar?.code || '');
    if (!cs && !code) return null;
    if (cs && typeof cs.statusListCredential === 'string' && cs.statusListCredential.startsWith(`${site}/api/vc`)) {
      const idx = Number(cs.statusListIndex); const { data } = await db.from('portal_vc_issuances').select('id,revoked_at,credential_id,kind').eq('status_index', idx).maybeSingle();
      if (!data) return { key: 'status', ok: false, ar: 'لا سجل لهذه الوثيقة لدى أَثَر', en: 'No issuance record at Athar' };
      let revoked = !!(data as any).revoked_at; if (!revoked && (data as any).credential_id) { const { data: c } = await db.from('portal_credentials').select('revoked_at').eq('id', (data as any).credential_id).maybeSingle(); revoked = !!(c as any)?.revoked_at; }
      return { key: 'status', ok: !revoked, ar: revoked ? 'مُلغاة — أعلن المُصدِر إلغاءها' : 'سارية — غير مُلغاة في سجل أَثَر (فُحص الآن)', en: revoked ? 'Revoked by issuer' : 'Not revoked (checked live)' };
    }
    if (cs && typeof cs.statusListCredential === 'string') {
      try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000); const r = await fetch(cs.statusListCredential, { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(t); const j = await r.json(); const revoked = statusBit(String(j?.credentialSubject?.encodedList || ''), Number(cs.statusListIndex)); return { key: 'status', ok: !revoked, ar: revoked ? 'مُلغاة وفق قائمة حالة المُصدِر' : 'سارية وفق قائمة حالة المُصدِر', en: revoked ? 'Revoked per issuer status list' : 'Not revoked per issuer status list' }; }
      catch { return { key: 'status', ok: null, ar: 'تعذّر الوصول إلى قائمة حالة المُصدِر — لم يُتحقق من الإلغاء', en: 'Issuer status list unreachable' }; }
    }
    return null;
  };
}

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req: Request) {
  const db = service(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const u = new URL(req.url); const site = siteOf(req); const did = didWeb(site);
  const code = String(u.searchParams.get('code') || '').trim().toUpperCase();
  if (code) {
    const { data: iss } = await db.from('portal_vc_issuances').select('vc,kind,revoked_at').eq('code', code).maybeSingle();
    if (iss && (iss as any).vc && Object.keys((iss as any).vc).length) return new NextResponse(JSON.stringify((iss as any).vc, null, 2), { headers: { ...VC_HEADERS, 'Content-Disposition': `inline; filename="athar-${code}.vc.json"` } });
    const { data: c } = await db.from('portal_credentials').select('*').ilike('verify_code', code).maybeSingle(); if (!c) return bad('لا شهادة بهذا الرمز', 404);
    const signer = await signerOf(db, site); if (!signer) return bad('الشهادة موجودة لكنها لم توقَّع بعد (مفتاح التوقيع غير مضبوط)', 409);
    const skills = await skillsById(db, (c as any).skills || []); const out = await signAndStoreCredential(db, c, signer, credDoc(c, skills, site, did));
    return new NextResponse(JSON.stringify(out.vc, null, 2), { headers: { ...VC_HEADERS, 'Content-Disposition': `inline; filename="athar-${code}.vc.json"` } });
  }
  if (u.searchParams.get('status')) {
    const signer = await signerOf(db, site); const revoked = await revokedIndices(db);
    const doc = signer ? await signedStatusList(revoked, signer) : buildStatusListDoc(site, did, encodeStatusList(revoked));
    return new NextResponse(JSON.stringify(doc), { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  }
  const user = await who(req, db); if (!user) return bad('سجّل الدخول', 401); const view = u.searchParams.get('view') || '';
  if (view === 'mine') {
    const { data } = await db.from('portal_vc_issuances').select(ISS_COLS).or(`user_id.eq.${user.id},email.ilike.${user.email}`).order('issued_at', { ascending: false }).limit(100);
    return NextResponse.json({ success: true, configured: !!process.env.VC_SIGNING_KEY, did, issuances: data || [] });
  }
  if (!user.staff) return bad('غير مصرّح', 403);
  if (view === 'keys') {
    const signer = await signerOf(db, site);
    const [{ data: keys }, { count: unsigned }, { count: issued }, { count: snaps }] = await Promise.all([
      db.from('portal_signing_keys').select('*').order('created_at', { ascending: false }).limit(50),
      db.from('portal_credentials').select('id', { count: 'exact', head: true }).is('vc_kid', null).is('revoked_at', null),
      db.from('portal_vc_issuances').select('id', { count: 'exact', head: true }).eq('kind', 'credential'),
      db.from('portal_vc_issuances').select('id', { count: 'exact', head: true }).eq('kind', 'snapshot'),
    ]);
    const { data: recent } = await db.from('portal_vc_issuances').select(ISS_COLS).order('issued_at', { ascending: false }).limit(30);
    return NextResponse.json({ success: true, configured: !!signer, did, did_url: `${site}/.well-known/did.json`, status_url: `${site}/api/vc?status=1`, current: signer ? { kid: signer.kid, multibase: signer.multibase, fingerprint: keyFingerprint(signer.multibase) } : null, keys: keys || [], unsigned: unsigned || 0, issued: issued || 0, snapshots: snaps || 0, recent: recent || [] });
  }
  return bad('طلب غير معروف');
}

export async function POST(req: Request) {
  const db = service(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const site = siteOf(req); const did = didWeb(site);
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ } const action = String(body.action || '');
  if (action === 'verify') {
    if (!allow(ipOf(req), 120)) return bad('محاولات كثيرة — حاول لاحقًا', 429);
    let doc = body.vc; if (typeof doc === 'string') { try { doc = JSON.parse(doc); } catch { return bad('الملف ليس JSON صالحًا'); } }
    if (!doc || typeof doc !== 'object') return bad('أرسل الوثيقة في الحقل vc');
    const signer = signerFromEnv(process.env, site); const res = await verifyDocument(doc, await resolverFor(db, site, signer), statusChecker(db, site));
    return NextResponse.json({ success: true, ...res, verified_at: new Date().toISOString(), verifier: 'server' }, { headers: CORS });
  }
  const user = await who(req, db); if (!user) return bad('سجّل الدخول', 401);
  if (action === 'snapshot') {
    const signer = await signerOf(db, site); if (!signer) return bad('مفتاح التوقيع غير مضبوط بعد — اطلب من الإدارة ضبط VC_SIGNING_KEY', 409);
    const { data: lv } = await db.from('portal_skill_levels').select('skill_id,computed_level,confidence,approved_level,evidence').eq('user_id', user.id).limit(300);
    const rows = ((lv || []) as any[]).filter(r => (r.evidence || []).length > 0 || r.approved_level); if (!rows.length) return bad('لا مستويات مهارات بعد — أضف دليلًا واحدًا على الأقل (اختبار، مهمة، محاكاة)');
    const skills = await skillsById(db, rows.map(r => r.skill_id)); const sm = new Map(skills.map(s => [s.id, s]));
    const levels: SnapshotLevel[] = rows.filter(r => sm.has(r.skill_id)).map(r => ({ skill: sm.get(r.skill_id)!, level: displayLevel(r), approved: r.approved_level !== null && r.approved_level !== undefined, confidence: Number(r.confidence || 0), evidence_count: (r.evidence || []).length })).sort((a, b) => b.level - a.level);
    const code = snapshotCode(() => randomCode(4)); const now = new Date(); const expires = new Date(now.getTime() + 90 * 86400000).toISOString();
    const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'snapshot', credential_id: null, user_id: user.id, email: user.email, full_name: user.name || null, title_ar: `لقطة قدرة — ${now.toISOString().slice(0, 10)}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: expires, issued_by: user.id }).select('id,status_index').single();
    if (error) return bad(error.message, 500);
    const vc = await signDocument(buildSnapshotDoc({ code, name: user.name || user.email, email: user.email, levels, site, did, now, statusIndex: Number((ins as any).status_index) }), signer, now);
    await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id);
    await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'issued', object_type: 'snapshot', object_id: (ins as any).id, skills: levels.map(l => l.skill.id), context: { code, levels: levels.length } }).then(() => null, () => null);
    return NextResponse.json({ success: true, id: (ins as any).id, code, vc, url: `${site}/verify/vc?code=${encodeURIComponent(code)}` });
  }
  if (action === 'revoke_snapshot') {
    const id = String(body.id || ''); const { data } = await db.from('portal_vc_issuances').select('id,kind,user_id,email').eq('id', id).maybeSingle(); if (!data) return bad('غير موجود', 404);
    if ((data as any).kind !== 'snapshot' || !((data as any).user_id === user.id || String((data as any).email || '').toLowerCase() === user.email) && !user.staff) return bad('غير مصرّح', 403);
    await db.from('portal_vc_issuances').update({ revoked_at: new Date().toISOString(), revoke_reason: String(body.reason || 'بطلب صاحبها').slice(0, 200) }).eq('id', id); return NextResponse.json({ success: true });
  }
  if (!user.staff) return bad('غير مصرّح', 403);
  if (action === 'generate_key') {
    const seed = generateSeed(); const k = keyFromSeed(seed); const kid = `${did}#${k.multibase}`;
    return NextResponse.json({ success: true, seed, multibase: multikey(k.pub), kid, fingerprint: keyFingerprint(k.multibase), note: 'انسخ البذرة الآن إلى Vercel → Environment Variables → VC_SIGNING_KEY ثم أعد النشر. لن تُعرض مرة أخرى ولا تُخزَّن في أَثَر.' });
  }
  if (action === 'sign_all' || action === 'resign') {
    const signer = await signerOf(db, site); if (!signer) return bad('VC_SIGNING_KEY غير مضبوط', 409);
    let q = db.from('portal_credentials').select('*').is('revoked_at', null).order('issued_at', { ascending: false }).limit(100);
    q = action === 'resign' ? q.eq('id', String(body.credential_id || '')) : q.is('vc_kid', null);
    const { data: creds, error } = await q; if (error) return bad(error.message, 500);
    const ids = Array.from(new Set(((creds || []) as any[]).flatMap(c => c.skills || []))); const skills = await skillsById(db, ids); const sm = new Map(skills.map(s => [s.id, s]));
    let signed = 0; const errors: string[] = [];
    for (const c of (creds || []) as any[]) { try { await signAndStoreCredential(db, c, signer, credDoc(c, (c.skills || []).map((i: string) => sm.get(i)).filter(Boolean), site, did), user.id); signed++; } catch (e: any) { errors.push(`${c.verify_code}: ${e?.message || e}`); } }
    return NextResponse.json({ success: true, signed, errors: errors.slice(0, 5) });
  }
  return bad('إجراء غير معروف');
}
