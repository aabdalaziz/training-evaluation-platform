// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/vault/admin — غرفة الطلبات (الطاقم فقط · P22)
 *  GET  ?view=all|requests|incidents|queue|retention|ropa  (ropa&format=csv → ملف CSV لسجل أنشطة المعالجة)
 *  POST { action:'dsr_extend', id, reason } · { action:'dsr_close', id, status:'done'|'rejected', result }
 *       { action:'incident_open', summary, tables[], affected_count?, severity?, security_event_id?, discovered_at? }
 *       { action:'incident_report', id, sdaia_ref, affected_notified? } · { action:'incident_close', id, status:'closed'|'dismissed', actions }
 *       { action:'incident_notify', id }              → إرسال إشعار المتأثرين (بريدهم من الجداول المتأثرة إن أمكن، وإلا نصّ جاهز)
 *       { action:'retention_run', dry? }              → تشغيل سياسات الاحتفاظ الآن (معاينة بالعدّ افتراضيًا)
 *       { action:'erasure_execute_now', id }          → تنفيذ نسيان قبل انتهاء الحجر (بطلب صريح من الشخص)
 *       { action:'erasure_for', email }               → فتح نسيان لحساب (طلب وصل بقناة أخرى أو حساب طاقم)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { allDsrs, extendDsr, closeDsr, dsrSummary } from '../../../../lib/vault/dsr';
import { listIncidents, openIncident, markReported, closeIncident, sdaiaDraft, affectedNotice, hoursLeft } from '../../../../lib/vault/incidents';
import { queueList, executeErasure, requestErasure } from '../../../../lib/vault/erasure';
import { runRetention } from '../../../../lib/vault/cron';
import { REGISTRY, PROCESSORS, BASIS_AR, POLICY_AR, CATEGORY_AR, ACCESS_AR, NOTICE_DRAFT, NOTICE_VERSION, personalTables } from '../../../../lib/vault/registry';
import { retentionText } from '../../../../lib/vault/subject';
import { orgFromEnv } from '../../../../lib/vault/notice';
import { notify } from '../../../../lib/portal/notify';
import { securityEvent } from '../../../../lib/shield/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const site = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');

async function ctx(req: Request) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SV = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !A || !SV) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول أولًا', 401) };
  const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const db = createClient(U, SV); const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) return { error: bad('هذه الغرفة للطاقم', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || '') } };
}

