/**
 * Report catalog — the "menu" of report types available in the Reports Center.
 * Each entry declares its purpose, audience, the decision it supports and the
 * sections rendered. UI and exports are driven from this list.
 */
export type ReportId =
  | 'executive' | 'trainers' | 'programs' | 'classrooms' | 'axes' | 'questions'
  | 'trend' | 'comparison' | 'participation' | 'qualitative' | 'actions' | 'raw';

export type SectionId =
  | 'kpis' | 'verdict' | 'narrative' | 'strengthsGaps' | 'axisBars' | 'trendLine' | 'distribution'
  | 'trainerTable' | 'trainerBars' | 'programTable' | 'classroomTable' | 'heatmap' | 'questionTable'
  | 'periodCompare' | 'weeklyTable' | 'participationTables' | 'comments' | 'keywords' | 'actions' | 'rawTable';

export type ReportDef = {
  id: ReportId; icon: string; group: 'executive' | 'operations' | 'analysis' | 'decision';
  title: { ar: string; en: string }; desc: { ar: string; en: string };
  audience: { ar: string; en: string }; decision: { ar: string; en: string };
  sections: SectionId[];
  /** default filter overrides when opening this report */
  defaults?: { kind?: 'ALL' | 'DAILY' | 'FINAL'; compare?: boolean; preset?: string };
};

export const REPORT_GROUPS: { id: ReportDef['group']; ar: string; en: string }[] = [
  { id: 'executive', ar: 'تقارير تنفيذية', en: 'Executive' },
  { id: 'operations', ar: 'تقارير تشغيلية', en: 'Operations' },
  { id: 'analysis', ar: 'تقارير تحليلية', en: 'Analysis' },
  { id: 'decision', ar: 'دعم القرار', en: 'Decision support' },
];

