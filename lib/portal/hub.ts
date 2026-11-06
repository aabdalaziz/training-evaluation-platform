// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «مؤشرات أَثَر» — الأبواب الحيّة (P42-ب)
 *  كل باب (/hub/<slug>) يعرض: مؤشرات أَثَر (أرقام حيّة من جداول البوابة تخصّ الصفة وحدها)
 *  + «ينتظر قرارك» (صفوف تنتظر قرارًا بشريًا، برابط مكانها) + «أول ثلاث خطوات» لمن يدخل أول مرة.
 *  القراءة بصلاحية الخدمة بعد التحقق من الصفة في المسار — ولا يُحتسب إلا عدّ/مجموع، لا أسماء.
 *  أي جدول غائب أو خطأ → المؤشر يعود null ويُعرض «—» (لا يُفشل الباب).
 */
export type DoorSlug = 'leadership' | 'programs' | 'diplomas' | 'quality' | 'operations' | 'finance' | 'expert' | 'trainer';
export type Door = { title_ar: string; title_en: string; roles: string[]; lead: string; links: { href: string; label: string; hint: string }[] };
export type Indicator = { key: string; label: string; value: number | string | null; unit?: string; hint?: string; href?: string; tone?: 'gold' | 'teal' | 'navy' | 'warn' };
export type Decision = { key: string; label: string; count: number; href: string; urgent?: boolean };
export type DoorLive = { slug: DoorSlug; indicators: Indicator[]; decisions: Decision[]; steps: string[]; computed_at: string };

