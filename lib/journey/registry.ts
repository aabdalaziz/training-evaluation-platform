// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * رحلة الممارس (P25) — الاسم الرسمي «سجل الرحلة المهنية» · السردي «رحلتي»
 * سيرة قدرة تُقرأ كقصة لا كجدول: فصول تُبنى من أحداث حقيقية موجودة (أول موقف يومي · أول محاكاة · أول مهمة مؤكَّدة · أول قضية في مجلس ·
 * أول عودة · أول شهادة أقران · كل اعتماد بشري لمستوى · كل شهادة). الاقتباس في كل فصل من كلمات المستخدم نفسه فقط — لا كلمات غيره.
 * قواعد ثابتة: الفصل لا يُخترع؛ لا اقتباس من قرين أو مشرف؛ المشاركة كشف انتقائي يختاره صاحب الرحلة؛ الذكاء الاصطناعي اختياري ومعلَّم.
 */
import { themeLabel } from '../councils/registry';

export const JOURNEY_VERSION = '2026-10';
export const SHARE_MONTHS = 12;                 // صلاحية الرابط العام
export const CAPSULE_DAYS = 365;                // رسالة إلى نفسي بعد سنة
export const CAPSULE_MIN_CHARS = 40; export const CAPSULE_MAX_CHARS = 3000;
export const NOTE_MAX_CHARS = 1200; export const INTRO_MAX_CHARS = 700;
export const QUOTE_MAX = 220;                   // طول الاقتباس المعروض
export const DAILY_MILESTONES = [10, 30, 100];  // «عشرة مواقف» · «ثلاثون» · «مئة»
export const SHARE_CODE_PREFIX = 'ATH-J';
export const MAX_SHARE_CHAPTERS = 40;

export type ChapterKind = 'placement' | 'daily' | 'simulation' | 'mission' | 'council' | 'return' | 'attestation' | 'level' | 'credential' | 'badge' | 'horizon' | 'pair' | 'org_pair';
export type Chapter = {
  key: string; kind: ChapterKind; at: string; title_ar: string; what_ar: string;
  quote_ar: string | null;                       // كلمات المستخدم نفسه فقط
  level: { skill_id: string; skill_ar: string; to: number; from: number | null } | null;
  ref: { type: string; id: string } | null;      // مرجع داخلي (لا يُنشر)
  public_ok: boolean;                            // أيمكن نشره في النسخة العامة؟ (قضايا المجلس: العنوان والالتزام فقط — بكلمات صاحبها)
};
/** الفصل المشترك (P26): كم زميلًا في جهتي عاش فصلًا من النوع نفسه في الربع نفسه — عدد فقط (k ≥ 5)، لا أسماء؛ لا يُنشر في النسخة العامة */
export type Peers = { people: number; org_name: string; quarter: string };
export const quarterKeyOf = (iso: string) => { const d = new Date(iso); return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };
export function attachPeers<T extends { kind: string; at: string }>(chapters: T[], orgChapters: { kind: string; quarter: string; people: number | null }[], orgName: string): (T & { peers: Peers | null })[] {
  const idx = new Map<string, number>(); for (const oc of orgChapters) if (oc.people !== null && oc.people > 0) idx.set(`${oc.quarter}:${oc.kind}`, oc.people);
  return chapters.map(c => { const q = quarterKeyOf(c.at); const n = idx.get(`${q}:${c.kind}`); return { ...c, peers: n ? { people: n, org_name: orgName, quarter: q } : null }; });
}
export const peersText = (p: Peers) => `${p.people} من زملائك في «${p.org_name}» عاشوا فصلًا مثله في الربع نفسه — عدد لا أسماء.`;
export type JourneyInput = {
  events: { at: string; verb: string; object_type: string; object_id: string; skills: string[]; context: any }[];
  daily: { created_at: string; response: string; band: string | null; score: number | null; case_title: string | null }[];
  sims: { id: string; created_at: string; ended_at: string | null; status: string; score: any }[];
  missions: { id: string; title_ar: string; confirmed_at: string | null; submitted_at: string | null; status: string; skills: string[] }[];
  memberships: { council_id: string; council_title: string | null; joined_at: string | null; status: string }[];
  cases: { id: string; created_at: string; title_ar: string; commitment_ar: string | null; committed_at: string | null; return_ar: string | null; return_outcome: string | null; returned_at: string | null; theme: string | null }[];
  attestations: { created_at: string; decided_at: string | null; status: string; skill_id: string }[];
  levels: { skill_id: string; approved_level: number | null; approved_at: string | null; computed_level: number | null }[];
  credentials: { id: string; title_ar: string; kind: string; issued_at: string; verify_code: string | null; level: string | null }[];
  skills: Record<string, string>;                // skill_id → name_ar
};
export type Journey = { version: string; chapters: Chapter[]; first_at: string | null; days: number; counts: Record<ChapterKind, number>; arc_ar: string; eras: { label: string; keys: string[] }[] };

