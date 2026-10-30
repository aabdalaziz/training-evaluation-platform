// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/journey — رحلة الجهة (P26 · «ما تغيّر فينا» · «كتاب السنة»)
 *  GET  ?code=ATH-OY-XXXX-XXXX          (عام)          → كتاب السنة المنشور (فصول مختارة: أعداد وحقب وكلمات الجهة؛ لا أسماء) + رابط التحقق
 *  GET  ?public=1                        (عام)          → رفّ كتب السنة (الجهات التي اختارت الظهور في صفحة المجالس)
 *  GET  ?org=<uuid>                      (مدير جهة/طاقم) → الرحلة: الفصول (k≥5) · المرآة (هذه السنة/الماضية) · تعليقات الجهة · كتبها · رسائلها إلى نفسها
 *  GET  ?org=<uuid>&view=summary                         → ملخص
 *  POST { org, action:'note', chapter_key, body_ar?, media_id?, kind? }           → «ما تغيّر فينا» (إنشاء/تحديث — مدير الجهة فقط)
 *  POST { org, action:'note_delete', chapter_key }
 *  POST { org, action:'intro' }                                                     → مقدمة مقترحة لكتاب السنة (ذكاء اصطناعي من كلمات الجهة أو محلية) — لا تُحفظ إلا بقرار الجهة
 *  POST { org, action:'share', chapter_keys[], intro_ar?, year_label?, show_in_councils?, confirm:true } → كتاب موقَّع Ed25519 + رابط عام
 *  POST { org, action:'share_revoke', id }
 *  POST { org, action:'capsule', body_ar?, media_id?, kind?, confirm:true }         → رسالة الجهة إلى نفسها بعد 365 يومًا (تصل مديريها يومئذ)
 *  POST { org, action:'capsule_cancel', id }
 *  الكتابة لمدير الجهة المؤكَّد فقط؛ طاقم المنصة يقرأ ولا يكتب (صوت الجهة لا يُكتب نيابة عنها).
 */