export const REPORTS: ReportDef[] = [
  {
    id: 'executive', icon: '🏛️', group: 'executive',
    title: { ar: 'الموجز التنفيذي', en: 'Executive brief' },
    desc: { ar: 'صفحة واحدة: المؤشرات مقابل الهدف، الحكم العام، أبرز القوة والفجوات، وأهم 3 قرارات.', en: 'One page: KPIs vs target, verdict, top strengths/gaps and the 3 key decisions.' },
    audience: { ar: 'الإدارة العليا', en: 'Senior management' },
    decision: { ar: 'هل الأداء ضمن المستهدف؟ وأين نتدخل أولًا؟', en: 'Is performance on target? Where do we intervene first?' },
    sections: ['kpis', 'verdict', 'narrative', 'strengthsGaps', 'axisBars', 'trendLine', 'actions'],
    defaults: { compare: true },
  },
  {
    id: 'trainers', icon: '👨‍🏫', group: 'operations',
    title: { ar: 'أداء المدربين', en: 'Trainer performance' },
    desc: { ar: 'ترتيب المدربين بالمتوسط والعينة ونسبة التقييمات المنخفضة والتفاوت والاتجاه، مع تصنيف المخاطر.', en: 'Trainer ranking by mean, sample, low-rating %, variance and trend, with risk flags.' },
    audience: { ar: 'المشرف الأكاديمي', en: 'Academic supervision' },
    decision: { ar: 'من يستحق التكريم؟ ومن يحتاج دعمًا أو زيارة صفية؟', en: 'Who to recognise? Who needs coaching or observation?' },
    sections: ['kpis', 'trainerBars', 'trainerTable', 'heatmap', 'actions'],
    defaults: { kind: 'DAILY' },
  },
  {
    id: 'programs', icon: '📚', group: 'operations',
    title: { ar: 'مقارنة البرامج', en: 'Program comparison' },
    desc: { ar: 'كل برنامج: الاستجابات، المشاركون، المتوسط اليومي والختامي، الفجوة والمخاطر.', en: 'Per program: responses, participants, daily vs final means, gap and risk.' },
    audience: { ar: 'إدارة البرامج', en: 'Program management' },
    decision: { ar: 'أي البرامج تُوسَّع وأيها يُعاد تصميمه؟', en: 'Which programs to scale and which to redesign?' },
    sections: ['kpis', 'programTable', 'axisBars', 'actions'],
  },
  {
    id: 'classrooms', icon: '🏫', group: 'operations',
    title: { ar: 'القاعات والمجموعات', en: 'Rooms & groups' },
    desc: { ar: 'أداء كل قاعة/مجموعة مع مدربها، وخريطة حرارية للمحاور × القاعات.', en: 'Each room/group with its trainer, plus an axes × rooms heat map.' },
    audience: { ar: 'التشغيل اليومي', en: 'Daily operations' },
    decision: { ar: 'أي قاعة تحتاج تدخلًا هذا الأسبوع؟', en: 'Which room needs intervention this week?' },
    sections: ['kpis', 'classroomTable', 'heatmap', 'actions'],
    defaults: { kind: 'DAILY' },
  },
  {
    id: 'axes', icon: '🧭', group: 'analysis',
    title: { ar: 'تحليل المحاور', en: 'Axis analysis' },
    desc: { ar: 'متوسط كل محور، التوزيع، الفجوة للهدف، والتصنيف (ممتاز/جيد/مراقبة/خطر).', en: 'Each axis: mean, distribution, gap to target and rating band.' },
    audience: { ar: 'إدارة الجودة', en: 'Quality office' },
    decision: { ar: 'ما المحاور التي تستحق الاستثمار؟', en: 'Which axes deserve investment?' },
    sections: ['kpis', 'axisBars', 'distribution', 'strengthsGaps', 'actions'],
  },
  {
    id: 'questions', icon: '❓', group: 'analysis',
    title: { ar: 'تحليل الأسئلة', en: 'Question analysis' },
    desc: { ar: 'أدق مستوى: كل سؤال بمتوسطه وتوزيعه ونسبة المنخفض — لاكتشاف السبب الجذري.', en: 'Finest grain: every question with mean, distribution and low % — to find root causes.' },
    audience: { ar: 'المحللون', en: 'Analysts' },
    decision: { ar: 'ما السبب الدقيق خلف تدني محور ما؟', en: 'What exactly drives a weak axis?' },
    sections: ['kpis', 'questionTable'],
  },
  {
    id: 'trend', icon: '📈', group: 'analysis',
    title: { ar: 'الاتجاه الزمني', en: 'Time trend' },
    desc: { ar: 'المتوسط يوميًا وأسبوعيًا مع متوسط متحرك وخط الهدف، وجدول أسبوعي.', en: 'Daily and weekly mean with moving average and target line, plus weekly table.' },
    audience: { ar: 'إدارة البرامج', en: 'Program management' },
    decision: { ar: 'هل نتحسن أم نتراجع؟ ومتى حدث التغير؟', en: 'Improving or declining? When did it change?' },
    sections: ['kpis', 'trendLine', 'weeklyTable'],
  },
  {
    id: 'comparison', icon: '⚖️', group: 'analysis',
    title: { ar: 'مقارنة الفترات', en: 'Period comparison' },
    desc: { ar: 'الفترة الحالية مقابل فترة سابقة مساوية لها: التغير في المتوسط والاستجابات ونسب الرضا.', en: 'Current period vs an equal previous period: change in mean, responses and satisfaction shares.' },
    audience: { ar: 'الإدارة العليا', en: 'Senior management' },
    decision: { ar: 'هل أثّرت الإجراءات السابقة؟', en: 'Did previous actions work?' },
    sections: ['periodCompare', 'trendLine', 'axisBars'],
    defaults: { compare: true, preset: '30d' },
  },
  {
    id: 'participation', icon: '👥', group: 'operations',
    title: { ar: 'المشاركة والاستجابة', en: 'Participation & response' },
    desc: { ar: 'حجم الاستجابات حسب اليوم/القاعة/البرنامج/النوع، المشاركون الفريدون، والجنس والإقامة.', en: 'Response volume by day/room/program/kind, unique participants, gender and accommodation.' },
    audience: { ar: 'التشغيل', en: 'Operations' },
    decision: { ar: 'هل العينة كافية وممثلة قبل اتخاذ القرار؟', en: 'Is the sample sufficient and representative?' },
    sections: ['kpis', 'participationTables'],
  },
  {
    id: 'qualitative', icon: '💬', group: 'analysis',
    title: { ar: 'التعليقات النوعية', en: 'Qualitative feedback' },
    desc: { ar: 'كل التعليقات المفتوحة مع الانطباع (إيجابي/سلبي) والكلمات الأكثر تكرارًا.', en: 'All open comments with sentiment and most frequent keywords.' },
    audience: { ar: 'إدارة الجودة', en: 'Quality office' },
    decision: { ar: 'ماذا يقول المشاركون بكلماتهم؟', en: 'What do participants say in their own words?' },
    sections: ['keywords', 'comments'],
  },
  {
    id: 'actions', icon: '🎯', group: 'decision',
    title: { ar: 'سجل المخاطر وخطة الإجراءات', en: 'Risk register & action plan' },
    desc: { ar: 'قائمة إجراءات مولّدة تلقائيًا مرتبة بالأولوية والأثر، مع المسؤول والمدة ومؤشر النجاح.', en: 'Auto-generated actions ranked by priority and impact, with owner, due and success KPI.' },
    audience: { ar: 'لجنة الجودة', en: 'Quality committee' },
    decision: { ar: 'ما الذي نفعله، ومن، ومتى؟', en: 'What do we do, who, and by when?' },
    sections: ['kpis', 'actions'],
  },
  {
    id: 'raw', icon: '🗂️', group: 'decision',
    title: { ar: 'البيانات التفصيلية', en: 'Detailed data' },
    desc: { ar: 'جدول الاستجابات بعد التصفية (بدون بيانات شخصية) للتصدير والتحليل الخارجي.', en: 'Filtered responses table (no personal data) for export and external analysis.' },
    audience: { ar: 'المحللون', en: 'Analysts' },
    decision: { ar: 'تحليل مخصص في Excel / Power BI', en: 'Custom analysis in Excel / Power BI' },
    sections: ['kpis', 'rawTable'],
  },
];

export const PERIOD_PRESETS: { id: string; ar: string; en: string; days: number | null }[] = [
  { id: 'all', ar: 'كل الفترة', en: 'All time', days: null },
  { id: '7d', ar: 'آخر 7 أيام', en: 'Last 7 days', days: 7 },
  { id: '14d', ar: 'آخر 14 يومًا', en: 'Last 14 days', days: 14 },
  { id: '30d', ar: 'آخر 30 يومًا', en: 'Last 30 days', days: 30 },
  { id: '90d', ar: 'آخر 90 يومًا', en: 'Last 90 days', days: 90 },
  { id: 'custom', ar: 'فترة مخصصة', en: 'Custom', days: null },
];

export function reportById(id: string | null | undefined): ReportDef {
  return REPORTS.find(r => r.id === id) || REPORTS[0];
}
