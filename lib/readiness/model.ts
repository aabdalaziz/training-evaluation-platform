// جاهزية البرنامج — قائمة تحقق آلية من الإعداد حتى الإغلاق (دوال نقية قابلة للاختبار)

export type Phase = 'before' | 'during' | 'after';
export type CheckStatus = 'ok' | 'warn' | 'missing' | 'na';
export type Stage = 'setup' | 'delivery' | 'closure';

export type ProgramRow = { id: string; name_ar: string; status?: string | null; start_date?: string | null; end_date?: string | null; delivery_mode?: string | null; objectives_ar?: string | null; intro_ar?: string | null };
export type ClassroomRow = { id: string; program_id: string; trainer_id?: string | null; code?: string | null };
export type ScheduleRow = { classroom_id: string; is_active?: boolean | null };
export type LinkRow = { program_id: string; template_id: string; is_active?: boolean | null };
export type TemplateRow = { id: string; kind: string };
export type QuestionRow = { template_id: string };
export type CountRow = { program_id: string | null };
export type EvaluationRow = { program_id: string | null; kind?: string | null };

export type ReadinessInput = {
  program: ProgramRow;
  classrooms: ClassroomRow[];
  schedules: ScheduleRow[];
  links: LinkRow[];
  templates: TemplateRow[];
  questions: QuestionRow[];
  evaluations: EvaluationRow[];
  attendance: CountRow[];
  certificates: CountRow[];
  impact: CountRow[];
  followups: CountRow[];
  kpis: CountRow[];
  today?: string; // YYYY-MM-DD (للاختبار)
};

export type Check = { id: string; stage: Stage; label: string; status: CheckStatus; detail: string; href: string; help: string; fix?: string };
export type Readiness = { program: ProgramRow; phase: Phase; checks: Check[]; score: number; level: 'ready' | 'almost' | 'not'; ok: number; applicable: number; blockers: number };

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'setup', label: 'الإعداد', hint: 'قبل أول جلسة' },
  { id: 'delivery', label: 'التنفيذ', hint: 'أثناء البرنامج' },
  { id: 'closure', label: 'الإغلاق', hint: 'بعد آخر جلسة' },
];

export function phaseOf(p: ProgramRow, today = new Date().toISOString().slice(0, 10)): Phase {
  const st = String(p.status || '').toUpperCase();
  if (st === 'COMPLETED' || st === 'ARCHIVED') return 'after';
  if (p.end_date && p.end_date < today) return 'after';
  if (st === 'ACTIVE') return 'during';
  if (p.start_date && p.start_date <= today && (!p.end_date || p.end_date >= today)) return 'during';
  return 'before';
}

export function phaseLabel(ph: Phase): string {
  return ph === 'before' ? 'قبل الانطلاق' : ph === 'during' ? 'قيد التنفيذ' : 'منتهٍ';
}

