// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مجالس أَثَر (P23) — الثوابت والأنواع والدوال النقية
 *  المجلس = 5–7 ممارسين من جهتين على الأقل · دورة 6 أسابيع · الكرسي يدور · ميثاق تشاتام هاوس
 *  دورة القضية: القضية → المداولة (سؤال قبل نصيحة) → الالتزام (عودة خلال 14 يومًا) → العودة → شهادة الأقران (بدليل، يعتمدها إنسان)
 *  المبدأ الحاكم: الذكاء الاصطناعي كاتب المجلس لا قاضيه.
 */
export const COUNCIL_MIN = 5; export const COUNCIL_MAX = 7; export const MIN_ORGS = 2; export const CYCLE_WEEKS = 6;
export const RETURN_DAYS = 14; export const BADGE_CYCLES = 3; export const BADGE_ATTESTATIONS = 3; export const K_ANON = 5;
export const ATTEST_MIN_CHARS = 20; export const CASE_MIN_CHARS = 40; export const POST_MIN_CHARS = 8;
export const CHARTER_VERSION = '2026-10';
export const CHARTER_AR = [
  { id: 'chatham', title: 'السرية', body: 'ما يُقال في المجلس يبقى فيه. يجوز نقل الفكرة، ولا يجوز نسبتها إلى قائلها أو جهته (قاعدة تشاتام هاوس).' },
  { id: 'presence', title: 'الحضور', body: 'أتابع القضية الجارية مرة في الأسبوع على الأقل، وأعتذر مسبقًا إن غبت دورة كاملة.' },
  { id: 'ask_first', title: 'أسأل قبل أن أنصح', body: 'أطرح سؤالًا يساعد صاحب القضية على الرؤية قبل أن أقترح حلًا — والمجلس يعدّ الأسئلة والنصائح وأرى ذلك في مرآتي.' },
  { id: 'honest_return', title: 'الصدق في العودة', body: 'حين ألتزم أعود بما حدث فعلًا: نجح، تعثّر، أو تغيّر فهمي — فالعودة أثمن لحظة تعلّم في المجلس كله.' },
  { id: 'no_hierarchy', title: 'لا تسويق ولا تسلسل إداري', body: 'داخل المجلس الجميع أقران: لا ترويج لخدمة، ولا استعمال لموقع وظيفي، ولا تقييم لشخص — الشهادة للدليل المحدد فقط.' },
];

export type CouncilStatus = 'proposed' | 'active' | 'paused' | 'closed';
export type MemberStatus = 'applied' | 'invited' | 'active' | 'left';
export type CaseStatus = 'open' | 'committed' | 'returned' | 'closed';
export type PostKind = 'question' | 'advice' | 'evidence' | 'return_note';
export type ReturnOutcome = 'succeeded' | 'struggled' | 'reframed';
export type AttestStatus = 'pending' | 'approved' | 'declined';

export type Council = { id: string; created_at: string; created_by?: string | null; title_ar: string; domain: string | null; sector_code: string | null; skill_ids: string[]; status: CouncilStatus; cycle_no: number; cycle_weeks: number; cycle_started_at: string | null; cycle_ends_at: string | null; chair_email: string | null; charter_version: string; max_members: number; min_orgs: number; meta?: Record<string, any> };
export type Member = { id: number; created_at: string; council_id: string | null; user_id: string | null; email: string; full_name: string | null; organization_id: string | null; role: 'chair' | 'member'; status: MemberStatus; charter_signed_at: string | null; joined_at: string | null; left_at: string | null; cycles_completed: number; last_seen_at?: string | null; note?: string | null; meta?: Record<string, any> };
export type Case = { id: string; created_at: string; council_id: string; cycle_no: number; author_user_id: string | null; author_email: string; title_ar: string; body_ar: string; kind: 'text' | 'audio' | 'video'; media_id: string | null; status: CaseStatus; commitment_ar: string | null; committed_at: string | null; return_due_at: string | null; return_ar: string | null; return_outcome: ReturnOutcome | null; returned_at: string | null; closed_at: string | null; reminded_at?: string | null; theme: string | null; meta?: Record<string, any> };
export type Post = { id: number; created_at: string; case_id: string; council_id: string; user_id: string | null; email: string; kind: PostKind; body_ar: string; media_id: string | null; meta?: Record<string, any> };
export type Attestation = { id: number; created_at: string; council_id: string; case_id: string | null; cycle_no: number; from_user_id: string | null; from_email: string; to_user_id: string | null; to_email: string; skill_id: string; evidence_ar: string; status: AttestStatus; approver_role: 'org_admin' | 'staff' | null; approved_by: string | null; decided_at: string | null; decision_note: string | null; event_id: number | null; reminded_at?: string | null };
export type Scribe = { id?: number; created_at?: string; case_id: string; council_id: string; phase: 'deliberation' | 'commitment' | 'return'; summary_ar: string; commitments: string[]; pivotal_questions: string[]; unsaid_ar: string | null; patterns: string[]; source: 'ai' | 'local'; model: string | null };

