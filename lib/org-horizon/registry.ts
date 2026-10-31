// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أفق الجهة (P28) — الاسم الرسمي «أفق الجهة · عهد الجهة · مراجعة سنة الجهة» · السردي «عشر سنوات وخطوة»
 * «الجهة لا تكتب خطة؛ تكتب نفسها بعد عشر سنوات من فصولها التي وقعت، ثم تختار خطوة واحدة لسنة يشهدها منسوبوها بأفعالهم — وتوقّعها عهدًا باسمها».
 * الحركات الخمس: نحن في 2036 (بصوت الجهة) → خطوة لهذه السنة (ثلاث يقترحها أَثَر مما تستطيع أن يشهده) → عهد الجهة (ATH-OH · 365 يومًا)
 *   → أين نحن من خطوتنا (أعداد أشخاص متمايزين من الأحداث بعد التوقيع — لا أسماء ولا نسبة) → ما وعدنا / ما وقع (المراجعة السنوية).
 * قواعد ثابتة: لا أفق قبل 5 منسوبين مؤكَّدين وفصلين · عهد واحد نشط لكل جهة · الأفق لا يغادر الجهة (الطاقم لا يراه) · الرقم 5 هو نصاب k نفسه.
 */
import type { OrgChapter, OrgChapterKind } from '../org-journey/registry';
import { K_ORG } from '../org-impact/registry';

export const ORG_HORIZON_VERSION = '2026-10';
export const ORG_HORIZON_MIN_CHAPTERS = 2;      // فصلان في رحلة الجهة (نصاب أو فصول الجهة نفسها)
export const ORG_HORIZON_MIN_MEMBERS = K_ORG;   // 5 منسوبين مؤكَّدين — وإلا لا خطوة تُشهد
export const ORG_HORIZON_YEARS = 10;            // 2026 → 2036
export const ORG_PLEDGE_DAYS = 365;
export const ORG_REVIEW_WINDOW_DAYS = 30;
export const ORG_MIDYEAR_DAY = 182;
export const ORG_MIN_SCENARIO_CHARS = 100; export const ORG_MAX_SCENARIO_CHARS = 1500;
export const ORG_MAX_REVIEW_CHARS = 1500; export const ORG_MAX_PLEDGE_TITLE = 160;
export const ORG_PLEDGE_OPTIONS = 3;
export const ORG_PLEDGE_PEOPLE = K_ORG;         // 5 أشخاص متمايزين لكل خطوة جماعية
export const ORG_DAILY_PER_PERSON = 5;
export const ORG_YEARBOOK_CHAPTERS = 3;
export const ORG_PLEDGE_CODE_PREFIX = 'ATH-OH';
export const ORG_NOTIFY_MEMBERS_MAX = 300;

export type OrgPledgeKind = 'council' | 'missions' | 'daily' | 'levels' | 'attestations' | 'yearbook' | 'inclusion';
export type OrgPledgeTarget = { people?: number; members?: number; returns?: number; per_person?: number; chapters?: number };
export type OrgPledgeOption = { kind: OrgPledgeKind; title_ar: string; why_ar: string; target: OrgPledgeTarget };
export type OrgHorizonStatus = 'draft' | 'active' | 'review' | 'renewed' | 'archived';
export type OrgHorizon = { id: string; created_at: string; updated_at: string; organization_id: string; org_name: string; written_by: string | null; written_email: string | null; year_target: number; scenario_ar: string; scenario_source: 'own' | 'local' | 'ai'; status: OrgHorizonStatus; activated_at: string | null; review_at: string | null; reviewed_at: string | null; review_note_ar: string | null; decision: 'renew' | 'archive' | null; options: OrgPledgeOption[]; meta: any };
export type OrgPledge = { id: string; created_at: string; horizon_id: string; organization_id: string; org_name: string; kind: OrgPledgeKind; title_ar: string; target: OrgPledgeTarget; code: string | null; signed_by: string | null; signed_email: string | null; signed_at: string | null; expires_at: string | null; revoked_at: string | null; status: 'active' | 'revoked' | 'reviewed' | 'expired'; vc_issuance_id: string | null; meta: any };
export type OrgPathStep = { label_ar: string; done: boolean; at: string | null; detail_ar: string | null; have: number; want: number };
export type OrgPath = { kind: OrgPledgeKind; steps: OrgPathStep[]; read_ar: string; quarters: { label: string; text_ar: string }[]; complete: boolean };
/** مدخلات الدرب: أحداث المنسوبين المؤكَّدين بعد التوقيع — person = بريد (لا يُنشر أبدًا) */
export type OrgPathInput = {
  members: string[];
  missions: { person: string; at: string }[];                       // confirmed_at
  daily: { person: string; at: string }[];                          // كل إجابة في «كل يوم مهارة»
  joins: { person: string; at: string; council: string }[];         // عضوية مجلس بدأت
  returns: { person: string; at: string; council: string | null }[];
  levels: { person: string; at: string }[];
  attestations: { person: string; at: string }[];
  yearbooks: { at: string; chapters: number }[];                    // كتب سنة أصدرتها الجهة
  inclusion?: { person: string; at: string }[];                     // P32: منسوب قُبل في برنامج مهيَّأ للجميع (له access_features)
};

