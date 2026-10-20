/**
 * Remote Learning Survey — definitions & pure helpers
 * ---------------------------------------------------
 * Bilingual (AR/EN) survey for students of Arabic-for-non-native-speakers
 * programs delivered online via Microsoft Teams.
 *
 * Everything in this file is framework-free so it can be unit-tested with
 * `node --test` and reused by the form, the admin settings and the reports.
 */

export const SURVEY_VERSION = 1;
export const RIYADH_TZ = 'Asia/Riyadh';

export type Lang = 'ar' | 'en';
export type Bi = { ar: string; en: string };

/* ----------------------------------------------------------------------------
 * Lookup entity shapes (subset of DB rows used by the survey)
 * ------------------------------------------------------------------------- */
export type Program = { id: string; name_ar: string; name_en?: string | null; delivery_mode?: string | null; status?: string | null };
export type Level = { id: string; program_id: string | null; code: string; name_ar: string; name_en: string; sort_order: number; is_active?: boolean };
export type Trainer = { id: string; name: string };
export type Classroom = {
  id: string; code: string; program_id: string; trainer_id: string | null;
  level_id?: string | null; level?: string | null; section_name?: string | null; delivery_mode?: string | null;
};
export type Schedule = {
  id: string; classroom_id: string; day_of_week: number;
  start_time: string; end_time: string; is_active?: boolean;
};

/* ----------------------------------------------------------------------------
 * Static content
 * ------------------------------------------------------------------------- */
export const SURVEY_TITLE: Bi = {
  ar: 'استطلاع رأي الطلاب: تعلم اللغة العربية عن بُعد عبر Teams',
  en: 'Student Survey: Learning Arabic Online through Teams',
};

export const SURVEY_INTRO: Bi = {
  ar: 'نريد معرفة رأيك في تعلم اللغة العربية عن بُعد عبر Teams. ستساعدنا إجاباتك على تحسين البرنامج. المشاركة اختيارية. يرجى عدم كتابة اسمك أو أي معلومات شخصية.',
  en: 'We would like to know what you think about learning Arabic online through Teams. Your answers will help us improve the program. Taking part is optional. Please do not write your name or any personal information.',
};

export type ScaleCode = 'SA' | 'A' | 'N' | 'D' | 'SD' | 'NA';
export const SCALE: { code: ScaleCode; ar: string; en: string; value: number | null }[] = [
  { code: 'SA', ar: 'أوافق بشدة',          en: 'Strongly agree',             value: 5 },
  { code: 'A',  ar: 'أوافق',               en: 'Agree',                      value: 4 },
  { code: 'N',  ar: 'لا أوافق ولا أعارض',  en: 'Neither agree nor disagree', value: 3 },
  { code: 'D',  ar: 'لا أوافق',            en: 'Disagree',                   value: 2 },
  { code: 'SD', ar: 'لا أوافق بشدة',       en: 'Strongly disagree',          value: 1 },
  { code: 'NA', ar: 'لا ينطبق',            en: 'Not applicable',             value: null },
];
export const SCALE_CODES = SCALE.map(s => s.code);

export type AttendanceCode = 'almost_all' | 'most' | 'some' | 'few';
export const ATTENDANCE: { code: AttendanceCode; ar: string; en: string }[] = [
  { code: 'almost_all', ar: 'كل الدروس تقريبًا', en: 'Almost all lessons' },
  { code: 'most',       ar: 'معظم الدروس',       en: 'Most lessons' },
  { code: 'some',       ar: 'بعض الدروس',        en: 'Some lessons' },
  { code: 'few',        ar: 'قليلًا',            en: 'A few lessons' },
];

