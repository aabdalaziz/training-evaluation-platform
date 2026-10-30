// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * رحلة الجهة (P26) — الجزء النقي: «الجهة تنشر ما تعلّمته، لا ما أنجزته — فصولًا لا أرقامًا، وبلا اسم واحد»
 *  - الفصول الجماعية تُشتق من أحداث منسوبي الجهة، بحقب ربع سنوية، ولا يظهر فصل عاشه أقل من K_ORG (= 5) أشخاص
 *  - فصول «الأولى» على مستوى الجهة (ميثاق · توأمة · عقد أثر اكتمل) لا تحمل بيانات أفراد فلا تحتاج نصابًا
 *  - المرآة بالسنة السابقة للجهة نفسها فقط · ما دون النصاب يُقال صراحة («3 من 5»)
 *  - كتاب السنة: كشف انتقائي موقَّع ATH-OY · رسالة الجهة إلى نفسها بعد سنة
 */
import { K_ORG } from '../org-impact/registry';
import { themeLabel } from '../councils/registry';

export const ORG_JOURNEY_VERSION = '2026-10';
export const ORG_SHARE_MONTHS = 12;
export const ORG_CAPSULE_DAYS = 365;
export const ORG_NOTE_MAX_CHARS = 1500; export const ORG_INTRO_MAX_CHARS = 900;
export const ORG_CAPSULE_MIN_CHARS = 40; export const ORG_CAPSULE_MAX_CHARS = 3000;
export const ORG_SHARE_CODE_PREFIX = 'ATH-OY';
export const MAX_ORG_SHARE_CHAPTERS = 40;
export { K_ORG };

export type OrgChapterKind = 'daily' | 'mission' | 'council' | 'return' | 'attestation' | 'level' | 'credential' | 'pledge' | 'charter' | 'twinning' | 'contract';
export type OrgEvent = { person: string; at: string; theme?: string | null };     // person = بريد أو معرّف (لا يُنشر أبدًا)
export type OrgJourneyInput = {
  members: string[];                                        // بُرُد المنسوبين المؤكَّدين (صغيرة الحروف)
  daily_first: OrgEvent[];                                  // أول موقف لكل منسوب (شخص واحد = حدث واحد)
  missions: OrgEvent[];                                     // مهام أكّدها المشرف
  joins: OrgEvent[];                                        // انضمام إلى مجلس (توقيع الميثاق)
  returns: OrgEvent[];                                      // عودات بما حدث (theme)
  attestations: OrgEvent[];                                 // شهادات أقران معتمدة (المشهود له)
  levels: OrgEvent[];                                       // مستويات اعتمدها بشر
  credentials: OrgEvent[];                                  // اعتمادات صادرة
  pledges?: OrgEvent[];                                     // عهود أفق وقّعها منسوبون (P27) — عدد فقط، لا موضوعات
  charters: { signed_at: string; renewed: boolean }[];      // مستوى الجهة
  twinnings: { at: string; orgs: number }[];                // مجالس ضمّت منسوبينا مع ≥ 1 جهة أخرى (تاريخ أول عضوية لنا)
  contracts: { delivered_at: string; returned: boolean }[]; // عقود أثر سُلِّمت (وهل أُفرجت دفعة العودة)
};
export type OrgChapter = {
  key: string; kind: OrgChapterKind; quarter: string; at: string;   // at = آخر حدث في الفصل
  people: number | null;                                   // null لفصول مستوى الجهة
  title_ar: string; what_ar: string; theme_ar: string | null;
  note_ar?: string | null;                                 // «ما تغيّر فينا» (يُضاف عند النشر)
};
export type OrgBelow = { quarter: string; kind: OrgChapterKind; label_ar: string; people: number; k: number };
export type OrgMirrorRow = { kind: OrgChapterKind; label_ar: string; now: number | null; prev: number | null; read_ar: string };
export type OrgJourney = { version: string; k: number; members: number; chapters: OrgChapter[]; eras: { label: string; keys: string[] }[]; below: OrgBelow[]; mirror: OrgMirrorRow[]; arc_ar: string; year_label: string; first_at: string | null; privacy_ar: string[] };

