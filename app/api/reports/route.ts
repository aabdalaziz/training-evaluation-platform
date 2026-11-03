// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/reports — P46 «محور التقارير» (توثيق الجودة والأداء) — ر1: تقرير التعلّم الأسبوعي
 *  GET  ?meta=1            → الأسماء · مفتاح التقدير · الحدود (عام)
 *  GET  ?verify=<code>     → التحقّق العام من تقرير معتمَد (بلا أسماء طلاب ولا درجات)
 *  GET  ?lines=1           → «سطر لك من تقرير الأسبوع» الذي وصلني (مسجَّل)
 *  GET  ?id=<id>           → تقرير واحد (المؤلّف أو الطاقم)
 *  GET  ?admin=1           → الطاقم: كل التقارير
 *  GET                     → نطاقي (برامجي وشُعبي) + تقاريري
 *  POST create {program_id, classroom_id?, period_from?, period_to?} · save {id, body?, students?, lines?, lines_ok?} · recompute {id}
 *       submit {id} · approve {id} · return {id, note} · delete {id} · template {program_id, skills, strategies} · phrase {id}
 *  الذكاء الاصطناعي يصوغ جملًا من الأرقام فقط (phrase) ولا يُحفظ منها شيء حتى يعتمدها المعلّم؛ لا تقديرات ولا توصيات.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { runAi, aiUsage, logAi, aiStatus } from '../../../lib/ai/athar';