export const STATEMENTS: { key: string; ar: string; en: string }[] = [
  { key: 'q01_teams_easy',        ar: 'كان استخدام Teams سهلًا بالنسبة لي.',                               en: 'Teams was easy for me to use.' },
  { key: 'q02_av_clear',          ar: 'كان الصوت والصورة واضحين في الدروس.',                                en: 'The audio and video were clear during lessons.' },
  { key: 'q03_teacher_clear',     ar: 'كان المدرّس يتحدث بطريقة سهلة الفهم.',                               en: 'The teacher spoke in a way that was easy to understand.' },
  { key: 'q04_new_words',         ar: 'تعلّمت كلمات عربية جديدة في البرنامج.',                              en: 'I learned new Arabic words in the program.' },
  { key: 'q05_listening',         ar: 'ساعدتني الدروس على فهم اللغة العربية عندما أسمعها.',                 en: 'The lessons helped me understand spoken Arabic.' },
  { key: 'q06_speaking',          ar: 'أتيحت لي فرص كافية للتحدث باللغة العربية.',                          en: 'I had enough opportunities to speak Arabic.' },
  { key: 'q07_reading',           ar: 'ساعدتني الأنشطة على القراءة باللغة العربية.',                        en: 'The activities helped me read in Arabic.' },
  { key: 'q08_writing',           ar: 'ساعدتني الأنشطة على الكتابة باللغة العربية.',                        en: 'The activities helped me write in Arabic.' },
  { key: 'q09_materials_level',   ar: 'كانت المواد والأنشطة مناسبة لمستواي في اللغة العربية.',              en: 'The learning materials and activities were suitable for my Arabic level.' },
  { key: 'q10_instructions',      ar: 'كانت تعليمات الأنشطة والواجبات واضحة.',                              en: 'The instructions for activities and assignments were clear.' },
  { key: 'q11_help',              ar: 'حصلت على مساعدة عندما لم أفهم درسًا أو نشاطًا.',                      en: 'I received help when I did not understand a lesson or activity.' },
  { key: 'q12_improved',          ar: 'أشعر أن لغتي العربية تحسّنت بسبب هذا البرنامج.',                     en: 'I feel that my Arabic improved because of this program.' },
  { key: 'q13_satisfied',         ar: 'أنا راضٍ عن تجربتي في تعلم العربية عن بُعد عبر Teams.',              en: 'I am satisfied with my experience of learning Arabic online through Teams.' },
];
export const SATISFACTION_KEY = 'q13_satisfied';

export type DifficultyCode =
  | 'poor_internet' | 'teams_difficulty' | 'arabic_in_class' | 'few_speaking'
  | 'activities_unclear' | 'concentration' | 'none' | 'other';
export const DIFFICULTIES: { code: DifficultyCode; ar: string; en: string }[] = [
  { code: 'poor_internet',      ar: 'ضعف الإنترنت',                               en: 'Poor internet connection' },
  { code: 'teams_difficulty',   ar: 'صعوبة استخدام Teams',                        en: 'Difficulty using Teams' },
  { code: 'arabic_in_class',    ar: 'صعوبة فهم اللغة العربية في الدرس',            en: 'Difficulty understanding the Arabic used in class' },
  { code: 'few_speaking',       ar: 'قلة فرص التحدث بالعربية',                     en: 'Not enough opportunities to speak Arabic' },
  { code: 'activities_unclear', ar: 'صعوبة فهم الأنشطة أو التعليمات',              en: 'Difficulty understanding activities or instructions' },
  { code: 'concentration',      ar: 'صعوبة التركيز في الدروس عن بُعد',             en: 'Difficulty concentrating during online lessons' },
  { code: 'none',               ar: 'لم أواجه صعوبات',                             en: 'I did not have any difficulties' },
  { code: 'other',              ar: 'أخرى',                                        en: 'Other' },
];

export const DAYS: { v: number; ar: string; en: string; short_ar: string; short_en: string }[] = [
  { v: 0, ar: 'الأحد',     en: 'Sunday',    short_ar: 'أحد', short_en: 'Sun' },
  { v: 1, ar: 'الاثنين',   en: 'Monday',    short_ar: 'اثن', short_en: 'Mon' },
  { v: 2, ar: 'الثلاثاء',  en: 'Tuesday',   short_ar: 'ثلا', short_en: 'Tue' },
  { v: 3, ar: 'الأربعاء',  en: 'Wednesday', short_ar: 'أرب', short_en: 'Wed' },
  { v: 4, ar: 'الخميس',    en: 'Thursday',  short_ar: 'خمي', short_en: 'Thu' },
  { v: 5, ar: 'الجمعة',    en: 'Friday',    short_ar: 'جمع', short_en: 'Fri' },
  { v: 6, ar: 'السبت',     en: 'Saturday',  short_ar: 'سبت', short_en: 'Sat' },
];

