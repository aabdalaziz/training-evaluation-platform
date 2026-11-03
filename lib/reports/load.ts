// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 «محور التقارير» — القراءة والكتابة بمفتاح الخدمة (ر1: تقرير التعلّم الأسبوعي)
 *  من أنا: مدرّب (trainers.email) له شُعب (classrooms.trainer_id) · أو طاقم (كل البرامج النشطة).
 *  اللقطة (computed): البرنامج · الجهة · الشعبة · المسجَّلون المقبولون · جلسات الحضور في الفترة وساعاتها وعناوينها · الحضور لكل متدرّب · المنتظمون.
 *  الدورة: مسودّة → مُرسَل → معتمَد (رمز تحقّق + إرسال «سطر لك» بإذن المعلّم) أو مُعاد بملاحظة.
 */
import { notify } from '../portal/notify';
import { effectiveTemplate, emptyBody, cleanBody, cleanStudents, cleanLines, buildRoster, hoursOf, weekBounds, weekNo, validPeriod, canEdit, canDecide, canView, missingBeforeSubmit, verifyCode, summativeStats, P46_NAMES_AR, fmtDayAr, type Computed, type StudentRow, type Skill, type Body } from './registry';

export type Me = { id: string; email: string; name: string; staff: boolean };
export type Classroom = { id: string; code: string; section_name: string | null; level: string | null; program_id: string; program_ar: string; program_type: string };
export const REPORT_COLS = 'id,created_at,updated_at,kind,program_id,classroom_id,author_id,author_email,author_name,week_no,period_from,period_to,status,computed,body,students,lines,lines_ok,submitted_at,approved_by,approved_name,approved_at,return_note,verify_code,lines_sent_at';
const lower = (s: unknown) => String(s || '').trim().toLowerCase(); const nowIso = () => new Date().toISOString();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }

/* ───────── من أنا ───────── */
export async function myScope(db: any, me: Me): Promise<{ trainer_ids: string[]; classrooms: Classroom[]; programs: { id: string; name_ar: string; program_type: string; start_date: string | null }[] }> {
  const trainers = await safe<any[]>(db.from('trainers').select('id,email,name').ilike('email', me.email || 'x@x').limit(10), []);
  const trainer_ids = trainers.filter(t => lower(t.email) === me.email).map(t => String(t.id));
  let rooms: any[] = [];
  if (trainer_ids.length) rooms = await safe<any[]>(db.from('classrooms').select('id,code,section_name,level,program_id,trainer_id').in('trainer_id', trainer_ids).limit(100), []);
  if (me.staff) { const all = await safe<any[]>(db.from('classrooms').select('id,code,section_name,level,program_id,trainer_id').limit(300), []); const seen = new Set(rooms.map(r => String(r.id))); for (const r of all) if (!seen.has(String(r.id))) rooms.push(r); }
  const pids = Array.from(new Set(rooms.map(r => String(r.program_id)).filter(Boolean)));
  let progs: any[] = [];
  if (me.staff) progs = (await safe<any[]>(db.from('programs').select('id,name_ar,program_type,start_date,status,archived_at').limit(300), [])).filter(p => !p.archived_at && String(p.status || '').toUpperCase() !== 'DRAFT' || pids.includes(String(p.id)));
  else if (pids.length) progs = await safe<any[]>(db.from('programs').select('id,name_ar,program_type,start_date,status,archived_at').in('id', pids).limit(100), []);
  const pmap = new Map(progs.map(p => [String(p.id), p]));
  const classrooms: Classroom[] = rooms.filter(r => pmap.has(String(r.program_id))).map(r => ({ id: String(r.id), code: String(r.code || ''), section_name: r.section_name || null, level: r.level || null, program_id: String(r.program_id), program_ar: String(pmap.get(String(r.program_id))?.name_ar || ''), program_type: String(pmap.get(String(r.program_id))?.program_type || 'course') }));
  const programs = progs.filter(p => me.staff || pids.includes(String(p.id))).map(p => ({ id: String(p.id), name_ar: String(p.name_ar || ''), program_type: String(p.program_type || 'course'), start_date: p.start_date || null })).sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
  return { trainer_ids, classrooms, programs };
}
export function mayReportOn(scope: { classrooms: Classroom[]; programs: { id: string }[] }, me: Me, programId: string, classroomId: string | null): boolean {
  if (me.staff) return scope.programs.some(p => p.id === programId) || scope.classrooms.some(c => c.program_id === programId);
  if (classroomId) return scope.classrooms.some(c => c.id === classroomId && c.program_id === programId);
  return scope.classrooms.some(c => c.program_id === programId);
}

