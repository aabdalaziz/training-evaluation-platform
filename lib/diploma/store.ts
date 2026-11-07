// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66-ب «مقرّرات الدبلوم — لكل مقرّر أستاذه» — طبقة القاعدة
 *  structureView        هيكل الدبلوم كاملًا (المستويات · المقرّرات · الشُّعب · أساتذة المواد · الجدول · الفترات الخاصّة · التعارضات · شبكة الأسبوع · طلبات النقل)
 *  saveCourse           المستوى/أستاذ المادة/رمز المقرّر على وحدة الدبلوم (portal_program_units)
 *  saveSlot/deleteSlot  سطر الجدول (المقرّر × الشعبة × الأستاذ × اليوم × المحاضرة) ← يولّد محاضراته في portal_sessions (series_id = السطر؛ القادمة فقط)
 *  savePeriod           «فترة خاصّة» (رمضان…) ← تعيد توليد محاضرات الدبلوم القادمة
 *  suggest/adopt        «الميسِّر يقترح الجدول» (خوارزمية قيود) ← المدير يعتمد ما يشاء
 *  substitutes/applySubstitute «البديل بلمسة» ليوم بعينه ← إشعار الشعبة بالتسلسل الرسمي
 *  corridor             «الممرّ»: بطاقة الشعبة القادمة لأستاذ المادة (خيط «قبل أن تغادر» k ≥ 5 · التزامات مفتوحة)
 *  myLecturesToday      «ماذا عندي اليوم؟» للمتدرّب وللأستاذ (نداء + شاشة)
 *  requestMove/decideMove  طلب نقل الشعبة — القرار بشري
 *  lectureDaysOf        أيام المحاضرات لشعبة (لتقويم الشعبة المشتقّ في P66 حين لا يوجد تقويم يدوي)
 *  runLevelClose        (ضمن الكرون اليومي) «محطّة المستوى» في أول يوم من الأسبوع الأخير للمستوى
 */
import { D_NAMES_AR, D_LIMITS, DIPLOMA_PATH, WEEKDAYS_AR, shiftGraceDay, validateSlot, validatePeriod, lecturesOf, lectureOn, conflictsOf, weekGrid, suggestGrid, substitutesFor, courseThread, corridorCard, levelSpans, currentLevel, isLevelLastWeek, levelCloseNotice, moveRequestNotice, moveDecidedNotice, structureLine, sectionLabel, todayAnswerAr, effectiveTrainer, timeAr, LEAVE_QUESTION_AR } from './registry';
import type { Course, Slot, Period, Section, Instructor, Conflict, Grid, LevelSpan, Corridor, Proposed } from './registry';
import { dayKey, addDays, fmtDayAr, isDayKey } from '../calendar/registry';
/** الآن بصيغة الرياض «YYYY-MM-DDTHH:MM:SS+03:00» — نفس صيغة تخزين المحاضرات، فتصحّ مقارنة النصوص كما يصحّ timestamptz */
export function riyadhIso(now: Date): string { const r = new Date(now.getTime() + 3 * 3600 * 1000); return r.toISOString().slice(0, 19) + '+03:00'; }

type Db = any;
export type Me = { id: string; email: string; name?: string; staff?: boolean; trainerIds?: string[] };
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
type Fail = { ok: false; error: string; status: number }; const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });
const ENROLLED = ['approved', 'placed', 'active', 'completed'];
const SLOT_COLS = 'id,program_id,unit_id,classroom_id,trainer_id,weekday,period_no,starts_at,minutes,from_day,to_day,room_ar,provider,generated_at';
const PERIOD_COLS = 'id,program_id,name_ar,from_day,to_day,lecture_minutes,lecture_break_min,first_lecture_at,shift_minutes';
const COURSE_COLS = 'id,program_id,idx,title_ar,code,level_no,trainer_id,hours,starts_on,ends_on';
const hhmm = (t: unknown) => String(t || '').slice(0, 5);
const toSlot = (r: any): Slot => ({ id: String(r.id), program_id: String(r.program_id), unit_id: String(r.unit_id), classroom_id: String(r.classroom_id), trainer_id: r.trainer_id ? String(r.trainer_id) : null, weekday: Number(r.weekday), period_no: Number(r.period_no || 1), starts_at: hhmm(r.starts_at), minutes: Number(r.minutes), from_day: String(r.from_day), to_day: String(r.to_day), room_ar: r.room_ar || null, provider: String(r.provider || 'athar'), generated_at: r.generated_at || null });
const toPeriod = (r: any): Period => ({ id: String(r.id), program_id: String(r.program_id), name_ar: String(r.name_ar || ''), from_day: String(r.from_day), to_day: String(r.to_day), lecture_minutes: r.lecture_minutes ?? null, lecture_break_min: r.lecture_break_min ?? null, first_lecture_at: r.first_lecture_at ? hhmm(r.first_lecture_at) : null, shift_minutes: Number(r.shift_minutes || 0) });
const toCourse = (r: any): Course => ({ id: String(r.id), idx: Number(r.idx || 0), title_ar: String(r.title_ar || ''), code: r.code || null, level_no: r.level_no ?? null, trainer_id: r.trainer_id ? String(r.trainer_id) : null, hours: Number(r.hours || 0), starts_on: r.starts_on || null, ends_on: r.ends_on || null });

