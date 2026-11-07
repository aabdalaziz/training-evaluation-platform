// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P59 «نسيج الشعبة — ما نسجه متعلّموك معًا» (خريطة الأثر المجمَّعة للشعبة) — النواة النقيّة (بلا قاعدة بيانات)
 *  • المدخل: خرائط متعلّمي الشعبة (P58 buildMap) + «لأن…» المأذونة فقط
 *  • المخرج: كوكبة مجمَّعة بلا أسماء — محطات مشتركة بين ≥ K متعلّمين · خيوط نسجها ≥ K (سماكة بالعدد) · خيوط اقتُرحت لـ ≥ K ولم يأخذها أحد (منقّطة)
 *  • k = 5 في كل شيء: المحطات والخيوط والاقتباسات والأعداد. تحت k لا يظهر عدد ولا جملة.
 *  • المحطات الشخصية (شهادة · مهمة · عهد · يد · شارة) تُجمَّع بالنوع/العنوان لا بالمعرّف — لأن معرّفاتها فردية
 *  • لا ذكاء اصطناعي · لا يدخل في أي تقييم · القواعد معلنة بالنص
 */
import { KIND_AR, RULE_AR, layout, threadKey, fmtDays } from './registry';
import type { AtharMap, RuleKey, Station, StationKind, MapLayout } from './registry';

export const WEAVE_TITLE = { ar: 'نسيج الشعبة', sub_ar: 'ما نسجه متعلّموك معًا', en: 'Section weave' } as const;
export const WEAVE_OFFICIAL = { ar: 'خريطة الأثر المجمَّعة للشعبة', en: 'Aggregated section impact weave' } as const;
export const WEAVE_PATH = '/me/day/weave';
export const K_WEAVE = 5;
export const WEAVE_LIMITS = { k: K_WEAVE, maxRoster: 60, maxStations: 60, maxQuotes: 10, starShare: 0.7 } as const;

/** المحطات التي تُجمَّع بالمعرّف (مشتركة فعلًا بين المتعلّمين) */
const SHARED_KINDS: StationKind[] = ['placement', 'program', 'session', 'skill', 'daily', 'council', 'case', 'simulation'];
/** المحطات الشخصية التي تُجمَّع بالعنوان (شهادة المهارة نفسها تحمل العنوان نفسه عند الجميع) */
const BY_TITLE: StationKind[] = ['credential', 'badge'];

export type WeaveStation = { key: string; kind: StationKind; title_ar: string; at: string; n: number };
export type WeaveThread = { from: string; to: string; rule: RuleKey; kept_n: number; offered_n: number; state: 'woven' | 'untaken'; title_ar: string };
export type WeaveQuote = { rule: RuleKey; title_ar: string; note_ar: string };
export type WeaveMirror = { strongest_ar: string | null; untaken_ar: string | null; waiting_ar: string | null; lines_ar: string[] };
export type Weave = {
  v: 1; k: number; roster: number; mapped: number; below_k: boolean;
  stations: WeaveStation[]; threads: WeaveThread[]; layout: MapLayout; star: string | null;
  mirror: WeaveMirror; quotes: WeaveQuote[]; quotes_locked_ar: string | null; consenters: number;
  weights: Record<string, number>; counts: Record<string, number>;
};
export type LearnerMap = { email: string; map: Pick<AtharMap, 'stations' | 'threads'> };
export type SharedNote = { email: string; from_key: string; to_key: string; rule: string; note_ar: string };

const norm = (s: string) => String(s || '').replace(/\s+/g, ' ').trim();
/** مفتاح التجميع للمحطة */
export function groupKey(s: Station): string {
  if (SHARED_KINDS.includes(s.kind)) return s.key;
  if (BY_TITLE.includes(s.kind)) return `${s.kind}:~${norm(s.public_ar || s.title_ar).slice(0, 60)}`;
  return `${s.kind}:~`; /* mission · horizon · hand → بالنوع فقط */
}
/** عنوان المحطة المجمَّعة — بلا أسماء، الحالات اليومية بالموضوع */
export function groupTitle(s: Station): string {
  if (SHARED_KINDS.includes(s.kind)) return s.kind === 'daily' ? s.public_ar || s.title_ar : s.title_ar;
  if (BY_TITLE.includes(s.kind)) return s.public_ar || s.title_ar;
  return KIND_AR[s.kind] === 'يد مرفوعة ✋' ? 'يد مرفوعة ✋ على كلمة مدرّب' : `${KIND_AR[s.kind]} (أيّ ${KIND_AR[s.kind].split(' ')[0]})`;
}
const ruleOf = (r: string): RuleKey => (r in RULE_AR ? (r as RuleKey) : 'manual');
/** عدد عربي: 1 مفرد · 2 مثنى · 3–10 جمع · 11+ تمييز مفرد منصوب (خيطًا ينتظر) */
const nOf = (n: number, one: string, two: string, many: string, over10?: string) => (n === 1 ? one : n === 2 ? two : n > 10 && over10 ? `${n} ${over10}` : `${n} ${many}`);