/* ───────── القالب ───────── */
export async function templateFor(db: any, program: { id: string; program_type?: string | null }): Promise<{ skills: Skill[]; strategies: string[]; source: string }> {
  const t = await safe<any>(db.from('portal_report_templates').select('skills,strategies').eq('program_id', program.id).maybeSingle(), null);
  let programSkills: Skill[] = [];
  if (!t || !Array.isArray(t.skills) || t.skills.length < 2) {
    const ps = await safe<any[]>(db.from('portal_program_skills').select('skill_id,weight').eq('program_id', program.id).limit(12), []);
    if (ps.length) { const sk = await safe<any[]>(db.from('portal_skills').select('id,code,name_ar').in('id', ps.map(x => x.skill_id)).limit(12), []); programSkills = sk.map(s => ({ code: String(s.code || s.id), name_ar: String(s.name_ar || '') })).filter(s => s.name_ar); }
  }
  return effectiveTemplate({ program_type: program.program_type, template: t, programSkills });
}
export async function saveTemplate(db: any, me: Me, programId: string, skills: any, strategies: any): Promise<{ ok: true; skills: Skill[]; strategies: string[] } | { ok: false; error: string }> {
  const sk: Skill[] = (Array.isArray(skills) ? skills : []).map((s: any) => ({ code: String(s?.code || '').replace(/[^a-z0-9_]/gi, '').slice(0, 40) || ('s' + Math.random().toString(36).slice(2, 7)), name_ar: String(s?.name_ar || '').replace(/\s+/g, ' ').trim().slice(0, 40) })).filter((s: Skill) => s.name_ar).slice(0, 8);
  const st: string[] = (Array.isArray(strategies) ? strategies : []).map((s: any) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean).slice(0, 12);
  if (sk.length < 2) return { ok: false, error: 'مهارتان على الأقل' };
  const { error } = await db.from('portal_report_templates').upsert({ program_id: programId, kind: 'weekly', skills: sk, strategies: st, updated_at: nowIso(), updated_by: me.id }, { onConflict: 'program_id' }); if (error) return { ok: false, error: error.message };
  return { ok: true, skills: sk, strategies: st };
}

