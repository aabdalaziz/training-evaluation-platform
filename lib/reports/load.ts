// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 «محور التقارير» — القراءة والكتابة بمفتاح الخدمة (ر1: تقرير التعلّم الأسبوعي · ر2: الختامي · ر3: تقرير إنجاز المهمة — آخر الملف)
 *  من أنا: مدرّب (trainers.email) له شُعب (classrooms.trainer_id) · أو طاقم (كل البرامج النشطة).
 *  اللقطة (computed): البرنامج · الجهة · الشعبة · المسجَّلون المقبولون · جلسات الحضور في الفترة وساعاتها وعناوينها · الحضور لكل متدرّب · المنتظمون.
 *  الدورة: مسودّة → مُرسَل → معتمَد (رمز تحقّق + إرسال «سطر لك» بإذن المعلّم) أو مُعاد بملاحظة.
 */
import { notify } from '../portal/notify';
import { effectiveTemplate, emptyBody, cleanBody, cleanStudents, cleanLines, buildRoster, hoursOf, weekBounds, weekNo, validPeriod, canEdit, canDecide, canView, missingBeforeSubmit, verifyCode, summativeStats, P46_NAMES_AR, fmtDayAr, type Computed, type StudentRow, type Skill, type Body,
  buildTrajectories, maturityOf, progressPct, finalSuggested, cleanFinalBody, cleanFinalStudents, missingBeforeFinalSubmit, distribution, canSign, signoffComplete, signoffView, studentPageData, suggestRec, REC_AR, SIGN_AR, type FinalComputed, type FinalBody, type FinalStudent, type WeekSrc, type SignAs,
  emptyMissionBody, cleanMissionBody, missionStats, missingBeforeMissionSubmit, milestoneDeviations, missionClientView, canAck, ackToken, MISSION_NAMES_AR, ACK_NOTE_MAX, ADDENDUM_MAX, MAX_ADDENDA, type MissionComputed, type MissionBody } from './registry';

