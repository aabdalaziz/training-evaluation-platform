// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 «محور التقارير» — القراءة والكتابة بمفتاح الخدمة (ر1: تقرير التعلّم الأسبوعي · ر2: الختامي · ر3: تقرير إنجاز المهمة · ر3-ب: التقرير الاستشاري — آخر الملف)
 *  من أنا: مدرّب (trainers.email) له شُعب (classrooms.trainer_id) · أو طاقم (كل البرامج النشطة).
 *  اللقطة (computed): البرنامج · الجهة · الشعبة · المسجَّلون المقبولون · جلسات الحضور في الفترة وساعاتها وعناوينها · الحضور لكل متدرّب · المنتظمون.
 *  الدورة: مسودّة → مُرسَل → معتمَد (رمز تحقّق + إرسال «سطر لك» بإذن المعلّم) أو مُعاد بملاحظة.
 */
import { notify } from '../portal/notify';
import { effectiveTemplate, emptyBody, cleanBody, cleanStudents, cleanLines, buildRoster, hoursOf, weekBounds, weekNo, validPeriod, canEdit, canDecide, canView, missingBeforeSubmit, verifyCode, summativeStats, P46_NAMES_AR, fmtDayAr, type Computed, type StudentRow, type Skill, type Body,
  buildTrajectories, maturityOf, progressPct, finalSuggested, cleanFinalBody, cleanFinalStudents, missingBeforeFinalSubmit, distribution, canSign, signoffComplete, signoffView, studentPageData, suggestRec, REC_AR, SIGN_AR, type FinalComputed, type FinalBody, type FinalStudent, type WeekSrc, type SignAs,
  emptyMissionBody, cleanMissionBody, missionStats, missingBeforeMissionSubmit, milestoneDeviations, missionClientView, canAck, ackToken, MISSION_NAMES_AR, ACK_NOTE_MAX, ADDENDUM_MAX, MAX_ADDENDA, type MissionComputed, type MissionBody,
  DOC_NAMES_AR, emptyAdvisoryBody, emptyStudyBody, cleanAdvisoryBody, cleanStudyBody, missingBeforeAdvisorySubmit, missingBeforeStudySubmit, studyConsistency, canDecideDoc, isDocKind, isClientKind, docClientView, type DocKind, type RequestComputed, type AdvisoryBody, type StudyBody,
  R4_NAMES_AR, cleanUnits, unitsFromDesign, unitStates, currentUnit, emptyPulseBody, cleanPulseBody, missingBeforePulseSubmit, carryAttention, emptyUnitBody, cleanUnitBody, cleanUnitStudents, missingBeforeUnitSubmit, isDiplomaKind, diplomaKindAr, rosterKey, type Unit, type Around, type PulseComputed, type PulseBody, type UnitComputed, type UnitBody, type UnitStudent, type UnitWeek, type DiplomaCard,
  R4B_NAMES_AR, PROFILE_LEVEL_AR, PROFILE_REC_AR, UNIT_DECISION_AR, suggestLevel, emptyProfileBody, cleanProfileBody, missingBeforeProfileSubmit, passportWrites, profileLineData, profileLineText, cohortReading, localEvidenceQuotes, cleanEvidenceQuotes, evidencePrompt, type ProfileComputed, type ProfileBody, type Competency, type EvidenceItem } from './registry';

import { emptyReviewBody, cleanReviewBody, reviewChanges, missingBeforeReviewSubmit, localProposals, cleanProposals, mergeProposals, reviewPrompt, buildGaps, gapCounts, programChangeLog, P47_NAMES_AR, type ReviewComputed, type ReviewBody, type ReviewUnit, type ReviewSkill, type PromiseUnit, type ProfileLevel } from './registry';   // P47

