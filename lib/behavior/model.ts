/**
 * متابعة أثر التدريب في بيئة العمل (كيركباتريك — المستوى 3: السلوك)
 * النماذج، القالب الافتراضي، تحليل النتائج، وقائمة المستلمين — بدون تبعيات
 */

export type FollowupStatus = 'draft' | 'open' | 'closed';
export type BehaviorKind = 'scale' | 'percent' | 'multi' | 'text';
export type Audience = 'all' | 'supervisor' | 'trainee';
export type Role = 'supervisor' | 'trainee' | 'peer';

export type BehaviorQuestion = {
  id: string; followup_id?: string; order_no: number; kind: BehaviorKind; audience: Audience;
  domain_ar: string | null; text_ar: string; text_en?: string | null; options?: string[] | null; required?: boolean;
};

export type Recipient = { name: string; email: string; role: Role; trainee_name?: string; trainee_email?: string };

export type BehaviorFollowup = {
  id: string; organization_id?: string | null; program_id: string | null; classroom_id: string | null;
  title_ar: string; title_en?: string | null; intro_ar?: string | null; token: string; status: FollowupStatus;
  scale_max: number; due_days: number; open_at: string | null; supervisor_open: boolean; trainee_open: boolean;
  auto_send: boolean; remind_after_days: number; recipients: Recipient[]; sent_at?: string | null; reminded_at?: string | null;
  created_by?: string | null; created_by_name?: string | null; created_at?: string; updated_at?: string;
};

export type BehaviorResponse = {
  id: string; followup_id: string; role: Role; respondent_hash: string; respondent_label: string | null;
  trainee_key: string; trainee_label: string | null; answers: Record<string, any>; scale_mean: number | null;
  application_pct: number | null; barriers: string[]; comment: string | null; submitted_at: string;
};

export const ROLE_LABEL: Record<Role, { ar: string; en: string }> = {
  supervisor: { ar: 'المشرف المباشر', en: 'Direct supervisor' },
  trainee: { ar: 'المتدرب (تقييم ذاتي)', en: 'Trainee (self-assessment)' },
  peer: { ar: 'زميل عمل', en: 'Peer' },
};
export const KIND_LABEL: Record<BehaviorKind, string> = { scale: 'مقياس 1–5', percent: 'نسبة التطبيق %', multi: 'اختيار متعدد (معوقات)', text: 'إجابة مفتوحة' };
export const AUDIENCE_LABEL: Record<Audience, string> = { all: 'الجميع', supervisor: 'المشرف فقط', trainee: 'المتدرب فقط' };

export const PERCENT_STEPS = [0, 25, 50, 75, 100];
export const DEFAULT_BARRIERS = ['ضيق الوقت وضغط العمل', 'عدم توفر دعم الإدارة', 'نقص الأدوات أو الموارد', 'المحتوى غير مرتبط بطبيعة العمل', 'لم تتوفر فرصة للتطبيق بعد', 'مقاومة التغيير لدى الفريق', 'لا توجد معوقات'];

/** القالب الافتراضي — 10 بنود (مشترك + خاص بكل دور) */
export const TEMPLATE: Omit<BehaviorQuestion, 'id'>[] = [
  { order_no: 1, kind: 'scale', audience: 'all', domain_ar: 'التطبيق', text_ar: 'يطبّق المهارات والمعارف المكتسبة من البرنامج في مهام العمل اليومية', text_en: 'Applies the skills and knowledge gained from the program in daily work tasks' },
  { order_no: 2, kind: 'scale', audience: 'all', domain_ar: 'التطبيق', text_ar: 'يستخدم أساليب أو أدوات جديدة تعلّمها في البرنامج', text_en: 'Uses new methods or tools learned in the program' },
  { order_no: 3, kind: 'scale', audience: 'all', domain_ar: 'الأداء', text_ar: 'تحسّنت جودة أدائه في المهام المرتبطة بموضوع البرنامج', text_en: 'Quality of performance in program-related tasks has improved' },
  { order_no: 4, kind: 'scale', audience: 'all', domain_ar: 'الأداء', text_ar: 'أصبح أكثر كفاءة (وقتًا وجهدًا) في إنجاز المهام ذات الصلة', text_en: 'Has become more efficient (time and effort) in related tasks' },
  { order_no: 5, kind: 'scale', audience: 'all', domain_ar: 'نقل الأثر', text_ar: 'يشارك زملاءه ما تعلّمه وينقل الخبرة إلى الفريق', text_en: 'Shares what was learned with colleagues and transfers it to the team' },
  { order_no: 6, kind: 'scale', audience: 'all', domain_ar: 'نقل الأثر', text_ar: 'انعكس التدريب بشكل ملموس على نتائج العمل أو رضا المستفيدين', text_en: 'Training has had a tangible effect on work results or beneficiary satisfaction' },
  { order_no: 7, kind: 'scale', audience: 'supervisor', domain_ar: 'الدعم', text_ar: 'وفّرت له فرصًا وموارد لتطبيق ما تعلّمه', text_en: 'I provided opportunities and resources to apply what was learned' },
  { order_no: 8, kind: 'percent', audience: 'all', domain_ar: 'التطبيق', text_ar: 'ما نسبة ما تم تطبيقه فعليًا من محتوى البرنامج في العمل حتى الآن؟', text_en: 'What percentage of the program content has actually been applied at work so far?' },
  { order_no: 9, kind: 'multi', audience: 'all', domain_ar: 'المعوقات', text_ar: 'ما أبرز معوقات تطبيق ما تم تعلّمه؟ (اختر كل ما ينطبق)', text_en: 'Main barriers to applying what was learned (select all that apply)', options: DEFAULT_BARRIERS },
  { order_no: 10, kind: 'text', audience: 'all', domain_ar: 'أمثلة', text_ar: 'اذكر مثالًا واقعيًا على تطبيق ما تم تعلّمه، أو مقترحًا لتعزيز الأثر', text_en: 'Give a real example of applying what was learned, or a suggestion to strengthen impact', required: false },
];

