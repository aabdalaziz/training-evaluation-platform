// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/vault — خزنة أَثَر للشخص (P22 · PDPL)
 *  GET  ?notice=1&lang=ar|en|json                 → عام: إشعار الخصوصية الحيّ (نموذج) أو privacy.json
 *  GET                                            → صاحب الحساب (Bearer) أو وكيل مفوَّض (wallet:read): خريطة بياناتي · الموافقات · من لمس بياناتي · طلباتي · حالة النسيان · خطة النسيان
 *  GET  ?view=summary                             → موجز مختصر للوكلاء (أداة MCP my_data_summary)
 *  POST { action:'export', format?:'json'|'html' } → نسختي (قابلة للنقل) — يسجَّل طلب اطّلاع منفَّذ فورًا
 *  POST { action:'receipt', hash }                → إيصال موقَّع لنسخة سبق تنزيلها
 *  POST { action:'correct', field, current, requested, reason } → طلب تصحيح (30 يومًا) + إشعار الطاقم
 *  POST { action:'objection', text }              → اعتراض على معالجة
 *  POST { action:'erase' } · { action:'undo' }    → طلب النسيان (حجر 7 أيام) · التراجع من الصفحة
 *  POST { action:'withdraw_consent', scope }      → سحب موافقة من مصدرها: whatsapp · push · share_profile · agent:<id>
 *  الوكيل المفوَّض يقرأ فقط (GET/export)؛ كل ما يغيّر يحتاج صاحب الحساب نفسه.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { delegateFromHeaders } from '../../../lib/portal/oauth';
import { notify } from '../../../lib/portal/notify';
import { subjectCounts, exportSubject, renderExportHtml, touches, signReceipt, liveConsents, sha256 } from '../../../lib/vault/subject';
import { createDsr, openDsrs, cancelDsr, DSR_KIND_AR } from '../../../lib/vault/dsr';
import { requestErasure, erasureStatus, cancelOwnErasure } from '../../../lib/vault/erasure';
import { erasurePlan, NOTICE_DRAFT, NOTICE_VERSION, RIGHTS_AR, ERASURE_HOLD_DAYS, DSR_DAYS } from '../../../lib/vault/registry';
import { noticeModel, privacyJson, orgFromEnv } from '../../../lib/vault/notice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const site = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S) : null; };

type Who = { id: string; email: string; name: string; staff: boolean; delegate: boolean; client?: string };
async function who(req: Request, db: any): Promise<Who | null> {
  const dg = delegateFromHeaders(req.headers, process.env); if (dg && dg.scopes.includes('wallet:read')) return { id: dg.id, email: dg.email, name: dg.name, staff: false, delegate: true, client: dg.client };
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()), delegate: false };
}
const staffEmails = () => String(process.env.DATA_PROTECTION_CONTACT || process.env.NOTIFY_EMAILS || process.env.ADMIN_EMAILS || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);

