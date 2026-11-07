// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P61 «نسيج البرنامج — ما نسجه متدرّبوه بأيديهم» (الرسمي: خريطة الأثر المجمَّعة للبرنامج) — النواة الصِّرفة (بلا قاعدة بيانات)
 *  • المدخل: صفوف portal_map_threads المبقاة (kept) لمنسوبي البرنامج + نطاق محطاته (البرنامج · جلساته · مهامّه)
 *  • يَعُدّ ولا يَقتبس: لا «لأن…» هنا إطلاقًا (إذن P59 كان للمدرّب لا لملف الاعتماد) — أعداد فقط، وبقاعدة الخمسة
 *  • اليدوي (manual) لا يُحتسب؛ المستبعَد لا يُقرأ أصلًا؛ لا أسماء ولا بريد ولا تواريخ فردية في أي مخرج
 *  • الخيط «للبرنامج» إذا كان أحد طرفيه محطةً من محطاته (program:<pid> · session:<id> · mission:<id>)
 *  • «خرّيج ما زال ينسج»: متدرّب قرّر خيطًا (أيّ خيط غير يدوي) بعد تاريخ انتهاء البرنامج — متابعة الخرّيجين بأيديهم (3.5)
 *  • «عبر الدفعات»: نسبة الناسجين في كل دفعة التحاق (سنة القبول) — لا تظهر دفعة تحت خمسة
 */
import { RULE_AR } from './registry';
import type { RuleKey } from './registry';
import type { Evidence } from '../accreditation/registry';

export const P61_NAMES_AR = { title: 'نسيج البرنامج', sub: 'ما نسجه متدرّبوه بأيديهم', official: 'خريطة الأثر المجمَّعة للبرنامج', en: 'Program-level aggregated impact weave', motto: 'لا نقول إن برنامجنا أثّر؛ نُري ما نسجه متدرّبوه بأيديهم' } as const;
export const K_PROGRAM = 5;
export const PROGRAM_WEAVE_LIMITS = { k: K_PROGRAM, maxRoster: 1000, maxThreads: 5000, ttlMs: 10 * 60 * 1000 } as const;
export const PROGRAM_WEAVE_ANCHOR = '#weave';

/** أيّ معيار فرعي يشهد له كل خيط (معايير الاعتماد البرامجي — ETEC) */
export const WEAVE_EVIDENCE_CODES: Partial<Record<RuleKey, string[]>> = {
  program_skill: ['3.2', '1.6'], program_credential: ['3.2', '1.6'], session_skill: ['2.1', '1.5'], hand_session: ['3.4', '3.1'],
  placement_program: ['3.3'], daily_mission: ['3.5', '2.4'], simulation_skill: ['2.1'], skill_credential: ['1.6'],
};
/** نصّ الدليل لكل خيط — بصيغة المتدرّبين لا البرنامج */
export const WEAVE_EVIDENCE_AR: Partial<Record<RuleKey, (n: number) => string>> = {
  program_skill: (n) => `${n} من متدرّبي البرنامج نسجوا بأيديهم: «البرنامج قاد إلى مهارة معتمدة»`,
  program_credential: (n) => `${n} من متدرّبي البرنامج نسجوا بأيديهم: «البرنامج قاد إلى شهادة»`,
  session_skill: (n) => `${n} خيطًا نسجه المتدرّبون: «جلسة من البرنامج قادت إلى مهارة معتمدة»`,
  hand_session: (n) => `${n} خيطًا نسجه المتدرّبون: «✋ على كلمة المدرّب قادت إلى حضور الجلسة التالية»`,
  placement_program: (n) => `${n} متدرّبًا نسجوا: «تحديد المستوى قاد إلى إتمام البرنامج»`,
  daily_mission: (n) => `${n} خيطًا: «حالة يوم قادت إلى مهمة ميدانية» من مهامّ البرنامج`,
  simulation_skill: (n) => `${n} خيطًا: «محاكاة قادت إلى مهارة معتمدة»`,
  skill_credential: (n) => `${n} خيطًا: «مهارة قادت إلى شهادة»`,
};

export type ThreadRow = { email: string; from_key: string; to_key: string; rule: string; decided_at: string | null };
export type RosterRow = { email: string; cohort: string | null };
export type ProgramScope = { program_id: string; name_ar: string; keys: Set<string>; end_date: string | null };
export type WeaveLine = { rule: RuleKey; title_ar: string; n: number; codes: string[] };
export type CohortLine = { label_ar: string; roster: number; weavers: number; share: number };
export type ProgramWeave = {
  k: number; roster_n: number; weavers_n: number; threads_n: number; below_k: boolean;
  threads: WeaveLine[]; strongest: WeaveLine | null; graduates: { n: number; rules: number };
  cohorts: CohortLine[]; mirror: { strongest_ar: string | null; belowk_ar: string | null; weavers_ar: string | null; graduates_ar: string | null; lines_ar: string[] };
  sources: { from: string; to: string; n: number }[]; /* «الجديلة»: نوع المصدر → نوع الهدف */
};