export function makeToken(rand: () => number = Math.random): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}
export function followupUrl(token: string, role?: Role, trainee?: { name?: string; email?: string }): string {
  const base = (typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '')).replace(/\/$/, '');
  const qp = new URLSearchParams();
  if (role) qp.set('role', role);
  if (trainee?.name) qp.set('tn', trainee.name);
  if (trainee?.email) qp.set('te', trainee.email);
  const q = qp.toString();
  return `${base}/followup/${token}${q ? '?' + q : ''}`;
}

/** تاريخ الإرسال المقترح = نهاية البرنامج + due_days (YYYY-MM-DD) */
export function suggestOpenAt(programEnd: string | null | undefined, dueDays: number, today = new Date()): string {
  const base = programEnd ? new Date(programEnd + 'T00:00:00Z') : today;
  const d = new Date(base.getTime() + Math.max(0, dueDays) * 86400000);
  return d.toISOString().slice(0, 10);
}

/* ---------------- المستلمون ---------------- */
/** صيغة السطر: الاسم, البريد, الدور[, اسم المتدرب, بريد المتدرب]
 *  الدور: مشرف | supervisor | متدرب | trainee | زميل | peer (افتراضيًا متدرب) */
export function parseRecipients(text: string): { recipients: Recipient[]; warnings: string[] } {
  const out: Recipient[] = []; const warnings: string[] = []; const seen = new Set<string>();
  const roleOf = (s: string): Role | null => {
    const t = s.trim().toLowerCase();
    if (!t) return null;
    if (/^(مشرف|supervisor|sup|مدير)/.test(t)) return 'supervisor';
    if (/^(متدرب|trainee|self|ذاتي)/.test(t)) return 'trainee';
    if (/^(زميل|peer)/.test(t)) return 'peer';
    return null;
  };
  text.split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim(); if (!raw) return;
    const parts = raw.split(/[,،;\t]/).map(x => x.trim());
    const name = parts[0] || ''; const email = (parts[1] || '').toLowerCase();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { warnings.push(`السطر ${i + 1}: يلزم اسم وبريد صحيح`); return; }
    const role = roleOf(parts[2] || '') || 'trainee';
    const r: Recipient = { name, email, role };
    if (role !== 'trainee') { if (parts[3]) r.trainee_name = parts[3]; if (parts[4]) r.trainee_email = parts[4].toLowerCase(); }
    const key = `${email}|${role}|${r.trainee_email || r.trainee_name || ''}`;
    if (seen.has(key)) return; seen.add(key); out.push(r);
  });
  return { recipients: out, warnings };
}
export function recipientsText(rs: Recipient[]): string {
  return rs.map(r => [r.name, r.email, r.role === 'supervisor' ? 'مشرف' : r.role === 'peer' ? 'زميل' : 'متدرب', r.trainee_name || '', r.trainee_email || ''].filter((x, i) => i < 3 || x).join(', ')).join('\n');
}