export function daysUntil(date: string | null | undefined, today = new Date().toISOString().slice(0, 10)): number | null {
  if (!date) return null;
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

const n = (rows: { program_id: string | null }[], pid: string) => rows.filter(r => r.program_id === pid).length;

export function assessProgram(inp: ReadinessInput): Readiness {
  const p = inp.program; const pid = p.id; const today = inp.today || new Date().toISOString().slice(0, 10);
  const phase = phaseOf(p, today);
  const rooms = inp.classrooms.filter(c => c.program_id === pid);
  const roomIds = new Set(rooms.map(r => r.id));
  const withoutTrainer = rooms.filter(r => !r.trainer_id);
  const scheduled = inp.schedules.filter(s => roomIds.has(s.classroom_id) && s.is_active !== false).length;
  const activeLinks = inp.links.filter(l => l.program_id === pid && l.is_active !== false).map(l => l.template_id);
  const tplOf = (kind: string) => inp.templates.find(t => activeLinks.includes(t.id) && String(t.kind).toUpperCase() === kind) || null;
  const qCount = (tid: string | null) => tid ? inp.questions.filter(q => q.template_id === tid).length : 0;
  const daily = tplOf('DAILY'); const final = tplOf('FINAL');
  const dq = qCount(daily?.id || null); const fq = qCount(final?.id || null);
  const evDaily = inp.evaluations.filter(e => e.program_id === pid && String(e.kind || '').toUpperCase() !== 'FINAL').length;
  const evFinal = inp.evaluations.filter(e => e.program_id === pid && String(e.kind || '').toUpperCase() === 'FINAL').length;
  const att = n(inp.attendance, pid); const certs = n(inp.certificates, pid); const imp = n(inp.impact, pid); const fu = n(inp.followups, pid); const kpis = n(inp.kpis, pid);
  const remote = String(p.delivery_mode || '').toUpperCase().includes('REMOTE') || String(p.delivery_mode || '').toUpperCase() === 'ONLINE';
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // ---------- الإعداد ----------
  const missingInfo: string[] = [];
  if (!p.start_date) missingInfo.push('تاريخ البداية'); if (!p.end_date) missingInfo.push('تاريخ النهاية'); if (!p.delivery_mode) missingInfo.push('نمط التنفيذ');
  add({ id: 'info', stage: 'setup', label: 'بيانات البرنامج الأساسية', href: '/admin/management', help: '/help#programs',
    status: missingInfo.length ? (missingInfo.length >= 2 ? 'missing' : 'warn') : 'ok',
    detail: missingInfo.length ? `ناقص: ${missingInfo.join('، ')}` : `${p.start_date} → ${p.end_date} · ${p.delivery_mode}`, fix: missingInfo.length ? 'أكمل الحقول من مركز الإدارة → البرامج' : undefined });
  add({ id: 'rooms', stage: 'setup', label: remote ? 'الفصول الافتراضية' : 'القاعات الدراسية', href: '/admin/management?tab=rooms', help: '/help#rooms',
    status: rooms.length ? 'ok' : 'missing', detail: rooms.length ? `${rooms.length} قاعة` : 'لا توجد قاعة — التقييم اليومي والحضور يحتاجان قاعة واحدة على الأقل', fix: rooms.length ? undefined : 'أضف قاعة من مركز الإدارة → القاعات' });
  add({ id: 'trainers', stage: 'setup', label: 'المدربون مُعيَّنون على القاعات', href: '/admin/management?tab=rooms', help: '/help#rooms',
    status: !rooms.length ? 'na' : withoutTrainer.length === 0 ? 'ok' : withoutTrainer.length === rooms.length ? 'missing' : 'warn',
    detail: !rooms.length ? 'بانتظار إضافة القاعات' : withoutTrainer.length ? `${withoutTrainer.length} قاعة بلا مدرب (${withoutTrainer.map(r => r.code || r.id).join('، ')})` : 'كل قاعة لها مدرب', fix: withoutTrainer.length ? 'عيّن مدربًا لكل قاعة — تقارير عدالة المدربين تعتمد عليه' : undefined });
  add({ id: 'schedule', stage: 'setup', label: 'الجدول الأسبوعي للقاعات', href: '/admin/management?tab=rooms', help: '/help#rooms',
    status: !rooms.length ? 'na' : scheduled ? 'ok' : 'warn', detail: !rooms.length ? '—' : scheduled ? `${scheduled} موعد مفعّل` : 'لا توجد مواعيد — اختياري لكنه يحسّن استطلاع التعلم عن بُعد والتذكيرات' });
  add({ id: 'tpl-daily', stage: 'setup', label: 'قالب التقييم اليومي', href: '/admin/templates', help: '/help#templates',
    status: daily && dq ? 'ok' : daily ? 'missing' : 'missing', detail: daily ? (dq ? `${dq} سؤال` : 'القالب مرتبط لكنه بلا أسئلة') : 'لا يوجد قالب يومي مفعّل — ستظهر للمشارك رسالة «لا يوجد قالب»', fix: daily && dq ? undefined : 'اربط القالب من صفحة قوالب التقييم → تغطية البرامج' });
  add({ id: 'tpl-final', stage: 'setup', label: 'قالب التقييم الختامي', href: '/admin/templates', help: '/help#templates',
    status: final && fq ? 'ok' : 'missing', detail: final ? (fq ? `${fq} سؤال` : 'القالب مرتبط لكنه بلا أسئلة') : 'لا يوجد قالب ختامي مفعّل', fix: final && fq ? undefined : 'اربط القالب من صفحة قوالب التقييم → تغطية البرامج' });
  add({ id: 'impact', stage: 'setup', label: 'أداة قياس الأثر (قبلي/بعدي)', href: '/admin/impact', help: '/help#impact',
    status: imp ? 'ok' : phase === 'before' ? 'warn' : 'warn', detail: imp ? `${imp} أداة` : 'لم تُنشأ — الاختبار القبلي يجب أن يسبق أول جلسة ليُقاس الكسب المعياري', fix: imp ? undefined : 'أنشئ أداة من قياس أثر التدريب (يمكن توليدها بالذكاء الاصطناعي)' });

  // ---------- التنفيذ ----------
  add({ id: 'attendance', stage: 'delivery', label: 'جلسات الحضور الرقمي', href: '/admin/attendance', help: '/help#attendance',
    status: att ? 'ok' : phase === 'before' ? 'na' : phase === 'during' ? 'warn' : 'missing', detail: att ? `${att} جلسة` : phase === 'before' ? 'تُفتح عند بدء البرنامج' : 'لا توجد جلسات حضور مسجلة', fix: att ? undefined : 'افتح جلسة لكل لقاء وشارك رمز QR مع المتدربين' });
  add({ id: 'ev-daily', stage: 'delivery', label: 'استجابات التقييم اليومي', href: '/evaluate/daily', help: '/help#evaluate',
    status: evDaily ? 'ok' : phase === 'before' ? 'na' : phase === 'during' ? 'warn' : 'missing', detail: evDaily ? `${evDaily} استجابة` : phase === 'before' ? 'تبدأ مع أول جلسة' : 'لم تصل أي استجابة بعد', fix: evDaily ? undefined : 'اعرض رابط/QR الاستمارة في نهاية كل جلسة' });

  // ---------- الإغلاق ----------
  add({ id: 'ev-final', stage: 'closure', label: 'استجابات التقييم الختامي', href: '/evaluate/final', help: '/help#evaluate',
    status: evFinal ? 'ok' : phase === 'after' ? 'missing' : 'na', detail: evFinal ? `${evFinal} استجابة` : phase === 'after' ? 'لم يُجمع التقييم الختامي' : 'يُجمع في آخر جلسة' });
  add({ id: 'certs', stage: 'closure', label: 'الشهادات الإلكترونية', href: '/admin/certificates', help: '/help#certificates',
    status: certs ? 'ok' : phase === 'after' ? 'warn' : 'na', detail: certs ? `${certs} شهادة` : phase === 'after' ? 'لم تُصدر شهادات' : 'بعد اكتمال البرنامج' });
  add({ id: 'followup', stage: 'closure', label: 'متابعة نقل الأثر (المستوى 3)', href: '/admin/followup', help: '/help#followups',
    status: fu ? 'ok' : phase === 'after' ? 'warn' : 'na', detail: fu ? `${fu} متابعة` : phase === 'after' ? 'لم تُجدول متابعة بعد 30–90 يومًا' : 'تُجدول بعد الانتهاء' });
  add({ id: 'kpis', stage: 'closure', label: 'مؤشرات النتائج المؤسسية (المستوى 4)', href: '/admin/outcomes', help: '/help#outcomes',
    status: kpis ? 'ok' : phase === 'after' ? 'warn' : 'na', detail: kpis ? `${kpis} مؤشر` : 'اختياري — يربط التدريب بنتائج المؤسسة' });

  const applicable = checks.filter(c => c.status !== 'na');
  const ok = applicable.filter(c => c.status === 'ok').length;
  const blockers = applicable.filter(c => c.status === 'missing').length;
  const score = applicable.length ? Math.round((ok + applicable.filter(c => c.status === 'warn').length * 0.5) / applicable.length * 100) : 100;
  const level = blockers === 0 && score >= 85 ? 'ready' : blockers <= 1 && score >= 55 ? 'almost' : 'not';
  return { program: p, phase, checks, score, level, ok, applicable: applicable.length, blockers };
}

export function levelLabel(l: Readiness['level']): string {
  return l === 'ready' ? 'جاهز' : l === 'almost' ? 'شبه جاهز' : 'غير جاهز';
}

/** أولوية العرض: البرامج القادمة الأقرب أولًا، ثم الجارية، ثم المنتهية */
export function sortByUrgency(list: Readiness[], today = new Date().toISOString().slice(0, 10)): Readiness[] {
  const rank = (r: Readiness) => r.phase === 'before' ? 0 : r.phase === 'during' ? 1 : 2;
  return [...list].sort((a, b) => rank(a) - rank(b) || (daysUntil(a.program.start_date, today) ?? 9999) - (daysUntil(b.program.start_date, today) ?? 9999) || a.score - b.score);
}

/** الخطوة التالية المقترحة: أول عائق، وإلا أول تحذير */
export function nextAction(r: Readiness): Check | null {
  return r.checks.find(c => c.status === 'missing') || r.checks.find(c => c.status === 'warn') || null;
}

export function readinessRows(list: Readiness[]): (string | number)[][] {
  const head = ['البرنامج', 'المرحلة', 'الجاهزية %', 'المستوى', 'عوائق', ...(list[0]?.checks.map(c => c.label) || [])];
  const rows = list.map(r => [r.program.name_ar, phaseLabel(r.phase), r.score, levelLabel(r.level), r.blockers, ...r.checks.map(c => c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : c.status === 'missing' ? '✗' : '—')]);
  return [head, ...rows];
}