export const UI: Record<string, Bi> = {
  sectionGroup:     { ar: 'بيانات المجموعة والمحاضرة',          en: 'Group & class information' },
  sectionChoice:    { ar: 'أسئلة عامة',                          en: 'General questions' },
  sectionRating:    { ar: 'تقييم التجربة',                        en: 'Rating your experience' },
  sectionDiff:      { ar: 'الصعوبات',                             en: 'Difficulties' },
  sectionOpen:      { ar: 'رأيك (اختياري)',                       en: 'Your opinion (optional)' },
  program:          { ar: 'البرنامج',                             en: 'Program' },
  level:            { ar: 'المستوى',                              en: 'Level' },
  trainer:          { ar: 'اسم المدرب/المدربة',                   en: 'Trainer' },
  group:            { ar: 'المجموعة/الشعبة',                      en: 'Class group/section' },
  schedule:         { ar: 'موعد المحاضرة',                        en: 'Class schedule' },
  lectureDate:      { ar: 'تاريخ المحاضرة (اختياري)',             en: 'Class date (optional)' },
  selfLevel:        { ar: 'ما مستواك في اللغة العربية؟',          en: 'What is your Arabic level?' },
  notSure:          { ar: 'لا أعرف',                              en: "I'm not sure" },
  attendance:       { ar: 'كم مرة حضرت دروس البرنامج عبر Teams؟', en: "How often did you attend the program's lessons on Teams?" },
  ratingHint:       { ar: 'اختر إجابة واحدة لكل عبارة.',          en: 'Choose one answer for each statement.' },
  difficulties:     { ar: 'ما الصعوبات التي واجهتك؟ يمكنك اختيار أكثر من إجابة.', en: 'What difficulties did you have? You may choose more than one answer.' },
  otherText:        { ar: 'اكتب الصعوبة الأخرى (اختياري)',        en: 'Describe the other difficulty (optional)' },
  likedMost:        { ar: 'ما أكثر شيء أعجبك في البرنامج؟',       en: 'What did you like most about the program?' },
  suggestion:       { ar: 'ما اقتراحك لتحسين البرنامج؟',          en: 'What is one suggestion you have to improve the program?' },
  choose:           { ar: '- اختر -',                             en: '- Select -' },
  submit:           { ar: 'إرسال الإجابات',                        en: 'Submit answers' },
  submitting:       { ar: 'جارٍ الإرسال…',                         en: 'Submitting…' },
  required:         { ar: 'الحقول المعلَّمة (*) مطلوبة.',          en: 'Fields marked (*) are required.' },
  fixErrors:        { ar: 'يرجى إكمال ما يلي:',                    en: 'Please complete the following:' },
  thanksTitle:      { ar: 'شكرًا لك!',                             en: 'Thank you!' },
  thanksBody:       { ar: 'تم استلام إجاباتك. رأيك يساعدنا على تحسين البرنامج.', en: 'Your answers have been received. Your opinion helps us improve the program.' },
  noGroups:         { ar: 'لا توجد مجموعات مسجلة لهذا الاختيار. تواصل مع إدارة البرنامج.', en: 'No groups are registered for this selection. Please contact the program office.' },
  langToggle:       { ar: 'English first',                        en: 'العربية أولًا' },
  loading:          { ar: 'جارٍ تحميل الاستطلاع…',                 en: 'Loading the survey…' },
  errorLoad:        { ar: 'تعذر تحميل البيانات. حاول مرة أخرى.',   en: 'Could not load data. Please try again.' },
  anonymous:        { ar: 'هذا الاستطلاع مجهول الهوية ولا يحفظ أي بيانات شخصية.', en: 'This survey is anonymous and does not store any personal data.' },
};

/* ----------------------------------------------------------------------------
 * Small formatting helpers
 * ------------------------------------------------------------------------- */
export function t(bi: Bi | undefined, lang: Lang): string {
  if (!bi) return '';
  return lang === 'ar' ? bi.ar : bi.en;
}

/** "16:00:00" → "16:00" ; tolerant to "16:00" */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const m = String(time).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(time);
}

export function dayLabel(day: number, lang: Lang): string {
  const d = DAYS.find(x => x.v === day);
  return d ? (lang === 'ar' ? d.ar : d.en) : String(day);
}

