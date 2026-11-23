// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هـ-1/5 — توأمة البرامج والدبلومات + EXIT — طبقة القاعدة
 *  diplomaOverview(program)      للطاقم: كلّ المقيَّدين بتقدّمهم وإشارتهم المبكرة وحالتهم
 *  learnerCarry(email)           للطالب: «لو خرجت اليوم تحمل معك» لكلّ دبلوم مقيَّد فيه
 *  autoCompletions(program)      يملأ إتمام المقرّرات آليًّا (حضور ≥ ٧٥٪ بعد الإغلاق · شهادة برنامج مرتبط) — لا يمسّ القرارات اليدوية
 *  setCompletion                 قرار يدوي من الطاقم
 *  exitCredentials(enrollment)   يصدر شهادات المستويات المكتملة + سجلّ الإنجاز عبر مسار P17 ويسجّل الخروج
 *  returnFromExit                العودة من حيث توقّف
 */
import { attendanceVerdict, carryToday, riskSignal, stateOf, canExit, canReturn, returnByOf, achievementRecord, EXIT_NAMES_AR, type Unit, type Completion, type AttendanceDay, type Carry, type ExitState } from './exit';
import { buildBadge, verifyCode } from '../portal/profile';
import { buildCredentialDoc, didWeb } from '../portal/vc';
import { ensureKeyRow, signAndStoreCredential, signerFromEnv } from '../portal/vc-server';

type Db = any;
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data == null ? fb : (data as X); } catch { return fb; } }
const UNIT_COLS = 'id,idx,title_ar,level_no,hours,starts_on,ends_on,closed_at,linked_program_id';
const ENROLLED = ['approved', 'placed', 'active', 'completed'];
const todayKey = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const toUnit = (r: any): Unit => ({ id: String(r.id), idx: Number(r.idx || 0), title_ar: String(r.title_ar || ''), level_no: r.level_no == null ? null : Number(r.level_no), hours: Number(r.hours || 0), starts_on: r.starts_on || null, ends_on: r.ends_on || null, closed_at: r.closed_at || null, linked_program_id: r.linked_program_id || null });
const toComp = (r: any): Completion => ({ unit_id: String(r.unit_id), status: r.status, source: r.source, attendance_pct: r.attendance_pct ?? null });

async function loadProgram(db: Db, programId: string) {
  const [program, uRows] = await Promise.all([
    safe<any>(db.from('programs').select('id,name_ar,program_type,levels_count,organization_id').eq('id', programId).maybeSingle(), null),
    safe<any[]>(db.from('portal_program_units').select(UNIT_COLS).eq('program_id', programId).order('level_no', { ascending: true, nullsFirst: false }).order('idx').limit(80), []),
  ]);
  return { program, units: arr<any>(uRows).map(toUnit) };
}
/** أيام الحضور لكلّ بريد في البرنامج: محاضرة (جلسة حضور) × هل حضر */
async function attendanceDays(db: Db, programId: string, emails: string[]): Promise<Map<string, AttendanceDay[]>> {
  const out = new Map<string, AttendanceDay[]>(); const low = emails.map((e) => e.toLowerCase()); for (const e of low) out.set(e, []);
  const sess = await safe<any[]>(db.from('attendance_sessions').select('id,session_date').eq('program_id', programId).order('session_date').limit(400), []); if (!sess.length) return out;
  const ids = sess.map((s) => s.id); const recs = await safe<any[]>(db.from('attendance_records').select('session_id,email,status').in('session_id', ids).limit(20000), []);
  const present = new Map<string, Set<string>>(); for (const r of recs) { const e = String(r.email || '').toLowerCase(); if (!e || !['present', 'late'].includes(r.status)) continue; if (!present.has(e)) present.set(e, new Set()); present.get(e)!.add(String(r.session_id)); }
  for (const e of low) out.set(e, sess.map((s) => ({ day: String(s.session_date), present: !!present.get(e)?.has(String(s.id)) })));
  return out;
}
async function completionsOf(db: Db, programId: string, emails?: string[]): Promise<Map<string, Completion[]>> {
  let q = db.from('portal_unit_completions').select('unit_id,email,status,source,attendance_pct').eq('program_id', programId).limit(5000); if (emails?.length) q = q.in('email', emails.map((e) => e.toLowerCase()));
  const rows = await safe<any[]>(q, []); const m = new Map<string, Completion[]>();
  for (const r of rows) { const e = String(r.email).toLowerCase(); if (!m.has(e)) m.set(e, []); m.get(e)!.push(toComp(r)); } return m;
}