export const DOOR_SLUGS: DoorSlug[] = ['leadership', 'programs', 'diplomas', 'quality', 'operations', 'finance', 'expert', 'trainer'];
export const DOORS: Record<DoorSlug, Door> = {
  leadership: { title_ar: 'باب القيادة', title_en: 'Leadership', roles: ['LEADERSHIP'], lead: 'نظرة الأثر لا التفاصيل: أين نقف اليوم؟ وما الذي يحتاج قرارًا بشريًا؟', links: [
    { href: '/admin/impact', label: 'أثر البرامج', hint: 'ما الذي تغيّر فعلًا' }, { href: '/admin/observatory', label: 'مرصد القدرة البشرية', hint: 'القطاعات والفجوات' }, { href: '/admin/sector-impact', label: 'الأثر القطاعي', hint: 'بالقطاع والجهة' }, { href: '/admin/health', label: 'صحة المنصة', hint: 'إشارات تحتاج قرارًا' }, { href: '/admin/councils', label: 'مجالس أَثَر', hint: 'الدورة الحالية' }] },
  programs: { title_ar: 'باب البرامج', title_en: 'Programs', roles: ['EXEC_PROGRAMS', 'EXEC_ARABIC'], lead: 'من التصميم إلى الشهادة: هندسة البرنامج، التسجيل، الحضور، التقييم.', links: [
    { href: '/admin/program-engineering', label: 'هندسة البرامج التدريبية', hint: 'تصميم ومراجعة' }, { href: '/admin/enrollments', label: 'التسجيل والقبول', hint: 'الطلبات والشُّعب' }, { href: '/admin/attendance', label: 'الحضور', hint: 'بالجلسة' }, { href: '/admin/live', label: 'الجلسات الحيّة', hint: 'Teams · Zoom · Meet' }, { href: '/admin/certificates', label: 'الشهادات', hint: 'إصدار وتحقق' }, { href: '/admin/miaar', label: 'مِعيار', hint: 'تحديد المستوى' }] },
  diplomas: { title_ar: 'باب الدبلومات', title_en: 'Diplomas', roles: ['EXEC_DIPLOMAS'], lead: 'المسارات الطويلة: الدفعات، التقدّم، الشهادة التي تكبر.', links: [
    { href: '/admin/program-engineering', label: 'هندسة البرامج', hint: 'مسارات الدبلوم' }, { href: '/admin/enrollments', label: 'الدفعات والقبول', hint: 'بالدبلوم' }, { href: '/admin/outcomes', label: 'المخرجات', hint: 'نواتج التعلّم' }, { href: '/admin/credentials', label: 'الاعتمادات', hint: 'الشهادة التي تكبر' }] },
  quality: { title_ar: 'باب الجودة', title_en: 'Quality', roles: ['QUALITY_MANAGER'], lead: 'الأدلة قبل الانطباعات: التقييمات، حلقة التحسين، قاعدة الأدلة.', links: [
    { href: '/admin/survey-settings', label: 'الاستبانات', hint: 'النماذج والمواعيد' }, { href: '/admin/evidence', label: 'قاعدة الأدلة', hint: 'ما يثبت الأثر' }, { href: '/admin/loop', label: 'التحسين المستمر', hint: 'اقتراحات بالأدلة' }, { href: '/admin/readiness', label: 'الجاهزية', hint: 'قبل الانطلاق' }, { href: '/admin/audit', label: 'سجل التدقيق', hint: 'من فعل ماذا' }] },
  operations: { title_ar: 'باب العمليات', title_en: 'Operations', roles: ['ADMIN_SUPERVISOR'], lead: 'اليوم التشغيلي: الوارد، التنبيهات، المهام، الإبلاغ.', links: [
    { href: '/admin/inbox', label: 'الوارد', hint: 'ما وصل اليوم' }, { href: '/admin/missions', label: 'المهام', hint: 'مَن يتابع ماذا' }, { href: '/admin/notifications', label: 'التنبيهات', hint: 'الإرسال والقنوات' }, { href: '/admin/outreach', label: 'الإبلاغ متعدد القنوات', hint: 'بريد · واتساب' }, { href: '/admin/followup', label: 'المتابعة', hint: 'بعد البرنامج' }] },
  finance: { title_ar: 'باب المالية', title_en: 'Finance', roles: ['FINANCE_MANAGER'], lead: 'المدفوعات والعقود والتحصيل — بلا الوصول إلى ما لا يخصّ المالية.', links: [
    { href: '/admin/payments', label: 'المدفوعات', hint: 'الحالة والتحصيل' }, { href: '/admin/contracts', label: 'العقود', hint: 'عقود التعاون' }, { href: '/admin/consulting', label: 'الاستشارات', hint: 'الطلبات والعروض' }] },
  expert: { title_ar: 'باب الخبراء', title_en: 'Experts & consultants', roles: ['CONSULTANT', 'EXPERT'], lead: 'سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر — ومهامك عقدٌ على كل مهمة.', links: [
    { href: '/experts', label: 'هيئة أَثَر — الخبراء', hint: 'ملفك العام' }, { href: '/me', label: 'مساحتي', hint: 'سيرتك ومهامك' }, { href: '/admin/consulting', label: 'الاستشارات', hint: 'المهام المسندة' }] },
  trainer: { title_ar: 'باب المدرّبين', title_en: 'Trainers', roles: ['TRAINER'], lead: 'برامجك، جلساتك الحيّة، حضور متدرّبيك، وما قاله المتدرّبون عن الأثر.', links: [
    { href: '/me/day', label: 'دفتر اليوم', hint: 'صباحك في صفحة واحدة: جلساتك، من غاب، من توقّف، و«كلمة»' }, /* P51 */ { href: '/trainers', label: 'هيئة أَثَر — المدرّبون', hint: 'ملفك العام' }, { href: '/admin/live', label: 'جلساتي الحيّة', hint: 'الغرف والروابط' }, { href: '/admin/attendance', label: 'الحضور', hint: 'جلساتك' }, { href: '/me', label: 'مساحتي', hint: 'سيرتك وشهاداتك' }] },
};

