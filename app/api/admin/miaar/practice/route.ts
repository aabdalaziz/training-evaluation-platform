// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar/practice — م10 «مِران»: الطاقم (الذكاء يقترح الخطّة، الإنسان يعتمدها)
 *  GET ?invite=<id>         → لكل متعلّم مؤهَّل (حكم نهائي مشروط/لم يجتز): ملخّص خطّته إن وُجدت + مسوَّدة مقترحة (بلا حفظ) لمن لا خطّة له
 *  GET ?plan=<id>           → الخطّة كاملة (الأيام · الملاحظات · التقدّم · المرآة · الجاهزية · المحاولات مجمَّعة باليوم)
 *  POST {action}
 *    draft       {report_id}                                   → مسوَّدة محفوظة (أو القائمة)
 *    approve     {plan_id | report_id, edits?:[{day,unit?,note_ar?,note_audio?}]} → اعتماد بتوقيع المستخدم + إشعار المتعلّم (P39)
 *    approve_all {invite_id}                                   → مسوَّدة+اعتماد لكل مؤهَّل بلا خطّة (الاستثناء بحذف الصفّ من الواجهة قبل الإرسال: skip[])
 *    edit_day    {plan_id, day, unit?, note_ar?, note_audio?}  → تعديل يوم (قبل أو بعد الاعتماد؛ الأيام المنجزة لا تتغيّر وحدتها)
 *    nudge       {plan_id}                                     → تذكير إنساني بتوقيع المدرّب (مرّة في اليوم)
 *    cancel      {plan_id}
 *  لا يقرّر الذكاء الاصطناعي هنا شيئًا؛ ولا تُمسّ النتيجة الرسمية.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { normalizeSite } from '../../../../../lib/portal/open';
