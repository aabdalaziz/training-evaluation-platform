// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 «محور التقارير» — توثيق الجودة والأداء (دوال صافية، بلا اعتماديات) — ر1: تقرير التعلّم الأسبوعي · ر2: الختامي · ر3: تقرير إنجاز المهمة (آخر الملف) · ر3-ب: التقرير الاستشاري (رأي استشاري · دراسة) — آخر الملف
 *  التقرير يملأ أرقامه من قاعدة أَثَر (computed) ويكتب الإنسان الحكم والتوصية (body · students).
 *  القالب: الأقسام الثمانية لنموذج «تقرير التعلّم الشامل» (برنامج العربية للناطقين بغيرها) — مهاراته الخمس للعربية،
 *  ومهارات البرنامج (إطار P8) أو أربع عامة لغيره. مفتاح التقدير ثابت: ممتاز 90–100 · جيد جدًا 80–89 · جيد 70–79 · مقبول 60–69 · ضعيف < 60.
 *  لماذا «تقرير التعلّم»: موضوعه تعلّم الطلاب لا نشاط المعلّم. الاعتماد بيد إنسان، والذكاء الاصطناعي يصوغ جمل الأرقام ولا يحكم.
 */

export const P46_NAMES_AR = {
  axis: 'محور التقارير', official: 'توثيق الجودة والأداء', weekly: 'تقرير التعلّم الأسبوعي', weekly_full: 'تقرير التعلّم الشامل', final: 'التقرير الختامي لأداء المتدربين',
  mission: 'تقرير إنجاز المهمة', diploma: 'ملف الدبلوم', page: 'تقاريري', admin: 'التقارير', start: 'ابدأ تقرير هذا الأسبوع', line: 'سطر لك من تقرير الأسبوع',
  submit: 'أرسل للاعتماد', approve: 'اعتمد', return: 'أعد بملاحظة', recompute: 'حدّث الأرقام', print: 'اطبع', phrase: 'صِغ لي من الأرقام',
  /* ر2 */ final_story: 'خاتمة الرحلة', final_start: 'ابدأ التقرير الختامي', maturity: 'نضج التقرير', final_line: 'سطر لك من التقرير الختامي', my_page: 'صفحتي في التقرير الختامي',
  promote_btn: 'حوّل التوصيات إلى قرارات تنسيب', sign_quality: 'توقيع الجودة', sign_manager: 'توقيع مدير البرنامج', chain: 'سلسلة الثقة', show_cred: 'أظهِر في شهادتي',
} as const;

export const KINDS = ['weekly', 'final', 'mission', 'diploma_pulse', 'diploma_unit', 'diploma_profile'] as const; export type ReportKind = (typeof KINDS)[number];
export const STATUSES = ['draft', 'submitted', 'approved', 'returned'] as const; export type ReportStatus = (typeof STATUSES)[number];
export const STATUS_AR: Record<ReportStatus, string> = { draft: 'مسودّة', submitted: 'بانتظار الاعتماد', approved: 'معتمَد', returned: 'أُعيد بملاحظة' };
export const TEXT_MAX = 600; export const SHORT_MAX = 160; export const LINE_MAX = 300; export const LINE_MIN = 3; export const NOTE_MAX = 400;
export const MAX_DAYS = 5; export const MAX_ACTIVITIES = 5; export const MAX_TOOLS = 4; export const MAX_LIST = 20; export const MAX_STUDENTS = 60;
export const PASS_MARK = 60; export const REGULAR_PCT = 75;   // منتظم فعليًا = حضور ≥ 75% من جلسات الفترة
export const WEEK_DAYS_AR = ['اليوم الأول', 'اليوم الثاني', 'اليوم الثالث', 'اليوم الرابع', 'اليوم الخامس'];

/** مفتاح التقدير (نموذجك) */
export const GRADES = [
  { code: 'excellent', ar: 'ممتاز', min: 90 }, { code: 'very_good', ar: 'جيد جدًا', min: 80 }, { code: 'good', ar: 'جيد', min: 70 },
  { code: 'pass', ar: 'مقبول', min: 60 }, { code: 'weak', ar: 'ضعيف', min: 0 },
] as const;
export const GRADE_KEY_AR = 'ممتاز (90–100%) · جيد جدًا (80–89%) · جيد (70–79%) · مقبول (60–69%) · ضعيف (أقل من 60%)';
export function gradeOf(avg: number | null): { code: string; ar: string } | null { if (avg === null || !Number.isFinite(avg)) return null; const g = GRADES.find(x => avg >= x.min) || GRADES[GRADES.length - 1]; return { code: g.code, ar: g.ar }; }

/** المهارات الافتراضية حسب نوع البرنامج */
export type Skill = { code: string; name_ar: string };
export const ARABIC_SKILLS: Skill[] = [{ code: 'listening', name_ar: 'استماع' }, { code: 'speaking', name_ar: 'تحدّث' }, { code: 'pronunciation', name_ar: 'نطق' }, { code: 'reading', name_ar: 'قراءة' }, { code: 'writing', name_ar: 'كتابة' }];
export const GENERIC_SKILLS: Skill[] = [{ code: 'knowledge', name_ar: 'المعرفة' }, { code: 'application', name_ar: 'التطبيق' }, { code: 'communication', name_ar: 'التواصل' }, { code: 'commitment', name_ar: 'الالتزام' }];
export const ARABIC_STRATEGIES = ['زيادة زمن تحدّث الطلاب', 'التدرّج السلس', 'التعلّم التعاوني', 'لعب الأدوار والمحاكاة', 'التكرار الموجَّه والصدى الصوتي', 'الوسائل البصرية والسمعية', 'بطاقات المفردات والألعاب اللغوية', 'أنشطة الاستماع القصير'];
export const GENERIC_STRATEGIES = ['التعلّم النشط', 'التعلّم التعاوني', 'دراسة الحالة', 'لعب الأدوار والمحاكاة', 'التغذية الراجعة الفورية', 'الوسائل البصرية والسمعية', 'التطبيق العملي', 'التأمّل الموجَّه'];
export const FIT = ['very', 'ok', 'adjust'] as const; export const FIT_AR: Record<string, string> = { very: 'مناسب جدًا', ok: 'مناسب', adjust: 'يحتاج تعديلًا' };
export const ACHIEVED_AR: Record<string, string> = { full: 'تحقّقت كليًا', partial: 'تحقّقت جزئيًا', none: 'لم تتحقّق' };
export const APPLIED_AR: Record<string, string> = { yes: 'نعم', partial: 'جزئيًا', no: 'لا' };
export const RESPONSE_AR: Record<string, string> = { excellent: 'ممتازة', good: 'جيدة', avg: 'متوسطة', needs: 'تحتاج تعزيزًا' };
export const SUMMATIVE_TOOLS_AR = ['اختبار قصير', 'مهمة أدائية', 'قياس استماع', 'تقييم شفهي'];

/** القالب الفعّال: من صفّ القالب إن وُجد، وإلا الافتراضي حسب نوع البرنامج أو مهارات البرنامج (P8) */
export function effectiveTemplate(p: { program_type?: string | null; template?: { skills?: any; strategies?: any } | null; programSkills?: Skill[] }): { skills: Skill[]; strategies: string[]; source: 'template' | 'arabic' | 'program_skills' | 'generic' } {
  const ts = Array.isArray(p.template?.skills) ? (p.template!.skills as any[]).filter(s => s && s.code && s.name_ar).slice(0, 8) : [];
  const tst = Array.isArray(p.template?.strategies) ? (p.template!.strategies as any[]).map(String).filter(Boolean).slice(0, 12) : [];
  if (ts.length >= 2) return { skills: ts, strategies: tst.length ? tst : (p.program_type === 'arabic' ? ARABIC_STRATEGIES : GENERIC_STRATEGIES), source: 'template' };
  if (p.program_type === 'arabic') return { skills: ARABIC_SKILLS, strategies: tst.length ? tst : ARABIC_STRATEGIES, source: 'arabic' };
  const ps = (p.programSkills || []).slice(0, 6); if (ps.length >= 2) return { skills: ps, strategies: tst.length ? tst : GENERIC_STRATEGIES, source: 'program_skills' };
  return { skills: GENERIC_SKILLS, strategies: tst.length ? tst : GENERIC_STRATEGIES, source: 'generic' };
}

/* ───────── الأنواع ───────── */
export type Computed = {
  program_ar: string; program_type: string; org_ar: string; trainer_ar: string; classroom_ar: string; level_ar: string; delivery_ar: string;
  enrolled: number; regular: number; sessions: number; hours: number; units: string[]; period_from: string; period_to: string; week_no: number;
  attendance: Record<string, { present: number; total: number; pct: number | null }>; computed_at: string; skills: Skill[]; strategies: string[];
};
export type StudentRow = { key: string; name: string; email: string | null; level: string | null; attendance_pct: number | null; scores: Record<string, number | null>; avg: number | null; grade_ar: string | null; note: string };
export type Body = {
  general: { institution: string; level: string; group: string; units: string; notes: string };
  objectives: { days: { goal: string; skill: string; fit: string; note: string }[]; achieved: string };
  activities: { items: { name: string; skill: string; desc: string; teacher_role: string; student_role: string; tools: string }[]; strategies: { name: string; applied: string; how: string; effect: string }[] };
  assessment: { formative: { methods: string; correction: string; common_errors: string; response: string }; summative: { tools: { tool: string; skill: string; desc: string; how: string; pass: string }[] } };
  recommendations: { promote: { key: string; name: string; reason: string; date: string }[]; support: { key: string; name: string; skill: string; need: string; action: string; owner: string }[]; next_week: { focus: string; improve: string; logistics: string }; admin_note: string };
  strengths: { strengths: { point: string; evidence: string }[]; challenges: { point: string; action: string }[] };
  admin: { attendance: string; assignments: string; discipline: string; environment: string; other: string };
};
export const emptyBody = (strategies: string[]): Body => ({
  general: { institution: '', level: '', group: '', units: '', notes: '' },
  objectives: { days: WEEK_DAYS_AR.map(() => ({ goal: '', skill: '', fit: '', note: '' })), achieved: '' },
  activities: { items: [], strategies: strategies.map(name => ({ name, applied: '', how: '', effect: '' })) },
  assessment: { formative: { methods: 'ملاحظة مباشرة · بطاقات ملاحظة · تقييم شفهي سريع أثناء الأنشطة', correction: '', common_errors: '', response: '' }, summative: { tools: [] } },
  recommendations: { promote: [], support: [], next_week: { focus: '', improve: '', logistics: '' }, admin_note: '' },
  strengths: { strengths: [], challenges: [] },
  admin: { attendance: '', assignments: '', discipline: '', environment: '', other: '' },
});

/* ───────── التنظيف ───────── */
const T = (v: unknown, max = TEXT_MAX) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const one = (v: unknown, allowed: readonly string[] | string[]) => (allowed.includes(String(v)) ? String(v) : '');
const arr = <X>(v: unknown, max: number, f: (x: any) => X): X[] => (Array.isArray(v) ? v.slice(0, max).map(f) : []);
const num = (v: unknown): number | null => { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null; };

/** تنظيف ما كتبه الإنسان — يحفظ البنية الكاملة دائمًا (لا يرمي) */
export function cleanBody(b: any, strategies: string[]): Body {
  const e = emptyBody(strategies); const x = b && typeof b === 'object' ? b : {};
  const days = Array.isArray(x.objectives?.days) ? x.objectives.days : [];
  return {
    general: { institution: T(x.general?.institution, SHORT_MAX), level: T(x.general?.level, SHORT_MAX), group: T(x.general?.group, SHORT_MAX), units: T(x.general?.units, TEXT_MAX), notes: T(x.general?.notes, TEXT_MAX) },
    objectives: { days: e.objectives.days.map((d, i) => ({ goal: T(days[i]?.goal, SHORT_MAX * 2), skill: T(days[i]?.skill, 60), fit: one(days[i]?.fit, FIT), note: T(days[i]?.note, SHORT_MAX) })), achieved: one(x.objectives?.achieved, ['full', 'partial', 'none']) },
    activities: {
      items: arr(x.activities?.items, MAX_ACTIVITIES, a => ({ name: T(a?.name, SHORT_MAX), skill: T(a?.skill, 60), desc: T(a?.desc, TEXT_MAX), teacher_role: T(a?.teacher_role, SHORT_MAX), student_role: T(a?.student_role, SHORT_MAX), tools: T(a?.tools, SHORT_MAX) })).filter(a => a.name),
      strategies: (() => { const given = Array.isArray(x.activities?.strategies) ? x.activities.strategies : []; const byName = new Map<string, any>(given.map((s: any) => [T(s?.name, SHORT_MAX), s])); const base = strategies.map(name => { const s = byName.get(name); return { name, applied: one(s?.applied, ['yes', 'partial', 'no']), how: T(s?.how, TEXT_MAX), effect: T(s?.effect, TEXT_MAX) }; }); const extra = given.filter((s: any) => s && !strategies.includes(T(s.name, SHORT_MAX)) && T(s.name, SHORT_MAX)).slice(0, 4).map((s: any) => ({ name: T(s.name, SHORT_MAX), applied: one(s?.applied, ['yes', 'partial', 'no']), how: T(s?.how, TEXT_MAX), effect: T(s?.effect, TEXT_MAX) })); return [...base, ...extra]; })(),
    },
    assessment: {
      formative: { methods: T(x.assessment?.formative?.methods, TEXT_MAX) || e.assessment.formative.methods, correction: T(x.assessment?.formative?.correction, SHORT_MAX), common_errors: T(x.assessment?.formative?.common_errors, TEXT_MAX), response: one(x.assessment?.formative?.response, ['excellent', 'good', 'avg', 'needs']) },
      summative: { tools: arr(x.assessment?.summative?.tools, MAX_TOOLS, t => ({ tool: T(t?.tool, SHORT_MAX), skill: T(t?.skill, 60), desc: T(t?.desc, TEXT_MAX), how: T(t?.how, TEXT_MAX), pass: T(t?.pass, SHORT_MAX) })).filter(t => t.tool) },
    },
    recommendations: {
      promote: arr(x.recommendations?.promote, MAX_LIST, r => ({ key: T(r?.key, 120), name: T(r?.name, SHORT_MAX), reason: T(r?.reason, TEXT_MAX), date: /^\d{4}-\d{2}-\d{2}$/.test(String(r?.date || '')) ? String(r.date) : '' })).filter(r => r.name),
      support: arr(x.recommendations?.support, MAX_LIST, r => ({ key: T(r?.key, 120), name: T(r?.name, SHORT_MAX), skill: T(r?.skill, 60), need: T(r?.need, TEXT_MAX), action: T(r?.action, TEXT_MAX), owner: T(r?.owner, SHORT_MAX) })).filter(r => r.name),
      next_week: { focus: T(x.recommendations?.next_week?.focus, TEXT_MAX), improve: T(x.recommendations?.next_week?.improve, TEXT_MAX), logistics: T(x.recommendations?.next_week?.logistics, TEXT_MAX) },
      admin_note: T(x.recommendations?.admin_note, TEXT_MAX),
    },
    strengths: { strengths: arr(x.strengths?.strengths, 6, s => ({ point: T(s?.point, TEXT_MAX), evidence: T(s?.evidence, TEXT_MAX) })).filter(s => s.point), challenges: arr(x.strengths?.challenges, 6, s => ({ point: T(s?.point, TEXT_MAX), action: T(s?.action, TEXT_MAX) })).filter(s => s.point) },
    admin: { attendance: T(x.admin?.attendance, TEXT_MAX), assignments: T(x.admin?.assignments, TEXT_MAX), discipline: T(x.admin?.discipline, TEXT_MAX), environment: T(x.admin?.environment, TEXT_MAX), other: T(x.admin?.other, TEXT_MAX) },
  };
}

