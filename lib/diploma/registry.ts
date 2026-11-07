// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66-ب «مقرّرات الدبلوم — لكل مقرّر أستاذه» — السجلّ (منطق صِرف، بلا قاعدة ولا شبكة)
 *  الاسم الرسمي: هيكل الدبلوم: المستويات والمقرّرات والشُّعب وأساتذة المواد
 *  التسلسل المعتمد في كل شاشة وتقرير وإشعار: اسم الدبلوم : المستوى — المقرّر — الشعبة (1، 2، 3…) — أستاذ المادة
 *  القواعد: المشرف يُعدّ الجدول بالعرف الأكاديمي (لا أوقات ولا مدد مثبَّتة هنا) · المتدرّب ثابت في شعبته طوال المستوى (النقل بطلب)
 *           · الأستاذ يتنقّل بين الشُّعب · المحاضرة = صفّ في portal_sessions يولّده الخادم من سطر الجدول · «الفترات الخاصّة» (رمضان…) تتجاوز المدّة/الوقت ضمن مداها
 *  لا تقييم · لا أسماء خارج شاشة صاحبها (k ≥ 5) · لا ذكاء اصطناعي خادمي — «الميسِّر يقترح» خوارزمية قيود، والمدير يعتمد.
 */
import { fieldSummaryOf, shuffleSeeded, addDays, daysBetween, isDayKey, CAL_LIMITS } from '../calendar/registry';
import type { FieldSummary } from '../calendar/registry';

export const D_NAMES_AR = {
  page: 'هيكل الدبلوم', official: 'هيكل الدبلوم: المستويات والمقرّرات والشُّعب وأساتذة المواد', level: 'المستوى', course: 'المقرّر', courses: 'مقرّرات الدبلوم',
  section: 'الشعبة', instructor: 'أستاذ المادة', slot: 'محاضرة', slots: 'الشُّعب والمحاضرات', periods: 'الفترات الخاصّة', grid: 'شبكة الأسبوع', generate: 'ولّد المحاضرات',
  suggest: 'الميسِّر يقترح الجدول', substitute: 'البديل بلمسة', corridor: 'الممرّ', leave: 'قبل أن تغادر', thread: 'خيط المقرّر', move: 'أطلب نقلي إلى شعبة أخرى', today: 'ماذا عندي اليوم؟',
  level_close: 'محطّة المستوى', requests: 'طلبات النقل', conflicts: 'تعارضات',
} as const;
/** ★ «وضع الوردية»: سطر الأمس يبقى مفتوحًا بعد منتصف الليل حتى نهاية «ليل» المتدرّب — 06:00 افتراضًا، أو quiet_to من تفضيلاته إن كانت نافذة هدوئه تعبر منتصف الليل (من 23:00 إلى 08:00 مثلًا). يعيد مفتاح يوم الأمس أو null */
export function shiftGraceDay(now: Date, prefs: { quiet_from?: string | null; quiet_to?: string | null } | null | undefined, todayKey: string, yesterdayKey: string): string | null {
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false }).format(now).replace(/^24/, '00');
  let until = '06:00'; const qf = String(prefs?.quiet_from || ''); const qt = String(prefs?.quiet_to || '');
  if (/^\d{2}:\d{2}$/.test(qf) && /^\d{2}:\d{2}$/.test(qt) && qf > qt && qt > until && qt <= '12:00') until = qt;
  return hm < until && yesterdayKey < todayKey ? yesterdayKey : null;
}
export const SHIFT_NOTE_AR = (until: string) => `وضع الوردية: سطر الأمس لا يزال مفتوحًا حتى ${until} — ليلتك تُحسب على يومها.`;
export const DIPLOMA_PATH = '/me/diploma';
export const D_LIMITS = { maxLevels: 8, maxPeriods: 8, minMinutes: 20, maxMinutes: 300, maxSpanDays: 400, reasonMin: 5, reasonMax: 200, leaveMax: 200, k: CAL_LIMITS.k, show: 5, levelLastWeekDays: 7 } as const;
export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const;
export const ORDINAL_AR = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'] as const;
export const LEAVE_QUESTION_AR = 'قبل أن تغادر: ماذا ستفعل بهذا غدًا؟ — سطر واحد.';
export const LEAVE_INTRO_AR = 'ما قلتم قبل أن تغادروا المحاضرة الماضية';