/** تجميع خرائط الشعبة → نسيج */
export function weave(maps: LearnerMap[], shared: SharedNote[] = [], opts: { k?: number; now?: Date; roster?: number } = {}): Weave {
  const k = opts.k ?? K_WEAVE; const now = opts.now || new Date();
  const seen = new Map<string, LearnerMap>(); for (const m of maps) seen.set(m.email.toLowerCase(), m);
  const list = [...seen.values()].slice(0, WEAVE_LIMITS.maxRoster);
  const roster = Math.max(opts.roster ?? list.length, list.length);
  const mapped = list.filter((m) => m.map.stations.length > 0).length;
  /* المحطات */
  const st = new Map<string, WeaveStation & { learners: Set<string> }>();
  const gk = new Map<string, Map<string, string>>(); /* email → stationKey → groupKey */
  for (const m of list) { const mine = new Map<string, string>(); gk.set(m.email.toLowerCase(), mine);
    for (const s of m.map.stations) { const g = groupKey(s); mine.set(s.key, g);
      const cur = st.get(g) || { key: g, kind: s.kind, title_ar: groupTitle(s), at: s.at, n: 0, learners: new Set<string>() };
      if (!cur.learners.has(m.email)) { cur.learners.add(m.email); cur.n += 1; }
      if (s.at < cur.at) cur.at = s.at; st.set(g, cur); } }
  /* الخيوط */
  const th = new Map<string, { from: string; to: string; rule: RuleKey; kept: Set<string>; offered: Set<string> }>();
  for (const m of list) { const mine = gk.get(m.email.toLowerCase())!;
    for (const t of m.map.threads) { const a = mine.get(t.from); const b = mine.get(t.to); if (!a || !b || a === b) continue; const key = `${threadKey(a, b)}|${t.rule}`;
      const cur = th.get(key) || { from: a, to: b, rule: t.rule, kept: new Set<string>(), offered: new Set<string>() };
      cur.offered.add(m.email); if (t.status === 'kept') cur.kept.add(m.email); th.set(key, cur); } }
  /* ما يظهر: محطات ≥ k · خيوط نسجها ≥ k أو اقتُرحت لـ ≥ k ولم يأخذها أحد */
  const visible = [...st.values()].filter((s) => s.n >= k).sort((a, b) => a.at.localeCompare(b.at)).slice(0, WEAVE_LIMITS.maxStations);
  const vis = new Set(visible.map((s) => s.key));
  const threads: WeaveThread[] = [...th.values()].filter((t) => vis.has(t.from) && vis.has(t.to) && (t.kept.size >= k || (t.kept.size === 0 && t.offered.size >= k)))
    .map((t) => ({ from: t.from, to: t.to, rule: t.rule, kept_n: t.kept.size, offered_n: t.offered.size, state: t.kept.size >= k ? 'woven' as const : 'untaken' as const, title_ar: RULE_AR[t.rule].title }))
    .sort((a, b) => b.kept_n - a.kept_n || b.offered_n - a.offered_n);
  const stations: WeaveStation[] = visible.map(({ learners: _l, ...s }) => s);
  const weights: Record<string, number> = {}; const counts: Record<string, number> = {};
  for (const t of threads) weights[threadKey(t.from, t.to)] = t.kept_n; for (const s of stations) counts[s.key] = s.n;
  /* نجمة الشعبة: خيط نسجه ≥ 70٪ من أصحاب الخرائط (و≥ k) */
  const top = threads.find((t) => t.state === 'woven'); const star = top && mapped >= k && top.kept_n >= Math.ceil(WEAVE_LIMITS.starShare * mapped) ? threadKey(top.from, top.to) : null;
  /* المرآة — بلا حكم */
  const untaken = threads.find((t) => t.state === 'untaken');
  const waitingTotal = list.reduce((n, m) => n + m.map.threads.filter((t) => t.status === 'proposed').length, 0);
  const below_k = mapped < k;
  const strongest_ar = top ? `أكثر خيط نسجه متعلّموك: ${top.title_ar} — ${top.kept_n} من ${mapped}` : null;
  const untaken_ar = untaken ? `خيط اقترحناه لـ ${untaken.offered_n} ولم يأخذه أحد بعد: ${untaken.title_ar} — ربما الكلمة التالية تكون عنه` : null;
  const waiting_ar = !below_k && waitingTotal ? `${nOf(waitingTotal, 'خيط واحد ينتظر', 'خيطان ينتظران', 'خيوط تنتظر', 'خيطًا ينتظر')} كلمة أصحابها` : null;
  const lines_ar = [strongest_ar, untaken_ar, waiting_ar].filter(Boolean) as string[];
  if (below_k) lines_ar.unshift(mapped ? `حين يبلغ ${k} من متعلّميك محطةً واحدة يظهر النسيج — بلغها ${mapped} حتى الآن` : 'لم يبدأ متعلّموك خرائطهم بعد — أول محطة تُثبَّت حين يجيبون عن حالة يوم أو يُتمّون برنامجًا');
  else if (!lines_ar.length) lines_ar.push('محطات مشتركة كثيرة — والخيوط بينها ما زالت كلمةً عند أصحابها');
  /* الاقتباسات المأذونة: لا تظهر جملة قبل k مأذونين · بلا اسم ولا تاريخ · ترتيب يومي ثابت لا يكشف الترتيب الزمني */
  const okShared = shared.filter((n) => norm(n.note_ar).length >= 2 && seen.has(n.email.toLowerCase()));
  const consenters = new Set(okShared.map((n) => n.email.toLowerCase())).size;
  const day = Math.floor(now.getTime() / 86400000);
  const quotes: WeaveQuote[] = consenters >= k ? okShared.map((n, i) => ({ q: { rule: ruleOf(n.rule), title_ar: RULE_AR[ruleOf(n.rule)].title, note_ar: norm(n.note_ar).slice(0, 120) }, o: ((i + 1) * 2654435761 + day * 97) % 1000003 }))
    .sort((a, b) => a.o - b.o).slice(0, WEAVE_LIMITS.maxQuotes).map((x) => x.q) : [];
  const quotes_locked_ar = consenters >= k ? null : `ستظهر كلمات متعلّميك حين يأذن ${k} منهم — أذِن ${consenters} حتى الآن`;
  return { v: 1, k, roster, mapped, below_k, stations, threads, layout: layout(stations as unknown as Station[]), star, mirror: { strongest_ar, untaken_ar, waiting_ar, lines_ar }, quotes, quotes_locked_ar, consenters, weights, counts };
}

