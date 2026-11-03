// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «النموّ والمقارنة» — م5-ب من «مِعيار — من أَثَر»
 *  1) رحلة المتقدّم: مقارنة محاولتين (الاختبار الأول بتاريخ… والثاني بتاريخ…) على السُّلّم نفسه، وما استجدّ من «أستطيع»، وحكمُ النموّ
 *     بميزان خطأ القياس (مؤكَّد · محتمل · ضمن خطأ القياس · تراجع) — لا يُعلَن نموّ يقع داخل هامش الخطأ.
 *  2) مجموعة مقابل مجموعة: وسم/دعوة/برنامج/فترة — k ≥ 5 — حجم الأثر (Cohen d) بتفسير عربي وفاصل ثقة 95%.
 *  3) قبل/بعد البرنامج: أذون إعادة «نهاية البرنامج» تُمنح كسولًا للمسكَّنين من مِعيار حين ينقضي تاريخ النهاية، ثم تقرير الأزواج.
 *  4) «شهادة النموّ»: وثيقة موقَّعة (Open Badges 3.0) يُصدرها إنسان فقط، ولا تصدر لنموّ ضمن خطأ القياس — تُتحقَّق على /verify/vc.
 *  لا يقرّر الذكاء الاصطناعي شيئًا هنا؛ الأرقام تصف، والإنسان يحكم.
 */
import { CAN_DO, LEVELS, isResultCode, skillLabel, type Level } from './registry';
import { LEDGER_LEVELS, LEVEL_AR, isLedgerLevel, reportLevels, type LedgerLevel } from './ledger';
import { VC_CONTEXTS, didWeb, documentDigest, issuerBlock, statusEntry } from '../portal/vc';
import { ensureKeyRow, sha256, signDocument, signerFromEnv } from '../portal/vc-server';

/* ───────── أنواع ───────── */
export type SkillPoint = { skill: string; label: string; percent: number; answered: number };
export type Attempt = {
  id: string; code: string | null; email: string; name: string; taken_at: string; attempt: number;
  demonstrated: LedgerLevel; entry: LedgerLevel; percent: number | null; n_items: number; confidence: string; light: string | null;
  finish: string; archived: boolean; previous_report_id: string | null; invite_id: string | null; group_tag: string | null;
  skills: SkillPoint[]; growth_vc_code: string | null; growth_public: boolean;
};
export type Verdict = 'confirmed' | 'likely' | 'within' | 'decline';
export const VERDICT_AR: Record<Verdict, { title: string; note: string }> = {
  confirmed: { title: 'نموّ مؤكَّد', note: 'الفرق أكبر من ضعف خطأ القياس المشترك، أو ارتقى المتقدّم درجةً كاملة على السُّلّم مع فرق إيجابي واضح.' },
  likely: { title: 'نموّ محتمل', note: 'الفرق إيجابي ويتجاوز خطأ القياس مرّة واحدة، لكنه لا يبلغ عتبة التأكيد — يُستحسن دليل بشري (كتابة أو تحدّث).' },
  within: { title: 'ضمن خطأ القياس', note: 'الفرق أصغر من هامش الخطأ؛ لا يصحّ وصفه نموًّا ولا تراجعًا. لا تصدر شهادة نموّ هنا.' },
  decline: { title: 'تراجع ملحوظ', note: 'النتيجة الثانية أدنى بفارق يتجاوز خطأ القياس — راجع ظروف الجلسة (الوقت، الانقطاع، الجهاز) قبل أي حكم.' },
};
export type Comparison = {
  first: { id: string; code: string | null; taken_at: string; level: LedgerLevel; entry: LedgerLevel; percent: number | null; n: number };
  second: { id: string; code: string | null; taken_at: string; level: LedgerLevel; entry: LedgerLevel; percent: number | null; n: number };
  steps: number; percent_diff: number | null; se_diff: number | null; z: number | null; days: number; verdict: Verdict;
  skills: { skill: string; label: string; a: number | null; b: number | null; diff: number | null }[];
  gained: { level: Level; statements: string[] }[];
  sentence: string;
};

