// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — عقود الأثر (P12-ب) — محرّك نقيّ قابل للاختبار (بلا شبكة)
 *  العقد: ثلاث دفعات مرتبطة بالنتيجة لا بالمقعد —
 *   «التسليم» 60%  → يُفرَج عنها عندما يُثبت الطاقم تسليم البرنامج (قرار بشري موثَّق).
 *   «أدلة الأثر» 25% → تستحق عندما تبلغ نسبة المنسوبين الذين أكّد مشرفوهم مهمةً من قلب العمل (P12-أ) الهدفَ (افتراضيًا 60%).
 *   «أثر 90 يومًا» 15% → تستحق عند انقضاء نافذة الأثر (90 يومًا من التسليم) بحسب نسبة «الأثر المستدام» (دليل مؤرَّخ بعد 30 يومًا من التسليم
 *     لدى من لديه مهمة مؤكَّدة)؛ وإن لم تُبلَغ النسبة المستهدفة فالدفعة **تناسبية** (عدالة للطرفين) — لا «كل شيء أو لا شيء».
 *  كل الأرقام هنا شفافة ومشتقة من أدلة موجودة أصلًا (شهادات الإتمام، المهمات، أدلة الملف المهاري). لا ذكاء اصطناعي في الحساب.
 */
import type { Lang, T } from './content';
import { t } from './content';
import { randomCode } from './profile';

export type MilestoneKey = 'delivery' | 'evidence' | 'impact';
export type ContractStatus = 'draft' | 'active' | 'settled' | 'cancelled';
export type MilestoneStatus = 'locked' | 'progress' | 'due' | 'released';
export type Split = Record<MilestoneKey, number>;
export type Targets = { evidence_rate: number; impact_days: number; impact_rate: number };
export type CohortPerson = { email: string; full_name?: string | null };
export type Contract = {
  id: string; created_at: string; created_by?: string | null; organization_id: string; program_id?: string | null; title_ar: string;
  contact_email?: string | null; contact_name?: string | null; cohort: CohortPerson[]; total_amount: number; currency: string; split: Split; targets: Targets;
  status: ContractStatus; token: string; start_at?: string | null; delivered_at?: string | null; flags: Record<string, string>; notes?: string | null; updated_at?: string;
  org_name?: string; program_name?: string;
};
export type Release = { id: string; contract_id: string; milestone: MilestoneKey; pct: number; amount: number; memo_no: string; released_at: string; released_by?: string | null; released_by_name?: string | null; note?: string | null; snapshot?: Record<string, unknown> };
/** حقائق الأثر لشخص واحد من الشريحة — تُجمَع من الخادم وتُمرَّر للمحرّك */
export type PersonFacts = { email: string; completed: boolean; confirmed_missions: number; submitted_missions: number; evidence_at: string[] };
export type Facts = { people: PersonFacts[]; releases: Release[] };
export type MilestoneState = {
  key: MilestoneKey; pct: number; amount: number; payable: number; status: MilestoneStatus; progress: number; metric: T; detail: T; prorata: boolean; release?: Release;
};
export type ContractState = {
  milestones: MilestoneState[]; cohort: number; completers: number; evidenced: number; submitted: number; sustained: number;
  window: { opens?: string; closes?: string; days_left?: number; open: boolean; closed: boolean };
  paid: number; due: number; remaining: number; next: T[]; health: 'draft' | 'on_track' | 'attention' | 'due' | 'settled' | 'cancelled';
};
export type ContractForm = { organization_id: string; program_id: string; title_ar: string; contact_email: string; contact_name: string; cohort_text: string; total_amount: string; currency: string; split: Split; targets: Targets; start_at: string; notes: string };

export const SPLIT_DEFAULT: Split = { delivery: 60, evidence: 25, impact: 15 };
export const TARGETS_DEFAULT: Targets = { evidence_rate: 60, impact_days: 90, impact_rate: 50 };
export const SUSTAIN_AFTER_DAYS = 30; // دليل بعد 30 يومًا من التسليم = «أثر مستدام» لا حماسة ما بعد البرنامج
export const EMPTY_CONTRACT_FORM: ContractForm = { organization_id: '', program_id: '', title_ar: '', contact_email: '', contact_name: '', cohort_text: '', total_amount: '', currency: 'SAR', split: { ...SPLIT_DEFAULT }, targets: { ...TARGETS_DEFAULT }, start_at: '', notes: '' };