export const ORG_KIND_AR: Record<OrgChapterKind, string> = { daily: 'أول موقف', mission: 'مهام أكّدها المشرفون', council: 'انضمام إلى المجالس', return: 'عودات بما حدث', attestation: 'شهادات أقران معتمدة', level: 'مستويات اعتمدها بشر', credential: 'اعتمادات', pledge: 'عهود مع النفس', charter: 'ميثاق الجهة', twinning: 'توأمة', contract: 'عقد أثر' };
export const PRIVACY_ORG_JOURNEY_AR = ['لا فصل من أقل من 5 أشخاص — دائمًا', 'أعداد وحقب فقط؛ لا أسماء ولا نصوص أفراد', 'الجهة تُقارَن بسنتها السابقة لا بجهة أخرى', 'ما يُنشر موقَّع وقابل للإلغاء بنقرة', 'الذكاء الاصطناعي يقترح المقدمة من كلمات الجهة وحدها ولا يحفظها'];

export const quarterOf = (iso: string) => { const d = new Date(iso); return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };
export const quarterLabel = (q: string) => { const [y, qq] = q.split('-Q'); return `${['', 'الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'][Number(qq)]} ${y}`; };
const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' });
const nPeople = (n: number) => n === 1 ? 'شخص واحد' : n === 2 ? 'شخصان' : n <= 10 ? `${n} أشخاص` : `${n} شخصًا`;
const topTheme = (evs: OrgEvent[]) => { const m = new Map<string, number>(); for (const e of evs) if (e.theme) m.set(e.theme, (m.get(e.theme) || 0) + 1); let best: string | null = null, bn = 0; m.forEach((n, t) => { if (n > bn) { bn = n; best = t; } }); return best ? themeLabel(best) : null; };

const WHAT: Record<Exclude<OrgChapterKind, 'charter' | 'twinning' | 'contract'>, (n: number, theme: string | null) => [string, string]> = {
  daily: n => [`${nPeople(n)} واجهوا أول موقف لهم`, `في «كل يوم مهارة» كتب ${nPeople(n)} من منسوبيكم — لأول مرة — كيف يتصرّفون في موقف حقيقي، بكلماتهم لا بخيارات جاهزة.`],
  mission: n => [`${nPeople(n)} نقلوا التعلّم إلى قلب العمل`, `مهام أكّد المشرفون أنها حدثت فعلًا لـ${nPeople(n)} — الأثر هنا شهادة مشرف لا تقرير متدرب.`],
  council: n => [`${nPeople(n)} جلسوا مع أقران من جهات أخرى`, `وقّع ${nPeople(n)} ميثاق مجلس أقران وجلسوا إلى طاولة لا تضم جهتهم وحدها.`],
  return: (n, t) => [`${nPeople(n)} عادوا إلى مجالسهم بما حدث`, `بعد التزام علني في مجلس، عاد ${nPeople(n)} ليقولوا ما حدث فعلًا — نجح أو تعثّر أو تغيّر الفهم${t ? ` — الموضوع الغالب: ${t}` : ''}.`],
  attestation: n => [`أقرانٌ شهدوا لـ${nPeople(n)}`, `شهادات أقران على سلوك رُئي فعلًا، اعتمدها إنسان، لـ${nPeople(n)} من منسوبيكم.`],
  level: n => [`مستويات اعتمدها بشر لـ${nPeople(n)}`, `اعتُمد مستوى مهارة — بقرار بشري لا بحساب — لـ${nPeople(n)}.`],
  credential: n => [`اعتمادات موقَّعة لـ${nPeople(n)}`, `صدرت اعتمادات رقمية موقَّعة وقابلة للتحقق لـ${nPeople(n)}.`],
  pledge: n => [`${nPeople(n)} عاهدوا أنفسهم على خطوة لسنة`, `كتب ${nPeople(n)} من منسوبيكم أفقهم لعشر سنوات ووقّعوا عهدًا واحدًا لسنة واحدة — ما عاهدوا عليه يخصّهم؛ الجهة ترى العدد فقط.`],
};