export const ORG_HORIZON_COLS = 'id,created_at,updated_at,organization_id,org_name,written_by,written_email,year_target,scenario_ar,scenario_source,status,activated_at,review_at,reviewed_at,review_note_ar,decision,options,meta';
export const ORG_PLEDGE_COLS = 'id,created_at,horizon_id,organization_id,org_name,kind,title_ar,target,code,signed_by,signed_email,signed_at,expires_at,revoked_at,status,vc_issuance_id,meta';
export const ORG_PLEDGE_KIND_AR: Record<OrgPledgeKind, string> = { council: 'مجلس يكتمل ويعود', missions: 'خمس مهمات من قلب العمل', daily: 'خمسة يواجهون المواقف', levels: 'خمسة مستويات يعتمدها بشر', attestations: 'خمس شهادات أقران', yearbook: 'كتاب السنة', inclusion: 'تعهّد الشمول — خمسة في برامج مهيَّأة للجميع' };
export const PRIVACY_ORG_HORIZON_AR = ['أفق الجهة («نحن في 2036») يراه مديرو الجهة وحدهم — لا الطاقم ولا المنسوبون ولا الوثيقة', 'العهد وثيقة باسم الجهة تعرض عنوانه وتاريخه ومن وقّعه بصفته فقط', 'الدرب يُشتق من أحداث المنسوبين بعد التوقيع — أعداد أشخاص متمايزين، لا أسماء ولا نسبة', 'المنسوب يرى عنوان عهد جهته فقط — ولا شيء عن منسوب آخر', 'الذكاء الاصطناعي يقترح مسودة واحدة من فصول الجهة وكلماتها ولا يحكم عليها'];