export type Me = { id: string; email: string; name: string; staff: boolean; admin?: boolean };
export type Classroom = { id: string; code: string; section_name: string | null; level: string | null; program_id: string; program_ar: string; program_type: string };
export const REPORT_COLS = 'id,created_at,updated_at,kind,program_id,classroom_id,author_id,author_email,author_name,week_no,period_from,period_to,status,computed,body,students,lines,lines_ok,submitted_at,approved_by,approved_name,approved_at,return_note,verify_code,lines_sent_at,engagement_id';   // ack_token لا يُقرأ هنا (ر3)
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
  if (!orgId) return ''; const a = await safe<any>(db.from('portal_organizations').select('name_ar').eq('id', orgId).maybeSingle(), null); if (a?.name_ar) return String(a.name_ar);
  const b = await safe<any>(db.from('organizations').select('*').eq('id', orgId).maybeSingle(), null); return String(b?.name_ar || b?.name || b?.title || '');   // ر2: جهة البرنامج تعيش في الجدول القديم organizations — وإلا يكتب المعلّم اسمها في القسم الأول
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
  const rows = await safe<any[]>(db.from('portal_report_lines').select('id,created_at,report_id,program_id,text_ar,week_no,period_to,kind,verify_code,show_on_credential').ilike('email', me.email).order('created_at', { ascending: false }).limit(12), []);
  if (!rows.length) return []; const pids = Array.from(new Set(rows.map(r => String(r.program_id)))); const progs = await safe<any[]>(db.from('programs').select('id,name_ar').in('id', pids).limit(20), []); const pm = new Map(progs.map(p => [String(p.id), String(p.name_ar || '')]));
  return rows.map(r => ({ ...r, program_ar: pm.get(String(r.program_id)) || '' }));
}
export async function verifyReport(db: any, code: string): Promise<any | null> { return safe<any>(db.from('portal_reports').select(REPORT_COLS).eq('verify_code', code.toUpperCase()).eq('status', 'approved').maybeSingle(), null); }
export function view(r: any, me: Me) {
  const roster: StudentRow[] = Array.isArray(r.students) ? r.students : [];
  if (r.kind === 'mission') { const mb = r.body as MissionBody; const mc = r.computed as MissionComputed; const { ack_token: _t, ...r0 } = r; return { ...r0, stats: missionStats(mb, mc), can_edit: canEdit(r, me), can_decide: canDecide(r, me), missing: missingBeforeMissionSubmit(mb, mc), can_send_client: r.status === 'approved' && !!me.staff, can_addendum: r.status === 'approved' && !!me.staff && (mb.addenda || []).length < MAX_ADDENDA, can_ack: canAck(r), client_sent_at: mc.client_sent_at || null, late: milestoneDeviations(mc.milestones || [], today()).filter(m => (m.deviation_days ?? 0) > 3).map(m => m.id) }; }
  if (r.kind === 'final') return { ...r, stats: summativeStats(roster), distribution: distribution(roster), can_edit: canEdit(r, me), can_decide: false, can_return: canDecide(r, me), can_sign_quality: canSign(r, me, 'quality'), can_sign_manager: canSign(r, me, 'manager'), signoff: signoffView(r.body), missing: missingBeforeFinalSubmit(r.body as FinalBody, roster as FinalStudent[]), can_promote: r.status === 'approved' && !!me.staff && !r.body?.promotion };
  return { ...r, stats: summativeStats(roster), can_edit: canEdit(r, me), can_decide: canDecide(r, me), missing: missingBeforeSubmit(r.body as Body, roster) };
}

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
  const c: Computed = r.computed; const roster: StudentRow[] = Array.isArray(r.students) ? r.students : []; const fin = r.kind === 'final';
  if (r.kind === 'mission') { const body = cleanMissionBody(b.body ?? r.body, r.body as MissionBody); const patch = { body, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }
  const body = fin ? cleanFinalBody(b.body ?? r.body, { signoff: r.body?.signoff, promotion: r.body?.promotion }) : cleanBody(b.body ?? r.body, c.strategies); const students = fin ? cleanFinalStudents(b.students ?? r.students, roster, c.skills) : cleanStudents(b.students ?? r.students, roster, c.skills); const lines = cleanLines(b.lines ?? r.lines, roster);
  const patch = { body, students, lines, lines_ok: b.lines_ok === undefined ? !!r.lines_ok : !!b.lines_ok, updated_at: nowIso() };
  const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...r, ...patch } };
}
export async function recomputeReport(db: any, me: Me, id: string): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canEdit(r, me)) return { ok: false, error: 'لا يمكن تحديث هذا التقرير الآن' };
  if (r.kind === 'mission') { const eng = await engagementById(db, String(r.engagement_id || '')); if (!eng) return { ok: false, error: 'عقد التعاون غير موجود' }; const mc = await computeMissionSnapshot(db, me, eng); const body = mergeMissionDeliverables(r.body as MissionBody, mc); const patch = { computed: mc, body, period_from: mc.start_at || r.period_from, period_to: mc.end_at || today(), updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }
  if (r.kind === 'final') { const fs = await computeFinalSnapshot(db, me, String(r.program_id), r.classroom_id ? String(r.classroom_id) : null); if ('error' in fs) return { ok: false, error: fs.error }; const students = cleanFinalStudents(r.students, fs.roster, fs.computed.skills); const body = cleanFinalBody(r.body, { signoff: r.body?.signoff, promotion: r.body?.promotion }); const patch = { computed: fs.computed, students, body, week_no: fs.computed.weeks.length, period_from: fs.computed.period_from, period_to: fs.computed.period_to, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }
  const snap = await computeSnapshot(db, me, String(r.program_id), r.classroom_id ? String(r.classroom_id) : null, r.period_from, r.period_to); if ('error' in snap) return { ok: false, error: snap.error };
  const students = cleanStudents(r.students, snap.roster, snap.computed.skills); const body = cleanBody(r.body, snap.computed.strategies);
  const patch = { computed: snap.computed, students, body, week_no: snap.computed.week_no, updated_at: nowIso() };
  const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...r, ...patch } };
}
export async function submitReport(db: any, me: Me, id: string, site: string, staffEmails: string[]): Promise<{ ok: true } | { ok: false; error: string; missing?: string[] }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canEdit(r, me)) return { ok: false, error: 'لا يمكن إرسال هذا التقرير الآن' };
  const fin = r.kind === 'final'; const mis = r.kind === 'mission'; const missing = mis ? missingBeforeMissionSubmit(r.body as MissionBody, r.computed as MissionComputed) : fin ? missingBeforeFinalSubmit(r.body as FinalBody, Array.isArray(r.students) ? r.students : []) : missingBeforeSubmit(r.body as Body, Array.isArray(r.students) ? r.students : []); if (missing.length) return { ok: false, error: 'أكمل قبل الإرسال: ' + missing.join(' · '), missing };
  const { error } = await db.from('portal_reports').update({ status: 'submitted', submitted_at: nowIso(), return_note: null, updated_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message };
  for (const email of staffEmails.slice(0, 5)) { try { await notify(db, { kind: 'report_submitted', to: { email }, ref: `rep:submitted:${id}:${email}:${Date.now()}`, subject: mis ? `${P46_NAMES_AR.mission} — ${r.computed?.title_ar || ''} بانتظار الاعتماد` : fin ? `${P46_NAMES_AR.final} — ${r.computed?.classroom_ar || r.computed?.program_ar || ''} بانتظار توقيعين` : `${P46_NAMES_AR.weekly} — الأسبوع ${r.week_no} بانتظار الاعتماد`, text: mis ? `${r.author_name || r.author_email} أرسل ${P46_NAMES_AR.mission} («${r.computed?.title_ar || ''}» — ${r.computed?.org_ar || ''}).` : `${r.author_name || r.author_email} أرسل ${fin ? P46_NAMES_AR.final : P46_NAMES_AR.weekly} (${r.computed?.program_ar || ''}${r.computed?.classroom_ar ? ' · ' + r.computed.classroom_ar : ''}) للفترة ${fmtDayAr(r.period_from)} → ${fmtDayAr(r.period_to)}.`, url: `${site}/admin/reports?r=${id}` }); } catch { /* داخلي */ } }
  return { ok: true };
}
export async function decideReport(db: any, me: Me, id: string, decision: 'approve' | 'return', note: string, site: string, signAs?: SignAs | null): Promise<{ ok: true; verify_code?: string | null; lines_sent?: number; signed?: SignAs; pending?: SignAs } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canDecide(r, me)) return { ok: false, error: 'التقرير ليس بانتظار الاعتماد أو لست من الطاقم' };
  const fin = r.kind === 'final';
  if (decision === 'return') {
    const n = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 400); if (n.length < 3) return { ok: false, error: 'اكتب ملاحظة الإعادة' };
    const patch: any = { status: 'returned', return_note: n, updated_at: nowIso() }; if (fin) patch.body = { ...(r.body || {}), signoff: { quality: null, manager: null } };   // الإعادة تمسح التوقيعين
    const { error } = await db.from('portal_reports').update(patch).eq('id', id); if (error) return { ok: false, error: error.message };
    try { await notify(db, { kind: 'report_returned', to: { email: r.author_email }, ref: `rep:returned:${id}:${Date.now()}`, subject: r.kind === 'mission' ? `أُعيد ${P46_NAMES_AR.mission} بملاحظة` : r.kind === 'final' ? `أُعيد ${P46_NAMES_AR.final} بملاحظة` : `أُعيد تقرير الأسبوع ${r.week_no} بملاحظة`, text: `${me.name || 'مدير البرنامج'}: ${n}`, url: `${site}/me/reports/${id}` }); } catch { /* داخلي */ }
    return { ok: true };
  }
  if (fin) {   // ر2: توقيعان — الجودة ثم مدير البرنامج (أيّهما أولًا) — والاعتماد يكتمل بالثاني
    const as: SignAs = signAs === 'manager' ? 'manager' : 'quality'; if (!canSign(r, me, as)) return { ok: false, error: `لا يمكنك ${SIGN_AR[as] === 'الجودة' ? 'توقيع الجودة' : 'توقيع مدير البرنامج'} على هذا التقرير (وُقِّع من قبل، أو التوقيع الثاني يلزم أن يكون من شخص آخر)` };
    const so = { ...(r.body?.signoff || { quality: null, manager: null }), [as]: { name: me.name || me.email, email: me.email, id: me.id, at: nowIso() } }; const body = { ...(r.body || {}), signoff: so };
    if (!signoffComplete(body)) { const { error } = await db.from('portal_reports').update({ body, updated_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message }; return { ok: true, signed: as, pending: as === 'quality' ? 'manager' : 'quality' }; }
    r.body = body;
  }
  let code = r.verify_code as string | null; if (!code) { for (let i = 0; i < 6; i++) { const c = verifyCode(); const ex = await safe<any[]>(db.from('portal_reports').select('id').eq('verify_code', c).limit(1), []); if (!ex.length) { code = c; break; } } }
  const { error } = await db.from('portal_reports').update({ status: 'approved', approved_by: me.id, approved_name: me.name || me.email, approved_at: nowIso(), verify_code: code, updated_at: nowIso(), ...(fin ? { body: r.body } : {}) }).eq('id', id); if (error) return { ok: false, error: error.message };
  let lines_sent = 0;
  if (r.lines_ok && Array.isArray(r.lines) && r.lines.length) {
    const students: StudentRow[] = Array.isArray(r.students) ? r.students : []; const emails = students.map(s => s.email).filter(Boolean) as string[];
    const ens = emails.length ? await safe<any[]>(db.from('portal_enrollments').select('email,user_id').eq('program_id', r.program_id).in('email', emails).limit(500), []) : []; const uid = new Map(ens.map(e => [lower(e.email), e.user_id || null]));
    for (const l of r.lines as { email: string; name: string; text: string }[]) {
      const st = fin ? (students as FinalStudent[]).find(s => s.email === lower(l.email)) : null; const tj = fin ? ((r.computed as FinalComputed).trajectory || []).find(t => t.email === lower(l.email)) : null;
      const ins = await db.from('portal_report_lines').upsert({ report_id: id, program_id: r.program_id, user_id: uid.get(lower(l.email)) || null, email: lower(l.email), text_ar: l.text, week_no: r.week_no, period_to: r.period_to, ...(fin ? { kind: 'final', verify_code: code, data: st && tj ? studentPageData(tj, r.computed.skills || [], st) : {} } : {}) }, { onConflict: 'report_id,email', ignoreDuplicates: true });
      if (!ins?.error) { lines_sent++; try { await notify(db, { kind: 'report_line', to: { email: l.email, name: l.name }, ref: `rep:line:${id}:${lower(l.email)}`, subject: fin ? `${P46_NAMES_AR.final_line} — ${r.computed?.program_ar || ''}` : `${P46_NAMES_AR.line} ${r.week_no} — ${r.computed?.program_ar || ''}`, text: l.text, url: `${site}/me#report-lines` }); } catch { /* داخلي */ } }
    }
    await db.from('portal_reports').update({ lines_sent_at: nowIso() }).eq('id', id);
  }
  if (r.kind === 'mission') { try { await completeEngagementFromReport(db, r, code); } catch { /* داخلي */ } }
  try { await notify(db, { kind: 'report_approved', to: { email: r.author_email }, ref: `rep:approved:${id}`, subject: r.kind === 'mission' ? `اعتُمد ${P46_NAMES_AR.mission}` : fin ? `اعتُمد ${P46_NAMES_AR.final}` : `اعتُمد تقرير الأسبوع ${r.week_no}`, text: r.kind === 'mission' ? `اعتمد ${me.name || 'الطاقم'} ${P46_NAMES_AR.mission} («${r.computed?.title_ar || ''}»). رمز التحقّق: ${code}. ${MISSION_NAMES_AR.ack} يصل بعد إرسال الطاقم للجهة.` : fin ? `اكتمل توقيعا ${P46_NAMES_AR.final} (${r.computed?.program_ar || ''}). رمز التحقّق: ${code}.` : `اعتمد ${me.name || 'مدير البرنامج'} ${P46_NAMES_AR.weekly} (${r.computed?.program_ar || ''}). رمز التحقّق: ${code}.`, url: `${site}/me/reports/${id}` }); } catch { /* داخلي */ }
  if (!fin) { try { await maybeNotifyFinalReady(db, r, site); } catch { /* داخلي */ } }
  return { ok: true, verify_code: code, lines_sent };
}
export async function deleteReport(db: any, me: Me, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!(me.staff || (canView(r, me) && r.status === 'draft'))) return { ok: false, error: 'غير مصرّح' };
  if (r.status === 'approved' && !me.staff) return { ok: false, error: 'التقرير المعتمَد لا يُحذف' };
  const { error } = await db.from('portal_reports').delete().eq('id', id); return error ? { ok: false, error: error.message } : { ok: true };
}