/** الفصول الجماعية: لكل ربع ولكل نوع، عدد الأشخاص المتميزين؛ يظهر الفصل إن بلغ k */
export function buildOrgChapters(inp: OrgJourneyInput, k = K_ORG): { chapters: OrgChapter[]; below: OrgBelow[] } {
  const chapters: OrgChapter[] = []; const below: OrgBelow[] = [];
  const members = new Set(inp.members.map(m => String(m).toLowerCase()));
  const groups: [OrgChapterKind, OrgEvent[]][] = [['daily', inp.daily_first], ['mission', inp.missions], ['council', inp.joins], ['return', inp.returns], ['attestation', inp.attestations], ['level', inp.levels], ['credential', inp.credentials], ['pledge', inp.pledges || []]];
  for (const [kind, evs] of groups) {
    const byQ = new Map<string, OrgEvent[]>();
    for (const e of evs) { if (!e.at) continue; if (members.size && e.person && members.has(String(e.person).toLowerCase()) === false && !/^[0-9a-f-]{36}$/i.test(e.person)) continue; const q = quarterOf(e.at); byQ.set(q, [...(byQ.get(q) || []), e]); }
    byQ.forEach((list, q) => {
      const people = new Set(list.map(e => String(e.person).toLowerCase())).size; const last = list.map(e => e.at).sort().slice(-1)[0];
      if (people >= k) { const theme = topTheme(list); const [title, what] = WHAT[kind as keyof typeof WHAT](people, theme); chapters.push({ key: `${q}:${kind}`, kind, quarter: q, at: last, people, title_ar: title, what_ar: what, theme_ar: theme }); }
      else if (people > 0) below.push({ quarter: q, kind, label_ar: ORG_KIND_AR[kind], people, k });
    });
  }
  for (const c of inp.charters) chapters.push({ key: `${quarterOf(c.signed_at)}:charter:${c.signed_at.slice(0, 10)}`, kind: 'charter', quarter: quarterOf(c.signed_at), at: c.signed_at, people: null, title_ar: c.renewed ? 'جدّدنا ميثاق الجهة' : 'وقّعنا ميثاق الجهة', what_ar: `${c.renewed ? 'جدّدت' : 'وقّعت'} الجهة ميثاقها في ${fmtD(c.signed_at)}: وقت داخل الدوام · سرية · لا تقييم وظيفي · لا أسماء.`, theme_ar: null });
  const tw = [...inp.twinnings].sort((a, b) => a.at.localeCompare(b.at))[0];
  if (tw) chapters.push({ key: `${quarterOf(tw.at)}:twinning`, kind: 'twinning', quarter: quarterOf(tw.at), at: tw.at, people: null, title_ar: 'أول مجلس توأمة', what_ar: `جلس منسوبونا لأول مرة في مجلس يضم ${tw.orgs >= 3 ? `${tw.orgs} جهات` : 'جهتين'} — لا مجلس من جهة واحدة.`, theme_ar: null });
  for (const ct of inp.contracts) chapters.push({ key: `${quarterOf(ct.delivered_at)}:contract:${ct.delivered_at.slice(0, 10)}`, kind: 'contract', quarter: quarterOf(ct.delivered_at), at: ct.delivered_at, people: null, title_ar: ct.returned ? 'عقد أثر اكتمل بدفعة العودة' : 'عقد أثر سُلِّم', what_ar: ct.returned ? 'اكتمل عقد أثر حتى دفعته الأخيرة — دُفعت للعودة لا للمقعد.' : 'سُلِّم برنامج ضمن عقد أثر وبدأت نافذة الأثر.', theme_ar: null });
  chapters.sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
  below.sort((a, b) => b.quarter.localeCompare(a.quarter) || b.people - a.people);
  return { chapters, below };
}

/** المرآة: هذه السنة مقابل السنة السابقة للجهة نفسها — أشخاص متميزون لكل نوع؛ يُعرض الرقم فقط إن بلغ k */
export function buildOrgMirror(inp: OrgJourneyInput, now = Date.now(), k = K_ORG): OrgMirrorRow[] {
  const y = new Date(now).getUTCFullYear(); const inYear = (iso: string, yy: number) => new Date(iso).getUTCFullYear() === yy;
  const members = new Set(inp.members.map(m => String(m).toLowerCase())); const isMember = (e: OrgEvent) => !members.size || !e.person || members.has(String(e.person).toLowerCase()) || /^[0-9a-f-]{36}$/i.test(e.person);
  const groups: [OrgChapterKind, OrgEvent[]][] = [['daily', inp.daily_first], ['mission', inp.missions], ['return', inp.returns], ['attestation', inp.attestations], ['level', inp.levels]];
  return groups.map(([kind, evs]) => {
    const cnt = (yy: number) => new Set(evs.filter(e => e.at && inYear(e.at, yy) && isMember(e)).map(e => String(e.person).toLowerCase())).size;
    const a = cnt(y), b = cnt(y - 1); const nowV = a >= k ? a : null; const prevV = b >= k ? b : null;
    const read = nowV === null ? (a ? `${a} من ${k} — لم يكتمل النصاب هذه السنة` : 'لا شيء بعد هذه السنة') : prevV === null ? `${nowV} هذه السنة — السنة الماضية دون النصاب، فلا مقارنة` : nowV > prevV ? `${nowV} مقابل ${prevV} السنة الماضية — أكثر` : nowV < prevV ? `${nowV} مقابل ${prevV} السنة الماضية — أقل` : `${nowV} — كما السنة الماضية`;
    return { kind, label_ar: ORG_KIND_AR[kind], now: nowV, prev: prevV, read_ar: read };
  });
}