/** تنظيف كشف الطلاب: يُبقي الصفوف المعروفة من الكشف المحسوب (لا يُضاف طالب من المتصفح) ويحسب المتوسط والتقدير */
export function cleanStudents(given: any, roster: StudentRow[], skills: Skill[]): StudentRow[] {
  const byKey = new Map<string, any>((Array.isArray(given) ? given : []).map((s: any) => [String(s?.key || ''), s]));
  return roster.slice(0, MAX_STUDENTS).map(r => {
    const g = byKey.get(r.key) || {}; const scores: Record<string, number | null> = {}; for (const s of skills) scores[s.code] = num(g?.scores?.[s.code]);
    const vals = Object.values(scores).filter((v): v is number => v !== null); const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    return { ...r, scores, avg, grade_ar: gradeOf(avg)?.ar || null, note: T(g?.note, SHORT_MAX) };
  });
}
export function cleanLines(given: any, roster: StudentRow[]): { key: string; email: string; name: string; text: string }[] {
  const byKey = new Map(roster.filter(r => r.email).map(r => [r.key, r]));
  const out = new Map<string, { key: string; email: string; name: string; text: string }>();
  for (const l of (Array.isArray(given) ? given : [])) { const r = byKey.get(String(l?.key || '')); const text = T(l?.text, LINE_MAX); if (r && text.length >= LINE_MIN) out.set(r.key, { key: r.key, email: r.email!, name: r.name, text }); }
  return Array.from(out.values()).slice(0, MAX_STUDENTS);
}

/* ───────── الإحصاء ───────── */
export function summativeStats(students: StudentRow[]): { n: number; avg: number | null; max: number | null; min: number | null; pass_pct: number | null; support_pct: number | null } {
  const vals = students.map(s => s.avg).filter((v): v is number => v !== null); if (!vals.length) return { n: 0, avg: null, max: null, min: null, pass_pct: null, support_pct: null };
  const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10; const pass = vals.filter(v => v >= PASS_MARK).length;
  return { n: vals.length, avg, max: Math.max(...vals), min: Math.min(...vals), pass_pct: Math.round((pass / vals.length) * 100), support_pct: Math.round(((vals.length - pass) / vals.length) * 100) };
}
export function weakestSkill(s: StudentRow, skills: Skill[]): Skill | null { let best: Skill | null = null; let bv = 101; for (const k of skills) { const v = s.scores[k.code]; if (v !== null && v !== undefined && v < bv) { bv = v; best = k; } } return best; }
export function skillAverages(students: StudentRow[], skills: Skill[]): { skill: Skill; avg: number | null }[] {
  return skills.map(skill => { const vals = students.map(s => s.scores[skill.code]).filter((v): v is number => v !== null && v !== undefined); return { skill, avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null }; });
}

/* ───────── الفترة والأسبوع ───────── */
const toDate = (s: string) => new Date(s + 'T00:00:00Z'); const iso = (d: Date) => d.toISOString().slice(0, 10);
/** الأسبوع الدراسي الذي يحوي اليوم (الأحد → الخميس) */
export function weekBounds(day: string): { from: string; to: string } { const d = toDate(day); const dow = d.getUTCDay(); const from = new Date(d); from.setUTCDate(d.getUTCDate() - dow); const to = new Date(from); to.setUTCDate(from.getUTCDate() + 4); return { from: iso(from), to: iso(to) }; }
/** رقم الأسبوع من بداية البرنامج (1 إن لم تُعرف) */
export function weekNo(programStart: string | null | undefined, from: string): number { if (!programStart) return 1; const a = toDate(programStart).getTime(); const b = toDate(from).getTime(); if (!Number.isFinite(a) || b < a) return 1; return Math.floor((b - a) / (7 * 86400000)) + 1; }
export function validPeriod(from: unknown, to: unknown): { ok: true; from: string; to: string } | { ok: false; error: string } {
  const f = String(from || ''); const t = String(to || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false, error: 'حدّد الفترة (من · إلى)' };
  const d = (toDate(t).getTime() - toDate(f).getTime()) / 86400000; if (d < 0 || d > 31) return { ok: false, error: 'الفترة من يوم إلى شهر على الأكثر' }; return { ok: true, from: f, to: t };
}
export const fmtDayAr = (s?: string | null) => (s ? new Date(s + (s.length === 10 ? 'T00:00:00Z' : '')).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

/* ───────── الحضور والانتظام ───────── */
export type AttSession = { id: string; session_date: string; start_time?: string | null; end_time?: string | null; title?: string | null; classroom_id?: string | null };
export type AttRecord = { session_id: string; email?: string | null; full_name?: string | null; identity_key?: string | null; status: string };
export const rosterKey = (email?: string | null, name?: string | null) => (email ? 'e:' + String(email).trim().toLowerCase() : 'n:' + String(name || '').replace(/\s+/g, ' ').trim());
export function hoursOf(s: AttSession): number { if (!s.start_time || !s.end_time) return 0; const [h1, m1] = String(s.start_time).split(':').map(Number); const [h2, m2] = String(s.end_time).split(':').map(Number); const d = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0)); return d > 0 ? Math.round((d / 60) * 10) / 10 : 0; }
/** بناء الكشف: المسجَّلون المقبولون ∪ من حضر فعلًا في الفترة؛ الحضور = حاضر/متأخّر ÷ جلسات الفترة */
export function buildRoster(enrolled: { full_name?: string | null; email?: string | null; placement_level?: string | null }[], sessions: AttSession[], records: AttRecord[]): { roster: StudentRow[]; attendance: Computed['attendance']; regular: number } {
  const sids = new Set(sessions.map(s => s.id)); const map = new Map<string, StudentRow>();
  for (const e of enrolled) { const key = rosterKey(e.email, e.full_name); if (!map.has(key)) map.set(key, { key, name: String(e.full_name || e.email || '').trim(), email: e.email ? String(e.email).toLowerCase() : null, level: e.placement_level || null, attendance_pct: null, scores: {}, avg: null, grade_ar: null, note: '' }); }
  const present = new Map<string, Set<string>>();
  for (const r of records) { if (!sids.has(r.session_id)) continue; const key = rosterKey(r.email, r.full_name); if (!map.has(key)) map.set(key, { key, name: String(r.full_name || r.email || '').trim(), email: r.email ? String(r.email).toLowerCase() : null, level: null, attendance_pct: null, scores: {}, avg: null, grade_ar: null, note: '' }); if (['present', 'late'].includes(r.status)) { if (!present.has(key)) present.set(key, new Set()); present.get(key)!.add(r.session_id); } }
  const total = sessions.length; const attendance: Computed['attendance'] = {}; let regular = 0;
  const roster = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar')).map(s => { const p = present.get(s.key)?.size || 0; const pct = total ? Math.round((p / total) * 100) : null; attendance[s.key] = { present: p, total, pct }; if (pct === null || pct >= REGULAR_PCT) regular++; return { ...s, attendance_pct: pct }; });
  return { roster, attendance, regular };
}

/* ───────── الصلاحيات والحالات ───────── */
export type Who = { id?: string | null; email?: string; staff?: boolean };
export const isAuthor = (r: { author_id?: string | null; author_email: string }, me: Who) => (!!me.id && r.author_id === me.id) || (!!me.email && r.author_email.toLowerCase() === me.email.toLowerCase());
export function canEdit(r: { status: string; author_id?: string | null; author_email: string }, me: Who): boolean { return ['draft', 'returned'].includes(r.status) && isAuthor(r, me); }
export function canSubmit(r: { status: string; author_id?: string | null; author_email: string }, me: Who): boolean { return canEdit(r, me); }
export function canDecide(r: { status: string }, me: Who): boolean { return r.status === 'submitted' && !!me.staff; }
export function canView(r: { author_id?: string | null; author_email: string }, me: Who): boolean { return isAuthor(r, me) || !!me.staff; }
/** ما ينقص قبل الإرسال — رسائل بالعربية (لا يمنع الحفظ، يمنع الإرسال) */
export function missingBeforeSubmit(body: Body, students: StudentRow[]): string[] {
  const m: string[] = [];
  if (!body.objectives.days.some(d => d.goal)) m.push('هدف يومي واحد على الأقل (القسم الثاني)');
  if (!body.objectives.achieved) m.push('مدى تحقّق الأهداف (القسم الثاني)');
  if (!body.activities.items.length) m.push('نشاط واحد على الأقل (القسم الثالث)');
  if (!body.assessment.formative.response) m.push('مدى استجابة الطلاب للتصويب (القسم الرابع)');
  if (!students.some(s => s.avg !== null)) m.push('درجة واحدة على الأقل في كشف الطلاب (القسم الخامس)');
  if (!body.recommendations.next_week.focus) m.push('أبرز ما سيُركَّز عليه الأسبوع القادم (القسم السادس)');
  return m;
}

/* ───────── «صِغ لي من الأرقام» — البديل المحلي (الذكاء الاصطناعي يصوغ ولا يحكم: لا تقديرات ولا توصيات) ───────── */
export type Phrase = { section: 'strengths' | 'challenges' | 'admin_attendance' | 'common_errors' | 'general_notes'; text: string };
export function localPhrases(c: Pick<Computed, 'enrolled' | 'regular' | 'sessions' | 'hours' | 'week_no'>, students: StudentRow[], skills: Skill[]): Phrase[] {
  const out: Phrase[] = []; const st = summativeStats(students); const sa = skillAverages(students, skills).filter(x => x.avg !== null);
  if (c.sessions) out.push({ section: 'admin_attendance', text: `نُفِّذت ${c.sessions} جلسات (${c.hours} ساعة) في هذا الأسبوع، وانتظم ${c.regular} من ${c.enrolled} متدرّبًا بنسبة حضور ${REGULAR_PCT}% فأكثر.` });
  if (sa.length) { const hi = [...sa].sort((a, b) => (b.avg! - a.avg!))[0]; const lo = [...sa].sort((a, b) => (a.avg! - b.avg!))[0]; if (hi && hi.avg! >= 70) out.push({ section: 'strengths', text: `أعلى متوسط للمجموعة في مهارة ${hi.skill.name_ar} (${hi.avg}%).` }); if (lo && hi && lo.skill.code !== hi.skill.code) out.push({ section: 'challenges', text: `أدنى متوسط للمجموعة في مهارة ${lo.skill.name_ar} (${lo.avg}%) — تستحق وقتًا أطول الأسبوع القادم.` }); }
  if (st.n) out.push({ section: 'general_notes', text: `رُصدت درجات ${st.n} متدرّبًا: المتوسط ${st.avg}% (أعلى ${st.max}% · أدنى ${st.min}%)، ونسبة من بلغ حدّ النجاح ${st.pass_pct}%.` });
  const low = students.filter(s => s.attendance_pct !== null && s.attendance_pct < REGULAR_PCT).length; if (low) out.push({ section: 'admin_attendance', text: `${low} من المتدرّبين دون حدّ الانتظام هذا الأسبوع — يُستحسن التواصل معهم قبل الأسبوع القادم.` });
  return out.slice(0, 6);
}
export function parsePhrases(raw: string): Phrase[] | null {
  try { const m = raw.match(/\[[\s\S]*\]/); const j = JSON.parse(m ? m[0] : raw); if (!Array.isArray(j)) return null; const ok = ['strengths', 'challenges', 'admin_attendance', 'common_errors', 'general_notes']; const out = j.map((x: any) => ({ section: ok.includes(String(x?.section)) ? String(x.section) : 'general_notes', text: T(x?.text, 240) })).filter((x: any) => x.text.length >= 10 && !/توصي|أوصي|ينقل|يُنقل|تقدير|ممتاز|ضعيف/.test(x.text)); return out.length ? (out.slice(0, 6) as Phrase[]) : null; } catch { return null; }
}
export function phrasePrompt(c: Computed, students: StudentRow[], skills: Skill[]): { system: string; user: string } {
  const st = summativeStats(students); const sa = skillAverages(students, skills);
  return {
    system: 'أنت كاتب تقارير تعليمية بالعربية الفصحى. تصوغ جُملًا وصفية قصيرة من أرقام معطاة فقط. ممنوع: اقتراح تقدير لطالب، أو توصية نقل/رسوب، أو ذكر اسم طالب، أو أي رقم غير معطى. أعد JSON فقط: مصفوفة من {"section": strengths|challenges|admin_attendance|common_errors|general_notes, "text": "…"} بحدّ أقصى 6 عناصر، كل جملة ≤ 200 حرف.',
    user: JSON.stringify({ week_no: c.week_no, enrolled: c.enrolled, regular: c.regular, sessions: c.sessions, hours: c.hours, regular_threshold_pct: REGULAR_PCT, group_stats: st, skill_averages: sa.map(x => ({ skill: x.skill.name_ar, avg: x.avg })), low_attendance_count: students.filter(s => s.attendance_pct !== null && s.attendance_pct < REGULAR_PCT).length }),
  };
}

/* ───────── رمز التحقّق والعرض ───────── */
export const VERIFY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function verifyCode(rnd: () => number = Math.random): string { let s = 'R'; for (let i = 0; i < 9; i++) s += VERIFY_ALPHABET[Math.floor(rnd() * VERIFY_ALPHABET.length)]; return s; }
/** ما يُعرض للعامة عند التحقّق: لا أسماء طلاب ولا درجات */
export function publicVerifyView(r: { verify_code: string | null; status: string; week_no: number; period_from: string; period_to: string; author_name: string; approved_name: string | null; approved_at: string | null; computed: any; kind: string }): any {
  if (r.status !== 'approved' || !r.verify_code) return null;
  if (r.kind === 'diploma_unit') return unitPublicView(r as any);   // ر4
  if (r.kind === 'diploma_profile') return profilePublicView(r as any);   // ر4-ب
  return { code: r.verify_code, kind: r.kind, kind_ar: r.kind === 'weekly' ? P46_NAMES_AR.weekly : r.kind === 'final' ? P46_NAMES_AR.final : r.kind, week_no: r.week_no, weeks: Array.isArray(r.computed?.weeks) ? r.computed.weeks.length : 0, chain: Array.isArray(r.computed?.weeks) ? (r.computed.weeks as any[]).map(w => String(w.verify_code || '')).filter(Boolean) : [], signoff: r.kind === 'final' ? signoffView((r as any).body) : null, period_from: r.period_from, period_to: r.period_to, program_ar: String(r.computed?.program_ar || ''), org_ar: String(r.computed?.org_ar || ''), classroom_ar: String(r.computed?.classroom_ar || ''), author_name: r.author_name, approved_name: r.approved_name || '', approved_at: r.approved_at, sessions: Number(r.computed?.sessions || 0), hours: Number(r.computed?.hours || 0), enrolled: Number(r.computed?.enrolled || 0) };
}
/** سطر القائمة */
export function listLineAr(r: { week_no: number; period_from: string; period_to: string; computed: any; status: string; kind?: string }): string {
  if (r.kind === 'mission') return missionListLineAr(r);
  if (r.kind === 'advisory' || r.kind === 'study') return docListLineAr(r as any);   // ر3-ب
  if (r.kind === 'diploma_pulse' || r.kind === 'diploma_unit' || r.kind === 'diploma_profile') return diplomaListLineAr(r as any);   // ر4
  if (r.kind === 'final') return `${P46_NAMES_AR.final} · ${String(r.computed?.program_ar || '')}${r.computed?.classroom_ar ? ` · ${r.computed.classroom_ar}` : ''} · ${Array.isArray(r.computed?.weeks) ? r.computed.weeks.length : 0} أسابيع معتمدة · ${STATUS_AR[r.status as ReportStatus] || r.status}`;
  return `الأسبوع ${r.week_no} · ${fmtDayAr(r.period_from)} → ${fmtDayAr(r.period_to)} · ${String(r.computed?.program_ar || '')}${r.computed?.classroom_ar ? ` · ${r.computed.classroom_ar}` : ''} · ${STATUS_AR[r.status as ReportStatus] || r.status}`;
}

/* ═════════════════════════════ ر2 — التقرير الختامي لأداء المتدرّبين («خاتمة الرحلة») ═════════════════════════════
 *  لا يُكتب في الأسبوع الأخير؛ ينمو من الأسبوعيات المعتمدة للشعبة نفسها: مسار كل متدرّب في كل مهارة أسبوعًا بأسبوع،
 *  وعنوانه «الفرق لا الدرجة». المعلّم يُدخل التقييم الختامي ويكتب التوصية، والذكاء الاصطناعي يصوغ فقرة المسار من الأرقام فقط،
 *  ويعتمده توقيعان (الجودة ثم مدير البرنامج). لماذا «خاتمة الرحلة»: الاسم السردي للصفحة الرئيسية وأثير؛ الرسمي في العقود «التقرير الختامي لأداء المتدرّبين».
 */