/* ═════════════════════════════ ر2 — التقرير الختامي («خاتمة الرحلة») ═════════════════════════════ */
const today = () => new Date().toISOString().slice(0, 10);
/** الأسبوعيات المعتمدة للشعبة نفسها — مصدر النموّ */
export async function weeksFor(db: any, programId: string, classroomId: string | null): Promise<WeekSrc[]> {
  const rows = await safe<any[]>(db.from('portal_reports').select(REPORT_COLS).eq('kind', 'weekly').eq('status', 'approved').eq('program_id', programId).order('period_from', { ascending: true }).limit(60), []);
  return rows.filter(r => String(r.classroom_id || '') === String(classroomId || '')).map(r => ({ id: String(r.id), week_no: Number(r.week_no || 1), period_from: String(r.period_from), period_to: String(r.period_to), verify_code: r.verify_code || null, students: Array.isArray(r.students) ? r.students : [], strengths: Array.isArray(r.body?.strengths?.strengths) ? r.body.strengths.strengths : [], challenges: Array.isArray(r.body?.strengths?.challenges) ? r.body.strengths.challenges : [], lines: Array.isArray(r.lines) ? r.lines : [], promote: Array.isArray(r.body?.recommendations?.promote) ? r.body.recommendations.promote : [], support: Array.isArray(r.body?.recommendations?.support) ? r.body.recommendations.support : [] }));
}
/** لقطة الختامي: لقطة البرنامج كلّه (الحضور من أول يوم) + الأسبوعيات المعتمدة + مسارات المتدرّبين + النضج */
export async function computeFinalSnapshot(db: any, me: Me, programId: string, classroomId: string | null): Promise<{ computed: FinalComputed; roster: StudentRow[]; program: any } | { error: string }> {
  const program = await safe<any>(db.from('programs').select('id,name_ar,start_date,end_date,hours').eq('id', programId).maybeSingle(), null); if (!program) return { error: 'البرنامج غير موجود' };
  const weeks = await weeksFor(db, programId, classroomId); const td = today();
  const from = String(program.start_date || weeks[0]?.period_from || td).slice(0, 10); const endRaw = program.end_date ? String(program.end_date).slice(0, 10) : null; const to = endRaw && endRaw < td ? endRaw : td;
  const snap = await computeSnapshot(db, me, programId, classroomId, from < to ? from : to, to); if ('error' in snap) return snap;
  const roster = snap.roster; const skills = snap.computed.skills; const trajectory = buildTrajectories(roster, weeks, skills);
  const pool = <X extends { point: string }>(xs: X[][]): X[] => { const seen = new Set<string>(); const out: X[] = []; for (const l of xs) for (const x of l) { const k = String(x.point || '').trim(); if (k && !seen.has(k)) { seen.add(k); out.push(x); } } return out.slice(0, 12); };
  const computed: FinalComputed = { ...snap.computed, kind: 'final', period_from: from < to ? from : to, period_to: to, week_no: weeks.length, program_from: program.start_date ? String(program.start_date).slice(0, 10) : null, program_to: endRaw, progress_pct: progressPct(program.start_date ? String(program.start_date).slice(0, 10) : null, endRaw, td),
    weeks: weeks.map(w => ({ id: w.id, week_no: w.week_no, period_from: w.period_from, period_to: w.period_to, verify_code: w.verify_code, n: w.students.filter(s => s.avg !== null).length, avg: summativeStats(w.students).avg })), trajectory, maturity: maturityOf(weeks.length, program.start_date ? String(program.start_date).slice(0, 10) : null, endRaw, td),
    strengths_pool: pool(weeks.map(w => w.strengths)), challenges_pool: pool(weeks.map(w => w.challenges)) };
  return { computed, roster, program };
}
/** بطاقات «التقرير الختامي» في /me/reports: لكل شعبة في نطاقي — النضج والاقتراح والتقرير إن وُجد */
export async function finalCards(db: any, me: Me, scope: { classrooms: Classroom[]; programs: { id: string; name_ar: string; start_date: string | null }[] }, mine: any[]): Promise<any[]> {
  if (!scope.classrooms.length) return []; const pids = Array.from(new Set(scope.classrooms.map(c => c.program_id)));
  const progs = await safe<any[]>(db.from('programs').select('id,name_ar,start_date,end_date').in('id', pids).limit(100), []); const pm = new Map(progs.map(p => [String(p.id), p]));
  const appr = await safe<any[]>(db.from('portal_reports').select('id,program_id,classroom_id,kind,status').in('program_id', pids).limit(500), []); const td = today();
  return scope.classrooms.map(c => { const p = pm.get(c.program_id) || {}; const start = p.start_date ? String(p.start_date).slice(0, 10) : null; const end = p.end_date ? String(p.end_date).slice(0, 10) : null; const approved = appr.filter(r => r.kind === 'weekly' && r.status === 'approved' && String(r.program_id) === c.program_id && String(r.classroom_id || '') === c.id).length; const fin = appr.find(r => r.kind === 'final' && String(r.program_id) === c.program_id && String(r.classroom_id || '') === c.id) || null; const mineFin = fin ? mine.find(m => m.id === fin.id) : null; const progress = progressPct(start, end, td);
    return { classroom_id: c.id, program_id: c.program_id, program_ar: c.program_ar, classroom_ar: [c.section_name, c.code].filter(Boolean).join(' · '), level: c.level, approved_weeks: approved, maturity: maturityOf(approved, start, end, td), progress_pct: progress, suggested: finalSuggested(progress, end, td, approved), final_id: fin ? String(fin.id) : null, final_status: fin ? String(fin.status) : null, final_mine: !!mineFin || (fin && me.staff) }; });
}
export async function createFinal(db: any, me: Me, b: { program_id: string; classroom_id?: string | null }): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const scope = await myScope(db, me); const pid = String(b.program_id || ''); const cid = b.classroom_id ? String(b.classroom_id) : null;
  if (!mayReportOn(scope, me, pid, cid)) return { ok: false, error: 'لست مدرّب هذا البرنامج/الشعبة' };
  const ex = (await safe<any[]>(db.from('portal_reports').select('id,classroom_id').eq('kind', 'final').eq('program_id', pid).limit(20), [])).find(d => String(d.classroom_id || '') === String(cid || '')); if (ex) return { ok: false, error: 'يوجد تقرير ختامي لهذه الشعبة — افتحه من قائمتك' };
  const fs = await computeFinalSnapshot(db, me, pid, cid); if ('error' in fs) return { ok: false, error: fs.error }; const c = fs.computed;
  const body = emptyFinal(c); const students = cleanFinalStudents(fs.roster.map(r => { const t = c.trajectory.find(x => x.key === r.key); const rec = suggestRec(null, t?.last ?? null, r.attendance_pct); return { ...r, rec: rec || '', reason: rec ? `اقتراح آلي من آخر أسبوع (${t?.last ?? '—'}%) والحضور (${r.attendance_pct ?? '—'}%) — يبدّله المعلّم` : '' }; }), fs.roster, c.skills);
  const row = { kind: 'final', program_id: pid, classroom_id: cid, author_id: me.id, author_email: me.email, author_name: me.name || c.trainer_ar, week_no: c.weeks.length, period_from: c.period_from, period_to: c.period_to, status: 'draft', computed: c, body, students, lines: [], lines_ok: false };
  const { data, error } = await db.from('portal_reports').insert(row).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...row, id: '' } };
}
function emptyFinal(c: FinalComputed): FinalBody {
  const b = cleanFinalBody({}); b.general.institution = c.org_ar; b.general.level = c.level_ar; b.general.group = c.classroom_ar; b.general.duration = c.program_from ? `${fmtDayAr(c.program_from)} → ${c.program_to ? fmtDayAr(c.program_to) : '…'} · ${c.sessions} جلسة · ${c.hours} ساعة` : `${c.sessions} جلسة · ${c.hours} ساعة`;
  b.strengths.strengths = c.strengths_pool.slice(0, 6); b.strengths.challenges = c.challenges_pool.slice(0, 6); return b;
}
/** إشعار «التقرير الختامي جاهز للنموّ» للمعلّم حين تبلغ الشعبة النضج — مرة واحدة لكل شعبة (ref ثابت) */
export async function maybeNotifyFinalReady(db: any, weekly: any, site: string): Promise<boolean> {
  const pid = String(weekly.program_id); const cid = weekly.classroom_id ? String(weekly.classroom_id) : null; const weeks = await weeksFor(db, pid, cid); const td = today();
  const p = await safe<any>(db.from('programs').select('id,start_date,end_date').eq('id', pid).maybeSingle(), null); const start = p?.start_date ? String(p.start_date).slice(0, 10) : null; const end = p?.end_date ? String(p.end_date).slice(0, 10) : null;
  if (!finalSuggested(progressPct(start, end, td), end, td, weeks.length)) return false;
  const fin = (await safe<any[]>(db.from('portal_reports').select('id,classroom_id').eq('kind', 'final').eq('program_id', pid).limit(20), [])).find(d => String(d.classroom_id || '') === String(cid || '')); if (fin) return false;
  const m = maturityOf(weeks.length, start, end, td);
  await notify(db, { kind: 'report_final_ready', to: { email: weekly.author_email }, ref: `rep:final_ready:${pid}:${cid || 'all'}`, subject: `${P46_NAMES_AR.final} يكاد يكتب نفسه — ${m.approved}/${m.expected} أسابيع معتمدة`, text: `بلغت شعبة ${weekly.computed?.classroom_ar || weekly.computed?.program_ar || ''} نضجًا يكفي لبدء ${P46_NAMES_AR.final}: مسارات المتدرّبين جاهزة من ${m.approved} أسابيع معتمدة، ويبقى حكمك الختامي وتوصياتك.`, url: `${site}/me/reports` });
  return true;
}
/** «من التوصية إلى القرار»: المرشَّحون للرفع يُسجَّلون معلَّقين في برنامج الهدف — ويعتمدهم الطاقم من مسار القبول المعتاد */
export async function promoteFromFinal(db: any, me: Me, id: string, targetProgramId: string): Promise<{ ok: true; created: number; skipped: number; program_ar: string } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (r.kind !== 'final' || r.status !== 'approved' || !me.staff) return { ok: false, error: 'يلزم تقرير ختامي معتمَد وصلاحية الطاقم' }; if (r.body?.promotion?.at) return { ok: false, error: 'حُوِّلت التوصيات من قبل' };
  const target = await safe<any>(db.from('programs').select('id,name_ar,archived_at').eq('id', targetProgramId).maybeSingle(), null); if (!target || target.archived_at) return { ok: false, error: 'برنامج الهدف غير موجود' }; if (String(target.id) === String(r.program_id)) return { ok: false, error: 'اختر برنامجًا غير البرنامج الحالي' };
  const students: FinalStudent[] = Array.isArray(r.students) ? r.students : []; const picks = students.filter(s => s.rec === 'promote' && s.email); if (!picks.length) return { ok: false, error: 'لا توصيات «رفع» في هذا التقرير' };
  const have = await safe<any[]>(db.from('portal_enrollments').select('email').eq('program_id', target.id).in('email', picks.map(s => s.email!)).limit(500), []); const hs = new Set(have.map(h => lower(h.email)));
  const src = await safe<any[]>(db.from('portal_enrollments').select('email,user_id,phone,organization_id,lang').eq('program_id', r.program_id).in('email', picks.map(s => s.email!)).limit(500), []); const sm = new Map(src.map(e => [lower(e.email), e]));
  let created = 0, skipped = 0; const nextLevel = String(r.body?.recommendations?.next_level || '').trim() || null;
  for (const s of picks) { if (hs.has(s.email!)) { skipped++; continue; } const e = sm.get(s.email!) || {}; const ins = await db.from('portal_enrollments').insert({ program_id: target.id, user_id: e.user_id || null, full_name: s.name, email: s.email, phone: e.phone || null, organization_id: e.organization_id || null, lang: e.lang || 'ar', source: 'report', status: 'pending', placement_level: nextLevel, notes: `رُشِّح للرفع في ${P46_NAMES_AR.final} (رمز ${r.verify_code}) — ${r.computed?.program_ar || ''}` }); if (ins?.error) skipped++; else created++; }
  const promotion = { at: nowIso(), by: me.name || me.email, program_id: String(target.id), program_ar: String(target.name_ar || ''), created, skipped };
  await db.from('portal_reports').update({ body: { ...(r.body || {}), promotion }, updated_at: nowIso() }).eq('id', id);
  return { ok: true, created, skipped, program_ar: String(target.name_ar || '') };
}
/* ───────── صفحة المتدرّب و«شهادتي» ───────── */
const LINE_COLS = 'id,created_at,report_id,program_id,user_id,email,text_ar,week_no,period_to,kind,data,verify_code,show_on_credential';
export async function lineById(db: any, me: Me, id: string): Promise<any | null> {
  const l = await safe<any>(db.from('portal_report_lines').select(LINE_COLS).eq('id', id).maybeSingle(), null); if (!l) return null; if (lower(l.email) !== me.email && !me.staff) return null;
  const p = await safe<any>(db.from('programs').select('id,name_ar').eq('id', l.program_id).maybeSingle(), null); const r = await safe<any>(db.from('portal_reports').select('id,approved_name,approved_at,author_name,computed').eq('id', l.report_id).maybeSingle(), null);
  return { ...l, program_ar: String(p?.name_ar || ''), approved_name: r?.approved_name || '', approved_at: r?.approved_at || null, author_name: r?.author_name || '', classroom_ar: String(r?.computed?.classroom_ar || ''), org_ar: String(r?.computed?.org_ar || ''), weeks_count: Array.isArray(r?.computed?.weeks) ? r.computed.weeks.length : 0, mine: lower(l.email) === me.email };
}
export async function setLineShow(db: any, me: Me, id: string, on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const l = await safe<any>(db.from('portal_report_lines').select('id,email,kind').eq('id', id).maybeSingle(), null); if (!l || lower(l.email) !== me.email) return { ok: false, error: 'السطر ليس لك' }; if (l.kind !== 'final') return { ok: false, error: 'يُعرض في الشهادة سطر التقرير الختامي فقط' };
  const { error } = await db.from('portal_report_lines').update({ show_on_credential: on }).eq('id', id); return error ? { ok: false, error: error.message } : { ok: true };
}
/** ما يظهر في الشهادة الحيّة (بإذن صاحبها): فقرة المسار بلا توصية ولا تقدير */
export async function credentialLine(db: any, code: string): Promise<any | null> {
  const cred = await safe<any>(db.from('portal_credentials').select('id,user_id,email,program_id').ilike('verify_code', code).maybeSingle(), null); if (!cred?.program_id) return null;
  const rows = await safe<any[]>(db.from('portal_report_lines').select(LINE_COLS).eq('kind', 'final').eq('program_id', cred.program_id).eq('show_on_credential', true).ilike('email', lower(cred.email)).limit(1), []); const l = rows[0]; if (!l) return null;
  const d = l.data || {}; return { verify_code: l.verify_code, text_ar: l.text_ar, paragraph: String(d.paragraph || ''), weeks: Array.isArray(d.weeks) ? d.weeks.length : 0, delta: d.delta ?? null, trend: d.trend || null, period_to: l.period_to };
}
export { REC_AR };