const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' });
export const addDays = (iso: string | Date, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
export const orgPledgeCode = (rnd: () => string) => `${ORG_PLEDGE_CODE_PREFIX}-${rnd()}-${rnd()}`;
export const orgYearTarget = (now = Date.now()) => new Date(now).getUTCFullYear() + ORG_HORIZON_YEARS;
const nPeople = (n: number) => n === 1 ? 'منسوب واحد' : n === 2 ? 'منسوبان' : n <= 10 ? `${n} منسوبين` : `${n} منسوبًا`;
const nChapters = (n: number) => n === 0 ? 'لا فصل بعد' : n === 1 ? 'فصل واحد' : n === 2 ? 'فصلان' : n <= 10 ? `${n} فصول` : `${n} فصلًا`;

/** أهلية أفق الجهة: 5 منسوبين مؤكَّدين + فصلان في رحلة الجهة */
export function orgEligibility(chapters: OrgChapter[], members: number): { ok: boolean; chapters: number; min: number; members: number; min_members: number; read_ar: string } {
  const n = chapters.length; const okCh = n >= ORG_HORIZON_MIN_CHAPTERS; const okM = members >= ORG_HORIZON_MIN_MEMBERS; const ok = okCh && okM;
  const read = ok ? 'يمكن للجهة أن تكتب أفقها — لديها فصول وقعت فعلًا ومنسوبون يشهدون.'
    : !okM ? `أفق الجهة يُكتب حين يكتمل ${ORG_HORIZON_MIN_MEMBERS} منسوبين مؤكَّدين — لديكم ${nPeople(members)}. أكّدوا المنسوبين من تبويب «المنسوبون».`
    : `أفق الجهة يُكتب بعد ${ORG_HORIZON_MIN_CHAPTERS === 2 ? 'فصلين' : `${ORG_HORIZON_MIN_CHAPTERS} فصول`} في رحلة الجهة — لديكم ${nChapters(n)}. الفصل الجماعي يحتاج خمسة يعيشون الحدث نفسه؛ وفصول الجهة (الميثاق · عقد أثر) بلا نصاب.`;
  return { ok, chapters: n, min: ORG_HORIZON_MIN_CHAPTERS, members, min_members: ORG_HORIZON_MIN_MEMBERS, read_ar: read };
}

/** مسودة محلية (بلا ذكاء اصطناعي): بصيغة «نحن» في المستقبل، من فصول الجهة وكلماتها («ما تغيّر فينا» والميثاق) فقط */
export function localOrgScenario(orgName: string, chapters: OrgChapter[], own: string[], members: number, year = orgYearTarget()): string {
  if (!chapters.length) return '';
  const k = (kind: OrgChapterKind) => chapters.filter(c => c.kind === kind).length; const big = Math.max(0, ...chapters.map(c => c.people || 0));
  const q = own.find(s => s.length >= 20 && s.length <= 160);
  const parts = [`في ${year} ننظر — نحن «${orgName}» — إلى الوراء فنرى أن ما بدأ بـ«${chapters[0].title_ar}» صار طريقة عمل لا حدثًا.`];
  if (k('daily')) parts.push('المواقف التي كتب فيها منسوبونا كيف يتصرّفون صارت مادة اجتماعاتنا: نبدأ بموقف لا بتقرير.');
  if (k('mission')) parts.push('المهام التي أكّدها المشرفون مرة صارت الطريقة التي نقيس بها كل برنامج: لا نسأل «من حضر» بل «ما الذي حدث في العمل».');
  if (k('council') || k('return') || k('twinning')) parts.push('منسوبونا يجلسون إلى مجالس لا تضمّ جهتنا وحدها، ويعودون بما حدث — صارت العودة عادة مؤسسية لا شجاعة فردية.');
  if (k('level') || k('attestation')) parts.push('المستويات التي يعتمدها بشر وشهادات الأقران صارت لغتنا في التوظيف والترقية بدل الساعات.');
  if (k('charter')) parts.push('الميثاق الذي وقّعناه يومًا — وقت داخل الدوام، سرية، لا تقييم وظيفي — لم يعد وثيقة؛ صار ما يميّز العمل عندنا.');
  if (big) parts.push(`كنا ${nPeople(members)} حين كُتب هذا، وأكبر فصل عاشه ${nPeople(big)}؛ اليوم الفصل الواحد يعيشه من لا نحصيهم.`);
  if (q) parts.push(`نعود إلى كلماتنا القديمة: «${q}» — ونبتسم لأنها كانت أول الطريق.`);
  parts.push('لم نصل إلى هنا بخطة كبيرة؛ وصلنا بخطوة واحدة في كل سنة، وفينا ببعضها وراجعنا بعضها.');
  return parts.join(' ').slice(0, ORG_MAX_SCENARIO_CHARS);
}

export function validateOrgScenario(b: { scenario_ar?: unknown; source?: unknown }): string | null {
  const s = String(b.scenario_ar || '').trim();
  if (s.length < ORG_MIN_SCENARIO_CHARS) return `اكتبوا أفق الجهة في ${ORG_MIN_SCENARIO_CHARS} حرف على الأقل — بصوت الجهة`;
  if (s.length > ORG_MAX_SCENARIO_CHARS) return `الأفق أطول من ${ORG_MAX_SCENARIO_CHARS} حرفًا`;
  if (b.source !== undefined && !['own', 'local', 'ai'].includes(String(b.source))) return 'مصدر غير معروف';
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(s)) return 'لا بُرُد في أفق الجهة';
  return null;
}