/* ───────── أدوات ───────── */
const nowIso = () => new Date().toISOString();
const lower = (v: unknown) => String(v || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const levelIndex = (l: string): number => Math.max(0, (LEDGER_LEVELS as readonly string[]).indexOf(l));
export const fmtDay = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10); };
const round1 = (x: number) => Math.round(x * 10) / 10;
/** خطأ القياس للنسبة المئوية (ثنائي الحدّين) — بنسبة مقيَّدة بين 5% و95% حتى لا يصفر الخطأ عند الأطراف */
export function seOfPercent(percent: number | null, n: number): number | null {
  if (percent === null || !Number.isFinite(percent) || n <= 0) return null;
  const p = Math.min(0.95, Math.max(0.05, percent / 100)); return Math.sqrt((p * (1 - p)) / n) * 100;
}
export function verdictOf(steps: number, z: number | null): Verdict {
  if (steps < 0 && (z === null || z <= -1)) return 'decline';
  if (z !== null && z <= -1.96) return 'decline';
  if (steps >= 2) return 'confirmed';
  if (steps >= 1 && (z === null || z >= 1)) return 'confirmed';
  if (steps >= 1 || (z !== null && z >= 1.96)) return 'likely';
  if (z !== null && z >= 1 && steps >= 0) return 'likely';
  return 'within';
}
export const certificateAllowed = (v: Verdict) => v === 'confirmed' || v === 'likely';

/* ───────── المحاولة من صفّ التقرير ───────── */
export function attemptOf(row: any, attempt = 1): Attempt {
  const r = row?.report || {}; const L = reportLevels(r); const st = r.احصائيات || {};
  const skills: SkillPoint[] = Object.keys(st).filter((k) => st[k] && Number(st[k].answered) > 0).map((k) => ({ skill: k, label: skillLabel(k), percent: Number(st[k].percent) || 0, answered: Number(st[k].answered) || 0 }));
  const n = Number(r.عدد_البنود_المقدمة); const nItems = Number.isFinite(n) && n > 0 ? n : skills.reduce((s, x) => s + x.answered, 0);
  return {
    id: String(row.id), code: row.access_code || null, email: lower(row.candidate_email), name: L.name, taken_at: String(row.created_at || r.تاريخ || ''), attempt,
    demonstrated: L.demonstrated, entry: L.entry, percent: L.percent, n_items: nItems, confidence: L.confidence, light: r.الموثوقية?.الضوء ? String(r.الموثوقية.الضوء) : null,
    finish: L.finish, archived: !!row.archived_at, previous_report_id: row.previous_report_id ? String(row.previous_report_id) : null, invite_id: row.invite_id ? String(row.invite_id) : null, group_tag: row.group_tag || null,
    skills, growth_vc_code: row.growth_vc_code || null, growth_public: !!row.growth_public,
  };
}
export const firstName = (name: string) => String(name || '').trim().split(/\s+/)[0] || '—';

/* ───────── المقارنة بين محاولتين ───────── */
export function compareAttempts(a: Attempt, b: Attempt): Comparison {
  const steps = levelIndex(b.demonstrated) - levelIndex(a.demonstrated);
  const pd = a.percent !== null && b.percent !== null ? b.percent - a.percent : null;
  const sa = seOfPercent(a.percent, a.n_items), sb = seOfPercent(b.percent, b.n_items);
  const se = sa !== null && sb !== null ? Math.sqrt(sa * sa + sb * sb) : null;
  const z = pd !== null && se ? pd / se : null;
  const days = Math.max(0, Math.round((new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()) / 86400_000));
  const keys = [...new Set([...a.skills.map((s) => s.skill), ...b.skills.map((s) => s.skill)])];
  const skills = keys.map((k) => { const x = a.skills.find((s) => s.skill === k); const y = b.skills.find((s) => s.skill === k); return { skill: k, label: skillLabel(k), a: x ? x.percent : null, b: y ? y.percent : null, diff: x && y ? y.percent - x.percent : null }; });
  const gained: Comparison['gained'] = [];
  if (steps > 0) for (let i = levelIndex(a.demonstrated) + 1; i <= levelIndex(b.demonstrated); i += 1) { const lv = LEDGER_LEVELS[i] as string; if ((LEVELS as readonly string[]).includes(lv)) gained.push({ level: lv as Level, statements: CAN_DO[lv as Level].ar }); }
  const verdict = verdictOf(steps, z);
  const sentence = `الاختبار الأول بتاريخ ${fmtDay(a.taken_at)} (${LEVEL_AR[a.demonstrated]}${a.percent !== null ? ` · ${a.percent}%` : ''}) والثاني بتاريخ ${fmtDay(b.taken_at)} (${LEVEL_AR[b.demonstrated]}${b.percent !== null ? ` · ${b.percent}%` : ''}) — ${VERDICT_AR[verdict].title}${steps > 0 ? ` بارتقاء ${steps === 1 ? 'درجة واحدة' : steps === 2 ? 'درجتين' : `${steps} درجات`} على السُّلّم` : steps < 0 ? ` بنزول ${Math.abs(steps)} على السُّلّم` : ''}.`;
  return {
    first: { id: a.id, code: a.code, taken_at: a.taken_at, level: a.demonstrated, entry: a.entry, percent: a.percent, n: a.n_items },
    second: { id: b.id, code: b.code, taken_at: b.taken_at, level: b.demonstrated, entry: b.entry, percent: b.percent, n: b.n_items },
    steps, percent_diff: pd, se_diff: se === null ? null : round1(se), z: z === null ? null : round1(z), days, verdict, skills, gained, sentence,
  };
}

