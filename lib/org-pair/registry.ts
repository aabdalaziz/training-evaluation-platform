// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * عهد الممارس وجهته (P30) — الاسم الرسمي «عهد الممارس وجهته» · السردي «خطوة مني وخطوة من جهتي» (وعلى جهة الإدارة: «خطوة منّا وخطوة من منسوبنا»)
 * «المنسوب لا يطلب من جهته تدريبًا؛ يطلب منها خطوة واحدة له لسنة — والجهة تطلب منه خطوة واحدة لها — ويوقّعان وثيقة واحدة: توقيعه وتوقيع الجهة بصفتها».
 * الحركات الخمس: الطلب (من المنسوب أو من الجهة) → خطوة أطلبها (الجهة تطلب خطوة شخصية من أنواع P27 · المنسوب يطلب خطوة تشهدها المنصة عن جهة تجاهه: مقعد · مستوى · شهادة قرين · مهام في مهلتها)
 *   → توقيعان (المنسوب باسمه · مدير الجهة بصفته — وثيقة ATH-PO واحدة بحاملَين: شخص + جهة) → أين نحن من عهدنا (دربان من الأحداث؛ الجهة ترى حالة خطوة المنسوب فقط) → ما وعدنا بعضَنا / ما وقع.
 * قواعد ثابتة: 3 فصول للمنسوب · ميثاق موقَّع للجهة · عهد حيّ واحد لكل منسوب مع جهته · مدير الجهة لا يوقّع عن نفسه (الموقّع عن الجهة ≠ المنسوب) · لا ذكاء اصطناعي بين الطرفين.
 * الطرفان: member (المنسوب) · org (الجهة). member_step = ما يؤدّيه المنسوب (اقترحته الجهة) · org_step = ما تؤدّيه الجهة له (اقترحه المنسوب).
 */
import type { Chapter, JourneyInput } from '../journey/registry';
import { PLEDGE_KIND_AR, proposePledges, buildPath } from '../horizon/registry';
import type { PledgeKind, PledgeTarget, PledgeOption, Path, PathStep } from '../horizon/registry';
import { PAIR_MIN_CHAPTERS, PAIR_WHY_MIN, PAIR_WHY_MAX, PAIR_TITLE_MIN, PAIR_TITLE_MAX, PAIR_REVIEW_MIN, PAIR_REVIEW_MAX, PAIR_REWORK_MAX, validateProposal, validateSign, validatePairReview, stepState, jointDecision } from '../pair/registry';
import type { StepState, NameMode } from '../pair/registry';

export const ORG_PAIR_VERSION = '2026-10';
export const ORG_PAIR_MIN_CHAPTERS = PAIR_MIN_CHAPTERS;   // للمنسوب — بوابة P27/P29 نفسها
export const ORG_PAIR_INVITE_DAYS = 14;                    // الطلب/الدعوة تنقضي بصمت
export const ORG_PAIR_PROPOSE_DAYS = 14;                   // مهلة الاقتراح والتوقيع بعد القبول
export const ORG_PAIR_PLEDGE_DAYS = 365;
export const ORG_PAIR_MIDYEAR_DAY = 182;
export const ORG_PAIR_REVIEW_WINDOW_DAYS = 30;
export const ORG_PAIR_MISSION_SLA_DAYS = 7;                // مهلة تأكيد المهمة
export const ORG_PAIR_MISSIONS_COUNT = 3;                  // مهام متتالية في المهلة
export const ORG_PAIR_CODE_PREFIX = 'ATH-PO';
export const ORG_PAIR_K = 5;                               // نصاب فصل «عهود مع منسوبين» في رحلة الجهة
export { PAIR_WHY_MIN as ORG_PAIR_WHY_MIN, PAIR_WHY_MAX as ORG_PAIR_WHY_MAX, PAIR_TITLE_MIN as ORG_PAIR_TITLE_MIN, PAIR_TITLE_MAX as ORG_PAIR_TITLE_MAX, PAIR_REVIEW_MIN as ORG_PAIR_REVIEW_MIN, PAIR_REVIEW_MAX as ORG_PAIR_REVIEW_MAX, PAIR_REWORK_MAX as ORG_PAIR_REWORK_MAX };