import { listUnits, unitIndex, approvedFor } from '../../../../../lib/miaar/syllabus';
import type { ExitLevel } from '../../../../../lib/miaar/syllabus';
import { PRACTICE_TITLE, PLAN_DAYS, NOTE_MAX, lastClientRequest, eligibleReport, planDays, draftPlan, approvePlan, editDay, cancelPlan, nudge, planById, summariesForReports, validateDayEdit, currentDay, STATUS_AR } from '../../../../../lib/miaar/practice';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-zA-Z-]{2,40}$/.test(v);
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role, name: String((prof as any)?.full_name || '').trim() || String(data.user.email || '').split('@')[0] } };
}
const REP_COLS = 'id, invite_id, candidate_email, access_code, report, user_id, created_at';
async function eligibleReports(db: any, inviteId: string) {
  const { data } = await db.from('placement_reports').select(REP_COLS).eq('invite_id', inviteId).limit(500);
  return (Array.isArray(data) ? data : []).filter((r: any) => eligibleReport(r.report).ok);
}
/* م11: نطاقات السجلّ — تقارير محدّدة أو شعبة (عبر قرارات التسكين) */
async function reportsByIds(db: any, ids: string[]) { if (!ids.length) return []; const { data } = await db.from('placement_reports').select(REP_COLS).in('id', ids.slice(0, 200)); return (Array.isArray(data) ? data : []).filter((r: any) => eligibleReport(r.report).ok); }
async function reportsByClassroom(db: any, classroomId: string) { const { data: dec } = await db.from('placement_decisions').select('report_id').eq('classroom_id', classroomId).eq('decision_status', 'approved').limit(500); return reportsByIds(db, (Array.isArray(dec) ? dec : []).map((d: any) => String(d.report_id))); }
const idsParam = (v: string | null) => (v || '').split(',').map((x) => x.trim()).filter(isId).slice(0, 200);
const learnerName = (r: any) => String(r?.report?.بيانات_المتقدم?.الاسم || '').trim() || String(r?.candidate_email || '');

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const u = new URL(req.url);
  const invite = u.searchParams.get('invite'); const plan = u.searchParams.get('plan'); const reportIds = idsParam(u.searchParams.get('reports')); const classroom = u.searchParams.get('classroom');
  if (invite || reportIds.length || classroom) {
    if (invite && !isId(invite)) return bad('دعوة غير صالحة'); if (classroom && !isId(classroom)) return bad('شعبة غير صالحة');
    const reps = invite ? await eligibleReports(db, invite) : classroom ? await reportsByClassroom(db, classroom) : await reportsByIds(db, reportIds);
    const sums = await summariesForReports(db, reps); const units = await listUnits(db).catch(() => []); const ix = unitIndex(units);
    const rows = reps.map((r: any) => { const el = eligibleReport(r.report); const s = sums[r.id] || null; const level = el.ok ? el.level : ''; const weak = el.ok ? el.units : [];
      const pu = weak.length ? weak : approvedFor(units as any, level as ExitLevel).slice(0, 3).map((x) => x.code);
      const productive = el.ok && (el.kind === 'exit' ? el.skill === 'writing' || el.skill === 'speaking' : level !== 'A1');
      const proposed = s ? null : { units: pu, days: planDays(pu, productive) };
      const ex = r.report?.exit || null;
      return { kind: el.ok ? el.kind : 'exit', report_id: r.id, code: r.access_code, name: learnerName(r), email: r.candidate_email, outcome: ex ? ex.النتيجة : 'placement', level, skill: el.ok ? el.skill : null, retake: ex?.الإعادة || null, plan: s, proposed, unit_titles: Object.fromEntries((s?.units || proposed?.units || []).map((code: string) => [code, ix.get(code)?.title_ar || code])) }; });
    /* م12 «مِران للجهات»: آخر طلب من الجهة الطالبة (إن كانت الدعوة أمر خدمة) — ليعرضه الطاقم ويقرّر */
    let client_request: any = null;
    if (invite) { try { const { data: o } = await db.from('miaar_service_orders').select('id, client_name, events').eq('invite_id', invite).maybeSingle(); const lr = o ? lastClientRequest(o.events) : null;
      if (o && lr) { const after = rows.filter((r: any) => r.plan && r.plan.status !== 'draft' && r.plan.status !== 'cancelled' && r.plan.approved_at && r.plan.approved_at >= lr.at).length; client_request = { ...lr, client_name: o.client_name, order_id: o.id, approved_after: after, pending: rows.filter((r: any) => !r.plan || r.plan.status === 'draft').length }; } } catch { client_request = null; } }
    return NextResponse.json({ success: true, title: PRACTICE_TITLE, days: PLAN_DAYS, rows, status_ar: STATUS_AR, client_request }, { headers: NO });
  }
  if (plan) {
    if (!isId(plan)) return bad('خطّة غير صالحة'); const p = await planById(db, plan); if (!p) return bad('الخطّة غير موجودة', 404);
    const { data: rep } = await db.from('placement_reports').select(REP_COLS).eq('id', p.report_id).maybeSingle(); const sums = rep ? await summariesForReports(db, [rep]) : {};
    const units = await listUnits(db).catch(() => []); const ix = unitIndex(units); const level_units = approvedFor(units as any, p.level as ExitLevel).map((x) => ({ code: x.code, title_ar: x.title_ar }));
    let attempts: any[] = []; try { const { data } = await db.from('miaar_practice_attempts').select('day, kind, item_code, correct, at, payload').eq('plan_id', p.id).order('at', { ascending: true }).limit(2000); attempts = Array.isArray(data) ? data : []; } catch { attempts = []; }
    const byDay: Record<number, { n: number; correct: number; text: string | null }> = {}; for (const a of attempts) { const r = (byDay[a.day] ||= { n: 0, correct: 0, text: null }); if (a.kind === 'item') { r.n += 1; if (a.correct) r.correct += 1; } else r.text = String(a.payload?.text || '').slice(0, 600); }
    const cd = currentDay(p.start_date, new Date());
    return NextResponse.json({ success: true, plan: { ...p, days: p.days.map((d) => ({ ...d, unit_title: d.kind === 'mirror' ? 'يوم المرآة' : ix.get(d.unit || '')?.title_ar || d.unit, items: undefined, has_items: !!(d.items && d.items.length), progress: byDay[d.d] || null })) }, today: cd.d, ended: cd.ended, learner: rep ? { name: learnerName(rep), code: rep.access_code, outcome: rep.report?.exit?.النتيجة } : null, summary: rep ? sums[rep.id] || null : null, level_units, unit_titles: Object.fromEntries(p.units.map((code) => [code, ix.get(code)?.title_ar || code])) }, { headers: NO });
  }
  return bad('استعلام غير معروف');
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const site = siteOf(req);
  const j = await readJson(req, { maxBytes: 512 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>; const action = String(b.action || '');
  const audit = async (a: string, entity: string, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action: a, entity_type: 'miaar_practice', entity_id: entity, entity_label: PRACTICE_TITLE.ar, source: 'admin', metadata: meta }); } catch { /* تحسيني */ } };
  const repOf = async (id: string) => { const { data } = await db.from('placement_reports').select(REP_COLS).eq('id', id).maybeSingle(); return data || null; };
  const ERR: Record<string, string> = { not_diagnostic: 'ليست نتيجة تشخيص ولا حكم عبور', retake_sitting: 'جلسة إعادة مهارة — لا مِران لها', level_unsupported: 'دون A1 — لا وحدات منهج لهذا المستوى بعد', not_final: 'الحكم ليس نهائيًا بعد', passed: 'المتعلّم اجتاز — لا حاجة لمِران', retake_merged: 'أُنجزت الإعادة بالفعل', no_units: 'لا وحدات معتمدة لهذا المستوى — اعتمد وحدات «خريطة المنهج» أولًا', not_found: 'الخطّة غير موجودة', status_approved: 'الخطّة معتمدة بالفعل', status_done: 'الخطّة انتهت', status_cancelled: 'الخطّة ملغاة' };
  if (action === 'draft') {
    if (!isId(b.report_id)) return bad('نتيجة غير صالحة'); const rep = await repOf(b.report_id); if (!rep) return bad('النتيجة غير موجودة', 404);
    const r = await draftPlan(db, rep, user.id); if (!r.ok) return bad(ERR[r.error] || r.error);
    return NextResponse.json({ success: true, plan: r.plan, existed: r.existed }, { headers: NO });
  }
  if (action === 'approve') {
    let planId = isId(b.plan_id) ? b.plan_id : null; let code: string | null = null;
    if (!planId && isId(b.report_id)) { const rep = await repOf(b.report_id); if (!rep) return bad('النتيجة غير موجودة', 404); const d = await draftPlan(db, rep, user.id); if (!d.ok) return bad(ERR[d.error] || d.error); planId = d.plan.id; code = rep.access_code || null; }
    if (!planId) return bad('حدّد الخطّة');
    const p0 = await planById(db, planId); if (!p0) return bad(ERR.not_found, 404);
    const edits: Array<{ d: number; unit?: string | null; note_ar?: string | null; note_audio?: string | null }> = [];
    for (const e of Array.isArray(b.edits) ? (b.edits as Record<string, unknown>[]).slice(0, PLAN_DAYS) : []) { const v = validateDayEdit(e, p0.level); if (!v.ok) return bad(v.error); const { ok: _o, ...rest } = v; void _o; edits.push(rest); }
    const r = await approvePlan(db, planId, user.id, edits, { site, code }); if (!r.ok) return bad(ERR[r.error] || r.error);
    await audit('miaar_practice_approve', planId, { report_id: r.plan.report_id, units: r.plan.units, edits: edits.length });
    return NextResponse.json({ success: true, plan: r.plan }, { headers: NO });
  }
  if (action === 'approve_all') {
    const skip = new Set(Array.isArray(b.skip) ? (b.skip as unknown[]).filter(isId) : []);
    const rids = Array.isArray(b.report_ids) ? (b.report_ids as unknown[]).filter(isId) as string[] : [];
    if (!isId(b.invite_id) && !isId(b.classroom_id) && !rids.length) return bad('حدّد دعوة أو شعبة أو نتائج');
    /* م12: ملاحظة اليوم 1 لكل خطّة تُعتمد (مثل رسالة الجهة) — يقرّرها الموقّع لا الجهة */
    const d1 = typeof b.day1_note === 'string' ? b.day1_note.replace(/<[^>]*>/g, '').trim().slice(0, NOTE_MAX) : ''; const edits = d1 ? [{ day: 1, note_ar: d1 }] : [];
    const reps = isId(b.invite_id) ? await eligibleReports(db, b.invite_id) : isId(b.classroom_id) ? await reportsByClassroom(db, b.classroom_id) : await reportsByIds(db, rids); const sums = await summariesForReports(db, reps); let done = 0; let skipped = 0; const errors: string[] = [];
    for (const rep of reps) {
      if (skip.has(rep.id) || (sums[rep.id] && sums[rep.id].status !== 'draft')) { skipped += 1; continue; }
      const d = await draftPlan(db, rep, user.id); if (!d.ok) { errors.push(`${learnerName(rep)}: ${ERR[d.error] || d.error}`); continue; }
      const r = await approvePlan(db, d.plan.id, user.id, edits.map((e) => { const v = validateDayEdit(e, d.plan.level); return v.ok ? { d: v.d, note_ar: v.note_ar ?? null } : { d: 1 }; }), { site, code: rep.access_code || null }); if (r.ok) done += 1; else errors.push(`${learnerName(rep)}: ${ERR[r.error] || r.error}`);
    }
    await audit('miaar_practice_approve_all', String(isId(b.invite_id) ? b.invite_id : isId(b.classroom_id) ? b.classroom_id : (rids[0] || '')), { done, skipped, errors: errors.length, scope: isId(b.invite_id) ? 'invite' : isId(b.classroom_id) ? 'classroom' : 'reports', day1_note: !!d1 });
    return NextResponse.json({ success: true, done, skipped, errors }, { headers: NO });
  }
  if (action === 'edit_day') {
    if (!isId(b.plan_id)) return bad('خطّة غير صالحة'); const p = await planById(db, b.plan_id); if (!p) return bad(ERR.not_found, 404);
    const v = validateDayEdit(b, p.level); if (!v.ok) return bad(v.error); const day = p.days.find((x) => x.d === v.d); if (day?.done_at && 'unit' in v) return bad('اليوم أُنجز — تُعدَّل الملاحظة فقط');
    const { ok: _o, ...rest } = v; void _o; const ok = await editDay(db, b.plan_id, rest); return ok ? NextResponse.json({ success: true }, { headers: NO }) : bad('تعذّر التعديل');
  }
  if (action === 'nudge') { if (!isId(b.plan_id)) return bad('خطّة غير صالحة'); const ok = await nudge(db, b.plan_id, user.name, { site }); return ok ? NextResponse.json({ success: true }, { headers: NO }) : bad('أُرسل تذكير اليوم بالفعل أو الخطّة غير معتمدة', 409); }
  if (action === 'cancel') { if (!isId(b.plan_id)) return bad('خطّة غير صالحة'); const ok = await cancelPlan(db, b.plan_id); if (ok) await audit('miaar_practice_cancel', b.plan_id, {}); return ok ? NextResponse.json({ success: true }, { headers: NO }) : bad('تعذّر الإلغاء'); }
  return bad('إجراء غير معروف');
}
