// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 «محور التقارير» — توثيق الجودة والأداء (دوال صافية، بلا اعتماديات) — ر1: تقرير التعلّم الأسبوعي
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
  return { code: r.verify_code, kind: r.kind, kind_ar: r.kind === 'weekly' ? P46_NAMES_AR.weekly : r.kind === 'final' ? P46_NAMES_AR.final : r.kind, week_no: r.week_no, weeks: Array.isArray(r.computed?.weeks) ? r.computed.weeks.length : 0, chain: Array.isArray(r.computed?.weeks) ? (r.computed.weeks as any[]).map(w => String(w.verify_code || '')).filter(Boolean) : [], signoff: r.kind === 'final' ? signoffView((r as any).body) : null, period_from: r.period_from, period_to: r.period_to, program_ar: String(r.computed?.program_ar || ''), org_ar: String(r.computed?.org_ar || ''), classroom_ar: String(r.computed?.classroom_ar || ''), author_name: r.author_name, approved_name: r.approved_name || '', approved_at: r.approved_at, sessions: Number(r.computed?.sessions || 0), hours: Number(r.computed?.hours || 0), enrolled: Number(r.computed?.enrolled || 0) };
}
/** سطر القائمة */
export function listLineAr(r: { week_no: number; period_from: string; period_to: string; computed: any; status: string; kind?: string }): string {
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