/* ───────── الطاقم: نظرة الدبلوم ───────── */
export type OverviewRow = { enrollment_id: string; email: string; full_name: string; user_id: string | null; state: ExitState; carry: Carry; risk: ReturnType<typeof riskSignal>; completions: Completion[]; exit: any | null; canExit: boolean; canReturn: boolean };
export async function diplomaOverview(db: Db, programId: string): Promise<{ ok: true; program: any; units: Unit[]; rows: OverviewRow[]; names: typeof EXIT_NAMES_AR } | { ok: false; error: string; status: number }> {
  const { program, units } = await loadProgram(db, programId); if (!program) return { ok: false, error: 'البرنامج غير موجود', status: 404 };
  const enr = await safe<any[]>(db.from('portal_enrollments').select('id,email,full_name,user_id,status').eq('program_id', programId).in('status', ENROLLED).order('full_name').limit(500), []);
  const emails = enr.map((e) => String(e.email).toLowerCase());
  const [att, comps, exits] = await Promise.all([attendanceDays(db, programId, emails), completionsOf(db, programId), safe<any[]>(db.from('portal_diploma_exits').select('*').eq('program_id', programId).order('exited_at', { ascending: false }).limit(1000), [])]);
  const today = todayKey(); const lastExit = new Map<string, any>(); for (const x of exits) if (!lastExit.has(x.enrollment_id)) lastExit.set(x.enrollment_id, x);
  const rows: OverviewRow[] = enr.map((e) => {
    const email = String(e.email).toLowerCase(); const days = att.get(email) || []; const cs = comps.get(email) || []; const ex = lastExit.get(e.id) || null;
    const carry = carryToday(program.name_ar, units, cs); const graduated = units.length > 0 && carry.unitsDone === carry.unitsTotal && units.some((u) => (u.level_no || 0) > 0);
    const state = stateOf(e.status, ex, graduated, days.some((d) => d.present)); const risk = state === 'exited' || state === 'graduate' ? { level: 'none' as const, line_ar: '—', pct: null, silent: null } : riskSignal(days, today);
    return { enrollment_id: e.id, email, full_name: e.full_name, user_id: e.user_id || null, state, carry, risk, completions: cs, exit: ex, canExit: canExit(state), canReturn: canReturn(state, ex?.return_by || null, today) };
  });
  return { ok: true, program, units, rows, names: EXIT_NAMES_AR };
}

/* ───────── الطالب: «لو خرجت اليوم» ───────── */
export async function learnerCarry(db: Db, email: string, userId: string | null) {
  const low = email.toLowerCase();
  const enr = await safe<any[]>(db.from('portal_enrollments').select('id,program_id,status,programs!inner(id,name_ar,program_type)').ilike('email', low).in('status', ENROLLED).limit(20), []);
  const dips = enr.filter((e) => e.programs?.program_type === 'diploma'); const out: any[] = [];
  for (const e of dips) {
    const { units } = await loadProgram(db, e.program_id); if (!units.length) continue;
    const [comps, ex] = await Promise.all([completionsOf(db, e.program_id, [low]), safe<any>(db.from('portal_diploma_exits').select('*').eq('enrollment_id', e.id).order('exited_at', { ascending: false }).limit(1).maybeSingle(), null)]);
    const carry = carryToday(e.programs.name_ar, units, comps.get(low) || []); const graduated = carry.unitsDone === carry.unitsTotal && units.some((u) => (u.level_no || 0) > 0);
    const state = stateOf(e.status, ex, graduated, true);
    out.push({ enrollment_id: e.id, program_id: e.program_id, program_name: e.programs.name_ar, state, carry, exit: ex ? { exited_at: ex.exited_at, return_by: ex.return_by, returned_at: ex.returned_at, record_code: ex.record_code, credential_ids: ex.credential_ids } : null });
  }
  return { ok: true as const, diplomas: out, names: EXIT_NAMES_AR };
}