export const RECS = ['promote', 'continue', 'support', 'repeat'] as const; export type Rec = (typeof RECS)[number];
export const REC_AR: Record<Rec, string> = { promote: 'رفع للمستوى الأعلى', continue: 'استمرار في المستوى', support: 'خطة دعم', repeat: 'إعادة المستوى' };
export const PROMOTE_MIN = 80; export const PROMOTE_ATT = 75; export const SUPPORT_MAX = 60;   // قاعدة الاقتراح الآلي — المعلّم يبدّلها بحرّية
export const FINAL_READY_PCT = 75; export const FINAL_READY_DAYS = 14;                          // متى يُقترح البدء: 75% من مدّة البرنامج أو أسبوعان قبل نهايته
export const SIGNS = ['quality', 'manager'] as const; export type SignAs = (typeof SIGNS)[number];
export const SIGN_AR: Record<SignAs, string> = { quality: 'الجودة', manager: 'مدير البرنامج' };
export const PARA_MAX = 420;
export type Trend = 'up' | 'flat' | 'down';
export type WeekSrc = { id: string; week_no: number; period_from: string; period_to: string; verify_code: string | null; students: StudentRow[]; strengths: { point: string; evidence: string }[]; challenges: { point: string; action: string }[]; lines: { email?: string | null; key?: string; text: string }[]; promote: { key: string }[]; support: { key: string }[] };
export type Trajectory = { key: string; name: string; email: string | null; weeks: number[]; skills: Record<string, (number | null)[]>; avgs: (number | null)[]; first: number | null; last: number | null; delta: number | null; trend: Trend | null; best_skill: string | null; weakest_skill: string | null; lines: string[]; mentioned: { promote: number; support: number } };
export type FinalComputed = Computed & { kind: 'final'; program_from: string | null; program_to: string | null; progress_pct: number | null; weeks: { id: string; week_no: number; period_from: string; period_to: string; verify_code: string | null; n: number; avg: number | null }[]; trajectory: Trajectory[]; maturity: { approved: number; expected: number; pct: number }; strengths_pool: { point: string; evidence: string }[]; challenges_pool: { point: string; action: string }[] };
export type FinalStudent = StudentRow & { rec: Rec | ''; reason: string; paragraph: string };
export type Signoff = { name: string; email: string; id: string | null; at: string } | null;
export type FinalBody = {
  general: { institution: string; level: string; group: string; duration: string; notes: string };
  summary: { overview: string; attendance_note: string; trajectory_note: string };
  results: { tools: string; note: string };
  recommendations: { next_level: string; group_note: string; admin_note: string };
  strengths: { strengths: { point: string; evidence: string }[]; challenges: { point: string; action: string }[] };
  admin: { attendance: string; discipline: string; environment: string; other: string };
  signoff: { quality: Signoff; manager: Signoff };
  promotion: { at: string; by: string; program_id: string; program_ar: string; created: number; skipped: number } | null;
};
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
/** تقدّم البرنامج في الزمن (٪) */
export function progressPct(start: string | null, end: string | null, today: string): number | null { if (!start || !end) return null; const tot = daysBetween(start, end); if (tot <= 0) return 100; return Math.max(0, Math.min(100, Math.round((daysBetween(start, today) / tot) * 100))); }
/** «نضج التقرير»: الأسبوعيات المعتمدة ÷ الأسابيع المتوقَّعة حتى اليوم (أو حتى نهاية البرنامج) */
export function maturityOf(approved: number, start: string | null, end: string | null, today: string): { approved: number; expected: number; pct: number } {
  let expected = 1; if (start) { const until = end && end < today ? end : today; expected = Math.max(1, Math.ceil(Math.max(0, daysBetween(start, until) + 1) / 7)); }
  expected = Math.max(expected, approved); return { approved, expected, pct: Math.round((approved / expected) * 100) };
}
/** هل يُقترح بدء الختامي؟ 75% من المدّة، أو أسبوعان قبل النهاية، أو أسبوعيتان معتمدتان على الأقل */
export function finalSuggested(progress: number | null, end: string | null, today: string, approvedWeeks: number): boolean { if (approvedWeeks >= 2) return true; if (progress !== null && progress >= FINAL_READY_PCT) return true; if (end && daysBetween(today, end) <= FINAL_READY_DAYS) return true; return false; }
export function trendOf(first: number | null, last: number | null): Trend | null { if (first === null || last === null) return null; const d = last - first; return d >= 3 ? 'up' : d <= -3 ? 'down' : 'flat'; }
export const TREND_AR: Record<Trend, string> = { up: 'صاعد', flat: 'ثابت', down: 'هابط' }; export const TREND_SIGN: Record<Trend, string> = { up: '↑', flat: '→', down: '↓' };
/** مسار كل متدرّب من الأسبوعيات المعتمدة (مرتّبة زمنيًا) */
export function buildTrajectories(roster: StudentRow[], weeks: WeekSrc[], skills: Skill[]): Trajectory[] {
  const ws = [...weeks].sort((a, b) => a.week_no - b.week_no || a.period_from.localeCompare(b.period_from));
  return roster.map(r => {
    const sk: Record<string, (number | null)[]> = {}; for (const k of skills) sk[k.code] = []; const avgs: (number | null)[] = []; const lines: string[] = []; let promote = 0, support = 0;
    for (const w of ws) { const s = w.students.find(x => x.key === r.key || (r.email && x.email && x.email === r.email)); for (const k of skills) sk[k.code].push(s ? (s.scores?.[k.code] ?? null) : null); avgs.push(s ? (s.avg ?? null) : null); const l = w.lines.find(x => (x.key && x.key === r.key) || (r.email && x.email && String(x.email).toLowerCase() === r.email)); if (l?.text) lines.push(l.text); if (w.promote.some(x => x.key === r.key)) promote++; if (w.support.some(x => x.key === r.key)) support++; }
    const known = avgs.filter((v): v is number => v !== null); const first = known.length ? known[0] : null; const last = known.length ? known[known.length - 1] : null; const delta = first !== null && last !== null ? Math.round((last - first) * 10) / 10 : null;
    const lastOf = (code: string) => { const a = sk[code].filter((v): v is number => v !== null); return a.length ? a[a.length - 1] : null; };
    let best: string | null = null, weak: string | null = null, bv = -1, wv = 101; for (const k of skills) { const v = lastOf(k.code); if (v === null) continue; if (v > bv) { bv = v; best = k.code; } if (v < wv) { wv = v; weak = k.code; } }
    return { key: r.key, name: r.name, email: r.email, weeks: ws.map(w => w.week_no), skills: sk, avgs, first, last, delta, trend: trendOf(first, last), best_skill: best, weakest_skill: best === weak ? null : weak, lines: lines.slice(-6), mentioned: { promote, support } };
  });
}
/** الاقتراح الآلي للتوصية — من التقييم الختامي إن وُجد وإلا آخر أسبوع؛ «إعادة» لا تُقترح آليًا أبدًا (قرار إنسان) */
export function suggestRec(finalAvg: number | null, lastAvg: number | null, attendancePct: number | null): Rec | null {
  const avg = finalAvg ?? lastAvg; if (avg === null) return null;
  if (avg >= PROMOTE_MIN && (attendancePct === null || attendancePct >= PROMOTE_ATT)) return 'promote'; if (avg < SUPPORT_MAX) return 'support'; return 'continue';
}
export function distribution(students: { avg: number | null }[]): { code: string; ar: string; n: number }[] { return GRADES.map(g => ({ code: g.code, ar: g.ar, n: students.filter(s => s.avg !== null && gradeOf(s.avg)?.code === g.code).length })); }
export const emptyFinalBody = (): FinalBody => ({ general: { institution: '', level: '', group: '', duration: '', notes: '' }, summary: { overview: '', attendance_note: '', trajectory_note: '' }, results: { tools: '', note: '' }, recommendations: { next_level: '', group_note: '', admin_note: '' }, strengths: { strengths: [], challenges: [] }, admin: { attendance: '', discipline: '', environment: '', other: '' }, signoff: { quality: null, manager: null }, promotion: null });
const signOf = (v: any): Signoff => (v && typeof v === 'object' && v.at ? { name: T(v.name, SHORT_MAX), email: T(v.email, SHORT_MAX).toLowerCase(), id: v.id ? String(v.id) : null, at: String(v.at) } : null);
/** تنظيف ما كتبه الإنسان — التواقيع والتنسيب لا تأتي من المتصفح؛ تُحفظ كما في الصفّ */
export function cleanFinalBody(b: any, keep?: { signoff?: FinalBody['signoff']; promotion?: FinalBody['promotion'] }): FinalBody {
  const x = b && typeof b === 'object' ? b : {}; const e = emptyFinalBody();
  return {
    general: { institution: T(x.general?.institution, SHORT_MAX), level: T(x.general?.level, SHORT_MAX), group: T(x.general?.group, SHORT_MAX), duration: T(x.general?.duration, SHORT_MAX), notes: T(x.general?.notes, TEXT_MAX) },
    summary: { overview: T(x.summary?.overview, TEXT_MAX * 2), attendance_note: T(x.summary?.attendance_note, TEXT_MAX), trajectory_note: T(x.summary?.trajectory_note, TEXT_MAX) },
    results: { tools: T(x.results?.tools, TEXT_MAX), note: T(x.results?.note, TEXT_MAX) },
    recommendations: { next_level: T(x.recommendations?.next_level, SHORT_MAX), group_note: T(x.recommendations?.group_note, TEXT_MAX), admin_note: T(x.recommendations?.admin_note, TEXT_MAX) },
    strengths: { strengths: arr(x.strengths?.strengths, 8, s => ({ point: T(s?.point, TEXT_MAX), evidence: T(s?.evidence, TEXT_MAX) })).filter(s => s.point), challenges: arr(x.strengths?.challenges, 8, s => ({ point: T(s?.point, TEXT_MAX), action: T(s?.action, TEXT_MAX) })).filter(s => s.point) },
    admin: { attendance: T(x.admin?.attendance, TEXT_MAX), discipline: T(x.admin?.discipline, TEXT_MAX), environment: T(x.admin?.environment, TEXT_MAX), other: T(x.admin?.other, TEXT_MAX) },
    signoff: keep?.signoff ? { quality: signOf(keep.signoff.quality), manager: signOf(keep.signoff.manager) } : e.signoff,
    promotion: keep?.promotion && keep.promotion.at ? { at: String(keep.promotion.at), by: T(keep.promotion.by, SHORT_MAX), program_id: String(keep.promotion.program_id || ''), program_ar: T(keep.promotion.program_ar, SHORT_MAX), created: Number(keep.promotion.created || 0), skipped: Number(keep.promotion.skipped || 0) } : null,
  };
}
/** كشف الختامي: درجات التقييم الختامي لكل مهارة + التوصية وسببها + فقرة المسار (يكتبها/يعتمدها المعلّم) */
export function cleanFinalStudents(given: any, roster: StudentRow[], skills: Skill[]): FinalStudent[] {
  const byKey = new Map<string, any>((Array.isArray(given) ? given : []).map((s: any) => [String(s?.key || ''), s]));
  return cleanStudents(given, roster, skills).map(s => { const g = byKey.get(s.key) || {}; return { ...s, rec: (RECS as readonly string[]).includes(String(g?.rec)) ? (String(g.rec) as Rec) : '', reason: T(g?.reason, TEXT_MAX), paragraph: T(g?.paragraph, PARA_MAX) }; });
}
export function missingBeforeFinalSubmit(body: FinalBody, students: FinalStudent[]): string[] {
  const m: string[] = [];
  if (!body.summary.overview) m.push('ملخّص البرنامج (القسم الثاني)');
  if (!students.some(s => s.avg !== null)) m.push('درجة ختامية واحدة على الأقل (القسم الرابع)');
  const graded = students.filter(s => s.avg !== null); if (graded.length && graded.some(s => !s.rec)) m.push(`توصية لكل متدرّب له درجة (${graded.filter(s => !s.rec).length} بلا توصية — القسم الخامس)`);
  if (!body.strengths.strengths.length) m.push('نقطة قوة واحدة على الأقل (القسم السادس)');
  return m;
}
/* ───────── التوقيعان ───────── */
export type WhoSign = Who & { admin?: boolean };
export function canSign(r: { kind: string; status: string; body: any }, me: WhoSign, as: SignAs): boolean {
  if (r.kind !== 'final' || r.status !== 'submitted' || !me.staff) return false; const so = r.body?.signoff || {}; if (so[as]?.at) return false;
  const other = so[as === 'quality' ? 'manager' : 'quality']; if (other?.at && !me.admin && ((me.id && other.id === me.id) || (me.email && other.email === me.email))) return false;   // التوقيع الثاني من شخص آخر — إلا مدير المنصة
  return true;
}
export function signoffComplete(body: any): boolean { return !!(body?.signoff?.quality?.at && body?.signoff?.manager?.at); }
export function signoffView(body: any): { quality: { name: string; at: string } | null; manager: { name: string; at: string } | null } { const so = body?.signoff || {}; return { quality: so.quality?.at ? { name: String(so.quality.name || ''), at: String(so.quality.at) } : null, manager: so.manager?.at ? { name: String(so.manager.name || ''), at: String(so.manager.at) } : null }; }
/* ───────── «صِغ لي من الأرقام» للمتدرّب — فقرة وصفية من مساره (لا تقدير ولا توصية) ───────── */
const FORBID = /توصي|أوصي|ينقل|يُنقل|يُرفع|يرسب|راسب|تقدير|ممتاز|ضعيف|مقبول|جيد جدًا/;
export function localParagraph(t: Trajectory, skills: Skill[], s: { avg: number | null; attendance_pct: number | null }): string {
  const nm = (c: string | null) => skills.find(k => k.code === c)?.name_ar || ''; const parts: string[] = [];
  if (t.first !== null && t.last !== null && t.weeks.length >= 2) parts.push(`انتقل متوسط ${t.name} من ${t.first}% في الأسبوع ${t.weeks[0]} إلى ${t.last}% في الأسبوع ${t.weeks[t.weeks.length - 1]} (${t.delta! >= 0 ? '+' : ''}${t.delta} نقطة).`);
  else if (t.last !== null) parts.push(`آخر متوسط مرصود لـ${t.name} ${t.last}% في الأسبوع ${t.weeks[t.weeks.length - 1] || 1}.`);
  if (t.best_skill) parts.push(`أعلى مهاراته ${nm(t.best_skill)}${t.weakest_skill ? `، وأكثرها حاجةً إلى وقت ${nm(t.weakest_skill)}` : ''}.`);
  if (s.attendance_pct !== null) parts.push(`حضر ${s.attendance_pct}% من الجلسات.`);
  if (s.avg !== null) parts.push(`متوسط التقييم الختامي ${s.avg}%.`);
  if (t.lines.length) parts.push(`آخر ما كُتب له: «${t.lines[t.lines.length - 1].slice(0, 120)}».`);
  return parts.join(' ').slice(0, PARA_MAX);
}
export function paragraphPrompt(t: Trajectory, skills: Skill[], s: { avg: number | null; attendance_pct: number | null; scores: Record<string, number | null> }): { system: string; user: string } {
  return {
    system: `أنت كاتب تقارير تعليمية بالعربية الفصحى. اكتب فقرة واحدة (≤ ${PARA_MAX} حرفًا) تصف مسار متدرّب خلال برنامج من أرقام معطاة فقط: من أين بدأ وإلى أين وصل في كل مهارة، وحضوره، وما كُتب له سابقًا. ممنوع: اقتراح تقدير أو توصية (نقل/رسوب/رفع)، أو أي رقم غير معطى، أو مجاملات عامة. أعد JSON فقط: {"text": "…"}.`,
    user: JSON.stringify({ name: t.name, weeks: t.weeks, skills: skills.map(k => ({ skill: k.name_ar, by_week: t.skills[k.code] })), avg_by_week: t.avgs, first: t.first, last: t.last, delta: t.delta, attendance_pct: s.attendance_pct, final_scores: Object.fromEntries(skills.map(k => [k.name_ar, s.scores?.[k.code] ?? null])), final_avg: s.avg, previous_lines: t.lines }),
  };
}
export function parseParagraph(raw: string): string | null { try { const m = raw.match(/\{[\s\S]*\}/); const j = JSON.parse(m ? m[0] : raw); const t = T(j?.text, PARA_MAX); return t.length >= 20 && !FORBID.test(t) ? t : null; } catch { const t = T(raw, PARA_MAX); return t.length >= 20 && t.length <= PARA_MAX && !FORBID.test(t) && !/[{}\[\]]/.test(t) ? t : null; } }
/** ما يراه المتدرّب في صفحته (ولا شيء عن غيره) */
export function studentPageData(t: Trajectory, skills: Skill[], s: FinalStudent): any { return { weeks: t.weeks, skills: skills.map(k => ({ code: k.code, name_ar: k.name_ar, by_week: t.skills[k.code], final: s.scores?.[k.code] ?? null })), avgs: t.avgs, first: t.first, last: t.last, delta: t.delta, trend: t.trend, attendance_pct: s.attendance_pct, final_avg: s.avg, grade_ar: s.grade_ar, rec: s.rec || null, rec_ar: s.rec ? REC_AR[s.rec] : null, paragraph: s.paragraph || '' }; }