const clip = (s: string | null | undefined, n = QUOTE_MAX) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); if (!t) return null; return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const sk = (inp: JourneyInput, id: string) => inp.skills[id] || 'مهارة';
const fmtD = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' });
const OUTCOME_AR: Record<string, string> = { succeeded: 'نجحتُ', struggled: 'تعثّرتُ', reframed: 'تغيّر فهمي' };
const BAND_AR: Record<string, string> = { emerging: 'ناشئ', capable: 'قادر', distinguished: 'متميّز', exceptional: 'استثنائي' };

/** بناء الفصول — دالة نقية قابلة للاختبار */
export function buildChapters(inp: JourneyInput): Chapter[] {
  const out: Chapter[] = [];
  const byAt = <T extends { [k: string]: any }>(arr: T[], k: string) => [...arr].filter(x => x[k]).sort((a, b) => String(a[k]).localeCompare(String(b[k])));
  // 1) مِعيار — أول تحديد مستوى
  const pl = byAt(inp.events.filter(e => e.object_type === 'placement' && e.verb === 'assessed'), 'at')[0];
  if (pl) out.push({ key: 'placement_first', kind: 'placement', at: pl.at, title_ar: 'أول قياس', what_ar: `خضعتُ لاختبار تحديد المستوى (مِعيار)${pl.context?.level ? ` — المستوى ${pl.context.level}` : ''}.`, quote_ar: null, level: null, ref: { type: 'placement', id: pl.object_id }, public_ok: true });
  // 2) كل يوم مهارة — أول موقف + معالم العدد
  const daily = byAt(inp.daily, 'created_at');
  if (daily[0]) out.push({ key: 'daily_first', kind: 'daily', at: daily[0].created_at, title_ar: 'أول موقف واجهته', what_ar: `كتبتُ كيف أتصرّف في «${daily[0].case_title || 'موقف اليوم'}»${daily[0].band ? ` — مرآة الأداء: ${BAND_AR[daily[0].band] || daily[0].band}` : ''}.`, quote_ar: clip(daily[0].response), level: null, ref: { type: 'daily', id: daily[0].created_at }, public_ok: true });
  for (const m of DAILY_MILESTONES) { const d = daily[m - 1]; if (!d) break; out.push({ key: `daily_${m}`, kind: 'daily', at: d.created_at, title_ar: m === 10 ? 'عشرة مواقف' : m === 30 ? 'ثلاثون موقفًا' : 'مئة موقف', what_ar: `الموقف رقم ${m}: «${d.case_title || 'موقف اليوم'}»${d.band ? ` — ${BAND_AR[d.band] || d.band}` : ''}. الاستمرار نفسه مهارة.`, quote_ar: clip(d.response), level: null, ref: { type: 'daily', id: d.created_at }, public_ok: true }); }
  // 3) أول محاكاة مكتملة
  const sim = byAt(inp.sims.filter(s => s.ended_at || s.status === 'ended' || s.status === 'scored'), 'created_at')[0];
  if (sim) { const sc = typeof sim.score?.score === 'number' ? sim.score.score : typeof sim.score?.total === 'number' ? sim.score.total : null; out.push({ key: 'sim_first', kind: 'simulation', at: sim.ended_at || sim.created_at, title_ar: 'أول محاكاة', what_ar: `أكملتُ محاكاة موقف حيّ${sc !== null ? ` — النتيجة ${sc}` : ''}.`, quote_ar: null, level: null, ref: { type: 'simulation', id: sim.id }, public_ok: true }); }
  // 4) أول مهمة أكّدها المشرف
  const ms = byAt(inp.missions.filter(m => m.confirmed_at), 'confirmed_at')[0];
  if (ms) out.push({ key: 'mission_first', kind: 'mission', at: ms.confirmed_at!, title_ar: 'أول أثر من قلب العمل', what_ar: `مهمة «${ms.title_ar}» — أكّد مشرفي أنها حدثت فعلًا${ms.skills?.length ? ` (${ms.skills.map(s => sk(inp, s)).join('، ')})` : ''}.`, quote_ar: null, level: null, ref: { type: 'mission', id: ms.id }, public_ok: true });
  // 5) المجالس: الانضمام · أول قضية · أول عودة
  const mem = byAt(inp.memberships.filter(m => m.joined_at && m.status !== 'applied'), 'joined_at')[0];
  if (mem) out.push({ key: 'council_joined', kind: 'council', at: mem.joined_at!, title_ar: 'انضممتُ إلى مجلس', what_ar: `وقّعتُ ميثاق مجلس «${mem.council_title || 'أقران'}» — أقرانٌ من جهات مختلفة حول مواقف حقيقية.`, quote_ar: null, level: null, ref: { type: 'council', id: mem.council_id }, public_ok: true });
  const cs = byAt(inp.cases, 'created_at');
  if (cs[0]) out.push({ key: 'case_first', kind: 'council', at: cs[0].created_at, title_ar: 'أول موقف حملته إلى المجلس', what_ar: `«${cs[0].title_ar}»${cs[0].theme ? ` — ${themeLabel(cs[0].theme)}` : ''}.${cs[0].committed_at ? ' التزمتُ أمام أقراني.' : ''}`, quote_ar: clip(cs[0].commitment_ar), level: null, ref: { type: 'case', id: cs[0].id }, public_ok: true });
  const rt = byAt(inp.cases.filter(c => c.returned_at), 'returned_at')[0];
  if (rt) out.push({ key: 'return_first', kind: 'return', at: rt.returned_at!, title_ar: 'أول عودة', what_ar: `عدتُ إلى المجلس بما حدث فعلًا${rt.return_outcome ? ` — ${OUTCOME_AR[rt.return_outcome] || rt.return_outcome}` : ''}. العودة أثمن لحظة تعلّم.`, quote_ar: clip(rt.return_ar), level: null, ref: { type: 'case', id: rt.id }, public_ok: true });
  // 6) أول شهادة أقران معتمدة (لا اقتباس — كلمات القرين ليست كلماتي)
  const at = byAt(inp.attestations.filter(a => a.status === 'approved').map(a => ({ ...a, at: a.decided_at || a.created_at })), 'at')[0];
  if (at) out.push({ key: 'attestation_first', kind: 'attestation', at: at.at, title_ar: 'أول شهادة من قرين', what_ar: `شهد لي قرينٌ في المجلس بسلوك رآه في «${sk(inp, at.skill_id)}»، واعتمدها إنسان.`, quote_ar: null, level: null, ref: { type: 'attestation', id: at.skill_id }, public_ok: true });
  // 7) كل اعتماد بشري لمستوى
  for (const l of byAt(inp.levels.filter(l => l.approved_level && l.approved_at), 'approved_at')) out.push({ key: `level_approved:${l.skill_id}:${l.approved_level}`, kind: 'level', at: l.approved_at!, title_ar: `اعتُمد مستواي في ${sk(inp, l.skill_id)}`, what_ar: `قرار بشري اعتمد المستوى ${l.approved_level} في «${sk(inp, l.skill_id)}»${l.computed_level ? ` (المحسوب ${Number(l.computed_level).toFixed(1)})` : ''}.`, quote_ar: null, level: { skill_id: l.skill_id, skill_ar: sk(inp, l.skill_id), to: Number(l.approved_level), from: null }, ref: { type: 'skill_level', id: l.skill_id }, public_ok: true });
  // 8) الشهادات
  for (const c of byAt(inp.credentials, 'issued_at')) out.push({ key: `credential:${c.id}`, kind: 'credential', at: c.issued_at, title_ar: c.kind === 'skill' ? 'شهادة مهارة' : 'شهادة', what_ar: `${c.title_ar}${c.level ? ` — المستوى ${c.level}` : ''}${c.verify_code ? ` · رمز التحقق ${c.verify_code}` : ''}.`, quote_ar: null, level: null, ref: { type: 'credential', id: c.id }, public_ok: true });
  // 9) شهادة عضو مجلس
  const bd = byAt(inp.events.filter(e => e.object_type === 'council_badge' && e.verb === 'issued'), 'at')[0];
  if (bd) out.push({ key: 'council_badge', kind: 'badge', at: bd.at, title_ar: 'شهادة عضو مجلس', what_ar: `صدرت لي شهادة عضو مجلس أَثَر موقَّعة${bd.context?.code ? ` (${bd.context.code})` : ''}.`, quote_ar: null, level: null, ref: { type: 'vc', id: bd.object_id }, public_ok: true });
  // 10) أفق الممارس (P27): العهد الموقَّع والمراجعة السنوية — من أحداث مسجَّلة؛ الاقتباس من كلمات صاحبه يوم المراجعة
  for (const e of byAt(inp.events.filter(e => e.object_type === 'horizon' && (e.verb === 'pledged' || e.verb === 'reviewed')), 'at')) {
    if (e.verb === 'pledged') out.push({ key: `horizon_pledged:${e.object_id}`, kind: 'horizon', at: e.at, title_ar: 'قطعتُ عهدًا مع نفسي', what_ar: `خطوة واحدة لسنة واحدة${e.context?.kind ? ` (${({ council: 'مجلس أقران', mission: 'مهمة من قلب العمل', daily: 'كل يوم مهارة', level: 'مستوى معتمد', credential: 'شهادة قرين' } as Record<string, string>)[e.context.kind] || e.context.kind})` : ''} — وثيقة موقَّعة باسمي${e.context?.code ? ` (${e.context.code})` : ''}، والدرب يُكتب من أفعالي.`, quote_ar: null, level: null, ref: { type: 'horizon', id: e.object_id }, public_ok: true });
    else out.push({ key: `horizon_reviewed:${e.object_id}`, kind: 'horizon', at: e.at, title_ar: e.context?.decision === 'renew' ? 'راجعتُ عهدي وجدّدتُ أفقي' : 'راجعتُ عهدي وطويتُ أفقي', what_ar: `بعد سنة من «${e.context?.title || 'عهدي'}»: ${e.context?.complete ? 'ما وعدتُ به وقع — بشهادة الأحداث.' : 'وقع بعضه ولم يقع بعضه — وكتبتُ ما تغيّر.'}`, quote_ar: clip(e.context?.note_ar), level: null, ref: { type: 'horizon', id: e.object_id }, public_ok: true });
  }
  // 11) العهد المتقابل (P29): عهد قطعتُه لزميل من دائرتي ومراجعة مشتركة — بلا اسم الزميل (يُذكر «زميل من مجلسي/جهتي»)
  for (const e of byAt(inp.events.filter(e => e.object_type === 'pair' && (e.verb === 'pledged' || e.verb === 'reviewed')), 'at')) {
    const who = e.context?.circle === 'council' ? 'زميل من مجلسي' : 'زميل من جهتي';
    if (e.verb === 'pledged') out.push({ key: `pair_pledged:${e.object_id}`, kind: 'pair', at: e.at, title_ar: 'قطعتُ عهدًا متقابلًا مع زميل', what_ar: `طلب مني ${who} خطوة لسنة — «${e.context?.title_ar || 'خطوة واحدة'}» — وطلبتُ منه خطوة، ووقّعنا وثيقة واحدة بتوقيعين${e.context?.code ? ` (${e.context.code})` : ''}.`, quote_ar: null, level: null, ref: { type: 'pair', id: e.object_id }, public_ok: false });
    else out.push({ key: `pair_reviewed:${e.object_id}`, kind: 'pair', at: e.at, title_ar: e.context?.decision === 'renew' ? 'راجعنا عهدنا وجدّدناه' : 'راجعنا عهدنا وطويناه', what_ar: `بعد سنة من عهدي مع ${who}: ${e.context?.complete ? 'ما وعدتُ به وقع' : 'ما وعدتُ به لم يقع كله'} — وكتب كلٌّ منّا للآخر ما تغيّر فيه بسببه.`, quote_ar: null, level: null, ref: { type: 'pair', id: e.object_id }, public_ok: false });
  }
  // 12) عهد الممارس وجهته (P30): خطوة طلبتها جهتي مني وخطوة طلبتُها منها — تُذكر الجهة باسمها (هي طرف موقِّع)
  for (const e of byAt(inp.events.filter(e => e.object_type === 'org_pair' && (e.verb === 'pledged' || e.verb === 'reviewed')), 'at')) {
    const org = e.context?.org ? String(e.context.org) : 'جهتي';
    if (e.verb === 'pledged') out.push({ key: `org_pair_pledged:${e.object_id}`, kind: 'org_pair', at: e.at, title_ar: 'قطعتُ عهدًا مع جهتي', what_ar: `طلبت مني ${org} خطوة لسنة — «${e.context?.title_ar || 'خطوة واحدة'}» — وطلبتُ منها خطوة تجاهي، ووقّعنا وثيقة واحدة: أنا باسمي ومديرها بصفته${e.context?.code ? ` (${e.context.code})` : ''}.`, quote_ar: null, level: null, ref: { type: 'org_pair', id: e.object_id }, public_ok: false });
    else out.push({ key: `org_pair_reviewed:${e.object_id}`, kind: 'org_pair', at: e.at, title_ar: e.context?.decision === 'renew' ? 'راجعنا عهدي مع جهتي وجدّدناه' : 'راجعنا عهدي مع جهتي وطويناه', what_ar: `بعد سنة من عهدي مع ${org}: ${e.context?.complete ? 'ما وعدتُ به وقع' : 'ما وعدتُ به لم يقع كله'} — وكتب كلٌّ منّا للآخر ما تغيّر فيه بسببه.`, quote_ar: null, level: null, ref: { type: 'org_pair', id: e.object_id }, public_ok: false });
  }
  // ترتيب زمني + «from» للمستويات اللاحقة في المهارة نفسها
  out.sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
  const seen = new Map<string, number>(); for (const c of out) if (c.level) { const prev = seen.get(c.level.skill_id); c.level.from = prev ?? null; seen.set(c.level.skill_id, c.level.to); }
  return out;
}