export type Course = { id: string; idx: number; title_ar: string; code: string | null; level_no: number | null; trainer_id: string | null; hours: number; starts_on?: string | null; ends_on?: string | null };
export type Slot = { id: string; program_id: string; unit_id: string; classroom_id: string; trainer_id: string | null; weekday: number; period_no: number; starts_at: string; minutes: number; from_day: string; to_day: string; room_ar: string | null; provider: string; generated_at?: string | null };
export type Period = { id: string; program_id: string; name_ar: string; from_day: string; to_day: string; lecture_minutes: number | null; lecture_break_min: number | null; first_lecture_at: string | null; shift_minutes: number };
export type Section = { id: string; code: string; section_name: string | null; trainer_id: string | null };
export type Instructor = { id: string; name: string };
export type Lecture = { day: string; weekday: number; starts: string; ends: string; minutes: number; starts_at_iso: string; period_name: string | null };

/* ───────── التسلسل الرسمي ───────── */
export const sectionLabel = (s: { code?: string | null; section_name?: string | null } | null | undefined): string => {
  if (!s) return ''; const m = String(s.code || '').match(/\d+/g); if (m) return `شعبة ${Number(m[m.length - 1])}`; /* آخر رقم في الرمز: «D3-2» → شعبة 2 */ return s.section_name ? `شعبة ${s.section_name}` : String(s.code || 'شعبة');
};
export function structureLine(p: { diploma?: string | null; level?: number | null; course?: string | null; section?: string | null; instructor?: string | null }): string {
  const tail = [p.level ? `${D_NAMES_AR.level} ${p.level}` : null, p.course || null, p.section || null, p.instructor || null].filter(Boolean).join(' — ');
  return p.diploma ? (tail ? `${p.diploma} : ${tail}` : p.diploma) : tail;
}