/* ═════════════════════════════ ر3 — تقرير إنجاز المهمة («أثرُ المهمة») ═════════════════════════════
 *  الخبير/المستشار/المدرّب المتعاقد. المرجع: عقد التعاون (هيئة أَثَر) + طلب الاستشارة المرتبط (المراحل · التحديثات).
 *  «الوعد مقابل الواقع»: كل مخرج من العقد كما وُقِّع ← ما سُلِّم. «خطّ المهمة»: المراحل المخطَّطة مقابل الفعلية (الانحراف يُحسب والسبب يُكتب).
 *  الاعتماد بمرحلة واحدة (الطاقم)، ثم «إقرار الجهة» برابط بلا دخول (استلام لا تقييم). الأجر لا يدخل التقرير أبدًا.
 */
export const MISSION_NAMES_AR = { story: 'أثرُ المهمة', start: 'ابدأ تقرير إنجاز المهمة', matrix: 'الوعد مقابل الواقع', timeline: 'خطّ المهمة', ack: 'إقرار الجهة', ack_btn: 'أقرّ بالاستلام', send_client: 'أرسل للجهة', phrase: 'صِغ لي من المخرجات', updates: 'لخّص التحديثات', reported: 'موثَّقة بتقرير', addendum: 'إلحاق تصويب' } as const;
export const DELIV = ['delivered', 'partial', 'changed', 'not'] as const; export type Deliv = (typeof DELIV)[number];
export const DELIV_AR: Record<Deliv, string> = { delivered: 'سُلِّم', partial: 'جزئي', changed: 'تغيّر بالاتفاق', not: 'لم يُسلَّم' };
export const HORIZON = ['near', 'mid', 'far'] as const; export type Horizon = (typeof HORIZON)[number]; export const HORIZON_AR: Record<Horizon, string> = { near: 'قريب (≤ 3 أشهر)', mid: 'متوسط (3–12 شهرًا)', far: 'بعيد (> سنة)' };
export const PRIORITY = ['high', 'mid', 'low'] as const; export type Priority = (typeof PRIORITY)[number]; export const PRIORITY_AR: Record<Priority, string> = { high: 'عالية', mid: 'متوسطة', low: 'منخفضة' };
export const MISSION_SUMMARY_MAX = 900; export const MAX_DELIV = 20; export const MAX_EXTRA = 3; export const MAX_FINDINGS = 5; export const MAX_KPIS = 4; export const MAX_RECS = 8; export const MAX_LESSONS = 6; export const MAX_HANDOVER = 10; export const MAX_OPEN = 8;
export const DEVIATION_DAYS = 3; export const ACK_NOTE_MAX = 300; export const ADDENDUM_MAX = 600; export const MAX_ADDENDA = 5;
export type MissionMilestone = { id: string; position: number; title: string; due_date: string | null; status: string; done_at: string | null; deviation_days: number | null };
export type MissionComputed = {
  engagement_id: string; kind: 'consult' | 'train'; kind_ar: string; title_ar: string; scope_ar: string; deliverables: string[]; start_at: string | null; end_at: string | null; mode: string | null; member_signed_at: string | null; athar_signed_at: string | null; engagement_code: string | null; engagement_status: string;
  expert_name: string; expert_title: string; org_ar: string; sector: string; area: string; request_id: string | null; request_title: string; request_goals: string; request_timeline: string; client_name: string; client_email: string;
  quote_scope: string; quote_deliverables: string[]; quote_duration: string;
  milestones: MissionMilestone[]; milestones_done: number; milestones_on_time: number; milestones_late: number; updates: number; updates_from: string | null; updates_to: string | null; my_updates: string[];
  duration_days: number | null; sessions: number; hours: number; attendance_pct: number | null; at: string;
  client_sent_at?: string | null; client_sent_to?: string | null;   // بعد الاعتماد: متى وإلى من أُرسل رابط الإقرار
};
export type MissionDeliverable = { title: string; source: 'contract' | 'quote' | 'extra'; status: Deliv | ''; evidence: string; date: string; note: string; doc_code?: string };
export type MissionBody = {
  general: { context: string };
  summary: { executive: string };
  deliverables: MissionDeliverable[];
  timeline: { reasons: Record<string, string>; note: string };
  results: { findings: { text: string; evidence: string }[]; kpis: { name: string; before: number | null; after: number | null; unit: string }[] };
  recommendations: { items: { text: string; horizon: Horizon | ''; priority: Priority | ''; owner: string; impact: string }[] };
  lessons: { challenges: { point: string; handled: string }[]; lessons: string[] };
  handover: { items: string[]; open: string[]; followup: 'yes' | 'no' | ''; followup_note: string; admin_note: string };
  ack: { at: string; name: string; note: string; email: string } | null;
  addenda: { at: string; by: string; text: string }[];
};
const dayDiff = (a: string | null, b: string | null): number | null => { if (!a || !b) return null; const x = Date.parse(String(a).slice(0, 10) + 'T00:00:00Z'); const y = Date.parse(String(b).slice(0, 10) + 'T00:00:00Z'); return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 86400000) : null; };
/** انحراف كل مرحلة بالأيام (+ تأخّر · − تبكير) — المنجَزة مقابل done_at، وغير المنجَزة مقابل اليوم إن تجاوز موعدها */
export function milestoneDeviations(ms: { id: string; position: number; title: string; due_date?: string | null; status: string; done_at?: string | null }[], today: string): MissionMilestone[] {
  return [...ms].sort((a, b) => a.position - b.position).map(m => { const due = m.due_date || null; const done = m.status === 'done' ? (m.done_at ? String(m.done_at).slice(0, 10) : null) : null; let dev: number | null = null; if (due && done) dev = dayDiff(due, done); else if (due && m.status !== 'done' && due < today) dev = dayDiff(due, today); return { id: String(m.id), position: Number(m.position || 0), title: T(m.title, SHORT_MAX), due_date: due, status: String(m.status || 'planned'), done_at: m.done_at ? String(m.done_at) : null, deviation_days: dev }; });
}
export const lateMilestones = (ms: MissionMilestone[]) => ms.filter(m => (m.deviation_days ?? 0) > DEVIATION_DAYS);
/** جسم فارغ معبّأ من العقد: مخرجات العقد ثم مخرجات عرض السعر غير المكرّرة */
export function emptyMissionBody(c: Pick<MissionComputed, 'deliverables' | 'quote_deliverables'>): MissionBody {
  const seen = new Set<string>(); const dl: MissionDeliverable[] = [];
  for (const [src, list] of [['contract', c.deliverables], ['quote', c.quote_deliverables]] as const) for (const t of list || []) { const k = T(t, SHORT_MAX); const nk = k.replace(/\s+/g, ' ').toLowerCase(); if (!k || seen.has(nk) || dl.length >= MAX_DELIV) continue; seen.add(nk); dl.push({ title: k, source: src, status: '', evidence: '', date: '', note: '' }); }
  return { general: { context: '' }, summary: { executive: '' }, deliverables: dl, timeline: { reasons: {}, note: '' }, results: { findings: [], kpis: [] }, recommendations: { items: [] }, lessons: { challenges: [], lessons: [] }, handover: { items: [], open: [], followup: '', followup_note: '', admin_note: '' }, ack: null, addenda: [] };
}
const numAny = (v: unknown): number | null => { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** تنظيف ما كتبه الخبير — الإقرار والإلحاقات لا تأتي من المتصفح؛ مخرجات العقد لا تُحذف (تُشرح) */
export function cleanMissionBody(b: any, prev: MissionBody): MissionBody {
  const x = b && typeof b === 'object' ? b : {}; const e = emptyMissionBody({ deliverables: [], quote_deliverables: [] });
  const given: any[] = Array.isArray(x.deliverables) ? x.deliverables : []; const fixed = prev.deliverables.filter(d => d.source !== 'extra');
  const dl: MissionDeliverable[] = fixed.map((d, i) => { const g = given.find((y: any) => y && y.source !== 'extra' && T(y.title, SHORT_MAX) === d.title) || given.filter((y: any) => y && y.source !== 'extra')[i] || {}; return { ...d, status: (DELIV as readonly string[]).includes(String(g.status)) ? (g.status as Deliv) : '', evidence: T(g.evidence, LINE_MAX), date: DATE_RE.test(String(g.date || '')) ? String(g.date) : '', note: T(g.note, LINE_MAX), doc_code: /^[A-Z0-9]{4,12}$/.test(String(g.doc_code || '')) ? String(g.doc_code) : '' }; });
  for (const g of given.filter((y: any) => y && y.source === 'extra').slice(0, MAX_EXTRA)) { const t = T(g.title, SHORT_MAX); if (t) dl.push({ title: t, source: 'extra', status: (DELIV as readonly string[]).includes(String(g.status)) ? (g.status as Deliv) : 'delivered', evidence: T(g.evidence, LINE_MAX), date: DATE_RE.test(String(g.date || '')) ? String(g.date) : '', note: T(g.note, LINE_MAX), doc_code: /^[A-Z0-9]{4,12}$/.test(String(g.doc_code || '')) ? String(g.doc_code) : '' }); }
  const reasons: Record<string, string> = {}; if (x.timeline?.reasons && typeof x.timeline.reasons === 'object') for (const [k, v] of Object.entries(x.timeline.reasons).slice(0, 40)) { const t = T(v, LINE_MAX); if (t) reasons[String(k).slice(0, 40)] = t; }
  const list = (v: any, n: number) => (Array.isArray(v) ? v : []).slice(0, n);
  return {
    general: { context: T(x.general?.context, TEXT_MAX) },
    summary: { executive: T(x.summary?.executive, MISSION_SUMMARY_MAX) },
    deliverables: dl,
    timeline: { reasons, note: T(x.timeline?.note, TEXT_MAX) },
    results: { findings: list(x.results?.findings, MAX_FINDINGS).map((f: any) => ({ text: T(f?.text, LINE_MAX), evidence: T(f?.evidence, LINE_MAX) })).filter((f: any) => f.text), kpis: list(x.results?.kpis, MAX_KPIS).map((k: any) => ({ name: T(k?.name, SHORT_MAX), before: numAny(k?.before), after: numAny(k?.after), unit: T(k?.unit, 20) })).filter((k: any) => k.name) },
    recommendations: { items: list(x.recommendations?.items, MAX_RECS).map((r: any) => ({ text: T(r?.text, LINE_MAX), horizon: (HORIZON as readonly string[]).includes(String(r?.horizon)) ? r.horizon : '', priority: (PRIORITY as readonly string[]).includes(String(r?.priority)) ? r.priority : '', owner: T(r?.owner, SHORT_MAX), impact: T(r?.impact, LINE_MAX) })).filter((r: any) => r.text) },
    lessons: { challenges: list(x.lessons?.challenges, MAX_LESSONS).map((c: any) => ({ point: T(c?.point, LINE_MAX), handled: T(c?.handled, LINE_MAX) })).filter((c: any) => c.point), lessons: list(x.lessons?.lessons, MAX_LESSONS).map((l: any) => T(l, LINE_MAX)).filter(Boolean) },
    handover: { items: list(x.handover?.items, MAX_HANDOVER).map((l: any) => T(l, LINE_MAX)).filter(Boolean), open: list(x.handover?.open, MAX_OPEN).map((l: any) => T(l, LINE_MAX)).filter(Boolean), followup: x.handover?.followup === 'yes' ? 'yes' : x.handover?.followup === 'no' ? 'no' : '', followup_note: T(x.handover?.followup_note, LINE_MAX), admin_note: T(x.handover?.admin_note, TEXT_MAX) },
    ack: prev.ack || null, addenda: Array.isArray(prev.addenda) ? prev.addenda : [],
  } as MissionBody & typeof e;
}
/** إحصاء المصفوفة: سُلِّم x من y (بلا «زيادة») · الالتزام بالمواعيد */
export function missionStats(body: Pick<MissionBody, 'deliverables' | 'results'>, c: Pick<MissionComputed, 'milestones'>): { total: number; delivered: number; partial: number; changed: number; not: number; extra: number; pct: number | null; on_time: number; late: number; kpi_deltas: { name: string; delta: number | null; pct: number | null }[] } {
  const base = body.deliverables.filter(d => d.source !== 'extra'); const cnt = (s: Deliv) => base.filter(d => d.status === s).length;
  const done = (c.milestones || []).filter(m => m.status === 'done'); const late = done.filter(m => (m.deviation_days ?? 0) > DEVIATION_DAYS).length;
  const kd = body.results.kpis.map(k => { const d = k.before !== null && k.after !== null ? Math.round((k.after - k.before) * 100) / 100 : null; const p = d !== null && k.before ? Math.round((d / Math.abs(k.before)) * 1000) / 10 : null; return { name: k.name, delta: d, pct: p }; });
  return { total: base.length, delivered: cnt('delivered'), partial: cnt('partial'), changed: cnt('changed'), not: cnt('not'), extra: body.deliverables.length - base.length, pct: base.length ? Math.round((cnt('delivered') / base.length) * 100) : null, on_time: done.length - late, late, kpi_deltas: kd };
}
/** الاكتمال قبل الإرسال */
export function missingBeforeMissionSubmit(body: MissionBody, c: Pick<MissionComputed, 'milestones'>): string[] {
  const out: string[] = [];
  if (T(body.summary.executive).length < 40) out.push('ملخّص تنفيذي (40 حرفًا على الأقل)');
  const base = body.deliverables.filter(d => d.source !== 'extra'); if (base.length && base.some(d => !d.status)) out.push('حالة لكل مخرج في «الوعد مقابل الواقع»');
  if (base.some(d => d.status === 'delivered' && !d.evidence)) out.push('شاهد لكل مخرج «سُلِّم»');
  if (base.some(d => (d.status === 'changed' || d.status === 'not') && !d.note)) out.push('ملاحظة لكل مخرج «تغيّر» أو «لم يُسلَّم»');
  if (!body.results.findings.length) out.push('نتيجة واحدة على الأقل');
  if (!body.recommendations.items.length) out.push('توصية واحدة للجهة على الأقل');
  for (const m of lateMilestones(c.milestones || [])) if (!body.timeline.reasons[m.id]) { out.push(`سبب الانحراف في «${m.title}»`); break; }
  return out;
}
export function canAck(r: { status: string; body: any }): boolean { return r.status === 'approved' && !r.body?.ack; }
/** صياغة محلية من الأرقام والحالات — وصف لا حكم */
export type MissionPhrase = { section: 'summary' | 'timeline' | 'handover'; text: string };
export function localMissionPhrases(c: MissionComputed, body: MissionBody): MissionPhrase[] {
  const s = missionStats(body, c); const out: MissionPhrase[] = [];
  const dur = c.duration_days !== null ? `على مدى ${c.duration_days} يومًا` : ''; const per = c.start_at ? ` من ${fmtDayAr(c.start_at)}${c.end_at ? ` إلى ${fmtDayAr(c.end_at)}` : ''}` : '';
  out.push({ section: 'summary', text: `نُفِّذت مهمة «${c.title_ar}» لصالح ${c.org_ar || 'الجهة'}${per}${dur ? ` ${dur}` : ''}، وشملت ${s.total} ${s.total === 1 ? 'مخرجًا متّفقًا عليه' : s.total === 2 ? 'مخرجين متّفقًا عليهما' : 'مخرجات متّفقًا عليها'}.` });
  if (s.total) out.push({ section: 'summary', text: `سُلِّم ${s.delivered} من ${s.total} ${s.total <= 10 ? 'مخرجات' : 'مخرجًا'} كما وُقِّع${s.partial ? `، و${s.partial} جزئيًّا` : ''}${s.changed ? `، وتغيّر ${s.changed} بالاتفاق` : ''}${s.not ? `، ولم يُسلَّم ${s.not}` : ''}${s.extra ? `، وأُضيف ${s.extra} خارج الاتفاق` : ''}.` });
  if (c.milestones.length) out.push({ section: 'timeline', text: `من ${c.milestones.length} مراحل، أُنجزت ${c.milestones_done}${c.milestones_done ? ` (${s.on_time} في موعدها${s.late ? ` و${s.late} بتأخّر يتجاوز ${DEVIATION_DAYS} أيام` : ''})` : ''}، وسُجِّل ${c.updates} ${c.updates === 1 ? 'تحديثًا' : c.updates === 2 ? 'تحديثان' : 'تحديثات'} للجهة${c.updates_from ? ` بين ${fmtDayAr(c.updates_from)} و${fmtDayAr(c.updates_to)}` : ''}.` });
  if (c.sessions) out.push({ section: 'summary', text: `تضمّنت المهمة ${c.sessions} جلسة تدريبية بواقع ${c.hours} ساعة${c.attendance_pct !== null ? ` ومتوسط حضور ${c.attendance_pct}%` : ''}.` });
  out.push({ section: 'handover', text: `${body.handover.items.length ? `سُلِّمت ${body.handover.items.length} عناصر` : 'تُسلَّم المخرجات'} إلى ${c.org_ar || 'الجهة'}${body.handover.open.length ? ` مع ${body.handover.open.length} نقاط مفتوحة` : ''}${body.recommendations.items.length ? `، ويرافقها ${body.recommendations.items.length} توصيات` : ''}.` });
  return out.slice(0, 5);
}
const MISSION_FORBID = /ممتاز|متميّز|متميز|ناجح|نجاح باهر|فشل|ضعيف|رائع|مبهر|أفضل|أسوأ/;
export function parseMissionPhrases(raw: string): MissionPhrase[] | null {
  try { const m = raw.match(/\[[\s\S]*\]/); const j = JSON.parse(m ? m[0] : raw); if (!Array.isArray(j)) return null; const ok = ['summary', 'timeline', 'handover']; const out = j.map((x: any) => ({ section: ok.includes(String(x?.section)) ? String(x.section) : 'summary', text: T(x?.text, 260) })).filter((x: any) => x.text.length >= 10 && !MISSION_FORBID.test(x.text)); return out.length ? (out.slice(0, 5) as MissionPhrase[]) : null; } catch { return null; }
}
export function missionPhrasePrompt(c: MissionComputed, body: MissionBody): { system: string; user: string } {
  const s = missionStats(body, c);
  return {
    system: 'أنت كاتب تقارير مهنية بالعربية الفصحى. تصوغ جُملًا وصفية قصيرة من معطيات رقمية وحالات مخرجات فقط. ممنوع: تقييم جودة العمل أو الخبير أو الجهة، أو كلمات الحكم (ممتاز، ناجح، ضعيف…)، أو ذكر أسماء أشخاص، أو أي مبلغ مالي، أو أي رقم غير معطى. أعد JSON فقط: مصفوفة من {"section": summary|timeline|handover, "text": "…"} بحدّ أقصى 5 عناصر، كل جملة ≤ 240 حرفًا.',
    user: JSON.stringify({ title: c.title_ar, org: c.org_ar, kind: c.kind_ar, start: c.start_at, end: c.end_at, duration_days: c.duration_days, deliverables: { total: s.total, delivered: s.delivered, partial: s.partial, changed: s.changed, not: s.not, extra: s.extra }, milestones: { total: c.milestones.length, done: c.milestones_done, on_time: s.on_time, late: s.late }, updates: c.updates, sessions: c.sessions, hours: c.hours, attendance_pct: c.attendance_pct, handover_items: body.handover.items.length, open_points: body.handover.open.length, recommendations: body.recommendations.items.length, my_updates: c.my_updates.slice(0, 8) }),
  };
}
/** ما تراه الجهة برابط الإقرار: التقرير كاملًا عدا الملاحظة الإدارية والبريد؛ ولا أجر في أي مكان */
export function missionClientView(r: { id: string; verify_code: string | null; status: string; author_name: string; approved_name: string | null; approved_at: string | null; computed: any; body: MissionBody; period_from: string; period_to: string }): any {
  const c = r.computed as MissionComputed; const { admin_note: _a, ...handover } = r.body.handover; const { my_updates: _u, client_email: _e, client_sent_to: _s, ...cc } = c;   // بلا بريد ولا تحديثات داخلية
  const ack = r.body.ack ? { at: r.body.ack.at, name: r.body.ack.name, note: r.body.ack.note || '' } : null;
  return { id: r.id, code: r.verify_code, status: r.status, author_name: r.author_name, approved_name: r.approved_name, approved_at: r.approved_at, period_from: r.period_from, period_to: r.period_to, computed: cc, body: { ...r.body, handover, ack }, stats: missionStats(r.body, c), can_ack: canAck(r) };
}
/** التحقّق العام من تقرير مهمة: بلا نتائج ولا توصيات ولا أجر */
export function missionPublicView(r: { verify_code: string | null; status: string; author_name: string; approved_name: string | null; approved_at: string | null; computed: any; body: any; period_from: string; period_to: string; kind: string }): any {
  const c = r.computed as MissionComputed; const s = missionStats(r.body as MissionBody, c);
  return { code: r.verify_code, kind: 'mission', kind_ar: P46_NAMES_AR.mission, title_ar: c.title_ar, org_ar: c.org_ar, engagement_kind_ar: c.kind_ar, engagement_code: c.engagement_code, period_from: c.start_at || r.period_from, period_to: c.end_at || r.period_to, author_name: r.author_name, approved_name: r.approved_name || '', approved_at: r.approved_at, delivered: s.delivered, total: s.total, milestones: c.milestones.length, milestones_done: c.milestones_done, ack: r.body?.ack ? { at: r.body.ack.at, name: r.body.ack.name } : null };
}
/** رمز إقرار الجهة (24 رمزًا من أبجدية مِعيار) */
export function ackToken(): string { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 24; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
export function missionListLineAr(r: { computed: any; status: string }): string { const c = r.computed || {}; const n = Array.isArray(c.milestones) ? c.milestones.length : 0; return `${P46_NAMES_AR.mission} · ${String(c.title_ar || '')}${c.org_ar ? ` · ${c.org_ar}` : ''}${n ? ` · ${c.milestones_done ?? 0}/${n} مراحل` : ''} · ${STATUS_AR[r.status as ReportStatus] || r.status}`; }

/* ═══════════════════════════ ر3-ب: التقرير الاستشاري — رأي استشاري · دراسة («أثرُ الرأي») ═══════════════════════════ */
export const DOC_KINDS = ['advisory', 'study'] as const; export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_NAMES_AR = {
  umbrella: 'التقرير الاستشاري', story: 'أثرُ الرأي', advisory: 'رأي استشاري', study: 'دراسة', new_advisory: 'رأي استشاري جديد', new_study: 'دراسة جديدة', new_version: 'نسخة جديدة', supersedes: 'يحلّ محلّ', superseded: 'نُسخت',
  bullets: 'من نقاطي إلى فقرة', consistency: 'فحص الاتساق', client_docs: 'وثائق أَثَر المعتمَدة', pick_doc: 'اختر وثيقة معتمَدة من أَثَر', chain: 'سلسلة الوثائق', rec_to_request: 'اطلب تنفيذها من أَثَر', work: 'مهماتي وطلباتي', docs_written: 'وثائق استشارية معتمَدة',
} as const;
export const METHOD_TOOLS = ['interviews', 'survey', 'documents', 'observation', 'athar_data', 'focus_group', 'benchmark'] as const; export type MethodTool = (typeof METHOD_TOOLS)[number];
export const METHOD_TOOL_AR: Record<MethodTool, string> = { interviews: 'مقابلات', survey: 'استبانة', documents: 'تحليل وثائق', observation: 'ملاحظة ميدانية', athar_data: 'بيانات أَثَر', focus_group: 'مجموعة تركيز', benchmark: 'مقارنة مرجعية' };
export const COST_AR: Record<string, string> = { low: 'منخفضة', mid: 'متوسطة', high: 'مرتفعة' };
export const ADV_MAX_ASSUMPTIONS = 5; export const ADV_MAX_INPUTS = 8; export const ADV_MAX_OPTIONS = 4; export const ADV_MIN_OPTIONS = 2; export const ADV_MAX_STEPS = 5; export const ADV_MAX_RISKS = 3; export const ADV_RATIONALE_MAX = 600; export const ADV_QUESTION_MAX = 300;
export const STU_MAX_OBJ = 6; export const STU_MAX_Q = 6; export const STU_MAX_FINDINGS = 12; export const STU_MAX_KPIS = 6; export const STU_MAX_GAPS = 10; export const STU_MAX_RECS = 10; export const STU_MAX_PHASES = 8; export const STU_MAX_RISKS = 5; export const STU_MAX_ANNEX = 10; export const STU_READING_MAX = 900; export const STU_SUMMARY_MAX = 900;
export const BULLETS_MAX_IN = 1200; export const BULLETS_RATIO = 1.6;

/** لقطة الطلب — مشتركة بين الرأي والدراسة وتقرير الإنجاز بلا عقد */
export type RequestComputed = {
  request_id: string | null; engagement_id: string | null; engagement_code: string | null; title: string; details: string; goals: string; timeline: string; org_ar: string; sector: string; area: string; client_name: string; client_email: string; requested_at: string | null; request_status: string;
  consultant_name: string; consultant_title: string; assigned_name: string; quote_scope: string; quote_deliverables: string[]; quote_duration: string; milestones: MissionMilestone[]; at: string; client_sent_at?: string | null; client_sent_to?: string | null;
};
export type AdvisoryBody = {
  question: { text: string; assumptions: string[]; limits: string };
  inputs: { items: { text: string; source: string }[] };
  options: { items: { title: string; desc: string; pros: string; cons: string; conditions: string }[] };
  opinion: { chosen: number | null; rationale: string; first_steps: { text: string; horizon: Horizon | ''; owner: string }[]; risks: string[] };
  ack: { at: string; name: string; note: string; email: string } | null; addenda: { at: string; by: string; text: string }[]; superseded_by?: { code: string; at: string } | null;
};
export type StudyBody = {
  summary: { executive: string };
  problem: { statement: string; objectives: string[]; questions: string[] };
  method: { tools: MethodTool[]; sample: string; period: string; limits: string };
  findings: { items: { text: string; evidence: string; source: string }[]; kpis: { name: string; value: number | null; unit: string; source: string }[] };
  analysis: { gaps: { target: string; current: string; gap: string; priority: Priority | '' }[]; reading: string };
  recommendations: { items: { text: string; ref: string; horizon: Horizon | ''; priority: Priority | ''; owner: string; cost: string; indicator: string }[] };
  plan: { phases: { title: string; duration: string; owner: string; output: string }[]; risks: string[]; followup: string };
  annexes: string[];
  ack: { at: string; name: string; note: string; email: string } | null; addenda: { at: string; by: string; text: string }[]; superseded_by?: { code: string; at: string } | null;
};
export function emptyAdvisoryBody(): AdvisoryBody { return { question: { text: '', assumptions: [], limits: '' }, inputs: { items: [] }, options: { items: [] }, opinion: { chosen: null, rationale: '', first_steps: [], risks: [] }, ack: null, addenda: [] }; }
export function emptyStudyBody(): StudyBody { return { summary: { executive: '' }, problem: { statement: '', objectives: [], questions: [] }, method: { tools: [], sample: '', period: '', limits: '' }, findings: { items: [], kpis: [] }, analysis: { gaps: [], reading: '' }, recommendations: { items: [] }, plan: { phases: [], risks: [], followup: '' }, annexes: [], ack: null, addenda: [] }; }
const L = (v: any, n: number) => (Array.isArray(v) ? v : []).slice(0, n);
const strs = (v: any, n: number, max = LINE_MAX) => L(v, n).map((x: any) => T(x, max)).filter(Boolean);
const inH = (v: any): Horizon | '' => ((HORIZON as readonly string[]).includes(String(v)) ? (v as Horizon) : '');
const inP = (v: any): Priority | '' => ((PRIORITY as readonly string[]).includes(String(v)) ? (v as Priority) : '');
const keep = (prev: { ack?: any; addenda?: any; superseded_by?: any }) => ({ ack: prev?.ack || null, addenda: Array.isArray(prev?.addenda) ? prev.addenda : [], ...(prev?.superseded_by ? { superseded_by: prev.superseded_by } : {}) });
export function cleanAdvisoryBody(b: any, prev: AdvisoryBody): AdvisoryBody {
  const x = b && typeof b === 'object' ? b : {}; const opts = L(x.options?.items, ADV_MAX_OPTIONS).map((o: any) => ({ title: T(o?.title, SHORT_MAX), desc: T(o?.desc, TEXT_MAX), pros: T(o?.pros, LINE_MAX), cons: T(o?.cons, LINE_MAX), conditions: T(o?.conditions, LINE_MAX) })).filter((o: any) => o.title);
  const ch = Number.isInteger(Number(x.opinion?.chosen)) && x.opinion?.chosen !== null && x.opinion?.chosen !== '' ? Number(x.opinion.chosen) : null;
  return {
    question: { text: T(x.question?.text, ADV_QUESTION_MAX), assumptions: strs(x.question?.assumptions, ADV_MAX_ASSUMPTIONS), limits: T(x.question?.limits, LINE_MAX) },
    inputs: { items: L(x.inputs?.items, ADV_MAX_INPUTS).map((i: any) => ({ text: T(i?.text, LINE_MAX), source: T(i?.source, SHORT_MAX) })).filter((i: any) => i.text) },
    options: { items: opts },
    opinion: { chosen: ch !== null && ch >= 0 && ch < opts.length ? ch : null, rationale: T(x.opinion?.rationale, ADV_RATIONALE_MAX), first_steps: L(x.opinion?.first_steps, ADV_MAX_STEPS).map((s: any) => ({ text: T(s?.text, LINE_MAX), horizon: inH(s?.horizon), owner: T(s?.owner, SHORT_MAX) })).filter((s: any) => s.text), risks: strs(x.opinion?.risks, ADV_MAX_RISKS) },
    ...keep(prev),
  };
}
export function cleanStudyBody(b: any, prev: StudyBody): StudyBody {
  const x = b && typeof b === 'object' ? b : {}; const nums = (v: unknown) => { if (v === '' || v === null || v === undefined) return null; const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
  const findings = L(x.findings?.items, STU_MAX_FINDINGS).map((f: any) => ({ text: T(f?.text, LINE_MAX), evidence: T(f?.evidence, LINE_MAX), source: T(f?.source, SHORT_MAX) })).filter((f: any) => f.text);
  const gaps = L(x.analysis?.gaps, STU_MAX_GAPS).map((g: any) => ({ target: T(g?.target, LINE_MAX), current: T(g?.current, LINE_MAX), gap: T(g?.gap, LINE_MAX), priority: inP(g?.priority) })).filter((g: any) => g.target || g.gap);
  const refOk = (ref: string) => /^f:\d+$/.test(ref) ? Number(ref.slice(2)) < findings.length : /^g:\d+$/.test(ref) ? Number(ref.slice(2)) < gaps.length : false;
  return {
    summary: { executive: T(x.summary?.executive, STU_SUMMARY_MAX) },
    problem: { statement: T(x.problem?.statement, TEXT_MAX), objectives: strs(x.problem?.objectives, STU_MAX_OBJ), questions: strs(x.problem?.questions, STU_MAX_Q) },
    method: { tools: L(x.method?.tools, METHOD_TOOLS.length).filter((t: any) => (METHOD_TOOLS as readonly string[]).includes(String(t))), sample: T(x.method?.sample, LINE_MAX), period: T(x.method?.period, SHORT_MAX), limits: T(x.method?.limits, LINE_MAX) },
    findings: { items: findings, kpis: L(x.findings?.kpis, STU_MAX_KPIS).map((k: any) => ({ name: T(k?.name, SHORT_MAX), value: nums(k?.value), unit: T(k?.unit, 20), source: T(k?.source, SHORT_MAX) })).filter((k: any) => k.name) },
    analysis: { gaps, reading: T(x.analysis?.reading, STU_READING_MAX) },
    recommendations: { items: L(x.recommendations?.items, STU_MAX_RECS).map((r: any) => { const ref = T(r?.ref, 10); return { text: T(r?.text, LINE_MAX), ref: refOk(ref) ? ref : '', horizon: inH(r?.horizon), priority: inP(r?.priority), owner: T(r?.owner, SHORT_MAX), cost: ['low', 'mid', 'high'].includes(String(r?.cost)) ? String(r.cost) : '', indicator: T(r?.indicator, LINE_MAX) }; }).filter((r: any) => r.text) },
    plan: { phases: L(x.plan?.phases, STU_MAX_PHASES).map((p: any) => ({ title: T(p?.title, SHORT_MAX), duration: T(p?.duration, SHORT_MAX), owner: T(p?.owner, SHORT_MAX), output: T(p?.output, LINE_MAX) })).filter((p: any) => p.title), risks: strs(x.plan?.risks, STU_MAX_RISKS), followup: T(x.plan?.followup, LINE_MAX) },
    annexes: strs(x.annexes, STU_MAX_ANNEX),
    ...keep(prev),
  };
}
export function missingBeforeAdvisorySubmit(b: AdvisoryBody): string[] {
  const out: string[] = []; if (T(b.question.text).length < 40) out.push('السؤال الاستشاري (40 حرفًا على الأقل)'); if (!b.inputs.items.length) out.push('معطى واحد على الأقل');
  if (b.options.items.length < ADV_MIN_OPTIONS) out.push('خياران على الأقل'); if (b.options.items.some(o => !o.pros || !o.cons)) out.push('مزايا ومخاطر لكل خيار');
  if (b.opinion.chosen === null) out.push('اختيار الخيار الموصى به'); if (T(b.opinion.rationale).length < 80) out.push('الرأي والتسويغ (80 حرفًا على الأقل)'); if (!b.opinion.first_steps.length) out.push('خطوة أولى واحدة على الأقل');
  return out;
}
/** «فحص الاتساق» — محلي بلا ذكاء اصطناعي: كل توصية تشير إلى نتيجة/فجوة موجودة · كل نتيجة لها شاهد · كل فجوة لها أولوية */
export function studyConsistency(b: StudyBody): string[] {
  const out: string[] = [];
  b.findings.items.forEach((f, i) => { if (!f.evidence) out.push(`النتيجة ن${i + 1} بلا شاهد`); });
  b.analysis.gaps.forEach((g, i) => { if (!g.priority) out.push(`الفجوة ف${i + 1} بلا أولوية`); });
  b.recommendations.items.forEach((r, i) => { if (!r.ref) out.push(`التوصية ت${i + 1} غير مربوطة بنتيجة أو فجوة`); if (!r.indicator) out.push(`التوصية ت${i + 1} بلا مؤشّر نجاح`); });
  const used = new Set(b.recommendations.items.map(r => r.ref)); b.analysis.gaps.forEach((g, i) => { if (g.priority === 'high' && !used.has(`g:${i}`)) out.push(`الفجوة ف${i + 1} عالية الأولوية بلا توصية تعالجها`); });
  return out;
}
export function missingBeforeStudySubmit(b: StudyBody): string[] {
  const out: string[] = []; if (T(b.summary.executive).length < 80) out.push('ملخّص تنفيذي (80 حرفًا على الأقل)'); if (!b.problem.objectives.length) out.push('هدف واحد على الأقل'); if (!b.method.tools.length) out.push('أداة منهجية واحدة على الأقل');
  if (b.findings.items.length < 3) out.push('ثلاث نتائج على الأقل'); if (b.findings.items.some(f => !f.evidence)) out.push('شاهد لكل نتيجة');
  const linked = b.recommendations.items.filter(r => r.ref).length; if (linked < 2) out.push('توصيتان على الأقل مربوطتان بنتيجة أو فجوة'); if (!b.plan.phases.length) out.push('مرحلة تنفيذ واحدة على الأقل');
  return out;
}
/** صلاحية الاعتماد للوثائق: الطاقم، غير الكاتب — إلا مدير المنصة */
export function canDecideDoc(r: { status: string; author_id?: string | null; author_email: string }, me: WhoSign): boolean { return canDecide(r, me) && (!isAuthor(r, me) || !!me.admin); }
export const isDocKind = (k: unknown): k is DocKind => (DOC_KINDS as readonly string[]).includes(String(k));
export const isClientKind = (k: unknown) => k === 'mission' || isDocKind(k);
export const docTitle = (r: { kind: string; computed: any }) => `${r.kind === 'advisory' ? DOC_NAMES_AR.advisory : DOC_NAMES_AR.study} — ${String(r.computed?.title || '')}`;
/** «من نقاطي إلى فقرة»: الناتج لا يضيف رقمًا ولا يتجاوز 1.6× المدخل ولا يحمل حكمًا مطلقًا */
const ABSOLUTE = /الأفضل|الأسوأ|مضمون|مستحيل|بلا شكّ|قطعًا|حتمًا/;
export const bulletLines = (text: string) => String(text || '').split(/\r?\n/).map(x => x.replace(/^\s*(?:[-•*–]|\d{1,2}[.)])\s*/, '').trim()).filter(Boolean).slice(0, 20);   // لا نقصّ رقمًا يبدأ به المحتوى («12 مقابلة»)
export function localBulletsParagraph(text: string): string { const ls = bulletLines(text); if (!ls.length) return ''; return ls.map(l => l.replace(/[.؛;]+$/, '')).join('؛ ') + '.'; }
export function bulletsPrompt(text: string, context: { kind: string; section: string; title: string; org: string }): { system: string; user: string } {
  return {
    system: 'أنت محرّر تقارير مهنية بالعربية الفصحى. تحوّل نقاطًا كتبها خبير إلى فقرة واحدة متماسكة. ممنوع: إضافة أي حقيقة أو رقم أو اسم أو تاريخ غير موجود في النقاط · إضافة توصية أو خيار جديد · كلمات الحكم المطلق (الأفضل، الأسوأ، مضمون…) · أي مبلغ مالي. حافظ على ترتيب الأفكار. أعد JSON فقط: {"text": "…"} بطول لا يتجاوز مرّة ونصف طول النقاط.',
    user: JSON.stringify({ document: context.kind === 'advisory' ? 'رأي استشاري' : 'دراسة', section: context.section, title: context.title, org: context.org, bullets: bulletLines(text) }),
  };
}
export function parseBulletsParagraph(raw: string, input: string): string | null {
  try { const m = raw.match(/\{[\s\S]*\}/); const j = JSON.parse(m ? m[0] : raw); const t = T(j?.text, 2400); if (t.length < 20) return null;
    const inNums = new Set((input.match(/\d+(?:[.,]\d+)?/g) || []).map(n => n.replace(',', '.'))); for (const n of t.match(/\d+(?:[.,]\d+)?/g) || []) if (!inNums.has(n.replace(',', '.'))) return null;
    if (t.length > Math.max(120, bulletLines(input).join(' ').length * BULLETS_RATIO)) return null; if (ABSOLUTE.test(t)) return null; return t; } catch { return null; }
}
/** ما تراه الجهة من الوثيقة: كاملة بلا بريد؛ التحقّق العام: ملخّص بلا محتوى */
export function docClientView(r: { id: string; kind: string; verify_code: string | null; status: string; author_name: string; approved_name: string | null; approved_at: string | null; computed: any; body: any; period_from: string; period_to: string; supersedes_id?: string | null }): any {
  const { client_email: _e, client_sent_to: _s, ...cc } = (r.computed || {}) as RequestComputed; const ack = r.body?.ack ? { at: r.body.ack.at, name: r.body.ack.name, note: r.body.ack.note || '' } : null;
  return { id: r.id, kind: r.kind, code: r.verify_code, status: r.status, author_name: r.author_name, approved_name: r.approved_name, approved_at: r.approved_at, period_from: r.period_from, period_to: r.period_to, computed: cc, body: { ...(r.body || {}), ack }, can_ack: canAck(r), supersedes_id: r.supersedes_id || null };
}
export function docPublicView(r: { kind: string; verify_code: string | null; author_name: string; approved_name: string | null; approved_at: string | null; computed: any; body: any; period_from: string; period_to: string }): any {
  const c = (r.computed || {}) as RequestComputed; const b = r.body || {};
  return { code: r.verify_code, kind: r.kind, kind_ar: r.kind === 'advisory' ? DOC_NAMES_AR.advisory : DOC_NAMES_AR.study, title_ar: c.title, org_ar: c.org_ar, area: c.area, engagement_code: c.engagement_code, period_from: r.period_from, period_to: r.period_to, author_name: r.author_name, approved_name: r.approved_name || '', approved_at: r.approved_at,
    counts: r.kind === 'advisory' ? { options: (b.options?.items || []).length, steps: (b.opinion?.first_steps || []).length } : { findings: (b.findings?.items || []).length, recommendations: (b.recommendations?.items || []).length, phases: (b.plan?.phases || []).length },
    ack: b.ack ? { at: b.ack.at, name: b.ack.name } : null, superseded_by: b.superseded_by || null };
}
export function docListLineAr(r: { kind: string; computed: any; status: string }): string { const c = r.computed || {}; return `${r.kind === 'advisory' ? DOC_NAMES_AR.advisory : DOC_NAMES_AR.study} · ${String(c.title || '')}${c.org_ar ? ` · ${c.org_ar}` : ''} · ${STATUS_AR[r.status as ReportStatus] || r.status}`; }

/* ═════════════════════════════ ر4-أ — «ملف الدبلوم» (وحدات الدبلوم · نبض الأسبوع · تقرير الوحدة) — «أثرُ الدبلوم» ═════════════════════════════
 *  الدبلوم طويل فلا يُختصر في تقرير؛ هو ملف يتراكم: نبض نصف صفحة كل أسبوع، وتقرير عند إغلاق كل وحدة، وكشف كفايات لكل متدرّب (ر4-ب).
 *  لماذا «نبض» لا «تقرير»: الأسبوع في دبلوم من 12–40 أسبوعًا يحتاج متابعة لا توثيقًا رسميًا (التقرير الأسبوعي الكامل ر1 يبقى بزرّ).
 *  لماذا الوحدة: هي وحدة الحكم التعليمي الحقيقية — لها ناتج ومهارات ومدّة — وتُغلق باعتماد تقريرها لا بزرّ منفصل: الإغلاق هو التوثيق.
 *  «سلسلة الانتباه»: من ذُكر في «من يحتاج انتباهًا» يظهر في نبض الأسبوع التالي بخانة «ما الذي تغيّر؟» حتى يُغلق — لا أحد يسقط بين الأسابيع.
 */
export const R4_NAMES_AR = {
  file: 'ملف الدبلوم', official: 'ملف توثيق الدبلوم', story: 'أثرُ الدبلوم', pulse: 'نبض الأسبوع', unit: 'تقرير الوحدة', profile: 'كشف الكفايات', units: 'وحدات الدبلوم',
  attention: 'سلسلة الانتباه', map: 'خريطة الوحدات', full_week: 'أريد التقرير الكامل هذا الأسبوع', pulse_start: 'نبض هذا الأسبوع', close_unit: 'أغلق الوحدة بتقريرها', unit_line: 'سطر لك من تقرير الوحدة',
  motto: 'كفاية بشاهد، لا درجة بلا أثر', import_design: 'استورد الوحدات من التصميم',
} as const;
export const UNIT_MAX = 24; export const UNIT_TITLE_MAX = 120; export const UNIT_OUTCOME_MAX = 300; export const PULSE_MAX_ATTENTION = 8; export const PULSE_TEXT_MAX = 400;
export const UNIT_TOOLS_AR = [...SUMMATIVE_TOOLS_AR, 'مهمة مصدَّقة', 'بروفة', 'محاكاة', 'مشروع الوحدة', 'ملف أعمال'];
export const ATTENTION_CHANGE = ['improved', 'plan', 'referred', 'same'] as const; export type AttentionChange = (typeof ATTENTION_CHANGE)[number];
export const ATTENTION_CHANGE_AR: Record<AttentionChange, string> = { improved: 'تحسّن — تُغلق', plan: 'خطة دعم', referred: 'إحالة للإدارة', same: 'كما هو — تستمرّ' };
export const UNIT_DECISION = ['completed', 'support', 'repeat', 'pending'] as const; export type UnitDecision = (typeof UNIT_DECISION)[number];
export const UNIT_DECISION_AR: Record<UnitDecision, string> = { completed: 'بلغ ناتج الوحدة', support: 'بلغه مع خطة دعم', repeat: 'يعيد الوحدة', pending: 'لم يُحسم بعد' };
export const EVIDENCE_MARKS_AR: Record<string, string> = { missions: 'م = مهمة مصدَّقة', rehearsals: 'ب = بروفة', cases: 'ي = كل يوم مهارة', stations: 'ح = محطة' };
export const DIPLOMA_KINDS = ['diploma_pulse', 'diploma_unit', 'diploma_profile'] as const; export type DiplomaKind = (typeof DIPLOMA_KINDS)[number];
export const isDiplomaKind = (k: string): k is DiplomaKind => (DIPLOMA_KINDS as readonly string[]).includes(k);
export const diplomaKindAr = (k: string) => (k === 'diploma_pulse' ? R4_NAMES_AR.pulse : k === 'diploma_unit' ? R4_NAMES_AR.unit : R4_NAMES_AR.profile);

export type Unit = { id: string | null; idx: number; title_ar: string; outcome_ar: string; hours: number; skill_codes: string[]; starts_on: string | null; ends_on: string | null; closed_at: string | null; closed_report_id?: string | null; source: 'manual' | 'design' };
export type UnitState = 'closed' | 'current' | 'upcoming';
const S = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const D = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
/** تنظيف قائمة الوحدات كما يرسلها المحرّر — الترتيب يُعاد ترقيمه 1..n، والرموز تُحصر في مهارات القالب */
export function cleanUnits(given: unknown, skills: Skill[]): Unit[] {
  const codes = new Set(skills.map(s => s.code)); const arr = Array.isArray(given) ? given : [];
  const out: Unit[] = arr.slice(0, UNIT_MAX).map((u: any, i: number): Unit => ({
    id: typeof u?.id === 'string' && u.id ? u.id : null, idx: i + 1, title_ar: S(u?.title_ar, UNIT_TITLE_MAX), outcome_ar: S(u?.outcome_ar, UNIT_OUTCOME_MAX),
    hours: Math.max(0, Math.min(999, Number(u?.hours) || 0)), skill_codes: Array.isArray(u?.skill_codes) ? Array.from(new Set((u.skill_codes as unknown[]).map(String).filter(c => codes.has(c)))).slice(0, 12) : [],
    starts_on: D(u?.starts_on), ends_on: D(u?.ends_on), closed_at: typeof u?.closed_at === 'string' ? u.closed_at : null, closed_report_id: typeof u?.closed_report_id === 'string' ? u.closed_report_id : null, source: (u?.source === 'design' ? 'design' : 'manual') as 'manual' | 'design',
  })).filter(u => u.title_ar.length >= 2);
  return out.map((u, i) => ({ ...u, idx: i + 1 }));
}
/** وحدات من تصميم P11 (design.modules) — العناوين والنواتج جاهزة؛ الساعات تُقسَّم بالتساوي */
export function unitsFromDesign(design: any, skills: Skill[]): Unit[] {
  const mods: any[] = Array.isArray(design?.modules) ? design.modules : []; if (!mods.length) return [];
  const hours = Number(design?.hours) || 0; const per = mods.length ? Math.round((hours / mods.length) * 10) / 10 : 0;
  return cleanUnits(mods.map((m: any, i: number) => ({ idx: i + 1, title_ar: m?.title_ar || `الوحدة ${i + 1}`, outcome_ar: m?.outcome_ar || '', hours: per, skill_codes: [], source: 'design' })), skills);
}
/** حالة الوحدة: مغلقة ✓ · جارية ● · قادمة ○ — الجارية بالتواريخ، وإلا أول وحدة غير مغلقة */
export function unitStates(units: Unit[], today: string): { unit: Unit; state: UnitState }[] {
  const sorted = [...units].sort((a, b) => a.idx - b.idx); let currentPicked = false;
  const byDate = sorted.find(u => !u.closed_at && u.starts_on && u.ends_on && u.starts_on <= today && today <= u.ends_on);
  return sorted.map(u => { if (u.closed_at) return { unit: u, state: 'closed' as UnitState }; if (byDate ? u === byDate : !currentPicked) { currentPicked = true; return { unit: u, state: 'current' as UnitState }; } return { unit: u, state: 'upcoming' as UnitState }; });
}
export const currentUnit = (units: Unit[], today: string): Unit | null => unitStates(units, today).find(x => x.state === 'current')?.unit || null;
export const UNIT_STATE_AR: Record<UnitState, string> = { closed: 'مغلقة', current: 'جارية', upcoming: 'قادمة' };

/* ───────── نبض الأسبوع ───────── */
export type Around = { missions: number; rehearsals: number; cases: number; stations: number };
export type AttentionItem = { key: string; name: string; reason: string };
export type FollowItem = { key: string; name: string; prev_reason: string; since_week: number; change: AttentionChange | ''; note: string };
export type PulseComputed = {
  kind: 'diploma_pulse'; program_ar: string; org_ar: string; trainer_ar: string; classroom_ar: string; week_no: number; period_from: string; period_to: string;
  unit: { id: string | null; idx: number; title_ar: string } | null; units_total: number; units_closed: number;
  enrolled: number; regular: number; absent: number; sessions: number; hours: number; around: Around; prev_attention: { key: string; name: string; reason: string; since_week: number }[];
  roster: { key: string; name: string; email: string | null }[]; computed_at: string; full_weekly_id: string | null;
};
export type PulseBody = { done: string; attention: AttentionItem[]; follow: FollowItem[]; need: string };
export const emptyPulseBody = (c: PulseComputed): PulseBody => ({ done: '', attention: [], follow: (c.prev_attention || []).map(p => ({ key: p.key, name: p.name, prev_reason: p.reason, since_week: p.since_week, change: '', note: '' })), need: '' });
export function cleanPulseBody(b: any, c: PulseComputed): PulseBody {
  const keys = new Map((c.roster || []).map(r => [r.key, r.name])); const prev = new Map((c.prev_attention || []).map(p => [p.key, p]));
  const attention: AttentionItem[] = (Array.isArray(b?.attention) ? b.attention : []).filter((a: any) => keys.has(String(a?.key))).slice(0, PULSE_MAX_ATTENTION).map((a: any) => ({ key: String(a.key), name: keys.get(String(a.key)) || S(a.name, 80), reason: S(a.reason, SHORT_MAX) }));
  const seen = new Set<string>(); const follow: FollowItem[] = (Array.isArray(b?.follow) ? b.follow : []).filter((f: any) => prev.has(String(f?.key)) && !seen.has(String(f.key)) && seen.add(String(f.key))).map((f: any) => { const p = prev.get(String(f.key))!; return { key: p.key, name: p.name, prev_reason: p.reason, since_week: p.since_week, change: (ATTENTION_CHANGE as readonly string[]).includes(String(f.change)) ? (String(f.change) as AttentionChange) : '', note: S(f.note, SHORT_MAX) }; });
  for (const p of c.prev_attention || []) if (!seen.has(p.key)) follow.push({ key: p.key, name: p.name, prev_reason: p.reason, since_week: p.since_week, change: '', note: '' });
  return { done: S(b?.done, PULSE_TEXT_MAX), attention, follow, need: S(b?.need, PULSE_TEXT_MAX) };
}
export function missingBeforePulseSubmit(b: PulseBody): string[] {
  const m: string[] = []; if (b.done.length < 10) m.push('«ما تمّ» (سطر على الأقل)');
  if (b.attention.some(a => a.reason.length < 3)) m.push('سبب لكل اسم في «من يحتاج انتباهًا»');
  if (b.follow.some(f => !f.change)) m.push('«ما الذي تغيّر؟» لكل اسم من الأسبوع السابق');
  return m;
}
/** سلسلة الانتباه: ما يُحمل إلى الأسبوع التالي = الأسماء الجديدة + المستمرّة (plan/referred/same) — المغلقة (improved) تسقط */
export function carryAttention(b: PulseBody, week_no: number): { key: string; name: string; reason: string; since_week: number }[] {
  const out: { key: string; name: string; reason: string; since_week: number }[] = [];
  for (const f of b.follow) if (f.change && f.change !== 'improved') out.push({ key: f.key, name: f.name, reason: f.note || f.prev_reason, since_week: f.since_week });
  for (const a of b.attention) if (!out.some(o => o.key === a.key)) out.push({ key: a.key, name: a.name, reason: a.reason, since_week: week_no });
  return out.slice(0, PULSE_MAX_ATTENTION * 2);
}
export function pulseLineAr(r: { week_no: number; period_from: string; period_to: string; computed: any; status: string }): string { const c = r.computed || {}; return `${R4_NAMES_AR.pulse} ${r.week_no} · ${fmtDayAr(r.period_from)} → ${fmtDayAr(r.period_to)} · ${String(c.program_ar || '')}${c.classroom_ar ? ` · ${c.classroom_ar}` : ''}${c.unit ? ` · الوحدة ${c.unit.idx}` : ''} · ${STATUS_AR[r.status as ReportStatus] || r.status}`; }

/* ───────── تقرير الوحدة ───────── */
export type UnitWeek = { id: string; kind: 'weekly' | 'diploma_pulse'; week_no: number; period_from: string; period_to: string; verify_code: string | null; status: string };
export type UnitStudent = StudentRow & { marks: Around; decision: UnitDecision | '' };
export type UnitComputed = Omit<Computed, 'units'> & {
  kind: 'diploma_unit'; unit: Unit; unit_skills: Skill[]; planned_hours: number; planned_from: string | null; planned_to: string | null; weeks: UnitWeek[]; weekly_approved: number; pulses_approved: number;
  attention: { key: string; name: string; reason: string; since_week: number; last_change: AttentionChange | '' }[]; around: Around; units_total: number; units_closed: number; grid_source: 'weeks' | 'empty';
};
export type UnitBody = {
  execution: { deviation: string; notes: string };
  assessment: { tools: { tool: string; skill: string; desc: string }[]; notes: string };
  outcome: { judgment: string; pct: number | null; evidence: string };
  attention: { key: string; name: string; decision: string }[];
  next: { support: { key: string; name: string; what: string; owner: string }[]; adjust: string; admin: string };
};
export const emptyUnitBody = (c: UnitComputed): UnitBody => ({ execution: { deviation: '', notes: '' }, assessment: { tools: [], notes: '' }, outcome: { judgment: '', pct: null, evidence: '' }, attention: (c.attention || []).map(a => ({ key: a.key, name: a.name, decision: '' })), next: { support: [], adjust: '', admin: '' } });
export function cleanUnitBody(b: any, c: UnitComputed, roster: { key: string; name: string }[]): UnitBody {
  const names = new Map(roster.map(r => [r.key, r.name])); const att = new Map((c.attention || []).map(a => [a.key, a]));
  const tools = (Array.isArray(b?.assessment?.tools) ? b.assessment.tools : []).slice(0, 8).map((t: any) => ({ tool: S(t?.tool, SHORT_MAX), skill: S(t?.skill, 40), desc: S(t?.desc, TEXT_MAX) })).filter((t: any) => t.tool);
  const pctN = b?.outcome?.pct === null || b?.outcome?.pct === undefined || b?.outcome?.pct === '' ? null : Math.max(0, Math.min(100, Math.round(Number(b.outcome.pct)))); const pct = pctN !== null && Number.isFinite(pctN) ? pctN : null;
  const attention = (Array.isArray(b?.attention) ? b.attention : []).filter((a: any) => att.has(String(a?.key))).map((a: any) => ({ key: String(a.key), name: att.get(String(a.key))!.name, decision: S(a.decision, SHORT_MAX) }));
  for (const a of c.attention || []) if (!attention.some((x: any) => x.key === a.key)) attention.push({ key: a.key, name: a.name, decision: '' });
  const support = (Array.isArray(b?.next?.support) ? b.next.support : []).filter((s: any) => names.has(String(s?.key))).slice(0, MAX_LIST).map((s: any) => ({ key: String(s.key), name: names.get(String(s.key)) || '', what: S(s.what, TEXT_MAX), owner: S(s.owner, 80) }));
  return { execution: { deviation: S(b?.execution?.deviation, TEXT_MAX), notes: S(b?.execution?.notes, TEXT_MAX) }, assessment: { tools, notes: S(b?.assessment?.notes, TEXT_MAX) }, outcome: { judgment: S(b?.outcome?.judgment, TEXT_MAX), pct, evidence: S(b?.outcome?.evidence, TEXT_MAX) }, attention, next: { support, adjust: S(b?.next?.adjust, TEXT_MAX), admin: S(b?.next?.admin, TEXT_MAX) } };
}
export function cleanUnitStudents(given: unknown, roster: StudentRow[], skills: Skill[], marks: Map<string, Around>): UnitStudent[] {
  const base = cleanStudents(given, roster, skills); const g = new Map((Array.isArray(given) ? given : []).map((s: any) => [String(s?.key), s]));
  return base.map(s => { const x = g.get(s.key); const d = String(x?.decision || ''); return { ...s, marks: marks.get(s.key) || { missions: 0, rehearsals: 0, cases: 0, stations: 0 }, decision: (UNIT_DECISION as readonly string[]).includes(d) ? (d as UnitDecision) : '' }; });
}
export function missingBeforeUnitSubmit(b: UnitBody, students: UnitStudent[]): string[] {
  const m: string[] = []; if (!b.assessment.tools.length) m.push('أداة تقييم واحدة على الأقل'); if (b.outcome.judgment.length < 20) m.push('حكم «ما تحقّق من ناتج الوحدة»');
  if (b.outcome.pct === null) m.push('نسبة من بلغوا الناتج'); if (b.attention.some(a => a.decision.length < 3)) m.push('قرار لكل اسم في سلسلة الانتباه');
  const graded = students.filter(s => s.avg !== null).length; if (students.length && graded === 0) m.push('درجات كشف الطلاب (طالب واحد على الأقل)');
  if (students.length && students.some(s => s.avg !== null && !s.decision)) m.push('قرار الوحدة لكل طالب له درجة');
  return m;
}
/** النسبة المقترحة من الكشف: من بلغ 60% فأكثر — المعلّم يملك الحكم */
export function outcomePctSuggested(students: { avg: number | null }[]): number | null { const g = students.filter(s => s.avg !== null); if (!g.length) return null; return Math.round((g.filter(s => (s.avg as number) >= PASS_MARK).length / g.length) * 100); }
export function unitLineAr(r: { computed: any; status: string }): string { const c = r.computed || {}; return `${R4_NAMES_AR.unit} ${c.unit?.idx || ''} «${String(c.unit?.title_ar || '')}» · ${String(c.program_ar || '')}${c.classroom_ar ? ` · ${c.classroom_ar}` : ''} · ${STATUS_AR[r.status as ReportStatus] || r.status}`; }
export function diplomaListLineAr(r: { week_no: number; period_from: string; period_to: string; computed: any; status: string; kind: string }): string { return r.kind === 'diploma_pulse' ? pulseLineAr(r) : r.kind === 'diploma_unit' ? unitLineAr(r) : profileLineAr(r); }
/** التحقّق العام لتقرير الوحدة: أعداد فقط — بلا أسماء */
export function unitPublicView(r: { verify_code: string | null; status: string; period_from: string; period_to: string; author_name: string; approved_name: string | null; approved_at: string | null; computed: any; students: any; body: any }): any {
  if (r.status !== 'approved' || !r.verify_code) return null; const c: UnitComputed = r.computed; const st: UnitStudent[] = Array.isArray(r.students) ? r.students : [];
  return { code: r.verify_code, kind: 'diploma_unit', kind_ar: R4_NAMES_AR.unit, program_id: (r as any).program_id ? String((r as any).program_id) : null, program_ar: c.program_ar, org_ar: c.org_ar, classroom_ar: c.classroom_ar, unit: { idx: c.unit.idx, title_ar: c.unit.title_ar, outcome_ar: c.unit.outcome_ar }, units_total: c.units_total, units_closed: c.units_closed,
    period_from: r.period_from, period_to: r.period_to, sessions: c.sessions, hours: c.hours, planned_hours: c.planned_hours, enrolled: c.enrolled, weeks: c.weeks.length, chain: c.weeks.map(w => w.verify_code || '').filter(Boolean), outcome_pct: r.body?.outcome?.pct ?? null,
    decisions: UNIT_DECISION.map(d => ({ code: d, ar: UNIT_DECISION_AR[d], n: st.filter(s => s.decision === d).length })), author_name: r.author_name, approved_name: r.approved_name || '', approved_at: r.approved_at };
}
/** بطاقة الدبلوم في تقاريري */
export type DiplomaCard = { program_id: string; classroom_id: string | null; program_ar: string; classroom_ar: string; level: string | null; units: { unit: Unit; state: UnitState; report_id: string | null; report_status: string | null }[]; current: Unit | null; pulse: { id: string; status: string } | null; weekly: { id: string; status: string } | null; week: { from: string; to: string; week_no: number }; attention_open: number; can_edit_units: boolean };

/* ═════════════════════════════ ر4-ب — «كشف الكفايات» («العودة إلى الجواز») ═════════════════════════════
 *  لكل متدرّب مقبول كشفٌ واحد حيّ: يُنشأ مسودّةً عند اعتماد أول تقرير وحدة، ويُعاد حسابه بعد كل وحدة، ويُعتمد مرّة واحدة في آخر الدبلوم (ونسخة جديدة تَنسخه عند الحاجة).
 *  لماذا «كشف» لا «شهادة»: الشهادة تقول «أتمّ»، والكشف يقول «ماذا يستطيع الآن وبأيّ شاهد» — وهو ما يُعاد إلى جواز المهارات (P8) مستوىً معتمَدًا بملاحظة تحمل رمزه.
 *  القاعدة: الأدلّة تُجمع آليًا (كشوف الوحدات · المهمات المصدَّقة · «كل يوم مهارة» · البروفات · المحطات · الجواز المحسوب)، والاقتراح يُحسب محليًا بقاعدة مُعلنة،
 *  والمستوى النهائي يكتبه المعلّم على سُلّم الجواز نفسه (أساسي · مبتدئ متقدم · متوسط · متقدم · خبير) أو «لم يُثبت بعد»، ومن «متوسط» فأعلى تلزم جملةُ شاهد.
 */
export const R4B_NAMES_AR = {
  profile: 'كشف الكفايات', official: 'كشف الكفايات المعتمَد', story: 'العودة إلى الجواز', suggest: 'اقتراح من الأدلّة', not_proven: 'لم يُثبت بعد', arrange: 'رتّب الأدلّة',
  distinguish: 'ما يميّزه', keep: 'ما يحتاج أن يواصله', recommendation: 'التوصية', cohort: 'قراءة الدفعة', open: 'كشوف الكفايات', passport: 'جواز المهارات', complete_cert: 'أصدر شهادة الإتمام',
  motto: 'ما يستطيعه الآن، وبأيّ شاهد', my_profile: 'كشف كفاياتي', show_cred: 'أظهِر كفاياتي في شهادتي',
} as const;
/** سُلّم المستوى في الكشف = سُلّم الجواز P8 (1..5) + صفر «لم يُثبت بعد» */
export const PROFILE_LEVEL_AR = ['لم يُثبت بعد', 'أساسي', 'مبتدئ متقدم', 'متوسط', 'متقدم', 'خبير'] as const;
export const PROFILE_EVIDENCE_MIN_LEVEL = 3;            // من «متوسط» فأعلى تلزم جملة شاهد
export const PROFILE_MAX_QUOTES = 3; export const QUOTE_MAX = 300; export const COHORT_MIN = 5;
export const PROFILE_REC = ['complete', 'complete_plan', 'finish_units', 'repeat'] as const; export type ProfileRec = (typeof PROFILE_REC)[number];
export const PROFILE_REC_AR: Record<ProfileRec, string> = { complete: 'إتمام الدبلوم', complete_plan: 'إتمام مع خطة متابعة', finish_units: 'استكمال وحدات', repeat: 'إعادة الدبلوم' };
/** كلمات الحكم التي لا تدخل «رتّب الأدلّة» — الحكم للمعلّم وحده */
export const JUDGMENT_WORDS_AR = ['ممتاز', 'ضعيف', 'يستحق', 'لا يستحق', 'فاشل', 'رائع', 'متفوق', 'سيئ', 'مخفق', 'الأفضل', 'الأسوأ'];
export type CompetencyUnit = { idx: number; title_ar: string; score: number | null; decision: string; verify_code: string | null };
export type Competency = { code: string; name_ar: string; skill_id: string | null; units: CompetencyUnit[]; avg: number | null; missions: number; cases: number; passport_computed: number | null; passport_approved: number | null; suggested: number | null; why: string };
export type ProfileComputed = {
  kind: 'diploma_profile'; program_ar: string; org_ar: string; classroom_ar: string; trainer_ar: string; subject: { key: string; name: string; email: string; user_id: string | null };
  units: { idx: number; title_ar: string; state: UnitState; score: number | null; decision: string; verify_code: string | null }[]; units_total: number; units_closed: number; units_reached: number;
  attendance_pct: number | null; sessions: number; hours: number; attention: { reason: string; since_week: number; last_change: string }[]; around: Around; competencies: Competency[]; computed_at: string; supersedes_code: string | null;
};
export type ProfileLevel = { code: string; level: number | null; evidence: string };
export type ProfileQuote = { code: string; text: string; source: string };
export type ProfileBody = { levels: ProfileLevel[]; strengths: string; keep: string; recommendation: ProfileRec | ''; plan: string; quotes: ProfileQuote[]; admin: string; show_suggest?: boolean };
/** الاقتراح من الأدلّة — قاعدة مُعلنة: متوسط كشوف الوحدات (90/80/70/60) ← +1 إن صُدِّقت مهمّتان ← وإلا الجواز المحسوب ← وإلا لا اقتراح */
export function suggestLevel(c: { avg: number | null; missions: number; cases: number; passport_computed: number | null }): { level: number | null; why: string } {
  if (c.avg !== null && Number.isFinite(c.avg)) {
    let lv = c.avg >= 90 ? 5 : c.avg >= 80 ? 4 : c.avg >= 70 ? 3 : c.avg >= PASS_MARK ? 2 : 1; const why = [`متوسط كشوف الوحدات ${Math.round(c.avg)}%`];
    if (c.missions >= 2 && lv < 5 && c.avg >= PASS_MARK) { lv++; why.push(`+1 لتصديق ${c.missions === 2 ? 'مهمّتين' : c.missions + ' مهمات'}`); } else if (c.missions === 1) why.push('مهمة مصدَّقة واحدة (لا ترفع المستوى وحدها)');
    if (c.cases) why.push(`${c.cases} ${c.cases === 1 ? 'إجابة' : 'إجابات'} في «كل يوم مهارة»`); return { level: lv, why: why.join(' · ') };
  }
  if (c.passport_computed !== null && c.passport_computed > 0) return { level: Math.max(1, Math.min(5, Math.round(c.passport_computed))), why: `من الجواز المحسوب (${c.passport_computed}) — لا كشف وحدة لهذه الكفاية بعد` };
  return { level: null, why: 'لا أدلّة بعد' };
}
export const emptyProfileBody = (c: ProfileComputed): ProfileBody => ({ levels: (c.competencies || []).map(k => ({ code: k.code, level: null, evidence: '' })), strengths: '', keep: '', recommendation: '', plan: '', quotes: [], admin: '', show_suggest: true });
export function cleanProfileBody(b: any, c: ProfileComputed): ProfileBody {
  const comps = c.competencies || []; const codes = new Set(comps.map(k => k.code)); const given = new Map<string, any>((Array.isArray(b?.levels) ? b.levels : []).map((l: any) => [String(l?.code), l]));
  const levels: ProfileLevel[] = comps.map(k => { const l = given.get(k.code); const n = l?.level === null || l?.level === undefined || l?.level === '' ? null : Math.round(Number(l.level)); return { code: k.code, level: n !== null && Number.isFinite(n) && n >= 0 && n <= 5 ? n : null, evidence: S(l?.evidence, TEXT_MAX) }; });
  const perCode = new Map<string, number>(); const quotes: ProfileQuote[] = (Array.isArray(b?.quotes) ? b.quotes : []).map((q: any) => ({ code: String(q?.code || ''), text: S(q?.text, QUOTE_MAX), source: S(q?.source, 80) })).filter((q: ProfileQuote) => codes.has(q.code) && q.text.length >= 3 && (perCode.set(q.code, (perCode.get(q.code) || 0) + 1), (perCode.get(q.code) || 0) <= PROFILE_MAX_QUOTES));
  const rec = String(b?.recommendation || ''); return { levels, strengths: S(b?.strengths, TEXT_MAX), keep: S(b?.keep, TEXT_MAX), recommendation: (PROFILE_REC as readonly string[]).includes(rec) ? (rec as ProfileRec) : '', plan: S(b?.plan, TEXT_MAX), quotes, admin: S(b?.admin, TEXT_MAX), show_suggest: b?.show_suggest !== false };
}
export function missingBeforeProfileSubmit(b: ProfileBody, c: ProfileComputed): string[] {
  const m: string[] = []; const names = new Map((c.competencies || []).map(k => [k.code, k.name_ar]));
  const noLevel = b.levels.filter(l => l.level === null); if (noLevel.length) m.push(`مستوى لكل كفاية أو «${R4B_NAMES_AR.not_proven}» (${noLevel.map(l => names.get(l.code) || l.code).slice(0, 3).join('، ')}${noLevel.length > 3 ? '…' : ''})`);
  const noEv = b.levels.filter(l => (l.level || 0) >= PROFILE_EVIDENCE_MIN_LEVEL && l.evidence.length < 10); if (noEv.length) m.push(`جملة شاهد لكل كفاية بمستوى «${PROFILE_LEVEL_AR[PROFILE_EVIDENCE_MIN_LEVEL]}» فأعلى (${noEv.map(l => names.get(l.code) || l.code).slice(0, 3).join('، ')})`);
  if (b.strengths.length < 10) m.push(`«${R4B_NAMES_AR.distinguish}»`); if (b.keep.length < 10) m.push(`«${R4B_NAMES_AR.keep}»`);
  if (!b.recommendation) m.push(`${R4B_NAMES_AR.recommendation} بالكلمات`); else if (b.recommendation !== 'complete' && b.plan.length < 10) m.push(b.recommendation === 'finish_units' ? 'ما الوحدات التي تُستكمل؟' : 'خطة المتابعة/الإعادة');
  return m;
}
/** سطر القائمة */
export function profileLineAr(r: { computed: any; status: string }): string { const c = r.computed || {}; return `${R4B_NAMES_AR.profile} · ${String(c.subject?.name || '')} · ${String(c.program_ar || '')}${c.classroom_ar ? ` · ${c.classroom_ar}` : ''} · ${r.status === 'approved' ? 'معتمَد' : r.status === 'submitted' ? 'بانتظار الاعتماد' : r.status === 'returned' ? 'أُعيد' : 'مسودّة'}`; }
export const levelAr = (n: number | null | undefined) => (n === null || n === undefined ? '—' : PROFILE_LEVEL_AR[Math.max(0, Math.min(5, n))]);
/** ما يُكتب في الجواز عند الاعتماد: المستويات 1..5 فقط لكفايات لها مهارة في P8 */
export function passportWrites(b: ProfileBody, c: ProfileComputed): { skill_id: string; level: number; code: string }[] {
  const byCode = new Map((c.competencies || []).map(k => [k.code, k])); const out: { skill_id: string; level: number; code: string }[] = [];
  for (const l of b.levels) { const k = byCode.get(l.code); if (k?.skill_id && l.level && l.level >= 1 && l.level <= 5) out.push({ skill_id: k.skill_id, level: l.level, code: l.code }); } return out;
}
/** ما يصل المتدرّب (سطر + صفحة كاملة) — بلا ملاحظات الإدارة */
export function profileLineData(b: ProfileBody, c: ProfileComputed): any {
  const names = new Map((c.competencies || []).map(k => [k.code, k.name_ar]));
  return { levels: b.levels.map(l => ({ code: l.code, name_ar: names.get(l.code) || l.code, level: l.level ?? 0, level_ar: levelAr(l.level ?? 0), evidence: l.evidence })), quotes: b.quotes, strengths: b.strengths, keep: b.keep, recommendation: b.recommendation, recommendation_ar: b.recommendation ? PROFILE_REC_AR[b.recommendation] : '', plan: b.plan,
    units_total: c.units_total, units_closed: c.units_closed, units_reached: c.units_reached, hours: c.hours, attendance_pct: c.attendance_pct, program_ar: c.program_ar, org_ar: c.org_ar };
}
export function profileLineText(b: ProfileBody, c: ProfileComputed): string {
  const proven = b.levels.filter(l => (l.level || 0) >= 1).length; const top = b.levels.filter(l => (l.level || 0) >= 4).length; const names = new Map((c.competencies || []).map(k => [k.code, k.name_ar]));
  const best = [...b.levels].sort((a, z) => (z.level || 0) - (a.level || 0))[0]; const t = `اعتُمد ${R4B_NAMES_AR.profile}: أثبتَ ${proven} من ${b.levels.length} كفايات${top ? ` (${top} منها «${PROFILE_LEVEL_AR[4]}» فأعلى)` : ''}${best && (best.level || 0) >= 3 ? ` — أبرزها «${names.get(best.code) || best.code}»` : ''}. ${R4B_NAMES_AR.recommendation}: ${b.recommendation ? PROFILE_REC_AR[b.recommendation] : '—'}.`;
  return t.slice(0, LINE_MAX);
}
/** التحقّق العام: أعداد ومستويات بلا اسم */
export function profilePublicView(r: { verify_code: string | null; status: string; author_name: string; approved_name: string | null; approved_at: string | null; computed: any; body: any; period_to?: string }): any {
  if (r.status !== 'approved' || !r.verify_code) return null; const c: ProfileComputed = r.computed; const b: ProfileBody = r.body || { levels: [] }; const dist = [0, 0, 0, 0, 0, 0]; for (const l of b.levels || []) dist[Math.max(0, Math.min(5, l.level || 0))]++;
  return { code: r.verify_code, kind: 'diploma_profile', kind_ar: R4B_NAMES_AR.profile, program_ar: c.program_ar, org_ar: c.org_ar, units_total: c.units_total, units_closed: c.units_closed, units_reached: c.units_reached, hours: c.hours, competencies: (b.levels || []).length, proven: (b.levels || []).filter(l => (l.level || 0) >= 1).length,
    distribution: dist.map((n, i) => ({ level: i, ar: PROFILE_LEVEL_AR[i], n })), recommendation_ar: b.recommendation ? PROFILE_REC_AR[b.recommendation] : '', author_name: r.author_name, approved_name: r.approved_name || '', approved_at: r.approved_at, superseded: !!r.body?.superseded_by };
}
/** قراءة الدفعة (k ≥ 5 · بلا أسماء): توزيع المستويات لكل كفاية · نسبة الإتمام · متوسط الساعات */
export function cohortReading(rows: { body: any; computed: any }[]): { n: number; shown: boolean; competencies: { code: string; name_ar: string; dist: number[]; avg_level: number | null }[]; completion_pct: number | null; avg_hours: number | null } {
  const n = rows.length; if (n < COHORT_MIN) return { n, shown: false, competencies: [], completion_pct: null, avg_hours: null };
  const acc = new Map<string, { name_ar: string; dist: number[]; sum: number; k: number }>();
  for (const r of rows) { const names = new Map(((r.computed?.competencies || []) as Competency[]).map(k => [k.code, k.name_ar])); for (const l of (r.body?.levels || []) as ProfileLevel[]) { const a = acc.get(l.code) || { name_ar: names.get(l.code) || l.code, dist: [0, 0, 0, 0, 0, 0], sum: 0, k: 0 }; const lv = Math.max(0, Math.min(5, l.level || 0)); a.dist[lv]++; if (lv) { a.sum += lv; a.k++; } acc.set(l.code, a); } }
  const done = rows.filter(r => r.body?.recommendation === 'complete' || r.body?.recommendation === 'complete_plan').length; const hrs = rows.map(r => Number(r.computed?.hours) || 0);
  return { n, shown: true, competencies: Array.from(acc.entries()).map(([code, a]) => ({ code, name_ar: a.name_ar, dist: a.dist, avg_level: a.k ? Math.round((a.sum / a.k) * 10) / 10 : null })), completion_pct: Math.round((done / n) * 100), avg_hours: hrs.length ? Math.round(hrs.reduce((x, y) => x + y, 0) / hrs.length) : null };
}
/* ───────── «رتّب الأدلّة» — اقتباسات بمصدر، بلا رقم غريب ولا حكم ───────── */
export type EvidenceItem = { source: string; text: string };
const digitsOf = (s: string) => (s.match(/[0-9٠-٩]+(?:[.,][0-9٠-٩]+)?/g) || []).map(x => x.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
const firstSentence = (t: string, n = 160) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); const m = s.match(/^.{10,}?[.!؟?؛]/); return (m ? m[0] : s).slice(0, n).trim(); };
/** الترتيب المحلي: أول جملة من كل دليل بمصدره — حتى ثلاثة */
export function localEvidenceQuotes(code: string, items: EvidenceItem[]): ProfileQuote[] { const out: ProfileQuote[] = []; for (const it of items) { const t = firstSentence(it.text); if (t.length >= 10 && !out.some(o => o.text === t)) out.push({ code, text: t, source: it.source }); if (out.length >= PROFILE_MAX_QUOTES) break; } return out; }
/** تنقية ما يقترحه الذكاء: المصدر من القائمة · لا كلمة حكم · كل رقم فيه موجود في الأدلّة · 10..300 حرفًا · ≤ 3 */
export function cleanEvidenceQuotes(code: string, raw: any, items: EvidenceItem[]): { quotes: ProfileQuote[]; rejected: number } {
  const srcs = new Set(items.map(i => i.source)); const pool = new Set(items.flatMap(i => digitsOf(i.text + ' ' + i.source))); const arr: any[] = Array.isArray(raw?.quotes) ? raw.quotes : Array.isArray(raw) ? raw : []; const out: ProfileQuote[] = []; let rejected = 0;
  for (const q of arr) { const text = S(q?.text, QUOTE_MAX); const source = S(q?.source, 80); const bad = text.length < 10 || !srcs.has(source) || JUDGMENT_WORDS_AR.some(w => text.includes(w)) || digitsOf(text).some(d => !pool.has(d)); if (bad) { rejected++; continue; } if (!out.some(o => o.text === text)) out.push({ code, text, source }); if (out.length >= PROFILE_MAX_QUOTES) break; }
  return { quotes: out, rejected };
}
export function evidencePrompt(name_ar: string, items: EvidenceItem[]): { system: string; user: string } {
  return { system: 'أنت تساعد معلّم دبلوم على ترتيب أدلّة كفاية واحدة لمتدرّب. أعد JSON فقط بالشكل {"quotes":[{"text":"...","source":"..."}]} بثلاث جمل على الأكثر، كل جملة إمّا اقتباس حرفي قصير من دليل أو تلخيص أمين له، و"source" يُنسخ حرفيًا من مصدر الدليل. ممنوع: أي رقم غير موجود في الأدلّة، وأي حكم أو تقدير (ممتاز/ضعيف/يستحق)، وأي معلومة من خارج الأدلّة. العربية الفصحى، بلا مقدّمات.',
    user: JSON.stringify({ competency: name_ar, evidence: items.slice(0, 12).map(i => ({ source: i.source, text: i.text.slice(0, 500) })) }) };
}
