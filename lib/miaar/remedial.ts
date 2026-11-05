// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م6-ج «جلسة التعويض — من خريطة المنهج» (Remediation session) — مِعيار — من أَثَر
 *  تحويل «درس التعويض المقترح» في لوحة العبور إلى جلسة مراجعة حقيقية في تقويم البرنامج (portal_sessions بنوع remedial):
 *   - الوحدات الحمراء مُحدَّدة مسبقًا (≤ 3) · الموعد الافتراضي أقرب يوم عمل 10:00 بتوقيت الرياض · 60 دقيقة · منصّة القاعة ومدرّسها.
 *   - خطّة درس مسوَّدة تُبنى محليًّا من تركيز الوحدة وواصفاتها وأخطاء المجموعة الفعلية (بنود الجلسات)، ثم «حسّن الخطّة بالذكاء» اختياريًّا —
 *     لا يُحفظ شيء إلا ما يعتمده المدرّس.
 *   - المتعلّم يرى «جلسة مراجعة» تحت «وحدات تحتاج مراجعة» على بطاقة نتيجته (بلا كلمة ضعف ولا تعويض).
 *   - «أثر التعويض»: فرق نسبة الوحدة قبل/بعد إعادة المهارة للحاضرين مقابل غير الحاضرين — رقم واحد، بلا حكم آلي.
 *  المبدأ: الذكاء يقترح، الإنسان يعتمد، النتيجة الرسمية والشهادة لا تتغيّران.
 */
import type { Unit } from './syllabus';
import { isUnitCode, unitIndex, DOMAIN_AR } from './syllabus';
import type { UnitTally } from './syllabus';

export const REMEDIAL_KIND = 'remedial' as const;
export const REMEDIAL_TITLE = { ar: 'جلسة التعويض — من خريطة المنهج', en: 'Remediation session' } as const;
export const LEARNER_TITLE = { ar: 'جلسة مراجعة', en: 'Review session' } as const;
export const REMEDIAL_DEFAULT_MIN = 60; export const REMEDIAL_MIN_MIN = 30; export const REMEDIAL_MAX_MIN = 180; export const REMEDIAL_MAX_UNITS = 3;
export const REMEDIAL_PROVIDERS = ['teams', 'zoom', 'meet', 'athar', 'other'] as const;
export type RemedialProvider = (typeof REMEDIAL_PROVIDERS)[number];
const TZ_OFFSET_MS = 3 * 3600000; /* الرياض UTC+3 بلا توقيت صيفي */

/** أقرب يوم عمل (الأحد–الخميس) بعد «الآن» عند الساعة المحدَّدة بتوقيت الرياض — ISO */
export function nextWorkdayAt(now: Date, hour = 10): string {
  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  let d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, hour, 0, 0));
  for (let i = 0; i < 7; i += 1) { const wd = d.getUTCDay(); if (wd === 5 || wd === 6) d = new Date(d.getTime() + 86400000); else break; }
  return new Date(d.getTime() - TZ_OFFSET_MS).toISOString();
}

export const remedialTitle = (units: readonly Pick<Unit, 'code' | 'title_ar' | 'title_en'>[], lang: 'ar' | 'en' = 'ar'): string => {
  if (!units.length) return lang === 'ar' ? LEARNER_TITLE.ar : LEARNER_TITLE.en;
  const first = units[0]; const more = units.length - 1;
  const head = lang === 'ar' ? `${LEARNER_TITLE.ar} — ${first.title_ar}` : `${LEARNER_TITLE.en} — ${first.title_en || first.title_ar}`;
  return more > 0 ? `${head} ${lang === 'ar' ? `و${more === 1 ? 'وحدة أخرى' : `${more} وحدات أخرى`}` : `+${more}`}` : head;
};