/* ───────── قراءة ───────── */
async function loadAll(db: Db, programId: string) {
  const [program, cRows, sRows, slRows, pRows] = await Promise.all([
    safe<any>(db.from('programs').select('id,name_ar,program_type,start_date,end_date,levels_count,lecture_minutes,lecture_break_min,first_lecture_at,organization_id').eq('id', programId).maybeSingle(), null),
    safe<any[]>(db.from('portal_program_units').select(COURSE_COLS).eq('program_id', programId).order('level_no', { ascending: true, nullsFirst: false }).order('idx').limit(60), []),
    safe<any[]>(db.from('classrooms').select('id,code,section_name,trainer_id').eq('program_id', programId).order('code').limit(60), []),
    safe<any[]>(db.from('portal_unit_schedules').select(SLOT_COLS).eq('program_id', programId).order('weekday').order('period_no').limit(500), []),
    safe<any[]>(db.from('portal_schedule_periods').select(PERIOD_COLS).eq('program_id', programId).order('from_day').limit(50), []),
  ]);
  const courses = arr<any>(cRows).map(toCourse); const sections: Section[] = arr<any>(sRows).map((s) => ({ id: String(s.id), code: String(s.code || ''), section_name: s.section_name || null, trainer_id: s.trainer_id ? String(s.trainer_id) : null }));
  const slots = arr<any>(slRows).map(toSlot); const periods = arr<any>(pRows).map(toPeriod);
  const tids = [...new Set([...courses.map((c) => c.trainer_id), ...slots.map((s) => s.trainer_id), ...sections.map((s) => s.trainer_id)].filter(Boolean) as string[])];
  const org = program?.organization_id ? String(program.organization_id) : null;
  const tRows = org ? await safe<any[]>(db.from('trainers').select('id,name,email').eq('organization_id', org).order('name').limit(300), []) : (tids.length ? await safe<any[]>(db.from('trainers').select('id,name,email').in('id', tids).limit(300), []) : []);
  const instructors: Array<Instructor & { email: string | null }> = arr<any>(tRows).map((t) => ({ id: String(t.id), name: String(t.name || ''), email: t.email ? lower(t.email) : null }));
  return { program, courses, sections, slots, periods, instructors };
}
type Loaded = Awaited<ReturnType<typeof loadAll>>;
const namesOf = (L: Loaded) => ({
  course: (id: string) => L.courses.find((c) => c.id === id)?.title_ar || 'مقرّر', section: (id: string) => sectionLabel(L.sections.find((s) => s.id === id)) || 'شعبة',
  instructor: (id: string | null) => (id ? L.instructors.find((t) => t.id === id)?.name || 'أستاذ المادة' : 'أستاذ المادة'),
});
export const lineOf = (L: Loaded, slot: Pick<Slot, 'unit_id' | 'classroom_id' | 'trainer_id'>): string => { const n = namesOf(L); const c = L.courses.find((x) => x.id === slot.unit_id); return structureLine({ diploma: L.program?.name_ar || null, level: c?.level_no || null, course: n.course(slot.unit_id), section: n.section(slot.classroom_id), instructor: n.instructor(effectiveTrainer(slot as Slot, L.courses)) }); };

async function canEditProgram(db: Db, me: Me, L: Loaded): Promise<boolean> { if (me.staff) return true; const tids = me.trainerIds || []; return L.sections.some((s) => s.trainer_id && tids.includes(s.trainer_id)); /* منسّق الشعبة */ }
const canReadProgram = (me: Me, L: Loaded): boolean => { if (me.staff) return true; const tids = me.trainerIds || []; return L.sections.some((s) => s.trainer_id && tids.includes(s.trainer_id)) || L.courses.some((c) => c.trainer_id && tids.includes(c.trainer_id)) || L.slots.some((s) => s.trainer_id && tids.includes(s.trainer_id)); };

export type StructureView = { program: { id: string; name_ar: string; levels_count: number; is_diploma: boolean }; courses: Course[]; sections: Section[]; instructors: Instructor[]; slots: Array<Slot & { line_ar: string; weekday_ar: string; instructor_id: string | null; lectures_left: number }>; periods: Period[]; conflicts: Conflict[]; grid: Grid; levels: LevelSpan[]; current_level: LevelSpan | null; requests: any[]; can_edit: boolean; names: typeof D_NAMES_AR; limits: typeof D_LIMITS; weekdays_ar: readonly string[]; today: string; leave_question_ar: string };
export async function structureView(db: Db, me: Me, programId: string, now = new Date()): Promise<StructureView | Fail> {
  const L = await loadAll(db, programId); if (!L.program) return fail('البرنامج غير موجود', 404); if (!canReadProgram(me, L)) return fail('هيكل الدبلوم لطاقم البرنامج وأساتذته', 403);
  const today = dayKey(now); const n = namesOf(L); const can_edit = await canEditProgram(db, me, L);
  const requests = can_edit ? await safe<any[]>(db.from('portal_section_requests').select('id,created_at,email,enrollment_id,from_classroom,to_classroom,reason_ar,status').eq('program_id', programId).eq('status', 'open').order('created_at').limit(50), []) : [];
  const levels = levelSpans(L.courses, L.slots);
  return {
    program: { id: String(L.program.id), name_ar: String(L.program.name_ar || ''), levels_count: Number(L.program.levels_count || 0), is_diploma: String(L.program.program_type || '') === 'diploma' },
    courses: L.courses, sections: L.sections, instructors: L.instructors.map(({ id, name }) => ({ id, name })),
    slots: L.slots.map((s) => ({ ...s, line_ar: lineOf(L, s), weekday_ar: WEEKDAYS_AR[s.weekday], instructor_id: effectiveTrainer(s, L.courses), lectures_left: lecturesOf(s, L.periods, today).length })),
    periods: L.periods, conflicts: conflictsOf(L.slots, L.courses, n), grid: weekGrid(L.slots), levels, current_level: currentLevel(levels, today),
    requests: requests.map((r) => ({ ...r, from_ar: n.section(String(r.from_classroom || '')), to_ar: r.to_classroom ? n.section(String(r.to_classroom)) : 'أي شعبة أخرى' })),
    can_edit, names: D_NAMES_AR, limits: D_LIMITS, weekdays_ar: WEEKDAYS_AR, today, leave_question_ar: LEAVE_QUESTION_AR,
  };
}

