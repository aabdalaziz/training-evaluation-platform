// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * العهد المتقابل (P29) — الاسم الرسمي «العهد المتقابل» · السردي «عهدان متقابلان — خطوة لك وخطوة لي»
 * «لا أحد يفي بعهده وحده: ممارسان من دائرة واحدة يطلب كلٌّ منهما من صاحبه خطوة واحدة لسنة، ويوقّعان وثيقة واحدة بتوقيعين — والدرب يشهد للاثنين، والمراجعة تُقرأ معًا».
 * الحركات الخمس: من دائرتي (دعوة بالبريد داخل مجلس مشترك أو جهة واحدة) → خطوة أطلبها منك (كلٌّ يقترح لصاحبه من الأنواع التي تشهدها المنصة) → توقيعان (وثيقة ATH-MP بحاملَين · 365 يومًا)
 *   → أين نحن من عهدنا (درب مزدوج من الأحداث؛ صاحبك يرى حالة خطوتك فقط) → ما وعدنا بعضَنا / ما وقع (مراجعة مشتركة: لا يقرأ أحدكما كلمات الآخر حتى يكتب كلماته).
 * قواعد ثابتة: 3 فصول لكل طرف · عهد متقابل واحد نشط لكل شخص · الدعوة لا تكشف عضوية أحد · لا ذكاء اصطناعي بين إنسانين · لا اسم للطرف الآخر في فصول الرحلة · لا نسبة إنجاز.
 * الطرف (a) الداعي · الطرف (b) المدعوّ · a_step = ما يؤدّيه (a) واقترحه (b) · b_step = ما يؤدّيه (b) واقترحه (a).
 */
import type { Chapter, JourneyInput } from '../journey/registry';
import { PLEDGE_KIND_AR, proposePledges, buildPath } from '../horizon/registry';
import type { PledgeKind, PledgeTarget, PledgeOption, Path } from '../horizon/registry';

export const PAIR_VERSION = '2026-10';
export const PAIR_MIN_CHAPTERS = 3;            // لكل طرف — بوابة P27 نفسها
export const PAIR_INVITE_DAYS = 14;            // الدعوة تنقضي بصمت
export const PAIR_PROPOSE_DAYS = 14;           // مهلة الاقتراح والتوقيع بعد القبول
export const PAIR_PLEDGE_DAYS = 365;
export const PAIR_MIDYEAR_DAY = 182;
export const PAIR_REVIEW_WINDOW_DAYS = 30;
export const PAIR_WHY_MIN = 20; export const PAIR_WHY_MAX = 300;
export const PAIR_TITLE_MIN = 10; export const PAIR_TITLE_MAX = 160;
export const PAIR_REVIEW_MIN = 20; export const PAIR_REVIEW_MAX = 1500;
export const PAIR_REWORK_MAX = 1;              // «اطلب غيرها» مرة واحدة
export const PAIR_CODE_PREFIX = 'ATH-MP';
export const PAIR_K = 5;                        // نصاب فصل «عهود متقابلة» في رحلة الجهة
export const PAIR_COUNCIL_MIN = 2;              // عدد يُذكر في مرآة المجلس حين ≥ 2

export type Side = 'a' | 'b';
export type PairStatus = 'invited' | 'proposing' | 'active' | 'review' | 'renewed' | 'closed' | 'declined' | 'expired' | 'revoked';
export type NameMode = 'full' | 'first' | 'anon';
export type CircleKind = 'council' | 'org';
export type PairStep = { kind: PledgeKind; title_ar: string; why_ar: string; target: PledgeTarget; proposed_by: Side; proposed_at: string; accepted_at: string | null; rework: number };
export type Pair = {
  id: string; created_at: string; updated_at: string; status: PairStatus; circle_kind: CircleKind; circle_id: string; circle_title: string | null;
  a_user_id: string; a_email: string; a_name: string | null; a_name_mode: NameMode; b_user_id: string | null; b_email: string; b_name: string | null; b_name_mode: NameMode;
  invite_why_ar: string; a_step: PairStep | null; b_step: PairStep | null;
  invited_at: string; accepted_at: string | null; a_signed_at: string | null; b_signed_at: string | null; signed_at: string | null; expires_at: string | null; review_at: string | null;
  a_review_ar: string | null; b_review_ar: string | null; a_reviewed_at: string | null; b_reviewed_at: string | null; a_decision: 'renew' | 'close' | null; b_decision: 'renew' | 'close' | null; reviewed_at: string | null;
  code: string | null; vc_issuance_id: string | null; meta: any;
};
export type StepState = { complete: boolean; done: number; total: number; read_ar: string; last_at: string | null };
export type Circle = { kind: CircleKind; id: string; title: string | null };

