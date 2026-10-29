// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — منظومة التحسين المستمر القائمة على الأدلة «الحلقة المغلقة» (P15) — منطق نقي بلا شبكة
//   الذاكرة (قاعدة الأدلة) تُغذّي: هندسة البرامج (فجوات حقيقية) · الميسِّر الحي (بطاقة الصف) · المهمات (إغلاق أضعف قناة)
//   · الجهات («مؤشر الأداء» = توقّع القدرة المؤسسية 90 يومًا) · ثم تتعلم من قرارات الإنسان.
//   كل اقتراح يحمل برهانه، أو يقول «لا دليل كافٍ بعد». الإنسان يعتمد.
import type { Graph, GraphEdge } from './evidence';
import { PUBLIC_MIN_PEOPLE, CHANNEL_LABEL, evN, peopleN, learnerN, arCount } from './evidence';
export const ideaN = (n: number) => arCount(n, 'فكرة واحدة', 'فكرتين', 'أفكار', 'فكرة', 'فكرة');
export const skillN = (n: number) => arCount(n, 'مهارة واحدة', 'مهارتان', 'مهارات', 'مهارة', 'مهارة');
export const decisionN = (n: number) => arCount(n, 'قرار واحد', 'قراران', 'قرارات', 'قرارًا', 'قرار');
import { evidenceFromEvent } from './profile';
import type { LearningEventRow } from './profile';

export type SuggestionKind = 'program' | 'mission' | 'session_focus' | 'org_step';
export type Chain = { label: string; value: string };
export type Suggestion = { kind: SuggestionKind; fingerprint: string; title_ar: string; why_ar: string; evidence: Chain[]; target: Record<string, unknown>; score: number };
export const KIND_LABEL_AR: Record<SuggestionKind, string> = { program: 'برنامج من فجوة', mission: 'مهمة تُغلق قناة', session_focus: 'تركيز جلسة', org_step: 'خطوة للجهة' };
export const WEAK_PEOPLE = PUBLIC_MIN_PEOPLE;            // أقل من 5 أشخاص = دليل ضعيف
const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const slug = (s: string) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 80);
const label = (g: Graph, id: string) => g.nodes.find(n => n.id === id)?.label_ar || id;
const ref = (id: string) => id.slice(id.indexOf(':') + 1);