/** الخطوات الثلاث: ما تستطيع المنصة أن تشهده عن جهة — ما لم تعشه الجهة أولًا، ثم ما يمكنها تعميقه؛ أنواع متمايزة؛ ثلاث بالضبط */
export function proposeOrgPledges(chapters: OrgChapter[], members: number, n = ORG_PLEDGE_OPTIONS, ctx: { inclusive_programs?: number } = {}): OrgPledgeOption[] {
  const has = (kind: OrgChapterKind) => chapters.some(c => c.kind === kind); const P = ORG_PLEDGE_PEOPLE;
  const out: OrgPledgeOption[] = [];
  if (!has('council') && !has('twinning')) out.push({ kind: 'council', title_ar: 'يجلس اثنان من منسوبينا إلى مجلس أقران واحد ويعود أحدهما بما حدث', why_ar: 'لم يجلس منسوبوكم بعد إلى طاولة لا تضم جهتكم وحدها.', target: { members: 2, returns: 1 } });
  else if (!has('return')) out.push({ kind: 'council', title_ar: 'يعود منسوبونا إلى مجالسهم بما حدث فعلًا بعد التزامهم', why_ar: 'جلسوا إلى المجالس ولم يعودوا بعدُ — العودة أثمن لحظة تعلّم.', target: { members: 2, returns: 1 } });
  if (!has('mission')) out.push({ kind: 'missions', title_ar: `يُنجز ${P} من منسوبينا مهمة من قلب العمل يؤكّدها مشرفوهم`, why_ar: 'لم يؤكّد المشرفون بعدُ أثرًا لخمسة من منسوبيكم في الربع نفسه.', target: { people: P } });
  if (!has('daily')) out.push({ kind: 'daily', title_ar: `يواجه ${P} من منسوبينا خمسة مواقف لكلٍّ منهم في «كل يوم مهارة»`, why_ar: 'أول موقف لم يُكتب بعدُ لخمسة منكم في ربع واحد.', target: { people: P, per_person: ORG_DAILY_PER_PERSON } });
  if (!has('level')) out.push({ kind: 'levels', title_ar: `يُعتمد مستوى أعلى — بقرار بشري — لـ${P} من منسوبينا`, why_ar: 'لا مستوى معتمدًا لخمسة منكم بعد.', target: { people: P } });
  if (!has('attestation')) out.push({ kind: 'attestations', title_ar: `يشهد أقرانٌ لـ${P} من منسوبينا على سلوك رُئي فعلًا`, why_ar: 'شهادة القرين تأتي من مجلس لا من طلب — ولم تُكتب لخمسة منكم بعد.', target: { people: P } });
  out.push({ kind: 'yearbook', title_ar: `نُصدر كتاب سنتنا الموقَّع بثلاثة فصول فأكثر`, why_ar: 'الكتاب يجعل ما تعلّمناه مقروءًا — بأعداد لا أسماء.', target: { chapters: ORG_YEARBOOK_CHAPTERS } });
  if (has('mission')) out.push({ kind: 'missions', title_ar: `خمس مهمات جديدة يؤكّدها المشرفون لخمسة منسوبين`, why_ar: 'فصل مهام ثانٍ — الأثر الذي يتكرّر يصير ثقافة.', target: { people: P } });
  if (has('daily')) out.push({ kind: 'daily', title_ar: `خمسة من منسوبينا يستمرّون: خمسة مواقف لكلٍّ منهم هذه السنة`, why_ar: 'الاستمرار نفسه مهارة.', target: { people: P, per_person: ORG_DAILY_PER_PERSON } });
  if (has('council') && has('return')) out.push({ kind: 'council', title_ar: 'دورة مجلس كاملة أخرى يعود منها منسوبونا بما حدث', why_ar: 'قضية → التزام → عودة، مرة أخرى.', target: { members: 2, returns: 1 } });
  if (has('level')) out.push({ kind: 'levels', title_ar: `خمسة مستويات جديدة يعتمدها بشر لمنسوبينا`, why_ar: 'مستوى اعتمده إنسان يمكن أن يرتفع بأدلة جديدة.', target: { people: P } });
  if (has('attestation')) out.push({ kind: 'attestations', title_ar: `خمس شهادات أقران جديدة لمنسوبينا`, why_ar: 'شهادة ثانية من مجلس.', target: { people: P } });
  if ((ctx.inclusive_programs || 0) > 0) out.splice(Math.min(2, out.length), 0, { kind: 'inclusion', title_ar: `يلتحق ${P} من منسوبينا ببرامج مهيَّأة للجميع — ومنهم من كان يُترك خارج القاعة`, why_ar: 'تعهّد الشمول: الأثر الذي يصل إلى من لم تُبنَ له القاعات. يُعدّ المنسوب حين يُقبل في برنامج يعلن ما يوفّره فعلًا (ترجمة حيّة، لغة إشارة، مواد مقروءة…).', target: { people: P } });
  const seen = new Set<OrgPledgeKind>(); const distinct = out.filter(o => (seen.has(o.kind) ? false : (seen.add(o.kind), true)));
  if (members < ORG_PLEDGE_PEOPLE) return distinct.filter(o => o.kind === 'council' || o.kind === 'yearbook').slice(0, n);
  return distinct.slice(0, n);
}