export function orgArc(chapters: OrgChapter[], members: number): string {
  if (!chapters.length) return members ? `${members} منسوبًا مؤكَّدًا — ولم يكتمل أي فصل جماعي بعد؛ الفصل الأول يحتاج خمسة أشخاص يعيشون الحدث نفسه.` : 'لا منسوبين مؤكَّدين بعد — رحلة الجهة تبدأ من منسوبيها.';
  const q = Array.from(new Set(chapters.map(c => c.quarter))); const people = Math.max(...chapters.map(c => c.people || 0));
  const kinds = new Set(chapters.map(c => c.kind)); const parts = [`${chapters.length} ${chapters.length === 1 ? 'فصل' : chapters.length <= 10 ? 'فصول' : 'فصلًا'} عبر ${q.length === 1 ? 'ربع واحد' : q.length === 2 ? 'ربعين' : `${q.length} أرباع`}`];
  if (people) parts.push(`أكبر فصل عاشه ${nPeople(people)}`); if (kinds.has('return')) parts.push('منسوبوكم يعودون بما حدث'); if (kinds.has('level')) parts.push('مستويات اعتمدها بشر'); if (kinds.has('charter')) parts.push('جهة موقِّعة على الميثاق'); if (kinds.has('contract')) parts.push('عقد أثر اكتمل');
  return parts.join(' · ') + '.';
}

export function buildOrgJourney(inp: OrgJourneyInput, now = Date.now(), k = K_ORG): OrgJourney {
  const { chapters, below } = buildOrgChapters(inp, k); const eras: { label: string; keys: string[] }[] = [];
  for (const c of chapters) { const label = quarterLabel(c.quarter); const e = eras[eras.length - 1]; if (e && e.label === label) e.keys.push(c.key); else eras.push({ label, keys: [c.key] }); }
  return { version: ORG_JOURNEY_VERSION, k, members: inp.members.length, chapters, eras, below: below.slice(0, 6), mirror: buildOrgMirror(inp, now, k), arc_ar: orgArc(chapters, inp.members.length), year_label: String(new Date(now).getUTCFullYear()), first_at: chapters[0]?.at || null, privacy_ar: PRIVACY_ORG_JOURNEY_AR };
}