/* ───────── الإتمام ───────── */
export async function autoCompletions(db: Db, programId: string, by: string | null): Promise<{ ok: true; added: number; checked: number } | { ok: false; error: string; status: number }> {
  const { program, units } = await loadProgram(db, programId); if (!program) return { ok: false, error: 'البرنامج غير موجود', status: 404 };
  const enr = await safe<any[]>(db.from('portal_enrollments').select('id,email,user_id').eq('program_id', programId).in('status', ENROLLED).limit(500), []);
  const emails = enr.map((e) => String(e.email).toLowerCase()); const [att, comps] = await Promise.all([attendanceDays(db, programId, emails), completionsOf(db, programId)]);
  const linked = units.filter((u) => u.linked_program_id).map((u) => u.linked_program_id as string);
  const creds = linked.length ? await safe<any[]>(db.from('portal_credentials').select('email,program_id').eq('kind', 'program_completion').in('program_id', linked).is('revoked_at', null).limit(5000), []) : [];
  const credSet = new Set(creds.map((c) => `${String(c.email).toLowerCase()}|${c.program_id}`)); const today = todayKey(); const rows: any[] = []; let checked = 0;
  for (const e of enr) {
    const email = String(e.email).toLowerCase(); const have = new Map((comps.get(email) || []).map((c) => [c.unit_id, c]));
    for (const u of units) {
      checked++; const cur = have.get(u.id); if (cur && (cur.source === 'manual' || cur.status === 'done')) continue;
      if (u.linked_program_id && credSet.has(`${email}|${u.linked_program_id}`)) { rows.push({ unit_id: u.id, program_id: programId, enrollment_id: e.id, email, user_id: e.user_id || null, status: 'done', source: 'credential', decided_by: by, decided_at: new Date().toISOString() }); continue; }
      const v = attendanceVerdict(u, att.get(email) || [], today); if (v && v.done) rows.push({ unit_id: u.id, program_id: programId, enrollment_id: e.id, email, user_id: e.user_id || null, status: 'done', source: 'attendance', attendance_pct: v.pct, decided_by: by, decided_at: new Date().toISOString() });
    }
  }
  if (rows.length) { const { error } = await db.from('portal_unit_completions').upsert(rows, { onConflict: 'unit_id,email' }); if (error) return { ok: false, error: error.message, status: 500 }; }
  return { ok: true, added: rows.length, checked };
}
export async function setCompletion(db: Db, b: { program_id: string; unit_id: string; email: string; done: boolean; note?: string }, by: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const low = b.email.toLowerCase(); const enr = await safe<any>(db.from('portal_enrollments').select('id,user_id').eq('program_id', b.program_id).ilike('email', low).maybeSingle(), null); if (!enr) return { ok: false, error: 'لا قيد لهذا البريد في البرنامج', status: 404 };
  const u = await safe<any>(db.from('portal_program_units').select('id').eq('id', b.unit_id).eq('program_id', b.program_id).maybeSingle(), null); if (!u) return { ok: false, error: 'المقرّر ليس من هذا البرنامج', status: 404 };
  const { error } = await db.from('portal_unit_completions').upsert({ unit_id: b.unit_id, program_id: b.program_id, enrollment_id: enr.id, email: low, user_id: enr.user_id || null, status: b.done ? 'done' : 'not_done', source: 'manual', note: (b.note || '').slice(0, 300) || null, decided_by: by, decided_at: new Date().toISOString() }, { onConflict: 'unit_id,email' });
  return error ? { ok: false, error: error.message, status: 500 } : { ok: true };
}