/** P59 → P52/P57: سطر «أقوى خيط» للجهة من خيوط منسوبيها (k ≥ 5 على عدد الناسجين) */
export function orgStrongestThread(rows: Array<{ email: string; rule: string }>, k = K_WEAVE): { rule: RuleKey; n: number; line_ar: string } | null {
  const by = new Map<RuleKey, Set<string>>(); for (const r of rows) { const rule = ruleOf(r.rule); if (rule === 'manual') continue; const s = by.get(rule) || new Set<string>(); s.add(r.email.toLowerCase()); by.set(rule, s); }
  const top = [...by.entries()].map(([rule, s]) => ({ rule, n: s.size })).sort((a, b) => b.n - a.n)[0];
  if (!top || top.n < k) return null;
  return { ...top, line_ar: `أقوى خيط نسجه منسوبوكم هذا الشهر: ${RULE_AR[top.rule].title} — نسجه ${top.n} منهم بكلماتهم` };
}

/** P59: «خيطك هذا نسجه معك N من زملائك» — من صفوف الخيوط المبقاة لزملاء الشعبة (المفاتيح المشتركة فقط) · يظهر إذا N ≥ k */
export function peersOf(mine: Array<{ from: string; to: string }>, peerRows: Array<{ email: string; from_key: string; to_key: string }>, me: string, k = K_WEAVE): Record<string, number> {
  const out: Record<string, number> = {}; const self = me.toLowerCase();
  for (const t of mine) { const s = new Set<string>(); for (const r of peerRows) if (r.from_key === t.from && r.to_key === t.to && r.email.toLowerCase() !== self) s.add(r.email.toLowerCase()); if (s.size >= k) out[threadKey(t.from, t.to)] = s.size; }
  return out;
}
export const peersLine = (n: number) => `خيطك هذا نسجه معك ${n} من زملائك`;

/** صيغة أيام للعرض (إعادة تصدير للواجهة) */
export { fmtDays, RULE_AR, KIND_AR };