export const COUNCIL_COLS = 'id,created_at,created_by,title_ar,domain,sector_code,skill_ids,status,cycle_no,cycle_weeks,cycle_started_at,cycle_ends_at,chair_email,charter_version,max_members,min_orgs,meta';
export const MEMBER_COLS = 'id,created_at,council_id,user_id,email,full_name,organization_id,role,status,charter_signed_at,joined_at,left_at,cycles_completed,last_seen_at,note,meta';
export const CASE_COLS = 'id,created_at,council_id,cycle_no,author_user_id,author_email,title_ar,body_ar,kind,media_id,status,commitment_ar,committed_at,return_due_at,return_ar,return_outcome,returned_at,closed_at,reminded_at,theme,meta';
export const POST_COLS = 'id,created_at,case_id,council_id,user_id,email,kind,body_ar,media_id,meta';
export const ATTEST_COLS = 'id,created_at,council_id,case_id,cycle_no,from_user_id,from_email,to_user_id,to_email,skill_id,evidence_ar,status,approver_role,approved_by,decided_at,decision_note,event_id,reminded_at';

export const STATUS_AR: Record<CouncilStatus, string> = { proposed: 'قيد التشكيل', active: 'منعقد', paused: 'متوقف مؤقتًا', closed: 'مغلق' };
export const CASE_STATUS_AR: Record<CaseStatus, string> = { open: 'المداولة جارية', committed: 'التزام — في انتظار العودة', returned: 'عاد صاحبها', closed: 'مغلقة' };
export const POST_KIND_AR: Record<PostKind, string> = { question: 'سؤال', advice: 'نصيحة', evidence: 'دليل', return_note: 'ملاحظة عودة' };
export const OUTCOME_AR: Record<ReturnOutcome, string> = { succeeded: 'نجح', struggled: 'تعثّر', reframed: 'تغيّر فهمي' };
export const ATTEST_STATUS_AR: Record<AttestStatus, string> = { pending: 'بانتظار الاعتماد', approved: 'معتمدة', declined: 'مرفوضة' };
/** موضوعات خريطة الحكمة — وسوم مجهولة ثابتة حتى تتجمّع القضايا عبر المجالس (يختار كاتب المجلس منها حتى 3) */
export const THEMES_AR: { code: string; label: string; hints: string[] }[] = [
  { code: 'conflict', label: 'إدارة الخلاف وتحويل الصراع إلى مصالح', hints: ['خلاف', 'صراع', 'نزاع', 'توتر', 'اعتراض'] },
  { code: 'upward', label: 'التأثير إلى أعلى (الإدارة العليا)', hints: ['المدير', 'الوزير', 'الرئيس', 'الإدارة العليا', 'القيادة', 'إقناع'] },
  { code: 'change', label: 'قيادة التغيير ومقاومته', hints: ['تغيير', 'مقاومة', 'تحول', 'تطوير', 'جديد'] },
  { code: 'delegation', label: 'التفويض وبناء الفريق', hints: ['فريق', 'تفويض', 'موظف', 'زميل', 'مهام'] },
  { code: 'quality', label: 'الجودة والاعتماد والقياس', hints: ['جودة', 'اعتماد', 'مؤشر', 'قياس', 'تقويم', 'معيار'] },
  { code: 'learning_design', label: 'تصميم التعلّم وتقويم أثره', hints: ['برنامج', 'تدريب', 'حقيبة', 'متدرب', 'جلسة', 'تعلم'] },
  { code: 'ethics', label: 'النزاهة والقرارات الرمادية', hints: ['نزاهة', 'أخلاق', 'تضارب', 'مصلحة', 'ضغط', 'مجاملة'] },
  { code: 'data_ai', label: 'القرار بالبيانات والذكاء الاصطناعي', hints: ['بيانات', 'ذكاء', 'نموذج', 'تقرير', 'أتمتة', 'نظام'] },
  { code: 'wellbeing', label: 'الاحتراق والحدود والطاقة', hints: ['إرهاق', 'احتراق', 'ضغط', 'وقت', 'توازن', 'حدود'] },
  { code: 'stakeholders', label: 'أصحاب المصلحة والشراكات', hints: ['شريك', 'جهة', 'عميل', 'مستفيد', 'شراكة', 'تعاون'] },
];
export const themeLabel = (code: string | null | undefined) => THEMES_AR.find(t => t.code === code)?.label || code || '';

