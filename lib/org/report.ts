// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P68 «تقرير القيادة» — صفحة واحدة تُقرأ في ثلاث دقائق وتُوقَّع
 *  الاسم الرسمي: التقرير الدوري الموقَّع لأثر التدريب على مستوى الجهة (Signed periodic leadership report on training impact)
 *  سبعة مقاطع بترتيب ثابت: الرأس · ما قرّرتم آخر مرّة · ثلاثة أرقام · خريطة المهارات · ما قاله الميدان · ثلاثة أسئلة للقيادة · الذيل
 *  القواعد: لا اسم شخص ولا رقم تدريبي في أي مقطع · k ≥ 5 · لا ذكاء اصطناعي (الأسئلة حتمية من فجوات البيانات) · «لم يُقس بعد» جزء من الوثيقة
 *  الختم: ATH-LR-XXXX-XXXX موقَّع Ed25519 (signReceipt) · القرار يُختم داخل الوثيقة (إعادة توقيع بنفس الرمز) · تقرير حيّ واحد لكل (جهة × فترة)
 */
import { randomBytes } from 'crypto';
import { signReceipt, sha256 } from '../vault/subject';
import { canonical } from '../shield/seal';
import { securityEvent } from '../shield/guard';
import { totals, rpcParams, satisfactionPct, type ImpactReport } from '../portal/impact';
import { rangeStats, kSafe, countAr } from '../org-impact/letter';
import { fieldSummaryOf } from '../calendar/registry';
import { MONTHS_AR, latestSeal } from '../shield/seal';
import { orgPolicy } from './policy';

type Db = any;
const K = 5;
const arr = <T = any>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
async function safe<T>(fn: () => Promise<any>, fb: T): Promise<T> { try { const r = await fn(); if (r && typeof r === 'object' && 'data' in r) return (r.data ?? fb) as T; return (r ?? fb) as T; } catch { return fb; } }
const chunk = <T,>(xs: T[], n = 200): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };

/* ───────────── الرمز والهضم ───────────── */
export const LR_PREFIX = 'ATH-LR';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function lrCode(rand: (n: number) => Buffer = randomBytes): string { const b = rand(8); let s = ''; for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length]; return `${LR_PREFIX}-${s.slice(0, 4)}-${s.slice(4)}`; }
export const isLrCode = (c: unknown) => /^ATH-LR-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(c || '').trim().toUpperCase());
export function lrDigest(body: any): string { const { proof: _p, hash: _h, ...base } = body || {}; void _p; void _h; return 'sha256:' + sha256(canonical(base)); }