export const MILESTONE_LABEL: Record<MilestoneKey, T> = { delivery: { ar: 'التسليم', en: 'Delivery' }, evidence: { ar: 'أدلة الأثر', en: 'Impact evidence' }, impact: { ar: 'أثر 90 يومًا', en: '90-day impact' } };
export const MILESTONE_DESC: Record<MilestoneKey, T> = {
  delivery: { ar: 'يُفرَج عنها عندما يُثبت فريق أَثَر تسليم البرنامج للشريحة المتفق عليها.', en: 'Released once Athar confirms the program was delivered to the agreed cohort.' },
  evidence: { ar: 'تستحق عندما يؤكد المشرفون المباشرون أدلة من قلب العمل للنسبة المستهدفة من المنسوبين.', en: 'Due when direct supervisors confirm workplace evidence for the target share of the cohort.' },
  impact: { ar: 'تستحق عند انقضاء نافذة 90 يومًا بحسب نسبة الأثر المستدام — وتناسبيًا إن لم تُبلَغ النسبة.', en: 'Due when the 90-day window closes, by the sustained-impact share — pro-rata if the target is missed.' },
};
export const STATUS_LABEL: Record<ContractStatus, T & { color: string }> = {
  draft: { ar: 'مسودة', en: 'Draft', color: '#64748b' }, active: { ar: 'نشط', en: 'Active', color: '#0b8a83' }, settled: { ar: 'مُسوّى', en: 'Settled', color: '#c9a24b' }, cancelled: { ar: 'ملغى', en: 'Cancelled', color: '#b91c1c' },
};
export const MS_STATUS_LABEL: Record<MilestoneStatus, T> = { locked: { ar: 'مقفلة', en: 'Locked' }, progress: { ar: 'قيد التحقق', en: 'In progress' }, due: { ar: 'مستحقة — بانتظار الاعتماد', en: 'Due — awaiting release' }, released: { ar: 'أُفرج عنها', en: 'Released' } };
export const HEALTH_LABEL: Record<ContractState['health'], T> = { draft: { ar: 'مسودة', en: 'Draft' }, on_track: { ar: 'على المسار', en: 'On track' }, attention: { ar: 'يحتاج انتباهًا', en: 'Needs attention' }, due: { ar: 'دفعة مستحقة', en: 'Payment due' }, settled: { ar: 'مُسوّى', en: 'Settled' }, cancelled: { ar: 'ملغى', en: 'Cancelled' } };
export const statusLabel = (s: ContractStatus, lang: Lang) => t(STATUS_LABEL[s] || { ar: s, en: s }, lang);

export const contractToken = () => randomCode(24);
export const contractUrl = (token: string) => `/contract/${token}`;
export const DAY = 86400000;
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
export function money(n: number, currency: string, lang: Lang): string { const v = Math.round(Number(n) || 0).toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US'); const c = (currency || 'SAR').toUpperCase(); const cl = c === 'SAR' ? (lang === 'ar' ? 'ر.س' : 'SAR') : c; return lang === 'ar' ? `${v} ${cl}` : `${cl} ${v}`; }
export function fmtD(iso: string | null | undefined, lang: Lang): string { if (!iso) return ''; try { return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return String(iso).slice(0, 10); } }
export const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * DAY).toISOString();