// ---------- دوال نقية
export const addDays = (iso: string | Date, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
export const cycleEnd = (start: string | Date, weeks = CYCLE_WEEKS) => addDays(start, weeks * 7);
export const returnDue = (committedAt: string | Date, days = RETURN_DAYS) => addDays(committedAt, days);
export const daysLeft = (iso: string | null | undefined, now = Date.now()) => iso ? Math.ceil((new Date(iso).getTime() - now) / 864e5) : null;
export const lower = (s: string | null | undefined) => String(s || '').trim().toLowerCase();
export const isActiveMember = (m: Pick<Member, 'status' | 'left_at'>) => m.status === 'active' && !m.left_at;
export const activeMembers = (ms: Member[]) => ms.filter(isActiveMember);
export const orgCount = (ms: Pick<Member, 'organization_id'>[]) => new Set(ms.map(m => m.organization_id || 'none')).size;
/** هل يستوفي المجلس شرط الانعقاد؟ (≥ 3 موقّعين على الميثاق و≥ 2 جهة — الحد الأدنى التشغيلي؛ الهدف 5–7) */
export function quorum(ms: Member[]) {
  const act = activeMembers(ms).filter(m => m.charter_signed_at); const orgs = orgCount(act);
  return { signed: act.length, orgs, ok: act.length >= 3 && orgs >= MIN_ORGS, full: act.length >= COUNCIL_MIN && orgs >= MIN_ORGS };
}
/** دوران الكرسي: العضو النشط الموقِّع التالي (ترتيب الانضمام) بعد الكرسي الحالي — ومن لم يرأس بعد أولًا */
export function nextChair(ms: Member[], currentEmail: string | null): Member | null {
  const act = activeMembers(ms).filter(m => m.charter_signed_at).sort((a, b) => (a.joined_at || a.created_at) < (b.joined_at || b.created_at) ? -1 : 1);
  if (!act.length) return null;
  const never = act.filter(m => !(m.meta?.chaired_cycles || []).length && lower(m.email) !== lower(currentEmail));
  if (never.length) return never[0];
  const i = act.findIndex(m => lower(m.email) === lower(currentEmail)); return act[(i + 1) % act.length];
}
/** تصنيف موضوع القضية محليًا من النص (البديل حين يغيب الذكاء الاصطناعي) */
export function localThemes(text: string, max = 3): string[] {
  const t = String(text || ''); const scored = THEMES_AR.map(th => ({ code: th.code, n: th.hints.reduce((s, h) => s + (t.includes(h) ? 1 : 0), 0) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  return scored.slice(0, max).map(x => x.code);
}
/** شكل الدائرة الحيّة العام — مجهول: لا أسماء ولا جهات ولا نص القضية */
export function publicCircle(c: Council, members: Member[], cases: Case[], feed: Record<string, any>, now = Date.now()) {
  const act = activeMembers(members); const current = cases.find(x => x.status === 'open' || x.status === 'committed') || null;
  const f = current ? feed[current.id] || {} : {}; const lastAt = f.last_at ? new Date(f.last_at).getTime() : 0;
  const pulse = !current ? 'quiet' : lastAt && now - lastAt < 2 * 864e5 ? 'lively' : lastAt && now - lastAt < 7 * 864e5 ? 'steady' : 'quiet';
  return {
    code: c.id.replace(/-/g, '').slice(-8), title_ar: c.title_ar, domain: c.domain, sector_code: c.sector_code, status: c.status, cycle_no: c.cycle_no, cycle_ends_at: c.cycle_ends_at,
    members: act.length, orgs: orgCount(act), seats_open: Math.max(0, c.max_members - act.length),
    case: current ? { status: current.status, theme: current.theme, theme_ar: themeLabel(current.theme), opened_days: Math.max(0, Math.floor((now - new Date(current.created_at).getTime()) / 864e5)), questions: Number(f.questions || 0), advice: Number(f.advice || 0), evidence: Number(f.evidence || 0), voices: Number(f.voices || 0) } : null,
    pulse, cases_total: cases.length, returns: cases.filter(x => x.returned_at).length,
  };
}
/** حساب النبض من المنشورات مباشرة (بديل council_feed حين يتعذّر RPC) */
export function feedFromPosts(posts: Pick<Post, 'case_id' | 'kind' | 'email' | 'created_at'>[]): Record<string, { posts: number; questions: number; advice: number; evidence: number; voices: number; last_at: string | null }> {
  const out: Record<string, any> = {};
  for (const p of posts) { const f = (out[p.case_id] = out[p.case_id] || { posts: 0, questions: 0, advice: 0, evidence: 0, _v: new Set<string>(), last_at: null }); f.posts++; const key = p.kind === 'question' ? 'questions' : p.kind; if (key in f) f[key]++; f._v.add(lower(p.email)); if (!f.last_at || p.created_at > f.last_at) f.last_at = p.created_at; }
  for (const k of Object.keys(out)) { out[k].voices = out[k]._v.size; delete out[k]._v; }
  return out;
}