export const DOOR_STEPS: Record<DoorSlug, [string, string, string]> = {
  leadership: ['افتح «أثر البرامج» واقرأ ما تغيّر فعلًا في آخر 30 يومًا', 'راجع «ما ينتظر قرارك» — القرار البشري هو ما يحوّل الاقتراح إلى فعل', 'اطلب من «أثير» ملخّصًا تنفيذيًا: Ctrl+K ثم اكتب سؤالك بعلامة ؟'],
  programs: ['ابدأ بطلبات التسجيل المعلّقة — كل طلب هو إنسان ينتظر', 'افتح جلسات اليوم وتأكّد من روابط الغرف قبل موعدها بساعة', 'راجع مسودّات هندسة البرامج الجاهزة للنشر'],
  diplomas: ['راجع دفعات الدبلوم وطلبات القبول المعلّقة', 'تابع المخرجات: أيّ ناتج تعلّم لم يُقَس بعد؟', 'اعتمد الشهادات التي اكتملت شروطها — «الشهادة التي تكبر» تبدأ من هنا'],
  quality: ['اقرأ اقتراحات حلقة التحسين — اقبل أو ارفض بالأدلة', 'اعتمد بنود بنك مِعيار «قيد المراجعة» مستوى مستوى', 'تحقّق من الاستبانات المفتوحة ومواعيد إغلاقها'],
  operations: ['ابدأ بالوارد الجديد ثم المهام المتأخرة', 'طلبات حقوق البيانات لها 30 يومًا نظامًا — الأقدم أولًا', 'راجع التنبيهات: ما أُرسل وما فشل وما ينتظر قناة بديلة'],
  finance: ['الفواتير «قيد المراجعة» تحتاج تأكيد الدفع يدويًا', 'راجع المتأخّر عن موعده وتواصل عبر قناة المشارك المفضّلة', 'عقود الأثر النشطة: ما الدفعة التالية وما دليلها؟'],
  expert: ['أكمل سيرتك في هيئة أَثَر — الصورة شرط للاعتماد', 'راجع عقود المهام المقترحة ووقّع ما توافق عليه', 'فعّل «أثر معك» ليصلك ما يخصّك فقط'],
  trainer: ['راجع جلساتك القادمة وجرّب رابط الغرفة', 'سجّل الحضور في نهاية كل جلسة — هو دليل الأثر الأول', 'اقرأ ما قاله متدرّبوك في مرآة الأداء'],
};

export const doorFor = (slug: string): Door | null => (DOOR_SLUGS as string[]).includes(slug) ? DOORS[slug as DoorSlug] : null;
export const doorAllowed = (slug: string, roles: string[]) => { const d = doorFor(slug); return !!d && (roles.includes('ADMIN') || d.roles.some(r => roles.includes(r))); };

/* ---------- العدّ الآمن ---------- */
type Q = (q: any) => any;
const iso = (d: Date) => d.toISOString();
const ago = (days: number) => iso(new Date(Date.now() - days * 864e5));
const ahead = (days: number) => iso(new Date(Date.now() + days * 864e5));
const today0 = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return iso(d); };
const today1 = () => { const d = new Date(); d.setUTCHours(24, 0, 0, 0); return iso(d); };

/** عدّ صفوف جدول بعد مرشّحات — null عند أي خطأ */
export async function countRows(db: any, table: string, apply: Q = q => q): Promise<number | null> {
  try { const { count, error } = await apply(db.from(table).select('id', { count: 'exact', head: true })); return error ? null : (typeof count === 'number' ? count : 0); } catch { return null; }
}
/** مجموع عمود رقمي (حتى 2000 صف) — null عند أي خطأ */
export async function sumRows(db: any, table: string, col: string, apply: Q = q => q): Promise<{ n: number; sum: number } | null> {
  try { const { data, error } = await apply(db.from(table).select(col).limit(2000)); if (error || !Array.isArray(data)) return null; return { n: data.length, sum: Math.round(data.reduce((a: number, r: any) => a + (Number(r[col]) || 0), 0)) }; } catch { return null; }
}
const money = (v: { n: number; sum: number } | null) => v == null ? null : v.sum;

/* ---------- مؤشرات كل باب ---------- */
type Me = { id: string; email: string };
type Calc = (db: any, me: Me) => Promise<{ indicators: Indicator[]; decisions: Decision[] }>;

const dec = (key: string, label: string, count: number | null, href: string, urgent = false): Decision | null => count && count > 0 ? { key, label, count, href, urgent } : null;
const dropNull = <T,>(xs: (T | null)[]) => xs.filter((x): x is T => x !== null);

/** جلسات اليوم / الأسبوع / على الهواء — تُستخدم في أكثر من باب */
async function sessionsBlock(db: any, extra: Q = q => q): Promise<Indicator[]> {
  const [today, week, live] = await Promise.all([
    countRows(db, 'portal_sessions', q => extra(q).gte('starts_at', today0()).lt('starts_at', today1()).neq('status', 'cancelled')),
    countRows(db, 'portal_sessions', q => extra(q).gte('starts_at', today0()).lt('starts_at', ahead(7)).neq('status', 'cancelled')),
    countRows(db, 'portal_sessions', q => extra(q).eq('status', 'live')),
  ]);
  return [
    { key: 'sessions_today', label: 'جلسات اليوم', value: today, href: '/admin/live', tone: 'navy' },
    { key: 'sessions_week', label: 'جلسات الأسبوع', value: week, href: '/admin/live' },
    { key: 'sessions_live', label: 'على الهواء الآن', value: live, href: '/admin/live', tone: live ? 'gold' : undefined },
  ];
}