/** Today's date (YYYY-MM-DD) in the Asia/Riyadh time zone. */
export function todayRiyadh(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Format an ISO timestamp for display in Asia/Riyadh. */
export function formatRiyadh(iso: string | null | undefined, lang: Lang = 'ar'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    timeZone: RIYADH_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export function levelLabel(level: Level | undefined | null, lang: Lang): string {
  if (!level) return '';
  const name = lang === 'ar' ? level.name_ar : level.name_en;
  return name && name !== level.code ? `${level.code} – ${name}` : level.code;
}

export function scheduleLabel(s: Schedule | undefined | null, lang: Lang): string {
  if (!s) return '';
  return `${dayLabel(s.day_of_week, lang)} ${formatTime(s.start_time)}–${formatTime(s.end_time)}`;
}

/**
 * A human-readable, *distinguishing* label for a group:
 * "G-2 · B1 · Dr. Yasser"  (+ section name if present)
 */
export function classroomLabel(
  c: Classroom, ctx: { trainers: Trainer[]; levels: Level[] }, lang: Lang,
): string {
  const trainer = ctx.trainers.find(x => x.id === c.trainer_id);
  const level = ctx.levels.find(x => x.id === c.level_id);
  const parts = [
    c.section_name ? `${c.code} (${c.section_name})` : c.code,
    level ? level.code : (c.level || ''),
    trainer ? trainer.name : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

/* ----------------------------------------------------------------------------
 * Cascading filters (program → level → trainer → group → schedule)
 * ------------------------------------------------------------------------- */
export function remotePrograms(programs: Program[]): Program[] {
  const remote = programs.filter(p => p.delivery_mode === 'remote');
  return remote.length ? remote : programs;
}

export function levelsForProgram(levels: Level[], programId: string | null | undefined): Level[] {
  return levels
    .filter(l => l.is_active !== false)
    .filter(l => l.program_id === null || l.program_id === undefined || !programId || l.program_id === programId)
    .sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code));
}

export function classroomsFor(
  classrooms: Classroom[],
  f: { programId?: string; levelId?: string; trainerId?: string },
): Classroom[] {
  return classrooms.filter(c =>
    (!f.programId || c.program_id === f.programId) &&
    (!f.levelId || c.level_id === f.levelId) &&
    (!f.trainerId || c.trainer_id === f.trainerId),
  );
}

/** Trainers that actually have at least one group matching the filters. */
export function trainersFor(
  trainers: Trainer[], classrooms: Classroom[],
  f: { programId?: string; levelId?: string },
): Trainer[] {
  const ids = new Set(classroomsFor(classrooms, f).map(c => c.trainer_id).filter(Boolean));
  return trainers.filter(t => ids.has(t.id)).sort((a, b) => a.name.localeCompare(b.name));
}

export function schedulesFor(schedules: Schedule[], classroomId: string | undefined): Schedule[] {
  if (!classroomId) return [];
  return schedules
    .filter(s => s.classroom_id === classroomId && s.is_active !== false)
    .sort((a, b) => (a.day_of_week - b.day_of_week) || a.start_time.localeCompare(b.start_time));
}

/* ----------------------------------------------------------------------------
 * Draft → validation → payload
 * ------------------------------------------------------------------------- */
export type Draft = {
  programId: string;
  levelId: string;
  trainerId: string;
  classroomId: string;
  scheduleId: string;
  lectureDate: string;           // '' or YYYY-MM-DD
  selfLevelId: string;           // level id or 'unknown' or ''
  attendance: AttendanceCode | '';
  ratings: Record<string, ScaleCode | ''>;
  difficulties: DifficultyCode[];
  difficultyOther: string;
  likedMost: string;
  suggestion: string;
};

export function emptyDraft(): Draft {
  return {
    programId: '', levelId: '', trainerId: '', classroomId: '', scheduleId: '', lectureDate: '',
    selfLevelId: '', attendance: '', ratings: {}, difficulties: [], difficultyOther: '',
    likedMost: '', suggestion: '',
  };
}

export type ValidationError = { field: string; ar: string; en: string };

export function validateDraft(
  d: Draft,
  ctx: { schedules: Schedule[]; requireSchedule?: boolean },
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!d.programId)   errors.push({ field: 'programId',   ar: 'اختر البرنامج',            en: 'Select the program' });
  if (!d.levelId)     errors.push({ field: 'levelId',     ar: 'اختر المستوى',             en: 'Select the level' });
  if (!d.trainerId)   errors.push({ field: 'trainerId',   ar: 'اختر المدرب/المدربة',      en: 'Select the trainer' });
  if (!d.classroomId) errors.push({ field: 'classroomId', ar: 'اختر المجموعة/الشعبة',     en: 'Select the class group' });

  const available = schedulesFor(ctx.schedules, d.classroomId);
  const mustPickSchedule = ctx.requireSchedule ?? available.length > 0;
  if (mustPickSchedule && !d.scheduleId) {
    errors.push({ field: 'scheduleId', ar: 'اختر موعد المحاضرة', en: 'Select the class schedule' });
  }
  if (d.scheduleId && available.length && !available.some(s => s.id === d.scheduleId)) {
    errors.push({ field: 'scheduleId', ar: 'الموعد لا يخص هذه المجموعة', en: 'The schedule does not belong to this group' });
  }
  if (d.lectureDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.lectureDate)) {
    errors.push({ field: 'lectureDate', ar: 'تاريخ غير صحيح', en: 'Invalid date' });
  }

  if (!d.selfLevelId) errors.push({ field: 'selfLevelId', ar: 'أجب عن سؤال: ما مستواك في اللغة العربية؟', en: 'Answer: What is your Arabic level?' });
  if (!d.attendance)  errors.push({ field: 'attendance',  ar: 'أجب عن سؤال الحضور',                          en: 'Answer the attendance question' });

  const missing = STATEMENTS.filter(s => !d.ratings[s.key] || !SCALE_CODES.includes(d.ratings[s.key] as ScaleCode));
  if (missing.length) {
    errors.push({
      field: 'ratings',
      ar: `أجب عن كل عبارات التقييم (متبقٍ ${missing.length})`,
      en: `Answer all rating statements (${missing.length} remaining)`,
    });
  }

  if (!d.difficulties.length) errors.push({ field: 'difficulties', ar: 'اختر صعوبة واحدة على الأقل أو «لم أواجه صعوبات»', en: 'Choose at least one difficulty or "I did not have any difficulties"' });
  if (d.difficulties.includes('none') && d.difficulties.length > 1) {
    errors.push({ field: 'difficulties', ar: 'لا يمكن اختيار «لم أواجه صعوبات» مع صعوبات أخرى', en: '"I did not have any difficulties" cannot be combined with other difficulties' });
  }
  return errors;
}