/* ═════════════════════════════ ر3 — تقرير إنجاز المهمة («أثرُ المهمة») ═════════════════════════════ */
const ENG_COLS = 'id,created_at,profile_id,user_id,email,kind,consulting_request_id,title_ar,scope_ar,deliverables,start_at,end_at,mode,status,member_signed_at,athar_signed_at,completed_at,code,meta';   // بلا fee_amount — الأجر لا يدخل التقرير
const ENG_OK = ['active', 'completed', 'settled'];
export async function engagementById(db: any, id: string): Promise<any | null> { return id ? safe<any>(db.from('portal_directory_engagements').select(ENG_COLS).eq('id', id).maybeSingle(), null) : null; }
export async function myEngagements(db: any, me: Me): Promise<any[]> { const rows = await safe<any[]>(db.from('portal_directory_engagements').select(ENG_COLS).ilike('email', me.email).order('created_at', { ascending: false }).limit(50), []); return rows.filter(e => ENG_OK.includes(String(e.status))); }
/** بطاقات «مهماتك الموقَّعة» في تقاريري */
export async function missionCards(db: any, me: Me, mine: any[]): Promise<any[]> {
  const engs = await myEngagements(db, me); if (!engs.length) return [];
  const rids = Array.from(new Set(engs.map(e => e.consulting_request_id).filter(Boolean))); const reqs = rids.length ? await safe<any[]>(db.from('portal_consulting_requests').select('id,organization,title').in('id', rids).limit(50), []) : []; const org = new Map(reqs.map(r => [String(r.id), r]));
  return engs.map(e => { const rep = mine.find(r => r.kind === 'mission' && String(r.engagement_id || '') === String(e.id)); const rq = org.get(String(e.consulting_request_id || '')); return { engagement_id: String(e.id), title_ar: String(e.title_ar || ''), kind: String(e.kind || 'consult'), kind_ar: e.kind === 'train' ? 'تدريب' : 'استشارة', status: String(e.status), org_ar: String(rq?.organization || ''), start_at: e.start_at || null, end_at: e.end_at || null, deliverables: Array.isArray(e.deliverables) ? e.deliverables.length : 0, code: e.code || null, report_id: rep ? String(rep.id) : null, report_status: rep ? String(rep.status) : null }; });
}
/** لقطة المهمة من العقد + الطلب + المراحل + التحديثات (+ جلسات التدريب إن وُجدت) */
export async function computeMissionSnapshot(db: any, me: Me, eng: any): Promise<MissionComputed> {
  const td = today(); const rid = eng.consulting_request_id ? String(eng.consulting_request_id) : null;
  const [prof, req, quotes, ms, ups] = await Promise.all([
    safe<any>(db.from('portal_directory_profiles').select('name_ar,title_ar').eq('id', eng.profile_id).maybeSingle(), null),
    rid ? safe<any>(db.from('portal_consulting_requests').select('id,full_name,email,organization,sector,area,title,goals,timeline,status').eq('id', rid).maybeSingle(), null) : Promise.resolve(null),
    rid ? safe<any[]>(db.from('portal_consulting_quotes').select('version,status,scope,deliverables,duration').eq('request_id', rid).order('version', { ascending: false }).limit(10), []) : Promise.resolve([] as any[]),
    rid ? safe<any[]>(db.from('portal_consulting_milestones').select('id,position,title,due_date,status,done_at').eq('request_id', rid).order('position', { ascending: true }).limit(40), []) : Promise.resolve([] as any[]),
    rid ? safe<any[]>(db.from('portal_consulting_updates').select('created_at,author_id,author_name,by_staff,body,visible_to_client').eq('request_id', rid).order('created_at', { ascending: true }).limit(200), []) : Promise.resolve([] as any[]),
  ]);
  const q = (quotes || []).find(x => x.status === 'accepted') || null; const lines = (t: unknown) => String(t || '').split(/\r?\n/).map(x => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 20);
  const milestones = milestoneDeviations(ms || [], td); const done = milestones.filter(m => m.status === 'done'); const late = done.filter(m => (m.deviation_days ?? 0) > 3).length;
  const vis = (ups || []).filter(u => u.visible_to_client !== false); const myUps = (ups || []).filter(u => (u.author_id && u.author_id === me.id) || (me.name && u.author_name === me.name)).map(u => String(u.body || '').slice(0, 300)).slice(-8);
  let sessions = 0, hours = 0, attendance_pct: number | null = null;
  if (eng.kind === 'train') {
    const tr = await safe<any[]>(db.from('trainers').select('id').ilike('email', eng.email).limit(1), []); const tid = tr[0]?.id;
    if (tid) { let qq = db.from('attendance_sessions').select('id,start_time,end_time,session_date').eq('trainer_id', tid); if (eng.start_at) qq = qq.gte('session_date', eng.start_at); qq = qq.lte('session_date', eng.end_at || td); const ss = await safe<any[]>(qq.limit(500), []); sessions = ss.length; hours = Math.round(ss.reduce((a, x) => a + hoursOf(x), 0) * 10) / 10;
      if (ss.length) { const recs = await safe<any[]>(db.from('attendance_records').select('session_id,status').in('session_id', ss.map(x => x.id)).limit(5000), []); const present = recs.filter(x => ['present', 'late'].includes(String(x.status))).length; attendance_pct = recs.length ? Math.round((present / recs.length) * 100) : null; } }
  }
  const start = eng.start_at ? String(eng.start_at).slice(0, 10) : null; const end = eng.end_at ? String(eng.end_at).slice(0, 10) : null; const endEff = end && end < td ? end : td;
  const dd = start ? Math.round((Date.parse(endEff + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) : null;
  return {
    engagement_id: String(eng.id), kind: eng.kind === 'train' ? 'train' : 'consult', kind_ar: eng.kind === 'train' ? 'تدريب' : 'استشارة', title_ar: String(eng.title_ar || ''), scope_ar: String(eng.scope_ar || ''), deliverables: (Array.isArray(eng.deliverables) ? eng.deliverables : []).map((d: any) => String(d || '').trim()).filter(Boolean).slice(0, 20), start_at: start, end_at: end, mode: eng.mode || null, member_signed_at: eng.member_signed_at || null, athar_signed_at: eng.athar_signed_at || null, engagement_code: eng.code || null, engagement_status: String(eng.status || ''),
    expert_name: String(prof?.name_ar || me.name || ''), expert_title: String(prof?.title_ar || ''), org_ar: String(req?.organization || ''), sector: String(req?.sector || ''), area: String(req?.area || ''), request_id: rid, request_title: String(req?.title || ''), request_goals: String(req?.goals || ''), request_timeline: String(req?.timeline || ''), client_name: String(req?.full_name || ''), client_email: lower(req?.email || ''),
    quote_scope: String(q?.scope || ''), quote_deliverables: q ? lines(q.deliverables) : [], quote_duration: String(q?.duration || ''),
    milestones, milestones_done: done.length, milestones_on_time: done.length - late, milestones_late: late, updates: vis.length, updates_from: vis.length ? String(vis[0].created_at).slice(0, 10) : null, updates_to: vis.length ? String(vis[vis.length - 1].created_at).slice(0, 10) : null, my_updates: myUps,
    duration_days: dd !== null && dd >= 0 ? dd : null, sessions, hours, attendance_pct, at: nowIso(),
  } as MissionComputed;
}
/** عند «حدّث الأرقام»: مخرجات العقد الجديدة تُضاف ولا يُحذف ما كتبه الخبير */
function mergeMissionDeliverables(body: MissionBody, c: MissionComputed): MissionBody {
  const fresh = emptyMissionBody(c).deliverables; const cur = body.deliverables || []; const have = new Set(cur.map(d => d.title.toLowerCase()));
  const add = fresh.filter(d => !have.has(d.title.toLowerCase())); return { ...body, deliverables: [...cur.filter(d => d.source !== 'extra'), ...add, ...cur.filter(d => d.source === 'extra')] };
}
export async function createMission(db: any, me: Me, engagementId: string): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const eng = await engagementById(db, engagementId); if (!eng) return { ok: false, error: 'عقد التعاون غير موجود' };
  if (lower(eng.email) !== me.email && !me.staff) return { ok: false, error: 'هذا العقد ليس لك' }; if (!ENG_OK.includes(String(eng.status))) return { ok: false, error: 'التقرير يُكتب لعقد موقَّع (جارٍ أو مُنجَز)' };
  const dup = await safe<any[]>(db.from('portal_reports').select('id').eq('kind', 'mission').eq('engagement_id', eng.id).limit(1), []); if (dup.length) return { ok: false, error: 'يوجد تقرير إنجاز لهذا العقد من قبل' };
  const c = await computeMissionSnapshot(db, me, eng); const body = emptyMissionBody(c);
  const row = { kind: 'mission', program_id: null, classroom_id: null, engagement_id: String(eng.id), author_id: me.id, author_email: me.email, author_name: c.expert_name || me.name || me.email, week_no: 0, period_from: c.start_at || today(), period_to: c.end_at || today(), status: 'draft', computed: c, body, students: [], lines: [], lines_ok: false };
  const { data, error } = await db.from('portal_reports').insert(row).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data };
}
/** الاعتماد يُنهي العقد الجاري تلقائيًا (active → completed) ويسجّل أن المصدر تقرير */
async function completeEngagementFromReport(db: any, r: any, code: string | null): Promise<void> {
  const eng = await engagementById(db, String(r.engagement_id || '')); if (!eng || eng.status !== 'active') return;
  await db.from('portal_directory_engagements').update({ status: 'completed', completed_at: nowIso(), meta: { ...(eng.meta || {}), report_id: r.id, report_code: code }, updated_at: nowIso() }).eq('id', eng.id);
}
/** الطاقم يرسل التقرير المعتمَد للجهة برابط إقرار بلا دخول */
export async function sendMissionToClient(db: any, me: Me, id: string, site: string, emailOverride?: string): Promise<{ ok: true; to: string; url: string } | { ok: false; error: string }> {
  if (!me.staff) return { ok: false, error: 'غير مصرّح' }; const r = await reportById(db, id); if (!r || r.kind !== 'mission') return { ok: false, error: 'التقرير غير موجود' }; if (r.status !== 'approved' || !r.verify_code) return { ok: false, error: 'يُرسل للجهة بعد الاعتماد' };
  const c = r.computed as MissionComputed; const to = lower(emailOverride || c.client_email); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: 'اكتب بريد الجهة' };
  const cur = await safe<any>(db.from('portal_reports').select('ack_token').eq('id', id).maybeSingle(), null); const token = cur?.ack_token || ackToken();
  const url = `${site}/verify/report/${r.verify_code}?k=${token}`; const computed = { ...c, client_sent_at: nowIso(), client_sent_to: to };
  const { error } = await db.from('portal_reports').update({ ack_token: token, computed, updated_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message };
  try { await notify(db, { kind: 'report_client', to: { email: to, name: c.client_name || c.org_ar }, ref: `rep:client:${id}:${to}:${Date.now()}`, subject: `${P46_NAMES_AR.mission} — «${c.title_ar}»`, text: `أنجز ${r.author_name} مهمة «${c.title_ar}» واعتمد أَثَر تقرير إنجازها. يمكنكم قراءته وإقرار استلامه من الرابط (لا يحتاج دخولًا).`, url }); } catch { /* داخلي */ }
  return { ok: true, to, url };
}
/** ما تراه الجهة برابطها */
export async function missionByToken(db: any, code: string, k: string): Promise<any | null> {
  if (!code || !k) return null; const r = await safe<any>(db.from('portal_reports').select(REPORT_COLS + ',ack_token').eq('verify_code', code.toUpperCase()).eq('kind', 'mission').eq('status', 'approved').maybeSingle(), null);
  if (!r || !r.ack_token || r.ack_token !== k) return null; const { ack_token: _t, ...rest } = r; return missionClientView(rest);
}
export async function ackMission(db: any, code: string, k: string, name: string, note: string, site: string, staffEmails: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await safe<any>(db.from('portal_reports').select(REPORT_COLS + ',ack_token').eq('verify_code', code.toUpperCase()).eq('kind', 'mission').eq('status', 'approved').maybeSingle(), null);
  if (!r || !r.ack_token || r.ack_token !== k) return { ok: false, error: 'الرابط غير صالح' }; if (!canAck(r)) return { ok: false, error: 'سبق الإقرار بالاستلام' };
  const nm = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (nm.length < 2) return { ok: false, error: 'اكتب اسم المُقِرّ' }; const c = r.computed as MissionComputed;
  const ack = { at: nowIso(), name: nm, note: String(note || '').replace(/\s+/g, ' ').trim().slice(0, ACK_NOTE_MAX), email: String(c.client_sent_to || c.client_email || '') };
  const { error } = await db.from('portal_reports').update({ body: { ...(r.body || {}), ack }, updated_at: nowIso() }).eq('id', r.id); if (error) return { ok: false, error: error.message };
  try { await notify(db, { kind: 'report_ack', to: { email: r.author_email }, ref: `rep:ack:${r.id}`, subject: `${MISSION_NAMES_AR.ack} — «${c.title_ar}»`, text: `${nm} (${c.org_ar || 'الجهة'}) أقرّ باستلام ${P46_NAMES_AR.mission}${ack.note ? `: «${ack.note}»` : '.'}`, url: `${site}/me/reports/${r.id}` }); } catch { /* داخلي */ }
  for (const email of staffEmails.slice(0, 3)) { try { await notify(db, { kind: 'report_ack', to: { email }, ref: `rep:ack:${r.id}:${email}`, subject: `${MISSION_NAMES_AR.ack} — «${c.title_ar}»`, text: `${nm} (${c.org_ar || 'الجهة'}) أقرّ باستلام تقرير إنجاز مهمة ${r.author_name}.`, url: `${site}/admin/reports?r=${r.id}` }); } catch { /* داخلي */ } }
  return { ok: true };
}
/** إلحاق تصويب مؤرَّخ من الطاقم دون مسّ الأصل */
export async function addMissionAddendum(db: any, me: Me, id: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!me.staff) return { ok: false, error: 'غير مصرّح' }; const r = await reportById(db, id); if (!r || r.kind !== 'mission') return { ok: false, error: 'التقرير غير موجود' }; if (r.status !== 'approved') return { ok: false, error: 'الإلحاق بعد الاعتماد فقط' };
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, ADDENDUM_MAX); if (t.length < 10) return { ok: false, error: 'اكتب نصّ التصويب (10 أحرف على الأقل)' }; const list = Array.isArray(r.body?.addenda) ? r.body.addenda : []; if (list.length >= MAX_ADDENDA) return { ok: false, error: 'بلغت حدّ الإلحاقات' };
  const { error } = await db.from('portal_reports').update({ body: { ...(r.body || {}), addenda: [...list, { at: nowIso(), by: me.name || me.email, text: t }] }, updated_at: nowIso() }).eq('id', id); return error ? { ok: false, error: error.message } : { ok: true };
}
/** عدد تقارير الإنجاز المعتمَدة لعضو — لـ«ما شهده أَثَر» */
export async function missionReportedCount(db: any, email: string): Promise<number> { const rows = await safe<any[]>(db.from('portal_reports').select('id').eq('kind', 'mission').eq('status', 'approved').ilike('author_email', lower(email)).limit(500), []); return rows.length; }
