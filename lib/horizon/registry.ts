// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أفق الممارس (P27) — الاسم الرسمي «أفق الممارس» · السردي «رسالتي من 2036»
 * «لا نرسم لك مسارًا؛ نساعدك أن تكتب رسالتك من 2036 وتقطع عهدًا واحدًا لسنة — ونحن نشهد لا نحكم».
 * الحركات الخمس: الأفق (أنا في 2036 بصوتي) → المهمات الثلاث (خطوات تعرفها المنصة) → العهد (وثيقة ATH-HZ · 365 يومًا) → الدرب (يُشتق من الأحداث لا من التصريح) → المراجعة السنوية (ما وعدتُ / ما وقع).
 * قواعد ثابتة: لا أفق قبل 3 فصول حقيقية · عهد واحد نشط · لا نسبة إنجاز · الأفق لا يُنشر أبدًا · الذكاء الاصطناعي يقترح مسودة واحدة من كلمات الشخص وفصوله ولا يقيّم.
 */
import type { Chapter, JourneyInput } from '../journey/registry';

export const HORIZON_VERSION = '2026-10';
export const HORIZON_MIN_CHAPTERS = 3;        // الأفق يُكتب من فصول وقعت
export const HORIZON_YEARS = 10;              // 2026 → 2036
export const PLEDGE_DAYS = 365;               // صلاحية العهد وموعد المراجعة
export const REVIEW_WINDOW_DAYS = 30;         // نافذة المراجعة ثم يُطوى تلقائيًا
export const MIDYEAR_DAY = 182;               // تذكير لطيف واحد
export const MAX_SCENARIO_CHARS = 1200; export const MIN_SCENARIO_CHARS = 80;
export const MAX_REVIEW_CHARS = 1500; export const MAX_PLEDGE_TITLE = 160;
export const PLEDGE_OPTIONS = 3;
export const DAILY_PLEDGE_DAYS = 20;
export const PLEDGE_CODE_PREFIX = 'ATH-HZ';

export type PledgeKind = 'council' | 'mission' | 'daily' | 'level' | 'credential';
export type PledgeTarget = { days?: number; count?: number; steps?: number; skill_id?: string; skill_ar?: string; to?: number; from?: number | null };
export type PledgeOption = { kind: PledgeKind; title_ar: string; why_ar: string; target: PledgeTarget };
export type HorizonStatus = 'draft' | 'active' | 'review' | 'renewed' | 'archived';
export type Horizon = { id: string; created_at: string; updated_at: string; user_id: string; email: string; full_name: string | null; year_target: number; scenario_ar: string; scenario_source: 'own' | 'local' | 'ai'; status: HorizonStatus; activated_at: string | null; review_at: string | null; reviewed_at: string | null; review_note_ar: string | null; decision: 'renew' | 'archive' | null; options: PledgeOption[]; meta: any };
export type Pledge = { id: string; created_at: string; horizon_id: string; user_id: string; email: string; kind: PledgeKind; title_ar: string; target: PledgeTarget; code: string | null; signed_at: string | null; expires_at: string | null; revoked_at: string | null; status: 'active' | 'revoked' | 'reviewed' | 'expired'; vc_issuance_id: string | null; meta: any };
export type PathStep = { label_ar: string; done: boolean; at: string | null; detail_ar: string | null };
export type Path = { kind: PledgeKind; steps: PathStep[]; read_ar: string; quarters: { label: string; text_ar: string }[]; complete: boolean };

export const HORIZON_COLS = 'id,created_at,updated_at,user_id,email,full_name,year_target,scenario_ar,scenario_source,status,activated_at,review_at,reviewed_at,review_note_ar,decision,options,meta';
export const PLEDGE_COLS = 'id,created_at,horizon_id,user_id,email,kind,title_ar,target,code,signed_at,expires_at,revoked_at,status,vc_issuance_id,meta';
export const PLEDGE_KIND_AR: Record<PledgeKind, string> = { council: 'مجلس أقران', mission: 'مهمة من قلب العمل', daily: 'كل يوم مهارة', level: 'مستوى معتمد', credential: 'شهادة قرين' };
export const PRIVACY_HORIZON_AR = ['الأفق («أنا في 2036») لا يُنشر أبدًا ولا يراه غيرك', 'العهد وثيقة باسمك تعرض عنوانه وتاريخه فقط', 'الدرب يُشتق من أحداث وقعت لا من تصريحك — ولا نسبة إنجاز', 'جهتك ترى عددًا واحدًا: كم شخصًا عاهدوا أنفسهم (خمسة فأكثر)', 'الذكاء الاصطناعي يقترح مسودة واحدة من كلماتك وفصولك ولا يحكم عليها'];