/** Toggle a difficulty, keeping "none" mutually exclusive. */
export function toggleDifficulty(current: DifficultyCode[], code: DifficultyCode): DifficultyCode[] {
  if (current.includes(code)) return current.filter(c => c !== code);
  if (code === 'none') return ['none'];
  return [...current.filter(c => c !== 'none'), code];
}

export type ResponseInsert = {
  survey_version: number;
  program_id: string;
  level_id: string | null;
  trainer_id: string | null;
  classroom_id: string | null;
  schedule_id: string | null;
  lecture_date: string | null;
  program_name_snapshot: string | null;
  level_code_snapshot: string | null;
  trainer_name_snapshot: string | null;
  classroom_code_snapshot: string | null;
  schedule_snapshot: { day_of_week: number; start_time: string; end_time: string } | null;
  self_level_id: string | null;
  self_level_unknown: boolean;
  attendance: AttendanceCode;
  ratings: Record<string, ScaleCode>;
  difficulties: DifficultyCode[];
  difficulty_other: string | null;
  liked_most: string | null;
  suggestion: string | null;
  ui_language: Lang;
};

export function buildPayload(
  d: Draft,
  ctx: { programs: Program[]; levels: Level[]; trainers: Trainer[]; classrooms: Classroom[]; schedules: Schedule[]; lang: Lang },
): ResponseInsert {
  const program = ctx.programs.find(p => p.id === d.programId);
  const level = ctx.levels.find(l => l.id === d.levelId);
  const trainer = ctx.trainers.find(x => x.id === d.trainerId);
  const classroom = ctx.classrooms.find(c => c.id === d.classroomId);
  const schedule = ctx.schedules.find(s => s.id === d.scheduleId);
  const clean = (s: string) => { const v = (s || '').trim(); return v ? v.slice(0, 2000) : null; };
  const ratings: Record<string, ScaleCode> = {};
  for (const s of STATEMENTS) { const v = d.ratings[s.key]; if (v) ratings[s.key] = v as ScaleCode; }

  return {
    survey_version: SURVEY_VERSION,
    program_id: d.programId,
    level_id: d.levelId || null,
    trainer_id: d.trainerId || null,
    classroom_id: d.classroomId || null,
    schedule_id: d.scheduleId || null,
    lecture_date: d.lectureDate || null,
    program_name_snapshot: program?.name_ar || null,
    level_code_snapshot: level?.code || null,
    trainer_name_snapshot: trainer?.name || null,
    classroom_code_snapshot: classroom?.code || null,
    schedule_snapshot: schedule ? { day_of_week: schedule.day_of_week, start_time: schedule.start_time, end_time: schedule.end_time } : null,
    self_level_id: d.selfLevelId && d.selfLevelId !== 'unknown' ? d.selfLevelId : null,
    self_level_unknown: d.selfLevelId === 'unknown',
    attendance: d.attendance as AttendanceCode,
    ratings,
    difficulties: d.difficulties,
    difficulty_other: d.difficulties.includes('other') ? clean(d.difficultyOther) : null,
    liked_most: clean(d.likedMost),
    suggestion: clean(d.suggestion),
    ui_language: ctx.lang,
  };
}