const CALC: Record<DoorSlug, Calc> = {
  async leadership(db) {
    const [programs, enr30, cred30, plc30, contracts, contractsSum, loop, incidents, drafts, placementsAll] = await Promise.all([
      countRows(db, 'programs', q => q.eq('is_public', true)),
      countRows(db, 'portal_enrollments', q => q.eq('status', 'approved').gte('decided_at', ago(30))),
      countRows(db, 'portal_credentials', q => q.is('revoked_at', null).gte('issued_at', ago(30))),
      countRows(db, 'portal_placements', q => q.gte('created_at', ago(30))),
      countRows(db, 'portal_impact_contracts', q => q.eq('status', 'active')),
      sumRows(db, 'portal_impact_contracts', 'total_amount', q => q.eq('status', 'active')),
      countRows(db, 'portal_loop_suggestions', q => q.eq('status', 'draft')),
      countRows(db, 'portal_incidents', q => q.in('status', ['open', 'reported'])),
      countRows(db, 'portal_program_drafts', q => q.eq('stage', 'reviewed')),
      countRows(db, 'portal_placements'),
    ]);
    const sess = await sessionsBlock(db);
    return {
      indicators: [
        { key: 'programs', label: 'برامج معلنة', value: programs, href: '/programs', tone: 'navy' },
        { key: 'enrolled_30', label: 'مقبولون خلال 30 يومًا', value: enr30, href: '/admin/enrollments', tone: 'teal' },
        { key: 'credentials_30', label: 'شهادات صدرت خلال 30 يومًا', value: cred30, href: '/admin/credentials', tone: 'gold' },
        { key: 'placements_30', label: 'اختبارات مِعيار خلال 30 يومًا', value: plc30, hint: placementsAll != null ? `الإجمالي ${placementsAll}` : undefined, href: '/admin/placements' },
        { key: 'contracts_active', label: 'عقود أثر نشطة', value: contracts, unit: contractsSum != null ? `${money(contractsSum)?.toLocaleString('en-US')} ر.س` : undefined, href: '/admin/contracts' },
        sess[1],
      ],
      decisions: dropNull([dec('loop', 'اقتراح تحسين ينتظر قرارًا', loop, '/admin/loop'), dec('drafts', 'برنامج مُراجَع ينتظر النشر', drafts, '/admin/program-engineering'), dec('incidents', 'حادثة أمن مفتوحة', incidents, '/admin/shield', true)]),
    };
  },
  async programs(db) {
    const [pending, approved30, waitlist, drafts, orgReq, cred30] = await Promise.all([
      countRows(db, 'portal_enrollments', q => q.eq('status', 'pending')),
      countRows(db, 'portal_enrollments', q => q.eq('status', 'approved').gte('decided_at', ago(30))),
      countRows(db, 'portal_enrollments', q => q.eq('status', 'waitlisted')),
      countRows(db, 'portal_program_drafts', q => q.eq('stage', 'reviewed')),
      countRows(db, 'portal_org_requests', q => q.in('status', ['new', 'reviewing'])),
      countRows(db, 'portal_credentials', q => q.eq('kind', 'program_completion').is('revoked_at', null).gte('issued_at', ago(30))),
    ]);
    const sess = await sessionsBlock(db);
    return {
      indicators: [sess[0], sess[2], sess[1],
        { key: 'approved_30', label: 'مقبولون خلال 30 يومًا', value: approved30, href: '/admin/enrollments', tone: 'teal' },
        { key: 'waitlist', label: 'على قائمة الانتظار', value: waitlist, href: '/admin/enrollments' },
        { key: 'completions_30', label: 'شهادات إتمام خلال 30 يومًا', value: cred30, href: '/admin/credentials', tone: 'gold' }],
      decisions: dropNull([dec('enroll', 'طلب تسجيل ينتظر القبول', pending, '/admin/enrollments', true), dec('org', 'طلب جهة ينتظر الردّ', orgReq, '/admin/consulting'), dec('drafts', 'برنامج مُراجَع ينتظر النشر', drafts, '/admin/program-engineering')]),
    };
  },
  async diplomas(db) {
    const [pending, approved30, drafts, cred30, outcomes] = await Promise.all([
      countRows(db, 'portal_enrollments', q => q.eq('status', 'pending')),
      countRows(db, 'portal_enrollments', q => q.eq('status', 'approved').gte('decided_at', ago(30))),
      countRows(db, 'portal_program_drafts', q => q.eq('stage', 'reviewed')),
      countRows(db, 'portal_credentials', q => q.eq('kind', 'program_completion').is('revoked_at', null).gte('issued_at', ago(30))),
      countRows(db, 'outcome_measurements', q => q.gte('created_at', ago(30))),
    ]);
    const sess = await sessionsBlock(db);
    return {
      indicators: [
        { key: 'approved_30', label: 'مقبولون خلال 30 يومًا', value: approved30, href: '/admin/enrollments', tone: 'teal' },
        sess[1],
        { key: 'outcomes_30', label: 'قياسات مخرجات خلال 30 يومًا', value: outcomes, href: '/admin/outcomes' },
        { key: 'completions_30', label: 'شهادات إتمام خلال 30 يومًا', value: cred30, href: '/admin/credentials', tone: 'gold' }],
      decisions: dropNull([dec('enroll', 'طلب قبول ينتظر القرار', pending, '/admin/enrollments', true), dec('drafts', 'مسار مُراجَع ينتظر النشر', drafts, '/admin/program-engineering')]),
    };
  },
  async quality(db) {
    const [ev30, loop, bank, incidents, plc30, evidence] = await Promise.all([
      countRows(db, 'evaluations', q => q.gte('submitted_at', ago(30))),
      countRows(db, 'portal_loop_suggestions', q => q.eq('status', 'draft')),
      countRows(db, 'question_bank_items', q => q.eq('status', 'in_review')),
      countRows(db, 'portal_incidents', q => q.in('status', ['open', 'reported'])),
      countRows(db, 'portal_placements', q => q.gte('created_at', ago(30))),
      countRows(db, 'portal_evidence_queries', q => q.gte('created_at', ago(30))),
    ]);
    return {
      indicators: [
        { key: 'evaluations_30', label: 'تقييمات خلال 30 يومًا', value: ev30, href: '/admin/survey-settings', tone: 'navy' },
        { key: 'placements_30', label: 'اختبارات مِعيار خلال 30 يومًا', value: plc30, href: '/admin/placements' },
        { key: 'evidence_30', label: 'استعلامات أدلة خلال 30 يومًا', value: evidence, href: '/admin/evidence' },
        { key: 'bank_review', label: 'بنود بنك قيد المراجعة', value: bank, href: '/admin/miaar/bank', tone: bank ? 'gold' : undefined }],
      decisions: dropNull([dec('loop', 'اقتراح تحسين ينتظر قرارك', loop, '/admin/loop', true), dec('bank', 'بند مِعيار ينتظر الاعتماد', bank, '/admin/miaar/bank'), dec('incidents', 'حادثة مفتوحة', incidents, '/admin/shield')]),
    };
  },
  async operations(db) {
    const [inbox, overdue, missionsOpen, seats, dsr, incidents, pending, notif] = await Promise.all([
      countRows(db, 'portal_contact_messages', q => q.eq('status', 'new')),
      countRows(db, 'portal_missions', q => q.eq('status', 'assigned').lt('due_at', iso(new Date()))),
      countRows(db, 'portal_missions', q => q.in('status', ['assigned', 'submitted'])),
      countRows(db, 'portal_org_seat_requests', q => q.eq('status', 'pending')),
      countRows(db, 'portal_dsr_requests', q => q.in('status', ['open', 'extended'])),
      countRows(db, 'portal_incidents', q => q.in('status', ['open', 'reported'])),
      countRows(db, 'portal_enrollments', q => q.eq('status', 'pending')),
      countRows(db, 'portal_message_log', q => q.eq('status', 'failed').gte('created_at', ago(7))),
    ]);
    const sess = await sessionsBlock(db);
    return {
      indicators: [sess[0],
        { key: 'missions_open', label: 'مهام جارية', value: missionsOpen, href: '/admin/missions' },
        { key: 'overdue', label: 'مهام متأخّرة', value: overdue, href: '/admin/missions', tone: overdue ? 'warn' : undefined },
        { key: 'failed_7', label: 'رسائل فشلت خلال 7 أيام', value: notif, href: '/admin/notifications', tone: notif ? 'warn' : undefined },
        { key: 'pending', label: 'طلبات تسجيل معلّقة', value: pending, href: '/admin/enrollments' }],
      decisions: dropNull([dec('inbox', 'رسالة واردة جديدة', inbox, '/admin/inbox', true), dec('dsr', 'طلب حقوق بيانات مفتوح (30 يومًا نظامًا)', dsr, '/admin/vault', true), dec('seats', 'طلب مقاعد جهة', seats, '/admin/consulting'), dec('incidents', 'حادثة أمن مفتوحة', incidents, '/admin/shield', true)]),
    };
  },
  async finance(db) {
    const [unpaid, unpaidSum, review, overdue, paid30, contracts, contractsSum, quotes, engagements, engagementsSum] = await Promise.all([
      countRows(db, 'portal_invoices', q => q.eq('status', 'unpaid')),
      sumRows(db, 'portal_invoices', 'total', q => q.eq('status', 'unpaid')),
      countRows(db, 'portal_invoices', q => q.eq('status', 'under_review')),
      countRows(db, 'portal_invoices', q => q.eq('status', 'unpaid').lt('due_date', iso(new Date()).slice(0, 10))),
      sumRows(db, 'portal_invoices', 'total', q => q.eq('status', 'paid').gte('paid_at', ago(30))),
      countRows(db, 'portal_impact_contracts', q => q.eq('status', 'active')),
      sumRows(db, 'portal_impact_contracts', 'total_amount', q => q.eq('status', 'active')),
      countRows(db, 'portal_consulting_quotes', q => q.eq('status', 'sent')),
      countRows(db, 'portal_directory_engagements', q => q.eq('status', 'active')),
      sumRows(db, 'portal_directory_engagements', 'fee_amount', q => q.eq('status', 'active')),
    ]);
    const sar = (v: number | null) => v == null || v === 0 ? undefined : `${v.toLocaleString('en-US')} ر.س`;
    return {
      indicators: [
        { key: 'paid_30', label: 'محصَّل خلال 30 يومًا', value: paid30 ? paid30.n : null, unit: sar(money(paid30)), href: '/admin/payments', tone: 'teal' },
        { key: 'unpaid', label: 'فواتير غير مدفوعة', value: unpaid, unit: sar(money(unpaidSum)), href: '/admin/payments', tone: 'navy' },
        { key: 'overdue', label: 'متأخّرة عن موعدها', value: overdue, href: '/admin/payments', tone: overdue ? 'warn' : undefined },
        { key: 'contracts', label: 'عقود أثر نشطة', value: contracts, unit: sar(money(contractsSum)), href: '/admin/contracts', tone: 'gold' },
        { key: 'engagements', label: 'مهام هيئة أَثَر نشطة', value: engagements, unit: sar(money(engagementsSum)), href: '/admin/directory' },
        { key: 'quotes', label: 'عروض أسعار مرسلة', value: quotes, href: '/admin/consulting' }],
      decisions: dropNull([dec('review', 'فاتورة قيد المراجعة تنتظر تأكيد الدفع', review, '/admin/payments', true), dec('overdue', 'فاتورة متأخّرة تحتاج متابعة', overdue, '/admin/payments')]),
    };
  },
  async expert(db, me) { return personalDoor(db, me, 'expert'); },
  async trainer(db, me) { return personalDoor(db, me, 'trainer'); },
};