const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' });
export const addDays = (iso: string | Date, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
export const pledgeCode = (rnd: () => string) => `${PLEDGE_CODE_PREFIX}-${rnd()}-${rnd()}`;
export const yearTarget = (now = Date.now()) => new Date(now).getUTCFullYear() + HORIZON_YEARS;

/** أهلية الأفق: ثلاثة فصول حقيقية على الأقل */
export function eligibility(chapters: Chapter[]): { ok: boolean; chapters: number; min: number; read_ar: string } {
  const n = chapters.length; const ok = n >= HORIZON_MIN_CHAPTERS;
  return { ok, chapters: n, min: HORIZON_MIN_CHAPTERS, read_ar: ok ? 'يمكنك كتابة أفقك — لديك فصول وقعت فعلًا تُكتب منها.' : `الأفق يُكتب بعد ${HORIZON_MIN_CHAPTERS} فصول — لديك ${n === 0 ? 'لا فصل بعد' : n === 1 ? 'فصل واحد' : n === 2 ? 'فصلان' : `${n} فصول`}. ابدأ من «كل يوم مهارة» أو مهامك.` };
}

/** مسودة محلية للأفق (بلا ذكاء اصطناعي): بصيغة المتكلم في المستقبل، من فصول الشخص وكلماته فقط */
export function localScenario(chapters: Chapter[], own: string[], year = yearTarget()): string {
  if (!chapters.length) return '';
  const k = (kind: string) => chapters.filter(c => c.kind === kind).length; const lv = chapters.filter(c => c.level).slice(-1)[0]?.level || null;
  const q = own.find(s => s.length >= 20 && s.length <= 160);
  const parts = [`في ${year} أنظر إلى الوراء فأرى أن ما بدأ بـ«${chapters[0].title_ar}» صار طريقة عمل لا حدثًا.`];
  if (k('daily')) parts.push('المواقف التي كنت أكتب فيها كيف أتصرّف صارت تُكتب عني: زملاء يسألونني كيف أتصرّف.');
  if (k('mission')) parts.push('الأثر الذي أكّده مشرفي مرة صار أثرًا يؤكّده من أشرف عليهم أنا.');
  if (k('council') || k('return')) parts.push('ما زلت أجلس إلى مجلس أقران — لكنني الآن من يذكّر الجدد بأن العودة بما حدث أثمن من الالتزام.');
  if (lv) parts.push(`«${lv.skill_ar}» التي اعتُمد فيها مستواي ${lv.to} لم تعد مهارتي؛ صارت ما يعرفني به الناس.`);
  if (q) parts.push(`أعود إلى كلماتي القديمة: «${q}» — وأبتسم لأنها كانت أول الطريق.`);
  parts.push('لم أصل إلى هنا بخطة كبيرة؛ وصلت بعهد واحد في كل سنة، وفيتُ ببعضه وراجعتُ بعضه.');
  return parts.join(' ').slice(0, MAX_SCENARIO_CHARS);
}

export function validateScenario(b: { scenario_ar?: unknown; source?: unknown }): string | null {
  const s = String(b.scenario_ar || '').trim();
  if (s.length < MIN_SCENARIO_CHARS) return `اكتب أفقك في ${MIN_SCENARIO_CHARS} حرفًا على الأقل — بصوتك`;
  if (s.length > MAX_SCENARIO_CHARS) return `الأفق أطول من ${MAX_SCENARIO_CHARS} حرفًا`;
  if (b.source !== undefined && !['own', 'local', 'ai'].includes(String(b.source))) return 'مصدر غير معروف';
  return null;
}

/** المهمات الثلاث: خطوات لسنة واحدة تعرفها المنصة — تُشتق مما لم يعشه الشخص بعد، ثم مما يمكنه تعميقه */
export function proposePledges(chapters: Chapter[], inp: Pick<JourneyInput, 'levels' | 'skills'>, n = PLEDGE_OPTIONS): PledgeOption[] {
  const has = (kind: string) => chapters.some(c => c.kind === kind);
  const out: PledgeOption[] = [];
  if (!has('council')) out.push({ kind: 'council', title_ar: 'أنضم إلى مجلس أقران، أحمل إليه موقفًا حقيقيًا، وأعود بما حدث', why_ar: 'لم تجلس بعد إلى طاولة لا تضم جهتك وحدها.', target: { steps: 3 } });
  else if (!has('return')) out.push({ kind: 'council', title_ar: 'أعود إلى مجلسي بما حدث فعلًا بعد التزامي', why_ar: 'جلستَ إلى المجلس ولم تعد بعدُ بما حدث — العودة أثمن لحظة تعلّم.', target: { steps: 3 } });
  if (!has('mission')) out.push({ kind: 'mission', title_ar: 'أنقل ما تعلّمته إلى مهمة من قلب العمل يؤكّدها مشرفي', why_ar: 'لم يؤكّد مشرفٌ بعدُ أثرًا لك في العمل.', target: { count: 1 } });
  // مستوى: أعلى مهارة معتمدة دون 5 → مستوى واحد أعلى
  const lv = [...inp.levels].filter(l => l.approved_level && l.approved_level < 5).sort((a, b) => (b.approved_level || 0) - (a.approved_level || 0))[0];
  if (lv) out.push({ kind: 'level', title_ar: `أرفع مستواي المعتمد في «${inp.skills[lv.skill_id] || 'مهارتي'}» من ${lv.approved_level} إلى ${(lv.approved_level || 0) + 1}`, why_ar: 'مستوى اعتمده إنسان يمكن أن يرتفع بأدلة جديدة واعتماد جديد.', target: { skill_id: lv.skill_id, skill_ar: inp.skills[lv.skill_id] || 'مهارة', from: lv.approved_level, to: (lv.approved_level || 0) + 1 } });
  if (!has('attestation')) out.push({ kind: 'credential', title_ar: 'أنال شهادة قرين على سلوك رآه فعلًا', why_ar: 'لم يشهد لك قرين بعد — الشهادة تأتي من مجلس لا من طلب.', target: { count: 1 } });
  out.push({ kind: 'daily', title_ar: `أواجه ${DAILY_PLEDGE_DAYS} موقفًا في «كل يوم مهارة» بكلماتي`, why_ar: 'الاستمرار نفسه مهارة — عشرون موقفًا في سنة.', target: { days: DAILY_PLEDGE_DAYS } });
  if (has('mission')) out.push({ kind: 'mission', title_ar: 'أنجز مهمة جديدة من قلب العمل يؤكّدها مشرفي', why_ar: 'أثرٌ ثانٍ يؤكّده إنسان.', target: { count: 1 } });
  if (has('council') && has('return')) out.push({ kind: 'council', title_ar: 'أحمل موقفًا جديدًا إلى مجلسي وأعود بما حدث', why_ar: 'دورة كاملة أخرى: قضية → التزام → عودة.', target: { steps: 3 } });
  // أنواع متمايزة أولًا
  const seen = new Set<PledgeKind>(); const distinct = out.filter(o => (seen.has(o.kind) ? false : (seen.add(o.kind), true)));
  return distinct.slice(0, n);
}

export function validatePledgeChoice(b: { index?: unknown; title_ar?: unknown }, options: PledgeOption[]): string | null {
  const i = Number(b.index); if (!Number.isInteger(i) || i < 0 || i >= options.length) return 'اختر واحدة من الخطوات الثلاث';
  if (b.title_ar !== undefined && b.title_ar !== null) { const t = String(b.title_ar).trim(); if (t.length < 10) return 'صياغة العهد قصيرة جدًا'; if (t.length > MAX_PLEDGE_TITLE) return `صياغة العهد أطول من ${MAX_PLEDGE_TITLE} حرفًا`; if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(t)) return 'لا بُرُد في نص العهد'; }
  return null;
}
export function validateReview(b: { note_ar?: unknown; decision?: unknown }): string | null {
  const t = String(b.note_ar || '').trim(); if (t.length < 20) return 'اكتب ما تغيّر في 20 حرفًا على الأقل — بكلماتك';
  if (t.length > MAX_REVIEW_CHARS) return `المراجعة أطول من ${MAX_REVIEW_CHARS} حرفًا`;
  if (b.decision !== 'renew' && b.decision !== 'archive') return 'القرار: renew (أجدّد) أو archive (أطوي)';
  return null;
}

