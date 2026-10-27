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
  const c = (v: unknown, d: number, lo: number, hi: number) 