const PROFILE_STATE_AR: Record<string, string> = { draft: 'مسودّة', submitted: 'بانتظار الاعتماد', approved: 'معتمَدة', changes_requested: 'تحتاج تعديلًا', suspended: 'موقوفة' };

/** الباب الشخصي (الخبير/المدرّب): ما يخصّ صاحبه فقط — بالبريد/الحساب */
async function personalDoor(db: any, me: Me, face: 'expert' | 'trainer'): Promise<{ indicators: Indicator[]; decisions: Decision[] }> {
  const email = (me.email || '').toLowerCase();
  let profile: any = null;
  try { const { data } = await db.from('portal_directory_profiles').select('id,status,faces,slug,approved_at').or(`user_id.eq.${me.id},email.ilike.${email || 'x@x'}`).limit(1); profile = data?.[0] || null; } catch { profile = null; }
  const pid = profile?.id || null; const dirHref = face === 'expert' ? '/experts' : '/trainers';
  const byMe = (q: any) => pid ? q.or(`profile_id.eq.${pid},email.ilike.${email}`) : q.ilike('email', email || 'x@x');
  const [proposed, active, completed, feeActive] = await Promise.all([
    countRows(db, 'portal_directory_engagements', q => byMe(q).eq('status', 'proposed')),
    countRows(db, 'portal_directory_engagements', q => byMe(q).eq('status', 'active')),
    countRows(db, 'portal_directory_engagements', q => byMe(q).in('status', ['completed', 'settled'])),
    sumRows(db, 'portal_directory_engagements', 'fee_amount', q => byMe(q).eq('status', 'active')),
  ]);
  const indicators: Indicator[] = [
    { key: 'profile', label: 'سيرتي في هيئة أَثَر', value: profile ? (PROFILE_STATE_AR[profile.status] || profile.status) : 'لم تُنشأ بعد', href: profile?.slug && profile.status === 'approved' ? `${dirHref}/${profile.slug}` : dirHref, tone: profile?.status === 'approved' ? 'teal' : 'gold' },
    { key: 'active', label: 'مهام نشطة', value: active, unit: feeActive && feeActive.sum ? `${feeActive.sum.toLocaleString('en-US')} ر.س` : undefined, href: '/me', tone: 'navy' },
    { key: 'completed', label: 'مهام مكتملة', value: completed, href: '/me' },
  ];
  const decisions: Decision[] = dropNull([dec('proposed', 'عقد مهمة مقترح ينتظر توقيعك', proposed, '/me', true)]);
  if (face === 'trainer') {
    let tids: string[] = [];
    try { const { data } = await db.from('trainers').select('id').ilike('email', email || 'x@x').limit(5); tids = (data || []).map((t: any) => t.id); } catch { tids = []; }
    if (tids.length) {
      const [today, upcoming, live, done30] = await Promise.all([
        countRows(db, 'portal_sessions', q => q.in('trainer_id', tids).gte('starts_at', today0()).lt('starts_at', today1()).neq('status', 'cancelled')),
        countRows(db, 'portal_sessions', q => q.in('trainer_id', tids).gte('starts_at', iso(new Date())).lt('starts_at', ahead(14)).neq('status', 'cancelled')),
        countRows(db, 'portal_sessions', q => q.in('trainer_id', tids).eq('status', 'live')),
        countRows(db, 'portal_sessions', q => q.in('trainer_id', tids).eq('status', 'ended').gte('starts_at', ago(30))),
      ]);
      indicators.push({ key: 'sessions_today', label: 'جلساتي اليوم', value: today, href: '/me/day', tone: today ? 'gold' : undefined }, { key: 'upcoming', label: 'جلساتي خلال 14 يومًا', value: upcoming, href: '/admin/live' }, { key: 'done_30', label: 'جلسات أنهيتها خلال 30 يومًا', value: done30, href: '/admin/attendance' });
      if (live) decisions.unshift({ key: 'live', label: 'جلسة لك على الهواء الآن', count: live, href: '/admin/live', urgent: true });
    } else indicators.push({ key: 'sessions_today', label: 'جلساتي اليوم', value: null, hint: 'لم يُربط بريدك ببطاقة مدرّب بعد — اطلب ذلك من إدارة البرامج', href: '/admin/live' });
  }
  if (profile && profile.status === 'submitted') decisions.push({ key: 'awaiting', label: 'سيرتك بانتظار اعتماد الطاقم — لا إجراء منك', count: 1, href: dirHref });
  if (!profile || profile.status === 'draft' || profile.status === 'changes_requested') decisions.unshift({ key: 'cv', label: profile ? 'سيرتك تحتاج استكمالًا قبل الاعتماد' : 'أنشئ سيرتك في هيئة أَثَر', count: 1, href: dirHref, urgent: true });
  return { indicators, decisions };
}

/** حساب باب كامل */
export async function doorLive(db: any, slug: DoorSlug, me: Me): Promise<DoorLive> {
  const r = await CALC[slug](db, me);
  return { slug, indicators: r.indicators, decisions: r.decisions, steps: DOOR_STEPS[slug], computed_at: new Date().toISOString() };
}