export function normalizeSplit(s: Partial<Split> | null | undefined): Split {
  const n = (x: unknown, d: number) => { const v = Number(x); return isFinite(v) && v >= 0 ? Math.round(v) : d; };
  const out = { delivery: n(s?.delivery, SPLIT_DEFAULT.delivery), evidence: n(s?.evidence, SPLIT_DEFAULT.evidence), impact: n(s?.impact, SPLIT_DEFAULT.impact) };
  return out.delivery + out.evidence + out.impact === 100 ? out : { ...SPLIT_DEFAULT };
}
export function normalizeTargets(x: Partial<Targets> | null | undefined): Targets {
  const c = (v: unknown, d: number, lo: number, hi: number) => { const n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
  return { evidence_rate: c(x?.evidence_rate, 60, 10, 100), impact_days: c(x?.impact_days, 90, 30, 365), impact_rate: c(x?.impact_rate, 50, 10, 100) };
}
export function milestoneAmounts(total: number, split: Split): Record<MilestoneKey, number> {
  const d = round2(total * split.delivery / 100), e = round2(total * split.evidence / 100);
  return { delivery: d, evidence: e, impact: round2(total - d - e) };
}

/** الحالة الحية للعقد من حقائق الأثر — بلا أي ذكاء اصطناعي */
export function computeState(c: Contract, f: Facts, now: Date = new Date()): ContractState {
  const cohort = c.cohort.length; const amounts = milestoneAmounts(Number(c.total_amount) || 0, normalizeSplit(c.split)); const tg = normalizeTargets(c.targets);
  const byEmail = new Map(f.people.map(p => [p.email.toLowerCase(), p]));
  const people = c.cohort.map(p => byEmail.get(p.email.toLowerCase()) || { email: p.email, completed: false, confirmed_missions: 0, submitted_missions: 0, evidence_at: [] });
  const completers = people.filter(p => p.completed).length; const evidenced = people.filter(p => p.confirmed_missions > 0).length; const submitted = people.filter(p => p.submitted_missions > 0 || p.confirmed_missions > 0).length;
  const rel = (k: MilestoneKey) => f.releases.find(r => r.milestone === k);
  const delivered = c.delivered_at ? new Date(c.delivered_at) : null;
  const opens = delivered ? addDays(c.delivered_at!, SUSTAIN_AFTER_DAYS) : undefined; const closes = delivered ? addDays(c.delivered_at!, tg.impact_days) : undefined;
  const sustained = delivered ? people.filter(p => p.confirmed_missions > 0 && p.evidence_at.some(a => new Date(a).getTime() >= new Date(opens!).getTime())).length : 0;
  const days_left = closes ? Math.max(0, Math.ceil((new Date(closes).getTime() - now.getTime()) / DAY)) : undefined;
  const windowClosed = !!closes && now.getTime() >= new Date(closes).getTime();
  const ms: MilestoneState[] = [];
  // 1) التسليم
  { const r = rel('delivery'); const prog = cohort ? pctOf(completers, cohort) : 0;
    ms.push({ key: 'delivery', pct: c.split.delivery, amount: amounts.delivery, payable: amounts.delivery, status: r ? 'released' : delivered ? 'due' : 'progress', progress: delivered ? 100 : prog, prorata: false, release: r,
      metric: { ar: `${completers}/${cohort} أتمّوا البرنامج`, en: `${completers}/${cohort} completed` }, detail: delivered ? { ar: `أُثبت التسليم في ${fmtD(c.delivered_at, 'ar')}`, en: `Delivery confirmed on ${fmtD(c.delivered_at, 'en')}` } : { ar: 'بانتظار إثبات التسليم من فريق أَثَر', en: 'Awaiting Athar delivery confirmation' } }); }
  // 2) أدلة الأثر
  { const r = rel('evidence'); const rate = pctOf(evidenced, cohort); const prog = Math.min(100, Math.round((rate / tg.evidence_rate) * 100)); const unlocked = !!rel('delivery') || !!delivered;
    ms.push({ key: 'evidence', pct: c.split.evidence, amount: amounts.evidence, payable: amounts.evidence, status: r ? 'released' : !unlocked ? 'locked' : rate >= tg.evidence_rate ? 'due' : 'progress', progress: r ? 100 : prog, prorata: false, release: r,
      metric: { ar: `${evidenced}/${cohort} لديهم دليل مؤكَّد من المشرف (${rate}% · الهدف ${tg.evidence_rate}%)`, en: `${evidenced}/${cohort} have supervisor-confirmed evidence (${rate}% · target ${tg.evidence_rate}%)` },
      detail: { ar: `${submitted} أرسلوا دليلًا · ${Math.max(0, Math.ceil(cohort * tg.evidence_rate / 100) - evidenced)} تأكيدًا متبقيًا لبلوغ الهدف`, en: `${submitted} submitted · ${Math.max(0, Math.ceil(cohort * tg.evidence_rate / 100) - evidenced)} more confirmations to target` } }); }
  // 3) أثر 90 يومًا (تناسبي)
  { const r = rel('impact'); const rate = pctOf(sustained, cohort); const ratio = Math.min(1, tg.impact_rate ? rate / tg.impact_rate : 0); const payable = r ? Number(r.amount) : round2(amounts.impact * ratio);
    const status: MilestoneStatus = r ? 'released' : !delivered ? 'locked' : windowClosed ? 'due' : 'progress';
    ms.push({ key: 'impact', pct: c.split.impact, amount: amounts.impact, payable, status, progress: r ? 100 : Math.round(ratio * 100), prorata: !r && ratio < 1 && windowClosed, release: r,
      metric: { ar: `${sustained}/${cohort} أثر مستدام بعد ${SUSTAIN_AFTER_DAYS} يومًا (${rate}% · الهدف ${tg.impact_rate}%)`, en: `${sustained}/${cohort} sustained impact after ${SUSTAIN_AFTER_DAYS} days (${rate}% · target ${tg.impact_rate}%)` },
      detail: !delivered ? { ar: 'تُفتح النافذة عند إثبات التسليم', en: 'Window opens on delivery confirmation' } : windowClosed ? { ar: ratio >= 1 ? 'اكتملت النافذة والهدف مُحقَّق' : `اكتملت النافذة — الدفعة تناسبية ${Math.round(ratio * 100)}% من قيمتها`, en: ratio >= 1 ? 'Window closed — target met' : `Window closed — pro-rata ${Math.round(ratio * 100)}% of value` } : { ar: `تُغلق النافذة بعد ${days_left} يومًا (${fmtD(closes, 'ar')})`, en: `Window closes in ${days_left} days (${fmtD(closes, 'en')})` } }); }
  const paid = round2(f.releases.reduce((s, r) => s + Number(r.amount || 0), 0)); const due = round2(ms.filter(m => m.status === 'due').reduce((s, m) => s + m.payable, 0));
  const remaining = round2(Math.max(0, (Number(c.total_amount) || 0) - paid - due));
  const next: T[] = [];
  if (c.status === 'active') {
    if (!delivered) next.push({ ar: 'فريق أَثَر يُثبت التسليم بعد آخر جلسة', en: 'Athar confirms delivery after the last session' });
    const ev = ms[1]; if (ev.status === 'progress') next.push({ ar: `تأكيد المشرفين لمهمات ${Math.max(1, Math.ceil(cohort * tg.evidence_rate / 100) - evidenced)} منسوبًا يُحرّك دفعة «أدلة الأثر»`, en: `${Math.max(1, Math.ceil(cohort * tg.evidence_rate / 100) - evidenced)} more supervisor confirmations unlock the evidence payment` });
    if (ev.status === 'due' || ms[0].status === 'due') next.push({ ar: 'دفعة مستحقة — بانتظار اعتماد أَثَر وإشعار الجهة بمذكرة الإفراج', en: 'A payment is due — awaiting Athar release memo' });
    if (delivered && !windowClosed && !ms[2].release) next.push({ ar: `كل دليل بعد ${fmtD(opens, 'ar')} يرفع نسبة الأثر المستدام (الآن ${pctOf(sustained, cohort)}%)`, en: `Every evidence after ${fmtD(opens, 'en')} raises sustained impact (now ${pctOf(sustained, cohort)}%)` });
  }
  const allReleased = ms.every(m => m.status === 'released');
  const health: ContractState['health'] = c.status === 'draft' ? 'draft' : c.status === 'cancelled' ? 'cancelled' : c.status === 'settled' || allReleased ? 'settled' : ms.some(m => m.status === 'due') ? 'due' : (delivered && days_left !== undefined && days_left <= 21 && pctOf(sustained, cohort) < tg.impact_rate) || (ms[1].status === 'progress' && delivered && (now.getTime() - delivered.getTime()) / DAY > 45) ? 'attention' : 'on_track';
  return { milestones: ms, cohort, completers, evidenced, submitted, sustained, window: { opens, closes, days_left, open: !!delivered && !windowClosed, closed: windowClosed }, paid, due, remaining, next, health };
}

/** أحداث جديدة تستحق إشعارًا (للكرون) — تُقارن بالأعلام المحفوظة في العقد لعدم التكرار */
export function pulseEvents(c: Contract, s: ContractState, now: Date = new Date()): { key: string; subject: T; body: T }[] {
  const out: { key: string; subject: T; body: T }[] = []; const f = c.flags || {};
  const ev = s.milestones[1], im = s.milestones[2];
  if (ev.status === 'due' && !f.evidence_due_at) out.push({ key: 'evidence_due_at', subject: { ar: `دفعة «أدلة الأثر» أصبحت مستحقة — ${c.title_ar}`, en: `Impact-evidence payment is due — ${c.title_ar}` }, body: { ar: `${ev.metric.ar}. الدفعة ${money(ev.payable, c.currency, 'ar')} بانتظار اعتماد فريق أَثَر.`, en: `${ev.metric.en}. ${money(ev.payable, c.currency, 'en')} awaits Athar release.` } });
  if (im.status === 'due' && !f.impact_due_at) out.push({ key: 'impact_due_at', subject: { ar: `اكتملت نافذة أثر 90 يومًا — ${c.title_ar}`, en: `90-day impact window closed — ${c.title_ar}` }, body: { ar: `${im.metric.ar}. ${im.detail.ar}. الدفعة ${money(im.payable, c.currency, 'ar')}.`, en: `${im.metric.en}. ${im.detail.en}. ${money(im.payable, c.currency, 'en')}.` } });
  if (s.window.open && s.window.days_left !== undefined && s.window.days_left <= 14 && !f.impact_closing_at && im.progress < 100) out.push({ key: 'impact_closing_at', subject: { ar: `تبقّى ${s.window.days_left} يومًا على إغلاق نافذة الأثر — ${c.title_ar}`, en: `${s.window.days_left} days left in the impact window — ${c.title_ar}` }, body: { ar: `${im.metric.ar}. كل دليل مؤكَّد الآن يرفع الدفعة الأخيرة.`, en: `${im.metric.en}. Every confirmed evidence now raises the final payment.` } });
  void now; return out;
}

export function memoNo(seq: number, year = new Date().getFullYear()) { return `ATH-IC-${year}-${String(seq).padStart(4, '0')}`; }

export function validateContract(f: ContractForm, cohort: CohortPerson[]): string | null {
  if (!f.organization_id) return 'اختر الجهة'; if (!f.title_ar.trim() || f.title_ar.trim().length < 6) return 'اكتب عنوان العقد (6 أحرف على الأقل)';
  const total = Number(f.total_amount); if (!isFinite(total) || total <= 0) return 'قيمة العقد يجب أن تكون رقمًا أكبر من صفر';
  const sp = f.split; if (Math.round(Number(sp.delivery) + Number(sp.evidence) + Number(sp.impact)) !== 100) return 'مجموع الدفعات يجب أن يساوي 100%';
  if (!cohort.length) return 'الصق قائمة المنسوبين المشمولين بالعقد (بريد في كل سطر)';
  if (f.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.contact_email.trim())) return 'بريد جهة الاتصال غير صالح';
  return null;
}
export function contractPayload(f: ContractForm, cohort: CohortPerson[]) {
  return { organization_id: f.organization_id, program_id: f.program_id || null, title_ar: f.title_ar.trim(), contact_email: f.contact_email.trim().toLowerCase() || null, contact_name: f.contact_name.trim() || null, cohort, total_amount: round2(Number(f.total_amount)), currency: (f.currency || 'SAR').toUpperCase().slice(0, 3), split: normalizeSplit(f.split), targets: normalizeTargets(f.targets), start_at: f.start_at || null, notes: f.notes.trim() || null };
}
export function contractToForm(c: Contract): ContractForm {
  return { organization_id: c.organization_id, program_id: c.program_id || '', title_ar: c.title_ar, contact_email: c.contact_email || '', contact_name: c.contact_name || '', cohort_text: c.cohort.map(p => (p.full_name ? `${p.full_name} <${p.email}>` : p.email)).join('\n'), total_amount: String(c.total_amount), currency: c.currency, split: normalizeSplit(c.split), targets: normalizeTargets(c.targets), start_at: c.start_at || '', notes: c.notes || '' };
}