/* ----------------------------------------------------------------------------
 * Reporting
 * ------------------------------------------------------------------------- */
export type ResponseRow = {
  id: string;
  program_id: string;
  level_id: string | null;
  trainer_id: string | null;
  classroom_id: string | null;
  schedule_id: string | null;
  lecture_date: string | null;
  program_name_snapshot?: string | null;
  level_code_snapshot?: string | null;
  trainer_name_snapshot?: string | null;
  classroom_code_snapshot?: string | null;
  schedule_snapshot?: { day_of_week: number; start_time: string; end_time: string } | null;
  self_level_id: string | null;
  self_level_unknown: boolean;
  attendance: AttendanceCode;
  ratings: Record<string, ScaleCode>;
  difficulties: DifficultyCode[];
  difficulty_other: string | null;
  liked_most: string | null;
  suggestion: string | null;
  ui_language?: Lang;
  submitted_at: string;
};

export type ReportFilters = {
  programId?: string;
  levelId?: string;
  trainerId?: string;
  classroomId?: string;
  dayOfWeek?: number | '';
  scheduleId?: string;
  dateFrom?: string;   // on lecture_date, falling back to submitted_at (Riyadh)
  dateTo?: string;
};

function responseDate(r: ResponseRow): string {
  return r.lecture_date || todayRiyadh(new Date(r.submitted_at));
}

function responseDay(r: ResponseRow, schedules: Schedule[]): number | null {
  const s = r.schedule_id ? schedules.find(x => x.id === r.schedule_id) : undefined;
  if (s) return s.day_of_week;
  if (r.schedule_snapshot) return r.schedule_snapshot.day_of_week;
  return null;
}

export function applyFilters(rows: ResponseRow[], f: ReportFilters, schedules: Schedule[]): ResponseRow[] {
  return rows.filter(r => {
    if (f.programId && r.program_id !== f.programId) return false;
    if (f.levelId && r.level_id !== f.levelId) return false;
    if (f.trainerId && r.trainer_id !== f.trainerId) return false;
    if (f.classroomId && r.classroom_id !== f.classroomId) return false;
    if (f.scheduleId && r.schedule_id !== f.scheduleId) return false;
    if (f.dayOfWeek !== undefined && f.dayOfWeek !== '' && responseDay(r, schedules) !== Number(f.dayOfWeek)) return false;
    const d = responseDate(r);
    if (f.dateFrom && d < f.dateFrom) return false;
    if (f.dateTo && d > f.dateTo) return false;
    return true;
  });
}

export type StatementStat = {
  key: string; n: number; avg: number | null; agreePct: number | null; naCount: number;
  dist: Record<ScaleCode, number>;
};

export function statementStats(rows: ResponseRow[], key: string): StatementStat {
  const dist: Record<ScaleCode, number> = { SA: 0, A: 0, N: 0, D: 0, SD: 0, NA: 0 };
  let sum = 0, n = 0, agree = 0;
  for (const r of rows) {
    const code = r.ratings?.[key];
    if (!code || !(code in dist)) continue;
    dist[code] += 1;
    const v = SCALE.find(s => s.code === code)?.value;
    if (v == null) continue;
    n += 1; sum += v;
    if (code === 'SA' || code === 'A') agree += 1;
  }
  return {
    key, n, naCount: dist.NA,
    avg: n ? Math.round((sum / n) * 100) / 100 : null,
    agreePct: n ? Math.round((agree / n) * 1000) / 10 : null,
    dist,
  };
}