/* ───────── اللقطة ───────── */
async function orgName(db: any, orgId: string | null): Promise<string> {
  if (!orgId) return ''; const a = await safe<any>(db.from('portal_organizations').select('name_ar').eq('id', orgId).maybeSingle(), null); return String(a?.name_ar || '');   // وإلا يكتب المعلّم اسم الجهة في القسم الأول
}
export async function computeSnapshot(db: any, me: Me, programId: string, classroomId: string | null, from: string, to: string): Promise<{ computed: Computed; roster: StudentRow[]; program: any } | { error: string }> {
  const program = await safe<any>(db.from('programs').select('id,name_ar,program_type,organization_id,start_date,delivery_mode,hours').eq('id', programId).maybeSingle(), null); if (!program) return { error: 'البرنامج غير موجود' };
  const room = classroomId ? await safe<any>(db.from('classrooms').select('id,code,section_name,level,trainer_id,delivery_mode').eq('id', classroomId).maybeSingle(), null) : null;
  const trainer = room?.trainer_id ? await safe<any>(db.from('trainers').select('name').eq('id', room.trainer_id).maybeSingle(), null) : null;
  const tpl = await templateFor(db, program); const org_ar = await orgName(db, program.organization_id || null);
  let enrolled = await safe<any[]>(db.from('portal_enrollments').select('full_name,email,status,classroom_id,placement_level').eq('program_id', programId).eq('status', 'approved').limit(500), []);
  if (classroomId) { const inRoom = enrolled.filter(e => String(e.classroom_id || '') === classroomId); if (inRoom.length) enrolled = inRoom; }
  let sessions = await safe<any[]>(db.from('attendance_sessions').select('id,session_date,start_time,end_time,title,classroom_id').eq('program_id', programId).gte('session_date', from).lte('session_date', to).limit(200), []);
  if (classroomId) { const inRoom = sessions.filter(s => String(s.classroom_id || '') === classroomId); if (inRoom.length || sessions.some(s => s.classroom_id)) sessions = inRoom; }
  const records = sessions.length ? await safe<any[]>(db.from('attendance_records').select('session_id,email,full_name,identity_key,status').in('session_id', sessions.map(s => String(s.id))).limit(5000), []) : [];
  const { roster, attendance, regular } = buildRoster(enrolled, sessions, records);
  const deliv: Record<string, string> = { remote: 'عن بُعد', onsite: 'حضوري', hybrid: 'مدمج' };
  const computed: Computed = {
    program_ar: String(program.name_ar || ''), program_type: String(program.program_type || 'course'), org_ar, trainer_ar: String(trainer?.name || me.name || me.email.split('@')[0]),
    classroom_ar: room ? [room.section_name, room.code].filter(Boolean).join(' · ') : '', level_ar: String(room?.level || ''), delivery_ar: deliv[String(room?.delivery_mode || program.delivery_mode || '')] || '',
    enrolled: roster.length, regular, sessions: sessions.length, hours: Math.round(sessions.reduce((a, s) => a + hoursOf(s), 0) * 10) / 10, units: sessions.map(s => String(s.title || '')).filter(Boolean).slice(0, 12),
    period_from: from, period_to: to, week_no: weekNo(program.start_date, from), attendance, computed_at: nowIso(), skills: tpl.skills, strategies: tpl.strategies,
  };
  return { computed, roster, program };
}

/* ───────── القراءة ───────── */
export async function reportById(db: any, id: string): Promise<any | null> { return safe<any>(db.from('portal_reports').select(REPORT_COLS).eq('id', id).maybeSingle(), null); }
export async function myReports(db: any, me: Me): Promise<any[]> { return safe<any[]>(db.from('portal_reports').select(REPORT_COLS).ilike('author_email', me.email).order('created_at', { ascending: false }).limit(100), []); }
export async function adminReports(db: any): Promise<any[]> { return safe<any[]>(db.from('portal_reports').select(REPORT_COLS).order('created_at', { ascending: false }).limit(300), []); }
export async function myLines(db: any, me: Me): Promise<any[]> {
  const rows = await safe<any[]>(db.from('portal_report_lines').select('id,created_at,report_id,program_id,text_ar,week_no,period_to').ilike('email', me.email).order('created_at', { ascending: false }).limit(12), []);
  if (!rows.length) return []; const pids = Array.from(new Set(rows.map(r => String(r.program_id)))); const progs = await safe<any[]>(db.from('programs').select('id,name_ar').in('id', pids).limit(20), []); const pm = new Map(progs.map(p => [String(p.id), String(p.name_ar || '')]));
  return rows.map(r => ({ ...r, program_ar: pm.get(String(r.program_id)) || '' }));
}
export async function verifyReport(db: any, code: string): Promise<any | null> { return safe<any>(db.from('portal_reports').select(REPORT_COLS).eq('verify_code', code.toUpperCase()).eq('status', 'approved').maybeSingle(), null); }
export function view(r: any, me: Me) { const roster: StudentRow[] = Array.isArray(r.students) ? r.students : []; return { ...r, stats: summativeStats(roster), can_edit: canEdit(r, me), can_decide: canDecide(r, me), missing: missingBeforeSubmit(r.body as Body, roster) }; }