/* ───────── الرحلة ───────── */
const REPORT_COLS = 'id,created_at,access_code,candidate_email,report,archived_at,previous_report_id,invite_id,group_tag,growth_vc_code,growth_public';
export async function attemptsByEmail(db: any, email: string): Promise<Attempt[]> {
  const e = lower(email); if (!EMAIL_RE.test(e)) return [];
  const { data } = await db.from('placement_reports').select(REPORT_COLS).ilike('candidate_email', e).order('created_at', { ascending: true }).limit(50);
  return ((data || []) as any[]).map((r, i) => attemptOf(r, i + 1));
}
/** المحاولة المرجعية للمقارنة: ما أشار إليه إذن الإعادة (previous_report_id) وإلا المحاولة التي قبلها مباشرة */
export function pairFor(attempts: Attempt[], target: Attempt): Attempt | null {
  const byPrev = target.previous_report_id ? attempts.find((x) => x.id === target.previous_report_id) : null; if (byPrev) return byPrev;
  const idx = attempts.findIndex((x) => x.id === target.id); return idx > 0 ? attempts[idx - 1] : null;
}
export type Journey = {
  name: string; email?: string; code: string; count: number; latest: Attempt; attempts: Attempt[]; comparison: Comparison | null; since_first: Comparison | null;
  certificate: { code: string; url: string } | null; public: boolean; ladder: { level: LedgerLevel; label: string; points: number[] }[];
};
function buildJourney(attempts: Attempt[], target: Attempt, site: string): Journey {
  const prev = pairFor(attempts, target); const first = attempts[0];
  const cmp = prev ? compareAttempts(prev, target) : null;
  const sinceFirst = first && first.id !== target.id && first.id !== prev?.id ? compareAttempts(first, target) : null;
  const ladder = LEDGER_LEVELS.map((l) => ({ level: l, label: LEVEL_AR[l], points: attempts.filter((a) => a.demonstrated === l).map((a) => a.attempt) }));
  const cert = target.growth_vc_code ? { code: target.growth_vc_code, url: `${site}/verify/vc?code=${encodeURIComponent(target.growth_vc_code)}` } : null;
  return { name: target.name, code: target.code || '', count: attempts.length, latest: target, attempts, comparison: cmp, since_first: sinceFirst, certificate: cert, public: target.growth_public, ladder };
}
/** للعلن برمز النتيجة: الاسم الأول فقط، بلا بريد ولا بنود */
export async function journeyByCode(db: any, code: unknown, site: string): Promise<Journey | null> {
  const c = String(code || '').trim().toUpperCase(); if (!isResultCode(c)) return null;
  const { data } = await db.from('placement_reports').select(REPORT_COLS).eq('access_code', c).maybeSingle(); if (!data) return null;
  const attempts = await attemptsByEmail(db, data.candidate_email); const target = attempts.find((a) => a.id === String(data.id)) || attemptOf(data, 1);
  const j = buildJourney(attempts.length ? attempts : [target], target, site);
  const strip = (a: Attempt): Attempt => ({ ...a, email: '', name: firstName(a.name), id: '' });
  return { ...j, name: firstName(j.name), latest: strip(j.latest), attempts: j.attempts.map(strip), comparison: j.comparison ? { ...j.comparison, first: { ...j.comparison.first, id: '' }, second: { ...j.comparison.second, id: '' } } : null, since_first: j.since_first ? { ...j.since_first, first: { ...j.since_first.first, id: '' }, second: { ...j.since_first.second, id: '' } } : null };
}
/** للطاقم بالبريد (أحدث محاولة هي الهدف ما لم يُحدَّد تقرير) */
export async function journeyByEmail(db: any, email: unknown, site: string, reportId?: string | null): Promise<Journey | null> {
  const attempts = await attemptsByEmail(db, String(email || '')); if (!attempts.length) return null;
  const target = (reportId && attempts.find((a) => a.id === reportId)) || attempts[attempts.length - 1];
  return { ...buildJourney(attempts, target, site), email: attempts[0].email };
}
/** هل للمتقدّم محاولة سابقة؟ (لبطاقة النتيجة: زرّ «رحلتك») */
export async function hasJourney(db: any, email: unknown): Promise<boolean> {
  const e = lower(email); if (!EMAIL_RE.test(e)) return false;
  const { count } = await db.from('placement_reports').select('id', { count: 'exact', head: true }).ilike('candidate_email', e); return Number(count || 0) > 1;
}
export async function setGrowthPublic(db: any, code: unknown, on: boolean): Promise<boolean> {
  const c = String(code || '').trim().toUpperCase(); if (!isResultCode(c)) return false;
  const { data, error } = await db.from('placement_reports').update({ growth_public: on }).eq('access_code', c).select('id'); return !error && Array.isArray(data) && data.length > 0;
}