export type Summary = {
  count: number;
  overallAvg: number | null;
  overallAgreePct: number | null;
  satisfactionAgreePct: number | null;
  statements: StatementStat[];
  attendance: Record<AttendanceCode, number>;
  difficulties: Record<DifficultyCode, number>;
  selfLevels: Record<string, number>;   // level id or 'unknown'
};

export function summarize(rows: ResponseRow[]): Summary {
  const statements = STATEMENTS.map(s => statementStats(rows, s.key));
  const withAvg = statements.filter(s => s.avg != null);
  const totalN = withAvg.reduce((a, s) => a + s.n, 0);
  const weightedSum = withAvg.reduce((a, s) => a + (s.avg as number) * s.n, 0);
  const agreeN = withAvg.reduce((a, s) => a + ((s.agreePct as number) / 100) * s.n, 0);

  const attendance: Record<AttendanceCode, number> = { almost_all: 0, most: 0, some: 0, few: 0 };
  const difficulties = Object.fromEntries(DIFFICULTIES.map(d => [d.code, 0])) as Record<DifficultyCode, number>;
  const selfLevels: Record<string, number> = {};
  for (const r of rows) {
    if (r.attendance in attendance) attendance[r.attendance] += 1;
    for (const d of r.difficulties || []) if (d in difficulties) difficulties[d as DifficultyCode] += 1;
    const k = r.self_level_unknown ? 'unknown' : (r.self_level_id || '');
    if (k) selfLevels[k] = (selfLevels[k] || 0) + 1;
  }
  const sat = statements.find(s => s.key === SATISFACTION_KEY);
  return {
    count: rows.length,
    overallAvg: totalN ? Math.round((weightedSum / totalN) * 100) / 100 : null,
    overallAgreePct: totalN ? Math.round((agreeN / totalN) * 1000) / 10 : null,
    satisfactionAgreePct: sat?.agreePct ?? null,
    statements, attendance, difficulties, selfLevels,
  };
}

/**
 * Group key = classroom + schedule. Two groups that meet at the same time are
 * *never* merged because the classroom/schedule ids differ.
 */
export function groupKey(r: ResponseRow): string {
  return `${r.classroom_id || 'none'}|${r.schedule_id || 'none'}`;
}

export type GroupRow = {
  key: string;
  classroom_id: string | null;
  schedule_id: string | null;
  label: string;
  n: number;
  avg: number | null;
  agreePct: number | null;
  satisfactionAgreePct: number | null;
};