export const PAIR_COLS = 'id,created_at,updated_at,status,circle_kind,circle_id,circle_title,a_user_id,a_email,a_name,a_name_mode,b_user_id,b_email,b_name,b_name_mode,invite_why_ar,a_step,b_step,invited_at,accepted_at,a_signed_at,b_signed_at,signed_at,expires_at,review_at,a_review_ar,b_review_ar,a_reviewed_at,b_reviewed_at,a_decision,b_decision,reviewed_at,code,vc_issuance_id,meta';
export const PAIR_KIND_AR = PLEDGE_KIND_AR;
export const CIRCLE_AR: Record<CircleKind, string> = { council: 'مجلس مشترك', org: 'جهة واحدة' };
export const PRIVACY_PAIR_AR = ['الدعوة بالبريد داخل دائرتك فقط (مجلس تشاركانه أو جهتك) — والردّ لا يكشف عضوية أحد', 'الخطوتان وكلمات «لماذا» بينكما؛ الوثيقة تحمل الاسمين (بالوضع الذي يختاره كلٌّ) والخطوتين والتاريخين فقط', 'صاحبك يرى حالة خطوتك فقط (وقعت / لم تقع بعد) — لا أحداثك ولا مواقفك', 'لا يقرأ أحدكما كلمات مراجعة الآخر حتى يكتب كلماته', 'في رحلتك يُذكر صاحبك «زميل من مجلسك/جهتك» بلا اسم؛ جهتك ترى عددًا بنصاب خمسة', 'لا ذكاء اصطناعي في الطلب ولا في «لماذا» — الكلمات بين إنسانين تبقى لهما'];