export function validateOrgPledgeChoice(b: { index?: unknown; title_ar?: unknown }, options: OrgPledgeOption[]): string | null {
  const i = Number(b.index); if (!Number.isInteger(i) || i < 0 || i >= options.length) return 'اختاروا واحدة من الخطوات الثلاث';
  if (b.title_ar !== undefined && b.title_ar !== null) { const t = String(b.title_ar).trim(); if (t.length < 10) return 'صياغة العهد قصيرة جدًا'; if (t.length > ORG_MAX_PLEDGE_TITLE) return `صياغة العهد أطول من ${ORG_MAX_PLEDGE_TITLE} حرفًا`; if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(t)) return 'لا بُرُد في نص العهد'; }
  return null;
}
export function validateOrgReview(b: { note_ar?: unknown; decision?: unknown }): string | null {
  const t = String(b.note_ar || '').trim(); if (t.length < 20) return 'اكتبوا ما تغيّر فينا في 20 حرفًا على الأقل';
  if (t.length > ORG_MAX_REVIEW_CHARS) return `المراجعة أطول من ${ORG_MAX_REVIEW_CHARS} حرفًا`;
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(t)) return 'لا بُرُد في مراجعة الجهة';
  if (b.decision !== 'renew' && b.decision !== 'archive') return 'القرار: renew (نجدّد) أو archive (نطوي)';
  return null;
}