/* ───────── المجموعات ───────── */
export type GroupSel = { kind: 'tag' | 'invite' | 'program' | 'period'; value?: string | null; from?: string | null; to?: string | null };
export type GroupStats = { k: number; label: string; mean: number | null; sd: number | null; median: number | null; dist: Record<string, number>; mean_level: number | null; border: number; red: number; attempts: number };
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a: number[]) => { if (a.length < 2) return null; const m = mean(a)!; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
export function groupStats(attempts: Attempt[], label: string): GroupStats {
  /* أحدث محاولة لكل بريد — المتقدّم يُحسب مرّة واحدة */
  const latest = new Map<string, Attempt>(); for (const a of attempts) { const p = latest.get(a.email); if (!p || p.taken_at < a.taken_at) latest.set(a.email, a); }
  const rows = [...latest.values()]; const pct = rows.map((r) => r.percent).filter((x): x is number => x !== null);
  const dist: Record<string, number> = {}; for (const l of LEDGER_LEVELS) dist[l] = 0; for (const r of rows) dist[r.demonstrated] = (dist[r.demonstrated] || 0) + 1;
  const lv = rows.map((r) => levelIndex(r.demonstrated));
  return { k: rows.length, label, mean: pct.length ? round1(mean(pct)!) : null, sd: pct.length > 1 ? round1(sd(pct)!) : null, median: pct.length ? median(pct) : null, dist, mean_level: lv.length ? round1(mean(lv)!) : null, border: rows.filter((r) => r.confidence === 'border').length, red: rows.filter((r) => r.light === 'red').length, attempts: attempts.length };
}
export const MIN_GROUP = 5;
export function cohenD(a: number[], b: number[]): { d: number; lo: number; hi: number; diff: number } | null {
  if (a.length < 2 || b.length < 2) return null; const ma = mean(a)!, mb = mean(b)!, sa = sd(a)!, sb = sd(b)!;
  const pooled = Math.sqrt(((a.length - 1) * sa * sa + (b.length - 1) * sb * sb) / (a.length + b.length - 2)); if (!pooled) return { d: 0, lo: 0, hi: 0, diff: mb - ma };
  const d = (mb - ma) / pooled; const seD = Math.sqrt((a.length + b.length) / (a.length * b.length) + (d * d) / (2 * (a.length + b.length)));
  return { d: round1(d * 10) / 10, lo: round1(d - 1.96 * seD), hi: round1(d + 1.96 * seD), diff: round1(mb - ma) };
}
export function effectAr(d: number): string { const x = Math.abs(d); const size = x < 0.2 ? 'لا يُذكر' : x < 0.5 ? 'صغير' : x < 0.8 ? 'متوسط' : 'كبير'; return x < 0.2 ? `أثر ${size} — المجموعتان متقاربتان عمليًّا` : `أثر ${size} لصالح ${d > 0 ? 'المجموعة الثانية' : 'المجموعة الأولى'}`; }
export type GroupCompare = { a: GroupStats; b: GroupStats; ok: boolean; reason: string | null; d: number | null; ci: [number, number] | null; diff: number | null; interpretation: string | null; level_diff: number | null };
export function compareGroups(A: Attempt[], la: string, B: Attempt[], lb: string): GroupCompare {
  const a = groupStats(A, la), b = groupStats(B, lb);
  if (a.k < MIN_GROUP || b.k < MIN_GROUP) return { a, b, ok: false, reason: `لا تُقارَن مجموعة أصغر من ${MIN_GROUP} متقدّمين (الأولى ${a.k} · الثانية ${b.k}) — حمايةً للأفراد من الاستدلال.`, d: null, ci: null, diff: null, interpretation: null, level_diff: null };
  const latest = (xs: Attempt[]) => { const m = new Map<string, Attempt>(); for (const x of xs) { const p = m.get(x.email); if (!p || p.taken_at < x.taken_at) m.set(x.email, x); } return [...m.values()]; };
  const pa = latest(A).map((x) => x.percent).filter((x): x is number => x !== null), pb = latest(B).map((x) => x.percent).filter((x): x is number => x !== null);
  const e = cohenD(pa, pb); const ld = a.mean_level !== null && b.mean_level !== null ? round1(b.mean_level - a.mean_level) : null;
  return { a, b, ok: true, reason: null, d: e ? e.d : null, ci: e ? [e.lo, e.hi] : null, diff: e ? e.diff : null, interpretation: e ? effectAr(e.d) + (e.lo <= 0 && e.hi >= 0 ? ' — وفاصل الثقة يشمل الصفر، فالفرق غير حاسم.' : ' — وفاصل الثقة لا يشمل الصفر.') : null, level_diff: ld };
}
export function parseGroupSel(prefix: string, sp: URLSearchParams): GroupSel | null {
  const kind = String(sp.get(`${prefix}_kind`) || ''); const value = String(sp.get(`${prefix}`) || '').trim().slice(0, 80) || null;
  if (kind === 'tag' || kind === 'invite' || kind === 'program') return value ? { kind, value } : null;
  if (kind === 'period') { const from = sp.get(`${prefix}_from`), to = sp.get(`${prefix}_to`); return from || to ? { kind, from, to } : null; }
  return null;
}
export async function groupAttempts(db: any, sel: GroupSel): Promise<{ attempts: Attempt[]; label: string }> {
  let q = db.from('placement_reports').select(REPORT_COLS).is('archived_at', null).order('created_at', { ascending: true }).limit(2000); let label = '';
  if (sel.kind === 'tag') { q = q.eq('group_tag', sel.value); label = `وسم «${sel.value}»`; }
  else if (sel.kind === 'invite') { q = q.eq('invite_id', sel.value); label = `دعوة ${String(sel.value).slice(0, 8)}`; const { data } = await db.from('placement_invites').select('label_ar').eq('id', sel.value).maybeSingle(); if (data?.label_ar) label = `دعوة «${data.label_ar}»`; }
  else if (sel.kind === 'period') { if (sel.from) q = q.gte('created_at', String(sel.from).slice(0, 10) + 'T00:00:00.000Z'); if (sel.to) q = q.lte('created_at', String(sel.to).slice(0, 10) + 'T23:59:59.999Z'); label = `فترة ${sel.from || '…'} → ${sel.to || '…'}`; }
  else if (sel.kind === 'program') {
    const [{ data: enr }, { data: pr }] = await Promise.all([db.from('portal_enrollments').select('email').eq('program_id', sel.value).eq('source', 'miaar').limit(2000), db.from('programs').select('name_ar').eq('id', sel.value).maybeSingle()]);
    const emails = [...new Set(((enr || []) as any[]).map((x) => lower(x.email)).filter((e) => EMAIL_RE.test(e)))]; label = `برنامج «${pr?.name_ar || sel.value}»`;
    if (!emails.length) return { attempts: [], label }; q = q.in('candidate_email', emails.slice(0, 500));
  }
  const { data } = await q; return { attempts: ((data || []) as any[]).map((r) => attemptOf(r)), label };
}
/** خيارات المجموعات لقائمة الاختيار: الوسوم والدعوات والبرامج التي لها تسجيلات من مِعيار */
export async function groupOptions(db: any) {
  const [{ data: tags }, { data: inv }, { data: enr }] = await Promise.all([
    db.from('placement_reports').select('group_tag').not('group_tag', 'is', null).limit(2000),
    db.from('placement_invites').select('id,label_ar').order('created_at', { ascending: false }).limit(100),
    db.from('portal_enrollments').select('program_id').eq('source', 'miaar').limit(2000),
  ]);
  const tagCount = new Map<string, number>(); for (const t of (tags || []) as any[]) if (t.group_tag) tagCount.set(String(t.group_tag), (tagCount.get(String(t.group_tag)) || 0) + 1);
  const pids = [...new Set(((enr || []) as any[]).map((x) => String(x.program_id)).filter(Boolean))];
  const { data: progs } = pids.length ? await db.from('programs').select('id,name_ar,end_date,start_date').in('id', pids) : { data: [] };
  return { tags: [...tagCount.entries()].map(([tag, n]) => ({ tag, n })).sort((x, y) => y.n - x.n), invites: ((inv || []) as any[]).map((i) => ({ id: String(i.id), label: i.label_ar || String(i.id).slice(0, 8) })), programs: ((progs || []) as any[]).map((p) => ({ id: String(p.id), name: p.name_ar || '—', start_date: p.start_date || null, end_date: p.end_date || null })) };
}

/* ───────── قبل/بعد البرنامج ───────── */
export type ProgramImpact = {
  program: { id: string; name: string; start_date: string | null; end_date: string | null; ended: boolean };
  enrolled: number; grants_open: number; retook: number; pairs: Comparison[];
  summary: { mean_gain: number | null; level_up: number; same: number; down: number; d_paired: number | null; ci: [number, number] | null; verdicts: Record<Verdict, number>; skills: { skill: string; label: string; mean_diff: number; n: number }[] } | null;
  note: string;
};
export async function programImpact(db: any, programId: string, site: string): Promise<ProgramImpact | null> {
  const { data: p } = await db.from('programs').select('id,name_ar,start_date,end_date').eq('id', programId).maybeSingle(); if (!p) return null;
  const ended = !!p.end_date && String(p.end_date).slice(0, 10) < nowIso().slice(0, 10);
  const { data: enr } = await db.from('portal_enrollments').select('email,created_at').eq('program_id', programId).eq('source', 'miaar').limit(1000);
  const emails = [...new Set(((enr || []) as any[]).map((x) => lower(x.email)).filter((e) => EMAIL_RE.test(e)))];
  const { data: grants } = emails.length ? await db.from('test_retake_approvals').select('email,used_at,revoked_at,expires_at').eq('program_id', programId).eq('kind', 'program_end').limit(1000) : { data: [] };
  const open = ((grants || []) as any[]).filter((g) => !g.used_at && !g.revoked_at && (!g.expires_at || String(g.expires_at) > nowIso())).length;
  const pairs: Comparison[] = [];
  for (const e of emails.slice(0, 300)) {
    const attempts = await attemptsByEmail(db, e); if (attempts.length < 2) continue;
    const enrolledAt = String(((enr || []) as any[]).find((x) => lower(x.email) === e)?.created_at || ''); 
    /* قبل = آخر محاولة قبل التسجيل (أو الأولى) · بعد = أول محاولة بعد التسجيل وبعد بدء البرنامج */
    const before = [...attempts].reverse().find((a) => !enrolledAt || a.taken_at <= enrolledAt) || attempts[0];
    const startIso = p.start_date ? String(p.start_date).slice(0, 10) + 'T00:00:00.000Z' : '';
    const after = attempts.find((a) => a.id !== before.id && a.taken_at > before.taken_at && (!enrolledAt || a.taken_at > enrolledAt) && (!startIso || a.taken_at > startIso)); if (!after) continue;
    pairs.push(compareAttempts(before, after));
  }
  let summary: ProgramImpact['summary'] = null;
  if (pairs.length) {
    const gains = pairs.map((c) => c.percent_diff).filter((x): x is number => x !== null); const m = gains.length ? mean(gains)! : null; const s = gains.length > 1 ? sd(gains)! : null;
    const dP = m !== null && s ? m / s : null; const seD = dP !== null ? Math.sqrt(1 / gains.length + (dP * dP) / (2 * gains.length)) : null;
    const verdicts: Record<Verdict, number> = { confirmed: 0, likely: 0, within: 0, decline: 0 }; for (const c of pairs) verdicts[c.verdict] += 1;
    const sk = new Map<string, { label: string; sum: number; n: number }>(); for (const c of pairs) for (const x of c.skills) if (x.diff !== null) { const cur = sk.get(x.skill) || { label: x.label, sum: 0, n: 0 }; cur.sum += x.diff; cur.n += 1; sk.set(x.skill, cur); }
    summary = { mean_gain: m === null ? null : round1(m), level_up: pairs.filter((c) => c.steps > 0).length, same: pairs.filter((c) => c.steps === 0).length, down: pairs.filter((c) => c.steps < 0).length, d_paired: dP === null ? null : round1(dP), ci: dP !== null && seD ? [round1(dP - 1.96 * seD), round1(dP + 1.96 * seD)] : null, verdicts, skills: [...sk.entries()].map(([skill, v]) => ({ skill, label: v.label, mean_diff: round1(v.sum / v.n), n: v.n })) };
  }
  const note = !emails.length ? 'لا تسجيلات من مِعيار في هذا البرنامج بعد.' : !ended ? `البرنامج لم ينتهِ بعد (${p.end_date || 'بلا تاريخ نهاية'}) — تُمنح أذون «نهاية البرنامج» تلقائيًا حين يحلّ التاريخ.` : pairs.length < MIN_GROUP ? `الأزواج المكتملة ${pairs.length} — الملخّص الجماعي يُعرض كاملًا عند ${MIN_GROUP} أزواج فأكثر؛ الرحلات الفردية متاحة.` : 'قبل/بعد مكتمل.';
  return { program: { id: String(p.id), name: p.name_ar || '—', start_date: p.start_date || null, end_date: p.end_date || null, ended }, enrolled: emails.length, grants_open: open, retook: pairs.length, pairs: pairs.map((c) => ({ ...c })), summary: pairs.length >= MIN_GROUP ? summary : (summary ? { ...summary, d_paired: null, ci: null } : null), note };
}
/** أذون «نهاية البرنامج» الكسولة: لكل برنامج انتهى تاريخه، يُمنح كل مسكَّن من مِعيار إذنَ إعادة واحدًا (30 يومًا) ما لم يُمنح من قبل */
export async function programEndGrants(db: any, actorId: string | null, limit = 20): Promise<{ programs: number; granted: number }> {
  const today = nowIso().slice(0, 10);
  const { data: progs } = await db.from('programs').select('id,end_date').lt('end_date', today).gte('end_date', new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10)).limit(limit);
  let granted = 0, programs = 0;
  for (const p of (progs || []) as any[]) {
    const { data: enr } = await db.from('portal_enrollments').select('email,placement_id').eq('program_id', p.id).eq('source', 'miaar').limit(1000);
    const emails = [...new Set(((enr || []) as any[]).map((x) => lower(x.email)).filter((e) => EMAIL_RE.test(e)))]; if (!emails.length) continue; programs += 1;
    const { data: have } = await db.from('test_retake_approvals').select('email').eq('program_id', p.id).eq('kind', 'program_end').limit(2000);
    const done = new Set(((have || []) as any[]).map((g) => lower(g.email))); const missing = emails.filter((e) => !done.has(e)); if (!missing.length) continue;
    const { data: reps } = await db.from('placement_reports').select('id,candidate_email,created_at').in('candidate_email', missing).order('created_at', { ascending: false }).limit(2000);
    const prev = new Map<string, string>(); for (const r of (reps || []) as any[]) { const e = lower(r.candidate_email); if (!prev.has(e)) prev.set(e, String(r.id)); }
    const expires_at = new Date(Date.now() + 30 * 86400_000).toISOString();
    const rows = missing.map((email) => ({ email, approved_by: actorId, kind: 'program_end', reason: 'إعادة قياس بعد نهاية البرنامج (تلقائي)', note: 'إعادة قياس بعد نهاية البرنامج (تلقائي)', expires_at, program_id: String(p.id), previous_report_id: prev.get(email) || null, invite_id: null }));
    const r = await db.from('test_retake_approvals').insert(rows); if (!r.error) granted += rows.length;
  }
  return { programs, granted };
}