// ---------------------------------------------------------------- 1) فجوات البرامج: قطاع يحتاج مهارة بأدلة ضعيفة
export function programGaps(g: Graph, max = 8): Suggestion[] {
  const out: Suggestion[] = [];
  const needs = g.edges.filter(e => e.rel === 'needs' && e.src.startsWith('sector:') && e.dst.startsWith('skill:'));
  for (const n of needs) {
    const raised = g.edges.filter(e => e.rel === 'raised' && e.dst === n.dst && !e.src.startsWith('channel:') && !e.src.startsWith('trainer:'));
    const people = raised.reduce((m, e) => Math.max(m, e.people), 0); const ev = raised.reduce((s, e) => s + e.evidence, 0); const programs = raised.filter(e => e.src.startsWith('program:')).length;
    const orgsInSector = g.nodes.filter(x => x.kind === 'org' && (x.meta as any)?.sector === ref(n.src)).length;
    if (people >= WEAK_PEOPLE && programs > 0) continue; // المهارة مغطاة بدليل كافٍ
    const score = Math.min(100, 40 + orgsInSector * 10 + (programs === 0 ? 30 : 10) + (people === 0 ? 20 : Math.max(0, 10 - people)));
    out.push({ kind: 'program', fingerprint: `program|${n.src}|${n.dst}`, title_ar: `برنامج مقترح: «${label(g, n.dst)}» لقطاع ${label(g, n.src)}`,
      why_ar: programs === 0 ? `قطاع ${label(g, n.src)} يحتاج «${label(g, n.dst)}» ولا يوجد برنامج واحد في أَثَر ترك دليلًا عليها${orgsInSector ? ` — و${orgsInSector} جهة من هذا القطاع مسجّلة لدينا` : ''}.` : `الدليل على «${label(g, n.dst)}» في قطاع ${label(g, n.src)} ما زال ضعيفًا: ${evN(ev)} من ${peopleN(people)} عبر ${programs} برنامج — أقل من عتبة الثقة (${WEAK_PEOPLE} أشخاص).`,
      evidence: [{ label: 'القطاع', value: label(g, n.src) }, { label: 'المهارة', value: label(g, n.dst) }, { label: 'الأدلة الحالية', value: String(ev) }, { label: 'الأشخاص', value: String(people) }, { label: 'برامج تحملها', value: String(programs) }, { label: 'جهات القطاع', value: String(orgsInSector) }],
      target: { sector: ref(n.src), skill_id: ref(n.dst), skill_name: label(g, n.dst), gap_ar: `${label(g, n.dst)} — مطلوبة في قطاع ${label(g, n.src)} بلا دليل كافٍ (${evN(ev)} · ${peopleN(people)})` }, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

// ---------------------------------------------------------------- 2) قناة لم تُجرَّب لمهارة نشطة → مهمة/محاكٍ يُغلق القناة
export function channelGaps(g: Graph, max = 6): Suggestion[] {
  const out: Suggestion[] = []; const transferChannels = ['mission', 'media', 'simulation'];
  const skills = g.nodes.filter(n => n.kind === 'skill' && n.people >= WEAK_PEOPLE);
  for (const s of skills) {
    const chans = g.edges.filter(e => e.rel === 'raised' && e.dst === s.id && e.src.startsWith('channel:'));
    const total = chans.reduce((a, e) => a + e.evidence, 0); const transfer = chans.filter(e => transferChannels.includes(ref(e.src))).reduce((a, e) => a + e.evidence, 0);
    if (!total || pct(transfer, total) >= 30) continue; // قناة النقل موجودة بما يكفي
    const top = chans.sort((a, b) => b.evidence - a.evidence)[0];
    out.push({ kind: 'mission', fingerprint: `mission|${s.id}`, title_ar: `مهمة عمل تُغلق قناة النقل لمهارة «${s.label_ar}»`,
      why_ar: `${peopleN(s.people)} تركوا ${evN(total)} على «${s.label_ar}» — ${pct(transfer, total)}% منها فقط من قنوات النقل إلى العمل (مهمة/أداء مُشاهَد/محاكٍ). أغلب الدليل من «${CHANNEL_LABEL[ref(top.src)]?.ar || ref(top.src)}». مهمة واحدة مؤكَّدة لكل متعلم ترفع ثقة الأثر.`,
      evidence: [{ label: 'المهارة', value: s.label_ar }, { label: 'الأدلة', value: String(total) }, { label: 'نسبة النقل', value: `${pct(transfer, total)}%` }, { label: 'القناة المهيمنة', value: CHANNEL_LABEL[ref(top.src)]?.ar || ref(top.src) }, { label: 'الأشخاص', value: String(s.people) }],
      target: { skill_id: ref(s.id), skill_name: s.label_ar, dominant_channel: ref(top.src) }, score: Math.min(100, 50 + Math.min(30, s.people) + (30 - pct(transfer, total))) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

// ---------------------------------------------------------------- 3) تركيز الجلسة: مهارات البرنامج التي لم تترك دليلًا
export function sessionFocus(g: Graph, programId: string, programSkills: string[]): { skill_id: string; name_ar: string; evidence: number; transfer: number; status: 'strong' | 'weak' | 'none' }[] {
  return programSkills.map(sid => {
    const e = g.edges.find(x => x.rel === 'raised' && x.src === `program:${programId}` && x.dst === `skill:${sid}`);
    const tr = Number((e?.meta as any)?.transfer || 0); const ev = e?.evidence || 0;
    const status: 'strong' | 'weak' | 'none' = !ev ? 'none' : (e!.people >= WEAK_PEOPLE ? 'strong' : 'weak'); return { skill_id: sid, name_ar: label(g, `skill:${sid}`), evidence: ev, transfer: tr, status };
  }).sort((a, b) => a.evidence - b.evidence);
}

// ---------------------------------------------------------------- 4) بطاقة الصف للميسِّر: لكل متعلم — ما أثبته · ما لم يُفحص · القناة التي ينجح فيها
export type LearnerCard = { key: string; proven: { skill_id: string; name_ar: string; weight: number }[]; unexamined: { skill_id: string; name_ar: string }[]; best_channel: string | null; best_channel_ar: string | null; evidence: number; one_channel: boolean };
export function learnerCards(events: LearningEventRow[], sessionSkills: string[], skillMeta: Map<string, { level: number; code: string; name_ar: string }>, learners: { key: string; user_id?: string | null; email?: string | null }[]): LearnerCard[] {
  return learners.map(l => {
    const mine = events.filter(ev => (l.user_id && ev.user_id === l.user_id) || (l.email && String(ev.email || '').toLowerCase() === String(l.email).toLowerCase()));
    const bySkill = new Map<string, number>(); const byChannel = new Map<string, number>(); let n = 0;
    for (const ev of mine) for (const { skill_id, e } of evidenceFromEvent(ev, skillMeta as any)) { if (e.kind === 'viewed') continue; n++; bySkill.set(skill_id, (bySkill.get(skill_id) || 0) + e.weight); const ch = e.kind === 'program_completed' ? 'program' : e.kind === 'attended' || e.kind === 'activity' ? 'session' : e.kind; byChannel.set(ch, (byChannel.get(ch) || 0) + e.weight); }
    const proven = [...bySkill.entries()].filter(([sid]) => sessionSkills.includes(sid)).map(([sid, w]) => ({ skill_id: sid, name_ar: skillMeta.get(sid)?.name_ar || sid, weight: r1(w) })).sort((a, b) => b.weight - a.weight);
    const unexamined = sessionSkills.filter(sid => !bySkill.has(sid)).map(sid => ({ skill_id: sid, name_ar: skillMeta.get(sid)?.name_ar || sid }));
    const best = [...byChannel.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { key: l.key, proven, unexamined, best_channel: best, best_channel_ar: best ? CHANNEL_LABEL[best]?.ar || best : null, evidence: n, one_channel: byChannel.size <= 1 && n > 0 };
  });
}
export function classSummary(cards: LearnerCard[], sessionSkills: string[], skillMeta: Map<string, { name_ar: string }>) {
  const n = cards.length || 1; const never = sessionSkills.map(sid => ({ skill_id: sid, name_ar: skillMeta.get(sid)?.name_ar || sid, unexamined: cards.filter(c => c.unexamined.some(u => u.skill_id === sid)).length })).sort((a, b) => b.unexamined - a.unexamined);
  const oneChannel = cards.filter(c => c.one_channel).length; const noEvidence = cards.filter(c => !c.evidence).length;
  const channels = new Map<string, number>(); for (const c of cards) if (c.best_channel) channels.set(c.best_channel, (channels.get(c.best_channel) || 0) + 1);
  const focus = never[0]; const hints: string[] = [];
  if (focus && focus.unexamined / n >= 0.5) hints.push(`ابدأ بـ«${focus.name_ar}»: ${focus.unexamined} من ${cards.length} لم يتركوا عليها دليلًا قط.`);
  if (oneChannel / n >= 0.4) hints.push(`${oneChannel} متعلمًا دليلهم من قناة واحدة فقط — نشاط تطبيقي قصير اليوم يفتح قناة ثانية.`);
  if (noEvidence) hints.push(`${noEvidence} بلا أي دليل سابق — سؤال تشخيصي سريع في أول 10 دقائق.`);
  const topCh = [...channels.entries()].sort((a, b) => b[1] - a[1])[0]; if (topCh) hints.push(`أغلب الصف ينجح عبر «${CHANNEL_LABEL[topCh[0]]?.ar || topCh[0]}» — صمّم التمرين بهذه الروح.`);
  return { never, one_channel: oneChannel, no_evidence: noEvidence, hints: hints.slice(0, 3) };
}

// ---------------------------------------------------------------- 5) توقّع القدرة المؤسسية («مؤشر الأداء»): نافذتان 45 يومًا
export type Trend = 'rising' | 'steady' | 'fading' | 'unknown';
export type Forecast = { skill_id: string; name_ar: string; trend: Trend; slope: number; recent_weight: number; prior_weight: number; evidence: number; people: number; steps: { title_ar: string; why_ar: string; kind: 'mission' | 'session' | 'program' | 'simulation' }[] };
export const TREND_AR: Record<Trend, string> = { rising: 'ترتفع', steady: 'تستقر', fading: 'تذوي', unknown: 'لا دليل كافٍ' };
export function forecastSkills(events: LearningEventRow[], skillMeta: Map<string, { level: number; code: string; name_ar: string }>, today: string, windowDays = 45): Forecast[] {
  const T = Date.parse(today + 'T00:00:00Z'); const W = windowDays * 86400000; const acc = new Map<string, { recent: number; prior: number; ev: number; people: Set<string>; channels: Set<string> }>();
  for (const ev of events) {
    const t = Date.parse(ev.at); if (!Number.isFinite(t) || t < T - 2 * W || t > T + 86400000) continue;
    for (const { skill_id, e } of evidenceFromEvent(ev, skillMeta as any)) {
      if (e.kind === 'viewed') continue; let a = acc.get(skill_id); if (!a) { a = { recent: 0, prior: 0, ev: 0, people: new Set(), channels: new Set() }; acc.set(skill_id, a); }
      if (t >= T - W) a.recent += e.weight; else a.prior += e.weight; a.ev++; a.channels.add(e.kind); if (ev.user_id || ev.email) a.people.add(String(ev.user_id || ev.email));
    }
  }
  const out: Forecast[] = [];
  for (const [sid, a] of acc) {
    const name = skillMeta.get(sid)?.name_ar || sid; const slope = a.prior > 0 ? (a.recent - a.prior) / a.prior : a.recent > 0 ? 1 : 0;
    const trend: Trend = a.people.size < 3 ? 'unknown' : slope > 0.25 ? 'rising' : slope < -0.25 ? 'fading' : 'steady';
    const steps: Forecast['steps'] = [];
    if (!a.channels.has('mission')) steps.push({ kind: 'mission', title_ar: `مهمة عمل مؤكَّدة في «${name}»`, why_ar: 'لا دليل نقل إلى العمل بعد — المهمة المؤكَّدة أثقل دليل (0.9) وتقلب التوقع في أسبوعين.' });
    if (!a.channels.has('attended') && !a.channels.has('activity')) steps.push({ kind: 'session', title_ar: `جلسة مباشرة قصيرة حول «${name}»`, why_ar: 'لا حضور حيّ مسجّل — جلسة 60 دقيقة بنشاط واحد تضيف قناة ثانية.' });
    if (!a.channels.has('simulation')) steps.push({ kind: 'simulation', title_ar: `محاكي قرار لـ«${name}»`, why_ar: 'المحاكي يكشف الحكم المهني لا المعرفة — ويُعتمد بشريًا.' });
    if (trend === 'fading') steps.unshift({ kind: 'program', title_ar: `تجديد قصير (micro-refresh) لـ«${name}»`, why_ar: `الوزن هبط ${Math.abs(Math.round(slope * 100))}% عن النافذة السابقة — التجديد قبل أن يذوي أرخص من إعادة البناء.` });
    out.push({ skill_id: sid, name_ar: name, trend, slope: Math.round(slope * 100) / 100, recent_weight: r1(a.recent), prior_weight: r1(a.prior), evidence: a.ev, people: a.people.size, steps: steps.slice(0, 3) });
  }
  const order: Record<Trend, number> = { fading: 0, rising: 1, steady: 2, unknown: 3 };
  return out.sort((a, b) => order[a.trend] - order[b.trend] || b.evidence - a.evidence);
}
export function weatherLine(f: Forecast[]): string {
  const known = f.filter(x => x.trend !== 'unknown'); if (!known.length) return 'لا دليل كافٍ بعد لتوقّع القدرة — تحتاج الجهة إلى 3 أشخاص على الأقل خلف كل مهارة.';
  const up = known.filter(x => x.trend === 'rising').length, down = known.filter(x => x.trend === 'fading').length, flat = known.length - up - down;
  return `خلال 90 يومًا: ${skillN(up)} ترتفع · ${flat} تستقر · ${down} تذوي${down ? ` — أولوية التدخل: «${known.find(x => x.trend === 'fading')!.name_ar}»` : ''}.`;
}

// ---------------------------------------------------------------- 6) خطوة للجهة: من التوقّع إلى اقتراح يراه الطاقم
export function orgSteps(orgId: string, orgName: string, f: Forecast[], max = 3): Suggestion[] {
  return f.filter(x => x.trend === 'fading' && x.steps.length).slice(0, max).map(x => ({ kind: 'org_step' as const, fingerprint: `org_step|${orgId}|${x.skill_id}`, title_ar: `${orgName}: «${x.name_ar}» تذوي — ${x.steps[0].title_ar}`,
    why_ar: `${x.steps[0].why_ar} (${evN(x.evidence)} من ${learnerN(x.people)} · الوزن ${x.prior_weight} → ${x.recent_weight})`, evidence: [{ label: 'الجهة', value: orgName }, { label: 'المهارة', value: x.name_ar }, { label: 'الاتجاه', value: TREND_AR[x.trend] }, { label: 'الميل', value: `${Math.round(x.slope * 100)}%` }, { label: 'الأشخاص', value: String(x.people) }],
    target: { organization_id: orgId, skill_id: x.skill_id, step: x.steps[0] }, score: Math.min(100, 60 + Math.min(25, x.people * 3) + Math.min(15, Math.abs(Math.round(x.slope * 20)))) }));
}

// ---------------------------------------------------------------- 7) ما تعلّمته أَثَر هذا الشهر
export type DecisionRow = { at: string; kind: string; action: string; meta?: any };
export function monthlyLearning(rows: DecisionRow[], monthStartIso: string) {
  const m = rows.filter(r => r.at >= monthStartIso); const by = (a: string) => m.filter(r => r.action === a).length;
  const proposed = by('proposed'), accepted = by('accepted'), dismissed = by('dismissed'), outcomes = by('outcome'), expired = by('expired');
  const kinds: Record<string, { proposed: number; accepted: number; dismissed: number }> = {}; for (const r of m) { kinds[r.kind] ||= { proposed: 0, accepted: 0, dismissed: 0 }; if (r.action === 'proposed') kinds[r.kind].proposed++; if (r.action === 'accepted') kinds[r.kind].accepted++; if (r.action === 'dismissed') kinds[r.kind].dismissed++; }
  const lessons: string[] = [];
  if (proposed) lessons.push(`اقترحت الحلقة ${ideaN(proposed)}؛ اعتمد الإنسان ${accepted} (${pct(accepted, proposed)}%) ورفض ${dismissed}.`);
  for (const [k, v] of Object.entries(kinds)) if (v.accepted + v.dismissed >= 3 && pct(v.accepted, v.accepted + v.dismissed) <= 20) lessons.push(`«${KIND_LABEL_AR[k as SuggestionKind] || k}» يُرفض غالبًا (${v.accepted}/${v.accepted + v.dismissed}) — الذاكرة ستقلّل هذا النوع وتطلب برهانًا أقوى.`);
  for (const [k, v] of Object.entries(kinds)) if (v.accepted + v.dismissed >= 2 && pct(v.accepted, v.accepted + v.dismissed) >= 70) lessons.push(`«${KIND_LABEL_AR[k as SuggestionKind] || k}» يلقى قبولًا عاليًا (${v.accepted}/${v.accepted + v.dismissed}) — سنعرضه أولًا.`);
  if (outcomes) lessons.push(`${decisionN(outcomes)} ${outcomes === 1 ? 'ترك' : outcomes === 2 ? 'تركا' : 'تركت'} أثرًا مسجَّلًا بعده (مسودة برنامج أو مهمات أُسندت).`);
  if (!lessons.length) lessons.push('لا قرارات بعد هذا الشهر — أول اعتماد أو رفض يبدأ تاريخ تعلّم أَثَر.');
  return { proposed, accepted, dismissed, expired, outcomes, acceptance: pct(accepted, proposed), kinds, lessons };
}
/** تعديل الأولوية بحسب نسبة القبول بين ما حُسم فعلًا لكل نوع (3 قرارات فأكثر؛ تعلّم بسيط وشفاف — لا عقوبة على ما لم يُقرَّر بعد) */
export function learnedScore(base: number, kind: SuggestionKind, kinds: Record<string, { proposed?: number; accepted: number; dismissed?: number }>): number {
  const k = kinds[kind]; const decided = (k?.accepted || 0) + (k?.dismissed || 0); if (!k || decided < 3) return base; const rate = k.accepted / decided; return Math.max(1, Math.min(100, Math.round(base * (0.6 + rate * 0.8))));
}
export function edgeTransfer(e: GraphEdge): number { return Number((e.meta as any)?.transfer || 0); }