const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const kindOf = (key: string) => key.split(':')[0] || '';
const KIND_SHORT: Record<string, string> = { placement: 'تحديد المستوى', program: 'البرنامج', session: 'جلسة', skill: 'مهارة معتمدة', credential: 'شهادة', daily: 'حالة يوم', mission: 'مهمة ميدانية', hand: '✋ يد مرفوعة', simulation: 'محاكاة', council: 'مجلس', badge: 'شهادة عضو', horizon: 'عهد', horizon_review: 'مراجعة عهد', case: 'قضية', case_return: 'عودة' };
export const kindShort = (key: string) => KIND_SHORT[kindOf(key)] || kindOf(key) || 'محطة';
const ms = (s: string | null) => { const t = s ? Date.parse(s) : NaN; return Number.isFinite(t) ? t : 0; };

/** مفاتيح محطات البرنامج — من معرّفاته فقط */
export function scopeKeys(programId: string, sessionIds: string[] = [], missionIds: string[] = []): Set<string> {
  const s = new Set<string>([`program:${programId}`]);
  for (const id of sessionIds) if (id) s.add(`session:${id}`);
  for (const id of missionIds) if (id) s.add(`mission:${id}`);
  return s;
}
/** دفعة الالتحاق = سنة القبول (التنسيب ثم التسجيل) */
export const cohortOf = (placedAt: string | null, createdAt: string | null): string | null => { const d = placedAt || createdAt; const y = d ? String(d).slice(0, 4) : ''; return /^\d{4}$/.test(y) ? y : null; };
export const cohortLabel = (c: string) => `دفعة ${c}`;

/** النواة: صفوف مبقاة → نسيج البرنامج (أعداد فقط · k ≥ 5) */
export function programWeave(rows: ThreadRow[], roster: RosterRow[], scope: ProgramScope, k = K_PROGRAM): ProgramWeave {
  const rosterSet = new Set(roster.map((r) => lower(r.email)).filter(Boolean));
  const seen = new Set<string>(); /* الصفّ الواحد (متعلّم · من · إلى) مرّة واحدة */
  const own = rows.filter((r) => { if (!rosterSet.has(lower(r.email)) || !(r.rule in RULE_AR) || r.rule === 'manual') return false; const id = `${lower(r.email)}|${r.from_key}|${r.to_key}`; if (seen.has(id)) return false; seen.add(id); return true; });
  const inScope = own.filter((r) => scope.keys.has(String(r.from_key)) || scope.keys.has(String(r.to_key)));
  const byRule = new Map<RuleKey, Set<string>>();
  const bySrc = new Map<string, number>();
  for (const r of inScope) {
    const rule = r.rule as RuleKey; (byRule.get(rule) || byRule.set(rule, new Set()).get(rule)!).add(`${lower(r.email)}|${r.from_key}|${r.to_key}`);
    const sk = `${kindShort(r.from_key)}|${kindShort(r.to_key)}`; bySrc.set(sk, (bySrc.get(sk) || 0) + 1);
  }
  const threads: WeaveLine[] = [...byRule.entries()].map(([rule, set]) => ({ rule, title_ar: RULE_AR[rule].title, n: set.size, codes: WEAVE_EVIDENCE_CODES[rule] || [] })).filter((t) => t.n >= k).sort((a, b) => b.n - a.n || a.title_ar.localeCompare(b.title_ar, 'ar'));
  const hidden = [...byRule.values()].filter((s) => s.size > 0 && s.size < k).length;
  const weavers = new Set(inScope.map((r) => lower(r.email)));
  const weavers_n = weavers.size >= k ? weavers.size : 0;
  /* الخرّيجون: قرّروا خيطًا (أيّ خيط غير يدوي) بعد انتهاء البرنامج */
  const endMs = ms(scope.end_date); const grads = new Set<string>(); const gradRules = new Set<string>();
  if (endMs) for (const r of own) if (ms(r.decided_at) > endMs) { grads.add(lower(r.email)); gradRules.add(r.rule); }
  const graduates = { n: grads.size >= k ? grads.size : 0, rules: grads.size >= k ? gradRules.size : 0 };
  /* الدفعات */
  const coh = new Map<string, { roster: number; weavers: number }>();
  for (const r of roster) { const c = r.cohort || ''; if (!c) continue; const g = coh.get(c) || { roster: 0, weavers: 0 }; g.roster++; if (weavers.has(lower(r.email))) g.weavers++; coh.set(c, g); }
  const cohorts: CohortLine[] = [...coh.entries()].filter(([, g]) => g.roster >= k).sort((a, b) => b[0].localeCompare(a[0])).map(([c, g]) => ({ label_ar: cohortLabel(c), roster: g.roster, weavers: g.weavers >= k ? g.weavers : 0, share: g.weavers >= k ? Math.round((g.weavers / g.roster) * 100) : 0 }));
  const strongest = threads[0] || null;
  const below_k = rosterSet.size < k || (!threads.length && weavers_n === 0);
  const lines_ar: string[] = [];
  const strongest_ar = strongest ? `أقوى خيط نسجه متدرّبو البرنامج: ${strongest.title_ar} — نسجه ${strongest.n} منهم` : null;
  const belowk_ar = hidden ? `${hidden === 1 ? 'خيطٌ واحد لم يبلغ' : `${hidden} خيوط لم تبلغ`} خمسة بعد — لا يُعرض عدده` : null;
  const weavers_ar = weavers_n ? `${weavers_n} من ${rosterSet.size} متدرّبًا نسجوا خيطًا واحدًا على الأقل من هذا البرنامج` : null;
  const graduates_ar = graduates.n ? `${graduates.n} خرّيجًا ما زالوا ينسجون أثرهم بعد انتهاء البرنامج (${graduates.rules} ${graduates.rules === 1 ? 'نوع خيط' : 'أنواع خيوط'})` : null;
  if (!rosterSet.size) lines_ar.push('لا منسوبون للبرنامج بعد — النسيج يبدأ حين يبدأ القبول.');
  else if (rosterSet.size < k) lines_ar.push(`حين يبلغ منسوبو البرنامج ${k} يبدأ النسيج بالظهور — لا أعداد قبل ذلك.`);
  else if (!threads.length && !weavers_n) lines_ar.push('لم ينسج خمسةٌ من المتدرّبين خيطًا من هذا البرنامج بعد — الخريطة بيد المتعلّم، لا بيد البرنامج.');
  for (const l of [strongest_ar, weavers_ar, graduates_ar, belowk_ar]) if (l) lines_ar.push(l);
  const sources = [...bySrc.entries()].map(([sk, n]) => { const [from, to] = sk.split('|'); return { from, to, n }; }).filter((s) => s.n >= k).sort((a, b) => b.n - a.n);
  return { k, roster_n: rosterSet.size, weavers_n, threads_n: threads.reduce((a, t) => a + t.n, 0), below_k, threads, strongest, graduates, cohorts, mirror: { strongest_ar, belowk_ar, weavers_ar, graduates_ar, lines_ar }, sources };
}