/* ---------------- التحليل ---------------- */
export type BarrierCount = { label: string; n: number; pct: number };
export type DomainMean = { domain: string; supervisor: number | null; trainee: number | null; n_sup: number; n_tr: number };
export type Pair = { trainee_key: string; label: string; supervisor: number | null; trainee: number | null; gap: number | null; app_sup: number | null; app_tr: number | null };
export type TransferSummary = {
  n: number; n_sup: number; n_tr: number; n_trainees: number;
  mean_sup: number | null; mean_tr: number | null; mean_all: number | null;
  app_sup: number | null; app_tr: number | null; app_all: number | null;
  transfer_index: number | null; // 0..100
  gap: number | null;            // مشرف − متدرب (سلبي = المتدرب يبالغ في تقدير نفسه)
  barriers: BarrierCount[]; domains: DomainMean[]; pairs: Pair[]; comments: { role: Role; who: string | null; text: string }[];
  label: { ar: string; tone: 'ok' | 'info' | 'warn' | 'bad' };
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r2 = (x: number | null) => (x == null ? null : Math.round(x * 100) / 100);

export function transferLabel(idx: number | null): { ar: string; tone: 'ok' | 'info' | 'warn' | 'bad' } {
  if (idx == null) return { ar: 'لا توجد بيانات كافية', tone: 'info' };
  if (idx >= 75) return { ar: 'نقل أثر قوي', tone: 'ok' };
  if (idx >= 60) return { ar: 'نقل أثر جيد', tone: 'info' };
  if (idx >= 45) return { ar: 'نقل أثر محدود — يحتاج دعمًا', tone: 'warn' };
  return { ar: 'نقل أثر ضعيف — تدخل عاجل', tone: 'bad' };
}

/**
 * مؤشر نقل الأثر (0–100) = متوسط ( المقياس محوَّلًا إلى % ، نسبة التطبيق المصرّح بها )
 * مع ترجيح تقدير المشرف (60%) على التقدير الذاتي (40%) إن توفّر الاثنان.
 */
export function analyze(questions: BehaviorQuestion[], responses: BehaviorResponse[], scaleMax = 5): TransferSummary {
  const sup = responses.filter(r => r.role === 'supervisor'); const tr = responses.filter(r => r.role === 'trainee');
  const means = (rs: BehaviorResponse[]) => avg(rs.map(r => r.scale_mean).filter((x): x is number => x != null));
  const apps = (rs: BehaviorResponse[]) => avg(rs.map(r => r.application_pct).filter((x): x is number => x != null));
  const mean_sup = means(sup), mean_tr = means(tr), mean_all = means(responses);
  const app_sup = apps(sup), app_tr = apps(tr), app_all = apps(responses);
  const toPct = (m: number | null) => (m == null ? null : (100 * (m - 1)) / Math.max(1, scaleMax - 1));
  const idxOf = (m: number | null, a: number | null) => { const parts = [toPct(m), a].filter((x): x is number => x != null); return parts.length ? avg(parts) : null; };
  const iSup = idxOf(mean_sup, app_sup), iTr = idxOf(mean_tr, app_tr);
  const transfer_index = iSup != null && iTr != null ? 0.6 * iSup + 0.4 * iTr : iSup ?? iTr;

  // المعوقات
  const bc = new Map<string, number>(); let withBarriers = 0;
  for (const r of responses) { const bs = Array.isArray(r.barriers) ? r.barriers : []; if (bs.length) withBarriers++; for (const b of bs) bc.set(String(b), (bc.get(String(b)) || 0) + 1); }
  const barriers = Array.from(bc.entries()).map(([label, n]) => ({ label, n, pct: withBarriers ? Math.round((100 * n) / withBarriers) : 0 })).sort((a, b) => b.n - a.n);

  // المحاور
  const scaleQs = questions.filter(q => q.kind === 'scale');
  const domSet = Array.from(new Set(scaleQs.map(q => q.domain_ar || 'عام')));
  const domains: DomainMean[] = domSet.map(domain => {
    const ids = scaleQs.filter(q => (q.domain_ar || 'عام') === domain).map(q => q.id);
    const vals = (rs: BehaviorResponse[]) => rs.flatMap(r => ids.map(id => Number(r.answers?.[id])).filter(v => Number.isFinite(v) && v > 0));
    const vs = vals(sup), vt = vals(tr);
    return { domain, supervisor: r2(avg(vs)), trainee: r2(avg(vt)), n_sup: vs.length, n_tr: vt.length };
  });

  // المزاوجة مشرف/متدرب
  const byKey = new Map<string, Pair>();
  for (const r of responses) {
    const p = byKey.get(r.trainee_key) || { trainee_key: r.trainee_key, label: r.trainee_label || r.trainee_key.replace(/^[en]:/, ''), supervisor: null, trainee: null, gap: null, app_sup: null, app_tr: null };
    if (r.role === 'supervisor') { p.supervisor = r.scale_mean; p.app_sup = r.application_pct; }
    if (r.role === 'trainee') { p.trainee = r.scale_mean; p.app_tr = r.application_pct; }
    byKey.set(r.trainee_key, p);
  }
  const pairs = Array.from(byKey.values()).map(p => ({ ...p, gap: p.supervisor != null && p.trainee != null ? r2(p.supervisor - p.trainee) : null })).sort((a, b) => (a.supervisor ?? a.trainee ?? 0) - (b.supervisor ?? b.trainee ?? 0));
  const gaps = pairs.map(p => p.gap).filter((x): x is number => x != null);
  const comments = responses.filter(r => r.comment && r.comment.trim()).map(r => ({ role: r.role, who: r.role === 'supervisor' ? `مشرف ${r.trainee_label || ''}`.trim() : r.respondent_label, text: r.comment!.trim() }));

  return {
    n: responses.length, n_sup: sup.length, n_tr: tr.length, n_trainees: byKey.size,
    mean_sup: r2(mean_sup), mean_tr: r2(mean_tr), mean_all: r2(mean_all),
    app_sup: r2(app_sup), app_tr: r2(app_tr), app_all: r2(app_all),
    transfer_index: transfer_index == null ? null : Math.round(transfer_index),
    gap: r2(avg(gaps)), barriers, domains, pairs, comments, label: transferLabel(transfer_index == null ? null : Math.round(transfer_index)),
  };
}

/** توصيات تلقائية مختصرة بناءً على النتائج */
export function recommendations(s: TransferSummary): string[] {
  const out: string[] = [];
  if (s.n === 0) return ['لم تصل استجابات بعد — أرسل الروابط للمشرفين والمتدربين أو فعّل الإرسال التلقائي.'];
  if (s.transfer_index != null && s.transfer_index < 60) out.push('مؤشر نقل الأثر دون 60%: خطّط لجلسة تعزيز (Refresher) قصيرة وورشة تطبيق عملي خلال 30 يومًا.');
  if (s.gap != null && s.gap <= -0.5) out.push('المتدربون يقدّرون أداءهم أعلى من تقدير مشرفيهم بفارق واضح — نسّق جلسة تغذية راجعة فردية بين المشرف والمتدرب.');
  if (s.gap != null && s.gap >= 0.5) out.push('المشرفون يرون أثرًا أعلى مما يدركه المتدربون — وثّق قصص النجاح وشاركها لتعزيز الثقة.');
  const top = s.barriers[0];
  if (top && top.pct >= 40 && !/لا توجد/.test(top.label)) out.push(`أبرز معوق: «${top.label}» (${top.pct}%) — عالجه مع الإدارة المباشرة قبل الدفعة القادمة.`);
  if (s.app_all != null && s.app_all < 50) out.push('نسبة التطبيق المصرّح بها أقل من 50%: أضف خطة تطبيق فردية (Action Plan) في ختام البرنامج ومتابعة بعد 30 يومًا.');
  const weakest = [...s.domains].filter(d => d.supervisor != null || d.trainee != null).sort((a, b) => ((a.supervisor ?? a.trainee)! - (b.supervisor ?? b.trainee)!))[0];
  if (weakest && (weakest.supervisor ?? weakest.trainee)! < 3.5) out.push(`المحور الأضعف «${weakest.domain}» — راجع تصميم الأنشطة المرتبطة به في البرنامج.`);
  const weakTr = s.pairs.filter(p => ((p.supervisor ?? p.trainee) ?? 9) < 3 || ((p.app_sup ?? p.app_tr) ?? 100) <= 25).length;
  if (weakTr) out.push(`${weakTr} من المتدربين (${Math.round((100 * weakTr) / Math.max(1, s.pairs.length))}%) بتقدير أو تطبيق منخفض — خصّص لهم متابعة فردية (Coaching) من المشرف المباشر.`);
  if (!out.length) out.push('المؤشرات جيدة — استمر في المتابعة الدورية ووثّق الممارسات الناجحة كحالات دراسية.');
  return out;
}

export function csvRows(f: BehaviorFollowup, programName: string, s: TransferSummary): (string | number | null)[][] {
  const head = ['الحملة', 'البرنامج', 'المتدرب', 'تقدير المشرف', 'تقدير ذاتي', 'الفجوة', 'تطبيق المشرف %', 'تطبيق ذاتي %'];
  return [head, ...s.pairs.map(p => [f.title_ar, programName, p.label, p.supervisor, p.trainee, p.gap, p.app_sup, p.app_tr])];
}