/** الدرب: ما وقع فعلًا بعد توقيع العهد — من مدخلات الرحلة نفسها؛ سرد لا نسبة */
export function buildPath(p: Pick<Pledge, 'kind' | 'target' | 'signed_at'>, inp: JourneyInput, now = Date.now()): Path {
  const since = p.signed_at || new Date(0).toISOString(); const after = (iso: string | null | undefined) => !!iso && iso >= since && new Date(iso).getTime() <= now;
  const steps: PathStep[] = []; let complete = false;
  if (p.kind === 'council') {
    const j = inp.memberships.filter(m => m.joined_at && m.status !== 'applied' && m.status !== 'invited').sort((a, b) => String(a.joined_at).localeCompare(String(b.joined_at)));
    const joinedBefore = j.some(m => !after(m.joined_at)); const jn = j.find(m => after(m.joined_at)) || null;
    const cs = inp.cases.filter(c => after(c.created_at)).sort((a, b) => a.created_at.localeCompare(b.created_at))[0] || null;
    const rt = inp.cases.filter(c => after(c.returned_at)).sort((a, b) => String(a.returned_at).localeCompare(String(b.returned_at)))[0] || null;
    steps.push({ label_ar: 'الجلوس إلى مجلس', done: !!jn || joinedBefore, at: jn?.joined_at || null, detail_ar: jn ? `انضممتَ إلى «${jn.council_title || 'مجلس'}»` : joinedBefore ? 'كنتَ عضوًا قبل العهد' : null });
    steps.push({ label_ar: 'حمل موقف إلى المجلس', done: !!cs, at: cs?.created_at || null, detail_ar: cs ? `«${cs.title_ar}»` : null });
    steps.push({ label_ar: 'العودة بما حدث', done: !!rt, at: rt?.returned_at || null, detail_ar: rt ? (rt.return_outcome === 'succeeded' ? 'عدتَ: نجحتُ' : rt.return_outcome === 'struggled' ? 'عدتَ: تعثّرتُ' : rt.return_outcome === 'reframed' ? 'عدتَ: تغيّر فهمي' : 'عدتَ') : null });
    complete = !!rt;
  } else if (p.kind === 'mission') {
    const ms = inp.missions.filter(m => after(m.confirmed_at)).sort((a, b) => String(a.confirmed_at).localeCompare(String(b.confirmed_at)));
    const sub = inp.missions.filter(m => after(m.submitted_at) && !m.confirmed_at)[0] || null;
    steps.push({ label_ar: 'تسليم مهمة بأدلتها', done: !!ms.length || !!sub, at: ms[0]?.submitted_at || sub?.submitted_at || null, detail_ar: ms[0] ? `«${ms[0].title_ar}»` : sub ? `«${sub.title_ar}» — بانتظار المشرف` : null });
    steps.push({ label_ar: 'تأكيد المشرف', done: !!ms.length, at: ms[0]?.confirmed_at || null, detail_ar: ms[0] ? 'أكّد مشرفك أنها حدثت' : null });
    complete = ms.length >= (p.target.count || 1);
  } else if (p.kind === 'daily') {
    const want = p.target.days || DAILY_PLEDGE_DAYS; const days = new Set(inp.daily.filter(d => after(d.created_at)).map(d => d.created_at.slice(0, 10))); const n = days.size;
    steps.push({ label_ar: `مواقف واجهتَها بعد العهد: ${n} من ${want}`, done: n >= want, at: n ? Array.from(days).sort().slice(-1)[0] : null, detail_ar: n ? `آخرها ${fmtD(Array.from(days).sort().slice(-1)[0])}` : null });
    complete = n >= want;
  } else if (p.kind === 'level') {
    const l = inp.levels.find(x => x.skill_id === p.target.skill_id) || null; const reached = !!l && after(l.approved_at) && (l.approved_level || 0) >= (p.target.to || 0);
    steps.push({ label_ar: `اعتماد المستوى ${p.target.to} في «${p.target.skill_ar || 'المهارة'}»`, done: reached, at: reached ? l!.approved_at : null, detail_ar: reached ? 'اعتمده إنسان بعد العهد' : l?.computed_level ? `المحسوب الآن ${Number(l.computed_level).toFixed(1)} · المعتمد ${l.approved_level ?? '—'}` : null });
    complete = reached;
  } else {
    const at = inp.attestations.filter(a => a.status === 'approved' && after(a.decided_at || a.created_at))[0] || null; const cr = inp.credentials.filter(c => after(c.issued_at))[0] || null;
    steps.push({ label_ar: 'قرين يشهد لك ويعتمدها إنسان — أو اعتماد يصدر باسمك', done: !!at || !!cr, at: at ? (at.decided_at || at.created_at) : cr?.issued_at || null, detail_ar: at ? `شهادة قرين في «${inp.skills[at.skill_id] || 'مهارة'}»` : cr ? `«${cr.title_ar}»` : null });
    complete = !!at || !!cr;
  }
  // مرآة ربعية نصية: ما وقع في كل ربع منذ العهد
  const quarters: { label: string; text_ar: string }[] = []; const start = new Date(since).getTime(); const qn = Math.min(4, Math.max(1, Math.floor((now - start) / (91 * 864e5)) + 1));
  for (let i = 0; i < qn; i++) { const a = start + i * 91 * 864e5, b = Math.min(now, start + (i + 1) * 91 * 864e5); const inQ = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() >= a && new Date(iso).getTime() < b; const got = steps.filter(s => s.done && inQ(s.at)).map(s => s.label_ar); quarters.push({ label: ['الربع الأول من العهد', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'][i], text_ar: got.length ? got.join(' · ') : 'لم يقع شيء من العهد في هذا الربع — وهذا خبر لا حكم.' }); }
  const done = steps.filter(s => s.done).length;
  const read = complete ? 'ما وعدتَ به وقع — بشهادة الأحداث لا بتصريحك.' : done ? `${done} من ${steps.length} ${steps.length === 1 ? 'خطوة' : 'خطوات'} وقعت حتى اليوم.` : 'لم يقع من العهد شيء بعد — السنة ما زالت مفتوحة.';
  return { kind: p.kind, steps, read_ar: read, quarters, complete };
}

/** نص المراجعة السنوية: العهد كما وُقّع · الدرب كما وقع — بلا حكم */
export function reviewText(name: string, pledge: Pick<Pledge, 'title_ar' | 'signed_at'>, path: Path, chaptersThen: number, chaptersNow: number): string {
  return [`${name ? `${name}، ` : ''}قبل سنة — في ${fmtD(pledge.signed_at || new Date().toISOString())} — عاهدتَ نفسك: «${pledge.title_ar}».`,
    path.read_ar, `يومها كانت رحلتك ${chaptersThen} فصلًا، واليوم ${chaptersNow}.`, 'اقرأ أفقك كما كتبتَه، ثم اكتب ما تغيّر — وقرّر: تجدّد أم تطوي. ما لم يُراجَع ليس فشلًا.'].join(' ');
}

/** ملخص للوكلاء (my_horizon) — قراءة فقط، بلا نص الأفق */
export function horizonSummary(h: Horizon | null, pledge: Pledge | null, path: Path | null, elig: { ok: boolean; chapters: number; min: number }) {
  return { version: HORIZON_VERSION, eligible: elig.ok, chapters: elig.chapters, min_chapters: elig.min, status: h?.status || null, year_target: h?.year_target || null, scenario_chars: h ? h.scenario_ar.length : 0,
    pledge: pledge ? { kind: pledge.kind, kind_ar: PLEDGE_KIND_AR[pledge.kind], title_ar: pledge.title_ar, code: pledge.code, signed_at: pledge.signed_at, expires_at: pledge.expires_at, status: pledge.status } : null,
    path: path ? { read_ar: path.read_ar, complete: path.complete, steps: path.steps.map(s => ({ label_ar: s.label_ar, done: s.done, at: s.at ? s.at.slice(0, 10) : null })) } : null,
    review_at: h?.review_at || null, review_open: h?.status === 'review' };
}