/** النسخة العامة للجهة: أعداد لا أسماء ولا بُرُد */
export function publicContract(c: Contract) {
  const { cohort, flags, created_by, contact_email, notes, ...rest } = c; void flags; void created_by; void contact_email; void notes;
  return { ...rest, cohort_size: cohort.length };
}
export function releaseSnapshot(s: ContractState) { return { cohort: s.cohort, completers: s.completers, evidenced: s.evidenced, submitted: s.submitted, sustained: s.sustained, window: s.window, at: new Date().toISOString() }; }

/** قصة العقد في أسطر — للصفحة الحية والبريد (بلا ذكاء اصطناعي) */
export function contractStory(c: Contract, s: ContractState, lang: Lang): string[] {
  const L = (x: T) => t(x, lang); const out: string[] = [];
  out.push(L({ ar: `شريحة من ${s.cohort} منسوبًا؛ أتمّ البرنامج ${s.completers} (${pctOf(s.completers, s.cohort)}%).`, en: `A cohort of ${s.cohort}; ${s.completers} completed (${pctOf(s.completers, s.cohort)}%).` }));
  out.push(L({ ar: `${s.evidenced} منهم أكّد مشرفوهم دليلًا من قلب العمل، و${s.submitted} أرسلوا دليلًا.`, en: `${s.evidenced} have supervisor-confirmed workplace evidence; ${s.submitted} submitted.` }));
  if (s.window.open || s.window.closed) out.push(L({ ar: `الأثر المستدام (دليل بعد ${SUSTAIN_AFTER_DAYS} يومًا من التسليم): ${s.sustained} (${pctOf(s.sustained, s.cohort)}%)${s.window.open ? ` — تبقّى ${s.window.days_left} يومًا في النافذة` : ' — النافذة مغلقة'}.`, en: `Sustained impact: ${s.sustained} (${pctOf(s.sustained, s.cohort)}%)${s.window.open ? ` — ${s.window.days_left} days left` : ' — window closed'}.` }));
  out.push(L({ ar: `أُفرج عن ${money(s.paid, c.currency, 'ar')} · مستحق الآن ${money(s.due, c.currency, 'ar')} · متبقٍ مرتبط بالأثر ${money(s.remaining, c.currency, 'ar')}.`, en: `Released ${money(s.paid, c.currency, 'en')} · due now ${money(s.due, c.currency, 'en')} · remaining tied to impact ${money(s.remaining, c.currency, 'en')}.` }));
  return out;
}