export async function GET(req: Request) {
  const u = new URL(req.url); const S = site(req);
  if (u.searchParams.get('notice')) {
    const org = orgFromEnv(process.env, S); const lang = u.searchParams.get('lang') || 'ar';
    if (lang === 'json') return NextResponse.json(privacyJson(org), { headers: { 'Cache-Control': 'public, s-maxage=600' } });
    return NextResponse.json({ success: true, notice: noticeModel(org) }, { headers: { 'Cache-Control': 'public, s-maxage=600' } });
  }
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await who(req, db); if (!me) return bad('سجّل الدخول أولًا', 401);
  const view = u.searchParams.get('view') || 'full';
  const [map, consents, reqs, er] = await Promise.all([subjectCounts(db, me), liveConsents(db, me), openDsrs(db, { email: me.email, limit: 20 }), erasureStatus(db, me.id, me.email)]);
  const total = map.reduce((a, b) => a + (b.count || 0), 0); const nonEmpty = map.filter(m => (m.count || 0) > 0);
  if (view === 'summary') {
    return NextResponse.json({ success: true, summary: { email: me.email, tables_with_data: nonEmpty.length, rows_total: total, categories: Array.from(new Set(nonEmpty.map(m => m.category_ar))), consents_on: consents.items.filter(c => c.on).map(c => c.label_ar), open_requests: reqs.map(r => ({ kind: DSR_KIND_AR[r.kind], due: String(r.due_at).slice(0, 10) })), erasure_pending: er ? String(er.execute_after).slice(0, 10) : null, rights_ar: RIGHTS_AR.map(r => r.title), self_service: `${S}/me/data`, notice: `${S}/privacy`, notice_version: NOTICE_VERSION, via: me.delegate ? `وكيل: ${me.client}` : 'صاحب الحساب' } });
  }
  const t = me.delegate ? [] : await touches(db, me);
  return NextResponse.json({ success: true, me: { id: me.id, email: me.email, name: me.name, delegate: me.delegate }, map, totals: { rows: total, tables: nonEmpty.length }, consents, touches: t, requests: reqs, erasure: er ? { id: er.id, execute_after: er.execute_after, created_at: er.created_at } : null, plan: erasurePlan(), notice: { version: NOTICE_VERSION, draft: NOTICE_DRAFT, url: `${S}/privacy` }, timelines: { dsr_days: DSR_DAYS, hold_days: ERASURE_HOLD_DAYS }, rights: RIGHTS_AR });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await who(req, db); if (!me) return bad('سجّل الدخول أولًا', 401);
  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  const action = String(body?.action || ''); const S = site(req);
  if (action === 'export') {
    const doc = await exportSubject(db, me);
    await createDsr(db, { user_id: me.id, email: me.email, full_name: me.name, kind: 'access', details: { via: me.delegate ? `agent:${me.client}` : 'me_data', format: body.format || 'json' }, autoDone: { hash: doc.hash, tables: Object.keys(doc.tables).length, instant: true } });
    if (body.format === 'html') return new NextResponse(renderExportHtml(doc), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="athar-my-data-${doc.generated_at.slice(0, 10)}.html"`, 'Cache-Control': 'no-store' } });
    return NextResponse.json(doc, { headers: { 'Content-Disposition': `attachment; filename="athar-my-data-${doc.generated_at.slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
  }
  if (me.delegate) return bad('الوكيل المفوَّض يقرأ فقط؛ التغييرات لصاحب الحساب نفسه', 403);
  if (action === 'receipt') {
    const hash = String(body.hash || ''); if (!/^sha256:[0-9a-f]{64}$/.test(hash)) return bad('بصمة غير صالحة');
    const receipt = await signReceipt({ kind: 'export', subject_hash: 'sha256:' + sha256(me.email).slice(0, 32), export_hash: hash }, process.env, S);
    return NextResponse.json({ success: true, receipt });
  }
  if (action === 'correct' || action === 'objection') {
    const details = action === 'correct' ? { field: String(body.field || '').slice(0, 120), current: String(body.current || '').slice(0, 400), requested: String(body.requested || '').slice(0, 400), reason: String(body.reason || '').slice(0, 600) } : { text: String(body.text || '').slice(0, 1500) };
    if (action === 'correct' && (!details.field || !(details as any).requested)) return bad('حدّد الحقل والقيمة الصحيحة');
    if (action === 'objection' && String((details as any).text || '').trim().length < 10) return bad('اشرح اعتراضك في جملة على الأقل');
    const r = await createDsr(db, { user_id: me.id, email: me.email, full_name: me.name, kind: action === 'correct' ? 'correction' : 'objection', details });
    if (r.error) return bad(r.error, 500);
    if (!r.duplicate) {
      const kindAr = action === 'correct' ? 'تصحيح' : 'اعتراض';
      try { await notify(db, { kind: 'correction_received', to: { email: me.email, name: me.name }, subject: `استلمنا طلب ${kindAr} — أَثَر`, text: `استلمنا طلبك (#${r.row?.id}) وسنردّ خلال ${DSR_DAYS} يومًا على الأكثر. تتابعه من ${S}/me/data`, url: `${S}/me/data`, ref: `dsr:${r.row?.id}` }); } catch { /* */ }
      for (const to of staffEmails()) { try { await notify(db, { kind: 'dsr_received', to: { email: to }, subject: `خزنة أَثَر: طلب ${kindAr} جديد #${r.row?.id}`, text: `${me.email}\n${JSON.stringify(details, null, 1)}\n${S}/admin/vault`, url: `${S}/admin/vault`, ref: `dsr:${r.row?.id}` }); } catch { /* */ } }
    }
    return NextResponse.json({ success: true, request: r.row, duplicate: r.duplicate });
  }
  if (action === 'cancel_request') { const ok = await cancelDsr(db, Number(body.id), me.email); return ok ? NextResponse.json({ success: true }) : bad('الطلب غير موجود أو مغلق', 404); }
  if (action === 'erase') {
    if (me.staff) return bad('حسابات الطاقم تُنسى عبر زميل مدير من غرفة الطلبات (حماية من فقد آخر مدير)', 403);
    const r = await requestErasure(db, me, S, process.env); if (!r.ok) return bad(r.error || 'تعذّر', 500);
    return NextResponse.json({ success: true, duplicate: r.duplicate, execute_after: r.queue?.execute_after, plan: r.plan });
  }
  if (action === 'undo') { const ok = await cancelOwnErasure(db, me.id, me.email); return NextResponse.json({ success: ok, message: ok ? 'أُوقف النسيان' : 'لا طلب نسيان قائم' }); }
  if (action === 'withdraw_consent') {
    const scope = String(body.scope || ''); let done = false; let how = '';
    if (scope === 'whatsapp') { const { error } = await db.from('portal_contact_prefs').update({ whatsapp_opt_in: false, preferred_channel: 'email' }).ilike('email', me.email); done = !error; how = 'أُوقفت رسائل واتساب'; }
    else if (scope === 'push') { const { error } = await db.from('portal_push_subscriptions').update({ active: false }).eq('user_id', me.id); await db.from('portal_contact_prefs').update({ push_ok: false }).ilike('email', me.email).then(() => null, () => null); done = !error; how = 'أُلغيت تنبيهات المتصفح لكل أجهزتك'; }
    else if (scope === 'share_profile') { const { error } = await db.from('portal_profiles').update({ share_mode: 'private' }).eq('user_id', me.id); done = !error; how = 'صار ملفك خاصًا'; }
    else if (scope.startsWith('agent:')) { const id = scope.slice(6); const { data } = await db.from('portal_delegations').update({ revoked_at: new Date().toISOString() }).eq('id', id).or(`user_id.eq.${me.id},email.ilike.${me.email}`).select('id').maybeSingle(); done = !!data; how = 'أُلغي تفويض الوكيل'; }
    else return bad('نطاق غير معروف');
    if (done) await db.from('portal_consents').insert({ user_id: me.id, email: me.email, scope, withdrawn_at: new Date().toISOString(), source: 'me_data' }).then(() => null, () => null);
    return done ? NextResponse.json({ success: true, message: how }) : bad('تعذّر السحب', 500);
  }
  return bad('إجراء غير معروف');
}