/* ───────── شهادة النموّ ───────── */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function growthCode(rnd: () => number = Math.random): string { const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(rnd() * CODE_ALPHABET.length)]).join(''); return `ATH-G-${part()}-${part()}`; }
export function buildGrowthDoc(inp: { code: string; name: string; email: string; cmp: Comparison; site: string; did: string; now?: Date; statusIndex: number | null; issuedBy: string | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`; const c = inp.cmp;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: `شهادة النموّ — مِعيار من أَثَر · ${LEVEL_AR[c.first.level]} → ${LEVEL_AR[c.second.level]}`,
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(),
    credentialSubject: { type: ['AchievementSubject'], name: inp.name, identifier: [{ type: 'IdentityObject', identityType: 'emailAddress', hashed: false, identityHash: inp.email }],
      achievement: { id: `${inp.site}/miaar#growth`, type: ['Achievement'], name: 'Measured growth in Arabic proficiency (Miaar placement, CEFR scale)', achievementType: 'Competency',
        description: `Two sittings of the Miaar Arabic placement test ${c.days} days apart: ${c.first.level} (${fmtDay(c.first.taken_at)}) → ${c.second.level} (${fmtDay(c.second.taken_at)}). Verdict: ${c.verdict}. Issued by a human reviewer; growth within measurement error is never certified.`,
        criteria: { narrative: 'Growth is confirmed when the CEFR level rises by at least one band with a positive score difference beyond one standard error, or when the score difference exceeds 1.96 × the pooled standard error of measurement.' },
        alignment: [{ type: ['Alignment'], targetName: 'CEFR (Common European Framework of Reference)', targetFramework: 'CEFR', targetCode: c.second.level, targetUrl: 'https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions' }] },
      result: [
        { type: ['Result'], resultDescription: 'miaar:first', value: `${c.first.level}${c.first.percent !== null ? ` · ${c.first.percent}%` : ''}`, status: 'Completed', achievedLevel: `${inp.site}/miaar#level-${c.first.level}` },
        { type: ['Result'], resultDescription: 'miaar:second', value: `${c.second.level}${c.second.percent !== null ? ` · ${c.second.percent}%` : ''}`, status: 'Completed', achievedLevel: `${inp.site}/miaar#level-${c.second.level}` },
      ] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'miaar_growth', code: inp.code, holder: inp.name, verify_url: url, title_ar: 'شهادة النموّ — مِعيار من أَثَر', sentence_ar: c.sentence, verdict: c.verdict, verdict_ar: VERDICT_AR[c.verdict].title, steps: c.steps, percent_diff: c.percent_diff, se_diff: c.se_diff, days: c.days,
      first: { code: c.first.code, date: fmtDay(c.first.taken_at), level: c.first.level, percent: c.first.percent }, second: { code: c.second.code, date: fmtDay(c.second.taken_at), level: c.second.level, percent: c.second.percent },
      gained: c.gained.map((g) => ({ level: g.level, ar: g.statements })), issued_by: inp.issuedBy ? 'human reviewer' : null, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}