export function buildJourney(inp: JourneyInput, now = Date.now()): Journey {
  const chapters = buildChapters(inp); const counts = { placement: 0, daily: 0, simulation: 0, mission: 0, council: 0, return: 0, attestation: 0, level: 0, credential: 0, badge: 0, horizon: 0, pair: 0, org_pair: 0 } as Record<ChapterKind, number>;
  for (const c of chapters) counts[c.kind]++;
  const first = chapters[0]?.at || null; const days = first ? Math.max(0, Math.floor((now - new Date(first).getTime()) / 864e5)) : 0;
  const eras: { label: string; keys: string[] }[] = []; for (const c of chapters) { const d = new Date(c.at); const label = d.toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { year: 'numeric', month: 'long' }); const e = eras[eras.length - 1]; if (e && e.label === label) e.keys.push(c.key); else eras.push({ label, keys: [c.key] }); }
  return { version: JOURNEY_VERSION, chapters, first_at: first, days, counts, arc_ar: arcSentence(chapters, days), eras };
}

/** جملة القوس السردي — محلية دائمًا (الذكاء الاصطناعي اختياري لمقدمة أطول) */
export function arcSentence(chapters: Chapter[], days: number): string {
  if (!chapters.length) return 'لم تبدأ الرحلة بعد — أول موقف تواجهه في «كل يوم مهارة» يكتب فصلها الأول.';
  const k = (kind: ChapterKind) => chapters.filter(c => c.kind === kind).length; const lv = chapters.filter(c => c.level).length;
  const parts: string[] = [`بدأت الرحلة في ${fmtD(chapters[0].at)}${days ? ` — قبل ${days} يومًا` : ''}`, `${chapters.length} ${chapters.length === 1 ? 'فصل' : chapters.length <= 10 ? 'فصول' : 'فصلًا'} حتى اليوم`];
  if (k('daily')) parts.push('مواقف واجهتَها بكلماتك'); if (k('mission')) parts.push('أثر أكّده مشرفك من قلب العمل'); if (k('council') || k('return')) parts.push(k('return') ? 'قضية حملتَها إلى أقرانك وعدتَ بما حدث' : 'قضية حملتَها إلى أقرانك');
  if (k('attestation')) parts.push('قرين شهد لك'); if (k('horizon')) parts.push('عهد مع نفسك'); if (k('pair')) parts.push('عهد متقابل مع زميل'); if (k('org_pair')) parts.push('عهد مع جهتك'); if (lv) parts.push(`${lv} ${lv === 1 ? 'مستوى اعتمده إنسان' : 'مستويات اعتمدها بشر'}`); if (k('credential')) parts.push(`${k('credential')} ${k('credential') === 1 ? 'شهادة' : 'شهادات'}`);
  return parts.join(' · ') + '.';
}