/** درب الجهة: يُشتق من أحداث المنسوبين المؤكَّدين بعد التوقيع وقبل الآن — أعداد أشخاص متمايزين */
export function buildOrgPath(p: Pick<OrgPledge, 'kind' | 'target' | 'signed_at'>, inp: OrgPathInput, now = Date.now()): OrgPath {
  const since = p.signed_at || new Date(0).toISOString(); const members = new Set(inp.members.map(m => m.toLowerCase()));
  const after = (iso: string | null | undefined) => !!iso && iso >= since && new Date(iso).getTime() <= now;
  const ours = <T extends { person: string; at: string }>(evs: T[]) => evs.filter(e => after(e.at) && (!members.size || members.has(String(e.person).toLowerCase()))).sort((a, b) => a.at.localeCompare(b.at));
  const distinct = <T extends { person: string; at: string }>(evs: T[]) => { const seen = new Map<string, string>(); for (const e of evs) { const k = String(e.person).toLowerCase(); if (!seen.has(k)) seen.set(k, e.at); } return seen; };
  const steps: OrgPathStep[] = []; let complete = false; const P = p.target.people || ORG_PLEDGE_PEOPLE;
  const countStep = (label: string, evs: { person: string; at: string }[], want: number, unit: string) => { const d = distinct(ours(evs)); const have = d.size; const ats = Array.from(d.values()).sort(); const at = have >= want ? ats[want - 1] : ats[ats.length - 1] || null; steps.push({ label_ar: label, done: have >= want, at, detail_ar: have ? `${nPeople(have)} من ${want}${unit}` : null, have, want }); return have >= want; };
  if (p.kind === 'missions') complete = countStep('مهام أكّدها المشرفون لمنسوبين متمايزين', inp.missions, P, ' — بشهادة مشرفيهم');
  else if (p.kind === 'levels') complete = countStep('مستويات اعتمدها بشر لمنسوبين متمايزين', inp.levels, P, '');
  else if (p.kind === 'attestations') complete = countStep('شهادات أقران معتمدة لمنسوبين متمايزين', inp.attestations, P, '');
  else if (p.kind === 'inclusion') complete = countStep('منسوبون قُبلوا في برامج مهيَّأة للجميع', inp.inclusion || [], P, ' — برامج تعلن ما توفّره فعلًا');
  else if (p.kind === 'daily') {
    const per = p.target.per_person || ORG_DAILY_PER_PERSON; const byP = new Map<string, string[]>(); for (const e of ours(inp.daily)) { const k = String(e.person).toLowerCase(); byP.set(k, [...(byP.get(k) || []), e.at]); }
    const reached = Array.from(byP.values()).filter(l => l.length >= per).map(l => l[per - 1]).sort(); const started = byP.size;
    steps.push({ label_ar: `منسوبون بلغ كلٌّ منهم ${per} مواقف`, done: reached.length >= P, at: reached.length >= P ? reached[P - 1] : reached[reached.length - 1] || null, detail_ar: started ? `${nPeople(reached.length)} بلغوا ${per} · ${nPeople(started)} بدؤوا` : null, have: reached.length, want: P });
    complete = reached.length >= P;
  } else if (p.kind === 'council') {
    const wantM = p.target.members || 2; const wantR = p.target.returns || 1; const joins = ours(inp.joins); const byC = new Map<string, Set<string>>(); for (const j of joins) { const s = byC.get(j.council) || new Set<string>(); s.add(j.person.toLowerCase()); byC.set(j.council, s); }
    const councils = Array.from(byC.entries()).filter(([, s]) => s.size >= wantM).map(([c]) => c); const sharedAt = councils.length ? joins.filter(j => councils.includes(j.council)).map(j => j.at).sort()[wantM - 1] || null : null;
    steps.push({ label_ar: `${wantM === 2 ? 'اثنان' : wantM} من منسوبينا في مجلس واحد`, done: councils.length > 0, at: sharedAt, detail_ar: joins.length ? `${nPeople(distinct(joins).size)} انضموا إلى ${byC.size === 1 ? 'مجلس واحد' : `${byC.size} مجالس`}` : null, have: Math.max(0, ...Array.from(byC.values()).map(s => s.size)), want: wantM });
    const rets = ours(inp.returns).filter(r => !councils.length || !r.council || councils.includes(r.council)); const dr = distinct(rets);
    steps.push({ label_ar: 'العودة بما حدث', done: councils.length > 0 && dr.size >= wantR, at: dr.size >= wantR ? Array.from(dr.values()).sort()[wantR - 1] : null, detail_ar: dr.size ? `${nPeople(dr.size)} عادوا` : null, have: dr.size, want: wantR });
    complete = councils.length > 0 && dr.size >= wantR;
  } else {
    const want = p.target.chapters || ORG_YEARBOOK_CHAPTERS; const yb = inp.yearbooks.filter(y => after(y.at) && y.chapters >= want).sort((a, b) => a.at.localeCompare(b.at))[0] || null; const any = inp.yearbooks.filter(y => after(y.at)).length;
    steps.push({ label_ar: `كتاب سنة موقَّع بـ${want} فصول فأكثر`, done: !!yb, at: yb?.at || null, detail_ar: yb ? `صدر بـ${yb.chapters} فصول` : any ? 'صدر كتاب بأقل من المطلوب' : null, have: yb ? 1 : 0, want: 1 });
    complete = !!yb;
  }
  const quarters: { label: string; text_ar: string }[] = []; const start = new Date(since).getTime(); const qn = Math.min(4, Math.max(1, Math.floor((now - start) / (91 * 864e5)) + 1));
  for (let i = 0; i < qn; i++) { const a = start + i * 91 * 864e5, b = Math.min(now, start + (i + 1) * 91 * 864e5); const inQ = (iso: string | null) => !!iso && new Date(iso).getTime() >= a && new Date(iso).getTime() < b; const got = steps.filter(s => s.done && inQ(s.at)).map(s => s.label_ar); quarters.push({ label: `${['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'][i]} من العهد`, text_ar: got.length ? `وقع: ${got.join('، ')}.` : i === qn - 1 ? 'لم يكتمل شيء في هذا الربع بعد — وهذا خبر لا حكم.' : 'لم يكتمل شيء في هذا الربع.' }); }
  const done = steps.filter(s => s.done).length; const main = steps[steps.length - 1];
  const read = complete ? 'ما وعدت به الجهة وقع — بشهادة أحداث منسوبيها لا بتقرير مديريها.' : done ? `${done} من ${steps.length} ${steps.length === 1 ? 'خطوة' : 'خطوات'} وقعت حتى اليوم.` : main && main.have ? `${main.detail_ar} — السنة ما زالت مفتوحة.` : 'لم يقع من عهد الجهة شيء بعد — السنة ما زالت مفتوحة.';
  return { kind: p.kind, steps, read_ar: read, quarters, complete };
}