/* ───────── أوقات ───────── */
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
export const isTime = (v: unknown): v is string => typeof v === 'string' && TIME_RE.test(v.trim());
export const toMin = (t: string): number => { const m = String(t).trim().match(TIME_RE); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
export const fromMin = (n: number): string => { const x = ((Math.round(n) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
export const normTime = (t: string): string => fromMin(toMin(t));
export const timeAr = (t: string): string => { const m = toMin(t); const h = Math.floor(m / 60); const mm = m % 60; const h12 = h % 12 === 0 ? 12 : h % 12; const part = h < 12 ? 'صباحًا' : h < 15 ? 'ظهرًا' : h < 18 ? 'عصرًا' : 'مساءً'; return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${part}`; };
export const weekdayOf = (day: string): number => new Date(`${day}T12:00:00+03:00`).getUTCDay();

/* ───────── التحقّق ───────── */
export type SlotInput = { unit_id?: unknown; classroom_id?: unknown; trainer_id?: unknown; weekday?: unknown; period_no?: unknown; starts_at?: unknown; minutes?: unknown; from_day?: unknown; to_day?: unknown; room_ar?: unknown; provider?: unknown };
const ID_RE = /^[0-9a-zA-Z-]{1,40}$/; const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);
const PROVIDERS = ['teams', 'zoom', 'meet', 'athar', 'other'];
export function validateSlot(i: SlotInput): { ok: true; slot: Omit<Slot, 'id' | 'program_id'> } | { ok: false; error: string } {
  if (!isId(i.unit_id)) return { ok: false, error: 'حدّد المقرّر' }; if (!isId(i.classroom_id)) return { ok: false, error: 'حدّد الشعبة' };
  const weekday = Number(i.weekday); if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: 'حدّد يوم الأسبوع' };
  const period_no = Number(i.period_no ?? 1); if (!Number.isInteger(period_no) || period_no < 1 || period_no > D_LIMITS.maxPeriods) return { ok: false, error: `رقم المحاضرة بين 1 و${D_LIMITS.maxPeriods}` };
  if (!isTime(i.starts_at)) return { ok: false, error: 'اكتب وقت بدء المحاضرة (مثل 16:00) — بالعرف الأكاديمي عندكم' };
  const minutes = Number(i.minutes); if (!Number.isInteger(minutes) || minutes < D_LIMITS.minMinutes || minutes > D_LIMITS.maxMinutes) return { ok: false, error: `مدّة المحاضرة بين ${D_LIMITS.minMinutes} و${D_LIMITS.maxMinutes} دقيقة` };
  const from_day = String(i.from_day || ''); const to_day = String(i.to_day || ''); if (!isDayKey(from_day) || !isDayKey(to_day)) return { ok: false, error: 'حدّد تاريخ البداية والنهاية' };
  if (to_day < from_day) return { ok: false, error: 'النهاية قبل البداية' }; if (daysBetween(from_day, to_day) > D_LIMITS.maxSpanDays) return { ok: false, error: `المدى أطول من ${D_LIMITS.maxSpanDays} يومًا` };
  const provider = PROVIDERS.includes(String(i.provider || '')) ? String(i.provider) : 'athar';
  return { ok: true, slot: { unit_id: i.unit_id, classroom_id: i.classroom_id, trainer_id: isId(i.trainer_id) ? i.trainer_id : null, weekday, period_no, starts_at: normTime(i.starts_at), minutes, from_day, to_day, room_ar: i.room_ar ? String(i.room_ar).trim().slice(0, 80) : null, provider } };
}
export function validatePeriod(i: Record<string, unknown>): { ok: true; period: Omit<Period, 'id' | 'program_id'> } | { ok: false; error: string } {
  const name_ar = String(i.name_ar || '').trim().slice(0, 80); if (name_ar.length < 2) return { ok: false, error: 'اسم الفترة (مثل: شهر رمضان 1448)' };
  const from_day = String(i.from_day || ''); const to_day = String(i.to_day || ''); if (!isDayKey(from_day) || !isDayKey(to_day) || to_day < from_day) return { ok: false, error: 'حدّد مدى الفترة' };
  const lm = i.lecture_minutes === null || i.lecture_minutes === undefined || i.lecture_minutes === '' ? null : Number(i.lecture_minutes); if (lm !== null && (!Number.isInteger(lm) || lm < D_LIMITS.minMinutes || lm > D_LIMITS.maxMinutes)) return { ok: false, error: 'مدّة المحاضرة في الفترة غير صالحة' };
  const br = i.lecture_break_min === null || i.lecture_break_min === undefined || i.lecture_break_min === '' ? null : Number(i.lecture_break_min); if (br !== null && (!Number.isInteger(br) || br < 0 || br > 60)) return { ok: false, error: 'الفاصل بين 0 و60' };
  const first = i.first_lecture_at ? String(i.first_lecture_at) : null; if (first && !isTime(first)) return { ok: false, error: 'وقت أول محاضرة في الفترة غير صالح' };
  const shift = Number(i.shift_minutes || 0); if (!Number.isInteger(shift) || shift < -720 || shift > 720) return { ok: false, error: 'الإزاحة بين −720 و720 دقيقة' };
  return { ok: true, period: { name_ar, from_day, to_day, lecture_minutes: lm, lecture_break_min: br, first_lecture_at: first ? normTime(first) : null, shift_minutes: shift } };
}

/* ───────── توليد المحاضرات ───────── */
export const periodFor = (periods: Period[], day: string): Period | null => periods.find((p) => p.from_day <= day && day <= p.to_day) || null;
export function lectureOn(slot: Pick<Slot, 'period_no' | 'starts_at' | 'minutes' | 'weekday'>, day: string, periods: Period[]): Lecture {
  const p = periodFor(periods, day); let start = toMin(slot.starts_at); let minutes = slot.minutes;
  if (p) { if (p.lecture_minutes) minutes = p.lecture_minutes; if (p.first_lecture_at) start = toMin(p.first_lecture_at) + (slot.period_no - 1) * (minutes + (p.lecture_break_min ?? 0)); start += p.shift_minutes || 0; }
  const starts = fromMin(start); const ends = fromMin(start + minutes);
  return { day, weekday: slot.weekday, starts, ends, minutes, starts_at_iso: `${day}T${starts}:00+03:00`, period_name: p ? p.name_ar : null };
}
/** كل تواريخ السطر (اليوم الأسبوعي ضمن المدى)، اختياريًا من تاريخ معيّن فصاعدًا */
export function slotDays(slot: Pick<Slot, 'weekday' | 'from_day' | 'to_day'>, fromDay?: string): string[] {
  const out: string[] = []; let d = slot.from_day; const off = (slot.weekday - weekdayOf(d) + 7) % 7; d = addDays(d, off);
  while (d <= slot.to_day) { if (!fromDay || d >= fromDay) out.push(d); d = addDays(d, 7); if (out.length > 120) break; } return out;
}
export const lecturesOf = (slot: Slot, periods: Period[], fromDay?: string): Lecture[] => slotDays(slot, fromDay).map((d) => lectureOn(slot, d, periods));

/* ───────── التعارضات ───────── */
export type Conflict = { kind: 'instructor' | 'section'; weekday: number; a: string; b: string; text_ar: string };
const spansOverlap = (a: Slot, b: Slot) => a.from_day <= b.to_day && b.from_day <= a.to_day;
const timesOverlap = (a: Slot, b: Slot) => toMin(a.starts_at) < toMin(b.starts_at) + b.minutes && toMin(b.starts_at) < toMin(a.starts_at) + a.minutes;
export const effectiveTrainer = (s: Slot, courses: Course[]): string | null => s.trainer_id || courses.find((c) => c.id === s.unit_id)?.trainer_id || null;
export function conflictsOf(slots: Slot[], courses: Course[], names: { course: (id: string) => string; section: (id: string) => string; instructor: (id: string | null) => string }): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < slots.length; i += 1) for (let j = i + 1; j < slots.length; j += 1) {
    const a = slots[i]; const b = slots[j]; if (a.weekday !== b.weekday || !spansOverlap(a, b) || !timesOverlap(a, b)) continue;
    const ta = effectiveTrainer(a, courses); const tb = effectiveTrainer(b, courses);
    if (ta && ta === tb) out.push({ kind: 'instructor', weekday: a.weekday, a: a.id, b: b.id, text_ar: `${names.instructor(ta)} في محاضرتين معًا ${WEEKDAYS_AR[a.weekday]} ${a.starts_at}: ${names.course(a.unit_id)} (${names.section(a.classroom_id)}) و${names.course(b.unit_id)} (${names.section(b.classroom_id)})` });
    if (a.classroom_id === b.classroom_id) out.push({ kind: 'section', weekday: a.weekday, a: a.id, b: b.id, text_ar: `${names.section(a.classroom_id)} لها محاضرتان معًا ${WEEKDAYS_AR[a.weekday]} ${a.starts_at}: ${names.course(a.unit_id)} و${names.course(b.unit_id)}` });
  }
  return out;
}

/* ───────── شبكة الأسبوع ───────── */
export type Grid = { days: number[]; periods: number[]; cells: Record<string, string[]> };
export function weekGrid(slots: Slot[]): Grid {
  const days = [...new Set(slots.map((s) => s.weekday))].sort((a, b) => a - b); const periods = [...new Set(slots.map((s) => s.period_no))].sort((a, b) => a - b); const cells: Record<string, string[]> = {};
  for (const s of slots) { const k = `${s.weekday}:${s.period_no}`; (cells[k] = cells[k] || []).push(s.id); }
  return { days: days.length ? days : [0, 1, 2, 3, 4], periods: periods.length ? periods : [1, 2, 3], cells };
}

/* ───────── «الميسِّر يقترح الجدول» — خوارزمية قيود (لا ذكاء اصطناعي) ───────── */
export type SuggestInput = { courses: Course[]; sections: Section[]; weekdays: number[]; times: Array<{ period_no: number; starts_at: string; minutes: number }>; from_day: string; to_day: string; existing: Slot[]; level_no: number; per_week?: number };
export type Proposed = Omit<Slot, 'id' | 'program_id' | 'generated_at'> & { key: string };
export function suggestGrid(i: SuggestInput): { proposed: Proposed[]; unplaced: Array<{ unit_id: string; classroom_id: string }>; note_ar: string } {
  const courses = i.courses.filter((c) => c.level_no === i.level_no); const times = [...i.times].sort((a, b) => a.period_no - b.period_no); const perWeek = Math.max(1, Math.min(3, Number(i.per_week || 1)));
  const busyT = new Map<string, Set<string>>(); const busyS = new Map<string, Set<string>>(); const at = (wd: number, p: number) => `${wd}:${p}`;
  const mark = (t: string | null, s: string, k: string) => { if (t) { if (!busyT.has(t)) busyT.set(t, new Set()); busyT.get(t)!.add(k); } if (!busyS.has(s)) busyS.set(s, new Set()); busyS.get(s)!.add(k); };
  for (const e of i.existing) if (e.from_day <= i.to_day && i.from_day <= e.to_day) mark(effectiveTrainer(e, i.courses), e.classroom_id, at(e.weekday, e.period_no));
  const proposed: Proposed[] = []; const unplaced: Array<{ unit_id: string; classroom_id: string }> = [];
  /* الأستاذ يتنقّل بين الشُّعب: نوزّع المقرّر الواحد على خانات مختلفة لكل شعبة، ونبدأ بالأستاذ الأكثر انشغالًا */
  const load = (c: Course) => courses.filter((x) => x.trainer_id && x.trainer_id === c.trainer_id).length; const ordered = [...courses].sort((a, b) => load(b) - load(a) || a.idx - b.idx);
  for (const c of ordered) for (const s of i.sections) {
    let placed = 0;
    outer: for (const wd of i.weekdays) for (const t of times) {
      const k = at(wd, t.period_no); if (busyT.get(c.trainer_id || '')?.has(k) || busyS.get(s.id)?.has(k)) continue;
      if (proposed.some((p) => p.unit_id === c.id && p.classroom_id === s.id && p.weekday === wd)) continue; /* لا محاضرتان للمقرّر نفسه في اليوم نفسه */
      proposed.push({ key: `${c.id}:${s.id}:${k}`, unit_id: c.id, classroom_id: s.id, trainer_id: null, weekday: wd, period_no: t.period_no, starts_at: normTime(t.starts_at), minutes: t.minutes, from_day: i.from_day, to_day: i.to_day, room_ar: null, provider: 'athar' });
      mark(c.trainer_id, s.id, k); placed += 1; if (placed >= perWeek) break outer;
    }
    if (placed < perWeek) unplaced.push({ unit_id: c.id, classroom_id: s.id });
  }
  return { proposed, unplaced, note_ar: unplaced.length ? `تعذّر توزيع ${unplaced.length} — زد الأيام أو المحاضرات أو الأساتذة، أو وزّعها بيدك.` : 'اقتراح بلا تعارض — راجعه واعتمد ما تشاء، أو اسحب الخلايا بيدك.' };
}

/* ───────── «البديل بلمسة» ───────── */
export function substitutesFor(slot: Slot, day: string, slots: Slot[], courses: Course[], instructors: Instructor[]): Array<{ id: string; name: string; why_ar: string }> {
  const me = effectiveTrainer(slot, courses); const wd = weekdayOf(day); const busy = new Set<string>();
  for (const s of slots) { if (s.id === slot.id || s.weekday !== wd || !(s.from_day <= day && day <= s.to_day) || !timesOverlap(s, slot)) continue; const t = effectiveTrainer(s, courses); if (t) busy.add(t); }
  const sameUnit = new Set(slots.filter((s) => s.unit_id === slot.unit_id).map((s) => effectiveTrainer(s, courses)).filter(Boolean) as string[]);
  const sameLevel = new Set(courses.filter((c) => c.level_no && c.level_no === courses.find((x) => x.id === slot.unit_id)?.level_no).map((c) => c.trainer_id).filter(Boolean) as string[]);
  return instructors.filter((t) => t.id !== me && !busy.has(t.id)).map((t) => ({ id: t.id, name: t.name, why_ar: sameUnit.has(t.id) ? 'يدرّس المقرّر نفسه لشعبة أخرى وله فراغ' : sameLevel.has(t.id) ? 'من أساتذة المستوى نفسه وله فراغ' : 'له فراغ في هذا الوقت' }))
    .sort((a, b) => (sameUnit.has(b.id) ? 2 : sameLevel.has(b.id) ? 1 : 0) - (sameUnit.has(a.id) ? 2 : sameLevel.has(a.id) ? 1 : 0)).slice(0, 5);
}

/* ───────── «خيط المقرّر» و«الممرّ» (أعداد وسطور مجمَّعة، k ≥ 5) ───────── */
export type ThreadLine = { user_id: string; body_ar: string; blocker_ar: string | null; day: string };
export function courseThread(lines: ThreadLine[], seed: string, roster = 0): FieldSummary & { intro_ar: string } {
  const s = fieldSummaryOf(lines, { seed, roster }); return { ...s, intro_ar: LEAVE_INTRO_AR, head_ar: s.shown ? `قال ${s.people}${roster ? ` من ${roster}` : ''} قبل أن يغادروا — ${s.lines} سطرًا.` : s.head_ar };
}
export type Corridor = { title_ar: string; line_ar: string; next: { course: string; section: string; starts: string; room_ar: string | null }; thread: string[]; commits_open: number; blockers_people: number; people: number };
export function corridorCard(p: { diploma: string; level: number | null; course: string; section: string; instructor: string; starts: string; room_ar: string | null; thread: FieldSummary; commits_open: number }): Corridor {
  const t = p.thread; const line = t.shown ? `قبل أن يغادروا قالوا ${t.people}: ${t.applied[0] || ''}` : t.people ? `كتب ${t.people} قبل أن يغادروا؛ تظهر السطور حين يبلغون خمسة.` : 'لم يكتبوا بعد — ابدأ بسؤالهم.';
  return { title_ar: structureLine({ diploma: p.diploma, level: p.level, course: p.course, section: p.section, instructor: p.instructor }), line_ar: line, next: { course: p.course, section: p.section, starts: p.starts, room_ar: p.room_ar }, thread: t.applied.slice(0, 3), commits_open: p.commits_open, blockers_people: t.blockers_people, people: t.people };
}

/* ───────── المستويات والمحطّة ───────── */
export type LevelSpan = { level_no: number; from_day: string; to_day: string; courses: number };
export function levelSpans(courses: Course[], slots: Slot[]): LevelSpan[] {
  const out = new Map<number, LevelSpan>();
  for (const c of courses) { if (!c.level_no) continue; const mine = slots.filter((s) => s.unit_id === c.id); const cur = out.get(c.level_no) || { level_no: c.level_no, from_day: '', to_day: '', courses: 0 }; cur.courses += 1;
    for (const s of mine) { if (!cur.from_day || s.from_day < cur.from_day) cur.from_day = s.from_day; if (!cur.to_day || s.to_day > cur.to_day) cur.to_day = s.to_day; } out.set(c.level_no, cur); }
  return [...out.values()].sort((a, b) => a.level_no - b.level_no);
}
export const currentLevel = (spans: LevelSpan[], today: string): LevelSpan | null => spans.find((l) => l.from_day && l.from_day <= today && today <= l.to_day) || null;
export const isLevelLastWeek = (l: LevelSpan, today: string): boolean => !!l.to_day && today <= l.to_day && daysBetween(today, l.to_day) < D_LIMITS.levelLastWeekDays;

/* ───────── نصوص ───────── */
export const levelCloseNotice = (diploma: string, levelNo: number) => ({ title_ar: `${D_NAMES_AR.level_close} — ${D_NAMES_AR.level} ${levelNo} 🏁`, body_ar: `أسبوعك الأخير في ${D_NAMES_AR.level} ${levelNo} من «${diploma}». سطر واحد: ماذا تغيّر في عملك هذا المستوى؟ والتزاماتك المفتوحة تنتظر إجابتك.` });
export const moveRequestNotice = (who: string, line: string, reason: string) => ({ title_ar: 'طلب نقل شعبة', body_ar: `${who} يطلب النقل — ${line}. السبب: ${reason}. التسكين من أداة التسكين.` });
export const moveDecidedNotice = (ok: boolean, note: string | null) => ({ title_ar: ok ? 'تمّ النظر في طلب نقلك ✅' : 'طلب نقلك — تعذّر الآن', body_ar: ok ? `نُقلت إلى شعبتك الجديدة. ${note || ''}`.trim() : `${note || 'الشُّعب مكتملة حاليًا.'} يمكنك الطلب لاحقًا.` });
export const arCount = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
/** «ماذا عندي اليوم؟» — للنداء وللشاشة */
export function todayAnswerAr(items: Array<{ course: string; section: string; starts: string; instructor: string | null }>): string {
  if (!items.length) return 'لا محاضرات لك اليوم.';
  const head = arCount(items.length, 'محاضرة واحدة', 'محاضرتان', 'محاضرات', 'محاضرة');
  return `${head}: ` + items.map((x) => `${x.course} — ${x.section} — ${timeAr(x.starts)}${x.instructor ? ` مع ${x.instructor}` : ''}`).join(' · ') + '.';
}
export const pickSeeded = <T,>(xs: T[], seed: string, n: number): T[] => shuffleSeeded(xs, seed).slice(0, n);