export type Me = { id: string; email: string; name: string; staff: boolean; admin?: boolean };
export type Classroom = { id: string; code: string; section_name: string | null; level: string | null; program_id: string; program_ar: string; program_type: string };
export const REPORT_COLS = 'id,created_at,updated_at,kind,program_id,classroom_id,author_id,author_email,author_name,week_no,period_from,period_to,status,computed,body,students,lines,lines_ok,submitted_at,approved_by,approved_name,approved_at,return_note,verify_code,lines_sent_at,engagement_id,consulting_request_id,supersedes_id,unit_id,subject_email';   // ack_token لا يُقرأ هنا (ر3)
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
  if (isDocKind(r.kind)) { const { ack_token: _t, ...r0 } = r; const b = r.body || {}; return { ...r0, can_edit: canEdit(r, me), can_decide: canDecideDoc(r, me), missing: r.kind === 'advisory' ? missingBeforeAdvisorySubmit(b as AdvisoryBody) : missingBeforeStudySubmit(b as StudyBody), consistency: r.kind === 'study' ? studyConsistency(b as StudyBody) : [], can_send_client: r.status === 'approved' && !!me.staff, can_addendum: r.status === 'approved' && !!me.staff && (b.addenda || []).length < MAX_ADDENDA, can_ack: canAck(r), client_sent_at: r.computed?.client_sent_at || null }; }   // ر3-ب
  if (r.kind === 'mission') { const mb = r.body as MissionBody; const mc = r.computed as MissionComputed; const { ack_token: _t, ...r0 } = r; return { ...r0, stats: missionStats(mb, mc), can_edit: canEdit(r, me), can_decide: canDecideDoc(r, me), missing: missingBeforeMissionSubmit(mb, mc), can_send_client: r.status === 'approved' && !!me.staff, can_addendum: r.status === 'approved' && !!me.staff && (mb.addenda || []).length < MAX_ADDENDA, can_ack: canAck(r), client_sent_at: mc.client_sent_at || null, late: milestoneDeviations(mc.milestones || [], today()).filter(m => (m.deviation_days ?? 0) > 3).map(m => m.id) }; }
  if (r.kind === 'diploma_pulse') return { ...r, can_edit: canEdit(r, me), can_decide: canDecide(r, me), missing: missingBeforePulseSubmit(r.body as PulseBody) };   // ر4
  if (r.kind === 'diploma_profile') return { ...r, can_edit: canEdit(r, me), can_decide: canDecideDoc(r, me), missing: missingBeforeProfileSubmit(r.body as ProfileBody, r.computed as ProfileComputed), can_renew: r.status === 'approved' && !!me.staff && !r.body?.superseded_by };   // ر4-ب: يعتمده زميل غير الكاتب
  if (r.kind === 'program_review') return { ...r, can_edit: canEdit(r, me), can_decide: canDecideDoc(r, me), missing: missingBeforeReviewSubmit(r.body as ReviewBody), changes: reviewChanges(r.body as ReviewBody, r.computed as ReviewComputed) };   // P47: changes = ما سيدخل نسخة الدفعة (المقبول والمعدَّل): يعتمدها زميل غير الكاتب
  if (r.kind === 'diploma_unit') return { ...r, stats: summativeStats(roster), distribution: distribution(roster), can_edit: canEdit(r, me), can_decide: canDecide(r, me), missing: missingBeforeUnitSubmit(r.body as UnitBody, roster as UnitStudent[]) };   // ر4
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
  if (isDocKind(r.kind)) { const body = r.kind === 'advisory' ? cleanAdvisoryBody(b.body ?? r.body, r.body as AdvisoryBody) : cleanStudyBody(b.body ?? r.body, r.body as StudyBody); const patch = { body, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // ر3-ب
  if (r.kind === 'program_review') { const body = cleanReviewBody(b.body ?? r.body, r.body as ReviewBody); const patch = { body, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // P47
  if (r.kind === 'diploma_profile') { const body = cleanProfileBody(b.body ?? r.body, r.computed as ProfileComputed); const patch = { body, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // ر4-ب
  if (r.kind === 'diploma_pulse') { const body = cleanPulseBody(b.body ?? r.body, r.computed as PulseComputed); const patch = { body, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // ر4
  if (r.kind === 'diploma_unit') { const uc = r.computed as UnitComputed; const marks = new Map<string, Around>(roster.map(x => [x.key, (x as UnitStudent).marks])); const students = cleanUnitStudents(b.students ?? r.students, roster, uc.unit_skills || uc.skills, marks); const body = cleanUnitBody(b.body ?? r.body, uc, roster); const lines = cleanLines(b.lines ?? r.lines, roster); const patch = { body, students, lines, lines_ok: b.lines_ok === undefined ? !!r.lines_ok : !!b.lines_ok, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // ر4
  if (r.kind === 'mission') { const body = cleanMissionBody(b.body ?? r.body, r.body as MissionBody); const patch = { body, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }
  const body = fin ? cleanFinalBody(b.body ?? r.body, { signoff: r.body?.signoff, promotion: r.body?.promotion }) : cleanBody(b.body ?? r.body, c.strategies); const students = fin ? cleanFinalStudents(b.students ?? r.students, roster, c.skills) : cleanStudents(b.students ?? r.students, roster, c.skills); const lines = cleanLines(b.lines ?? r.lines, roster);
  const patch = { body, students, lines, lines_ok: b.lines_ok === undefined ? !!r.lines_ok : !!b.lines_ok, updated_at: nowIso() };
  const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...r, ...patch } };
}
export async function recomputeReport(db: any, me: Me, id: string): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canEdit(r, me)) return { ok: false, error: 'لا يمكن تحديث هذا التقرير الآن' };
  if (isDocKind(r.kind)) { const eng = r.engagement_id ? await engagementById(db, String(r.engagement_id)) : null; const rc = await computeRequestSnapshot(db, me, r.consulting_request_id ? String(r.consulting_request_id) : null, eng, r.computed as RequestComputed); const patch = { computed: rc, period_to: today(), updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // ر3-ب
  if (r.kind === 'mission') { const eng = r.engagement_id ? await engagementById(db, String(r.engagement_id)) : null; if (!eng && !r.consulting_request_id) return { ok: false, error: 'عقد التعاون غير موجود' }; const mc = await computeMissionSnapshot(db, me, eng, r.consulting_request_id ? String(r.consulting_request_id) : null); const body = mergeMissionDeliverables(r.body as MissionBody, mc); const patch = { computed: mc, body, period_from: mc.start_at || r.period_from, period_to: mc.end_at || today(), updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }
  if (r.kind === 'program_review') { const rs = await computeReviewSnapshot(db, me, String(r.program_id), r.classroom_id ? String(r.classroom_id) : null); if ('error' in rs) return { ok: false, error: rs.error }; const body = cleanReviewBody(r.body); const patch = { computed: rs.computed, body, period_from: rs.computed.period_from, period_to: rs.computed.period_to, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // P47
  if (r.kind === 'diploma_profile') { const ps = await computeProfileSnapshot(db, me, String(r.program_id), r.classroom_id ? String(r.classroom_id) : null, String(r.subject_email || '')); if ('error' in ps) return { ok: false, error: ps.error }; const body = cleanProfileBody(r.body, ps.computed); const patch = { computed: ps.computed, body, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // ر4-ب
  if (r.kind === 'diploma_pulse') { const ps = await computePulseSnapshot(db, me, String(r.program_id), r.classroom_id ? String(r.classroom_id) : null, r.period_from, r.period_to); if ('error' in ps) return { ok: false, error: ps.error }; const body = cleanPulseBody(r.body, ps.computed); const patch = { computed: ps.computed, body, unit_id: ps.computed.unit?.id || r.unit_id || null, week_no: ps.computed.week_no, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // ر4
  if (r.kind === 'diploma_unit') { if (!r.unit_id) return { ok: false, error: 'الوحدة غير مرتبطة' }; const us = await computeUnitSnapshot(db, me, String(r.unit_id), r.classroom_id ? String(r.classroom_id) : null); if ('error' in us) return { ok: false, error: us.error }; const students = cleanUnitStudents(r.students, us.roster, us.computed.unit_skills, us.marks); const body = cleanUnitBody(r.body, us.computed, us.roster); const patch = { computed: us.computed, students, body, period_from: us.computed.period_from, period_to: us.computed.period_to, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }   // ر4
  if (r.kind === 'final') { const fs = await computeFinalSnapshot(db, me, String(r.program_id), r.classroom_id ? String(r.classroom_id) : null); if ('error' in fs) return { ok: false, error: fs.error }; const students = cleanFinalStudents(r.students, fs.roster, fs.computed.skills); const body = cleanFinalBody(r.body, { signoff: r.body?.signoff, promotion: r.body?.promotion }); const patch = { computed: fs.computed, students, body, week_no: fs.computed.weeks.length, period_from: fs.computed.period_from, period_to: fs.computed.period_to, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...r, ...patch } }; }
  const snap = await computeSnapshot(db, me, String(r.program_id), r.classroom_id ? String(r.classroom_id) : null, r.period_from, r.period_to); if ('error' in snap) return { ok: false, error: snap.error };
  const students = cleanStudents(r.students, snap.roster, snap.computed.skills); const body = cleanBody(r.body, snap.computed.strategies);
  const patch = { computed: snap.computed, students, body, week_no: snap.computed.week_no, updated_at: nowIso() };
  const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...r, ...patch } };
}
export async function submitReport(db: any, me: Me, id: string, site: string, staffEmails: string[]): Promise<{ ok: true } | { ok: false; error: string; missing?: string[] }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!canEdit(r, me)) return { ok: false, error: 'لا يمكن إرسال هذا التقرير الآن' };
  const fin = r.kind === 'final'; const mis = r.kind === 'mission'; const doc = isDocKind(r.kind); const missing = r.kind === 'program_review' ? missingBeforeReviewSubmit(r.body as ReviewBody) : r.kind === 'diploma_profile' ? missingBeforeProfileSubmit(r.body as ProfileBody, r.computed as ProfileComputed) : r.kind === 'diploma_pulse' ? missingBeforePulseSubmit(r.body as PulseBody) : r.kind === 'diploma_unit' ? missingBeforeUnitSubmit(r.body as UnitBody, Array.isArray(r.students) ? r.students : []) : doc ? (r.kind === 'advisory' ? missingBeforeAdvisorySubmit(r.body as AdvisoryBody) : missingBeforeStudySubmit(r.body as StudyBody)) : mis ? missingBeforeMissionSubmit(r.body as MissionBody, r.computed as MissionComputed) : fin ? missingBeforeFinalSubmit(r.body as FinalBody, Array.isArray(r.students) ? r.students : []) : missingBeforeSubmit(r.body as Body, Array.isArray(r.students) ? r.students : []); if (missing.length) return { ok: false, error: 'أكمل قبل الإرسال: ' + missing.join(' · '), missing };
  const { error } = await db.from('portal_reports').update({ status: 'submitted', submitted_at: nowIso(), return_note: null, updated_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message };
  for (const email of staffEmails.slice(0, 5)) { try { await notify(db, { kind: 'report_submitted', to: { email }, ref: `rep:submitted:${id}:${email}:${Date.now()}`, subject: r.kind === 'program_review' ? `${P47_NAMES_AR.review} — ${r.computed?.program_ar || ''} بانتظار الاعتماد` : isDiplomaKind(r.kind) ? `${diplomaKindAr(r.kind)} — ${r.computed?.program_ar || ''}${r.computed?.unit ? ' · الوحدة ' + r.computed.unit.idx : ''} بانتظار الاعتماد` : doc ? `${docKindAr(r.kind)} — ${r.computed?.title || ''} بانتظار الاعتماد` : mis ? `${P46_NAMES_AR.mission} — ${r.computed?.title_ar || ''} بانتظار الاعتماد` : fin ? `${P46_NAMES_AR.final} — ${r.computed?.classroom_ar || r.computed?.program_ar || ''} بانتظار توقيعين` : `${P46_NAMES_AR.weekly} — الأسبوع ${r.week_no} بانتظار الاعتماد`, text: isDiplomaKind(r.kind) ? `${r.author_name || r.author_email} أرسل ${diplomaKindAr(r.kind)} (${r.computed?.program_ar || ''}${r.computed?.classroom_ar ? ' · ' + r.computed.classroom_ar : ''}).` : doc ? `${r.author_name || r.author_email} أرسل ${docKindAr(r.kind)} («${r.computed?.title || ''}» — ${r.computed?.org_ar || ''}).` : mis ? `${r.author_name || r.author_email} أرسل ${P46_NAMES_AR.mission} («${r.computed?.title_ar || ''}» — ${r.computed?.org_ar || ''}).` : `${r.author_name || r.author_email} أرسل ${fin ? P46_NAMES_AR.final : P46_NAMES_AR.weekly} (${r.computed?.program_ar || ''}${r.computed?.classroom_ar ? ' · ' + r.computed.classroom_ar : ''}) للفترة ${fmtDayAr(r.period_from)} → ${fmtDayAr(r.period_to)}.`, url: `${site}/admin/reports?r=${id}` }); } catch { /* داخلي */ } }
  return { ok: true };
}
export async function decideReport(db: any, me: Me, id: string, decision: 'approve' | 'return', note: string, site: string, signAs?: SignAs | null): Promise<{ ok: true; verify_code?: string | null; lines_sent?: number; signed?: SignAs; pending?: SignAs } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'التقرير غير موجود' }; if (!(isClientKind(r.kind) || r.kind === 'diploma_profile' || r.kind === 'program_review' ? canDecideDoc(r, me) : canDecide(r, me))) return { ok: false, error: (isClientKind(r.kind) || r.kind === 'diploma_profile' || r.kind === 'program_review') && isAuthorOf(r, me) ? 'كاتب الوثيقة لا يعتمدها بنفسه — يعتمدها زميل من الطاقم أو مدير المنصة' : 'التقرير ليس بانتظار الاعتماد أو لست من الطاقم' };
  const fin = r.kind === 'final';
  if (decision === 'return') {
    const n = String(note || '').replace(/\s+/g, ' ').trim().slice(0, 400); if (n.length < 3) return { ok: false, error: 'اكتب ملاحظة الإعادة' };
    const patch: any = { status: 'returned', return_note: n, updated_at: nowIso() }; if (fin) patch.body = { ...(r.body || {}), signoff: { quality: null, manager: null } };   // الإعادة تمسح التوقيعين
    const { error } = await db.from('portal_reports').update(patch).eq('id', id); if (error) return { ok: false, error: error.message };
    try { await notify(db, { kind: 'report_returned', to: { email: r.author_email }, ref: `rep:returned:${id}:${Date.now()}`, subject: r.kind === 'program_review' ? `أُعيدت ${P47_NAMES_AR.review} بملاحظة` : isDiplomaKind(r.kind) ? `أُعيد ${diplomaKindAr(r.kind)} بملاحظة` : isDocKind(r.kind) ? `أُعيد ${docKindAr(r.kind)} بملاحظة` : r.kind === 'mission' ? `أُعيد ${P46_NAMES_AR.mission} بملاحظة` : r.kind === 'final' ? `أُعيد ${P46_NAMES_AR.final} بملاحظة` : `أُعيد تقرير الأسبوع ${r.week_no} بملاحظة`, text: `${me.name || 'مدير البرنامج'}: ${n}`, url: `${site}/me/reports/${id}` }); } catch { /* داخلي */ }
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
      const ins = await db.from('portal_report_lines').upsert({ report_id: id, program_id: r.program_id, user_id: uid.get(lower(l.email)) || null, email: lower(l.email), text_ar: l.text, week_no: r.week_no, period_to: r.period_to, ...(fin ? { kind: 'final', verify_code: code, data: st && tj ? studentPageData(tj, r.computed.skills || [], st) : {} } : r.kind === 'diploma_unit' ? { kind: 'diploma_unit', verify_code: code, data: { unit: r.computed?.unit ? { idx: r.computed.unit.idx, title_ar: r.computed.unit.title_ar } : null } } : {}) }, { onConflict: 'report_id,email', ignoreDuplicates: true });
      if (!ins?.error) { lines_sent++; try { await notify(db, { kind: 'report_line', to: { email: l.email, name: l.name }, ref: `rep:line:${id}:${lower(l.email)}`, subject: fin ? `${P46_NAMES_AR.final_line} — ${r.computed?.program_ar || ''}` : r.kind === 'diploma_unit' ? `${R4_NAMES_AR.unit_line} ${r.week_no} — ${r.computed?.program_ar || ''}` : `${P46_NAMES_AR.line} ${r.week_no} — ${r.computed?.program_ar || ''}`, text: l.text, url: `${site}/me#report-lines` }); } catch { /* داخلي */ } }
    }
    await db.from('portal_reports').update({ lines_sent_at: nowIso() }).eq('id', id);
  }
  if (r.kind === 'mission') { try { await completeEngagementFromReport(db, r, code); await completeRequestFromReport(db, r, code); } catch { /* داخلي */ } }
  if (isDocKind(r.kind)) { try { await markSuperseded(db, r, code); } catch { /* داخلي */ } }   // ر3-ب
  if (r.kind === 'diploma_unit') { try { await closeUnitFromReport(db, { ...r, id }); } catch { /* داخلي */ } try { await ensureProfilesFromUnit(db, { ...r, id }); } catch { /* داخلي */ } }   // ر4-ب: كشف لكل متدرّب من أول وحدة معتمَدة
  if (r.kind === 'diploma_profile') { try { await afterProfileApproved(db, me, { ...r, id }, code, site); } catch { /* داخلي */ } }   // ر4-ب: «العودة إلى الجواز»   // ر4: الإغلاق هو التوثيق: النسخة الجديدة تَنسخ السابقة ولا تغيّر حالة الطلب
  try { await notify(db, { kind: 'report_approved', to: { email: r.author_email }, ref: `rep:approved:${id}`, subject: r.kind === 'program_review' ? `اعتُمدت ${P47_NAMES_AR.review} — ${r.computed?.program_ar || ''}` : isDiplomaKind(r.kind) ? `اعتُمد ${diplomaKindAr(r.kind)}` : isDocKind(r.kind) ? `اعتُمد ${docKindAr(r.kind)}` : r.kind === 'mission' ? `اعتُمد ${P46_NAMES_AR.mission}` : fin ? `اعتُمد ${P46_NAMES_AR.final}` : `اعتُمد تقرير الأسبوع ${r.week_no}`, text: isDiplomaKind(r.kind) ? `اعتمد ${me.name || 'الطاقم'} ${diplomaKindAr(r.kind)} (${r.computed?.program_ar || ''}). رمز التحقّق: ${code}.` : isDocKind(r.kind) ? `اعتمد ${me.name || 'الطاقم'} ${docKindAr(r.kind)} («${r.computed?.title || ''}»). رمز التحقّق: ${code}. تصل للجهة بعد إرسال الطاقم.` : r.kind === 'mission' ? `اعتمد ${me.name || 'الطاقم'} ${P46_NAMES_AR.mission} («${r.computed?.title_ar || ''}»). رمز التحقّق: ${code}. ${MISSION_NAMES_AR.ack} يصل بعد إرسال الطاقم للجهة.` : fin ? `اكتمل توقيعا ${P46_NAMES_AR.final} (${r.computed?.program_ar || ''}). رمز التحقّق: ${code}.` : `اعتمد ${me.name || 'مدير البرنامج'} ${P46_NAMES_AR.weekly} (${r.computed?.program_ar || ''}). رمز التحقّق: ${code}.`, url: `${site}/me/reports/${id}` }); } catch { /* داخلي */ }
  if (r.kind === 'weekly') { try { await maybeNotifyFinalReady(db, r, site); } catch { /* داخلي */ } }
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
  const l = await safe<any>(db.from('portal_report_lines').select('id,email,kind').eq('id', id).maybeSingle(), null); if (!l || lower(l.email) !== me.email) return { ok: false, error: 'السطر ليس لك' }; if (l.kind !== 'final' && l.kind !== 'diploma_profile') return { ok: false, error: 'يُعرض في الشهادة سطر التقرير الختامي أو كشف الكفايات فقط' };
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
/** لقطة المهمة من العقد + الطلب + المراحل + التحديثات (+ جلسات التدريب إن وُجدت) */
export async function computeMissionSnapshot(db: any, me: Me, eng0: any | null, requestId?: string | null): Promise<MissionComputed> {
  const eng = eng0 || {}; const td = today(); const rid = eng.consulting_request_id ? String(eng.consulting_request_id) : requestId ? String(requestId) : null;   // ر3-ب: بلا عقد → من الطلب
  const [prof, req, quotes, ms, ups] = await Promise.all([
    eng.profile_id ? safe<any>(db.from('portal_directory_profiles').select('name_ar,title_ar').eq('id', eng.profile_id).maybeSingle(), null) : myProfile(db, me),
    rid ? safe<any>(db.from('portal_consulting_requests').select('id,created_at,full_name,email,organization,sector,area,title,details,goals,timeline,status,assigned_to,decided_at,completed_at').eq('id', rid).maybeSingle(), null) : Promise.resolve(null),
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
  const start = eng.start_at ? String(eng.start_at).slice(0, 10) : req?.decided_at ? String(req.decided_at).slice(0, 10) : req?.created_at ? String(req.created_at).slice(0, 10) : null; const end = eng.end_at ? String(eng.end_at).slice(0, 10) : req?.completed_at ? String(req.completed_at).slice(0, 10) : null; const endEff = end && end < td ? end : td;
  const dd = start ? Math.round((Date.parse(endEff + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) : null;
  return {
    engagement_id: eng.id ? String(eng.id) : null, kind: eng.kind === 'train' ? 'train' : 'consult', kind_ar: eng.kind === 'train' ? 'تدريب' : 'استشارة', title_ar: String(eng.title_ar || req?.title || ''), scope_ar: String(eng.scope_ar || q?.scope || ''), deliverables: (Array.isArray(eng.deliverables) ? eng.deliverables : []).map((d: any) => String(d || '').trim()).filter(Boolean).slice(0, 20), /* بلا عقد: المخرجات تأتي من quote_deliverables بمصدر «العرض» */ start_at: start, end_at: end, mode: eng.mode || null, member_signed_at: eng.member_signed_at || null, athar_signed_at: eng.athar_signed_at || null, engagement_code: eng.code || null, engagement_status: String(eng.status || (req ? 'request' : '')),
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
export async function createMission(db: any, me: Me, src: string | { engagement_id?: string | null; consulting_request_id?: string | null }): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const s = typeof src === 'string' ? { engagement_id: src } : src || {}; const srcOk = await resolveSource(db, me, s); if ('error' in srcOk) return { ok: false, error: srcOk.error }; const { eng, rid } = srcOk;
  const dup = eng ? await safe<any[]>(db.from('portal_reports').select('id').eq('kind', 'mission').eq('engagement_id', eng.id).limit(1), []) : await safe<any[]>(db.from('portal_reports').select('id').eq('kind', 'mission').eq('consulting_request_id', rid).is('engagement_id', null).limit(1), []); if (dup.length) return { ok: false, error: eng ? 'يوجد تقرير إنجاز لهذا العقد من قبل' : 'يوجد تقرير إنجاز لهذا الطلب من قبل' };
  const c = await computeMissionSnapshot(db, me, eng, rid); const body = emptyMissionBody(c);
  const row = { kind: 'mission', program_id: null, classroom_id: null, engagement_id: eng ? String(eng.id) : null, consulting_request_id: rid || null, author_id: me.id, author_email: me.email, author_name: c.expert_name || me.name || me.email, week_no: 0, period_from: c.start_at || today(), period_to: c.end_at || today(), status: 'draft', computed: c, body, students: [], lines: [], lines_ok: false };
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
  if (!me.staff) return { ok: false, error: 'غير مصرّح' }; const r = await reportById(db, id); if (!r || !isClientKind(r.kind)) return { ok: false, error: 'التقرير غير موجود' }; if (r.status !== 'approved' || !r.verify_code) return { ok: false, error: 'يُرسل للجهة بعد الاعتماد' };
  const c = r.computed as MissionComputed; const to = lower(emailOverride || c.client_email); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, error: 'اكتب بريد الجهة' }; const docAr = isDocKind(r.kind) ? docKindAr(r.kind) : P46_NAMES_AR.mission; const ttl = String(isDocKind(r.kind) ? (c as any).title : c.title_ar || '');
  const cur = await safe<any>(db.from('portal_reports').select('ack_token').eq('id', id).maybeSingle(), null); const token = cur?.ack_token || ackToken();
  const url = `${site}/verify/report/${r.verify_code}?k=${token}`; const computed = { ...c, client_sent_at: nowIso(), client_sent_to: to };
  const { error } = await db.from('portal_reports').update({ ack_token: token, computed, updated_at: nowIso() }).eq('id', id); if (error) return { ok: false, error: error.message };
  try { await notify(db, { kind: 'report_client', to: { email: to, name: c.client_name || c.org_ar }, ref: `rep:client:${id}:${to}:${Date.now()}`, subject: `${docAr} — «${ttl}»`, text: isDocKind(r.kind) ? `كتب ${r.author_name} ${docAr} «${ttl}» واعتمده أَثَر. يمكنكم قراءته وإقرار استلامه من الرابط (لا يحتاج دخولًا).` : `أنجز ${r.author_name} مهمة «${ttl}» واعتمد أَثَر تقرير إنجازها. يمكنكم قراءته وإقرار استلامه من الرابط (لا يحتاج دخولًا).`, url }); } catch { /* داخلي */ }
  return { ok: true, to, url };
}
/** ما تراه الجهة برابطها */
export async function missionByToken(db: any, code: string, k: string): Promise<any | null> {
  if (!code || !k) return null; const r = await safe<any>(db.from('portal_reports').select(REPORT_COLS + ',ack_token').eq('verify_code', code.toUpperCase()).in('kind', ['mission', 'advisory', 'study']).eq('status', 'approved').maybeSingle(), null);
  if (!r || !r.ack_token || r.ack_token !== k) return null; const { ack_token: _t, ...rest } = r; return isDocKind(r.kind) ? docClientView(rest) : missionClientView(rest);
}
export async function ackMission(db: any, code: string, k: string, name: string, note: string, site: string, staffEmails: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await safe<any>(db.from('portal_reports').select(REPORT_COLS + ',ack_token').eq('verify_code', code.toUpperCase()).in('kind', ['mission', 'advisory', 'study']).eq('status', 'approved').maybeSingle(), null);
  if (!r || !r.ack_token || r.ack_token !== k) return { ok: false, error: 'الرابط غير صالح' }; if (!canAck(r)) return { ok: false, error: 'سبق الإقرار بالاستلام' };
  const nm = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (nm.length < 2) return { ok: false, error: 'اكتب اسم المُقِرّ' }; const c = r.computed as MissionComputed;
  const ack = { at: nowIso(), name: nm, note: String(note || '').replace(/\s+/g, ' ').trim().slice(0, ACK_NOTE_MAX), email: String(c.client_sent_to || c.client_email || '') }; const kindAr = isDocKind(r.kind) ? docKindAr(r.kind) : P46_NAMES_AR.mission; const ttl = String(isDocKind(r.kind) ? (c as any).title : c.title_ar || '');
  const { error } = await db.from('portal_reports').update({ body: { ...(r.body || {}), ack }, updated_at: nowIso() }).eq('id', r.id); if (error) return { ok: false, error: error.message };
  try { await notify(db, { kind: 'report_ack', to: { email: r.author_email }, ref: `rep:ack:${r.id}`, subject: `${MISSION_NAMES_AR.ack} — «${ttl}»`, text: `${nm} (${c.org_ar || 'الجهة'}) أقرّ باستلام ${kindAr}${ack.note ? `: «${ack.note}»` : '.'}`, url: `${site}/me/reports/${r.id}` }); } catch { /* داخلي */ }
  for (const email of staffEmails.slice(0, 3)) { try { await notify(db, { kind: 'report_ack', to: { email }, ref: `rep:ack:${r.id}:${email}`, subject: `${MISSION_NAMES_AR.ack} — «${ttl}»`, text: `${nm} (${c.org_ar || 'الجهة'}) أقرّ باستلام ${kindAr} من ${r.author_name}.`, url: `${site}/admin/reports?r=${r.id}` }); } catch { /* داخلي */ } }
  return { ok: true };
}
/** إلحاق تصويب مؤرَّخ من الطاقم دون مسّ الأصل */
export async function addMissionAddendum(db: any, me: Me, id: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!me.staff) return { ok: false, error: 'غير مصرّح' }; const r = await reportById(db, id); if (!r || !isClientKind(r.kind)) return { ok: false, error: 'التقرير غير موجود' }; if (r.status !== 'approved') return { ok: false, error: 'الإلحاق بعد الاعتماد فقط' };
  const t = String(text || '').replace(/\s+/g, ' ').trim().slice(0, ADDENDUM_MAX); if (t.length < 10) return { ok: false, error: 'اكتب نصّ التصويب (10 أحرف على الأقل)' }; const list = Array.isArray(r.body?.addenda) ? r.body.addenda : []; if (list.length >= MAX_ADDENDA) return { ok: false, error: 'بلغت حدّ الإلحاقات' };
  const { error } = await db.from('portal_reports').update({ body: { ...(r.body || {}), addenda: [...list, { at: nowIso(), by: me.name || me.email, text: t }] }, updated_at: nowIso() }).eq('id', id); return error ? { ok: false, error: error.message } : { ok: true };
}
/** عدد تقارير الإنجاز المعتمَدة لعضو — لـ«ما شهده أَثَر» */
export async function missionReportedCount(db: any, email: string): Promise<number> { const rows = await safe<any[]>(db.from('portal_reports').select('id').eq('kind', 'mission').eq('status', 'approved').ilike('author_email', lower(email)).limit(500), []); return rows.length; }

/* ═══════════════════════════ ر3-ب — التقرير الاستشاري («أثرُ الرأي»): رأي استشاري · دراسة ═══════════════════════════ */
const REQ_COLS = 'id,created_at,user_id,full_name,email,organization,sector,area,title,details,goals,timeline,status,assigned_to,expert_profile_id,decided_at,completed_at';
const REQ_OK = ['accepted', 'in_progress', 'completed'];   // الوثيقة تُكتب لطلب مقبول (أو جارٍ أو مُنجَز) — لا لطلب قيد الدراسة
export const docKindAr = (k: string) => (k === 'advisory' ? DOC_NAMES_AR.advisory : k === 'study' ? DOC_NAMES_AR.study : P46_NAMES_AR.mission);
const isAuthorOf = (r: any, me: Me) => (!!r.author_id && r.author_id === me.id) || lower(r.author_email) === me.email;
async function myProfile(db: any, me: Me): Promise<any | null> { return safe<any>(db.from('portal_directory_profiles').select('id,name_ar,title_ar,user_id').ilike('email', me.email).limit(1).maybeSingle(), null); }
export async function requestById(db: any, id: string): Promise<any | null> { return id ? safe<any>(db.from('portal_consulting_requests').select(REQ_COLS).eq('id', id).maybeSingle(), null) : null; }
/** من يكتب على طلب بلا عقد: الطاقم · المكلَّف به (assigned_to) · الخبير المرتبط بملفه أو بعقدٍ على الطلب */
export async function canAuthorRequest(db: any, me: Me, req: any): Promise<boolean> {
  if (!req) return false; if (me.staff || (req.assigned_to && req.assigned_to === me.id)) return true;
  const [prof, engs] = await Promise.all([myProfile(db, me), safe<any[]>(db.from('portal_directory_engagements').select('id,email,status').eq('consulting_request_id', req.id).ilike('email', me.email).limit(5), [])]);
  return (!!prof && !!req.expert_profile_id && String(prof.id) === String(req.expert_profile_id)) || engs.some(e => ENG_OK.includes(String(e.status)));
}
async function resolveSource(db: any, me: Me, s: { engagement_id?: string | null; consulting_request_id?: string | null }): Promise<{ eng: any | null; rid: string | null } | { error: string }> {
  if (s.engagement_id) { const eng = await engagementById(db, String(s.engagement_id)); if (!eng) return { error: 'عقد التعاون غير موجود' }; if (lower(eng.email) !== me.email && !me.staff) return { error: 'هذا العقد ليس لك' }; if (!ENG_OK.includes(String(eng.status))) return { error: 'يُكتب لعقد موقَّع (جارٍ أو مُنجَز)' }; return { eng, rid: eng.consulting_request_id ? String(eng.consulting_request_id) : null }; }
  const req = await requestById(db, String(s.consulting_request_id || '')); if (!req) return { error: 'الطلب غير موجود' }; if (!REQ_OK.includes(String(req.status))) return { error: 'يُكتب لطلب مقبول أو جارٍ أو مُنجَز' }; if (!(await canAuthorRequest(db, me, req))) return { error: 'هذا الطلب ليس من تكليفك' };
  return { eng: null, rid: String(req.id) };
}
/** لقطة الطلب — من الطلب والعقد (إن وُجد) وعرض السعر المقبول والمراحل؛ تحفظ بيانات الإرسال للجهة */
export async function computeRequestSnapshot(db: any, me: Me, rid: string | null, eng: any | null, prev?: Partial<RequestComputed> | null): Promise<RequestComputed> {
  const td = today();
  const [prof, req, quotes, ms, assigned] = await Promise.all([
    eng?.profile_id ? safe<any>(db.from('portal_directory_profiles').select('name_ar,title_ar').eq('id', eng.profile_id).maybeSingle(), null) : myProfile(db, me),
    rid ? requestById(db, rid) : Promise.resolve(null),
    rid ? safe<any[]>(db.from('portal_consulting_quotes').select('version,status,scope,deliverables,duration').eq('request_id', rid).order('version', { ascending: false }).limit(10), []) : Promise.resolve([] as any[]),
    rid ? safe<any[]>(db.from('portal_consulting_milestones').select('id,position,title,due_date,status,done_at').eq('request_id', rid).order('position', { ascending: true }).limit(40), []) : Promise.resolve([] as any[]),
    Promise.resolve(null),
  ]);
  void assigned; const q = (quotes || []).find(x => x.status === 'accepted') || null; const lines = (t: unknown) => String(t || '').split(/\r?\n/).map(x => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 20);
  return {
    request_id: rid, engagement_id: eng ? String(eng.id) : null, engagement_code: eng?.code || null, title: String(req?.title || eng?.title_ar || ''), details: String(req?.details || ''), goals: String(req?.goals || ''), timeline: String(req?.timeline || ''), org_ar: String(req?.organization || ''), sector: String(req?.sector || ''), area: String(req?.area || ''), client_name: String(req?.full_name || ''), client_email: lower(req?.email || ''), requested_at: req?.created_at ? String(req.created_at).slice(0, 10) : null, request_status: String(req?.status || ''),
    consultant_name: String(prof?.name_ar || me.name || ''), consultant_title: String(prof?.title_ar || ''), assigned_name: '', quote_scope: String(q?.scope || eng?.scope_ar || ''), quote_deliverables: q ? lines(q.deliverables) : Array.isArray(eng?.deliverables) ? eng.deliverables.map((d: any) => String(d || '')).filter(Boolean) : [], quote_duration: String(q?.duration || ''), milestones: milestoneDeviations(ms || [], td), at: nowIso(),
    client_sent_at: prev?.client_sent_at || null, client_sent_to: prev?.client_sent_to || null,
  };
}
/** إنشاء رأي/دراسة: مسودّة واحدة غير معتمَدة لكل (مصدر، نوع)؛ النسخة الجديدة بعد الاعتماد تحمل supersedes_id */
export async function createDoc(db: any, me: Me, kind: DocKind, src: { engagement_id?: string | null; consulting_request_id?: string | null }): Promise<{ ok: true; report: any; resumed?: boolean } | { ok: false; error: string }> {
  if (!isDocKind(kind)) return { ok: false, error: 'نوع الوثيقة غير معروف' }; const srcOk = await resolveSource(db, me, src); if ('error' in srcOk) return { ok: false, error: srcOk.error }; const { eng, rid } = srcOk;
  let qq = db.from('portal_reports').select(REPORT_COLS).eq('kind', kind); qq = eng ? qq.eq('engagement_id', eng.id) : qq.eq('consulting_request_id', rid).is('engagement_id', null);
  const ex = await safe<any[]>(qq.order('created_at', { ascending: false }).limit(20), []); const open = ex.find(r => r.status !== 'approved'); if (open) return { ok: true, report: open, resumed: true };
  const last = ex.find(r => r.status === 'approved') || null; const c = await computeRequestSnapshot(db, me, rid, eng);
  const row = { kind, program_id: null, classroom_id: null, engagement_id: eng ? String(eng.id) : null, consulting_request_id: rid || null, supersedes_id: last ? String(last.id) : null, author_id: me.id, author_email: me.email, author_name: c.consultant_name || me.name || me.email, week_no: 0, period_from: c.requested_at || today(), period_to: today(), status: 'draft', computed: c, body: kind === 'advisory' ? emptyAdvisoryBody() : emptyStudyBody(), students: [], lines: [], lines_ok: false };
  const { data, error } = await db.from('portal_reports').insert(row).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data };
}
async function markSuperseded(db: any, r: any, code: string | null): Promise<void> {
  if (!r.supersedes_id) return; const old = await reportById(db, String(r.supersedes_id)); if (!old || old.status !== 'approved') return;
  await db.from('portal_reports').update({ body: { ...(old.body || {}), superseded_by: { code, at: nowIso() } }, updated_at: nowIso() }).eq('id', old.id);
}
/** اعتماد تقرير الإنجاز على طلب بلا عقد يُنهي الطلب (in_progress/accepted → completed) */
async function completeRequestFromReport(db: any, r: any, code: string | null): Promise<void> {
  const rid = r.consulting_request_id ? String(r.consulting_request_id) : null; if (!rid || r.engagement_id) return; const req = await requestById(db, rid); if (!req || !['accepted', 'in_progress'].includes(String(req.status))) return;
  await db.from('portal_consulting_requests').update({ status: 'completed', completed_at: nowIso(), updated_at: nowIso() }).eq('id', rid); void code;
}
/** الوثائق المعتمَدة للطلب/العقد — لربط مخرجات تقرير الإنجاز بها («سلسلة الوثائق») */
export async function docsForRequest(db: any, rid: string | null, engId: string | null): Promise<{ id: string; kind: string; code: string; title: string; approved_at: string | null; superseded: boolean }[]> {
  if (!rid && !engId) return []; let qq = db.from('portal_reports').select('id,kind,verify_code,computed,approved_at,body,consulting_request_id,engagement_id').in('kind', ['advisory', 'study']).eq('status', 'approved');
  qq = rid ? qq.eq('consulting_request_id', rid) : qq.eq('engagement_id', engId); const rows = await safe<any[]>(qq.order('approved_at', { ascending: false }).limit(20), []);
  return rows.filter(r => r.verify_code).map(r => ({ id: String(r.id), kind: String(r.kind), code: String(r.verify_code), title: String(r.computed?.title || ''), approved_at: r.approved_at || null, superseded: !!r.body?.superseded_by }));
}
/** ما تراه الجهة في صفحة طلبها: وثائقها المعتمَدة بروابط إقرار جاهزة (صاحب الطلب أو الطاقم) */
export async function clientDocs(db: any, me: Me, rid: string, site: string): Promise<{ ok: true; docs: any[] } | { ok: false; error: string }> {
  const req = await requestById(db, rid); if (!req) return { ok: false, error: 'الطلب غير موجود' }; if (!me.staff && req.user_id !== me.id && lower(req.email) !== me.email) return { ok: false, error: 'غير مصرّح' };
  const rows = await safe<any[]>(db.from('portal_reports').select(REPORT_COLS + ',ack_token').in('kind', ['mission', 'advisory', 'study']).eq('status', 'approved').eq('consulting_request_id', rid).order('approved_at', { ascending: false }).limit(30), []);
  const out: any[] = [];
  for (const r of rows) { if (!r.verify_code) continue; let token = r.ack_token; if (!token) { token = ackToken(); const { error } = await db.from('portal_reports').update({ ack_token: token, updated_at: nowIso() }).eq('id', r.id); if (error) continue; }
    out.push({ id: String(r.id), kind: String(r.kind), kind_ar: docKindAr(r.kind), code: String(r.verify_code), title: String(r.kind === 'mission' ? r.computed?.title_ar : r.computed?.title || ''), author_name: String(r.author_name || ''), approved_at: r.approved_at || null, acked_at: r.body?.ack?.at || null, superseded: !!r.body?.superseded_by, url: `${site}/verify/report/${r.verify_code}?k=${token}` }); }
  return { ok: true, docs: out };
}
function pickDocs(all: any[], pred: (r: any) => boolean) {
  const rs = all.filter(pred); const pick = (k: string) => { const list = rs.filter(r => r.kind === k); const open = list.find(r => r.status !== 'approved'); const appr = list.filter(r => r.status === 'approved'); return { open: open ? { id: String(open.id), status: String(open.status) } : null, approved: appr.length, last: appr[0] ? { id: String(appr[0].id), code: appr[0].verify_code || null } : null }; };
  return { mission: pick('mission'), advisory: pick('advisory'), study: pick('study') };
}
/** بطاقات «مهماتي وطلباتي»: عقد (وطلبه إن وُجد) أو طلب مكلَّف به بلا عقد — بأزرار تقرير الإنجاز والرأي والدراسة */
export async function workCards(db: any, me: Me, mine: any[], onlyRequest?: string | null): Promise<any[]> {
  if (onlyRequest) {
    const req = await requestById(db, onlyRequest); if (!req) return []; const reps = await safe<any[]>(db.from('portal_reports').select(REPORT_COLS).eq('consulting_request_id', req.id).order('created_at', { ascending: false }).limit(50), []);
    return [{ src: 'req', engagement_id: null, request_id: String(req.id), title_ar: String(req.title || ''), kind: 'consult', kind_ar: 'طلب استشارة', status: String(req.status), org_ar: String(req.organization || ''), code: null, start_at: req.decided_at || req.created_at || null, end_at: req.completed_at || null, deliverables: 0, can_write: REQ_OK.includes(String(req.status)), ...pickDocs(reps, () => true) }];
  }
  const engs = await myEngagements(db, me); const prof = await myProfile(db, me);
  const rids = Array.from(new Set(engs.map(e => e.consulting_request_id).filter(Boolean))); const reqsOfEngs = rids.length ? await safe<any[]>(db.from('portal_consulting_requests').select(REQ_COLS).in('id', rids).limit(50), []) : []; const byId = new Map(reqsOfEngs.map(r => [String(r.id), r]));
  const mineReqs = await safe<any[]>(db.from('portal_consulting_requests').select(REQ_COLS).eq('assigned_to', me.id).in('status', REQ_OK).order('created_at', { ascending: false }).limit(30), []);
  const profReqs = prof ? await safe<any[]>(db.from('portal_consulting_requests').select(REQ_COLS).eq('expert_profile_id', prof.id).in('status', REQ_OK).limit(30), []) : [];
  // الوثائق على المصدر من أي كاتب (الطاقم قد يكتب على طلبي) — لا تقاريري فقط
  const engIds = engs.map(e => String(e.id)); const reqIds = Array.from(new Set([...mineReqs, ...profReqs].map(r => String(r.id))));
  const [byEng, byReq] = await Promise.all([engIds.length ? safe<any[]>(db.from('portal_reports').select(REPORT_COLS).in('engagement_id', engIds).order('created_at', { ascending: false }).limit(200), []) : Promise.resolve([] as any[]), reqIds.length ? safe<any[]>(db.from('portal_reports').select(REPORT_COLS).in('consulting_request_id', reqIds).is('engagement_id', null).order('created_at', { ascending: false }).limit(200), []) : Promise.resolve([] as any[])]);
  const seenIds = new Set<string>(); const all = [...mine, ...byEng, ...byReq].filter(r => { const id = String(r.id); if (seenIds.has(id)) return false; seenIds.add(id); return true; }).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  const docOf2 = (pred: (r: any) => boolean) => pickDocs(all, pred);
  const cards: any[] = engs.map(e => { const rq = byId.get(String(e.consulting_request_id || '')); return { src: 'eng', engagement_id: String(e.id), request_id: e.consulting_request_id ? String(e.consulting_request_id) : null, title_ar: String(e.title_ar || ''), kind: String(e.kind || 'consult'), kind_ar: e.kind === 'train' ? 'تدريب' : 'استشارة', status: String(e.status), org_ar: String(rq?.organization || ''), start_at: e.start_at || null, end_at: e.end_at || null, deliverables: Array.isArray(e.deliverables) ? e.deliverables.length : 0, code: e.code || null, can_write: true, ...docOf2(r => String(r.engagement_id || '') === String(e.id)) }; });
  const covered = new Set(engs.map(e => String(e.consulting_request_id || ''))); const seen = new Set<string>();
  for (const rq of [...mineReqs, ...profReqs]) { const id = String(rq.id); if (covered.has(id) || seen.has(id)) continue; seen.add(id); cards.push({ src: 'req', engagement_id: null, request_id: id, title_ar: String(rq.title || ''), kind: 'consult', kind_ar: 'طلب استشارة', status: String(rq.status), org_ar: String(rq.organization || ''), start_at: rq.decided_at || rq.created_at || null, end_at: rq.completed_at || null, deliverables: 0, code: null, can_write: true, ...docOf2(r => !r.engagement_id && String(r.consulting_request_id || '') === id) }); }
  return cards;
}
/** ما يُستأنف منه بطاقة ر3 القديمة */
export async function missionCards(db: any, me: Me, mine: any[]): Promise<any[]> { return (await workCards(db, me, mine)).filter(c => c.src === 'eng').map(c => ({ ...c, report_id: c.mission.open?.id || c.mission.last?.id || null, report_status: c.mission.open?.status || (c.mission.last ? 'approved' : null) })); }
/** عدد الوثائق الاستشارية المعتمَدة لعضو — لـ«ما شهده أَثَر» */
export async function docsWrittenCount(db: any, email: string): Promise<number> { const rows = await safe<any[]>(db.from('portal_reports').select('id').in('kind', ['advisory', 'study']).eq('status', 'approved').ilike('author_email', lower(email)).limit(500), []); return rows.length; }

/* ═════════════════════════════ ر4-أ — «ملف الدبلوم» (وحدات الدبلوم · نبض الأسبوع · تقرير الوحدة) ═════════════════════════════ */
const UNIT_COLS = 'id,created_at,updated_at,program_id,idx,title_ar,outcome_ar,hours,skill_codes,starts_on,ends_on,closed_at,closed_report_id,source,created_by';
const rowUnit = (u: any): Unit => ({ id: String(u.id), idx: Number(u.idx || 0), title_ar: String(u.title_ar || ''), outcome_ar: String(u.outcome_ar || ''), hours: Number(u.hours || 0), skill_codes: Array.isArray(u.skill_codes) ? u.skill_codes.map(String) : [], starts_on: u.starts_on ? String(u.starts_on).slice(0, 10) : null, ends_on: u.ends_on ? String(u.ends_on).slice(0, 10) : null, closed_at: u.closed_at || null, closed_report_id: u.closed_report_id || null, source: u.source === 'design' ? 'design' : 'manual' });
export async function unitsOf(db: any, programId: string): Promise<Unit[]> { const rows = await safe<any[]>(db.from('portal_program_units').select(UNIT_COLS).eq('program_id', programId).order('idx', { ascending: true }).limit(60), []); return rows.map(rowUnit).sort((a, b) => a.idx - b.idx); }
/** الوحدات كما تظهر في صفحة البرنامج العامة: العناوين والنواتج والحالة فقط */
export async function publicUnits(db: any, programId: string): Promise<{ idx: number; title_ar: string; outcome_ar: string; hours: number; state: string }[]> { const us = await unitsOf(db, programId); return unitStates(us, today()).map(x => ({ idx: x.unit.idx, title_ar: x.unit.title_ar, outcome_ar: x.unit.outcome_ar, hours: x.unit.hours, state: x.state })); }
/** حفظ الوحدات (قائد الدبلوم أو الطاقم): المغلقة لا تُحذف ولا يتغيّر ترتيبها */
export async function saveUnits(db: any, me: Me, programId: string, given: unknown): Promise<{ ok: true; units: Unit[] } | { ok: false; error: string }> {
  const scope = await myScope(db, me); if (!mayReportOn(scope, me, programId, null)) return { ok: false, error: 'لست مدرّب هذا البرنامج' };
  const program = await safe<any>(db.from('programs').select('id,program_type').eq('id', programId).maybeSingle(), null); if (!program) return { ok: false, error: 'البرنامج غير موجود' };
  const tpl = await templateFor(db, program); const existing = await unitsOf(db, programId); const closed = existing.filter(u => u.closed_at);
  const next = cleanUnits(given, tpl.skills); const nextIds = new Set(next.map(u => u.id).filter(Boolean));
  for (const c of closed) if (!nextIds.has(c.id)) return { ok: false, error: `الوحدة ${c.idx} «${c.title_ar}» مغلقة بتقرير معتمَد ولا تُحذف` };
  const keep = new Set(next.map(u => u.id).filter(Boolean)); const toDelete = existing.filter(u => !keep.has(u.id)).map(u => u.id);
  if (toDelete.length) { const { error } = await db.from('portal_program_units').delete().in('id', toDelete); if (error) return { ok: false, error: error.message }; }
  // ترقيم مؤقّت لتفادي تصادم (program_id, idx) أثناء إعادة الترتيب
  for (const u of next) if (u.id) await db.from('portal_program_units').update({ idx: 100 + u.idx }).eq('id', u.id);
  for (const u of next) {
    const ex = u.id ? existing.find(e => e.id === u.id) : null; const row: any = { program_id: programId, idx: u.idx, title_ar: u.title_ar, outcome_ar: u.outcome_ar, hours: u.hours, skill_codes: u.skill_codes, starts_on: u.starts_on, ends_on: u.ends_on, source: ex?.source || u.source, updated_at: nowIso() };
    if (ex?.closed_at) { row.title_ar = ex.title_ar; row.outcome_ar = ex.outcome_ar; }   // المغلقة: تواريخها وساعاتها قابلة للتصحيح، لا عنوانها وناتجها
    const q = u.id ? db.from('portal_program_units').update(row).eq('id', u.id) : db.from('portal_program_units').insert({ ...row, created_by: me.id }); const { error } = await q; if (error) return { ok: false, error: error.message };
  }
  return { ok: true, units: await unitsOf(db, programId) };
}
/** استيراد الوحدات من تصميم P11 المنشور لهذا البرنامج — مرّة واحدة إن لم توجد وحدات */
export async function importUnitsFromDesign(db: any, me: Me, programId: string): Promise<{ ok: true; units: Unit[]; imported: number } | { ok: false; error: string }> {
  const existing = await unitsOf(db, programId); if (existing.length) return { ok: false, error: 'توجد وحدات بالفعل — عدّلها بدل الاستيراد' };
  const drafts = await safe<any[]>(db.from('portal_program_drafts').select('id,design,program_id,stage').eq('program_id', programId).limit(5), []); const d = drafts.find(x => x.design && Array.isArray(x.design.modules) && x.design.modules.length);
  if (!d) return { ok: false, error: 'لا تصميم منشورًا لهذا البرنامج في هندسة البرامج — اكتب الوحدات يدويًا' };
  const program = await safe<any>(db.from('programs').select('id,program_type').eq('id', programId).maybeSingle(), null); const tpl = await templateFor(db, program || { id: programId });
  const units = unitsFromDesign(d.design, tpl.skills); if (!units.length) return { ok: false, error: 'التصميم بلا وحدات صالحة' };
  const r = await saveUnits(db, me, programId, units); if (!r.ok) return r; return { ok: true, units: r.units, imported: units.length };
}
/** ما جرى حول الدبلوم في فترة: مهمات سُلِّمت/صُدِّقت · بروفات بدائرة البرنامج · إجابات «كل يوم مهارة» · محطات — أعداد لكل متدرّب (بالبريد) */
async function aroundDiploma(db: any, programId: string, emails: string[], from: string, to: string): Promise<{ total: Around; per: Map<string, Around> }> {
  const lo = emails.map(lower).filter(Boolean); const fromTs = from + 'T00:00:00Z'; const toTs = to + 'T23:59:59Z'; const per = new Map<string, Around>(); const z = (): Around => ({ missions: 0, rehearsals: 0, cases: 0, stations: 0 }); const total = z();
  const bump = (email: unknown, k: keyof Around) => { const e = lower(email); if (!e) return; total[k]++; if (lo.includes(e)) { const a = per.get(e) || z(); a[k]++; per.set(e, a); } };
  const [ms, rh, cs, st] = await Promise.all([
    safe<any[]>(db.from('portal_missions').select('id,email,status,created_at,program_id').eq('program_id', programId).in('status', ['submitted', 'confirmed']).gte('created_at', fromTs).lte('created_at', toTs).limit(500), []),
    safe<any[]>(db.from('portal_rehearsals').select('id,email,partner_email,status,created_at,circle,circle_ref').eq('circle', 'program').eq('circle_ref', programId).in('status', ['accepted', 'done', 'reported']).gte('created_at', fromTs).lte('created_at', toTs).limit(500), []),
    lo.length ? safe<any[]>(db.from('portal_daily_case_responses').select('id,email,day').in('email', lo).gte('day', from).lte('day', to).limit(2000), []) : Promise.resolve([] as any[]),
    lo.length ? safe<any[]>(db.from('portal_after_stations').select('id,email,written_at').in('email', lo).gte('written_at', fromTs).lte('written_at', toTs).limit(500), []) : Promise.resolve([] as any[]),
  ]);
  for (const m of ms) bump(m.email, 'missions'); for (const r of rh) { bump(r.email, 'rehearsals'); if (r.partner_email) bump(r.partner_email, 'rehearsals'); } for (const c of cs) bump(c.email, 'cases'); for (const s of st) bump(s.email, 'stations');
  return { total, per };
}
/** آخر نبض/أسبوعي معتمَد أو مُرسَل قبل هذا الأسبوع للشعبة نفسها — مصدر «سلسلة الانتباه» */
async function prevAttention(db: any, programId: string, classroomId: string | null, before: string): Promise<{ key: string; name: string; reason: string; since_week: number }[]> {
  const rows = await safe<any[]>(db.from('portal_reports').select('id,kind,classroom_id,period_from,week_no,body,status').eq('kind', 'diploma_pulse').eq('program_id', programId).lt('period_from', before).order('period_from', { ascending: false }).limit(20), []);
  const prev = rows.find(r => String(r.classroom_id || '') === String(classroomId || '') && r.status !== 'returned'); if (!prev) return [];
  return carryAttention(prev.body as PulseBody, Number(prev.week_no || 1));
}
export async function computePulseSnapshot(db: any, me: Me, programId: string, classroomId: string | null, from: string, to: string): Promise<{ computed: PulseComputed; roster: StudentRow[] } | { error: string }> {
  const snap = await computeSnapshot(db, me, programId, classroomId, from, to); if ('error' in snap) return snap; const c = snap.computed;
  const units = await unitsOf(db, programId); const cur = currentUnit(units, to < today() ? to : today()); const around = await aroundDiploma(db, programId, snap.roster.map(r => r.email || ''), from, to);
  const absent = snap.roster.filter(r => r.attendance_pct === 0).length; const prev = await prevAttention(db, programId, classroomId, from);
  const weekly = await safe<any[]>(db.from('portal_reports').select('id,classroom_id,status').eq('kind', 'weekly').eq('program_id', programId).eq('period_from', from).limit(10), []); const fw = weekly.find(w => String(w.classroom_id || '') === String(classroomId || ''));
  const computed: PulseComputed = { kind: 'diploma_pulse', program_ar: c.program_ar, org_ar: c.org_ar, trainer_ar: c.trainer_ar, classroom_ar: c.classroom_ar, week_no: c.week_no, period_from: from, period_to: to, unit: cur ? { id: cur.id, idx: cur.idx, title_ar: cur.title_ar } : null, units_total: units.length, units_closed: units.filter(u => u.closed_at).length,
    enrolled: c.enrolled, regular: c.regular, absent, sessions: c.sessions, hours: c.hours, around: around.total, prev_attention: prev, roster: snap.roster.map(r => ({ key: r.key, name: r.name, email: r.email })), computed_at: nowIso(), full_weekly_id: fw ? String(fw.id) : null };
  return { computed, roster: snap.roster };
}
export async function createPulse(db: any, me: Me, b: { program_id: string; classroom_id?: string | null; period_from?: string }): Promise<{ ok: true; report: any; resumed?: boolean } | { ok: false; error: string }> {
  const scope = await myScope(db, me); const pid = String(b.program_id || ''); const cid = b.classroom_id ? String(b.classroom_id) : null; if (!mayReportOn(scope, me, pid, cid)) return { ok: false, error: 'لست مدرّب هذا البرنامج/الشعبة' };
  const wb = weekBounds(b.period_from && /^\d{4}-\d{2}-\d{2}$/.test(b.period_from) ? b.period_from : today());
  const ex = await safe<any[]>(db.from('portal_reports').select(REPORT_COLS).eq('kind', 'diploma_pulse').eq('program_id', pid).eq('period_from', wb.from).limit(10), []); const same = ex.find(r => String(r.classroom_id || '') === String(cid || '')); if (same) return { ok: true, report: same, resumed: true };
  const snap = await computePulseSnapshot(db, me, pid, cid, wb.from, wb.to); if ('error' in snap) return { ok: false, error: snap.error };
  const unitId = snap.computed.unit?.id || null;
  const row = { kind: 'diploma_pulse', program_id: pid, classroom_id: cid, unit_id: unitId, author_id: me.id, author_email: me.email, author_name: me.name || snap.computed.trainer_ar, week_no: snap.computed.week_no, period_from: wb.from, period_to: wb.to, status: 'draft', computed: snap.computed, body: emptyPulseBody(snap.computed), students: [], lines: [], lines_ok: false };
  const { data, error } = await db.from('portal_reports').insert(row).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...row, id: '' } };
}
/** النبضات والأسبوعيات التي تقع داخل فترة الوحدة للشعبة نفسها */
async function weeksInUnit(db: any, programId: string, classroomId: string | null, from: string, to: string): Promise<UnitWeek[]> {
  const rows = await safe<any[]>(db.from('portal_reports').select('id,kind,classroom_id,week_no,period_from,period_to,verify_code,status,students').in('kind', ['weekly', 'diploma_pulse']).eq('program_id', programId).gte('period_from', from).lte('period_from', to).order('period_from', { ascending: true }).limit(80), []);
  return rows.filter(r => String(r.classroom_id || '') === String(classroomId || '') && r.status !== 'returned').map(r => ({ id: String(r.id), kind: r.kind as 'weekly' | 'diploma_pulse', week_no: Number(r.week_no || 1), period_from: String(r.period_from), period_to: String(r.period_to), verify_code: r.verify_code || null, status: String(r.status), students: Array.isArray(r.students) ? r.students : [] })) as any;
}
/** كشف الوحدة مُعبَّأً من متوسط شبكات الأسابيع المعتمَدة داخل الوحدة (مهارات الوحدة فقط) */
function gridFromWeeks(roster: StudentRow[], weeks: (UnitWeek & { students?: StudentRow[] })[], skills: Skill[]): { rows: StudentRow[]; source: 'weeks' | 'empty' } {
  const appr = weeks.filter(w => w.kind === 'weekly' && w.status === 'approved' && Array.isArray(w.students)); if (!appr.length) return { rows: roster, source: 'empty' };
  const rows = roster.map(r => { const scores: Record<string, number | null> = {}; for (const k of skills) { const vals: number[] = []; for (const w of appr) { const s = (w.students as StudentRow[]).find(x => x.key === r.key); const v = s?.scores?.[k.code]; if (typeof v === 'number' && Number.isFinite(v)) vals.push(v); } scores[k.code] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null; } return { ...r, scores }; });
  return { rows: cleanStudents(rows, roster, skills), source: 'weeks' };
}
export async function computeUnitSnapshot(db: any, me: Me, unitId: string, classroomId: string | null): Promise<{ computed: UnitComputed; roster: StudentRow[]; marks: Map<string, Around>; unit: Unit } | { error: string }> {
  const uRow = await safe<any>(db.from('portal_program_units').select(UNIT_COLS).eq('id', unitId).maybeSingle(), null); if (!uRow) return { error: 'الوحدة غير موجودة' }; const unit = rowUnit(uRow); const pid = String(uRow.program_id);
  const units = await unitsOf(db, pid); const td = today(); const prevClosed = units.filter(u => u.idx < unit.idx && u.closed_at).sort((a, b) => b.idx - a.idx)[0];
  const program = await safe<any>(db.from('programs').select('id,start_date').eq('id', pid).maybeSingle(), null);
  const from = unit.starts_on || (prevClosed?.ends_on) || (program?.start_date ? String(program.start_date).slice(0, 10) : td); const to = unit.ends_on && unit.ends_on < td ? unit.ends_on : td;
  const snap = await computeSnapshot(db, me, pid, classroomId, from <= to ? from : to, to); if ('error' in snap) return snap; const c = snap.computed;
  const unitSkills = unit.skill_codes.length ? c.skills.filter(s => unit.skill_codes.includes(s.code)) : c.skills;
  const weeks = await weeksInUnit(db, pid, classroomId, from, to); const grid = gridFromWeeks(snap.roster, weeks as any, unitSkills);
  const around = await aroundDiploma(db, pid, snap.roster.map(r => r.email || ''), from, to); const marks = new Map<string, Around>(); for (const r of snap.roster) if (r.email) marks.set(r.key, around.per.get(lower(r.email)) || { missions: 0, rehearsals: 0, cases: 0, stations: 0 });
  // سلسلة الانتباه خلال الوحدة: كل من ذُكر في نبضاتها وما آل إليه آخر مرّة
  const pulses = await safe<any[]>(db.from('portal_reports').select('id,classroom_id,week_no,period_from,body,status').eq('kind', 'diploma_pulse').eq('program_id', pid).gte('period_from', from).lte('period_from', to).order('period_from', { ascending: true }).limit(80), []);
  const chain = new Map<string, { key: string; name: string; reason: string; since_week: number; last_change: any }>();
  for (const p of pulses.filter(x => String(x.classroom_id || '') === String(classroomId || '') && x.status !== 'returned')) { const b = p.body as PulseBody; for (const a of b?.attention || []) chain.set(a.key, { key: a.key, name: a.name, reason: a.reason, since_week: Number(p.week_no || 1), last_change: '' }); for (const f of b?.follow || []) { const e = chain.get(f.key); if (e) e.last_change = f.change || e.last_change; else chain.set(f.key, { key: f.key, name: f.name, reason: f.prev_reason, since_week: f.since_week, last_change: f.change || '' }); } }
  const { units: _u, ...rest } = c as any;
  const computed: UnitComputed = { ...rest, kind: 'diploma_unit', unit, unit_skills: unitSkills, skills: unitSkills, planned_hours: unit.hours, planned_from: unit.starts_on, planned_to: unit.ends_on, period_from: from <= to ? from : to, period_to: to,
    weeks: weeks.map(w => ({ id: w.id, kind: w.kind, week_no: w.week_no, period_from: w.period_from, period_to: w.period_to, verify_code: w.verify_code, status: w.status })), weekly_approved: weeks.filter(w => w.kind === 'weekly' && w.status === 'approved').length, pulses_approved: weeks.filter(w => w.kind === 'diploma_pulse' && w.status !== 'draft').length,
    attention: Array.from(chain.values()), around: around.total, units_total: units.length, units_closed: units.filter(u => u.closed_at).length, grid_source: grid.source };
  return { computed, roster: grid.rows, marks, unit };
}
export async function createUnitReport(db: any, me: Me, b: { unit_id: string; classroom_id?: string | null }): Promise<{ ok: true; report: any; resumed?: boolean } | { ok: false; error: string }> {
  const uRow = await safe<any>(db.from('portal_program_units').select('id,program_id,closed_at,idx').eq('id', String(b.unit_id || '')).maybeSingle(), null); if (!uRow) return { ok: false, error: 'الوحدة غير موجودة' };
  const pid = String(uRow.program_id); const cid = b.classroom_id ? String(b.classroom_id) : null; const scope = await myScope(db, me); if (!mayReportOn(scope, me, pid, cid)) return { ok: false, error: 'لست مدرّب هذا البرنامج/الشعبة' };
  const ex = await safe<any[]>(db.from('portal_reports').select(REPORT_COLS).eq('kind', 'diploma_unit').eq('unit_id', String(uRow.id)).limit(10), []); const same = ex.find(r => String(r.classroom_id || '') === String(cid || '')); if (same) return { ok: true, report: same, resumed: true };
  const snap = await computeUnitSnapshot(db, me, String(uRow.id), cid); if ('error' in snap) return { ok: false, error: snap.error };
  const students = cleanUnitStudents(snap.roster, snap.roster, snap.computed.unit_skills, snap.marks);
  const row = { kind: 'diploma_unit', program_id: pid, classroom_id: cid, unit_id: String(uRow.id), author_id: me.id, author_email: me.email, author_name: me.name || snap.computed.trainer_ar, week_no: Number(uRow.idx || 1), period_from: snap.computed.period_from, period_to: snap.computed.period_to, status: 'draft', computed: snap.computed, body: emptyUnitBody(snap.computed), students, lines: [], lines_ok: false };
  const { data, error } = await db.from('portal_reports').insert(row).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...row, id: '' } };
}
/** عند اعتماد تقرير الوحدة: تُغلق الوحدة (إن لم تكن مغلقة بتقرير شعبة أخرى من قبل تبقى مغلقة بالأول) */
async function closeUnitFromReport(db: any, r: any): Promise<void> { if (!r.unit_id) return; const u = await safe<any>(db.from('portal_program_units').select('id,closed_at').eq('id', String(r.unit_id)).maybeSingle(), null); if (!u || u.closed_at) return; await db.from('portal_program_units').update({ closed_at: nowIso(), closed_report_id: r.id, updated_at: nowIso() }).eq('id', String(r.unit_id)); }
/** بطاقات الدبلوم في تقاريري: شعب برامج الدبلوم في نطاقي (أو البرنامج كله إن لم تكن له شعب) */
export async function diplomaCards(db: any, me: Me, scope: { classrooms: Classroom[]; programs: { id: string; name_ar: string; program_type: string; start_date: string | null }[] }, mine: any[]): Promise<DiplomaCard[]> {
  const dipPrograms = scope.programs.filter(p => p.program_type === 'diploma'); if (!dipPrograms.length) return [];
  const td = today(); const wb = weekBounds(td); const pids = dipPrograms.map(p => p.id);
  const [unitRows, reps] = await Promise.all([safe<any[]>(db.from('portal_program_units').select(UNIT_COLS).in('program_id', pids).order('idx', { ascending: true }).limit(400), []), safe<any[]>(db.from('portal_reports').select('id,kind,program_id,classroom_id,unit_id,status,period_from,body,week_no').in('program_id', pids).in('kind', ['weekly', 'diploma_pulse', 'diploma_unit']).order('period_from', { ascending: false }).limit(600), [])]);
  const unitsBy = new Map<string, Unit[]>(); for (const u of unitRows) { const k = String(u.program_id); unitsBy.set(k, [...(unitsBy.get(k) || []), rowUnit(u)]); }
  const targets: { program: typeof dipPrograms[number]; room: Classroom | null }[] = [];
  for (const p of dipPrograms) { const rooms = scope.classrooms.filter(c => c.program_id === p.id); if (rooms.length) for (const r of rooms) targets.push({ program: p, room: r }); else targets.push({ program: p, room: null }); }
  return targets.map(({ program, room }) => {
    const cid = room ? room.id : null; const units = (unitsBy.get(program.id) || []).sort((a, b) => a.idx - b.idx); const mineOrStaff = (r: any) => me.staff || mine.some(m => m.id === r.id);
    const ofRoom = reps.filter(r => String(r.program_id) === program.id && String(r.classroom_id || '') === String(cid || ''));
    const us = unitStates(units, td).map(x => { const rep = ofRoom.find(r => r.kind === 'diploma_unit' && String(r.unit_id || '') === x.unit.id) || null; return { unit: x.unit, state: x.state, report_id: rep ? String(rep.id) : null, report_status: rep ? String(rep.status) : null }; });
    const pulse = ofRoom.find(r => r.kind === 'diploma_pulse' && String(r.period_from) === wb.from) || null; const weekly = ofRoom.find(r => r.kind === 'weekly' && String(r.period_from) === wb.from) || null;
    const lastPulse = ofRoom.find(r => r.kind === 'diploma_pulse' && r.status !== 'returned') || null; const attention_open = lastPulse ? carryAttention(lastPulse.body as PulseBody, Number(lastPulse.week_no || 1)).length : 0;
    return { program_id: program.id, classroom_id: cid, program_ar: program.name_ar, classroom_ar: room ? [room.section_name, room.code].filter(Boolean).join(' · ') : '', level: room?.level || null, units: us, current: currentUnit(units, td), pulse: pulse ? { id: String(pulse.id), status: String(pulse.status) } : null, weekly: weekly && mineOrStaff(weekly) ? { id: String(weekly.id), status: String(weekly.status) } : weekly ? { id: '', status: String(weekly.status) } : null, week: { from: wb.from, to: wb.to, week_no: weekNo(program.start_date, wb.from) }, attention_open, can_edit_units: true };
  });
}

/* ═════════════════════════════ ر4-ب — «كشف الكفايات» («العودة إلى الجواز») ═════════════════════════════ */
const PROFILE_SEL = 'id,program_id,classroom_id,subject_email,status,body,computed,author_email,verify_code,approved_at,created_at';
async function userIdOf(db: any, programId: string, email: string): Promise<string | null> {
  const e = lower(email); if (!e) return null;
  const en = await safe<any[]>(db.from('portal_enrollments').select('user_id').eq('program_id', programId).ilike('email', e).limit(5), []); const hit = en.find(x => x.user_id); if (hit) return String(hit.user_id);
  const any = await safe<any[]>(db.from('portal_enrollments').select('user_id').ilike('email', e).not('user_id', 'is', null).limit(1), []); if (any[0]?.user_id) return String(any[0].user_id);
  const cr = await safe<any[]>(db.from('portal_credentials').select('user_id').ilike('email', e).not('user_id', 'is', null).limit(1), []); return cr[0]?.user_id ? String(cr[0].user_id) : null;
}
/** لقطة الكشف: مسار المتدرّب عبر الوحدات المعتمَدة + أدلّة كل كفاية (الدرجات · المهمات · كل يوم مهارة · الجواز) + اقتراح محلي */
export async function computeProfileSnapshot(db: any, me: Me, programId: string, classroomId: string | null, email: string): Promise<{ computed: ProfileComputed } | { error: string }> {
  const e = lower(email); const program = await safe<any>(db.from('programs').select('id,start_date').eq('id', programId).maybeSingle(), null); if (!program) return { error: 'البرنامج غير موجود' };
  const td = today(); const from = program.start_date ? String(program.start_date).slice(0, 10) : td; const snap = await computeSnapshot(db, me, programId, classroomId, from <= td ? from : td, td); if ('error' in snap) return snap; const c = snap.computed;
  const row = snap.roster.find(r => lower(r.email || '') === e); if (!row) return { error: 'المتدرّب ليس في قائمة هذه الشعبة' };
  const units = await unitsOf(db, programId); const states = unitStates(units, td);
  const reps = await safe<any[]>(db.from('portal_reports').select('id,unit_id,classroom_id,status,verify_code,students,approved_at').eq('kind', 'diploma_unit').eq('program_id', programId).eq('status', 'approved').limit(100), []);
  const myRep = (uid: string | null) => { const of = reps.filter(r => String(r.unit_id || '') === String(uid || '')); return of.find(r => String(r.classroom_id || '') === String(classroomId || '')) || of[0] || null; };
  const unitRows = states.map(x => { const r = myRep(x.unit.id); const st = r ? ((Array.isArray(r.students) ? r.students : []) as UnitStudent[]).find(s => s.key === row.key) : null; return { idx: x.unit.idx, title_ar: x.unit.title_ar, state: x.state, score: st?.avg ?? null, decision: st?.decision || '', verify_code: r?.verify_code || null, scores: st?.scores || {}, skill_codes: x.unit.skill_codes }; });
  // أدلّة كل كفاية
  const codes = c.skills.map(s => s.code); const skRows = codes.length ? await safe<any[]>(db.from('portal_skills').select('id,code').in('code', codes).limit(100), []) : []; const skId = new Map(skRows.map(s => [String(s.code), String(s.id)]));
  const user_id = await userIdOf(db, programId, e); const ids = Array.from(skId.values());
  const [levels, missions, caseRows] = await Promise.all([
    user_id && ids.length ? safe<any[]>(db.from('portal_skill_levels').select('skill_id,computed_level,approved_level').eq('user_id', user_id).in('skill_id', ids).limit(100), []) : Promise.resolve([] as any[]),
    safe<any[]>(db.from('portal_missions').select('id,skills,status,title_ar,program_id').eq('program_id', programId).ilike('email', e).eq('status', 'confirmed').limit(100), []),
    safe<any[]>(db.from('portal_daily_case_responses').select('id,case_id,day').ilike('email', e).gte('day', from).limit(500), []),
  ]);
  const caseIds = Array.from(new Set(caseRows.map(r => String(r.case_id)))); const cases = caseIds.length ? await safe<any[]>(db.from('portal_daily_cases').select('id,skill_codes').in('id', caseIds).limit(500), []) : []; const caseSkills = new Map(cases.map(x => [String(x.id), (Array.isArray(x.skill_codes) ? x.skill_codes : []).map(String)]));
  const lvl = new Map(levels.map(l => [String(l.skill_id), l]));
  const competencies: Competency[] = c.skills.map(sk => {
    const sid = skId.get(sk.code) || null; const us = unitRows.filter(u => (u.skill_codes.length ? u.skill_codes.includes(sk.code) : true) && u.verify_code).map(u => ({ idx: u.idx, title_ar: u.title_ar, score: typeof u.scores[sk.code] === 'number' ? (u.scores[sk.code] as number) : null, decision: u.decision, verify_code: u.verify_code }));
    const vals = us.map(u => u.score).filter((v): v is number => v !== null); const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    const m = missions.filter(x => sid && Array.isArray(x.skills) && x.skills.map(String).includes(sid)).length; const cs = caseRows.filter(r => (caseSkills.get(String(r.case_id)) || []).includes(sk.code)).length;
    const L = sid ? lvl.get(sid) : null; const pc = L && L.computed_level !== null && L.computed_level !== undefined ? Math.round(Number(L.computed_level) * 10) / 10 : null; const pa = L?.approved_level ?? null;
    const sg = suggestLevel({ avg, missions: m, cases: cs, passport_computed: pc }); return { code: sk.code, name_ar: sk.name_ar, skill_id: sid, units: us, avg, missions: m, cases: cs, passport_computed: pc, passport_approved: pa === null ? null : Number(pa), suggested: sg.level, why: sg.why };
  });
  const around = await aroundDiploma(db, programId, [e], from, td); const my = around.per.get(e) || { missions: 0, rehearsals: 0, cases: 0, stations: 0 };
  // سلسلة الانتباه عبر كل النبضات
  const pulses = await safe<any[]>(db.from('portal_reports').select('id,classroom_id,week_no,body,status').eq('kind', 'diploma_pulse').eq('program_id', programId).order('period_from', { ascending: true }).limit(120), []); const attention: ProfileComputed['attention'] = [];
  for (const p of pulses.filter(x => String(x.classroom_id || '') === String(classroomId || '') && x.status !== 'returned')) { const b = p.body as PulseBody; for (const a of b?.attention || []) if (a.key === row.key) attention.push({ reason: a.reason, since_week: Number(p.week_no || 1), last_change: '' }); for (const f of b?.follow || []) if (f.key === row.key && f.change) { const last = attention[attention.length - 1]; if (last) last.last_change = f.change; } }
  const sup = await safe<any[]>(db.from('portal_reports').select('verify_code').eq('kind', 'diploma_profile').eq('program_id', programId).eq('status', 'approved').ilike('subject_email', e).order('approved_at', { ascending: false }).limit(1), []);
  const computed: ProfileComputed = { kind: 'diploma_profile', program_ar: c.program_ar, org_ar: c.org_ar, classroom_ar: c.classroom_ar, trainer_ar: c.trainer_ar, subject: { key: row.key, name: row.name, email: e, user_id },
    units: unitRows.map(({ scores: _s, skill_codes: _k, ...u }) => u), units_total: units.length, units_closed: units.filter(u => u.closed_at).length, units_reached: unitRows.filter(u => u.decision === 'completed' || u.decision === 'support').length,
    attendance_pct: row.attendance_pct, sessions: c.sessions, hours: c.hours, attention, around: my, competencies, computed_at: nowIso(), supersedes_code: sup[0]?.verify_code || null };
  return { computed };
}
/** الكشف الحيّ (غير المنسوخ) لمتدرّب في برنامج */
async function liveProfile(db: any, programId: string, email: string): Promise<any | null> { const rows = await safe<any[]>(db.from('portal_reports').select(REPORT_COLS).eq('kind', 'diploma_profile').eq('program_id', programId).ilike('subject_email', lower(email)).order('created_at', { ascending: false }).limit(10), []); return rows.find(r => !r.body?.superseded_by) || null; }
/** إنشاء كشف (أو استئنافه): مسودّة واحدة حيّة لكل (برنامج، متدرّب)؛ بعد الاعتماد تُنشأ نسخة جديدة تحمل supersedes_id */
export async function createProfile(db: any, me: Me, b: { program_id: string; classroom_id?: string | null; email: string; renew?: boolean }): Promise<{ ok: true; report: any; resumed?: boolean } | { ok: false; error: string }> {
  const pid = String(b.program_id || ''); const cid = b.classroom_id ? String(b.classroom_id) : null; const e = lower(b.email); if (!e) return { ok: false, error: 'اختر المتدرّب' };
  const scope = await myScope(db, me); if (!mayReportOn(scope, me, pid, cid)) return { ok: false, error: 'لست مدرّب هذا البرنامج/الشعبة' };
  const live = await liveProfile(db, pid, e); if (live && (live.status !== 'approved' || !b.renew)) return { ok: true, report: live, resumed: true };
  const snap = await computeProfileSnapshot(db, me, pid, cid, e); if ('error' in snap) return { ok: false, error: snap.error };
  const row = { kind: 'diploma_profile', program_id: pid, classroom_id: cid, subject_email: e, supersedes_id: live ? String(live.id) : null, author_id: me.id, author_email: me.email, author_name: me.name || snap.computed.trainer_ar, week_no: 1, period_from: today(), period_to: today(), status: 'draft', computed: snap.computed, body: emptyProfileBody(snap.computed), students: [], lines: [], lines_ok: true };
  const { data, error } = await db.from('portal_reports').insert(row).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...row, id: '' } };
}
/** عند اعتماد تقرير وحدة: كشف مسودّة لكل متدرّب في كشفها (إن لم يكن له كشف حيّ) + إعادة حساب الكشوف غير المعتمَدة */
export async function ensureProfilesFromUnit(db: any, r: any): Promise<{ created: number; refreshed: number }> {
  const pid = String(r.program_id); const cid = r.classroom_id ? String(r.classroom_id) : null; const me: Me = { id: String(r.author_id || ''), email: String(r.author_email || ''), name: String(r.author_name || ''), staff: true };
  const students: StudentRow[] = Array.isArray(r.students) ? r.students : []; let created = 0, refreshed = 0;
  for (const s of students) { if (!s.email) continue; const live = await liveProfile(db, pid, s.email);
    if (live && live.status !== 'approved') { const snap = await computeProfileSnapshot(db, me, pid, cid, s.email); if (!('error' in snap)) { const body = cleanProfileBody(live.body, snap.computed); await db.from('portal_reports').update({ computed: snap.computed, body, updated_at: nowIso() }).eq('id', live.id); refreshed++; } continue; }
    if (live) continue; const snap = await computeProfileSnapshot(db, me, pid, cid, s.email); if ('error' in snap) continue;
    const row = { kind: 'diploma_profile', program_id: pid, classroom_id: cid, subject_email: lower(s.email), supersedes_id: null, author_id: me.id || null, author_email: me.email, author_name: me.name, week_no: 1, period_from: today(), period_to: today(), status: 'draft', computed: snap.computed, body: emptyProfileBody(snap.computed), students: [], lines: [], lines_ok: true };
    const { error } = await db.from('portal_reports').insert(row); if (!error) created++; }
  return { created, refreshed };
}
/** قائمة كشوف الشعبة (للبطاقة): كل متدرّب وحالة كشفه */
export async function profilesOf(db: any, me: Me, programId: string, classroomId: string | null): Promise<{ ok: true; rows: { key: string; name: string; email: string; profile: { id: string; status: string; verify_code: string | null; approved_at: string | null; proven: number; total: number } | null }[] } | { ok: false; error: string }> {
  const scope = await myScope(db, me); if (!mayReportOn(scope, me, programId, classroomId)) return { ok: false, error: 'لست مدرّب هذا البرنامج/الشعبة' };
  const program = await safe<any>(db.from('programs').select('id,start_date').eq('id', programId).maybeSingle(), null); const td = today(); const from = program?.start_date ? String(program.start_date).slice(0, 10) : td;
  const snap = await computeSnapshot(db, me, programId, classroomId, from <= td ? from : td, td); if ('error' in snap) return { ok: false, error: snap.error };
  const reps = await safe<any[]>(db.from('portal_reports').select(PROFILE_SEL).eq('kind', 'diploma_profile').eq('program_id', programId).order('created_at', { ascending: false }).limit(300), []);
  return { ok: true, rows: snap.roster.filter(r => r.email).map(r => { const p = reps.find(x => lower(x.subject_email || '') === lower(r.email || '') && !x.body?.superseded_by) || null; const lv = (p?.body?.levels || []) as { level: number | null }[]; return { key: r.key, name: r.name, email: lower(r.email || ''), profile: p ? { id: String(p.id), status: String(p.status), verify_code: p.verify_code || null, approved_at: p.approved_at || null, proven: lv.filter(l => (l.level || 0) >= 1).length, total: lv.length } : null }; }) };
}
/** أدلّة كفاية واحدة نصًّا (للترتيب): كشوف الوحدات · المهمات المصدَّقة · إجابات «كل يوم مهارة» */
export async function profileEvidence(db: any, r: any, code: string): Promise<EvidenceItem[]> {
  const c = r.computed as ProfileComputed; const k = (c.competencies || []).find(x => x.code === code); if (!k) return []; const e = c.subject.email; const items: EvidenceItem[] = [];
  for (const u of k.units) if (u.score !== null) items.push({ source: `${R4_NAMES_AR.unit} ${u.idx}`, text: `الوحدة ${u.idx} «${u.title_ar}»: ${u.score}% في «${k.name_ar}»${u.decision ? ` · ${UNIT_DECISION_AR[u.decision as keyof typeof UNIT_DECISION_AR] || u.decision}` : ''}` });
  if (k.skill_id) { const ms = await safe<any[]>(db.from('portal_missions').select('id,title_ar,skills,evidence,status,confirmed_at').eq('program_id', String(r.program_id)).ilike('email', e).eq('status', 'confirmed').limit(50), []); for (const m of ms.filter(x => Array.isArray(x.skills) && x.skills.map(String).includes(k.skill_id!))) { const t = String(m.evidence?.text || m.evidence?.note || m.evidence?.summary || '').trim(); items.push({ source: `مهمة مصدَّقة «${String(m.title_ar || '').slice(0, 60)}»`, text: t || `صُدِّقت المهمة «${m.title_ar}» من المشرف` }); } }
  const rs = await safe<any[]>(db.from('portal_daily_case_responses').select('id,case_id,day,response,evaluation').ilike('email', e).order('day', { ascending: false }).limit(60), []); const cids = Array.from(new Set(rs.map(x => String(x.case_id))));
  const cases = cids.length ? await safe<any[]>(db.from('portal_daily_cases').select('id,title_ar,skill_codes').in('id', cids).limit(60), []) : []; const cm = new Map(cases.map(x => [String(x.id), x]));
  for (const x of rs) { const cs = cm.get(String(x.case_id)); if (!cs || !(Array.isArray(cs.skill_codes) ? cs.skill_codes.map(String) : []).includes(code)) continue; const perf = String(x.evaluation?.performance_ar || '').trim(); items.push({ source: `كل يوم مهارة ${fmtDayAr(String(x.day || '').slice(0, 10))}`, text: `${String(x.response || '').slice(0, 400)}${perf ? ` — المرآة: ${perf.slice(0, 200)}` : ''}` }); if (items.length >= 12) break; }
  return items.slice(0, 12);
}
/** «رتّب الأدلّة»: الذكاء يصوغ ≤3 جمل بمصدر، والتنقية المحلية صارمة، ولا يُحفظ شيء حتى يُبقيه المعلّم */
export async function arrangeEvidence(db: any, me: Me, id: string, code: string, ai: (p: { system: string; user: string }) => Promise<any | null>): Promise<{ ok: true; quotes: { code: string; text: string; source: string }[]; source: 'ai' | 'local'; items: number; rejected: number } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r || r.kind !== 'diploma_profile') return { ok: false, error: 'الكشف غير موجود' }; if (!canView(r, me)) return { ok: false, error: 'غير مصرّح' };
  const k = ((r.computed as ProfileComputed).competencies || []).find(x => x.code === code); if (!k) return { ok: false, error: 'الكفاية ليست في هذا الكشف' };
  const items = await profileEvidence(db, r, code); if (!items.length) return { ok: true, quotes: [], source: 'local', items: 0, rejected: 0 };
  let raw: any = null; try { raw = await ai(evidencePrompt(k.name_ar, items)); } catch { raw = null; }
  if (raw) { const cl = cleanEvidenceQuotes(code, raw, items); if (cl.quotes.length) return { ok: true, quotes: cl.quotes, source: 'ai', items: items.length, rejected: cl.rejected }; }
  return { ok: true, quotes: localEvidenceQuotes(code, items), source: 'local', items: items.length, rejected: 0 };
}
/** بعد اعتماد الكشف: «العودة إلى الجواز» + سطر المتدرّب + نسخ الكشف السابق */
async function afterProfileApproved(db: any, me: Me, r: any, code: string | null, site: string): Promise<void> {
  const c = r.computed as ProfileComputed; const b = r.body as ProfileBody; const note = `${R4B_NAMES_AR.profile} ${code || ''}`.trim();
  if (c.subject.user_id) for (const w of passportWrites(b, c)) { const k = c.competencies.find(x => x.code === w.code); await db.from('portal_skill_levels').upsert({ user_id: c.subject.user_id, skill_id: w.skill_id, computed_level: k?.passport_computed ?? w.level, approved_level: w.level, approved_by: me.id, approved_at: nowIso(), approved_note: note, updated_at: nowIso() }, { onConflict: 'user_id,skill_id' }); }
  const text = profileLineText(b, c); await db.from('portal_report_lines').upsert({ report_id: r.id, program_id: r.program_id, user_id: c.subject.user_id, email: c.subject.email, text_ar: text, week_no: 0, period_to: today(), kind: 'diploma_profile', verify_code: code, data: profileLineData(b, c) }, { onConflict: 'report_id,email', ignoreDuplicates: true });
  await db.from('portal_reports').update({ lines_sent_at: nowIso() }).eq('id', r.id);
  try { await notify(db, { kind: 'report_line', to: { email: c.subject.email, name: c.subject.name }, ref: `rep:line:${r.id}:${c.subject.email}`, subject: `${R4B_NAMES_AR.profile} — ${c.program_ar}`, text: text, url: `${site}/me#report-lines` }); } catch { /* داخلي */ }
  try { await markSuperseded(db, r, code || ''); } catch { /* داخلي */ }
}
/** قراءة الدفعة لبرنامج: كشوف معتمَدة حيّة · k ≥ 5 · بلا أسماء */
export async function cohortOf(db: any, programId: string): Promise<ReturnType<typeof cohortReading> & { program_ar: string }> {
  const rows = await safe<any[]>(db.from('portal_reports').select('id,body,computed,status').eq('kind', 'diploma_profile').eq('program_id', programId).eq('status', 'approved').limit(500), []);
  const live = rows.filter(r => !r.body?.superseded_by); const p = await safe<any>(db.from('programs').select('name_ar').eq('id', programId).maybeSingle(), null); return { ...cohortReading(live), program_ar: String(p?.name_ar || live[0]?.computed?.program_ar || '') };
}
/** قراءة الدفعات لجهة (برامج الجهة ذات كشوف معتمَدة) */
export async function cohortsOfOrg(db: any, orgId: string): Promise<{ program_id: string; program_ar: string; n: number; shown: boolean; completion_pct: number | null; avg_hours: number | null; competencies: { code: string; name_ar: string; dist: number[]; avg_level: number | null }[] }[]> {
  const ens = await safe<any[]>(db.from('portal_enrollments').select('program_id').eq('organization_id', orgId).eq('status', 'approved').limit(2000), []); const pids = Array.from(new Set(ens.map(e => String(e.program_id)))).slice(0, 40); if (!pids.length) return [];
  const out: any[] = []; for (const pid of pids) { const c = await cohortOf(db, pid); if (c.n) out.push({ program_id: pid, ...c }); } return out;
}
/** شاهد الهيئة: كم كشف كفايات معتمَدًا قاده (كاتبًا) وكم دبلومًا */
export async function profilesLedCount(db: any, email: string): Promise<{ profiles: number; diplomas: number }> { const rows = await safe<any[]>(db.from('portal_reports').select('id,program_id').eq('kind', 'diploma_profile').eq('status', 'approved').ilike('author_email', lower(email)).limit(500), []); return { profiles: rows.length, diplomas: new Set(rows.map(r => String(r.program_id))).size }; }
/** ما يظهر في الشهادة الحيّة بإذن صاحبها: الكفايات بمستوياتها (بلا توصية) */
export async function credentialProfile(db: any, code: string): Promise<any | null> {
  const cred = await safe<any>(db.from('portal_credentials').select('id,user_id,email,program_id').ilike('verify_code', code).maybeSingle(), null); if (!cred?.program_id) return null;
  const rows = await safe<any[]>(db.from('portal_report_lines').select(LINE_COLS).eq('kind', 'diploma_profile').eq('program_id', cred.program_id).eq('show_on_credential', true).ilike('email', lower(cred.email)).order('created_at', { ascending: false }).limit(1), []); const l = rows[0]; if (!l) return null;
  const d = l.data || {}; return { verify_code: l.verify_code, levels: (d.levels || []).map((x: any) => ({ name_ar: x.name_ar, level: x.level, level_ar: x.level_ar })), strengths: String(d.strengths || ''), units_reached: d.units_reached ?? null, units_total: d.units_total ?? null, hours: d.hours ?? null, period_to: l.period_to };
}

/* ═════════════════════════════ P47 — «البرنامج الذي يراجع نفسه» (مراجعة البرنامج بعد الدفعة) ═════════════════════════════ */
const REVIEW_SEL = 'id,program_id,classroom_id,status,verify_code,approved_at,computed,body,author_email,created_at,week_no';
/** «وعد التصميم»: وحدات الدبلوم (ر4) ← وإلا مخطّط هندسة البرامج (P11) ← وإلا قالب مهارات البرنامج */
async function programPromise(db: any, program: any, skills: Skill[]): Promise<{ source: ReviewComputed['source']; hours: number; units: PromiseUnit[] }> {
  const units = await unitsOf(db, String(program.id)); if (units.length) return { source: 'units', hours: units.reduce((a, u) => a + (Number(u.hours) || 0), 0) || Number(program.hours) || 0, units: units.map(u => ({ idx: u.idx, title_ar: u.title_ar, outcome_ar: u.outcome_ar, hours: u.hours, skill_codes: u.skill_codes })) };
  const drafts = await safe<any[]>(db.from('portal_program_drafts').select('id,design,program_id,stage').eq('program_id', String(program.id)).limit(3), []); const d = drafts.find(x => x.design)?.design;
  if (d) { const us = unitsFromDesign(d, skills); if (us.length) return { source: 'design', hours: Number(d.hours) || Number(program.hours) || 0, units: us.map(u => ({ idx: u.idx, title_ar: u.title_ar, outcome_ar: u.outcome_ar, hours: u.hours, skill_codes: u.skill_codes })) }; }
  return { source: 'template', hours: Number(program.hours) || 0, units: [] };
}
/** لقطة المراجعة: الوعد · ما ثبت (من المعتمَد فقط) · الفجوات · المراجعات السابقة لنفس البرنامج */
export async function computeReviewSnapshot(db: any, me: Me, programId: string, classroomId: string | null): Promise<{ computed: ReviewComputed } | { error: string }> {
  const program = await safe<any>(db.from('programs').select('id,name_ar,program_type,start_date,end_date,hours').eq('id', programId).maybeSingle(), null); if (!program) return { error: 'البرنامج غير موجود' };
  const td = today(); const weeks = await weeksFor(db, programId, classroomId); const from = String(program.start_date || weeks[0]?.period_from || td).slice(0, 10); const endRaw = program.end_date ? String(program.end_date).slice(0, 10) : null; const to = endRaw && endRaw < td ? endRaw : td;
  const snap = await computeSnapshot(db, me, programId, classroomId, from < to ? from : to, to); if ('error' in snap) return snap; const c = snap.computed; const roster = snap.roster;
  const promise = await programPromise(db, program, c.skills); const sameRoom = (r: any) => String(r.classroom_id || '') === String(classroomId || '');
  const reps = await safe<any[]>(db.from('portal_reports').select('id,kind,classroom_id,unit_id,status,verify_code,students,body,computed,approved_at,period_to').eq('program_id', programId).in('kind', ['diploma_unit', 'final', 'diploma_profile', 'program_review']).eq('status', 'approved').limit(600), []);
  const unitReps = reps.filter(r => r.kind === 'diploma_unit' && sameRoom(r)); const unitsRows = await unitsOf(db, programId);
  const units: ReviewUnit[] = promise.units.map(pu => { const u = unitsRows.find(x => x.idx === pu.idx) || null; const r = u ? unitReps.find(x => String(x.unit_id || '') === String(u.id || '')) || null : null; const st: UnitStudent[] = r && Array.isArray(r.students) ? r.students : []; const dec = (k: string) => st.filter(s => s.decision === k).length;
    return { idx: pu.idx, title_ar: pu.title_ar, hours_planned: pu.hours, hours_actual: r?.computed?.hours ?? null, closed: !!(u?.closed_at || r), report_code: r?.verify_code || null, outcome_pct: r && r.body?.outcome?.pct !== null && r.body?.outcome?.pct !== undefined ? Number(r.body.outcome.pct) : null, avg: r ? summativeStats(st).avg : null, decisions: { completed: dec('completed'), support: dec('support'), repeat: dec('repeat'), pending: dec('pending') + st.filter(s => !s.decision).length }, attention: Array.isArray(r?.computed?.attention) ? r.computed.attention.length : 0 }; });
  const profiles = reps.filter(r => r.kind === 'diploma_profile' && sameRoom(r) && !r.body?.superseded_by); const fin = reps.find(r => r.kind === 'final' && sameRoom(r)) || null;
  const finSt: FinalStudent[] = fin && Array.isArray(fin.students) ? fin.students : []; const completion_pct = profiles.length ? Math.round((profiles.filter(p => p.body?.recommendation === 'complete' || p.body?.recommendation === 'complete_plan').length / profiles.length) * 100) : finSt.length ? Math.round((finSt.filter(s => s.rec === 'promote' || s.rec === 'continue').length / finSt.length) * 100) : null;
  // كفايات: متوسط من كشوف الوحدات (وإلا من الأسابيع المعتمَدة) · توزيع كشوف الكفايات · مهمات وحالات الدفعة
  const codes = c.skills.map(s => s.code); const skRows = codes.length ? await safe<any[]>(db.from('portal_skills').select('id,code').in('code', codes).limit(100), []) : []; const skId = new Map(skRows.map(s => [String(s.code), String(s.id)]));
  const emails = roster.map(r => lower(r.email || '')).filter(Boolean);
  const [missions, caseRows] = await Promise.all([safe<any[]>(db.from('portal_missions').select('id,skills,status,email').eq('program_id', programId).eq('status', 'confirmed').limit(500), []), emails.length ? safe<any[]>(db.from('portal_daily_case_responses').select('id,case_id,email').in('email', emails).limit(2000), []) : Promise.resolve([] as any[])]);
  const caseIds = Array.from(new Set(caseRows.map(r => String(r.case_id)))); const cases = caseIds.length ? await safe<any[]>(db.from('portal_daily_cases').select('id,skill_codes').in('id', caseIds).limit(500), []) : []; const caseSkills = new Map(cases.map(x => [String(x.id), (Array.isArray(x.skill_codes) ? x.skill_codes : []).map(String)]));
  const skills: ReviewSkill[] = c.skills.map(sk => { const sid = skId.get(sk.code) || null; const vals: number[] = []; for (const r of unitReps) for (const s of (Array.isArray(r.students) ? r.students : []) as StudentRow[]) { const v = s.scores?.[sk.code]; if (typeof v === 'number') vals.push(v); } if (!vals.length) for (const w of weeks) for (const s of w.students) { const v = s.scores?.[sk.code]; if (typeof v === 'number') vals.push(v); }
    const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null; const dist = [0, 0, 0, 0, 0, 0]; let proven = 0; for (const p of profiles) { const l = ((p.body?.levels || []) as ProfileLevel[]).find(x => x.code === sk.code); if (l) { const lv = Math.max(0, Math.min(5, l.level || 0)); dist[lv]++; if (lv >= 1) proven++; } }
    return { code: sk.code, name_ar: sk.name_ar, avg, dist, profiles: profiles.length, proven_pct: profiles.length ? Math.round((proven / profiles.length) * 100) : null, missions: missions.filter(x => sid && Array.isArray(x.skills) && x.skills.map(String).includes(sid)).length, cases: caseRows.filter(r => (caseSkills.get(String(r.case_id)) || []).includes(sk.code)).length, in_units: promise.units.filter(u => u.skill_codes.includes(sk.code)).map(u => u.idx) }; });
  const [stations, letters] = await Promise.all([safe<any[]>(db.from('portal_after_stations').select('id,state').eq('program_id', programId).limit(1000), []), safe<any[]>(db.from('portal_after_letters').select('id').eq('program_id', programId).limit(1000), [])]);
  const prevRows = reps.filter(r => r.kind === 'program_review').sort((a, b) => String(a.approved_at || '').localeCompare(String(b.approved_at || '')));
  const previous = prevRows.map(r => { const b: ReviewBody = r.body || emptyReviewBody(); return { code: String(r.verify_code || ''), period_to: String(r.period_to || ''), ...gapCounts(r.computed?.gaps || []), accepted: b.decisions.filter(d => d.decision === 'accept' || d.decision === 'edit').length }; });
  const proven: ReviewComputed['proven'] = { enrolled: c.enrolled, regular: c.regular, attendance_pct: roster.length && c.sessions ? Math.round(roster.reduce((a, r) => a + (r.attendance_pct || 0), 0) / roster.length) : null, sessions: c.sessions, hours: c.hours, weeks_approved: weeks.length, final_code: fin?.verify_code || null, profiles: profiles.length, completion_pct, units, skills, after: { stations: stations.length, applied: stations.filter(s => s.state === 'applied' || s.state === 'partly').length, letters: letters.length } };
  const computed: ReviewComputed = { kind: 'program_review', program_ar: c.program_ar, program_type: c.program_type, org_ar: c.org_ar, classroom_ar: c.classroom_ar, trainer_ar: c.trainer_ar, cohort_no: previous.length + 1, period_from: from < to ? from : to, period_to: to, source: promise.source, promise: { hours: promise.hours, units: promise.units, skills: c.skills.map(s => ({ code: s.code, name_ar: s.name_ar })) }, proven, gaps: [], previous, computed_at: nowIso() };
  computed.gaps = buildGaps(computed.promise, computed.proven); return { computed };
}
export type ReviewCard = { program_id: string; classroom_id: string | null; program_ar: string; classroom_ar: string; ready: boolean; reason_ar: string; review: { id: string; status: string; code: string | null } | null; cohort_no: number };
/** بطاقات «راجع الدفعة»: تظهر حين تكتمل الدفعة (ختامي معتمَد · أو كل وحدات الدبلوم مغلقة · أو انتهى تاريخ البرنامج) أو حين توجد مراجعة */
export async function reviewCards(db: any, me: Me, scope: { classrooms: Classroom[]; programs: { id: string; name_ar: string; program_type: string }[] }, mine: any[]): Promise<ReviewCard[]> {
  if (!scope.classrooms.length) return []; const pids = Array.from(new Set(scope.classrooms.map(c => c.program_id))); const td = today();
  const [progs, reps, unitRows] = await Promise.all([safe<any[]>(db.from('programs').select('id,end_date').in('id', pids).limit(100), []), safe<any[]>(db.from('portal_reports').select('id,kind,program_id,classroom_id,status,verify_code,unit_id,approved_at').in('program_id', pids).in('kind', ['final', 'diploma_unit', 'program_review']).limit(800), []), safe<any[]>(db.from('portal_program_units').select('id,program_id,idx,closed_at').in('program_id', pids).limit(400), [])]);
  const pm = new Map(progs.map(p => [String(p.id), p])); const out: ReviewCard[] = [];
  for (const room of scope.classrooms) { const of = reps.filter(r => String(r.program_id) === room.program_id && String(r.classroom_id || '') === room.id); const us = unitRows.filter(u => String(u.program_id) === room.program_id);
    const fin = of.find(r => r.kind === 'final' && r.status === 'approved'); const allClosed = us.length > 0 && us.every(u => u.closed_at || of.some(r => r.kind === 'diploma_unit' && r.status === 'approved' && String(r.unit_id || '') === String(u.id))); const end = pm.get(room.program_id)?.end_date ? String(pm.get(room.program_id).end_date).slice(0, 10) : null; const ended = !!end && end < td;
    const reviews = of.filter(r => r.kind === 'program_review').sort((a, b) => String(b.approved_at || b.id).localeCompare(String(a.approved_at || a.id))); const open = reviews.find(r => r.status !== 'approved') || reviews[0] || null; const approvedN = reps.filter(r => r.kind === 'program_review' && r.status === 'approved' && String(r.program_id) === room.program_id).length;
    const ready = !!fin || allClosed || ended; if (!ready && !open) continue; const visible = !open || me.staff || mine.some(m => m.id === open.id);
    out.push({ program_id: room.program_id, classroom_id: room.id, program_ar: room.program_ar, classroom_ar: [room.section_name, room.code].filter(Boolean).join(' · '), ready, reason_ar: fin ? 'التقرير الختامي معتمَد' : allClosed ? 'كل وحدات الدبلوم مغلقة' : ended ? 'انتهى تاريخ البرنامج' : 'الدفعة لم تكتمل بعد', review: open && visible ? { id: String(open.id), status: String(open.status), code: open.verify_code || null } : null, cohort_no: open?.status === 'approved' ? approvedN : approvedN + 1 }); }
  return out;
}
export async function createReview(db: any, me: Me, b: { program_id: string; classroom_id?: string | null }): Promise<{ ok: true; report: any } | { ok: false; error: string }> {
  const scope = await myScope(db, me); const pid = String(b.program_id || ''); const cid = b.classroom_id ? String(b.classroom_id) : null; if (!mayReportOn(scope, me, pid, cid)) return { ok: false, error: 'لست مدرّب هذا البرنامج/الشعبة' };
  const ex = (await safe<any[]>(db.from('portal_reports').select('id,classroom_id,status').eq('kind', 'program_review').eq('program_id', pid).limit(50), [])).find(d => String(d.classroom_id || '') === String(cid || '') && d.status !== 'approved'); if (ex) return { ok: false, error: 'توجد مراجعة مفتوحة لهذه الدفعة — افتحها من قائمتك' };
  const card = (await reviewCards(db, me, scope, [])).find(x => x.program_id === pid && String(x.classroom_id || '') === String(cid || '')); if (!card || !card.ready) return { ok: false, error: 'الدفعة لم تكتمل بعد — تُفتح المراجعة بعد اعتماد التقرير الختامي، أو إغلاق كل وحدات الدبلوم، أو انتهاء تاريخ البرنامج' };
  const rs = await computeReviewSnapshot(db, me, pid, cid); if ('error' in rs) return { ok: false, error: rs.error }; const c = rs.computed;
  const row = { kind: 'program_review', program_id: pid, classroom_id: cid, author_id: me.id, author_email: me.email, author_name: me.name || c.trainer_ar, week_no: c.cohort_no, period_from: c.period_from, period_to: c.period_to, status: 'draft', computed: c, body: emptyReviewBody(), students: [], lines: [], lines_ok: false };
  const { data, error } = await db.from('portal_reports').insert(row).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message }; return { ok: true, report: data || { ...row, id: '' } };
}
/** «اقترح التعديلات»: محليًا بقاعدة مُعلنة، أو بالذكاء الاصطناعي بعد تنقية صارمة — ثم تُحفظ كاقتراحات تنتظر قرار الإنسان (تبقى قرارات الاقتراحات المطابقة) */
export async function proposeChanges(db: any, me: Me, id: string, ai: ((p: { system: string; user: string }) => Promise<any | null>) | null): Promise<{ ok: true; report: any; source: 'local' | 'ai'; rejected: number } | { ok: false; error: string }> {
  const r = await reportById(db, id); if (!r) return { ok: false, error: 'المراجعة غير موجودة' }; if (r.kind !== 'program_review') return { ok: false, error: 'الاقتراحات للمراجعة فقط' }; if (!canEdit(r, me)) return { ok: false, error: 'لا يمكن تعديل هذه المراجعة الآن' };
  const c: ReviewComputed = r.computed; let proposals = localProposals(c); let source: 'local' | 'ai' = 'local'; let rejected = 0;
  if (ai && c.gaps.length) { try { const raw = await ai(reviewPrompt(c)); if (raw) { const cl = cleanProposals(raw, c, 'ai'); rejected = cl.rejected; if (cl.proposals.length) { proposals = cl.proposals; source = 'ai'; } } } catch { /* المحلي يكفي */ } }
  const body = mergeProposals(cleanReviewBody(r.body), proposals, source); const patch = { body, updated_at: nowIso() }; const { data, error } = await db.from('portal_reports').update(patch).eq('id', id).select(REPORT_COLS).maybeSingle(); if (error) return { ok: false, error: error.message };
  return { ok: true, report: data || { ...r, ...patch }, source, rejected };
}
/** الشريط العام على صفحة البرنامج (بلا أسماء): كم مرة راجع البرنامج نفسه وما آخر ما تغيّر */
export async function programReviews(db: any, programId: string): Promise<ReturnType<typeof programChangeLog> & { program_ar: string }> {
  const rows = await safe<any[]>(db.from('portal_reports').select(REVIEW_SEL).eq('kind', 'program_review').eq('program_id', programId).eq('status', 'approved').limit(100), []);
  return { ...programChangeLog(rows), program_ar: String(rows[0]?.computed?.program_ar || '') };
}