import { NextResponse } from 'next/server';
import { randomCode } from '../../../../lib/portal/profile';
import { signerFromEnv } from '../../../../lib/portal/vc-server';
import { didWeb } from '../../../../lib/portal/vc';
import { limitFor, tooMany, ipOf } from '../../../../lib/shield/ratelimit';
import { orgCtx, isOrgAdmin, svc, bad, siteOf } from '../../../../lib/org-impact/auth';
import { loadOrgJourney, orgIntro } from '../../../../lib/org-journey/load';
import { createOrgShare, revokeOrgShare, orgShares, publicYearbook, publicYearbooks } from '../../../../lib/org-journey/share';
import { ORG_CAPSULE_COLS } from '../../../../lib/org-journey/cron';
import { validateOrgNote, validateOrgShare, validateOrgCapsule, orgSnapshot, addDays, ORG_CAPSULE_DAYS, ORG_SHARE_MONTHS, ORG_JOURNEY_VERSION, ORG_NOTE_MAX_CHARS, ORG_CAPSULE_MIN_CHARS, ORG_CAPSULE_MAX_CHARS, ORG_INTRO_MAX_CHARS, orgJourneySummary, K_ORG, PRIVACY_ORG_JOURNEY_AR } from '../../../../lib/org-journey/registry';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const PUB = { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600', 'Access-Control-Allow-Origin': '*' };
const NOTE_COLS = 'id,chapter_key,body_ar,media_id,kind,author_email,created_at,updated_at';

export async function GET(req: Request) {
  const u = new URL(req.url); const site = siteOf(req); const code = String(u.searchParams.get('code') || '').trim();
  if (code || u.searchParams.get('public') === '1') {
    const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
    { const rl = await limitFor(db, 'vc_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
    if (!code) { const items = await publicYearbooks(db, site); return NextResponse.json({ success: true, items: items.map(y => ({ ...y, url: `${site}/org-journey/${encodeURIComponent(y.code)}` })), note_ar: 'كتب سنة اختارت جهاتها نشرها: أعداد أشخاص وحقب وكلمات الجهة — لا أسماء، ولا فصل من أقل من خمسة.' }, { headers: PUB }); }
    const r = await publicYearbook(db, code, site, Date.now(), u.searchParams.get('count') !== '0'); if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status, headers: { 'Access-Control-Allow-Origin': '*' } });
    return NextResponse.json({ success: true, ...r.yearbook, note_ar: 'كل فصل مشتق من أحداث مسجَّلة لمنسوبين مؤكَّدين؛ لا يُنشر فصل من أقل من خمسة أشخاص. الجهة اختارت ما تكشفه.' }, { headers: PUB });
  }
  const ctx = await orgCtx(req, String(u.searchParams.get('org') || '')); if ('error' in ctx) return ctx.error; const { db, me, org } = ctx;
  const j = await loadOrgJourney(db, org.id);
  if (u.searchParams.get('view') === 'summary') return NextResponse.json({ success: true, summary: orgJourneySummary(j, await orgShares(db, org.id)) }, { headers: { 'Cache-Control': 'no-store' } });
  const [notes, shares, caps, canWrite] = await Promise.all([
    db.from('portal_org_journey_notes').select(NOTE_COLS).eq('organization_id', org.id).limit(200).then((r: any) => r.data || [], () => []), orgShares(db, org.id),
    db.from('portal_org_time_capsules').select(ORG_CAPSULE_COLS).eq('organization_id', org.id).order('created_at', { ascending: false }).limit(20).then((r: any) => r.data || [], () => []),
    isOrgAdmin(db, org.id, me),
  ]);
  return NextResponse.json({ success: true, org: { id: org.id, name_ar: org.name_ar }, me: { id: me.id, email: me.email, staff: me.staff, can_write: canWrite }, journey: j, notes, shares: shares.map(s => ({ ...s, url: `${site}/org-journey/${encodeURIComponent(s.code)}`, verify_url: s.vc_issuance_id ? `${site}/verify/vc?code=${encodeURIComponent(s.code)}` : null })), capsules: caps,
    rules: { version: ORG_JOURNEY_VERSION, k: K_ORG, share_months: ORG_SHARE_MONTHS, capsule_days: ORG_CAPSULE_DAYS, note_max: ORG_NOTE_MAX_CHARS, capsule_min: ORG_CAPSULE_MIN_CHARS, capsule_max: ORG_CAPSULE_MAX_CHARS, intro_max: ORG_INTRO_MAX_CHARS, signing_ready: !!process.env.VC_SIGNING_KEY, privacy_ar: PRIVACY_ORG_JOURNEY_AR } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const ctx = await orgCtx(req, String(body.org || '')); if ('error' in ctx) return ctx.error; const { db, me, org, site } = ctx;
  if (!(await isOrgAdmin(db, org.id, me))) return bad('صوت الجهة يكتبه مدير الجهة المؤكَّد وحده — الطاقم يقرأ فقط', 403);
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  const action = String(body.action || ''); const now = new Date(); const j = await loadOrgJourney(db, org.id, now.getTime());
  if (action === 'note') {
    const err = validateOrgNote(body, j.chapters); if (err) return bad(err);
    const row = { organization_id: org.id, chapter_key: String(body.chapter_key), body_ar: String(body.body_ar || '').trim(), media_id: body.media_id ? String(body.media_id) : null, kind: body.kind ? String(body.kind) : (body.media_id ? 'audio' : 'text'), author_user_id: me.id, author_email: me.email, updated_at: now.toISOString() };
    const { data: ex } = await db.from('portal_org_journey_notes').select('id').eq('organization_id', org.id).eq('chapter_key', row.chapter_key).maybeSingle();
    const q = ex ? db.from('portal_org_journey_notes').update(row).eq('id', (ex as any).id) : db.from('portal_org_journey_notes').insert(row);
    const { data, error } = await q.select(NOTE_COLS).single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, note: data, message: 'حُفظ — هذا صوت الجهة على فصلها.' });
  }
  if (action === 'note_delete') { const { error } = await db.from('portal_org_journey_notes').delete().eq('organization_id', org.id).eq('chapter_key', String(body.chapter_key || '')); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
  if (action === 'intro') {
    const { data: notes } = await db.from('portal_org_journey_notes').select('chapter_key,body_ar').eq('organization_id', org.id).limit(100);
    const r = await orgIntro(db, me, org.name_ar, j, (notes || []) as any[]); return NextResponse.json({ success: true, intro: r, note_ar: r.source === 'ai' ? 'صيغت بالذكاء الاصطناعي من كلمات الجهة وفصولها — عدّلوها قبل النشر.' : 'صيغت محليًا من فصول الجهة وكلماتها.' });
  }
  if (action === 'share') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح');
    const err = validateOrgShare(body, j.chapters); if (err) return bad(err);
    const { data: notes } = await db.from('portal_org_journey_notes').select('chapter_key,body_ar').eq('organization_id', org.id).limit(200); const noteMap: Record<string, string> = {}; for (const n of ((notes || []) as any[])) if (n.body_ar) noteMap[n.chapter_key] = n.body_ar;
    const r = await createOrgShare(db, org, me, j.chapters, noteMap, { chapter_keys: body.chapter_keys.map(String), intro_ar: body.intro_ar ? String(body.intro_ar).slice(0, ORG_INTRO_MAX_CHARS) : null, year_label: body.year_label ? String(body.year_label) : j.year_label, show_in_councils: body.show_in_councils !== false }, signerFromEnv(process.env, site), site, didWeb(site), () => randomCode(4), j.k, now);
    if (!r.ok) return bad(r.error, 409);
    return NextResponse.json({ success: true, share: r.share, url: r.url, verify_url: r.verify_url, signed_vc: r.signed_vc, message: r.signed_vc ? 'صدر كتاب السنة موقَّعًا — شاركوا الرابط، واسحبوه متى شئتم.' : 'حُفظ الكتاب — تصدر وثيقته الموقَّعة حين يُضبط مفتاح التوقيع.' });
  }
  if (action === 'share_revoke') { const r = await revokeOrgShare(db, org.id, String(body.id || ''), now); if (!r.ok) return bad(r.error || 'تعذّر', 409); return NextResponse.json({ success: true, message: 'سُحب الكتاب — الرابط لم يعد يعمل والوثيقة أُلغيت.' }); }
  if (action === 'capsule') {
    if (body.confirm !== true) return bad('يلزم تأكيد صريح');
    const err = validateOrgCapsule(body); if (err) return bad(err);
    const { data: open } = await db.from('portal_org_time_capsules').select('id').eq('organization_id', org.id).eq('status', 'sealed').limit(1); if ((open || []).length) return bad('للجهة رسالة مختومة بالفعل — تُسلَّم في موعدها قبل أن تكتب أخرى', 409);
    const row = { organization_id: org.id, org_name: org.name_ar, body_ar: String(body.body_ar || '').trim(), media_id: body.media_id ? String(body.media_id) : null, kind: body.kind ? String(body.kind) : (body.media_id ? 'audio' : 'text'), written_by: me.id, written_email: me.email, deliver_at: addDays(now, ORG_CAPSULE_DAYS), status: 'sealed', snapshot_then: orgSnapshot(j), meta: {} };
    const { data, error } = await db.from('portal_org_time_capsules').insert(row).select(ORG_CAPSULE_COLS).single(); if (error || !data) return bad(error?.message || 'تعذّر الحفظ', 500);
    return NextResponse.json({ success: true, capsule: data, message: `خُتمت رسالة الجهة — تصل مديريها يوم ${new Date(row.deliver_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' })} مع «أين كنّا» و«أين صرنا».` });
  }
  if (action === 'capsule_cancel') { const { error } = await db.from('portal_org_time_capsules').update({ status: 'cancelled' }).eq('id', Number(body.id || 0)).eq('organization_id', org.id).eq('status', 'sealed'); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
  return bad('إجراء غير معروف');
}