// ---------- النسخة العامة ----------
export type PublicChapter = { key: string; kind: ChapterKind; at: string; title_ar: string; what_ar: string; quote_ar: string | null; level: Chapter['level'] };
export function displayName(full: string, email: string, mode: 'full' | 'short'): string {
  const name = String(full || '').trim() || String(email || '').split('@')[0]; if (mode === 'full') return name;
  const ws = name.split(/\s+/).filter(Boolean); return ws.length > 1 ? `${ws[0]} ${ws[ws.length - 1].slice(0, 1)}.` : ws[0] || name;
}
export function selectPublic(chapters: Chapter[], keys: string[], includeQuotes: boolean): PublicChapter[] {
  const want = new Set(keys); return chapters.filter(c => want.has(c.key) && c.public_ok).map(c => ({ key: c.key, kind: c.kind, at: c.at, title_ar: c.title_ar, what_ar: c.what_ar, quote_ar: includeQuotes ? c.quote_ar : null, level: c.level }));
}
export function validateShare(b: { chapter_keys?: unknown; name_mode?: unknown; intro_ar?: unknown }, chapters: Chapter[]): string | null {
  const keys = Array.isArray(b.chapter_keys) ? b.chapter_keys.map(String) : []; if (!keys.length) return 'اختر فصلًا واحدًا على الأقل لتنشره';
  if (keys.length > MAX_SHARE_CHAPTERS) return `أقصى ${MAX_SHARE_CHAPTERS} فصلًا في نسخة واحدة`;
  const have = new Set(chapters.map(c => c.key)); const bad = keys.filter(k => !have.has(k)); if (bad.length) return 'فصل غير موجود في رحلتك';
  if (b.name_mode !== undefined && b.name_mode !== 'full' && b.name_mode !== 'short') return 'طريقة عرض الاسم: full أو short';
  if (b.intro_ar !== undefined && String(b.intro_ar).length > INTRO_MAX_CHARS) return `المقدمة أطول من ${INTRO_MAX_CHARS} حرفًا`;
  return null;
}
export const shareCode = (rnd: () => string) => `${SHARE_CODE_PREFIX}-${rnd()}-${rnd()}`;
export const addDays = (iso: string | Date, d: number) => new Date(new Date(iso).getTime() + d * 864e5).toISOString();
export const addMonths = (iso: string | Date, m: number) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString(); };

