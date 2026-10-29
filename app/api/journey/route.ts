// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/journey — رحلة الممارس (P25 · «رحلتي»)
 *  GET  ?code=ATH-J-XXXX-XXXX           (عام)      → النسخة المشتركة (الفصول التي اختار صاحبها كشفها) + رابط التحقق
 *  GET                                   (مستخدم)   → رحلتي: الفصول · تعليقاتي · نسخي المشتركة · رسائلي إلى نفسي
 *  GET  ?view=summary                    (مستخدم/وكيل wallet:read) → ملخص للوكلاء (my_journey)
 *  POST { action:'note', chapter_key, body_ar?, media_id?, kind? }             → «ما تغيّر فيّ» (إنشاء/تحديث)
 *  POST { action:'note_delete', chapter_key }
 *  POST { action:'intro' }                                                      → مقدمة مقترحة (ذكاء اصطناعي من كلماتي أو محلية) — لا تُحفظ إلا بقرار المستخدم
 *  POST { action:'share', chapter_keys[], name_mode?, include_quotes?, intro_ar?, confirm:true } → نسخة موقَّعة Ed25519 + رابط عام
 *  POST { action:'share_revoke', id }
 *  POST { action:'capsule', body_ar?, media_id?, kind?, confirm:true }          → رسالة إلى نفسي بعد 365 يومًا
 *  POST { action:'capsule_cancel', id }
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { delegateFromHeaders } from '../../../lib/portal/oauth';
import { normalizeSite } from '../../../lib/portal/open';
import { randomCode } from '../../../lib/portal/profile';
import { signerFromEnv } from '../../../lib/portal/vc-server';
import { didWeb } from '../../../lib/portal/vc';
import { limitFor, tooMany, ipOf } from '../../../lib/shield/ratelimit';
import { lower } from '../../../lib/councils/registry';
import { loadJourney, journeyIntro } from '../../../lib/journey/load';
import { createShare, revokeShare, myShares, publicShare } from '../../../lib/journey/share';
import { CAPSULE_COLS } from '../../../lib/journey/cron';
import { validateNote, validateShare, validateCapsule, capsuleSnapshot, addDays, CAPSULE_DAYS, journeySummary, JOURNEY_VERSION, SHARE_MONTHS, NOTE_MAX_CHARS, CAPSULE_MIN_CHARS, CAPSULE_MAX_CHARS, INTRO_MAX_CHARS } from '../../../lib/journey/registry';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const PUB = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600', 'Access-Control-Allow-Origin': '*' };
type Who = { id: string; email: string; name: string; delegate: boolean };
async function who(req: Request, db: any): Promise<Who | null> {
  const dg = delegateFromHeaders(req.headers, process.env); if (dg && (dg.scopes as string[]).includes('wallet:read')) return { id: dg.id, email: lower(dg.email), name: dg.name, delegate: true };
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), delegate: false };
}
const NOTE_COLS = 'id,chapter_key,body_ar,media_id,kind,created_at,updated_at';
async function bundle(db: any, me: Who, site: string) {
  const [j, notes, shares, caps] = await Promise.all([
    loadJourney(db, me), db.from('portal_journey_notes').select(NOTE_COLS).eq('user_id', me.id).limit(200).then((r: any) => r.data || [], () => []), myShares(db, me),
    db.from('portal_time_capsules').select(CAPSULE_COLS).eq('user_id', me.id).order('created_at', { ascending: false }).limit(20).then((r: any) => r.data || [], () => []),
  ]);
  return { journey: j, notes, shares: shares.map(s => ({ ...s, url: `${site}/journey/${encodeURIComponent(s.code)}`, verify_url: s.vc_issuance_id ? `${site}/verify/vc?code=${encodeURIComponent(s.code)}` : null })), capsules: caps };
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const u = new URL(req.url); const site = siteOf(req);
  const code = String(u.searchParams.get('code') || '').trim();
  if (code) {
    { const rl = await limitFor(db, 'vc_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
    const r = await publicShare(db, code, site, Date.now(), u.searchParams.get('count') !== '0'); if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status, headers: { 'Access-Control-Allow-Origin': '*' } });
    return NextResponse.json({ success: true, ...r.journey, note_ar: 'كل فصل مشتق من حدث مسجَّل في أَثَر؛ لا شيء مُدّعى. صاحب الرحلة اختار ما يكشفه.' }, { headers: PUB });
  }
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401);
  if (u.searchParams.get('view') === 'summary') {
    const j = await loadJourney(db, me); const shares = await myShares(db, me); const { data: caps } = await db.from('portal_time_capsules').select('status,deliver_at').eq('user_id', me.id).limit(20);
    return NextResponse.json({ success: true, summary: journeySummary(j, shares, (caps || []) as any[]) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const b = await bundle(db, me, site);
  return NextResponse.json({ success: true, me: { id: me.id, email: me.email, name: me.name, delegate: me.delegate }, ...b, rules: { version: JOURNEY_VERSION, share_months: SHARE_MONTHS, capsule_days: CAPSULE_DAYS, note_max: NOTE_MAX_CHARS, capsule_min: CAPSULE_MIN_CHARS, capsule_max: CAPSULE_MAX_CHARS, intro_max: INTRO_MAX_CHARS, signing_ready: !!process.env.VC_SIGNING_KEY } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const site = siteOf(req);
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401); if (me.delegate) return bad('الوكيل يقرأ الرحلة فقط — الكتابة لصاحبها', 403);
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ } const action = String(body.action || ''); const now = new Date();
  const j = await loadJourney(db, me, now.getTime());
  if (action === 'note') {
    const err = validateNote(body, j.chapters); if (err) return bad(err);
    const row = { user_id: me.id, email: me.email, chapter_key: String(body.chapter_key), body_ar: String(body.body_ar || '').trim(), media_id: body.media_id ? String(body.media_id) : null, kind: body.kind ? String(body.kind) : (body.media_id ? 'audio' : 'text'), updated_at: now.toISOString() };
    const { data: ex } = await db.from('portal_journey_notes').select('id').eq('user_id', me.id).eq('chapter_key', row.chapter_key).maybeSingle();
    const q = ex ? db.from('portal_journey_notes').update(row).eq('id', (ex as any).id) : db.from('portal_journey_notes').insert(row);
    const { data, error } = await q.select(NOTE_COLS).single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, note: data, message: 'حُفظ — هذا صوتك أنت على فصلك.' });
  }
  if (action === 'note_delete') { const { error } = await db.from('portal_journey_notes').delete().eq('user_id', me.id).eq('chapter_key', String(body.chapter_key || '')); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
  if (action === 'intro') {
    const { data: notes } = await db.from('portal_journey_notes').select('chapter_key,body_ar').eq('user_id', me.id).limit(100);
    const r = await journeyIntro(db, me, j, (notes || []) as any[]); return NextResponse.json({ success: true, intro: r, note_ar: r.source === 'ai' ? 'صيغت بالذكاء الاصطناعي من كلماتك — عدّلها قبل النشر.' : 'صيغت محليًا من فصولك وكلماتك.' });
  }
  if (action === 'share') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح');
    const err = validateShare(body, j.chapters); if (err) return bad(err);
    const signer = signerFromEnv(process.env, site);
    const r = await createShare(db, me, j.chapters, { chapter_keys: body.chapter_keys.map(String), name_mode: body.name_mode === 'short' ? 'short' : 'full', include_quotes: body.include_quotes !== false, intro_ar: body.intro_ar ? String(body.intro_ar).slice(0, INTRO_MAX_CHARS) : null }, signer, site, didWeb(site), () => randomCode(4), now);
    if (!r.ok) return bad(r.error, 409);
    return NextResponse.json({ success: true, share: r.share, url: r.url, verify_url: r.verify_url, signed_vc: r.signed_vc, message: r.signed_vc ? 'صدرت نسختك الموقَّعة — شارك الرابط مع من تشاء، وألغِه متى شئت.' : 'حُفظت النسخة — ستصدر وثيقتها الموقَّعة حين يُضبط مفتاح التوقيع.' });
  }
  if (action === 'share_revoke') { const r = await revokeShare(db, me, String(body.id || ''), now); if (!r.ok) return bad(r.error || 'تعذّر', 409); return NextResponse.json({ success: true, message: 'أُلغيت النسخة — الرابط لم يعد يعمل والوثيقة أُلغيت.' }); }
  if (action === 'capsule') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح');
    const err = validateCapsule(body); if (err) return bad(err);
    const { data: open } = await db.from('portal_time_capsules').select('id').eq('user_id', me.id).eq('status', 'sealed').limit(1); if ((open || []).length) return bad('لديك رسالة مختومة بالفعل — تُسلَّم في موعدها قبل أن تكتب أخرى', 409);
    const row = { user_id: me.id, email: me.email, full_name: me.name || null, body_ar: String(body.body_ar || '').trim(), media_id: body.media_id ? String(body.media_id) : null, kind: body.kind ? String(body.kind) : (body.media_id ? 'audio' : 'text'), deliver_at: addDays(now, CAPSULE_DAYS), status: 'sealed', snapshot_then: capsuleSnapshot(j), meta: {} };
    const { data, error } = await db.from('portal_time_capsules').insert(row).select(CAPSULE_COLS).single(); if (error || !data) return bad(error?.message || 'تعذّر الحفظ', 500);
    await db.from('portal_learning_events').insert({ user_id: me.id, email: me.email, verb: 'sealed', object_type: 'time_capsule', object_id: String((data as any).id), skills: [], context: { deliver_at: row.deliver_at, chapters: row.snapshot_then.chapters } }).then(() => null, () => null);
    return NextResponse.json({ success: true, capsule: data, message: `خُتمت رسالتك — تصلك في ${new Date(row.deliver_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' })} مع «أين كنت» و«أين صرت».` });
  }
  if (action === 'capsule_cancel') { const { error } = await db.from('portal_time_capsules').update({ status: 'cancelled' }).eq('id', Number(body.id || 0)).eq('user_id', me.id).eq('status', 'sealed'); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
  return bad('إجراء غير معروف');
}