/* ───────── الخروج: شهادات ما أتمّ + سجلّ إنجاز موقَّع ───────── */
export async function exitCredentials(db: Db, b: { enrollment_id: string; reason_code?: string | null; reason?: string | null }, by: { id: string; email: string } | null, site: string, self = false): Promise<{ ok: true; exit: any; issued: number; record_code: string | null } | { ok: false; error: string; status: number }> {
  const e = await safe<any>(db.from('portal_enrollments').select('id,program_id,email,full_name,user_id,status').eq('id', b.enrollment_id).maybeSingle(), null); if (!e) return { ok: false, error: 'القيد غير موجود', status: 404 };
  if (self && by && e.email.toLowerCase() !== by.email.toLowerCase()) return { ok: false, error: 'ليس قيدك', status: 403 };
  const { program, units } = await loadProgram(db, e.program_id); if (!program) return { ok: false, error: 'البرنامج غير موجود', status: 404 };
  const open = await safe<any>(db.from('portal_diploma_exits').select('id').eq('enrollment_id', e.id).eq('state', 'exited').maybeSingle(), null); if (open) return { ok: false, error: 'مسجَّل خارجًا بالفعل', status: 409 };
  const email = String(e.email).toLowerCase(); const comps = (await completionsOf(db, e.program_id, [email])).get(email) || []; const carry = carryToday(program.name_ar, units, comps);
  const now = new Date().toISOString(); const signer = signerFromEnv(process.env, site); if (signer) await ensureKeyRow(db, signer);
  const existing = await safe<any[]>(db.from('portal_credentials').select('id,level,kind,program_id').ilike('email', email).eq('program_id', e.program_id).is('revoked_at', null).limit(100), []);
  const ids: string[] = []; let issued = 0;
  const issue = async (base: Record<string, any>) => {
    const badge = buildBadge({ id: '', ...base } as any, [], site);
    const { data: ins, error } = await db.from('portal_credentials').insert({ ...base, badge }).select('id,user_id').single(); if (error || !ins) return null;
    ids.push(ins.id); issued++;
    if (signer) { try { const cred = { ...base, id: ins.id, user_id: ins.user_id || e.user_id || null }; await signAndStoreCredential(db, cred, signer, (idx) => buildCredentialDoc(cred as any, [], site, didWeb(site), idx), by?.id || null); } catch { /* تبقى قابلة للتوقيع لاحقًا */ } }
    await db.from('portal_learning_events').insert({ user_id: ins.user_id || e.user_id || null, email, verb: 'issued', object_type: 'credential', object_id: ins.id, skills: [], context: { kind: base.kind, title: base.title_ar, level: base.level, program_id: e.program_id, exit: true } }).then(() => null, () => null);
    return ins.id as string;
  };
  // شهادة لكلّ مستوى مكتمل لم تُصدر له شهادة بعد
  for (const c of carry.certificates) {
    if (existing.some((x) => x.kind === 'program_completion' && x.level === `L${c.level_no}`)) continue;
    await issue({ user_id: e.user_id || null, email, full_name: e.full_name, kind: 'program_completion', title_ar: c.title_ar, title_en: null, description_ar: `أتمّ جميع مقرّرات ${c.title_ar.split(' — ')[0]} ضمن «${program.name_ar}» — شهادة مصغّرة صالحة بذاتها وتُحتسب في أيّ دبلوم يحتويها.`, program_id: e.program_id, session_id: null, skills: [], level: `L${c.level_no}`, hours: c.hours || null, verify_code: verifyCode(), issued_at: now, valid_until: null, issued_by: by?.id || null });
  }
  // سجلّ الإنجاز الموقَّع — دائمًا (حتى لو لم يكتمل مقرّر: سجلّ بداية)
  const rec = achievementRecord(program.name_ar, carry, now); const code = verifyCode();
  const recId = await issue({ user_id: e.user_id || null, email, full_name: e.full_name, kind: 'achievement_record', title_ar: rec.title_ar, title_en: null, description_ar: rec.description_ar, program_id: e.program_id, session_id: null, skills: [], level: rec.level, hours: rec.hours || null, verify_code: code, issued_at: now, valid_until: null, issued_by: by?.id || null });
  const row = { enrollment_id: e.id, program_id: e.program_id, email, user_id: e.user_id || null, state: 'exited', exited_at: now, reason: (b.reason || '').slice(0, 300) || null, reason_code: b.reason_code || null, return_by: returnByOf(now), after_level: carry.afterLevel, units_done: carry.unitsDone, levels_done: carry.levelsDone, credential_ids: ids, record_code: recId ? code : null, decided_by: by?.id || null };
  const { data: ex, error } = await db.from('portal_diploma_exits').insert(row).select('*').single(); if (error) return { ok: false, error: error.message, status: 500 };
  await db.from('audit_logs').insert({ actor_id: by?.id || null, actor_email: by?.email || email, actor_role: self ? 'LEARNER' : 'STAFF', action: 'diploma_exit', entity_type: 'portal_enrollments', entity_id: e.id, entity_label: `${e.full_name} — ${program.name_ar}`, metadata: { after_level: carry.afterLevel, units_done: carry.unitsDone, issued, reason_code: b.reason_code || null } }).then(() => null, () => null);
  return { ok: true, exit: ex, issued, record_code: recId ? code : null };
}
export async function returnFromExit(db: Db, enrollmentId: string, by: { id: string; email: string } | null, self = false): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const ex = await safe<any>(db.from('portal_diploma_exits').select('id,email,return_by').eq('enrollment_id', enrollmentId).eq('state', 'exited').maybeSingle(), null); if (!ex) return { ok: false, error: 'لا خروج مفتوح لهذا القيد', status: 404 };
  if (self && by && ex.email.toLowerCase() !== by.email.toLowerCase()) return { ok: false, error: 'ليس قيدك', status: 403 };
  if (!canReturn('exited', ex.return_by, todayKey()) && self) return { ok: false, error: 'انتهت مهلة العودة — تواصل مع الطاقم', status: 409 };
  const { error } = await db.from('portal_diploma_exits').update({ state: 'returned', returned_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', ex.id); if (error) return { ok: false, error: error.message, status: 500 };
  await db.from('audit_logs').insert({ actor_id: by?.id || null, actor_email: by?.email || ex.email, actor_role: self ? 'LEARNER' : 'STAFF', action: 'diploma_return', entity_type: 'portal_enrollments', entity_id: enrollmentId, entity_label: ex.email, metadata: {} }).then(() => null, () => null);
  return { ok: true };
}
/** ربط مقرّر ⇄ برنامج (الطاقم) */
export async function linkUnitProgram(db: Db, b: { program_id: string; unit_id: string; linked_program_id: string | null }): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (b.linked_program_id) { if (b.linked_program_id === b.program_id) return { ok: false, error: 'لا يُربط الدبلوم بنفسه', status: 400 }; const p = await safe<any>(db.from('programs').select('id').eq('id', b.linked_program_id).maybeSingle(), null); if (!p) return { ok: false, error: 'البرنامج المرتبط غير موجود', status: 404 }; }
  const { error } = await db.from('portal_program_units').update({ linked_program_id: b.linked_program_id, updated_at: new Date().toISOString() }).eq('id', b.unit_id).eq('program_id', b.program_id);
  return error ? { ok: false, error: error.message, status: 500 } : { ok: true };
}