const shell = (title: string, body: string) => `<div dir="rtl" style="font-family:Tahoma,Arial;max-width:620px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><div style="background:#0f2a4e;color:#fff;padding:18px 22px"><div style="font-size:12px;opacity:.8">أَثَر · عقود الأثر</div><h2 style="margin:6px 0 0;font-size:18px">${title}</h2></div><div style="padding:20px 22px;color:#0f172a;line-height:1.8">${body}</div><div style="background:#f8fafc;color:#64748b;font-size:11px;padding:12px 22px">© 2026 د. أحمد محمد عبدالعزيز بدوي · أَثَر — تُشغَّل تجاريًا عبر شركة بوابة التميز للاستشارات والتدريب</div></div>`;
const btn = (href: string, label: string) => `<p style="margin:18px 0"><a href="${href}" style="background:#c9a24b;color:#0f2a4e;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:700;display:inline-block">${label}</a></p>`;
const esc = (s: string) => String(s || '').replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch] as string));

export function activationMailHtml(c: Contract, url: string) {
  return { subject: `عقد أثر نشط: ${c.title_ar} — صفحة حية لحالة العقد`, html: shell('عقدكم مع أَثَر أصبح حيًّا', `<p>مرحبًا ${esc(c.contact_name || '')}،</p><p>فُعِّل عقد الأثر <b>${esc(c.title_ar)}</b> بقيمة <b>${money(Number(c.total_amount), c.currency, 'ar')}</b> على ثلاث دفعات مرتبطة بالنتيجة: <b>${c.split.delivery}%</b> عند التسليم، <b>${c.split.evidence}%</b> عند أدلة الأثر المؤكَّدة من مشرفيكم، <b>${c.split.impact}%</b> عند أثر ${normalizeTargets(c.targets).impact_days} يومًا.</p><p>هذه الصفحة تُحدَّث لحظيًا من أدلة الأثر نفسها — لا تقارير لاحقة:</p>${btn(url, 'افتح صفحة العقد الحية')}<p style="font-size:12px;color:#64748b">الرابط خاص بجهتكم؛ شاركوه مع من يلزم داخليًا.</p>`) };
}
export function releaseMailHtml(c: Contract, r: Release, s: ContractState, url: string) {
  const m = s.milestones.find(x => x.key === r.milestone)!;
  return { subject: `مذكرة إفراج ${r.memo_no}: دفعة «${MILESTONE_LABEL[r.milestone].ar}» — ${c.title_ar}`, html: shell(`مذكرة إفراج عن دفعة · ${r.memo_no}`, `<p>بموجب عقد الأثر <b>${esc(c.title_ar)}</b>، أُفرج عن دفعة <b>«${MILESTONE_LABEL[r.milestone].ar}» (${r.pct}%)</b> بقيمة <b>${money(Number(r.amount), c.currency, 'ar')}</b>.</p><p><b>الأساس:</b> ${esc(m.metric.ar)}.<br/>${esc(m.detail.ar)}</p>${r.note ? `<p><b>ملاحظة:</b> ${esc(r.note)}</p>` : ''}<p>أُفرج عنها بواسطة ${esc(r.released_by_name || 'فريق أَثَر')} في ${fmtD(r.released_at, 'ar')}.</p>${btn(url, 'صفحة العقد الحية')}<p style="font-size:12px;color:#64748b">تُصدر الفاتورة الرسمية وفق إجراءات شركة بوابة التميز للاستشارات والتدريب.</p>`) };
}
export function pulseMailHtml(c: Contract, ev: { subject: T; body: T }, url: string) {
  return { subject: ev.subject.ar, html: shell(ev.subject.ar, `<p>${esc(ev.body.ar)}</p>${btn(url, 'صفحة العقد الحية')}`) };
}