// ---------- تعليقات الفصول ----------
export function validateNote(b: { chapter_key?: unknown; body_ar?: unknown; media_id?: unknown; kind?: unknown }, chapters: Chapter[]): string | null {
  const key = String(b.chapter_key || ''); if (!chapters.some(c => c.key === key)) return 'الفصل غير موجود في رحلتك';
  const body = String(b.body_ar || '').trim(); const media = b.media_id ? String(b.media_id) : '';
  if (!body && !media) return 'اكتب أو سجّل ما تغيّر فيك';
  if (body.length > NOTE_MAX_CHARS) return `التعليق أطول من ${NOTE_MAX_CHARS} حرفًا`;
  if (b.kind !== undefined && !['text', 'audio', 'video'].includes(String(b.kind))) return 'نوع غير معروف';
  return null;
}

// ---------- رسالة إلى نفسي بعد سنة ----------
export type CapsuleSnapshot = { chapters: number; levels: { skill: string; level: number }[]; last_chapter: string | null; days: number };
export function capsuleSnapshot(j: Journey): CapsuleSnapshot {
  const lv = new Map<string, { skill: string; level: number }>(); for (const c of j.chapters) if (c.level) lv.set(c.level.skill_id, { skill: c.level.skill_ar, level: c.level.to });
  return { chapters: j.chapters.length, levels: Array.from(lv.values()), last_chapter: j.chapters[j.chapters.length - 1]?.title_ar || null, days: j.days };
}
export function validateCapsule(b: { body_ar?: unknown; media_id?: unknown }): string | null {
  const body = String(b.body_ar || '').trim(); const media = b.media_id ? String(b.media_id) : '';
  if (!media && body.length < CAPSULE_MIN_CHARS) return `اكتب لنفسك ${CAPSULE_MIN_CHARS} حرفًا على الأقل — أو سجّل صوتك`;
  if (body.length > CAPSULE_MAX_CHARS) return `الرسالة أطول من ${CAPSULE_MAX_CHARS} حرفًا`;
  return null;
}
/** نص التسليم بعد سنة: «أين كنتَ» و«أين صرتَ» — أرقام الرحلة نفسها، بلا حكم */
export function capsuleDeliveryText(name: string, then: CapsuleSnapshot, now: CapsuleSnapshot, writtenAt: string): string {
  const lvThen = new Map(then.levels.map(l => [l.skill, l.level])); const changed = now.levels.filter(l => (lvThen.get(l.skill) ?? 0) !== l.level).map(l => `${l.skill}: ${lvThen.has(l.skill) ? `${lvThen.get(l.skill)} → ${l.level}` : `اعتُمد ${l.level}`}`);
  return [`${name ? `${name}، ` : ''}هذه رسالة كتبتَها لنفسك في ${fmtD(writtenAt)}.`,
    `يومها كانت رحلتك ${then.chapters} ${then.chapters === 1 ? 'فصلًا' : 'فصلًا'}${then.last_chapter ? ` — آخرها «${then.last_chapter}»` : ''}.`,
    `واليوم صارت ${now.chapters} ${now.chapters === 1 ? 'فصلًا' : 'فصلًا'}${now.last_chapter && now.last_chapter !== then.last_chapter ? ` — آخرها «${now.last_chapter}»` : ''}${changed.length ? `، وتغيّرت مستوياتك المعتمدة: ${changed.join('، ')}` : ''}.`,
    'اقرأ ما كتبتَه، ثم اكتب لنفسك رسالة السنة القادمة إن شئت.'].join(' ');
}

/** ملخص للوكلاء (my_journey) — بلا نصوص طويلة */
export function journeySummary(j: Journey, shares: { code: string; status: string; expires_at: string }[], capsules: { status: string; deliver_at: string }[]) {
  return { version: j.version, days: j.days, first_at: j.first_at, chapters: j.chapters.length, counts: j.counts, arc_ar: j.arc_ar, latest: j.chapters.slice(-5).reverse().map(c => ({ key: c.key, at: c.at.slice(0, 10), title_ar: c.title_ar })), shares: shares.filter(s => s.status === 'active').map(s => ({ code: s.code, expires_at: s.expires_at })), capsules: capsules.map(c => ({ status: c.status, deliver_at: c.deliver_at })) };
}