/* ───────────── الفترة ───────────── */
export type ReportKind = 'quarter' | 'month' | 'custom' | 'since_last';
export const KIND_AR: Record<ReportKind, string> = { quarter: 'ربع سنة', month: 'شهر', custom: 'مدى مخصّص', since_last: 'منذ آخر تقرير' };
export const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const TZ_MS = 3 * 3600000;
export const todayRiyadh = (now = new Date()) => new Date(now.getTime() + TZ_MS).toISOString().slice(0, 10);
export const addDays = (k: string, n: number) => new Date(Date.parse(k + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
/** حدود ISO بتوقيت الرياض لمدى أيام [from, to] شاملًا */
export function periodBounds(from: string, to: string) { return { from: new Date(Date.parse(from + 'T00:00:00Z') - TZ_MS).toISOString(), to: new Date(Date.parse(to + 'T00:00:00Z') + 86400000 - TZ_MS).toISOString(), day_from: from, day_to: addDays(to, 1) }; }
export function quarterOf(day: string, offset = 0): { from: string; to: string; label_ar: string } {
  const [y, m] = day.split('-').map(Number); let q = Math.floor((m - 1) / 3) + offset; let yy = y; while (q < 0) { q += 4; yy--; } while (q > 3) { q -= 4; yy++; }
  const from = `${yy}-${String(q * 3 + 1).padStart(2, '0')}-01`; const endM = q * 3 + 3; const to = new Date(Date.UTC(endM === 12 ? yy + 1 : yy, endM === 12 ? 0 : endM, 0)).toISOString().slice(0, 10);
  return { from, to, label_ar: `الربع ${['الأول', 'الثاني', 'الثالث', 'الرابع'][q]} ${yy}` };
}
export const fmtDayAr = (k: string) => { const [y, m, d] = k.split('-').map(Number); return `${d} ${MONTHS_AR[(m || 1) - 1]} ${y}`; };
export function periodLabelAr(from: string, to: string, kind: ReportKind): string {
  if (kind === 'quarter') { const q = quarterOf(from); if (q.from === from && q.to === to) return q.label_ar; }
  if (kind === 'month' && from.endsWith('-01')) { const [y, m] = from.split('-').map(Number); if (to.slice(0, 7) === from.slice(0, 7)) return `${MONTHS_AR[m - 1]} ${y}`; }
  return `${fmtDayAr(from)} → ${fmtDayAr(to)}`;
}
export function validatePeriod(from: unknown, to: unknown, now = new Date()): string | null {
  if (!isDay(from) || !isDay(to)) return 'حدّد الفترة (من/إلى) بصيغة YYYY-MM-DD';
  if (from > to) return 'بداية الفترة بعد نهايتها'; if (from > todayRiyadh(now)) return 'الفترة في المستقبل';
  if (daysBetween(from, to) > 400) return 'الفترة أطول من سنة — اختر ربعًا أو فصلًا'; return null;
}

/* ───────────── القرارات الثمانية ───────────── */
export type DecisionTarget = 'transfer' | 'gain' | 'attendance' | null;
export type DecisionOption = { key: string; text_ar: string; target: DecisionTarget; why_ar: string };
export const DECISIONS: DecisionOption[] = [
  { key: 'protected_time', text_ar: 'وقت تطبيق أسبوعي محمي (ساعتان) لمن أنهى البرنامج', target: 'transfer', why_ar: 'أكثر ما يرفع الانتقال إلى الميدان: وقت مخصَّص لا ينافسه عمل آخر' },
  { key: 'buddy_supervisor', text_ar: 'مشرف مرافق لكل متدرّب في أوّل 30 يومًا بعد التدريب', target: 'transfer', why_ar: 'متابعة الأثر تُظهر أن تقدير المشرف يسبق تقدير المتدرّب' },
  { key: 'review_30', text_ar: 'اجتماع متابعة للقيادة بعد 30 يومًا لقراءة الانتقال', target: 'transfer', why_ar: 'سؤال واحد من القيادة في الوقت المناسب يغيّر السلوك' },
  { key: 'equipment', text_ar: 'توفير التجهيزات التي ذكرها الميدان عائقًا', target: 'transfer', why_ar: 'كثير من «لم أطبّق» سببه أداة ناقصة لا مهارة ناقصة' },
  { key: 'circular', text_ar: 'تعميم داخلي يعتمد الممارسة الجديدة إجراءً رسميًّا', target: 'transfer', why_ar: 'المهارة تبقى حين تصير إجراءً' },
  { key: 'second_cohort', text_ar: 'إلحاق دفعة ثانية بالبرنامج نفسه', target: 'gain', why_ar: 'الكسب المعياري مرتفع — يستحق أن يصل إلى الباقين' },
  { key: 'annual_eval', text_ar: 'دمج المهارة في التقييم السنوي للأداء', target: 'attendance', why_ar: 'ما يُقاس في السنة يُحضَر له في الأسبوع' },
  { key: 'custom', text_ar: 'قرار آخر', target: null, why_ar: 'سطر واحد بحدّ 140 حرفًا — يُختم كما هو' },
];
export const decisionOf = (key: unknown) => DECISIONS.find((d) => d.key === String(key || '')) || null;
export const NOTE_MAX = 140;
export const cleanNote = (v: unknown) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+|\S+@\S+\.\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);

/* ───────────── الوثيقة ───────────── */
export type Measure = { pct: number | null; n: number; note_ar: string | null };
export type ReportNumbers = {
  transfer: Measure & { supervisor: number | null; trainee: number | null };
  gain: Measure & { pre: number | null; post: number | null };
  attendance: Measure & { sessions: number };
  satisfaction: Measure;
};
export type ReportSkill = { name_ar: string; code: string; avg_level: number | null; learners: number; approved: number; proven: number };
export type ReportPrevious = { code: string; period_ar: string; decision_text_ar: string; decision_at: string; target: DecisionTarget; before: number | null; after: number | null; read_ar: string } | null;
export type ReportBody = {
  type: 'AtharLeadershipReport'; kind: 'leadership_report'; v: 1; code: string;
  organization: { id: string; name_ar: string; slug: string | null }; pseudonymous: boolean;
  period: { kind: ReportKind; from: string; to: string; label_ar: string };
  previous: ReportPrevious;
  numbers: ReportNumbers; lines_ar: string[];
  people: { members: number; pending: number; active: number | null; programs: number; learners: number };
  skills: ReportSkill[];
  field: { lines: string[]; people: number; sources_ar: string[]; note_ar: string | null };
  questions: string[];
  tail: { shield: { month_ar: string; code: string; passed_days: number; total_days: number } | null; policy_seal: { code: string; issued_at: string } | null; charter: { code: string | null; expires_at: string | null } | null; pledge: { title_ar: string; code: string | null } | null };
  issued: { at: string; name: string | null; title: string | null };
  decision: { key: string; text_ar: string; note_ar: string | null; target: DecisionTarget; at: string } | null;
  generated_at: string; proof?: unknown; hash?: string; issuer?: string; '@context'?: string; issued_at?: string;
};

const pctAr = (p: number | null) => (p === null ? '—' : `${Math.round(p)}%`);
const notMeasured = (when: string | null) => (when ? `لم يُقس بعد — يُقاس في ${fmtDayAr(when)}` : 'لم يُقس بعد');

/** الأرقام الثلاثة من تقرير الأثر (RPC) + حضور المنسوبين (k ≥ 5) */
export function numbersOf(r: ImpactReport | null, att: { pct: number | null; sessions: number; roster_people: number } | null, period: { to: string }): ReportNumbers {
  const t = r ? totals(r) : null; const ends = (r?.programs || []).map((p) => String(p.end_date || '')).filter(isDay).sort(); const lastEnd = ends.length ? ends[ends.length - 1] : period.to;
  const trN = num(t?.transfer.n); const trMean = t?.transfer.mean ?? null; const trPct = trN >= K && trMean !== null ? satisfactionPct(trMean) : null;
  const sup = (r?.programs || []).map((p) => p.transfer?.supervisor).filter((x): x is number => typeof x === 'number'); const tra = (r?.programs || []).map((p) => p.transfer?.trainee).filter((x): x is number => typeof x === 'number');
  const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
  const preN = num(t?.prepost.pre_n); const postN = num(t?.prepost.post_n); const gainOk = preN >= K && postN >= K && t?.prepost.improvement !== null && t?.prepost.improvement !== undefined;
  const satN = num(t?.satisfaction.n);
  return {
    transfer: { pct: trPct, n: trN, note_ar: trPct === null ? notMeasured(addDays(lastEnd, 30)) : null, supervisor: trPct === null ? null : mean(sup), trainee: trPct === null ? null : mean(tra) },
    gain: { pct: gainOk ? (t!.prepost.improvement as number) : null, n: Math.min(preN, postN), pre: gainOk ? t!.prepost.pre : null, post: gainOk ? t!.prepost.post : null, note_ar: gainOk ? null : (postN === 0 && preN > 0 ? `قِيس قبليًّا (${preN}) ولم يُقَس بعديًّا بعد` : notMeasured(null)) },
    attendance: { pct: att?.pct ?? null, n: att?.roster_people ?? 0, sessions: att?.sessions ?? 0, note_ar: att?.pct === null || att?.pct === undefined ? (att?.sessions ? 'جلسات دون قائمة مقيَّدين كافية (k ≥ 5)' : 'لا جلسات حضور في الفترة') : null },
    satisfaction: { pct: satN >= K ? (t!.satisfaction.pct ?? null) : null, n: satN, note_ar: satN >= K ? null : notMeasured(null) },
  };
}
/** «ثلاثة أرقام» — ثلاث جُمَل بالترتيب نفسه دائمًا */
export function threeLines(n: ReportNumbers): string[] {
  return [
    n.transfer.pct === null ? `الانتقال إلى الميدان: ${n.transfer.note_ar}.` : `الانتقال إلى الميدان ${pctAr(n.transfer.pct)} (متابعة الأثر لـ ${countAr(n.transfer.n, { one: 'متدرّب', two: 'متدرّبين', few: 'متدرّبين', many: 'متدرّبًا' })}${n.transfer.supervisor !== null && n.transfer.trainee !== null ? ` — تقدير المشرف ${n.transfer.supervisor} والمتدرّب ${n.transfer.trainee} من 5` : ''}).`,
    n.gain.pct === null ? `الكسب المعياري: ${n.gain.note_ar}.` : `الكسب المعياري ${n.gain.pct > 0 ? '+' : ''}${n.gain.pct}% (قبلي ${n.gain.pre} ← بعدي ${n.gain.post}، n=${n.gain.n}).`,
    n.attendance.pct === null ? `الالتزام بالحضور: ${n.attendance.note_ar}.` : `الالتزام بالحضور ${pctAr(n.attendance.pct)} عبر ${n.attendance.sessions === 1 ? 'جلسة واحدة' : countAr(n.attendance.sessions, { one: 'جلسة', two: 'جلستين', few: 'جلسات', many: 'جلسة' })} (${n.attendance.n} منسوبًا).`,
  ];
}
/** «ثلاثة أسئلة للقيادة» — حتمية من فجوات البيانات (لا ذكاء اصطناعي) */
export function questionsFor(inp: { numbers: ReportNumbers; skills: ReportSkill[]; programs: { name_ar: string; learners: number; post_n: number }[]; pending: number; pulse_replied_pct: number | null; field_people: number }): string[] {
  const n = inp.numbers; const qs: string[] = [];
  if (n.satisfaction.pct !== null && n.satisfaction.pct >= 80 && n.transfer.pct !== null && n.transfer.pct < 50) qs.push(`الرضا ${pctAr(n.satisfaction.pct)} والانتقال إلى الميدان ${pctAr(n.transfer.pct)} — ما الذي يمنع التطبيق بعد أن أعجبهم التدريب؟`);
  const withLearners = inp.programs.filter((p) => p.learners > 0); const noPost = withLearners.filter((p) => !p.post_n);
  if (withLearners.length && noPost.length) qs.push(`${countAr(noPost.length, { one: 'برنامج', two: 'برنامجان', few: 'برامج', many: 'برنامجًا' })} من ${withLearners.length} لم يُقَس بعديًّا — من يملك قرار القياس البعدي قبل التقرير التالي؟`);
  const top = inp.skills[0]; if (top && top.learners >= K && !top.proven) qs.push(`أعلى مهارة مكتسبة «${top.name_ar}» لم تُثبَت في الميدان بعد — أين فرصة التطبيق الأولى؟`);
  if (n.transfer.pct === null && n.gain.pct !== null) qs.push('قِيس الكسب ولم يُقَس الانتقال — من يفتح حملة متابعة الأثر (مشرف + متدرّب) بعد 30 يومًا؟');
  if (n.attendance.pct !== null && n.attendance.pct < 70) qs.push(`الالتزام بالحضور ${pctAr(n.attendance.pct)} — ما الذي ينافس وقت التدريب في جدول المنسوبين؟`);
  if (inp.pulse_replied_pct !== null && inp.pulse_replied_pct < 30) qs.push(`ردّ المنسوبون على ${Math.round(inp.pulse_replied_pct)}% فقط من كلمات مدرّبيهم — هل يعرفون أن الكلمة تصل؟`);
  if (inp.pending >= 1) qs.push(`${countAr(inp.pending, { one: 'طلب انضمام', two: 'طلبا انضمام', few: 'طلبات انضمام', many: 'طلب انضمام' })} ما زال معلّقًا — من يؤكّد المنسوبين الجدد؟`);
  if (inp.field_people < K) qs.push('الميدان لم يتكلّم بعد (أقلّ من خمسة كتبوا سطر تطبيق) — هل وُجد لهم وقت وشاشة ليكتبوا؟');
  qs.push('ما القرار الواحد الذي يجعل أضعف الأرقام الثلاثة يتحرّك قبل التقرير التالي؟');
  qs.push('أيّ منسوبيكم يحتاج مشرفًا مرافقًا هذا الشهر — وهل يعرف المشرف ذلك؟');
  return [...new Set(qs)].slice(0, 3);
}
/** قراءة «ما قرّرتم آخر مرّة»: الرقم المستهدَف قبل/بعد */
export function previousRead(prev: { code: string; period_ar: string; decision: { text_ar: string; target: DecisionTarget; at: string }; before: number | null }, numbers: ReportNumbers): ReportPrevious {
  const t = prev.decision.target; const after = t ? numbers[t].pct : null; const label = t === 'transfer' ? 'الانتقال إلى الميدان' : t === 'gain' ? 'الكسب المعياري' : t === 'attendance' ? 'الالتزام بالحضور' : null;
  const read = !label ? `قرّرتم في تقرير ${prev.period_ar}: «${prev.decision.text_ar}».` : prev.before === null && after === null ? `قرّرتم «${prev.decision.text_ar}» — و${label} لم يُقَس في الفترتين بعد.` : after === null ? `قرّرتم «${prev.decision.text_ar}» — و${label} كان ${pctAr(prev.before)} ولم يُقَس في هذه الفترة.` : prev.before === null ? `قرّرتم «${prev.decision.text_ar}» — و${label} يُقاس الآن لأوّل مرّة: ${pctAr(after)}.` : `قرّرتم «${prev.decision.text_ar}» — و${label} تحرّك من ${pctAr(prev.before)} إلى ${pctAr(after)}${after > prev.before ? ' ↑' : after < prev.before ? ' ↓' : ' (ثابت)'}.`;
  return { code: prev.code, period_ar: prev.period_ar, decision_text_ar: prev.decision.text_ar, decision_at: prev.decision.at, target: t, before: prev.before, after, read_ar: read };
}

/* ───────────── البناء من قاعدة البيانات ───────────── */
export type OrgLite = { id: string; name_ar: string; slug?: string | null };
export async function loadOrgLite(db: Db, orgId: string): Promise<(OrgLite & { logo: string | null; policy: any }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(String(orgId))) return null; const r = await safe<any>(() => db.from('portal_organizations').select('id,name_ar,slug,logo,policy').eq('id', orgId).maybeSingle(), null); return r || null;
}
export async function membersOf(db: Db, orgId: string): Promise<{ emails: Set<string>; ids: string[]; pending: number }> {
  const rows = await safe<any[]>(() => db.from('portal_org_members').select('email,user_id,status').eq('organization_id', orgId).in('status', ['confirmed', 'pending']).limit(5000), []);
  const conf = rows.filter((m) => m.status === 'confirmed'); return { emails: new Set(conf.map((m) => lower(m.email)).filter(Boolean)), ids: [...new Set(conf.map((m) => String(m.user_id || '')).filter(Boolean))], pending: rows.length - conf.length };
}
/** «ما قاله الميدان»: سطور التطبيق (P66) + سطور التخرّج العامة (P63) + سطور رسالة الشهر الموقَّعة (P52) — k ≥ 5 · بلا أسماء */
export async function fieldVoices(db: Db, orgId: string, ids: string[], bounds: { from: string; to: string; day_from: string; day_to: string }, seed: string): Promise<ReportBody['field']> {
  const lines: string[] = []; const sources = new Set<string>(); let people = 0;
  const apply: any[] = []; for (const part of chunk(ids)) apply.push(...await safe<any[]>(() => db.from('portal_learning_lines').select('user_id,body_ar,blocker_ar,day').in('user_id', part).eq('kind', 'apply').gte('day', bounds.day_from).lt('day', bounds.day_to).limit(2000), []));
  const fs = fieldSummaryOf(apply.map((l) => ({ user_id: String(l.user_id), body_ar: String(l.body_ar || ''), blocker_ar: l.blocker_ar || null, day: String(l.day) })), { k: K, show: 3, seed });
  people = fs.people; if (fs.shown) { fs.applied.slice(0, 3).forEach((s) => lines.push(s)); sources.add('سطور التطبيق الميداني'); if (fs.blockers_people >= K && fs.blockers[0]) { lines.push(`عائق تكرّر: ${fs.blockers[0]}`); } }
  const grads: any[] = []; for (const part of chunk(ids)) grads.push(...await safe<any[]>(() => db.from('portal_grad_pages').select('user_id,line_ar,sealed_at').in('user_id', part).eq('live_public', true).is('revoked_at', null).not('sealed_at', 'is', null).gte('sealed_at', bounds.from).lt('sealed_at', bounds.to).limit(1000), []));
  const gradPeople = new Set(grads.map((g) => String(g.user_id))); if (gradPeople.size >= K) { const pick = grads.map((g) => String(g.line_ar || '').trim()).filter((s) => s.length >= 8); shuffle(pick, seed).slice(0, 2).forEach((s) => lines.push(s)); if (pick.length) sources.add('صفحات التخرّج العامة'); }
  const letters = await safe<any[]>(() => db.from('portal_org_letters').select('body,month').eq('organization_id', orgId).eq('status', 'signed').gte('month', bounds.day_from.slice(0, 7)).lte('month', bounds.day_to.slice(0, 7)).order('month', { ascending: false }).limit(3), []);
  const ll = letters.flatMap((l) => arr<string>(l.body?.lines_ar)).filter(Boolean); if (ll.length) { lines.push(ll[0]); sources.add('رسالة الشهر الموقَّعة'); }
  return { lines: lines.slice(0, 5), people: Math.max(people, gradPeople.size), sources_ar: [...sources], note_ar: lines.length ? null : `الميدان لم يبلغ نصاب الظهور بعد (k ≥ ${K} كاتبًا) — لا يُعرض سطر واحد قبل ذلك حمايةً لصاحبه` };
}
function shuffle<T>(xs: T[], seed: string): T[] { let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } const out = [...xs]; for (let i = out.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; const j = h % (i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out; }

export type BuildOpts = { kind: ReportKind; from: string; to: string; code: string; issued: { name: string | null; title: string | null }; now?: Date };
/** بناء الوثيقة كاملة (بلا توقيع) — كل مقطع بأمان: إن سقط مصدر لا يسقط التقرير */
export async function buildLeadershipReport(db: Db, org: OrgLite & { policy?: any }, o: BuildOpts): Promise<ReportBody> {
  const now = o.now || new Date(); const bounds = periodBounds(o.from, o.to); const mem = await membersOf(db, org.id);
  const [impact, att, policy, prevRow, shield, pseal, charter, pledge] = await Promise.all([
    safe<ImpactReport | null>(async () => { const r = await db.rpc('portal_impact_report', rpcParams({ from: o.from, to: o.to, sector: '', skill: '', org: org.id })); return r?.data && typeof r.data === 'object' ? (r.data as ImpactReport) : null; }, null),
    safe(() => rangeStats(db, mem.emails, bounds), null as Awaited<ReturnType<typeof rangeStats>> | null),
    safe(() => orgPolicy(db, org.id), null as any),
    safe<any>(() => db.from('portal_org_reports').select('code,period_from,period_to,kind,body,decision,decision_at').eq('organization_id', org.id).eq('status', 'issued').not('decision', 'is', null).lt('period_from', o.from).order('period_to', { ascending: false }).limit(1).maybeSingle(), null),
    safe(() => latestSeal(db), null as Awaited<ReturnType<typeof latestSeal>>),
    safe<any>(() => db.from('portal_org_policy_seals').select('code,issued_at').eq('organization_id', org.id).order('issued_at', { ascending: false }).limit(1).maybeSingle(), null),
    safe<any>(() => db.from('portal_org_charters').select('vc_code,expires_at,status').eq('organization_id', org.id).eq('status', 'active').order('signed_at', { ascending: false }).limit(1).maybeSingle(), null),
    safe<any>(() => db.from('portal_org_horizon_pledges').select('title_ar,code,status').eq('organization_id', org.id).neq('status', 'revoked').order('created_at', { ascending: false }).limit(1).maybeSingle(), null),
  ]);
  const numbers = numbersOf(impact, att, { to: o.to }); const t = impact ? totals(impact) : null;
  const skills: ReportSkill[] = [...(impact?.skills || [])].filter((s) => num(s.learners) > 0).sort((a, b) => num(b.learners) - num(a.learners) || num(b.avg_level) - num(a.avg_level)).slice(0, 5)
    .map((s) => ({ name_ar: String(s.name_ar || s.name_en || s.code), code: String(s.code || ''), avg_level: s.avg_level ?? null, learners: num(s.learners), approved: num(s.approved), proven: num(s.proven) }));
  const field = await fieldVoices(db, org.id, mem.ids, bounds, o.code);
  let pulsePct: number | null = null; try { const { orgPulse } = await import('../org-impact/pulse'); const p = await orgPulse(db, mem.emails, { from: bounds.from, to: bounds.to }, { now }); pulsePct = p.k ? p.replied_pct : null; } catch { pulsePct = null; }
  const programs = (impact?.programs || []).map((p) => ({ name_ar: String(p.name_ar), learners: num(p.learners), post_n: num(p.prepost?.post_n) }));
  const questions = questionsFor({ numbers, skills, programs, pending: mem.pending, pulse_replied_pct: pulsePct, field_people: field.people });
  let previous: ReportPrevious = null;
  if (prevRow?.decision?.text_ar) { const pb = prevRow.body || {}; const tgt = (prevRow.decision.target || null) as DecisionTarget; const before = tgt && pb?.numbers?.[tgt] ? (pb.numbers[tgt].pct ?? null) : null; previous = previousRead({ code: prevRow.code, period_ar: String(pb?.period?.label_ar || periodLabelAr(prevRow.period_from, prevRow.period_to, prevRow.kind)), decision: { text_ar: String(prevRow.decision.text_ar), target: tgt, at: String(prevRow.decision_at || prevRow.decision.at || '') }, before }, numbers); }
  return {
    type: 'AtharLeadershipReport', kind: 'leadership_report', v: 1, code: o.code,
    organization: { id: org.id, name_ar: org.name_ar, slug: org.slug || null }, pseudonymous: !!policy?.pseudonymous,
    period: { kind: o.kind, from: o.from, to: o.to, label_ar: periodLabelAr(o.from, o.to, o.kind) },
    previous, numbers, lines_ar: threeLines(numbers),
    people: { members: mem.emails.size, pending: mem.pending, active: kSafe(num(att?.active)), programs: t?.programs ?? 0, learners: t?.learners ?? 0 },
    skills, field, questions,
    tail: { shield: shield ? { month_ar: monthAr(shield.month), code: shield.code, passed_days: shield.passed_days, total_days: shield.total_days } : null, policy_seal: pseal?.code ? { code: pseal.code, issued_at: pseal.issued_at } : null, charter: charter ? { code: charter.vc_code || null, expires_at: charter.expires_at || null } : null, pledge: pledge?.title_ar ? { title_ar: String(pledge.title_ar), code: pledge.code || null } : null },
    issued: { at: now.toISOString(), name: o.issued.name, title: o.issued.title }, decision: null, generated_at: now.toISOString(),
  };
}
const monthAr = (ym: string) => { const [y, m] = String(ym || '').split('-').map(Number); return m ? `${MONTHS_AR[m - 1]} ${y}` : String(ym || ''); };

/* ───────────── الإصدار · القرار · الإلغاء · التحقّق ───────────── */
export type Who = { id: string; email?: string | null; name?: string | null };
export type ReportRow = { id: number; organization_id: string; code: string; kind: ReportKind; period_from: string; period_to: string; status: 'issued' | 'revoked'; issued_at: string; issued_name: string | null; issued_title: string | null; body: ReportBody; digest: string; decision: any; decision_at: string | null; reissued_from: number | null; revoked_at: string | null };
const ROW_COLS = 'id,organization_id,code,kind,period_from,period_to,status,issued_at,issued_name,issued_title,body,digest,decision,decision_at,reissued_from,revoked_at';
const cleanName = (v: unknown) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;

async function sign(body: ReportBody, env?: Record<string, string | undefined>, site?: string): Promise<ReportBody> { const { proof: _p, hash: _h, issuer: _i, '@context': _c, issued_at: _a, ...base } = body as any; void _p; void _h; void _i; void _c; void _a; return (await signReceipt(base, env || process.env, site)) as ReportBody; }

export async function issueReport(db: Db, p: { org_id: string; kind: unknown; from: unknown; to: unknown; name?: unknown; title?: unknown; by: Who; env?: Record<string, string | undefined>; site?: string; rand?: (n: number) => Buffer; now?: Date }): Promise<{ ok: true; row: ReportRow; replaced: string | null } | { ok: false; error: string; status?: number }> {
  const org = await loadOrgLite(db, p.org_id); if (!org) return { ok: false, error: 'الجهة غير موجودة', status: 404 };
  const kind: ReportKind = (['quarter', 'month', 'custom', 'since_last'] as const).includes(p.kind as any) ? (p.kind as ReportKind) : 'custom';
  const err = validatePeriod(p.from, p.to, p.now); if (err) return { ok: false, error: err };
  const from = String(p.from); const to = String(p.to); const code = lrCode(p.rand); const now = p.now || new Date();
  const live = await safe<any>(() => db.from('portal_org_reports').select('id,code').eq('organization_id', org.id).eq('status', 'issued').eq('period_from', from).eq('period_to', to).maybeSingle(), null);
  const draft = await buildLeadershipReport(db, org, { kind, from, to, code, issued: { name: cleanName(p.name), title: cleanName(p.title) }, now });
  const body = await sign(draft, p.env, p.site); const digest = lrDigest(body);
  if (live?.id) await db.from('portal_org_reports').update({ status: 'revoked', revoked_at: now.toISOString() }).eq('id', live.id);
  const ins = await db.from('portal_org_reports').insert({ organization_id: org.id, code, kind, period_from: from, period_to: to, status: 'issued', issued_at: now.toISOString(), issued_by: p.by.id, issued_name: cleanName(p.name), issued_title: cleanName(p.title), body, digest, reissued_from: live?.id ?? null }).select(ROW_COLS).maybeSingle();
  if (ins?.error || !ins?.data) return { ok: false, error: String(ins?.error?.message || 'تعذّر حفظ التقرير').slice(0, 160), status: 500 };
  await securityEvent(db, { severity: 'info', kind: 'org_report_issued', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { org_id: org.id, org: org.name_ar, code, period: `${from}..${to}`, replaced: live?.code || null } }, p.env || process.env).catch(() => null);
  return { ok: true, row: ins.data as ReportRow, replaced: live?.code || null };
}
export async function decideReport(db: Db, p: { code: unknown; key: unknown; note_ar?: unknown; by: Who; env?: Record<string, string | undefined>; site?: string; now?: Date }): Promise<{ ok: true; row: ReportRow } | { ok: false; error: string; status?: number }> {
  const code = String(p.code || '').trim().toUpperCase(); if (!isLrCode(code)) return { ok: false, error: 'رمز غير صالح' };
  const row = await safe<any>(() => db.from('portal_org_reports').select(ROW_COLS).eq('code', code).maybeSingle(), null); if (!row) return { ok: false, error: 'التقرير غير موجود', status: 404 };
  if (row.status !== 'issued') return { ok: false, error: 'هذا التقرير مُلغى — القرار يُختم على التقرير الحيّ', status: 409 };
  if (row.decision) return { ok: false, error: 'قرارٌ واحد يكفي — خُتم قرار على هذا التقرير من قبل (أعد الإصدار إن أردت قرارًا جديدًا)', status: 409 };
  const opt = decisionOf(p.key); if (!opt) return { ok: false, error: 'اختر قرارًا من القائمة' }; const note = cleanNote(p.note_ar); if (opt.key === 'custom' && note.length < 8) return { ok: false, error: 'اكتب القرار في سطر (8 أحرف على الأقلّ)' };
  const now = (p.now || new Date()).toISOString(); const decision = { key: opt.key, text_ar: opt.key === 'custom' ? note : opt.text_ar, note_ar: opt.key === 'custom' ? null : note || null, target: opt.target, at: now };
  const body = await sign({ ...(row.body as ReportBody), decision }, p.env, p.site); const digest = lrDigest(body);
  const up = await db.from('portal_org_reports').update({ body, digest, decision, decision_at: now, decision_by: p.by.id }).eq('id', row.id).select(ROW_COLS).maybeSingle();
  if (up?.error || !up?.data) return { ok: false, error: String(up?.error?.message || 'تعذّر ختم القرار').slice(0, 160), status: 500 };
  await securityEvent(db, { severity: 'info', kind: 'org_report_decided', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { org_id: row.organization_id, code, decision: decision.key } }, p.env || process.env).catch(() => null);
  return { ok: true, row: up.data as ReportRow };
}
export async function revokeReport(db: Db, code: unknown, by: Who, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  const c = String(code || '').trim().toUpperCase(); if (!isLrCode(c)) return { ok: false, error: 'رمز غير صالح' };
  const { error } = await db.from('portal_org_reports').update({ status: 'revoked', revoked_at: now.toISOString() }).eq('code', c).eq('status', 'issued'); void by; return error ? { ok: false, error: String(error.message || error) } : { ok: true };
}
export async function listReports(db: Db, orgId: string, limit = 24): Promise<Omit<ReportRow, 'body'>[]> {
  const rows = await safe<any[]>(() => db.from('portal_org_reports').select('id,organization_id,code,kind,period_from,period_to,status,issued_at,issued_name,issued_title,digest,decision,decision_at,reissued_from,revoked_at').eq('organization_id', orgId).order('issued_at', { ascending: false }).limit(limit), []); return rows;
}
export async function reportByCode(db: Db, code: unknown): Promise<ReportRow | null> { const c = String(code || '').trim().toUpperCase(); if (!isLrCode(c)) return null; return await safe<any>(() => db.from('portal_org_reports').select(ROW_COLS).eq('code', c).maybeSingle(), null); }
/** الفترة المقترَحة «منذ آخر تقرير»: اليوم التالي لآخر تقرير حيّ → اليوم؛ وإن لم يوجد → الربع الحالي */
export async function suggestPeriod(db: Db, orgId: string, now = new Date()): Promise<{ kind: ReportKind; from: string; to: string; label_ar: string }> {
  const today = todayRiyadh(now); const last = await safe<any>(() => db.from('portal_org_reports').select('period_to').eq('organization_id', orgId).eq('status', 'issued').order('period_to', { ascending: false }).limit(1).maybeSingle(), null);
  if (last?.period_to && last.period_to < today) { const from = addDays(String(last.period_to), 1); return { kind: 'since_last', from, to: today, label_ar: periodLabelAr(from, today, 'since_last') }; }
  const q = quarterOf(today); return { kind: 'quarter', from: q.from, to: q.to < today ? q.to : today, label_ar: q.label_ar };
}

/* ───────────── التحقّق العام ───────────── */
export type VerifyOut = { valid: boolean; intact?: boolean; status?: 'issued' | 'revoked'; superseded?: boolean; minimal?: boolean; report?: { code: string; organization: string; period_ar: string; period_from: string; period_to: string; issued_at: string; signed: boolean; decision_ar: string | null; decision_at: string | null; lines_ar: string[]; pseudonymous: boolean } };
export async function verifyReport(db: Db, code: unknown): Promise<VerifyOut> {
  const row = await reportByCode(db, code); if (!row) return { valid: false };
  const org = await loadOrgLite(db, row.organization_id); const minimal = !!org?.policy?.verify_minimal;
  const newer = await safe<any[]>(() => db.from('portal_org_reports').select('id').eq('reissued_from', row.id).eq('status', 'issued').limit(1), []);
  const b = row.body || ({} as ReportBody);
  return { valid: true, intact: lrDigest(b) === row.digest, status: row.status, superseded: newer.length > 0 || row.status === 'revoked', minimal, report: { code: row.code, organization: String(b.organization?.name_ar || org?.name_ar || ''), period_ar: String(b.period?.label_ar || ''), period_from: row.period_from, period_to: row.period_to, issued_at: row.issued_at, signed: !!(b as any).proof, decision_ar: minimal ? null : (b.decision?.text_ar || null), decision_at: minimal ? null : (row.decision_at || null), lines_ar: minimal ? [] : arr<string>(b.lines_ar), pseudonymous: !!b.pseudonymous } };
}
/** سطر /me: «قيادتك قرأت تقرير <الفترة> وقرّرت: …» — لأحدث قرار في جهات المنسوب (آخر 120 يومًا) */
export async function leadershipLineFor(db: Db, me: { id: string; email: string }, now = new Date()): Promise<{ org_name: string; period_ar: string; decision_ar: string; decided_at: string; code: string } | null> {
  const ms = await safe<any[]>(() => db.from('portal_org_members').select('organization_id').eq('status', 'confirmed').or(`user_id.eq.${me.id},email.ilike.${lower(me.email)}`).limit(20), []);
  const orgIds = [...new Set(ms.map((m) => String(m.organization_id)).filter(Boolean))]; if (!orgIds.length) return null;
  const since = new Date(now.getTime() - 120 * 86400000).toISOString();
  const rows = await safe<any[]>(() => db.from('portal_org_reports').select('code,organization_id,body,decision,decision_at').in('organization_id', orgIds).eq('status', 'issued').not('decision', 'is', null).gte('decision_at', since).order('decision_at', { ascending: false }).limit(1), []);
  const r = rows[0]; if (!r?.decision?.text_ar) return null;
  return { org_name: String(r.body?.organization?.name_ar || ''), period_ar: String(r.body?.period?.label_ar || ''), decision_ar: String(r.decision.text_ar), decided_at: String(r.decision_at || r.decision.at || ''), code: String(r.code) };
}
export const leadershipLineAr = (l: { org_name: string; period_ar: string; decision_ar: string }) => `قيادتك في «${l.org_name}» قرأت تقرير ${l.period_ar} وقرّرت: ${l.decision_ar}`;