export type OrgSide = 'member' | 'org';
export type OrgPairStatus = 'invited' | 'proposing' | 'active' | 'review' | 'renewed' | 'closed' | 'declined' | 'expired' | 'revoked';
/** ما تؤدّيه الجهة لمنسوبها — أفعال تشهدها المنصة عن جهة تجاه شخص */
export type OrgStepKind = 'seat' | 'level' | 'attestation' | 'missions';
export type OrgStepTarget = PledgeTarget & { sla_days?: number };
export type OrgStepOption = { kind: OrgStepKind; title_ar: string; why_ar: string; target: OrgStepTarget };
export type MemberStep = { kind: PledgeKind; title_ar: string; why_ar: string; target: PledgeTarget; proposed_by: 'org'; proposed_at: string; accepted_at: string | null; rework: number };
export type OrgStep = { kind: OrgStepKind; title_ar: string; why_ar: string; target: OrgStepTarget; proposed_by: 'member'; proposed_at: string; accepted_at: string | null; rework: number };
export type OrgPair = {
  id: string; created_at: string; updated_at: string; organization_id: string; org_name: string | null; status: OrgPairStatus; invited_by: OrgSide;
  member_user_id: string | null; member_email: string; member_name: string | null; member_name_mode: NameMode; invite_why_ar: string;
  member_step: MemberStep | null; org_step: OrgStep | null;
  invited_at: string; accepted_at: string | null; member_signed_at: string | null; org_signed_at: string | null; org_signer_id: string | null; org_signer_email: string | null;
  signed_at: string | null; expires_at: string | null; review_at: string | null;
  member_review_ar: string | null; org_review_ar: string | null; member_reviewed_at: string | null; org_reviewed_at: string | null; member_decision: 'renew' | 'close' | null; org_decision: 'renew' | 'close' | null; reviewed_at: string | null;
  code: string | null; vc_issuance_id: string | null; meta: any;
};
export const ORG_PAIR_COLS = 'id,created_at,updated_at,organization_id,org_name,status,invited_by,member_user_id,member_email,member_name,member_name_mode,invite_why_ar,member_step,org_step,invited_at,accepted_at,member_signed_at,org_signed_at,org_signer_id,org_signer_email,signed_at,expires_at,review_at,member_review_ar,org_review_ar,member_reviewed_at,org_reviewed_at,member_decision,org_decision,reviewed_at,code,vc_issuance_id,meta';
export const MEMBER_KIND_AR = PLEDGE_KIND_AR;
export const ORG_STEP_KIND_AR: Record<OrgStepKind, string> = { seat: 'مقعد مجلس أقران', level: 'اعتماد مستوى', attestation: 'اعتماد شهادة قرين', missions: 'تأكيد المهام في مهلتها' };
export const PRIVACY_ORG_PAIR_AR = [
  'الطلب بين منسوب مؤكَّد وجهته فقط — ولا يُفتح إلا لمنسوب له 3 فصول وجهة وقّعت ميثاقها',
  'الجهة تطلب خطوة شخصية من خطوات تشهدها المنصة؛ والمنسوب يطلب من جهته فعلًا تشهده المنصة تجاهه (مقعد · مستوى · شهادة قرين · مهام في مهلتها)',
  'الوثيقة بحاملَين: اسم المنسوب (بالوضع الذي يختاره) واسم الجهة والخطوتان والتاريخان — كلمات «لماذا» ليست فيها، ومن وقّع عن الجهة يظهر بصفته لا ببريده',
  'الجهة ترى حالة خطوة المنسوب فقط (وقعت / لم تقع بعد) — لا أحداثه ولا مواقفه؛ والمنسوب يرى ما فعلته الجهة له',
  'لا يقرأ أحد الطرفين كلمات مراجعة الآخر حتى يكتب كلماته؛ ومدير الجهة لا يوقّع عهدًا مع نفسه',
  'لا ذكاء اصطناعي في الطلب ولا في «لماذا» ولا في المراجعة — الكلمات بين المنسوب وجهته تبقى لهما',
];