/** البرامج التي أراها في «هيكل الدبلوم»: الطاقم → الدبلومات وكل برنامج له مقرّرات؛ الأستاذ/المنسّق → برامج شُعبه ومقرّراته ومحاضراته */
export async function myPrograms(db: Db, me: Me): Promise<Array<{ id: string; name_ar: string; is_diploma: boolean; courses: number; sections: number; role_ar: string }>> {
  const tids = me.trainerIds || []; let ids: string[] = []; let role_ar = 'طاقم';
  if (me.staff) { const ps = await safe<any[]>(db.from('programs').select('id').eq('program_type', 'diploma').order('start_date', { ascending: false }).limit(40), []); const us = await safe<any[]>(db.from('portal_program_units').select('program_id').limit(2000), []); ids = [...new Set([...ps.map((p) => String(p.id)), ...us.map((u) => String(u.program_id))])]; }
  else if (tids.length) { role_ar = 'أستاذ مادة'; const [cs, us, ss] = await Promise.all([safe<any[]>(db.from('classrooms').select('program_id').in('trainer_id', tids).limit(100), []), safe<any[]>(db.from('portal_program_units').select('program_id').in('trainer_id', tids).limit(200), []), safe<any[]>(db.from('portal_unit_schedules').select('program_id').in('trainer_id', tids).limit(500), [])]); if (cs.length) role_ar = 'منسّق شعبة'; ids = [...new Set([...cs, ...us, ...ss].map((r) => String(r.program_id || '')).filter(Boolean))]; }
  if (!ids.length) return []; ids = ids.slice(0, 40);
  const [ps, us, cs] = await Promise.all([safe<any[]>(db.from('programs').select('id,name_ar,program_type,start_date').in('id', ids).order('start_date', { ascending: false }).limit(40), []), safe<any[]>(db.from('portal_program_units').select('program_id').in('program_id', ids).limit(2000), []), safe<any[]>(db.from('classrooms').select('program_id').in('program_id', ids).limit(2000), [])]);
  return ps.map((p) => ({ id: String(p.id), name_ar: String(p.name_ar || ''), is_diploma: String(p.program_type || '') === 'diploma', courses: us.filter((u) => String(u.program_id) === String(p.id)).length, sections: cs.filter((c) => String(c.program_id) === String(p.id)).length, role_ar }));
}

/* ───────── المقرّر ───────── */
export async function saveCourse(db: Db, me: Me, b: { program_id?: unknown; unit_id?: unknown; level_no?: unknown; trainer_id?: unknown; code?: unknown; levels_count?: unknown }): Promise<{ ok: true } | Fail> {
  const pid = String(b.program_id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('للطاقم ومنسّق الشعبة', 403);
  if (b.levels_count !== undefined) { const lc = Number(b.levels_count); if (!Number.isInteger(lc) || lc < 0 || lc > D_LIMITS.maxLevels) return fail(`عدد المستويات بين 0 و${D_LIMITS.maxLevels}`); const { error } = await db.from('programs').update({ levels_count: lc }).eq('id', pid); if (error) return fail(error.message, 500); if (b.unit_id === undefined) return { ok: true }; }
  const uid = String(b.unit_id || ''); if (!L.courses.some((c) => c.id === uid)) return fail('المقرّر ليس من هذا البرنامج', 404);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.level_no !== undefined) { const lv = b.level_no === null || b.level_no === '' ? null : Number(b.level_no); if (lv !== null && (!Number.isInteger(lv) || lv < 1 || lv > D_LIMITS.maxLevels)) return fail(`المستوى بين 1 و${D_LIMITS.maxLevels}`); patch.level_no = lv; }
  if (b.trainer_id !== undefined) { const t = b.trainer_id ? String(b.trainer_id) : null; if (t && !L.instructors.some((x) => x.id === t)) return fail('أستاذ المادة غير معروف'); patch.trainer_id = t; }
  if (b.code !== undefined) patch.code = b.code ? String(b.code).trim().slice(0, 20) : null;
  const { error } = await db.from('portal_program_units').update(patch).eq('id', uid); if (error) return fail(error.message, 500); return { ok: true };
}