export async function issueGrowthCertificate(db: any, reportId: unknown, actor: { id: string; email: string }, site: string, env: NodeJS.ProcessEnv = process.env): Promise<{ ok: true; code: string; url: string; already: boolean } | { ok: false; error: string; status: number }> {
  const id = typeof reportId === 'string' && /^[0-9a-zA-Z-]{2,40}$/.test(reportId) ? reportId : ''; if (!id) return { ok: false, error: 'تقرير غير صالح', status: 400 };
  const { data: row } = await db.from('placement_reports').select(REPORT_COLS).eq('id', id).maybeSingle(); if (!row) return { ok: false, error: 'التقرير غير موجود', status: 404 };
  if (row.growth_vc_code) return { ok: true, code: String(row.growth_vc_code), url: `${site}/verify/vc?code=${encodeURIComponent(String(row.growth_vc_code))}`, already: true };
  const attempts = await attemptsByEmail(db, row.candidate_email); const target = attempts.find((a) => a.id === id); const prev = target ? pairFor(attempts, target) : null;
  if (!target || !prev) return { ok: false, error: 'لا محاولة سابقة تُقارَن بها — الشهادة تحتاج اختبارين', status: 409 };
  const cmp = compareAttempts(prev, target); if (!certificateAllowed(cmp.verdict)) return { ok: false, error: `لا تصدر شهادة نموّ هنا: الحكم «${VERDICT_AR[cmp.verdict].title}»`, status: 409 };
  const signer = signerFromEnv(env, site); if (!signer) return { ok: false, error: 'مفتاح التوقيع غير مضبوط بعد (VC_SIGNING_KEY)', status: 409 }; await ensureKeyRow(db, signer);
  const did = didWeb(site); const now = new Date(); let code = growthCode(); let ins: any = null;
  for (let i = 0; i < 4 && !ins; i += 1) {
    const r = await db.from('portal_vc_issuances').insert({ code, kind: 'credential', credential_id: null, user_id: null, email: target.email, full_name: target.name, title_ar: `شهادة النموّ — مِعيار · ${LEVEL_AR[cmp.first.level]} → ${LEVEL_AR[cmp.second.level]}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: null, issued_by: actor.id }).select('id,status_index').single();
    if (r.error) { if (String(r.error.code) === '23505') { code = growthCode(); continue; } return { ok: false, error: r.error.message, status: 500 }; } ins = r.data;
  }
  if (!ins) return { ok: false, error: 'تعذّر توليد رمز فريد', status: 500 };
  const vc = await signDocument(buildGrowthDoc({ code, name: target.name, email: target.email, cmp, site, did, now, statusIndex: Number(ins.status_index), issuedBy: actor.id }), signer, now);
  await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', ins.id);
  await db.from('placement_reports').update({ growth_vc_code: code, growth_vc_at: now.toISOString() }).eq('id', id);
  await db.from('audit_logs').insert({ actor_id: actor.id, actor_email: actor.email, actor_role: 'STAFF', action: 'miaar_growth_certificate', entity_type: 'miaar_report', entity_id: id, entity_label: 'شهادة النموّ', source: 'miaar-growth', metadata: { code, verdict: cmp.verdict, steps: cmp.steps, from: cmp.first.level, to: cmp.second.level } }).then(() => null, () => null);
  return { ok: true, code, url: `${site}/verify/vc?code=${encodeURIComponent(code)}`, already: false };
}
export const isGrowthCode = (v: unknown): v is string => typeof v === 'string' && /^ATH-G-[23456789A-HJKMNP-Z]{4}-[23456789A-HJKMNP-Z]{4}$/.test(v);
export { isLedgerLevel, LEVEL_AR, LEDGER_LEVELS };