/* ───────── أخطاء المجموعة الفعلية (من بنود الجلسات) ───────── */
export type ReportItem = { الرمز: string; المهارة: string; النص?: string; النتيجة: string };
export type Mistake = { code: string; n_wrong: number; n_total: number; by_skill: Record<string, number>; samples: string[] };
/** لكل وحدة مطلوبة: كم بندًا أُخطئ فيه عبر المجموعة، بأيّ مهارة، وأمثلة من نصوص البنود (≤ 3، مقتضبة) */
export function mistakesFor(reports: readonly { بنود_الجلسة?: ReportItem[] | null }[], unitsOfItem: ReadonlyMap<string, readonly string[]>, codes: readonly string[]): Mistake[] {
  const want = new Set(codes); const acc = new Map<string, Mistake>(); const seen = new Map<string, Set<string>>();
  for (const c of codes) { acc.set(c, { code: c, n_wrong: 0, n_total: 0, by_skill: {}, samples: [] }); seen.set(c, new Set()); }
  for (const r of reports) for (const it of r?.بنود_الجلسة || []) {
    const us = unitsOfItem.get(it.الرمز) || []; const wrong = it.النتيجة !== 'صحيح';
    for (const u of us) { if (!want.has(u)) continue; const m = acc.get(u)!; m.n_total += 1; if (!wrong) continue; m.n_wrong += 1; m.by_skill[it.المهارة] = (m.by_skill[it.المهارة] || 0) + 1;
      const s = String(it.النص || '').trim(); const sv = seen.get(u)!; if (s && !sv.has(it.الرمز) && m.samples.length < 3) { sv.add(it.الرمز); m.samples.push(s.slice(0, 90)); } }
  }
  return codes.map((c) => acc.get(c)!);
}