/* ───────── الجدول والمحاضرات ───────── */
async function generateLectures(db: Db, L: Loaded, slot: Slot, me: Me, now: Date): Promise<number> {
  const today = dayKey(now); const nowIso = now.toISOString(); const nowR = riyadhIso(now);
  await db.from('portal_sessions').delete().eq('series_id', slot.id).eq('status', 'scheduled').gte('starts_at', nowR); /* القادمة فقط (لم تبدأ بعد) — الجارية والماضية تبقى كما جرت */
  const course = L.courses.find((c) => c.id === slot.unit_id); const trainer = effectiveTrainer(slot, L.courses);
  const rows = lecturesOf(slot, L.periods, today).filter((l) => l.day > today || Date.parse(l.starts_at_iso) > now.getTime()).map((l) => ({ program_id: slot.program_id, classroom_id: slot.classroom_id, trainer_id: trainer, series_id: slot.id, unit_id: slot.unit_id, kind: 'class', title_ar: course?.title_ar || 'محاضرة', description_ar: lineOf(L, slot) + (slot.room_ar ? ` — ${slot.room_ar}` : ''), starts_at: l.starts_at_iso, duration_min: l.minutes, provider: slot.provider, access: 'program', status: 'scheduled', lang: 'ar', created_by: me.id, organization_id: L.program?.organization_id || null }));
  if (rows.length) { const { error } = await db.from('portal_sessions').insert(rows); if (error) return 0; }
  await db.from('portal_unit_schedules').update({ generated_at: nowIso, updated_at: nowIso }).eq('id', slot.id); return rows.length;
}
export async function saveSlot(db: Db, me: Me, b: Record<string, unknown>, now = new Date()): Promise<{ ok: true; slot: Slot; lectures: number; conflicts: Conflict[] } | Fail> {
  const pid = String(b.program_id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('الجدول للطاقم ومنسّق الشعبة', 403);
  const v = validateSlot(b as any); if (!v.ok) return fail(v.error); const s = v.slot;
  if (!L.courses.some((c) => c.id === s.unit_id)) return fail('المقرّر ليس من هذا البرنامج'); if (!L.sections.some((x) => x.id === s.classroom_id)) return fail('الشعبة ليست من هذا البرنامج'); if (s.trainer_id && !L.instructors.some((t) => t.id === s.trainer_id)) return fail('أستاذ المادة غير معروف');
  const id = b.id ? String(b.id) : null; const row = { ...s, program_id: pid, updated_by: me.id, updated_at: now.toISOString() };
  const r = id ? await db.from('portal_unit_schedules').update(row).eq('id', id).eq('program_id', pid).select(SLOT_COLS).maybeSingle() : await db.from('portal_unit_schedules').insert(row).select(SLOT_COLS).maybeSingle();
  if (r.error || !r.data) return fail(r.error?.message || 'تعذّر الحفظ', 500); const slot = toSlot(r.data);
  const L2 = { ...L, slots: [...L.slots.filter((x) => x.id !== slot.id), slot] }; const lectures = await generateLectures(db, L2, slot, me, now);
  return { ok: true, slot, lectures, conflicts: conflictsOf(L2.slots, L2.courses, namesOf(L2)).filter((c) => c.a === slot.id || c.b === slot.id) };
}
export async function deleteSlot(db: Db, me: Me, b: { program_id?: unknown; id?: unknown }, now = new Date()): Promise<{ ok: true } | Fail> {
  const pid = String(b.program_id || ''); const id = String(b.id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('الجدول للطاقم ومنسّق الشعبة', 403);
  if (!L.slots.some((s) => s.id === id)) return fail('السطر غير موجود', 404);
  await db.from('portal_sessions').delete().eq('series_id', id).eq('status', 'scheduled').gte('starts_at', riyadhIso(now));
  const { error } = await db.from('portal_unit_schedules').delete().eq('id', id); if (error) return fail(error.message, 500); return { ok: true };
}
async function regenerateProgram(db: Db, L: Loaded, me: Me, now: Date): Promise<number> { let n = 0; for (const s of L.slots) n += await generateLectures(db, L, s, me, now); return n; }
export async function regenerate(db: Db, me: Me, b: { program_id?: unknown }, now = new Date()): Promise<{ ok: true; lectures: number } | Fail> {
  const pid = String(b.program_id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('للطاقم ومنسّق الشعبة', 403);
  return { ok: true, lectures: await regenerateProgram(db, L, me, now) };
}
export async function savePeriod(db: Db, me: Me, b: Record<string, unknown>, now = new Date()): Promise<{ ok: true; period: Period; lectures: number } | Fail> {
  const pid = String(b.program_id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('للطاقم ومنسّق الشعبة', 403);
  const v = validatePeriod(b); if (!v.ok) return fail(v.error); const id = b.id ? String(b.id) : null; const row = { ...v.period, program_id: pid, updated_by: me.id };
  const r = id ? await db.from('portal_schedule_periods').update(row).eq('id', id).eq('program_id', pid).select(PERIOD_COLS).maybeSingle() : await db.from('portal_schedule_periods').insert(row).select(PERIOD_COLS).maybeSingle();
  if (r.error || !r.data) return fail(r.error?.message || 'تعذّر الحفظ', 500); const period = toPeriod(r.data);
  const L2 = { ...L, periods: [...L.periods.filter((p) => p.id !== period.id), period] }; return { ok: true, period, lectures: await regenerateProgram(db, L2, me, now) };
}
export async function deletePeriod(db: Db, me: Me, b: { program_id?: unknown; id?: unknown }, now = new Date()): Promise<{ ok: true; lectures: number } | Fail> {
  const pid = String(b.program_id || ''); const id = String(b.id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('للطاقم ومنسّق الشعبة', 403);
  const { error } = await db.from('portal_schedule_periods').delete().eq('id', id).eq('program_id', pid); if (error) return fail(error.message, 500);
  const L2 = { ...L, periods: L.periods.filter((p) => p.id !== id) }; return { ok: true, lectures: await regenerateProgram(db, L2, me, now) };
}

/* ───────── «الميسِّر يقترح» ───────── */
export async function suggest(db: Db, me: Me, b: Record<string, unknown>): Promise<{ ok: true; proposed: Array<Proposed & { line_ar: string; weekday_ar: string }>; unplaced: any[]; note_ar: string } | Fail> {
  const pid = String(b.program_id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('للطاقم ومنسّق الشعبة', 403);
  const level_no = Number(b.level_no); if (!Number.isInteger(level_no) || level_no < 1) return fail('حدّد المستوى'); if (!L.courses.some((c) => c.level_no === level_no)) return fail('لا مقرّرات في هذا المستوى بعد');
  const weekdays = arr<number>(b.weekdays).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6); if (!weekdays.length) return fail('حدّد أيام الأسبوع');
  const times = arr<any>(b.times).map((t) => ({ period_no: Number(t.period_no), starts_at: String(t.starts_at || ''), minutes: Number(t.minutes) })); if (!times.length) return fail('اكتب أوقات المحاضرات ومددها (بالعرف الأكاديمي عندكم)');
  for (const t of times) { const v = validateSlot({ unit_id: 'x', classroom_id: 'x', weekday: 0, period_no: t.period_no, starts_at: t.starts_at, minutes: t.minutes, from_day: '2026-01-01', to_day: '2026-01-01' }); if (!v.ok) return fail(v.error); }
  const from_day = String(b.from_day || ''); const to_day = String(b.to_day || ''); const vs = validateSlot({ unit_id: 'x', classroom_id: 'x', weekday: 0, period_no: 1, starts_at: '08:00', minutes: 60, from_day, to_day }); if (!vs.ok) return fail(vs.error);
  const sections = arr<string>(b.sections).length ? L.sections.filter((s) => arr<string>(b.sections).includes(s.id)) : L.sections; if (!sections.length) return fail('لا شُعب لهذا البرنامج بعد');
  const r = suggestGrid({ courses: L.courses, sections, weekdays, times, from_day, to_day, existing: L.slots, level_no, per_week: Number(b.per_week || 1) });
  return { ok: true, proposed: r.proposed.map((p) => ({ ...p, line_ar: lineOf(L, p), weekday_ar: WEEKDAYS_AR[p.weekday] })), unplaced: r.unplaced.map((u) => ({ ...u, line_ar: lineOf(L, { ...u, trainer_id: null }) })), note_ar: r.note_ar };
}
export async function adopt(db: Db, me: Me, b: Record<string, unknown>, now = new Date()): Promise<{ ok: true; saved: number; lectures: number } | Fail> {
  const items = arr<any>(b.proposed).slice(0, 200); if (!items.length) return fail('لا شيء لاعتماده'); let saved = 0; let lectures = 0;
  for (const it of items) { const r = await saveSlot(db, me, { ...it, program_id: b.program_id }, now); if (!r.ok) return r; saved += 1; lectures += r.lectures; }
  return { ok: true, saved, lectures };
}

/* ───────── «البديل بلمسة» ───────── */
export async function substitutes(db: Db, me: Me, b: { program_id?: unknown; slot_id?: unknown; day?: unknown }): Promise<{ ok: true; candidates: Array<{ id: string; name: string; why_ar: string }>; line_ar: string } | Fail> {
  const pid = String(b.program_id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('للطاقم ومنسّق الشعبة', 403);
  const slot = L.slots.find((s) => s.id === String(b.slot_id || '')); if (!slot) return fail('السطر غير موجود', 404); const day = String(b.day || '');
  return { ok: true, candidates: substitutesFor(slot, day, L.slots, L.courses, L.instructors), line_ar: lineOf(L, slot) };
}
export async function applySubstitute(db: Db, me: Me, b: { program_id?: unknown; slot_id?: unknown; day?: unknown; trainer_id?: unknown }, now = new Date(), opts: { dry?: boolean } = {}): Promise<{ ok: true; notified: number; line_ar: string } | Fail> {
  const pid = String(b.program_id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('للطاقم ومنسّق الشعبة', 403);
  const slot = L.slots.find((s) => s.id === String(b.slot_id || '')); if (!slot) return fail('السطر غير موجود', 404); const day = String(b.day || ''); const tid = String(b.trainer_id || ''); if (!L.instructors.some((t) => t.id === tid)) return fail('البديل غير معروف');
  if (!isDayKey(day)) return fail('حدّد يوم المحاضرة'); const lec = lectureOn(slot, day, L.periods); const line_ar = lineOf(L, { ...slot, trainer_id: tid });
  const ses = await safe<any[]>(db.from('portal_sessions').select('id,status').eq('series_id', slot.id).gte('starts_at', `${day}T00:00:00+03:00`).lt('starts_at', `${addDays(day, 1)}T00:00:00+03:00`).neq('status', 'cancelled').limit(3), []); if (!ses.length) return fail('لا محاضرة لهذا السطر في هذا اليوم', 404);
  const { error } = await db.from('portal_sessions').update({ trainer_id: tid, description_ar: line_ar + (slot.room_ar ? ` — ${slot.room_ar}` : '') + ` (بديل ${fmtDayAr(day)})`, notes: `بديل ليوم ${day} — اعتمده ${me.email}` }).in('id', ses.map((x) => String(x.id))); if (error) return fail(error.message, 500);
  const sid = String(ses[0].id); const { pushNotice } = await import('../portal/notices');
  const en = await safe<any[]>(db.from('portal_enrollments').select('id,email,user_id').eq('classroom_id', slot.classroom_id).in('status', ENROLLED).limit(500), []); let notified = 0;
  for (const e of en) { const r = await pushNotice(db, { email: e.email, user_id: e.user_id || null, report_id: null, kind: 'substitute' as any, title_ar: `محاضرة ${fmtDayAr(day)} ${timeAr(lec.starts)} — أستاذ بديل`, body_ar: line_ar, url: '/me/line', ref_id: slot.id, dedupe_key: `substitute:${sid}:${e.id}` }, { dry: !!opts.dry, now }); if (r.inserted) notified += 1; }
  return { ok: true, notified, line_ar };
}

/* ───────── «الممرّ» ───────── */
export async function corridor(db: Db, me: Me, sessionId: string, now = new Date()): Promise<{ ok: true; corridor: Corridor; thread_shown: boolean } | Fail> {
  const s = await safe<any>(db.from('portal_sessions').select('id,program_id,classroom_id,trainer_id,series_id,unit_id,starts_at,title_ar').eq('id', sessionId).maybeSingle(), null); if (!s || !s.unit_id) return fail('ليست محاضرة مقرّر', 404);
  const tids = me.trainerIds || []; if (!me.staff && !(s.trainer_id && tids.includes(String(s.trainer_id)))) return fail('«الممرّ» لأستاذ المحاضرة', 403);
  const L = await loadAll(db, String(s.program_id)); const slot = L.slots.find((x) => x.id === String(s.series_id)); const n = namesOf(L); const c = L.courses.find((x) => x.id === String(s.unit_id));
  const since = addDays(dayKey(now), -21);
  const [lines, commits, roster] = await Promise.all([
    safe<any[]>(db.from('portal_learning_lines').select('user_id,body_ar,blocker_ar,day').eq('classroom_id', String(s.classroom_id)).eq('unit_id', String(s.unit_id)).eq('kind', 'learn').gte('day', since).limit(2000), []),
    safe<any[]>(db.from('portal_learning_lines').select('id').eq('classroom_id', String(s.classroom_id)).eq('kind', 'commit').is('done', null).limit(500), []),
    safe<any[]>(db.from('portal_enrollments').select('id').eq('classroom_id', String(s.classroom_id)).in('status', ENROLLED).limit(500), []),
  ]);
  const thread = courseThread(lines.map((l) => ({ user_id: String(l.user_id), body_ar: String(l.body_ar || ''), blocker_ar: l.blocker_ar || null, day: String(l.day) })), `${s.classroom_id}:${s.unit_id}`, roster.length);
  const starts = String(s.starts_at || '').includes('T') ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(s.starts_at)) : (slot?.starts_at || '');
  const card = corridorCard({ diploma: L.program?.name_ar || '', level: c?.level_no || null, course: c?.title_ar || String(s.title_ar || ''), section: n.section(String(s.classroom_id)), instructor: n.instructor(s.trainer_id ? String(s.trainer_id) : null), starts, room_ar: slot?.room_ar || null, thread, commits_open: commits.length });
  return { ok: true, corridor: card, thread_shown: thread.shown };
}

/* ───────── «ماذا عندي اليوم؟» ───────── */
export type TodayItem = { session_id: string; classroom_id: string; unit_id: string | null; course: string; section: string; starts: string; ends: string; minutes: number; instructor: string | null; line_ar: string; state: 'upcoming' | 'live' | 'ended' };
export async function myLecturesToday(db: Db, me: Me, now = new Date()): Promise<{ items: TodayItem[]; answer_ar: string; today: string }> {
  const today = dayKey(now); const from = `${today}T00:00:00+03:00`; const to = `${addDays(today, 1)}T00:00:00+03:00`; const tids = me.trainerIds || [];
  const en = await safe<any[]>(db.from('portal_enrollments').select('classroom_id').eq('email', lower(me.email)).in('status', ENROLLED).not('classroom_id', 'is', null).limit(50), []); const cids = [...new Set(en.map((e) => String(e.classroom_id)))];
  const q1 = cids.length ? safe<any[]>(db.from('portal_sessions').select('id,program_id,classroom_id,trainer_id,unit_id,title_ar,starts_at,duration_min,status').in('classroom_id', cids).not('unit_id', 'is', null).gte('starts_at', from).lt('starts_at', to).neq('status', 'cancelled').order('starts_at').limit(30), []) : Promise.resolve([] as any[]);
  const q2 = tids.length ? safe<any[]>(db.from('portal_sessions').select('id,program_id,classroom_id,trainer_id,unit_id,title_ar,starts_at,duration_min,status').in('trainer_id', tids).not('unit_id', 'is', null).gte('starts_at', from).lt('starts_at', to).neq('status', 'cancelled').order('starts_at').limit(30), []) : Promise.resolve([] as any[]);
  const rows = [...(await q1), ...(await q2)]; const seen = new Set<string>(); const uniq = rows.filter((r) => !seen.has(String(r.id)) && seen.add(String(r.id)));
  const pids = [...new Set(uniq.map((r) => String(r.program_id)))]; const Ls = new Map<string, Loaded>(); for (const pid of pids) Ls.set(pid, await loadAll(db, pid));
  const fmt = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const items: TodayItem[] = uniq.map((r) => { const L = Ls.get(String(r.program_id))!; const n = namesOf(L); const c = L.courses.find((x) => x.id === String(r.unit_id)); const st = new Date(r.starts_at).getTime(); const end = st + Number(r.duration_min || 0) * 60000; const t = now.getTime();
    return { session_id: String(r.id), classroom_id: String(r.classroom_id), unit_id: r.unit_id ? String(r.unit_id) : null, course: c?.title_ar || String(r.title_ar || ''), section: n.section(String(r.classroom_id)), starts: fmt(r.starts_at), ends: fmt(new Date(end).toISOString()), minutes: Number(r.duration_min || 0), instructor: r.trainer_id ? n.instructor(String(r.trainer_id)) : null, line_ar: structureLine({ diploma: L.program?.name_ar, level: c?.level_no || null, course: c?.title_ar || null, section: n.section(String(r.classroom_id)), instructor: r.trainer_id ? n.instructor(String(r.trainer_id)) : null }), state: (t < st ? 'upcoming' : t < end ? 'live' : 'ended') as TodayItem['state'] }; }).sort((a, b) => a.starts.localeCompare(b.starts));
  return { items, answer_ar: todayAnswerAr(items), today };
}
/** أيام محاضرات الشعبة (لتقويم الشعبة المشتقّ) */
export async function lectureDaysOf(db: Db, classroomIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(); const ids = classroomIds.filter(Boolean); if (!ids.length) return out;
  const rows = await safe<any[]>(db.from('portal_sessions').select('classroom_id,starts_at').in('classroom_id', ids).not('unit_id', 'is', null).neq('status', 'cancelled').order('starts_at').limit(5000), []);
  const sets = new Map<string, Set<string>>(); for (const r of rows) { const cid = String(r.classroom_id); if (!sets.has(cid)) sets.set(cid, new Set()); sets.get(cid)!.add(dayKey(new Date(r.starts_at))); }
  for (const [cid, st] of sets) out.set(cid, [...st].sort()); return out;
}

/* ───────── بطاقات المحاضرات للمتدرّب («سطري») — ★ «قبل أن تغادر» + «خيط المقرّر» ───────── */
export type LectureCard = { session_id: string; unit_id: string; course: string; instructor: string | null; starts: string; ends: string; state: 'upcoming' | 'live' | 'ended'; line_ar: string; written: boolean; question_ar: string; thread: { intro_ar: string; head_ar: string; applied: string[]; shown: boolean } };
export async function lectureCardsFor(db: Db, me: Me, classroomIds: string[], now = new Date()): Promise<Map<string, { lectures: LectureCard[]; move_open: boolean }>> {
  const out = new Map<string, { lectures: LectureCard[]; move_open: boolean }>(); const cids = [...new Set(classroomIds.filter(Boolean))]; if (!cids.length) return out;
  const today = dayKey(now); const from = `${today}T00:00:00+03:00`; const to = `${addDays(today, 1)}T00:00:00+03:00`;
  const [rows, mine, reqs] = await Promise.all([
    safe<any[]>(db.from('portal_sessions').select('id,program_id,classroom_id,trainer_id,unit_id,title_ar,starts_at,duration_min,status').in('classroom_id', cids).not('unit_id', 'is', null).gte('starts_at', from).lt('starts_at', to).neq('status', 'cancelled').order('starts_at').limit(60), []),
    safe<any[]>(db.from('portal_learning_lines').select('classroom_id,unit_id').eq('user_id', me.id).eq('kind', 'learn').eq('day', today).not('unit_id', 'is', null).limit(60), []),
    safe<any[]>(db.from('portal_section_requests').select('from_classroom').eq('email', lower(me.email)).eq('status', 'open').limit(20), []),
  ]);
  for (const cid of cids) out.set(cid, { lectures: [], move_open: reqs.some((r) => String(r.from_classroom) === cid) });
  if (!rows.length) return out;
  const pids = [...new Set(rows.map((r) => String(r.program_id)))]; const Ls = new Map<string, Loaded>(); for (const pid of pids) Ls.set(pid, await loadAll(db, pid));
  const since = addDays(today, -30); const units = [...new Set(rows.map((r) => String(r.unit_id)))];
  const prev = await safe<any[]>(db.from('portal_learning_lines').select('user_id,classroom_id,unit_id,body_ar,blocker_ar,day').in('classroom_id', cids).in('unit_id', units).eq('kind', 'learn').gte('day', since).lt('day', today).limit(3000), []);
  const fmt = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  for (const r of rows) { const cid = String(r.classroom_id); const uid = String(r.unit_id); const L = Ls.get(String(r.program_id))!; const n = namesOf(L); const c = L.courses.find((x) => x.id === uid);
    const st = new Date(r.starts_at).getTime(); const end = st + Number(r.duration_min || 0) * 60000; const t = now.getTime();
    const th = courseThread(prev.filter((l) => String(l.classroom_id) === cid && String(l.unit_id) === uid).map((l) => ({ user_id: String(l.user_id), body_ar: String(l.body_ar || ''), blocker_ar: l.blocker_ar || null, day: String(l.day) })), `${cid}:${uid}`);
    out.get(cid)!.lectures.push({ session_id: String(r.id), unit_id: uid, course: c?.title_ar || String(r.title_ar || ''), instructor: r.trainer_id ? n.instructor(String(r.trainer_id)) : null, starts: fmt(r.starts_at), ends: fmt(new Date(end).toISOString()), state: (t < st ? 'upcoming' : t < end ? 'live' : 'ended') as LectureCard['state'],
      line_ar: lineOf(L, { unit_id: uid, classroom_id: cid, trainer_id: r.trainer_id ? String(r.trainer_id) : null }), written: mine.some((m) => String(m.classroom_id) === cid && String(m.unit_id) === uid), question_ar: LEAVE_QUESTION_AR, thread: { intro_ar: th.intro_ar, head_ar: th.head_ar, applied: th.applied, shown: th.shown } });
  }
  return out;
}
/** هل هذا المقرّر له محاضرة في هذه الشعبة في هذا اليوم؟ (لتثبيت unit_id على سطر «قبل أن تغادر») */
export async function lectureExists(db: Db, classroomId: string, unitId: string, day: string): Promise<boolean> {
  const rows = await safe<any[]>(db.from('portal_sessions').select('id').eq('classroom_id', classroomId).eq('unit_id', unitId).gte('starts_at', `${day}T00:00:00+03:00`).lt('starts_at', `${addDays(day, 1)}T00:00:00+03:00`).neq('status', 'cancelled').limit(1), []); return rows.length > 0;
}
/** ★ «وضع الوردية»: يعيد مفتاح يوم الأمس إن كان سطره لا يزال مفتوحًا الآن (06:00 أو quiet_to من التفضيلات) */
export async function shiftDayFor(db: Db, me: Me, now = new Date()): Promise<{ day: string; until: string } | null> {
  const today = dayKey(now); const prefs = await safe<any>(db.from('portal_contact_prefs').select('quiet_from,quiet_to').eq('email', lower(me.email)).maybeSingle(), null);
  const day = shiftGraceDay(now, prefs, today, addDays(today, -1)); if (!day) return null;
  const qf = String(prefs?.quiet_from || ''); const qt = String(prefs?.quiet_to || ''); const until = /^\d{2}:\d{2}$/.test(qf) && /^\d{2}:\d{2}$/.test(qt) && qf > qt && qt > '06:00' && qt <= '12:00' ? qt : '06:00';
  return { day, until };
}

/* ───────── طلب نقل الشعبة ───────── */
export async function requestMove(db: Db, me: Me, b: { program_id?: unknown; to_classroom?: unknown; reason_ar?: unknown }, now = new Date(), opts: { dry?: boolean } = {}): Promise<{ ok: true; id: number; notified: number } | Fail> {
  const pid = String(b.program_id || ''); const reason = String(b.reason_ar || '').trim().replace(/\s+/g, ' ').slice(0, D_LIMITS.reasonMax); if (reason.length < D_LIMITS.reasonMin) return fail(`اكتب السبب (${D_LIMITS.reasonMin} أحرف على الأقل)`);
  const en = await safe<any>(db.from('portal_enrollments').select('id,classroom_id,full_name').eq('email', lower(me.email)).eq('program_id', pid).in('status', ENROLLED).not('classroom_id', 'is', null).limit(1).maybeSingle(), null); if (!en) return fail('لست مسجَّلًا في شعبة من هذا البرنامج', 403);
  const open = await safe<any>(db.from('portal_section_requests').select('id').eq('user_id', me.id).eq('program_id', pid).eq('status', 'open').maybeSingle(), null); if (open) return fail('لديك طلب نقل قيد النظر', 409);
  const to = b.to_classroom ? String(b.to_classroom) : null; const L = await loadAll(db, pid); if (to && !L.sections.some((s) => s.id === to)) return fail('الشعبة المطلوبة ليست من هذا البرنامج'); if (to && to === String(en.classroom_id)) return fail('أنت في هذه الشعبة أصلًا');
  const r = await db.from('portal_section_requests').insert({ user_id: me.id, email: lower(me.email), program_id: pid, enrollment_id: String(en.id), from_classroom: String(en.classroom_id), to_classroom: to, reason_ar: reason, status: 'open' }).select('id').maybeSingle(); if (r.error || !r.data) return fail(r.error?.message || 'تعذّر الحفظ', 500);
  const n = namesOf(L); const line = structureLine({ diploma: L.program?.name_ar, section: n.section(String(en.classroom_id)) }) + (to ? ` ← ${n.section(to)}` : ' ← أي شعبة أخرى');
  const coord = L.sections.find((s) => s.id === String(en.classroom_id))?.trainer_id; const email = coord ? L.instructors.find((t) => t.id === coord)?.email || null : null; let notified = 0;
  if (email) { const { pushNotice } = await import('../portal/notices'); const t = moveRequestNotice(me.name || 'متدرّب', line, reason); const res = await pushNotice(db, { email, user_id: null, report_id: null, kind: 'move_request' as any, ...t, url: `${DIPLOMA_PATH}?program=${pid}#requests`, ref_id: String(r.data.id), dedupe_key: `move_request:${r.data.id}` }, { dry: !!opts.dry, now }); if (res.inserted) notified += 1; }
  return { ok: true, id: Number(r.data.id), notified };
}
export async function decideMove(db: Db, me: Me, b: { program_id?: unknown; id?: unknown; status?: unknown; note_ar?: unknown; to_classroom?: unknown }, now = new Date(), opts: { dry?: boolean } = {}): Promise<{ ok: true; moved: boolean } | Fail> {
  const pid = String(b.program_id || ''); const L = await loadAll(db, pid); if (!L.program) return fail('البرنامج غير موجود', 404); if (!(await canEditProgram(db, me, L))) return fail('للطاقم ومنسّق الشعبة', 403);
  const id = Number(b.id); const st = String(b.status || ''); if (!['done', 'declined'].includes(st)) return fail('القرار: done أو declined');
  const req = await safe<any>(db.from('portal_section_requests').select('id,user_id,email,enrollment_id,to_classroom,status').eq('id', id).eq('program_id', pid).maybeSingle(), null); if (!req || req.status !== 'open') return fail('الطلب غير موجود أو أُغلق', 404);
  const to = b.to_classroom ? String(b.to_classroom) : (req.to_classroom ? String(req.to_classroom) : null); let moved = false;
  if (st === 'done') { if (!to || !L.sections.some((s) => s.id === to)) return fail('حدّد الشعبة الجديدة'); const { error } = await db.from('portal_enrollments').update({ classroom_id: to, placed_at: now.toISOString() }).eq('id', String(req.enrollment_id)); if (error) return fail(error.message, 500); moved = true; }
  const note = b.note_ar ? String(b.note_ar).trim().slice(0, 200) : null; const { error } = await db.from('portal_section_requests').update({ status: st, decided_by: me.id, decided_at: now.toISOString(), note_ar: note, to_classroom: to }).eq('id', id); if (error) return fail(error.message, 500);
  const { pushNotice } = await import('../portal/notices'); const t = moveDecidedNotice(st === 'done', st === 'done' && to ? `${structureLine({ diploma: L.program?.name_ar, section: namesOf(L).section(to) })}. ${note || ''}`.trim() : note);
  await pushNotice(db, { email: req.email, user_id: req.user_id, report_id: null, kind: 'move_decided' as any, ...t, url: '/me/line', ref_id: String(id), dedupe_key: `move_decided:${id}` }, { dry: !!opts.dry, now });
  return { ok: true, moved };
}

/* ───────── الكرون: «محطّة المستوى» ───────── */
export async function runLevelClose(db: Db, now = new Date(), opts: { dry?: boolean; site?: string } = {}): Promise<{ programs: number; level_close: number; errors: string[] }> {
  const today = dayKey(now); const out = { programs: 0, level_close: 0, errors: [] as string[] }; const { pushNotice } = await import('../portal/notices');
  const units = await safe<any[]>(db.from('portal_program_units').select('program_id').not('level_no', 'is', null).limit(2000), []); const pids = [...new Set(units.map((u) => String(u.program_id)))];
  for (const pid of pids) {
    try {
      const L = await loadAll(db, pid); if (!L.program) continue; out.programs += 1; const spans = levelSpans(L.courses, L.slots); const cur = currentLevel(spans, today); if (!cur || !isLevelLastWeek(cur, today)) continue;
      if (addDays(cur.to_day, -(D_LIMITS.levelLastWeekDays - 1)) !== today) continue; /* أول يوم من الأسبوع الأخير فقط */
      const en = await safe<any[]>(db.from('portal_enrollments').select('id,email,user_id').eq('program_id', pid).in('status', ENROLLED).not('classroom_id', 'is', null).limit(1000), []); const t = levelCloseNotice(String(L.program.name_ar || ''), cur.level_no);
      for (const e of en) { const r = await pushNotice(db, { email: e.email, user_id: e.user_id || null, report_id: null, kind: 'level_close' as any, ...t, url: '/me/line', ref_id: pid, dedupe_key: `level_close:${e.id}:${cur.level_no}`, push: true } as any, { dry: !!opts.dry, site: opts.site, now }); if (r.inserted) out.level_close += 1; }
    } catch (e) { out.errors.push(`${pid}: ${(e as Error).message}`); }
  }
  return out;
}