import { P46_NAMES_AR, STATUS_AR, GRADES, GRADE_KEY_AR, FIT_AR, ACHIEVED_AR, APPLIED_AR, RESPONSE_AR, SUMMATIVE_TOOLS_AR, WEEK_DAYS_AR, PASS_MARK, REGULAR_PCT, TEXT_MAX, SHORT_MAX, LINE_MAX, MAX_ACTIVITIES, MAX_TOOLS, publicVerifyView, localPhrases, parsePhrases, phrasePrompt, canView, weekBounds, type Computed, type StudentRow } from '../../../lib/reports/registry';
import { myScope, myReports, adminReports, myLines, reportById, verifyReport, view, createReport, saveReport, recomputeReport, submitReport, decideReport, deleteReport, saveTemplate, mayReportOn } from '../../../lib/reports/load';
import type { Me } from '../../../lib/reports/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400, extra: any = {}) => NextResponse.json({ success: false, error, ...extra }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const ID = /^[0-9a-z-]{1,40}$/i;
const staffEmails = () => String(process.env.NOTIFY_EMAILS || process.env.ADMIN_EMAILS || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
const META = { names_ar: P46_NAMES_AR, status_ar: STATUS_AR, grades: GRADES, grade_key_ar: GRADE_KEY_AR, fit_ar: FIT_AR, achieved_ar: ACHIEVED_AR, applied_ar: APPLIED_AR, response_ar: RESPONSE_AR, summative_tools_ar: SUMMATIVE_TOOLS_AR, week_days_ar: WEEK_DAYS_AR, pass_mark: PASS_MARK, regular_pct: REGULAR_PCT, text_max: TEXT_MAX, short_max: SHORT_MAX, line_max: LINE_MAX, max_activities: MAX_ACTIVITIES, max_tools: MAX_TOOLS, ai: aiStatus().enabled };

async function who(req: Request, db: any): Promise<Me | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name,role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '').trim(), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const sp = new URL(req.url).searchParams;
  if (sp.get('meta')) return NextResponse.json({ success: true, ...META });
  if (sp.get('verify')) { const code = String(sp.get('verify') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); const r = code ? await verifyReport(db, code) : null; return NextResponse.json({ success: true, report: r ? publicVerifyView(r) : null }); }
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401);
  if (sp.get('lines')) return NextResponse.json({ success: true, lines: await myLines(db, me), names_ar: P46_NAMES_AR });
  if (sp.get('id')) { const id = String(sp.get('id') || ''); if (!ID.test(id)) return bad('معرّف غير صالح'); const r = await reportById(db, id); if (!r) return bad('التقرير غير موجود', 404); if (!canView(r, me)) return bad('غير مصرّح', 403); return NextResponse.json({ success: true, report: view(r, me), me: { staff: me.staff, email: me.email }, ...META }); }
  if (sp.get('admin')) { if (!me.staff) return bad('غير مصرّح', 403); const rows = await adminReports(db); return NextResponse.json({ success: true, items: rows.map(r => view(r, me)), ...META }); }
  const scope = await myScope(db, me); const mine = await myReports(db, me); const wb = weekBounds(new Date().toISOString().slice(0, 10));
  return NextResponse.json({ success: true, scope, mine: mine.map(r => view(r, me)), week: wb, me: { staff: me.staff, email: me.email, name: me.name }, ...META });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401); const site = siteOf(req);
  let body: any = {}; try { body = await req.json(); } catch { return bad('طلب غير صالح'); } const action = String(body.action || ''); const id = String(body.id || '');
  if (action === 'create') { const pid = String(body.program_id || ''); if (!ID.test(pid)) return bad('اختر البرنامج'); const cid = body.classroom_id ? String(body.classroom_id) : null; if (cid && !ID.test(cid)) return bad('معرّف الشعبة غير صالح'); const r = await createReport(db, me, { program_id: pid, classroom_id: cid, period_from: body.period_from, period_to: body.period_to }); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, report: view(r.report, me) }); }
  if (action === 'template') { const pid = String(body.program_id || ''); if (!ID.test(pid)) return bad('اختر البرنامج'); const scope = await myScope(db, me); if (!mayReportOn(scope, me, pid, null)) return bad('غير مصرّح', 403); const r = await saveTemplate(db, me, pid, body.skills, body.strategies); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, skills: r.skills, strategies: r.strategies }); }
  if (!ID.test(id)) return bad('معرّف غير صالح');
  if (action === 'save') { const r = await saveReport(db, me, id, { body: body.body, students: body.students, lines: body.lines, lines_ok: body.lines_ok }); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, report: view(r.report, me) }); }
  if (action === 'recompute') { const r = await recomputeReport(db, me, id); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, report: view(r.report, me) }); }
  if (action === 'submit') { const r = await submitReport(db, me, id, site, staffEmails()); if (!r.ok) return bad(r.error, 400, { missing: r.missing || [] }); return NextResponse.json({ success: true }); }
  if (action === 'approve' || action === 'return') { const r = await decideReport(db, me, id, action, String(body.note || ''), site); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, verify_code: r.verify_code || null, lines_sent: r.lines_sent || 0 }); }
  if (action === 'delete') { const r = await deleteReport(db, me, id); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true }); }
  if (action === 'phrase') {
    const r = await reportById(db, id); if (!r) return bad('التقرير غير موجود', 404); if (!canView(r, me)) return bad('غير مصرّح', 403);
    const c: Computed = r.computed; const students: StudentRow[] = Array.isArray(r.students) ? r.students : [];
    const usage = await aiUsage(db, me.id, 'report_phrase'); const local = () => localPhrases(c, students, c.skills || []);
    if (!usage.allowed) return NextResponse.json({ success: true, phrases: local(), source: 'local', note_ar: 'بلغت حدّ الاستخدام اليومي — هذه صياغة محلية من الأرقام' });
    const p = phrasePrompt(c, students, c.skills || []); const res = await runAi({ system: p.system, user: p.user, parse: parsePhrases, local, budgetMs: 20000, json: true });
    await logAi(db, { user_id: me.id, email: me.email, role: me.staff ? 'staff' : 'trainer', purpose: 'report_phrase', result: res, context: { report: id, week: r.week_no } });
    return NextResponse.json({ success: true, phrases: res.data, source: res.source, note_ar: res.source === 'ai' ? 'صاغها الذكاء الاصطناعي من أرقامك — لا تُحفظ حتى تعتمدها' : 'صياغة محلية من الأرقام' });
  }
  return bad('فعل غير معروف');
}