/* ───────── خطّة الدرس المحلية ───────── */
const SKILL_AR: Record<string, string> = { listening: 'الاستماع', reading: 'القراءة', grammar_vocab: 'المفردات والتراكيب', writing: 'الكتابة', speaking: 'التحدّث' };
const PHASES: Array<[string, number]> = [['تهيئة واسترجاع', 10], ['عرض مركَّز', 15], ['تدريب موجَّه', 20], ['تدريب حرّ وتطبيق', 10], ['تذكرة الخروج', 5]];
export type PlanInput = { units: readonly Unit[]; mistakes?: readonly Mistake[]; descriptors?: ReadonlyMap<string, string>; duration_min?: number; level?: string | null; group_label?: string | null };
/** خطّة 60 دقيقة (تُقاس على المدّة) بصيغة «## عنوان» و«- نقطة» — نفس صيغة تعليمات الاختبار فتُعرض في البثّ المباشر كما هي */
export function draftPlan(p: PlanInput): string {
  const dur = Math.max(REMEDIAL_MIN_MIN, Math.min(REMEDIAL_MAX_MIN, p.duration_min || REMEDIAL_DEFAULT_MIN)); const k = dur / 60;
  const units = p.units.slice(0, REMEDIAL_MAX_UNITS); if (!units.length) return '';
  const mk = new Map((p.mistakes || []).map((m) => [m.code, m])); const L: string[] = [];
  L.push(`## ${REMEDIAL_TITLE.ar}${p.level ? ` — المستوى ${p.level}` : ''}${p.group_label ? ` — ${p.group_label}` : ''}`);
  L.push(`- المدّة: ${dur} دقيقة · الوحدات: ${units.map((u) => `${u.code} «${u.title_ar}»`).join(' · ')}`);
  L.push('- الغاية: أن يثبت ما لم يثبت في اختبار نهاية المستوى — لا إعادة شرح الوحدة كاملة.');
  L.push('## الأهداف (من واصفات الوحدة)');
  for (const u of units) {
    const ds = u.descriptor_codes.map((c) => p.descriptors?.get(c)).filter((x): x is string => !!x);
    if (ds.length) for (const d of ds.slice(0, 2)) L.push(`- ${u.code}: ${d}`); else L.push(`- ${u.code}: ${u.focus_ar || u.title_ar}`);
  }
  const anyM = units.some((u) => (mk.get(u.code)?.n_wrong || 0) > 0);
  if (anyM) {
    L.push('## ما أخطأت فيه المجموعة فعلًا (من بنود الاختبار)');
    for (const u of units) { const m = mk.get(u.code); if (!m || !m.n_wrong) continue;
      const sk = Object.entries(m.by_skill).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${SKILL_AR[s] || s} (${n})`).join(' · ');
      L.push(`- ${u.code}: ${m.n_wrong} من ${m.n_total} إجابة غير صحيحة — ${sk || 'مهارات مختلفة'}`);
      for (const s of m.samples) L.push(`- نموذج: «${s}»`); }
  }
  L.push('## سير الجلسة');
  let t = 0; PHASES.forEach(([name, base], i) => { const last = i === PHASES.length - 1; const mins = last ? Math.max(3, dur - t) : Math.max(3, Math.round(base * k)); const a = t; t += mins; L.push(`- ${a}–${t} د · ${name}: ${phaseHint(name, units, mk)}`); });
  L.push('## تذكرة الخروج (3 أسئلة قصيرة بنوع البنود الضعيفة)');
  units.forEach((u, i) => L.push(`- س${i + 1} — ${u.code}: سؤال واحد من نمط البنود التي أُخطئ فيها، يُجاب في دقيقة.`));
  L.push('## بعد الجلسة');
  L.push('- يفتح المتعلّم «أعد المهارة» من بطاقته خلال 14 يومًا؛ وتقيس اللوحة «أثر التعويض» للحاضرين مقابل غير الحاضرين.');
  L.push('- النتيجة الرسمية والشهادة كما هما — الجلسة تعويض لا إعادة حكم.');
  return L.join('\n');
}
function phaseHint(name: string, units: readonly Unit[], mk: ReadonlyMap<string, Mistake>): string {
  const u0 = units[0]; const m0 = mk.get(u0.code);
  switch (name) {
    case 'تهيئة واسترجاع': return `سؤال افتتاحي من سياق «${u0.title_ar}» يُجيب عنه الجميع شفهيًّا؛ لا تصحيح الآن.`;
    case 'عرض مركَّز': return `النقطة الواحدة التي سقطت: ${u0.focus_ar || u0.title_ar}${m0?.samples[0] ? ` — انطلق من النموذج «${m0.samples[0]}»` : ''}.`;
    case 'تدريب موجَّه': return `ثنائيات: ${Math.max(4, units.length * 3)} بنود جديدة على نمط الأخطاء، مع تغذية راجعة فورية بعد كل بندين.`;
    case 'تدريب حرّ وتطبيق': return `موقف قصير من مجال الوحدة (${(u0.domains || []).map((d) => DOMAIN_AR[d] || d).join('/') || 'شخصي'}) يُنتج فيه المتعلّم الجملة بنفسه.`;
    default: return 'ثلاثة أسئلة فردية؛ تُجمع النتائج لتُقارن لاحقًا بإعادة المهارة.';
  }
}

/* ───────── التحقّق ───────── */
export type CreateInput = { invite_id: string; unit_codes: string[]; starts_at: string; duration_min: number; provider: RemedialProvider; join_url: string | null; trainer_id: string | null; title_ar: string; description_ar: string };
export function validateCreate(b: any, allowed: ReadonlySet<string>, now = new Date()): { ok: true; value: CreateInput } | { ok: false; error: string } {
  const invite_id = String(b?.invite_id || ''); if (!invite_id) return { ok: false, error: 'الدعوة مطلوبة' };
  const raw = Array.isArray(b?.unit_codes) ? b.unit_codes.map(String) : []; const unit_codes: string[] = [...new Set<string>(raw.filter((c: string) => isUnitCode(c) && allowed.has(c)))];
  if (!unit_codes.length) return { ok: false, error: 'اختر وحدة واحدة على الأقل من وحدات هذا المستوى' }; if (unit_codes.length > REMEDIAL_MAX_UNITS) return { ok: false, error: `حتى ${REMEDIAL_MAX_UNITS} وحدات في الجلسة الواحدة` };
  const starts = new Date(String(b?.starts_at || '')); if (Number.isNaN(starts.getTime())) return { ok: false, error: 'الموعد غير صالح' };
  if (starts.getTime() < now.getTime() - 5 * 60000) return { ok: false, error: 'الموعد في الماضي' }; if (starts.getTime() > now.getTime() + 120 * 86400000) return { ok: false, error: 'الموعد أبعد من 120 يومًا' };
  const duration_min = Math.round(Number(b?.duration_min) || REMEDIAL_DEFAULT_MIN); if (duration_min < REMEDIAL_MIN_MIN || duration_min > REMEDIAL_MAX_MIN) return { ok: false, error: `المدّة بين ${REMEDIAL_MIN_MIN} و${REMEDIAL_MAX_MIN} دقيقة` };
  const provider = String(b?.provider || 'teams') as RemedialProvider; if (!(REMEDIAL_PROVIDERS as readonly string[]).includes(provider)) return { ok: false, error: 'منصّة غير معروفة' };
  const join_url = String(b?.join_url || '').trim() || null; if (join_url && !/^https?:\/\/\S+$/i.test(join_url)) return { ok: false, error: 'رابط الانضمام يجب أن يبدأ بـ https://' };
  if (provider !== 'athar' && !join_url && provider !== 'other') { /* مسموح بلا رابط: يُضاف لاحقًا من البثّ المباشر */ }
  const trainer_id = String(b?.trainer_id || '').trim() || null;
  const title_ar = String(b?.title_ar || '').replace(/\s+/g, ' ').trim().slice(0, 140); if (title_ar.length < 4) return { ok: false, error: 'عنوان الجلسة قصير' };
  const description_ar = String(b?.description_ar || '').trim().slice(0, 6000);
  return { ok: true, value: { invite_id, unit_codes, starts_at: starts.toISOString(), duration_min, provider, join_url, trainer_id, title_ar, description_ar } };
}

/* ───────── أثر التعويض ───────── */
export type EffectIn = { email: string; before: UnitTally | null | undefined; after: UnitTally | null | undefined; attended: boolean };
export type Effect = { code: string; attended: { n: number; delta: number | null }; others: { n: number; delta: number | null }; n_retakes: number };
const pct = (t: UnitTally | null | undefined, code: string): number | null => { const r = t?.[code]; return r && r.n ? Math.max(0, Math.min(100, Math.round((r.correct / r.n) * 100))) : null; };
/** لكل وحدة: متوسّط (بعد − قبل) للحاضرين وغير الحاضرين ممّن أعادوا المهارة وظهرت الوحدة في الإعادة */
export function effectFor(rows: readonly EffectIn[], codes: readonly string[]): Effect[] {
  return codes.map((code) => {
    const a: number[] = []; const o: number[] = []; let n = 0;
    for (const r of rows) { const b = pct(r.before, code); const af = pct(r.after, code); if (b === null || af === null) continue; n += 1; (r.attended ? a : o).push(af - b); }
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
    return { code, attended: { n: a.length, delta: avg(a) }, others: { n: o.length, delta: avg(o) }, n_retakes: n };
  });
}
export const effectText = (e: Effect, title: string): string => {
  if (!e.n_retakes) return `${title}: لا إعادات بعد.`;
  const a = e.attended.delta === null ? '—' : `${e.attended.delta >= 0 ? '+' : ''}${e.attended.delta}`; const o = e.others.delta === null ? '—' : `${e.others.delta >= 0 ? '+' : ''}${e.others.delta}`;
  return `${title}: الحاضرون ${a} نقطة (${e.attended.n}) · غير الحاضرين ${o} نقطة (${e.others.n}).`;
};

/* ───────── ربط وحدات البرنامج بوحدات المستوى (اقتراح محلي) ───────── */
const STOP = new Set(['في', 'من', 'على', 'إلى', 'عن', 'و', 'أو', 'ثم', 'مع', 'the', 'and', 'of', 'in', 'a', 'to', 'الوحدة', 'وحدة', 'مقدمة', 'مقدّمة']);
const toks = (s: string): string[] => String(s || '').toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).map((w) => w.replace(/^(ال|و|ب|ل|ف|ك)/, '')).filter((w) => w.length > 1 && !STOP.has(w));
/** اقتراح وحدات المستوى لوحدة برنامجية بتطابق كلمات العنوان/الناتج مع عنوان الوحدة وتركيزها — ≤ 3، بلا ذكاء */
export function suggestProgramLinks(title: string, outcome: string, levelUnits: readonly Unit[]): Array<{ code: string; title_ar: string; score: number }> {
  const a = new Set([...toks(title), ...toks(outcome)]); if (!a.size) return [];
  return levelUnits.filter((u) => u.status === 'approved').map((u) => { const b = new Set([...toks(u.title_ar), ...toks(u.focus_ar), ...toks(u.title_en)]); let hit = 0; for (const w of a) if (b.has(w)) hit += 1; return { code: u.code, title_ar: u.title_ar, score: hit }; })
    .filter((x) => x.score > 0).sort((x, y) => y.score - x.score || x.code.localeCompare(y.code)).slice(0, 3);
}
/** «الوحدة البرنامجية المقابلة» لوحدة مستوى حمراء — من ربط portal_program_units.miaar_unit_codes */
export function programUnitFor(code: string, programUnits: readonly { idx: number; title_ar: string; miaar_unit_codes?: string[] | null; starts_on?: string | null }[]): { idx: number; title_ar: string; starts_on: string | null } | null {
  const u = programUnits.find((p) => (p.miaar_unit_codes || []).includes(code)); return u ? { idx: u.idx, title_ar: u.title_ar, starts_on: u.starts_on || null } : null;
}

/* ───────── قاعدة البيانات ───────── */
type Db = any;
export const SESSION_COLS = 'id, created_at, program_id, classroom_id, trainer_id, kind, title_ar, title_en, description_ar, starts_at, duration_min, provider, join_url, status, miaar_unit_codes, source_invite_id';
export async function listRemedials(db: Db, inviteId: string): Promise<any[]> {
  try { const { data, error } = await db.from('portal_sessions').select(SESSION_COLS).eq('source_invite_id', inviteId).neq('status', 'cancelled').order('starts_at', { ascending: true }).limit(20); return error ? [] : (data || []); } catch { return []; }
}
/** م9: جلسات التعويض لدعوة مع عدد المنضمّين وأثر كل وحدة (مشترك بين لوحة المدرّب وبوابة الجهة وملف الاعتماد) */
export async function sessionsWithEffect(db: Db, inviteId: string, titles: ReadonlyMap<string, string>): Promise<any[]> {
  const sessions = await listRemedials(db, inviteId); if (!sessions.length) return [];
  const joinedMap = await joinedEmails(db, sessions.map((s: any) => String(s.id))); const ba = await beforeAfterRows(db, inviteId);
  return sessions.map((s: any) => { const codes: string[] = Array.isArray(s.miaar_unit_codes) ? s.miaar_unit_codes : [];
    const eff = effectFor(ba.map((r) => ({ email: r.email, before: r.before, after: r.after, attended: joinedMap.get(String(s.id))?.has(r.email) || false })), codes);
    return { ...s, joined: joinedMap.get(String(s.id))?.size || 0, effect: eff.map((e) => ({ ...e, title_ar: titles.get(e.code) || e.code, text: effectText(e, titles.get(e.code) || e.code) })) }; });
}
/** جلسات المراجعة التي تخصّ بطاقة متعلّم: دعوته + وحدة من وحداته — تُعرض بلا بيانات شخصية */
export async function remedialsForLearner(db: Db, inviteId: string | null, codes: readonly string[]): Promise<Array<{ id: string; title_ar: string; starts_at: string; duration_min: number; provider: string; join_url: string | null; units: string[]; status: string }>> {
  if (!inviteId || !codes.length) return [];
  const rows = await listRemedials(db, inviteId); const want = new Set(codes);
  return rows.filter((s: any) => (s.miaar_unit_codes || []).some((c: string) => want.has(c))).map((s: any) => ({ id: s.id, title_ar: s.title_ar, starts_at: s.starts_at, duration_min: s.duration_min, provider: s.provider, join_url: s.provider === 'athar' ? null : (s.join_url || null), units: s.miaar_unit_codes || [], status: s.status }));
}
/** من انضمّ فعلًا (حدث joined في سجلّ التعلّم) — بريد صغير الحروف */
export async function joinedEmails(db: Db, sessionIds: readonly string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>(); if (!sessionIds.length) return out;
  try { const { data } = await db.from('portal_learning_events').select('object_id, email').eq('verb', 'joined').eq('object_type', 'session').in('object_id', sessionIds).limit(5000);
    for (const r of (data || []) as any[]) { const e = String(r.email || '').toLowerCase(); if (!e) continue; const s = out.get(r.object_id) || new Set<string>(); s.add(e); out.set(r.object_id, s); } } catch { /* اختياري */ }
  return out;
}
/** «قبل/بعد» لكل متعلّم في دعوة عبور: حصيلة وحدات التقرير الأصلي ← حصيلة آخر إعادة مهارة (دعوة retake_of). بلا حضور — يضيفه المستدعي لكل جلسة */
export async function beforeAfterRows(db: Db, inviteId: string): Promise<Array<{ email: string; before: UnitTally | null; after: UnitTally | null; report_id: string }>> {
  try {
    const { data: origs } = await db.from('placement_reports').select('id, candidate_email, report').eq('invite_id', inviteId).limit(500); const os: any[] = Array.isArray(origs) ? origs : [];
    if (!os.length) return [];
    const { data: rinv } = await db.from('placement_invites').select('id, retake_of').in('retake_of', os.map((o) => o.id)).limit(500); const ri: any[] = Array.isArray(rinv) ? rinv : [];
    const afterOf = new Map<string, UnitTally | null>();
    if (ri.length) {
      const { data: rreps } = await db.from('placement_reports').select('invite_id, report, created_at').in('invite_id', ri.map((r) => r.id)).limit(500); const rr: any[] = Array.isArray(rreps) ? rreps : [];
      const byInvite = new Map<string, any>(); for (const r of rr.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) byInvite.set(r.invite_id, r); /* آخر إعادة */
      for (const r of ri) { const rep = byInvite.get(r.id); if (rep) afterOf.set(r.retake_of, rep.report?.الوحدات || null); }
    }
    return os.map((o) => ({ email: String(o.candidate_email || '').toLowerCase(), before: o.report?.الوحدات || null, after: afterOf.get(o.id) || null, report_id: String(o.id) }));
  } catch { return []; }
}
export const unitsOfItemMap = (pool: readonly { code: string; unitCodes?: string[] | null }[]): Map<string, string[]> => { const m = new Map<string, string[]>(); for (const i of pool) if (i.unitCodes?.length) m.set(i.code, i.unitCodes); return m; };
export const titlesOf = (codes: readonly string[], units: readonly Unit[]): Unit[] => { const ix = unitIndex(units); return codes.map((c) => ix.get(c)).filter((u): u is Unit => !!u); };

/* ───────── الذكاء (اختياري، باعتماد بشري) ───────── */
export const PLAN_SYSTEM = 'أنت مصمّم تعليمي لتعليم العربية لغةً ثانية وفق الإطار الأوروبي المرجعي. تُعيد كتابة خطّة جلسة مراجعة قصيرة بالعربية الفصحى الواضحة، بسياق سعودي/عربي معاصر، للمدرّس لا للمتعلّم. حافظ على الصيغة: أسطر تبدأ بـ "## " للعناوين و"- " للنقاط فقط، وعلى المدّة والأقسام والأهداف نفسها، واجعل الأنشطة أدقّ وأكثر قابلية للتنفيذ، ولا تضف وحدات أو أهدافًا جديدة. لا تذكر الذكاء الاصطناعي.';
export const planPrompt = (draft: string, level: string | null): string => `المستوى: ${level || '—'}\nالخطّة الحالية:\n${draft}\n\nأعد الخطّة محسَّنة بالصيغة نفسها (≤ 60 سطرًا).`;
export function parsePlan(raw: string): string | null { const s = String(raw || '').replace(/```[a-z]*\n?/gi, '').trim(); if (s.length < 80) return null; const lines = s.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim()); const ok = lines.filter((l) => /^(## |- )/.test(l.trim())).length / lines.length; return ok >= 0.7 ? lines.slice(0, 80).join('\n').slice(0, 6000) : null; }

/* ───────── P39: جمهور إشعار جلسة التعويض ───────── */
export type AudienceRow = { email: string; report_id?: string | null; user_id?: string | null; exit?: any };
/** من يُبلَّغ بالجلسة؟ كل من تقاطعت وحداته الضعيفة/المراقبة مع وحدات الجلسة؛ وإن لم تتوفّر خريطة وحدات له: من لم يجتز أو اجتاز بشرط. صافية (قابلة للاختبار). */
export function remedialAudience(rows: readonly AudienceRow[], unitCodes: readonly string[]): AudienceRow[] {
  const want = new Set(unitCodes.map((c) => String(c).toUpperCase())); const seen = new Set<string>(); const out: AudienceRow[] = [];
  for (const r of rows) {
    const email = String(r.email || '').trim().toLowerCase(); if (!email || seen.has(email) || !r.report_id || !r.exit) continue;
    const units = Array.isArray(r.exit?.الوحدات) ? r.exit.الوحدات : [];
    const hit = units.length ? units.some((u: any) => want.has(String(u?.الرمز || '').toUpperCase()) && (u?.الحالة === 'weak' || u?.الحالة === 'watch')) : (r.exit?.النتيجة === 'failed' || r.exit?.النتيجة === 'conditional');
    if (!hit) continue; seen.add(email); out.push({ ...r, email });
  }
  return out;
}