// ---------- كتاب السنة (النشر) ----------
export type OrgPublicChapter = { key: string; kind: OrgChapterKind; quarter: string; quarter_ar: string; at: string; people: number | null; title_ar: string; what_ar: string; theme_ar: string | null; note_ar: string | null };
export function selectOrgPublic(chapters: OrgChapter[], keys: string[], notes: Record<string, string>): OrgPublicChapter[] {
  const want = new Set(keys); return chapters.filter(c => want.has(c.key)).map(c => ({ key: c.key, kind: c.kind, quarter: c.quarter, quarter_ar: quarterLabel(c.quarter), at: c.at, people: c.people, title_ar: c.title_ar, what_ar: c.what_ar, theme_ar: c.theme_ar, note_ar: notes[c.key] || null }));
}
export function validateOrgShare(b: { chapter_keys?: unknown; intro_ar?: unknown; year_label?: unknown }, chapters: OrgChapter[]): string | null {
  const keys = Array.isArray(b.chapter_keys) ? b.chapter_keys.map(String) : []; if (!keys.length) return 'اختر فصلًا واحدًا على الأقل لكتاب السنة';
  if (keys.length > MAX_ORG_SHARE_CHAPTERS) return `أقصى ${MAX_ORG_SHARE_CHAPTERS} فصلًا في كتاب واحد`;
  const have = new Set(chapters.map(c => c.key)); if (keys.some(k => !have.has(k))) return 'فصل غير موجود في رحلة الجهة';
  if (b.intro_ar !== undefined && b.intro_ar !== null && String(b.intro_ar).length > ORG_INTRO_MAX_CHARS) return `المقدمة أطول من ${ORG_INTRO_MAX_CHARS} حرفًا`;
  if (b.year_label !== undefined && !/^\d{4}(\/\d{4})?$/.test(String(b.year_label))) return 'عنوان السنة مثل 2026 أو 2026/2027';
  return null;
}
export const orgShareCode = (rnd: () => string) => `${ORG_SHARE_CODE_PREFIX}-${rnd()}-${rnd()}`;
export const addDays = (iso: string | Date, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
export const addMonths = (iso: string | Date, m: number) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString(); };
export function validateOrgNote(b: { chapter_key?: unknown; body_ar?: unknown; media_id?: unknown }, chapters: OrgChapter[]): string | null {
  const key = String(b.chapter_key || ''); if (!chapters.some(c => c.key === key)) return 'الفصل غير موجود في رحلة الجهة';
  const body = String(b.body_ar || '').trim(); const media = b.media_id ? String(b.media_id) : '';
  if (!body && !media) return 'اكتبوا أو سجّلوا شيئًا'; if (body.length > ORG_NOTE_MAX_CHARS) return `التعليق أطول من ${ORG_NOTE_MAX_CHARS} حرفًا`;
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(body)) return 'لا بُرُد في تعليق الجهة — الكتاب بلا أسماء';
  return null;
}
// ---------- رسالة الجهة إلى نفسها ----------
export type OrgSnapshot = { members: number; chapters: number; quarters: number; kinds: Partial<Record<OrgChapterKind, number>>; last_chapter: string | null };
export function orgSnapshot(j: OrgJourney): OrgSnapshot {
  const kinds: Partial<Record<OrgChapterKind, number>> = {}; for (const c of j.chapters) kinds[c.kind] = (kinds[c.kind] || 0) + 1;
  return { members: j.members, chapters: j.chapters.length, quarters: new Set(j.chapters.map(c => c.quarter)).size, kinds, last_chapter: j.chapters[j.chapters.length - 1]?.title_ar || null };
}
export function validateOrgCapsule(b: { body_ar?: unknown; media_id?: unknown }): string | null {
  const body = String(b.body_ar || '').trim(); const media = b.media_id ? String(b.media_id) : '';
  if (!media && body.length < ORG_CAPSULE_MIN_CHARS) return `اكتبوا لأنفسكم ${ORG_CAPSULE_MIN_CHARS} حرفًا على الأقل — أو سجّلوا`;
  if (body.length > ORG_CAPSULE_MAX_CHARS) return `الرسالة أطول من ${ORG_CAPSULE_MAX_CHARS} حرفًا`;
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(body)) return 'لا بُرُد في رسالة الجهة';
  return null;
}
const nMembers = (n: number) => n === 1 ? 'منسوب واحد' : n === 2 ? 'منسوبان' : n <= 10 ? `${n} منسوبين` : `${n} منسوبًا`;
const nChapters = (n: number) => n === 0 ? 'لا فصل' : n === 1 ? 'فصل واحد' : n === 2 ? 'فصلان' : n <= 10 ? `${n} فصول` : `${n} فصلًا`;
export function orgCapsuleText(orgName: string, then: OrgSnapshot, now: OrgSnapshot, writtenAt: string): string {
  const grew = now.chapters - then.chapters; const kinds = Object.keys(now.kinds).filter(k => !(k in then.kinds)).map(k => ORG_KIND_AR[k as OrgChapterKind]);
  return [`إلى مديري «${orgName}» اليوم: هذه رسالة كتبتها جهتكم لنفسها في ${fmtD(writtenAt)}.`,
    `يومها كان لديكم ${nMembers(then.members)} مؤكَّدًا و${nChapters(then.chapters)} جماعيًا${then.last_chapter ? ` — آخرها «${then.last_chapter}»` : ''}.`,
    `واليوم ${nMembers(now.members)} و${nChapters(now.chapters)}${grew > 0 ? ` (${grew === 1 ? 'فصل جديد' : grew === 2 ? 'فصلان جديدان' : grew <= 10 ? `${grew} فصول جديدة` : `${grew} فصلًا جديدًا`})` : ''}${kinds.length ? `، ودخلت أنواع لم تكن: ${kinds.join('، ')}` : ''}${now.last_chapter && now.last_chapter !== then.last_chapter ? ` — آخرها «${now.last_chapter}»` : ''}.`,
    'الأرقام هنا أعداد أشخاص لا أسماء، ولا فصل من أقل من خمسة. اقرؤوا الرسالة ثم اسألوا: هل صرنا ما وعدنا؟'].join(' ');
}
export function orgJourneySummary(j: OrgJourney, shares: { code: string; status: string; expires_at: string; year_label: string }[]) {
  return { version: j.version, k: j.k, members: j.members, chapters: j.chapters.length, quarters: j.eras.length, arc_ar: j.arc_ar, latest: j.chapters.slice(-3).reverse().map(c => ({ key: c.key, quarter_ar: quarterLabel(c.quarter), title_ar: c.title_ar, people: c.people })), yearbooks: shares.filter(s => s.status === 'active').map(s => ({ code: s.code, year_label: s.year_label, expires_at: s.expires_at })) };
}