function ropaRows() {
  return REGISTRY.filter(r => r.policy !== 'none').map(r => ({ activity: r.label_ar, activity_en: r.label_en, table: r.table, category: CATEGORY_AR[r.category], purpose: r.purpose_ar, data: r.data_ar, basis: BASIS_AR[r.basis], retention: retentionText(r), on_erasure: POLICY_AR[r.policy], recipients: r.access.map(a => ACCESS_AR[a]).join(' / '), processors: 'Supabase · Vercel' + (r.category === 'agents' ? ' · مزوّد الذكاء الاصطناعي' : '') + (r.category === 'communication' ? ' · Resend / Meta' : '') + (r.table === 'portal_invoices' ? ' · Moyasar' : ''), cross_border: 'نعم (مزوّدو السحابة خارج المملكة) — يُراجع عند الهجرة', legacy: r.legacy ? 'منصة التقييم' : 'بوابة أَثَر' }));
}
const csvCell = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  const u = new URL(req.url); const view = u.searchParams.get('view') || 'all'; const S = site(req); const org = orgFromEnv(process.env, S);
  if (view === 'ropa') {
    const rows = ropaRows();
    if (u.searchParams.get('format') === 'csv') {
      const head = ['النشاط', 'Activity', 'الجدول', 'الفئة', 'الغرض', 'البيانات', 'الأساس النظامي', 'مدة الاحتفاظ', 'عند النسيان', 'المتلقون', 'المعالجون', 'نقل عابر للحدود', 'المصدر'];
      const csv = '\ufeff' + [head.join(','), ...rows.map(r => [r.activity, r.activity_en, r.table, r.category, r.purpose, r.data, r.basis, r.retention, r.on_erasure, r.recipients, r.processors, r.cross_border, r.legacy].map(csvCell).join(','))].join('\n');
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="athar-ropa-${NOTICE_VERSION}.csv"` } });
    }
    return NextResponse.json({ success: true, controller: org, rows, processors: PROCESSORS, version: NOTICE_VERSION, draft: NOTICE_DRAFT });
  }
  const out: any = { success: true, org, notice: { version: NOTICE_VERSION, draft: NOTICE_DRAFT }, registry: { tables: personalTables().length, processors: PROCESSORS.length } };
  if (view === 'all' || view === 'requests') { const rows = await allDsrs(c.db); out.requests = rows; out.summary = dsrSummary(rows); }
  if (view === 'all' || view === 'incidents') { const rows = await listIncidents(c.db); out.incidents = rows.map(i => ({ ...i, hours_left: Math.round(hoursLeft(i.deadline_at) * 10) / 10, draft: sdaiaDraft(i, { name: org.legal, contact: org.contact || org.site, site: org.site }) })); }
  if (view === 'all' || view === 'queue') out.queue = await queueList(c.db);
  if (view === 'all' || view === 'retention') { out.retention_preview = await runRetention(c.db, true); const { data } = await c.db.from('portal_retention_log').select('*').order('at', { ascending: false }).limit(50); out.retention_log = data || []; }
  if (view === 'all') { const { data: ev } = await c.db.from('portal_security_events').select('id,at,kind,severity,actor').eq('severity', 'critical').order('at', { ascending: false }).limit(10); out.critical_events = ev || []; }
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error;
  let b: any = {}; try { b = await req.json(); } catch { /* */ }
  const a = String(b?.action || ''); const S = site(req); const org = orgFromEnv(process.env, S);
  if (a === 'dsr_extend') {
    const r = await extendDsr(c.db, Number(b.id), String(b.reason || ''), c.user.id); if (!r.ok) return bad(r.error || 'تعذّر');
    try { await notify(c.db, { kind: 'dsr_due', to: { email: r.row!.email, name: r.row!.full_name }, subject: 'تمديد مهلة طلبك — أَثَر', text: `نحتاج 30 يومًا إضافية للردّ على طلبك (#${r.row!.id}) للسبب التالي: ${r.row!.extension_reason}. الموعد الجديد: ${String(r.row!.due_at).slice(0, 10)}.`, url: `${S}/me/data`, ref: `dsr:${r.row!.id}:ext` }); } catch { /* */ }
    return NextResponse.json({ success: true, request: r.row });
  }
  if (a === 'dsr_close') {
    const r = await closeDsr(c.db, Number(b.id), b.status === 'rejected' ? 'rejected' : 'done', b.result || {}, c.user.id); if (!r.ok) return bad(r.error || 'تعذّر');
    const done = r.row!.status === 'done';
    try { await notify(c.db, { kind: 'dsr_received', to: { email: r.row!.email, name: r.row!.full_name }, subject: done ? 'نُفِّذ طلبك — أَثَر' : 'ردّنا على طلبك — أَثَر', text: done ? `نُفِّذ طلبك (#${r.row!.id}). ${String(b.result?.note || '')}`.trim() : `تعذّر تنفيذ طلبك (#${r.row!.id}) للسبب: ${String(b.result?.reason || '')}. يمكنك الاعتراض من صفحة «ذاكرتي» أو مراسلة ${org.contact}.`, url: `${S}/me/data`, ref: `dsr:${r.row!.id}:close` }); } catch { /* */ }
    return NextResponse.json({ success: true, request: r.row });
  }
  if (a === 'incident_open') {
    const r = await openIncident(c.db, { summary: String(b.summary || ''), tables: Array.isArray(b.tables) ? b.tables.map(String) : [], affected_count: b.affected_count != null ? Number(b.affected_count) : null, severity: b.severity, security_event_id: b.security_event_id ? Number(b.security_event_id) : null, discovered_at: b.discovered_at, created_by: c.user.id, actions: b.actions });
    if (!r.row) return bad(r.error || 'تعذّر');
    await securityEvent(c.db, { severity: 'warn', kind: 'incident_opened', actor: c.user.email, user_id: c.user.id, meta: { incident_id: r.row.id, tables: r.row.tables } }).catch(() => null);
    return NextResponse.json({ success: true, incident: r.row, draft: sdaiaDraft(r.row, { name: org.legal, contact: org.contact || org.site, site: org.site }) });
  }
  if (a === 'incident_report') { const r = await markReported(c.db, Number(b.id), String(b.sdaia_ref || ''), !!b.affected_notified); return r.ok ? NextResponse.json({ success: true, incident: r.row }) : bad(r.error || 'تعذّر'); }
  if (a === 'incident_close') { const r = await closeIncident(c.db, Number(b.id), b.status === 'dismissed' ? 'dismissed' : 'closed', String(b.actions || '')); return r.ok ? NextResponse.json({ success: true, incident: r.row }) : bad(r.error || 'تعذّر'); }
  if (a === 'incident_notify') {
    const { data: i } = await c.db.from('portal_incidents').select('*').eq('id', Number(b.id)).maybeSingle(); if (!i) return bad('الحادثة غير موجودة', 404);
    const emails: string[] = Array.isArray(b.emails) ? b.emails.map((e: any) => String(e).toLowerCase()).filter((e: string) => /@/.test(e)).slice(0, 500) : [];
    const n = affectedNotice(i, { name: org.legal, contact: org.contact || org.site }); let sent = 0;
    for (const e of emails) { try { const d = await notify(c.db, { kind: 'incident_due', to: { email: e }, subject: n.subject, text: n.text, url: `${S}/privacy`, ref: `incident:${i.id}` }); if (d.ok) sent++; } catch { /* */ } }
    if (sent) await c.db.from('portal_incidents').update({ affected_notified_at: new Date().toISOString() }).eq('id', i.id);
    return NextResponse.json({ success: true, sent, notice: n });
  }
  if (a === 'retention_run') { const dry = b.dry !== false; const r = await runRetention(c.db, dry); await securityEvent(c.db, { severity: 'info', kind: 'retention_run', actor: c.user.email, user_id: c.user.id, meta: { dry, rows: r } }).catch(() => null); return NextResponse.json({ success: true, dry, result: r }); }
  if (a === 'erasure_execute_now') {
    const { data: q } = await c.db.from('portal_erasure_queue').select('*').eq('id', Number(b.id)).is('executed_at', null).is('cancelled_at', null).maybeSingle(); if (!q) return bad('لا صفّ حجر قائم بهذا الرقم', 404);
    const r = await executeErasure(c.db, q, S, process.env);
    await securityEvent(c.db, { severity: 'warn', kind: 'erasure_executed', actor: c.user.email, user_id: c.user.id, meta: { queue_id: q.id, auth_deleted: r.authDeleted, receipt: r.receipt.hash } }).catch(() => null);
    return NextResponse.json({ success: true, receipt: r.receipt, counts: r.counts });
  }
  if (a === 'erasure_for') {
    const email = String(b.email || '').toLowerCase().trim(); if (!/@/.test(email)) return bad('بريد غير صالح');
    const { data: u } = await c.db.from('portal_org_members').select('user_id,full_name').ilike('email', email).limit(1); let uid = u?.[0]?.user_id || null; let name = u?.[0]?.full_name || null;
    if (!uid) { const { data: p } = await c.db.from('portal_enrollments').select('user_id,full_name').ilike('email', email).not('user_id', 'is', null).limit(1); uid = p?.[0]?.user_id || null; name = name || p?.[0]?.full_name || null; }
    if (!uid) return bad('لم نجد حساب دخول بهذا البريد — إن كان ضيفًا بلا حساب فاستعمل النسيان بالبريد من SQL أو أضف الحساب أولًا', 404);
    const r = await requestErasure(c.db, { id: uid, email, name }, S, process.env); if (!r.ok) return bad(r.error || 'تعذّر', 500);
    return NextResponse.json({ success: true, duplicate: r.duplicate, queue: r.queue });
  }
  return bad('إجراء غير معروف');
}