/** أدلة ملف الاعتماد من النسيج — فقط ما بلغ خمسة؛ الرابط إلى لوحة النسيج لا إلى أي خريطة فرد */
export function weaveEvidence(w: ProgramWeave): Evidence[] {
  const out: Evidence[] = [];
  for (const t of w.threads) { const codes = WEAVE_EVIDENCE_CODES[t.rule]; const txt = WEAVE_EVIDENCE_AR[t.rule]; if (!codes?.length || !txt) continue; out.push({ id: `weave:${t.rule}`, kind: 'weave', codes, label_ar: txt(t.n), at: null, href: PROGRAM_WEAVE_ANCHOR, n: t.n }); }
  if (w.graduates.n >= w.k) out.push({ id: 'weave:graduates', kind: 'weave', codes: ['3.5'], label_ar: `${w.graduates.n} خرّيجًا ما زالوا ينسجون أثرهم بعد انتهاء البرنامج — بأيديهم لا باستبيان`, at: null, href: PROGRAM_WEAVE_ANCHOR, n: w.graduates.n });
  return out;
}

/** سطر النسيج في النسخة المختومة والشريط العام (بلا شيء تحت خمسة) */
export const weaveSnapshotLine = (w: ProgramWeave | null): { weave_ar: string | null; weave_n: number } => ({ weave_ar: w?.mirror.strongest_ar || null, weave_n: w?.strongest?.n || 0 });

/** للمتعلّم (الشفافية): «خيطك جزء من نسيج برنامج …» — من أعداد الخيوط المبقاة على مفتاح البرنامج نفسه، k ≥ 5 */
export function programPeersOf(mine: Array<{ from: string; to: string }>, counts: Record<string, number>, titles: Record<string, string>, k = K_PROGRAM): Record<string, { n: number; program_ar: string }> {
  const out: Record<string, { n: number; program_ar: string }> = {};
  for (const t of mine) { const key = kindOf(t.from) === 'program' ? t.from : kindOf(t.to) === 'program' ? t.to : null; if (!key) continue; const n = counts[key] || 0; if (n >= k) out[`${t.from}>${t.to}`] = { n, program_ar: titles[key] || 'برنامج' }; }
  return out;
}
export const programPeersLine = (p: { n: number; program_ar: string }) => `خيطك هذا جزء من نسيج برنامج «${p.program_ar}» — نسجه معك ${p.n} من متدرّبيه، بلا أسماء`;