const nCh = (n: number) => (n === 0 ? 'بلا فصول' : n === 1 ? 'فصل واحد' : n === 2 ? 'فصلان' : n <= 10 ? `${n} فصول` : `${n} فصلًا`);
const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' });
export const addDays = (iso: string | Date, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
export const pairCode = (rnd: () => string) => `${PAIR_CODE_PREFIX}-${rnd()}-${rnd()}`;
export const lowerE = (s: string | null | undefined) => String(s || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HAS_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;

/** أي طرف أنا؟ (بالمعرّف أو بالبريد) */
export function sideOf(p: Pick<Pair, 'a_user_id' | 'a_email' | 'b_user_id' | 'b_email'>, me: { id: string; email: string }): Side | null {
  const e = lowerE(me.email);
  if (p.a_user_id === me.id || lowerE(p.a_email) === e) return 'a';
  if ((p.b_user_id && p.b_user_id === me.id) || lowerE(p.b_email) === e) return 'b';
  return null;
}
export const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');
/** الاسم كما اختار صاحبه إظهاره */
export function nameFor(p: Pair, side: Side): string {
  const name = String((side === 'a' ? p.a_name : p.b_name) || '').trim(); const mode = side === 'a' ? p.a_name_mode : p.b_name_mode; const email = side === 'a' ? p.a_email : p.b_email;
  if (mode === 'anon') return 'ممارس';
  if (!name) return mode === 'full' ? email.split('@')[0] : 'زميل';
  return mode === 'first' ? name.split(/\s+/)[0] : name;
}
export const stepFor = (p: Pair, side: Side): PairStep | null => (side === 'a' ? p.a_step : p.b_step);
export const isLive = (s: PairStatus) => s === 'proposing' || s === 'active' || s === 'review';

/** أهلية العهد المتقابل: 3 فصول حقيقية — لكل طرف */
export function pairEligibility(chapters: Chapter[]): { ok: boolean; chapters: number; min: number; read_ar: string } {
  const n = chapters.length; const ok = n >= PAIR_MIN_CHAPTERS;
  return { ok, chapters: n, min: PAIR_MIN_CHAPTERS, read_ar: ok ? 'يمكنك أن تدعو زميلًا من دائرتك إلى عهد متقابل.' : `العهد المتقابل يُقطع بعد ${PAIR_MIN_CHAPTERS} فصول في رحلتك — ${n === 0 ? 'ولم يُكتب فصلك الأول بعد' : `لديك ${n === 1 ? 'فصل واحد' : n === 2 ? 'فصلان' : `${n} فصول`}`}. ما وعدتَ به إنسانًا يعرفك أثقل — فليكن بعد أن تعرفك المنصة أولًا.` };
}

export function validateInvite(b: { email?: unknown; why_ar?: unknown; name_mode?: unknown }, myEmail: string): string | null {
  const e = lowerE(String(b.email || '')); if (!EMAIL_RE.test(e)) return 'اكتب بريد زميلك كما يستخدمه في أَثَر';
  if (e === lowerE(myEmail)) return 'العهد المتقابل مع غيرك — عهدك مع نفسك في «أفقي»';
  const w = String(b.why_ar || '').trim(); if (w.length < PAIR_WHY_MIN) return `اكتب «لماذا أنت؟» في ${PAIR_WHY_MIN} حرفًا على الأقل — بكلماتك`; if (w.length > PAIR_WHY_MAX) return `«لماذا أنت» أطول من ${PAIR_WHY_MAX} حرفًا`;
  if (b.name_mode !== undefined && !['full', 'first', 'anon'].includes(String(b.name_mode))) return 'وضع الاسم: full أو first أو anon';
  return null;
}
/** اقتراح لصاحبي: من الخيارات التي اقترحتها المنصة من فصوله هو — الاختيار والكلمات لي */
export function suggestForPartner(partnerChapters: Chapter[], partnerInput: Pick<JourneyInput, 'levels' | 'skills'>): PledgeOption[] { return proposePledges(partnerChapters, partnerInput); }
export function validateProposal(b: { index?: unknown; title_ar?: unknown; why_ar?: unknown }, options: PledgeOption[]): string | null {
  const i = Number(b.index); if (!Number.isInteger(i) || i < 0 || i >= options.length) return 'اختر واحدة من الخطوات المقترحة لصاحبك';
  if (b.title_ar !== undefined && b.title_ar !== null && String(b.title_ar).trim()) { const t = String(b.title_ar).trim(); if (t.length < PAIR_TITLE_MIN) return 'صياغة الخطوة قصيرة جدًا'; if (t.length > PAIR_TITLE_MAX) return `صياغة الخطوة أطول من ${PAIR_TITLE_MAX} حرفًا`; if (HAS_EMAIL.test(t)) return 'لا بُرُد في نص الخطوة'; }
  const w = String(b.why_ar || '').trim(); if (w.length < PAIR_WHY_MIN) return `اكتب «لماذا أطلب منك هذا» في ${PAIR_WHY_MIN} حرفًا على الأقل`; if (w.length > PAIR_WHY_MAX) return `«لماذا» أطول من ${PAIR_WHY_MAX} حرفًا`; if (HAS_EMAIL.test(w)) return 'لا بُرُد في النص';
  return null;
}
export function validateSign(b: { title_ar?: unknown }): string | null {
  if (b.title_ar !== undefined && b.title_ar !== null && String(b.title_ar).trim()) { const t = String(b.title_ar).trim(); if (t.length < PAIR_TITLE_MIN) return 'صياغة عهدك قصيرة جدًا'; if (t.length > PAIR_TITLE_MAX) return `صياغة عهدك أطول من ${PAIR_TITLE_MAX} حرفًا`; if (HAS_EMAIL.test(t)) return 'لا بُرُد في نص العهد'; }
  return null;
}
export function validatePairReview(b: { note_ar?: unknown; decision?: unknown }): string | null {
  const t = String(b.note_ar || '').trim(); if (t.length < PAIR_REVIEW_MIN) return `اكتب «ما تغيّر فيّ بسببك» في ${PAIR_REVIEW_MIN} حرفًا على الأقل`; if (t.length > PAIR_REVIEW_MAX) return `المراجعة أطول من ${PAIR_REVIEW_MAX} حرفًا`;
  if (b.decision !== 'renew' && b.decision !== 'close') return 'القرار: renew (نجدّد) أو close (نطوي)';
  return null;
}

/** درب طرف واحد — محرّك P27 نفسه (الأحداث بعد التوقيع وقبل الآن) */
export function pairPath(step: PairStep, signedAt: string, inp: JourneyInput, now = Date.now()): Path { return buildPath({ kind: step.kind, target: step.target, signed_at: signedAt }, inp, now); }
/** ما يراه صاحبي من دربي: الحالة فقط */
export function stepState(path: Path | null, signedAt?: string | null): StepState {
  if (!path) return { complete: false, done: 0, total: 0, read_ar: 'لم تُوقَّع بعد', last_at: null };
  const done = path.steps.filter(s => s.done).length; const total = path.steps.length; const last = path.steps.filter(s => s.done && s.at).map(s => s.at as string).sort().slice(-1)[0] || null;
  const q = last && signedAt ? quarterLabel(signedAt, last) : null;
  return { complete: path.complete, done, total, last_at: last, read_ar: path.complete ? `وقعت${q ? ` في ${q}` : ''}` : done ? `${done} من ${total} ${total === 1 ? 'خطوة' : 'خطوات'} وقعت` : 'لم تقع بعد' };
}
const QUARTER_AR = ['الربع الأول من العهد', 'الربع الثاني من العهد', 'الربع الثالث من العهد', 'الربع الأخير من العهد'];
export function quarterLabel(signedAt: string, at: string): string { const i = Math.floor((new Date(at).getTime() - new Date(signedAt).getTime()) / (91 * 864e5)); return QUARTER_AR[Math.max(0, Math.min(3, i))]; }

/** المرآة المشتركة: سطر واحد للاثنين */
export function pairMirror(signedAt: string, mine: StepState, partner: StepState, partnerName: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(signedAt).getTime()) / 864e5); const q = days < 91 ? 'الربع الأول من العهد' : days < 182 ? 'ربع العهد مضى' : days < 273 ? 'مرّ نصف العهد' : days < 365 ? 'الربع الأخير من العهد' : 'اكتملت سنة العهد';
  const me = mine.complete ? 'خطوتك وقعت' : mine.done ? `${mine.done} من ${mine.total} من خطوتك وقعت` : 'خطوتك لم تقع بعد';
  const pt = partner.complete ? `وخطوة ${partnerName} وقعت` : partner.done ? `وخطوة ${partnerName} في طريقها` : `وخطوة ${partnerName} لم تقع بعد`;
  return `${q}: ${me}، ${pt}. لا حكم هنا — السنة ${days < 365 ? 'ما زالت مفتوحة' : 'اكتملت'}.`;
}
/** نص المراجعة المشتركة — بلا حكم */
export function pairReviewText(me: { name: string; step: PairStep; state: StepState }, partner: { name: string; step: PairStep; state: StepState }, signedAt: string, chaptersThen: number, chaptersNow: number): string {
  return [`قبل سنة — في ${fmtD(signedAt)} — طلب ${partner.name} منك: «${me.step.title_ar}»، وطلبتَ من ${partner.name}: «${partner.step.title_ar}».`,
    `خطوتك: ${me.state.read_ar}. خطوة ${partner.name}: ${partner.state.read_ar}.`,
    `يومها كانت رحلتك ${nCh(chaptersThen)}، واليوم ${nCh(chaptersNow)}.`,
    `اكتب ما تغيّر فيك بسبب ${partner.name} — ولن يقرأه حتى يكتب ما تغيّر فيه بسببك. ثم قرّرا: تجدّدان أم تطويان. ما لم يُراجَع ليس فشلًا.`].join(' ');
}
/** التقاء العهود: نوع الخطوة المطلوبة مني يطابق نوع عهدي مع نفسي (P27) */
export const meetsHorizon = (step: PairStep | null, horizonKind: PledgeKind | null): boolean => !!step && !!horizonKind && step.kind === horizonKind;