/** مقترح شريحة: تسجيلات البرنامج التي تنتمي للجهة (عضوية أو نطاق بريد) */
export function proposeCohort(enrollments: { email: string; full_name?: string | null }[], members: { email: string }[], domain?: string | null): CohortPerson[] {
  const mem = new Set(members.map(m => m.email.toLowerCase())); const out = new Map<string, CohortPerson>();
  for (const e of enrollments) { const em = String(e.email || '').toLowerCase(); if (!em) continue; const inDom = !!domain && em.split('@')[1] === String(domain).toLowerCase(); if (mem.has(em) || inDom) out.set(em, { email: em, full_name: e.full_name || null }); }
  return Array.from(out.values());
}

/** تلخيص المحفظة للطاقم */
export function portfolio(items: { c: Contract; s: ContractState }[]) {
  const act = items.filter(i => i.c.status === 'active');
  return { total: items.length, active: act.length, value: round2(items.filter(i => i.c.status !== 'cancelled').reduce((s, i) => s + Number(i.c.total_amount), 0)), paid: round2(items.reduce((s, i) => s + i.s.paid, 0)), due: round2(items.reduce((s, i) => s + i.s.due, 0)), at_risk: round2(items.filter(i => i.s.health === 'attention').reduce((s, i) => s + i.s.remaining, 0)), evidence_rate: act.length ? Math.round(act.reduce((s, i) => s + pctOf(i.s.evidenced, i.s.cohort), 0) / act.length) : 0 };
}