/* ───────── الكتابة ───────── */
export async function createReport(db: any, me: Me, b: { program_id: string; classroom_id?: string | null; period_from?: string; period_to?: string }): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const scope = await myScope(db, me); const pid = String(b.program_id || ''); const cid = b.classroom_id ? String(b.classroom_id) : null;
  if (!mayReportOn(scope, me, pid, cid)) return { ok: false, error: 'لست مدرّب هذا البرنامج/الشعبة' };
  const today = new Date().toISOString().slice(0, 10); const wb = weekBounds(today); const per = validPeriod(b.period_from || wb.from, b.period_to || wb.to); if (!per.ok) return per;
  const snap = await computeSnapshot(db, me, pid, cid, per.from, per.to); if ('error' in snap) return { ok: false, error: snap.error };
  const dup = await safe<any[]>(db.from('portal_reports').select('id').eq('kind', 'weekly').eq('program_id', pid).eq('period_from', per.from).limit(10), []);
  const dupSame = dup.length ? (await safe<any[]>(db.from('portal_reports').select('id,classroom_id').in('id', dup.map(d => d.id)).limit(10), [])).find(d => String(d.classroom_id || '') === String(cid || '')) : null;
  if (dupSame) return { ok: false, error: 'يوجد تقرير لهذه الفترة والشعبة — افتحه من قائمتك' };
  const body = emptyBody(snap.computed.strategies); body.general.institution = snap.computed.org_ar; body.general.level = snap.computed.level_ar; body.general.group = snap.computed.classroom_ar; body.general.units = snap.computed.units.join(' · ');
  const row = { kind: 'weekly', program_id: pid, classroom_id: cid, author_id: me.id, author_email: me.email, author_name: me.name || snap.computed.trainer_ar, week_no: snap.computed.week_no, period_from: per.from, period_to: per.to, status: 'draft', computed: snap.computed, body, students: cleanStudents([], snap.roster, snap.computed.skills), lines: [], lines_ok: false };
  const { data, error } = await db.from('portal_reports').insert(row).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...row, id: '' } };
}
export async function saveReport(db: any, me: Me, id: string, b: { body?: any; students?: any; lines?: any; lines_ok?: any }): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canEdit(r, me)) return { ok: false, error: 'لا يمكن تعديل هذا التقرير الآن' };
  const c: Computed = r.computed; const roster: StudentRow[] = Array.isArray(r.students) ? r.students : [];
  const body = cleanBody(b.body ?? r.body, c.strategies); const students = cleanStudents(b.students ?? r.students, roster, c.skills); const lines = cleanLines(b.lines ?? r.lines, roster);
  const patch = { body, students, lines, lines_ok: b.lines_ok === undefined ? !!r.lines_ok : !!b.lines_ok, updated_at: nowIso() };
  const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...r, ...patch } };
}
export async function recomputeReport(db: any, me: Me, id: string): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canEdit(r, me)) return { ok: false, error: 'لا يمكن تحديث هذا التقرير الآن' };
  const snap = await computeSnapshot(db, me, String(r.program_id), r.classroom_id ? String(r.classroom_id) : null, r.period_from, r.period_to); if ('error' in snap) return { ok: false, error: snap.error };
  const students = cleanStudents(r.students, snap.roster, snap.computed.skills); const body = cleanBody(r.body, snap.computed.strategies);
  const patch = { computed: snap.computed, students, body, week_no: snap.computed.week_no, updated_at: nowIso() };
  const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...r, ...patch } };
}
export async function submitReport(db: any, me: Me, id: string, site: string, staffEmails: string[]): Promise<{ ok: true } | { ok: false; error: string; missing?: string[] }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canEdit(r, me)) return { ok: false, error: 'لا يمكن إرسال هذا التقرير الآن' };
  const missing = missingBeforeSubmit(r.body as Body, Array.isArray(r.students) ? r.students : []); if (missing.length) return { ok: false, error: 'أكمل قبل الإرسال: ' + missing.join(' · '), missing };
  const { error } = await db.from('portal_reports').update({ status: 'submitted', submitted_at: nowIso(), return_note: null, updated_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message };
  for (const email of staffEmails.slice(0, 5)) { try { await notify(db, { kind: 'report_submitted', to: { email }, ref: `rep:submitted:${id}:${email}`, subject: `${P46_NAMES_AR.weekly} — الأسبوع ${r.week_no} بانتظار الاعتماد`, text: `${r.author_name || r.author_email} أرسل ${P46_NAMES_AR.weekly} (${r.computed?.program_ar || ''}${r.computed?.classroom_ar ? ' · ' + r.computed.classroom_ar : ''}) للفترة ${fmtDayAr(r.period_from)} → ${fmtDayAr(r.period_to)}.`, url: `${site}/admin/reports?r=${id}` }); } catch { /* داخلي */ } }
  return { ok: true };
}
export async function decideReport(db: any, me: Me, id: string, decision: 'approve' | 'return', note: string, site: string): Promise<{ ok: true; verify_code?: string | null; lines_sent?: number } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canDecide(r, me)) return { ok: false, error: 'التقرير ليس بانتظار الاعتماد أو لست من الطاقم' };
  if (decision === 'return') {
    const n = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 400); if (n.length < 3) return { ok: false, error: 'اكتب ملاحظة الإعادة' };
    const { error } = await db.from('portal_reports').update({ status: 'returned', return_note: n, updated_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message };
    try { await notify(db, { kind: 'report_returned', to: { email: r.author_email }, ref: `rep:returned:${id}:${Date.now()}`, subject: `أُعيد تقرير الأسبوع ${r.week_no} بملاحظة`, text: `${me.name || 'مدير البرنامج'}: ${n}`, url: `${site}/me/reports/${id}` }); } catch { /* داخلي */ }
    return { ok: true };
  }
  let code = r.verify_code as string | null; if (!code) { for (let i = 0; i < 6; i++) { const c = verifyCode(); const ex = await safe<any[]>(db.from('portal_reports').select('id').eq('verify_code', c).limit(1), []); if (!ex.length) { code = c; break; } } }
  const { error } = await db.from('portal_reports').update({ status: 'approved', approved_by: me.id, approved_name: me.name || me.email, approved_at: nowIso(), verify_code: code, updated_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message };
  let lines_sent = 0;
  if (r.lines_ok && Array.isArray(r.lines) && r.lines.length) {
    const students: StudentRow[] = Array.isArray(r.students) ? r.students : []; const emails = students.map(s => s.email).filter(Boolean) as string[];
    const ens = emails.length ? await safe<any[]>(db.from('portal_enrollments').select('email,user_id').eq('program_id', r.program_id).in('email', emails).limit(500), []) : []; const uid = new Map(ens.map(e => [lower(e.email), e.user_id || null]));
    for (const l of r.lines as { email: string; name: string; text: string }[]) {
      const ins = await db.from('portal_report_lines').upsert({ report_id: id, program_id: r.program_id, user_id: uid.get(lower(l.email)) || null, email: lower(l.email), text_ar: l.text, week_no: r.week_no, period_to: r.period_to }, { onConflict: 'report_id,email', ignoreDuplicates: true });
      if (!ins?.error) { lines_sent++; try { await notify(db, { kind: 'report_line', to: { email: l.email, name: l.name }, ref: `rep:line:${id}:${lower(l.email)}`, subject: `${P46_NAMES_AR.line} ${r.week_no} — ${r.computed?.program_ar || ''}`, text: l.text, url: `${site}/me#report-lines` }); } catch { /* داخلي */ } }
    }
    await db.from('portal_reports').update({ lines_sent_at: nowIso() }).eq('id', id);
  }
  try { await notify(db, { kind: 'report_approved', to: { email: r.author_email }, ref: `rep:approved:${id}`, subject: `اعتُمد تقرير الأسبوع ${r.week_no}`, text: `اعتمد ${me.name || 'مدير البرنامج'} ${P46_NAMES_AR.weekly} (${r.computed?.program_ar || ''}). رمز التحقّق: ${code}.`, url: `${site}/me/reports/${id}` }); } catch { /* داخلي */ }
  return { ok: true, verify_code: code, lines_sent };
}
export async function deleteReport(db: any, me: Me, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!(me.staff || (canView(r, me) && r.status === 'draft'))) return { ok: false, error: 'غير مصرّح' };
  if (r.status === 'approved' && !me.staff) return { ok: false, error: 'التقرير المعتمَد لا يُحذف' };
  const { error } = await db.from('portal_reports').delete().eq('id', id); return error ? { ok: false, error: error.message } : { ok: true };
}