/** قرار المراجعة المشتركة: renew فقط إن قرّر الطرفان renew؛ وإلا close */
export function jointDecision(a: 'renew' | 'close' | null, b: 'renew' | 'close' | null): 'renew' | 'close' | null { if (!a || !b) return null; return a === 'renew' && b === 'renew' ? 'renew' : 'close'; }
/** مهلة الدعوة/الاقتراح */
export const inviteExpired = (p: Pick<Pair, 'status' | 'invited_at' | 'accepted_at'>, now = Date.now()) => (p.status === 'invited' && new Date(p.invited_at).getTime() + PAIR_INVITE_DAYS * 864e5 <= now) || (p.status === 'proposing' && !!p.accepted_at && new Date(p.accepted_at).getTime() + PAIR_PROPOSE_DAYS * 864e5 <= now);
export const reviewOpen = (p: Pick<Pair, 'status' | 'review_at'>, now = Date.now()) => p.status === 'review' || (p.status === 'active' && !!p.review_at && new Date(p.review_at).getTime() <= now);

/** ما يُعاد لكل طرف — صاحبه لا يرى كلمات مراجعته قبل أن يكتب كلماته */
export function viewFor(p: Pair, side: Side): Pair & { my_side: Side; partner_review_ar: string | null; partner_name: string; my_name: string } {
  const o = other(side); const mineWritten = !!(side === 'a' ? p.a_reviewed_at : p.b_reviewed_at); const theirs = o === 'a' ? p.a_review_ar : p.b_review_ar;
  const hidden = { ...p } as any; hidden[`${o}_review_ar`] = mineWritten ? theirs : null;
  return { ...hidden, my_side: side, partner_review_ar: mineWritten ? theirs : null, partner_name: nameFor(p, o), my_name: nameFor(p, side) };
}

/** ملخص للوكلاء (داخل my_horizon) — قراءة فقط، بلا أسماء */
export function pairSummary(p: Pair | null, side: Side | null, mine: StepState | null, partner: StepState | null, invitesIn: number) {
  if (!p || !side) return { version: PAIR_VERSION, status: null, invites_in: invitesIn };
  const s = stepFor(p, side);
  return { version: PAIR_VERSION, status: p.status, circle: p.circle_kind, code: p.code, signed_at: p.signed_at, review_at: p.review_at, my_step: s ? { kind: s.kind, kind_ar: PAIR_KIND_AR[s.kind], title_ar: s.title_ar } : null, my_state: mine ? { complete: mine.complete, read_ar: mine.read_ar } : null, partner_step_state: partner ? { complete: partner.complete, read_ar: partner.read_ar } : null, invites_in: invitesIn };
}