/** نص مراجعة سنة الجهة: العهد كما وُقّع · الدرب كما وقع — بلا حكم */
export function orgReviewText(orgName: string, pledge: Pick<OrgPledge, 'title_ar' | 'signed_at'>, path: OrgPath, chaptersThen: number, chaptersNow: number, membersThen: number, membersNow: number): string {
  return [`إلى مديري «${orgName}» اليوم: قبل سنة — في ${fmtD(pledge.signed_at || new Date().toISOString())} — عاهدت جهتكم نفسها: «${pledge.title_ar}».`,
    path.read_ar, `يومها كانت رحلة الجهة ${nChapters(chaptersThen)} و${nPeople(membersThen)}، واليوم ${nChapters(chaptersNow)} و${nPeople(membersNow)}.`,
    'اقرؤوا أفق الجهة كما كُتب، ثم اكتبوا ما تغيّر فينا — وقرّروا: نجدّد أم نطوي. ما لم يُراجَع ليس فشلًا.'].join(' ');
}

/** ما يراه المنسوب عن عهد جهته: العنوان والنوع وتاريخ المراجعة — لا الأفق ولا الدرب */
export function memberPledgeView(p: OrgPledge, orgName: string) {
  return { org_name: orgName, kind: p.kind, kind_ar: ORG_PLEDGE_KIND_AR[p.kind], title_ar: p.title_ar, signed_at: p.signed_at, review_at: p.expires_at, code: p.code };
}

/** فصل «عهد الجهة» في رحلة الجهة (فصل على مستوى الجهة — بلا نصاب كالميثاق) */
export type OrgPledgeChapterInput = { signed_at: string; title_ar: string; kind: OrgPledgeKind; status: string; reviewed_at: string | null; decision: 'renew' | 'archive' | null; complete: boolean | null; note_ar: string | null };
export function orgPledgeChapters(pledges: OrgPledgeChapterInput[], quarterOf: (iso: string) => string): OrgChapter[] {
  const out: OrgChapter[] = [];
  for (const p of pledges) {
    if (p.status === 'revoked') continue;
    out.push({ key: `${quarterOf(p.signed_at)}:org_pledge:${p.signed_at.slice(0, 10)}`, kind: 'org_pledge', quarter: quarterOf(p.signed_at), at: p.signed_at, people: null, title_ar: 'عاهدت الجهة نفسها على خطوة لسنة', what_ar: `وقّعت الجهة عهدها في ${fmtD(p.signed_at)}: «${p.title_ar}» (${ORG_PLEDGE_KIND_AR[p.kind]}) — والدرب يُكتب من أفعال منسوبيها.`, theme_ar: null });
    if (p.reviewed_at) out.push({ key: `${quarterOf(p.reviewed_at)}:org_pledge_reviewed:${p.reviewed_at.slice(0, 10)}`, kind: 'org_pledge', quarter: quarterOf(p.reviewed_at), at: p.reviewed_at, people: null, title_ar: p.decision === 'renew' ? 'راجعت الجهة عهدها وجدّدت أفقها' : 'راجعت الجهة عهدها وطوت أفقها', what_ar: `بعد سنة من «${p.title_ar}»: ${p.complete ? 'ما وعدنا به وقع — بشهادة الأحداث.' : 'وقع بعضه ولم يقع بعضه — وكتبنا ما تغيّر فينا.'}`, theme_ar: null, note_ar: p.note_ar || null });
  }
  return out;
}