const nCh = (n: number) => (n === 0 ? 'بلا فصول' : n === 1 ? 'فصل واحد' : n === 2 ? 'فصلان' : n <= 10 ? `${n} فصول` : `${n} فصلًا`);
const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' });
export const addDays = (iso: string | Date, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
export const orgPairCode = (rnd: () => string) => `${ORG_PAIR_CODE_PREFIX}-${rnd()}-${rnd()}`;
export const lowerE = (s: string | null | undefined) => String(s || '').trim().toLowerCase();
const HAS_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;

export const otherSide = (s: OrgSide): OrgSide => (s === 'member' ? 'org' : 'member');
export const isLive = (s: OrgPairStatus) => s === 'proposing' || s === 'active' || s === 'review';
/** اسم المنسوب كما اختار إظهاره */
export function memberName(p: Pick<OrgPair, 'member_name' | 'member_name_mode' | 'member_email'>): string {
  const name = String(p.member_name || '').trim(); const mode = p.member_name_mode;
  if (mode === 'anon') return 'ممارس'; if (!name) return mode === 'full' ? p.member_email.split('@')[0] : 'منسوب';
  return mode === 'first' ? name.split(/\s+/)[0] : name;
}
export const orgName = (p: Pick<OrgPair, 'org_name'>) => String(p.org_name || 'الجهة').trim() || 'الجهة';
export const stepOf = (p: OrgPair, side: OrgSide): MemberStep | OrgStep | null => (side === 'member' ? p.member_step : p.org_step);
export const signedOf = (p: OrgPair, side: OrgSide) => (side === 'member' ? p.member_signed_at : p.org_signed_at);
export const reviewedOf = (p: OrgPair, side: OrgSide) => (side === 'member' ? p.member_reviewed_at : p.org_reviewed_at);

/** أهلية المنسوب: 3 فصول حقيقية */
export function memberEligibility(chapters: Chapter[]): { ok: boolean; chapters: number; min: number; read_ar: string } {
  const n = chapters.length; const ok = n >= ORG_PAIR_MIN_CHAPTERS;
  return { ok, chapters: n, min: ORG_PAIR_MIN_CHAPTERS, read_ar: ok ? 'يمكنك أن تطلب من جهتك خطوة لسنة — وتطلب هي منك.' : `العهد مع جهتك يُقطع بعد ${ORG_PAIR_MIN_CHAPTERS} فصول في رحلتك — ${n === 0 ? 'ولم يُكتب فصلك الأول بعد' : `لديك ${nCh(n)}`}. ما وعدت به إنسانًا يعرفك أثقل — فليكن بعد أن تعرفك المنصة أولًا.` };
}
/** أهلية الجهة: ميثاق موقَّع نافذ (P24) */
export function orgEligibility(charter: { status: string; expires_at: string | null } | null, now = Date.now()): { ok: boolean; reason: 'no_charter' | 'expired' | null; read_ar: string } {
  if (!charter) return { ok: false, reason: 'no_charter', read_ar: 'جهة لم تَعِد نفسها بميثاق لا تَعِد منسوبًا — وقّعوا ميثاق الجهة أولًا.' };
  if (charter.status !== 'active' || (charter.expires_at && new Date(charter.expires_at).getTime() <= now)) return { ok: false, reason: 'expired', read_ar: 'ميثاق الجهة منتهٍ أو مسحوب — جدّدوه أولًا.' };
  return { ok: true, reason: null, read_ar: 'الجهة وقّعت ميثاقها — يمكنها أن تَعِد منسوبيها.' };
}

/** التحقق من الطلب (من أيّ طرف): «لماذا» بكلماته */
export function validateOrgInvite(b: { why_ar?: unknown; name_mode?: unknown }): string | null {
  const w = String(b.why_ar || '').trim(); if (w.length < PAIR_WHY_MIN) return `اكتب «لماذا» في ${PAIR_WHY_MIN} حرفًا على الأقل — بكلماتك`; if (w.length > PAIR_WHY_MAX) return `«لماذا» أطول من ${PAIR_WHY_MAX} حرفًا`; if (HAS_EMAIL.test(w)) return 'لا بُرُد في «لماذا»';
  if (b.name_mode !== undefined && !['full', 'first', 'anon'].includes(String(b.name_mode))) return 'وضع الاسم: full أو first أو anon';
  return null;
}
/** ما تقترحه المنصة للجهة لتطلبه من منسوبها — من فصوله هو (محرّك P27) */
export function suggestForMember(memberChapters: Chapter[], memberInput: Pick<JourneyInput, 'levels' | 'skills'>): PledgeOption[] { return proposePledges(memberChapters, memberInput); }
/** ما تقترحه المنصة للمنسوب ليطلبه من جهته — أربعة أفعال تشهدها المنصة عن جهة تجاه شخص، مرتّبة بما ينقصه */
export function suggestForOrg(inp: Pick<JourneyInput, 'levels' | 'skills' | 'attestations' | 'missions' | 'memberships'>, n = 3): OrgStepOption[] {
  const out: OrgStepOption[] = [];
  const pendingLevel = inp.levels.find(l => (l.computed_level || 0) >= 2 && (l.approved_level == null || (l.approved_level || 0) < Math.floor(l.computed_level || 0)));
  const pendingAtt = inp.attestations.some(a => a.status === 'pending');
  const inCouncil = inp.memberships.some(m => m.joined_at && m.status !== 'applied' && m.status !== 'invited');
  const hadMissions = inp.missions.length > 0;
  if (!inCouncil) out.push({ kind: 'seat', title_ar: 'مقعد لي في مجلس أقران تموّله الجهة هذه السنة', why_ar: 'لم تجلس بعد إلى طاولة لا تضم جهتك وحدها — المقعد خطوة تشهدها المنصة من طلبه إلى جلوسك.', target: { count: 1 } });
  if (pendingLevel) out.push({ kind: 'level', title_ar: `اعتماد إنساني لمستواي في «${inp.skills[pendingLevel.skill_id] || 'المهارة'}» خلال السنة`, why_ar: `مستواك المحسوب ${Number(pendingLevel.computed_level).toFixed(1)} ولم يعتمده إنسان بعد — الاعتماد قرار جهتك لا حساب المنصة.`, target: { skill_id: pendingLevel.skill_id, skill_ar: inp.skills[pendingLevel.skill_id] || null as any, to: Math.max(1, Math.floor(pendingLevel.computed_level || 1)), from: pendingLevel.approved_level ?? null } });
  if (pendingAtt || inCouncil) out.push({ kind: 'attestation', title_ar: 'اعتماد شهادة قرين عني حين تصل — بقرار إنسان من جهتي', why_ar: pendingAtt ? 'لديك شهادة قرين بانتظار الاعتماد — ما يراه أقرانك فيك يصير أثرًا حين يعتمده إنسان.' : 'أنت في مجلس؛ حين يشهد لك قرين، فلتكن جهتك من يعتمدها لا الطاقم.', target: { count: 1 } });
  if (hadMissions || out.length < n) out.push({ kind: 'missions', title_ar: `تأكيد مهامي خلال ${ORG_PAIR_MISSION_SLA_DAYS} أيام من تسليمها — ${ORG_PAIR_MISSIONS_COUNT} مهام متتالية`, why_ar: hadMissions ? 'سلّمتَ مهامًا من قبل — سرعة تأكيد المشرف هي ما يجعل الأثر حيًّا لا متأخرًا.' : 'حين تسلّم مهمة من قلب العمل، تَعِدك جهتك ألّا تنتظر أكثر من أسبوع.', target: { count: ORG_PAIR_MISSIONS_COUNT, sla_days: ORG_PAIR_MISSION_SLA_DAYS } });
  if (out.length < n && !out.some(o => o.kind === 'seat')) out.push({ kind: 'seat', title_ar: 'مقعد لي في مجلس أقران جديد تموّله الجهة', why_ar: 'مجلس آخر، طاولة أخرى — المقعد خطوة تشهدها المنصة من طلبه إلى جلوسك.', target: { count: 1 } });
  if (out.length < n && !out.some(o => o.kind === 'level')) { const any = inp.levels[0]; if (any) out.push({ kind: 'level', title_ar: `مراجعة إنسانية لمستواي في «${inp.skills[any.skill_id] || 'المهارة'}» خلال السنة`, why_ar: 'اعتماد المستوى قرار بشري — اطلب من جهتك أن تنظر فيه هذه السنة.', target: { skill_id: any.skill_id, skill_ar: inp.skills[any.skill_id] || null as any, to: Math.max(1, (any.approved_level || 0) + 1), from: any.approved_level ?? null } }); }
  if (out.length < n && !out.some(o => o.kind === 'attestation')) out.push({ kind: 'attestation', title_ar: 'اعتماد شهادة قرين عني حين تصل — بقرار إنسان من جهتي', why_ar: 'حين يشهد لك قرين يومًا، فلتكن جهتك من يعتمد شهادته لا الطاقم — الاعتماد فعل تشهده المنصة.', target: { count: 1 } });
  return out.slice(0, n);
}
export const validateOrgProposal = (b: { index?: unknown; title_ar?: unknown; why_ar?: unknown }, options: { kind: string }[]) => validateProposal(b, options as any);
export const validateOrgSign = validateSign;
export const validateOrgReview = validatePairReview;

/** ما تشهده المنصة عن فعل الجهة تجاه المنسوب */
export type OrgWitness = {
  seat_requests: { created_at: string; status: string; matched_council_id: string | null; includes_member: boolean }[];
  input: JourneyInput;  // مدخلات رحلة المنسوب: المستويات · شهادات الأقران · المهام · العضويات
};
/** درب المنسوب — محرّك P27 نفسه */
export function memberPath(step: MemberStep, signedAt: string, inp: JourneyInput, now = Date.now()): Path { return buildPath({ kind: step.kind, target: step.target, signed_at: signedAt }, inp, now); }
/** درب الجهة تجاه المنسوب — ما فعلته الجهة له بعد التوقيع */
export function orgPath(step: OrgStep, signedAt: string, w: OrgWitness, now = Date.now()): Path {
  const after = (iso: string | null | undefined) => !!iso && iso >= signedAt && new Date(iso).getTime() <= now;
  const steps: PathStep[] = []; let complete = false; const inp = w.input;
  if (step.kind === 'seat') {
    const req = w.seat_requests.filter(r => r.includes_member && after(r.created_at)).sort((a, b) => a.created_at.localeCompare(b.created_at))[0] || null;
    const jn = inp.memberships.filter(m => after(m.joined_at) && m.status !== 'applied' && m.status !== 'invited').sort((a, b) => String(a.joined_at).localeCompare(String(b.joined_at)))[0] || null;
    steps.push({ label_ar: 'طلب الجهة مقعدًا باسمك', done: !!req, at: req?.created_at || null, detail_ar: req ? (req.status === 'matched' ? 'طُلب ووُفِّق' : 'طُلب — لدى المُوفِّق') : null });
    steps.push({ label_ar: 'جلوسك إلى المجلس', done: !!jn, at: jn?.joined_at || null, detail_ar: jn ? `انضممتَ إلى «${jn.council_title || 'مجلس'}»` : null });
    complete = !!jn;
  } else if (step.kind === 'level') {
    const l = inp.levels.find(x => x.skill_id === step.target.skill_id) || null; const reached = !!l && after(l.approved_at) && (l.approved_level || 0) >= (step.target.to || 1);
    steps.push({ label_ar: `اعتماد إنساني للمستوى ${step.target.to || ''} في «${step.target.skill_ar || 'المهارة'}»`, done: reached, at: reached ? l!.approved_at : null, detail_ar: reached ? 'اعتمدته جهتك بعد العهد' : l ? `المحسوب الآن ${Number(l.computed_level || 0).toFixed(1)} · المعتمد ${l.approved_level ?? '—'}` : null });
    complete = reached;
  } else if (step.kind === 'attestation') {
    const at = inp.attestations.filter(a => a.status === 'approved' && after(a.decided_at)).sort((a, b) => String(a.decided_at).localeCompare(String(b.decided_at)))[0] || null;
    const pend = inp.attestations.some(a => a.status === 'pending');
    steps.push({ label_ar: 'قرين يشهد لك', done: !!at || pend, at: at ? at.created_at : null, detail_ar: at ? `في «${inp.skills[at.skill_id] || 'مهارة'}»` : pend ? 'شهادة بانتظار الاعتماد' : null });
    steps.push({ label_ar: 'اعتماد جهتك لها', done: !!at, at: at?.decided_at || null, detail_ar: at ? 'اعتمدها إنسان بعد العهد' : null });
    complete = !!at;
  } else {
    const sla = (step.target.sla_days || ORG_PAIR_MISSION_SLA_DAYS) * 864e5; const want = step.target.count || ORG_PAIR_MISSIONS_COUNT;
    const subs = inp.missions.filter(m => after(m.submitted_at)).sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
    const inTime = subs.filter(m => m.confirmed_at && new Date(m.confirmed_at).getTime() - new Date(m.submitted_at!).getTime() <= sla);
    const late = subs.filter(m => (m.confirmed_at && new Date(m.confirmed_at).getTime() - new Date(m.submitted_at!).getTime() > sla) || (!m.confirmed_at && now - new Date(m.submitted_at!).getTime() > sla));
    for (let i = 0; i < want; i++) { const m = inTime[i] || null; steps.push({ label_ar: `المهمة ${i + 1}: تأكيد خلال ${step.target.sla_days || ORG_PAIR_MISSION_SLA_DAYS} أيام`, done: !!m, at: m?.confirmed_at || null, detail_ar: m ? `«${m.title_ar}» — أُكّدت في مهلتها` : i === inTime.length && late.length ? `${late.length} ${late.length === 1 ? 'مهمة تأخّرت' : 'مهام تأخّرت'} عن المهلة` : null }); }
    complete = inTime.length >= want;
  }
  const quarters: { label: string; text_ar: string }[] = []; const start = new Date(signedAt).getTime(); const qn = Math.min(4, Math.max(1, Math.floor((now - start) / (91 * 864e5)) + 1));
  for (let i = 0; i < qn; i++) { const a = start + i * 91 * 864e5, b = Math.min(now, start + (i + 1) * 91 * 864e5); const inQ = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() >= a && new Date(iso).getTime() < b; const got = steps.filter(s => s.done && inQ(s.at)).map(s => s.label_ar); quarters.push({ label: ['الربع الأول من العهد', 'الربع الثاني', 'الربع الثالث', 'الربع الأخير'][i], text_ar: got.length ? got.join(' · ') : 'لم يقع شيء من خطوة الجهة في هذا الربع' }); }
  const done = steps.filter(s => s.done).length;
  const read = complete ? 'ما وعدتك به جهتك وقع — بشهادة الأحداث لا بتصريحها.' : done ? `${done} من ${steps.length} ${steps.length === 1 ? 'خطوة' : 'خطوات'} من خطوة الجهة وقعت حتى اليوم.` : 'لم يقع من خطوة الجهة شيء بعد — السنة ما زالت مفتوحة.';
  return { kind: 'council', steps, read_ar: read, quarters, complete } as Path;
}
export { stepState, jointDecision };

/** المرآة المشتركة: سطر واحد للطرفين — بلا حكم */
export function orgPairMirror(signedAt: string, member: StepState, org: StepState, mName: string, oName: string, forSide: OrgSide, now = Date.now()): string {
  const days = Math.floor((now - new Date(signedAt).getTime()) / 864e5); const q = days < 91 ? 'الربع الأول من العهد' : days < 182 ? 'ربع العهد مضى' : days < 273 ? 'مرّ نصف العهد' : days < 365 ? 'الربع الأخير من العهد' : 'اكتملت سنة العهد';
  const mk = forSide === 'member' ? 'خطوتك' : `خطوة ${mName}`; const ok = forSide === 'org' ? 'خطوتكم' : `خطوة ${oName}`;
  const m = member.complete ? `${mk} وقعت` : member.done ? `${member.done} من ${member.total} من ${mk} وقعت` : `${mk} لم تقع بعد`;
  const o = org.complete ? `و${ok} وقعت` : org.done ? `و${ok} في طريقها` : `و${ok} لم تقع بعد`;
  return `${q}: ${m}، ${o}. لا حكم هنا — السنة ${days < 365 ? 'ما زالت مفتوحة' : 'اكتملت'}.`;
}
/** نص المراجعة المشتركة لطرف */
export function orgPairReviewText(side: OrgSide, p: OrgPair, member: StepState, org: StepState, chaptersThen: number, chaptersNow: number): string {
  const mName = memberName(p), oName = orgName(p); const ms = p.member_step!, os = p.org_step!;
  if (side === 'member') return [`قبل سنة — في ${fmtD(p.signed_at!)} — طلبت منك ${oName}: «${ms.title_ar}»، وطلبتَ منها: «${os.title_ar}».`, `خطوتك: ${member.read_ar}. خطوة ${oName}: ${org.read_ar}.`, `يومها كانت رحلتك ${nCh(chaptersThen)}، واليوم ${nCh(chaptersNow)}.`, `اكتب ما تغيّر فيك بسبب جهتك — ولن تقرأه الجهة حتى تكتب ما تغيّر فيها بسببك. ثم تقرّران: تجدّدان أم تطويان. ما لم يُراجَع ليس فشلًا.`].join(' ');
  return [`قبل سنة — في ${fmtD(p.signed_at!)} — طلبتم من ${mName}: «${ms.title_ar}»، وطلب منكم: «${os.title_ar}».`, `خطوة ${mName}: ${member.read_ar}. خطوتكم: ${org.read_ar}.`, `اكتبوا باسم الجهة ما تغيّر فيكم بسبب ${mName} — ولن يقرأه حتى يكتب ما تغيّر فيه بسببكم. ثم تقرّران: تجدّدان أم تطويان.`].join(' ');
}
/** المهل */
export const orgInviteExpired = (p: Pick<OrgPair, 'status' | 'invited_at' | 'accepted_at'>, now = Date.now()) => (p.status === 'invited' && new Date(p.invited_at).getTime() + ORG_PAIR_INVITE_DAYS * 864e5 <= now) || (p.status === 'proposing' && !!p.accepted_at && new Date(p.accepted_at).getTime() + ORG_PAIR_PROPOSE_DAYS * 864e5 <= now);
export const orgReviewOpen = (p: Pick<OrgPair, 'status' | 'review_at'>, now = Date.now()) => p.status === 'review' || (p.status === 'active' && !!p.review_at && new Date(p.review_at).getTime() <= now);

/** ما يُعاد لكل طرف — كلمات الآخر تُفتح بعد كلماتك؛ موقّع الجهة لا يظهر للمنسوب ببريده */
export function orgViewFor(p: OrgPair, side: OrgSide): OrgPair & { my_side: OrgSide; member_name_shown: string; org_name_shown: string; partner_review_ar: string | null } {
  const mineWritten = !!reviewedOf(p, side); const theirs = side === 'member' ? p.org_review_ar : p.member_review_ar;
  const v: any = { ...p }; if (side === 'member') { v.org_review_ar = mineWritten ? theirs : null; v.org_signer_id = null; v.org_signer_email = null; } else { v.member_review_ar = mineWritten ? theirs : null; }
  return { ...v, my_side: side, member_name_shown: memberName(p), org_name_shown: orgName(p), partner_review_ar: mineWritten ? theirs : null };
}
/** ملخص للوكلاء (داخل my_horizon) */
export function orgPairSummary(p: OrgPair | null, member: StepState | null, org: StepState | null, invitesIn: number) {
  if (!p) return { version: ORG_PAIR_VERSION, status: null, invites_in: invitesIn };
  return { version: ORG_PAIR_VERSION, status: p.status, org: orgName(p), code: p.code, signed_at: p.signed_at, review_at: p.review_at, my_step: p.member_step ? { kind: p.member_step.kind, kind_ar: MEMBER_KIND_AR[p.member_step.kind], title_ar: p.member_step.title_ar } : null, my_state: member ? { complete: member.complete, read_ar: member.read_ar } : null, org_step: p.org_step ? { kind: p.org_step.kind, kind_ar: ORG_STEP_KIND_AR[p.org_step.kind], title_ar: p.org_step.title_ar } : null, org_state: org ? { complete: org.complete, read_ar: org.read_ar } : null };
}
/** فصل «عهود مع منسوبين» في رحلة الجهة: عدد المنسوبين المتمايزين الذين وقّعوا (k=5) — يُمرَّر إلى محرّك P26 كأحداث */
export const orgPairEvents = (rows: Pick<OrgPair, 'member_email' | 'signed_at' | 'status'>[]) => rows.filter(r => r.signed_at && r.status !== 'revoked').map(r => ({ person: lowerE(r.member_email), at: r.signed_at as string }));