export function compareGroups(
  rows: ResponseRow[],
  ctx: { classrooms: Classroom[]; trainers: Trainer[]; levels: Level[]; schedules: Schedule[]; lang: Lang },
): GroupRow[] {
  const buckets = new Map<string, ResponseRow[]>();
  for (const r of rows) {
    const k = groupKey(r);
    if (!buckets.has(k)) buckets.set(k, []);
    (buckets.get(k) as ResponseRow[]).push(r);
  }
  const out: GroupRow[] = [];
  for (const [key, list] of buckets) {
    const first = list[0];
    const c = ctx.classrooms.find(x => x.id === first.classroom_id);
    const s = ctx.schedules.find(x => x.id === first.schedule_id);
    const labelParts = [
      c ? classroomLabel(c, ctx, ctx.lang)
        : [first.classroom_code_snapshot, first.level_code_snapshot, first.trainer_name_snapshot].filter(Boolean).join(' · '),
      s ? scheduleLabel(s, ctx.lang)
        : first.schedule_snapshot ? scheduleLabel({ id: '', classroom_id: '', ...first.schedule_snapshot }, ctx.lang) : '',
    ].filter(Boolean);
    const sum = summarize(list);
    out.push({
      key, classroom_id: first.classroom_id, schedule_id: first.schedule_id,
      label: labelParts.join(' — ') || (ctx.lang === 'ar' ? 'غير محدد' : 'Unspecified'),
      n: list.length, avg: sum.overallAvg, agreePct: sum.overallAgreePct, satisfactionAgreePct: sum.satisfactionAgreePct,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/* ----------------------------------------------------------------------------
 * CSV export
 * ------------------------------------------------------------------------- */
export function responsesToCsvRows(
  rows: ResponseRow[],
  ctx: { programs: Program[]; levels: Level[]; trainers: Trainer[]; classrooms: Classroom[]; schedules: Schedule[]; lang: Lang },
): string[][] {
  const L = ctx.lang;
  const header = [
    L === 'ar' ? 'المعرف' : 'ID',
    L === 'ar' ? 'وقت الإرسال (الرياض)' : 'Submitted (Riyadh)',
    L === 'ar' ? 'البرنامج' : 'Program',
    L === 'ar' ? 'المستوى' : 'Level',
    L === 'ar' ? 'المدرب' : 'Trainer',
    L === 'ar' ? 'المجموعة' : 'Group',
    L === 'ar' ? 'اليوم' : 'Day',
    L === 'ar' ? 'من' : 'Start',
    L === 'ar' ? 'إلى' : 'End',
    L === 'ar' ? 'تاريخ المحاضرة' : 'Class date',
    L === 'ar' ? 'المستوى (رأي الطالب)' : 'Self-reported level',
    L === 'ar' ? 'الحضور' : 'Attendance',
    ...STATEMENTS.map(s => (L === 'ar' ? s.ar : s.en)),
    L === 'ar' ? 'الصعوبات' : 'Difficulties',
    L === 'ar' ? 'صعوبة أخرى' : 'Other difficulty',
    L === 'ar' ? 'أكثر ما أعجبه' : 'Liked most',
    L === 'ar' ? 'اقتراح' : 'Suggestion',
    'classroom_id', 'schedule_id', 'trainer_id', 'level_id', 'program_id',
  ];
  const body = rows.map(r => {
    const program = ctx.programs.find(p => p.id === r.program_id);
    const level = ctx.levels.find(l => l.id === r.level_id);
    const trainer = ctx.trainers.find(x => x.id === r.trainer_id);
    const classroom = ctx.classrooms.find(c => c.id === r.classroom_id);
    const schedule = ctx.schedules.find(s => s.id === r.schedule_id) || (r.schedule_snapshot ? { id: '', classroom_id: '', ...r.schedule_snapshot } : undefined);
    const selfLevel = r.self_level_unknown ? t(UI.notSure, L) : (ctx.levels.find(l => l.id === r.self_level_id)?.code || '');
    const att = ATTENDANCE.find(a => a.code === r.attendance);
    return [
      r.id,
      formatRiyadh(r.submitted_at, L),
      program ? (L === 'ar' ? program.name_ar : (program.name_en || program.name_ar)) : (r.program_name_snapshot || ''),
      level ? level.code : (r.level_code_snapshot || ''),
      trainer ? trainer.name : (r.trainer_name_snapshot || ''),
      classroom ? classroom.code : (r.classroom_code_snapshot || ''),
      schedule ? dayLabel(schedule.day_of_week, L) : '',
      schedule ? formatTime(schedule.start_time) : '',
      schedule ? formatTime(schedule.end_time) : '',
      r.lecture_date || '',
      selfLevel,
      att ? (L === 'ar' ? att.ar : att.en) : r.attendance,
      ...STATEMENTS.map(s => {
        const code = r.ratings?.[s.key];
        const sc = SCALE.find(x => x.code === code);
        return sc ? (L === 'ar' ? sc.ar : sc.en) : '';
      }),
      (r.difficulties || []).map(d => { const x = DIFFICULTIES.find(y => y.code === d); return x ? (L === 'ar' ? x.ar : x.en) : d; }).join(' | '),
      r.difficulty_other || '',
      r.liked_most || '',
      r.suggestion || '',
      r.classroom_id || '', r.schedule_id || '', r.trainer_id || '', r.level_id || '', r.program_id,
    ];
  });
  return [header, ...body];
}

export function summaryToCsvRows(summary: Summary, lang: Lang): string[][] {
  const L = lang;
  const rows: string[][] = [[
    L === 'ar' ? 'العبارة' : 'Statement',
    L === 'ar' ? 'عدد الإجابات' : 'Responses',
    L === 'ar' ? 'المتوسط (1-5)' : 'Average (1-5)',
    L === 'ar' ? 'نسبة الموافقة %' : 'Agree %',
    ...SCALE.map(s => (L === 'ar' ? s.ar : s.en)),
  ]];
  for (const st of summary.statements) {
    const def = STATEMENTS.find(s => s.key === st.key);
    rows.push([
      def ? (L === 'ar' ? def.ar : def.en) : st.key,
      String(st.n),
      st.avg == null ? '' : String(st.avg),
      st.agreePct == null ? '' : String(st.agreePct),
      ...SCALE.map(s => String(st.dist[s.code])),
    ]);
  }
  return rows;
}
