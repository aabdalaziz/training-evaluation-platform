// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P58 «خريطة أثرك — ما قاد إلى ماذا» — القلب النقي (بلا قاعدة بيانات، بلا ذكاء اصطناعي، بلا مكتبات)
 *  • المحطات (stations): تُستخرج من وقائع الرحلة نفسها (JourneyInput من lib/journey) — برنامج · جلسة · مهارة معتمدة · شهادة · حالة يوم · مهمة · محاكاة · مجلس · قضية · عهد · ✋ · تحديد مستوى
 *  • الخيوط المقترَحة (proposeThreads): قواعد صريحة بنوافذ زمنية — «حدث أ ثم حدث ب خلال N يومًا» — لا تُخزَّن؛ تُحسَب كل مرة
 *  • قرار المتعلّم (kept/declined) يأتي من portal_map_threads؛ المبقى يحتاج «لأن…» ≤ 120 حرفًا؛ المستبعَد لا يُقترح مجددًا
 *  • الخريطة (buildMap): محطات + خيوط (مبقاة/مقترَحة) + إحداثيات SVG حتمية + سطر مرآة بلا حكم
 *  • الوجه العام (publicStation): حالات اليوم بالموضوع لا بالعنوان؛ لا أسماء أشخاص أبدًا («مدرّبك»)
 *  لا يدخل شيء من هنا في أي تقييم ولا في الملف المهاري المحسوب.
 */
import type { JourneyInput } from '../journey/registry';

export const MAP_OFFICIAL = { ar: 'خريطة الأثر الذاتية للمتعلّم', en: 'Learner self-authored impact map' } as const;
export const MAP_TITLE = { ar: 'خريطة أثرك', sub_ar: 'ما قاد إلى ماذا', en: 'Your impact map' } as const;
export const NOTE_MAX = 120;
export const MAP_LIMITS = { noteMax: NOTE_MAX, maxProposals: 40, maxStations: 160, snapshotPerYear: 1 } as const;
export const DAY = 86400000;

export type StationKind = 'placement' | 'program' | 'session' | 'skill' | 'credential' | 'daily' | 'mission' | 'simulation' | 'council' | 'case' | 'horizon' | 'hand' | 'badge';
export type Station = { key: string; kind: StationKind; at: string; title_ar: string; public_ar: string; skills: string[]; topic?: string | null };
export type RuleKey = 'placement_program' | 'program_skill' | 'program_credential' | 'skill_credential' | 'session_skill' | 'daily_mission' | 'hand_session' | 'pledge_review' | 'council_badge' | 'case_return' | 'simulation_skill' | 'manual';
export type Proposed = { from: string; to: string; rule: RuleKey; why_ar: string; days: number };
export type Decision = { from_key: string; to_key: string; rule: string; status: 'kept' | 'declined'; note_ar: string | null; decided_at: string; shared?: boolean /* P59: إذن عرض «لأن…» للمدرّب بلا اسم */; voice?: { sec: number; at: string } | null /* P60: «لأن…» بصوت صاحبها — مدّة وتاريخ فقط، لا مسار */ };
export type Thread = { from: string; to: string; rule: RuleKey; status: 'kept' | 'proposed'; note_ar: string | null; why_ar: string; decided_at: string | null; days: number; shared?: boolean /* P59 */; voice?: { sec: number; at: string } | null /* P60 */ };
export type Pt = { x: number; y: number };
export type MapLayout = { w: number; h: number; pos: Record<string, Pt> };
export type Mirror = { strongest_ar: string | null; waiting_ar: string | null; lonely_ar: string | null; lines_ar: string[] };
export type AtharMap = { stations: Station[]; threads: Thread[]; declined: number; layout: MapLayout; mirror: Mirror; counts: { stations: number; kept: number; proposed: number; manual: number; by_kind: Record<string, number> } };
export type MapInput = JourneyInput & { hands: { at: string; notice_id: string }[] };

export const KIND_AR: Record<StationKind, string> = { placement: 'تحديد المستوى', program: 'برنامج', session: 'جلسة', skill: 'مهارة معتمدة', credential: 'شهادة', daily: 'حالة يوم', mission: 'مهمة ميدانية', simulation: 'محاكاة', council: 'مجلس', case: 'قضية مجلس', horizon: 'عهد الأفق', hand: 'يد مرفوعة ✋', badge: 'شهادة مجلس' };
export const RULE_AR: Record<RuleKey, { title: string; why: string }> = {
  placement_program: { title: 'تحديد المستوى قاد إلى برنامج', why: 'حدّدتَ مستواك ثم أتممتَ برنامجًا خلال {d} يومًا' },
  program_skill: { title: 'برنامج قاد إلى مهارة معتمدة', why: 'أتممتَ البرنامج ثم اعتُمدت لك المهارة خلال {d} يومًا' },
  program_credential: { title: 'برنامج قاد إلى شهادة', why: 'أتممتَ البرنامج ثم صدرت الشهادة خلال {d} يومًا' },
  skill_credential: { title: 'مهارة قادت إلى شهادة', why: 'اعتُمدت المهارة ثم صدرت شهادتها خلال {d} يومًا' },
  session_skill: { title: 'جلسة قادت إلى مهارة', why: 'حضرتَ جلسة على هذه المهارة ثم اعتُمدت خلال {d} يومًا' },
  daily_mission: { title: 'حالة يوم قادت إلى مهمة ميدانية', why: 'أجبتَ عن حالة ثم نزلتَ إلى الميدان خلال {d} يومًا' },
  hand_session: { title: '✋ قادت إلى حضور', why: 'رفعتَ يدك على كلمة مدرّبك ثم حضرتَ الجلسة التالية خلال {d} يومًا' },
  pledge_review: { title: 'عهد قاد إلى مراجعة', why: 'قطعتَ عهدًا مع نفسك ثم عدتَ لمراجعته بعد {d} يومًا' },
  council_badge: { title: 'مجلس قاد إلى شهادة عضو', why: 'انضممتَ إلى مجلس ثم صدرت لك شهادة عضو مجلس بعد {d} يومًا' },
  case_return: { title: 'التزام قاد إلى عودة', why: 'حملتَ قضية إلى مجلسك والتزمتَ ثم عدتَ لتروي ما حدث بعد {d} يومًا' },
  simulation_skill: { title: 'محاكاة قادت إلى مهارة', why: 'تدرّبتَ في محاكاة ثم اعتُمدت المهارة خلال {d} يومًا' },
  manual: { title: 'خيط نسجتَه بنفسك', why: 'أنت من رأى هذا الخيط' },
};
const WIN: Record<Exclude<RuleKey, 'manual'>, number> = { placement_program: 180, program_skill: 90, program_credential: 45, skill_credential: 180, session_skill: 60, daily_mission: 60, hand_session: 14, pledge_review: 400, council_badge: 400, case_return: 120, simulation_skill: 60 };

const ms = (s: string) => { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; };
const byAt = <T extends { at: string }>(a: T[]) => [...a].sort((x, y) => ms(x.at) - ms(y.at));
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((ms(b) - ms(a)) / DAY));
const short = (s: string, n = 48) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
export const fmtDays = (d: number) => d === 0 ? 'اليوم نفسه' : d === 1 ? 'يوم واحد' : d === 2 ? 'يومين' : d <= 10 ? `${d} أيام` : `${d} يومًا`;
const why = (rule: RuleKey, d: number) => RULE_AR[rule].why.replace('{d}', String(d)).replace(/خلال 0 يومًا|بعد 0 يومًا/, 'في اليوم نفسه');

/** موضوع حالة اليوم للوجه العام (بلا عنوان الموقف) */
export function topicOf(title: string | null | undefined): string {
  const t = String(title || '');
  const T: [RegExp, string][] = [[/صفّ|صف |طالب|حصة|درس/, 'إدارة الصفّ'], [/وليّ|ولي أمر|أسرة|أهل/, 'أولياء الأمور'], [/تقويم|اختبار|درجات|تصحيح/, 'التقويم'], [/زميل|زملاء|فريق|اجتماع/, 'العمل مع الزملاء'], [/قراءة|كتابة|نحو|إملاء|نص/, 'تعليم اللغة'], [/رقمي|تقنية|منصة|جهاز/, 'التقنية'], [/دمج|إعاقة|احتياج|فروق/, 'الفروق الفردية']];
  for (const [re, s] of T) if (re.test(t)) return s; return 'موقف مهني';
}

/** استخراج المحطات من وقائع الرحلة — مفاتيح ثابتة قابلة لإعادة الحساب */
export function stationsOf(inp: MapInput): Station[] {
  const out: Station[] = []; const seen = new Set<string>(); const push = (s: Station) => { if (!s.at || seen.has(s.key)) return; seen.add(s.key); out.push(s); };
  const name = (id: string) => inp.skills[id] || 'مهارة';
  for (const e of inp.events) {
    const c = (e.context || {}) as Record<string, any>;
    if (e.object_type === 'placement' && e.verb === 'assessed') push({ key: `placement:${e.object_id}`, kind: 'placement', at: e.at, title_ar: `تحديد المستوى${c.level ? ` — ${c.level}` : ''}`, public_ar: 'تحديد المستوى', skills: e.skills || [] });
    else if (e.object_type === 'program' && e.verb === 'completed') { const t = String(c.program_name || c.title || c.title_ar || 'برنامج تدريبي'); push({ key: `program:${e.object_id}`, kind: 'program', at: e.at, title_ar: t, public_ar: t, skills: e.skills || [] }); }
    else if (e.object_type === 'session' && e.verb === 'attended') push({ key: `session:${e.object_id}`, kind: 'session', at: e.at, title_ar: String(c.title || c.title_ar || 'جلسة حضرتُها'), public_ar: 'جلسة', skills: e.skills || [] });
    else if (e.object_type === 'simulation' && e.verb === 'assessed') push({ key: `simulation:${e.object_id}`, kind: 'simulation', at: e.at, title_ar: String(c.title || c.title_ar || 'محاكاة'), public_ar: 'محاكاة', skills: e.skills || [] });
    else if (e.object_type === 'council_badge' && e.verb === 'issued') push({ key: `badge:${e.object_id}`, kind: 'badge', at: e.at, title_ar: 'شهادة عضو مجلس', public_ar: 'شهادة عضو مجلس', skills: [] });
    else if (e.object_type === 'horizon' && e.verb === 'pledged') push({ key: `horizon:${e.object_id}`, kind: 'horizon', at: e.at, title_ar: `عهد الأفق${c.step_ar ? ` — ${short(String(c.step_ar), 36)}` : ''}`, public_ar: 'عهد الأفق', skills: [] });
    else if (e.object_type === 'horizon' && e.verb === 'reviewed') push({ key: `horizon_review:${e.object_id}:${e.at.slice(0, 10)}`, kind: 'horizon', at: e.at, title_ar: 'مراجعة العهد', public_ar: 'مراجعة العهد', skills: [], topic: e.object_id });
  }
  for (const d of inp.daily) { const id = d.case_id || d.created_at.slice(0, 10); const topic = topicOf(d.case_title); push({ key: `daily:${id}`, kind: 'daily', at: d.created_at, title_ar: d.case_title ? `حالة: ${short(d.case_title)}` : 'حالة يوم', public_ar: `حالة يوم — ${topic}`, skills: [], topic }); }
  for (const m of inp.missions) { const at = m.confirmed_at || m.submitted_at; if (!at) continue; push({ key: `mission:${m.id}`, kind: 'mission', at, title_ar: `مهمة: ${short(m.title_ar || 'مهمة ميدانية')}`, public_ar: 'مهمة ميدانية', skills: m.skills || [] }); }
  for (const l of inp.levels) if (l.approved_at && l.approved_level != null) push({ key: `skill:${l.skill_id}`, kind: 'skill', at: l.approved_at, title_ar: `${name(l.skill_id)} — مستوى ${l.approved_level}`, public_ar: `مهارة معتمدة: ${name(l.skill_id)}`, skills: [l.skill_id] });
  for (const c of inp.credentials) push({ key: `credential:${c.id}`, kind: 'credential', at: c.issued_at, title_ar: short(c.title_ar || 'شهادة', 56), public_ar: short(c.title_ar || 'شهادة', 56), skills: [], topic: c.kind });
  for (const m of inp.memberships) if (m.joined_at) push({ key: `council:${m.council_id}`, kind: 'council', at: m.joined_at, title_ar: `مجلس: ${short(m.council_title || 'مجلس أَثَر', 40)}`, public_ar: 'مجلس أَثَر', skills: [] });
  for (const c of inp.cases) { if (!c?.created_at) continue; push({ key: `case:${c.id}`, kind: 'case', at: c.committed_at || c.created_at, title_ar: `قضية: ${short(c.title_ar || 'قضية حملتُها', 40)}`, public_ar: 'قضية مجلس', skills: [], topic: c.returned_at || null }); }
  for (const h of inp.hands) push({ key: `hand:${h.notice_id}`, kind: 'hand', at: h.at, title_ar: 'رفعتُ يدي ✋ على كلمة مدرّبي', public_ar: 'يد مرفوعة ✋', skills: [] });
  return byAt(out).slice(0, MAP_LIMITS.maxStations);
}

const within = (a: Station, b: Station, days: number) => { const d = ms(b.at) - ms(a.at); return d >= 0 && d <= days * DAY; };
const share = (a: string[], b: string[]) => a.some((x) => b.includes(x));

/** الخيوط المقترَحة — قواعد صريحة، كل زوج مرة واحدة، أول «ب» بعد «أ» فقط حيث ينطبق */
export function proposeThreads(stations: Station[]): Proposed[] {
  const out: Proposed[] = []; const seen = new Set<string>();
  const add = (a: Station, b: Station, rule: Exclude<RuleKey, 'manual'>) => { const k = `${a.key}>${b.key}`; if (seen.has(k) || a.key === b.key) return; seen.add(k); const d = daysBetween(a.at, b.at); out.push({ from: a.key, to: b.key, rule, why_ar: why(rule, d), days: d }); };
  const K = (k: StationKind) => stations.filter((s) => s.kind === k);
  const first = (from: Station, cands: Station[], days: number, ok: (s: Station) => boolean = () => true) => byAt(cands).find((s) => within(from, s, days) && ok(s));
  for (const p of K('placement')) { const b = first(p, K('program'), WIN.placement_program); if (b) add(p, b, 'placement_program'); }
  for (const pr of K('program')) {
    for (const sk of K('skill')) if (within(pr, sk, WIN.program_skill) && share(pr.skills, sk.skills)) add(pr, sk, 'program_skill');
    const cr = first(pr, K('credential'), WIN.program_credential, (c) => c.topic === 'program_completion' || c.topic == null); if (cr) add(pr, cr, 'program_credential');
  }
  for (const sk of K('skill')) { const cr = first(sk, K('credential'), WIN.skill_credential, (c) => c.topic === 'skill' && c.title_ar.includes(sk.title_ar.split(' — ')[0])); if (cr) add(sk, cr, 'skill_credential'); }
  for (const se of K('session')) for (const sk of K('skill')) if (within(se, sk, WIN.session_skill) && share(se.skills, sk.skills)) add(se, sk, 'session_skill');
  for (const si of K('simulation')) for (const sk of K('skill')) if (within(si, sk, WIN.simulation_skill) && share(si.skills, sk.skills)) add(si, sk, 'simulation_skill');
  for (const d of K('daily')) { const m = first(d, K('mission'), WIN.daily_mission); if (m) add(d, m, 'daily_mission'); }
  for (const h of K('hand')) { const s = first(h, K('session'), WIN.hand_session); if (s) add(h, s, 'hand_session'); }
  for (const p of K('horizon').filter((s) => s.key.startsWith('horizon:'))) { const r = first(p, K('horizon').filter((s) => s.key.startsWith('horizon_review:')), WIN.pledge_review, (s) => s.topic === p.key.slice('horizon:'.length)); if (r) add(p, r, 'pledge_review'); }
  for (const c of K('council')) { const b = first(c, K('badge'), WIN.council_badge); if (b) add(c, b, 'council_badge'); }
  for (const c of K('case')) { if (!c.key.startsWith('case:')) continue; const ret = stations.find((s) => s.key === `case_return:${c.key}`); if (ret && within(c, ret, WIN.case_return)) add(c, ret, 'case_return'); }
  return out.slice(0, MAP_LIMITS.maxProposals);
}

/** يضيف محطات «عودة القضية» المشتقّة (حدث داخل القضية نفسها) */
export function withCaseReturns(stations: Station[]): Station[] {
  const extra: Station[] = [];
  for (const c of stations) if (c.kind === 'case' && c.topic && ms(String(c.topic)) > ms(c.at)) extra.push({ key: `case_return:${c.key}`, kind: 'case', at: String(c.topic), title_ar: 'عودتي إلى مجلسي', public_ar: 'عودة إلى المجلس', skills: [] });
  return extra.length ? byAt([...stations, ...extra]) : stations;
}

/** تحقّق «لأن…» */
export function validateNote(s: unknown): { ok: true; note: string } | { ok: false; error: string } {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim().replace(/^(?:لأن|لان|لأنّ)(?:\s+|\s*[:،,…]\s*)/u, ''); /* P60: من يبدأ بـ«لأن» (كتابةً أو إملاءً) لا تتكرّر له */
  if (t.length < 2) return { ok: false, error: 'اكتب «لأن…» بكلمتين على الأقل' };
  if (t.length > NOTE_MAX) return { ok: false, error: `«لأن…» حتى ${NOTE_MAX} حرفًا` };
  if (/https?:\/\/|<[a-z]/i.test(t)) return { ok: false, error: 'بلا روابط ولا وسوم' };
  return { ok: true, note: t };
}
export const threadKey = (from: string, to: string) => `${from}>${to}`;
export const isStationKey = (k: unknown): k is string => typeof k === 'string' && /^[a-z_]+:[A-Za-z0-9_:.\-]{1,80}$/.test(k);

/** إحداثيات حتمية: الزمن من اليمين إلى اليسار (RTL) · المسارات بحسب النوع · تذبذب خفيف لتفادي التراكب */
const LANE: Record<StationKind, number> = { placement: 0, program: 0, credential: 1, badge: 1, skill: 2, session: 3, simulation: 3, mission: 4, daily: 5, hand: 5, council: 6, case: 6, horizon: 7 };
export function layout(stations: Station[], w = 960, h = 440): MapLayout {
  const pos: Record<string, Pt> = {}; if (!stations.length) return { w, h, pos };
  const t0 = ms(stations[0].at); const t1 = ms(stations[stations.length - 1].at); const span = Math.max(1, t1 - t0);
  const padX = 70; const padY = 40; const laneH = (h - padY * 2) / 7;
  stations.forEach((s, i) => {
    const frac = span === 1 ? i / Math.max(1, stations.length - 1) : (ms(s.at) - t0) / span;
    const x = Math.round(w - padX - frac * (w - padX * 2)); const jitter = ((i * 37) % 11) - 5;
    const y = Math.round(padY + LANE[s.kind] * laneH + jitter);
    pos[s.key] = { x, y };
  });
  // تباعد أفقي أدنى داخل المسار نفسه
  const lanes = new Map<number, string[]>(); for (const s of stations) { const l = LANE[s.kind]; lanes.set(l, [...(lanes.get(l) || []), s.key]); }
  for (const keys of lanes.values()) { let last = Infinity; for (const k of keys) { const p = pos[k]; if (last - p.x < 34) p.x = Math.max(padX, last - 34); last = p.x; } }
  return { w, h, pos };
}

/** سطر المرآة — بلا حكم، بلا نسب مئوية */
export function mirror(stations: Station[], threads: Thread[]): Mirror {
  const kept = threads.filter((t) => t.status === 'kept'); const proposed = threads.filter((t) => t.status === 'proposed');
  const byRule = new Map<RuleKey, number>(); for (const t of kept) byRule.set(t.rule, (byRule.get(t.rule) || 0) + 1);
  const top = [...byRule.entries()].sort((a, b) => b[1] - a[1])[0];
  const strongest_ar = top ? `أقوى خيط في أثرك: ${RULE_AR[top[0]].title}${top[1] > 1 ? ` — ${top[1] === 2 ? 'مرّتان' : `${top[1]} مرّات`}` : ''}` : null;
  const waiting_ar = proposed.length ? (proposed.length === 1 ? 'خيط واحد ينتظر كلمتك' : proposed.length === 2 ? 'خيطان ينتظران كلمتك' : `${proposed.length} خيوط تنتظر كلمتك`) : null;
  const creds = stations.filter((s) => s.kind === 'credential'); const linked = new Set(kept.flatMap((t) => [t.from, t.to]));
  const lonely = creds.filter((c) => !linked.has(c.key)).length;
  const lonely_ar = lonely ? (lonely === 1 ? 'شهادة واحدة بلا خيط يقودها — من أين جاءت؟' : lonely === 2 ? 'شهادتان بلا خيط — من أين جاءتا؟' : `${lonely} شهادات بلا خيط — من أين جاءت؟`) : null;
  const lines_ar = [strongest_ar, waiting_ar, lonely_ar].filter(Boolean) as string[];
  if (!lines_ar.length) lines_ar.push(stations.length ? 'محطاتك هنا — والخيوط بينها كلمتك أنت' : 'أول محطة تُثبَّت هنا حين تجيب عن حالة يوم أو تُتمّ برنامجًا');
  return { strongest_ar, waiting_ar, lonely_ar, lines_ar };
}

/** الخريطة الكاملة = محطات + قرارات المتعلّم */
export function buildMap(inp: MapInput, decisions: Decision[], w?: number, h?: number): AtharMap {
  const stations = withCaseReturns(stationsOf(inp)); const keys = new Set(stations.map((s) => s.key));
  const dec = new Map(decisions.map((d) => [threadKey(d.from_key, d.to_key), d]));
  const threads: Thread[] = []; let declined = 0;
  for (const p of proposeThreads(stations)) {
    const d = dec.get(threadKey(p.from, p.to));
    if (d?.status === 'declined') { declined++; continue; }
    threads.push({ from: p.from, to: p.to, rule: p.rule, status: d?.status === 'kept' ? 'kept' : 'proposed', note_ar: d?.note_ar || null, why_ar: p.why_ar, decided_at: d?.decided_at || null, days: p.days, shared: d?.status === 'kept' && !!d.shared, voice: d?.status === 'kept' ? d.voice || null : null });
  }
  const have = new Set(threads.map((t) => threadKey(t.from, t.to)));
  for (const d of decisions) if (d.status === 'kept' && !have.has(threadKey(d.from_key, d.to_key)) && keys.has(d.from_key) && keys.has(d.to_key)) {
    const a = stations.find((s) => s.key === d.from_key)!; const b = stations.find((s) => s.key === d.to_key)!; const rule = (d.rule in RULE_AR ? d.rule : 'manual') as RuleKey;
    threads.push({ from: d.from_key, to: d.to_key, rule, status: 'kept', note_ar: d.note_ar, why_ar: rule === 'manual' ? RULE_AR.manual.why : why(rule, daysBetween(a.at, b.at)), decided_at: d.decided_at, days: daysBetween(a.at, b.at), shared: !!d.shared, voice: d.voice || null });
  }
  const by_kind: Record<string, number> = {}; for (const s of stations) by_kind[s.kind] = (by_kind[s.kind] || 0) + 1;
  return { stations, threads, declined, layout: layout(stations, w, h), mirror: mirror(stations, threads), counts: { stations: stations.length, kept: threads.filter((t) => t.status === 'kept').length, proposed: threads.filter((t) => t.status === 'proposed').length, manual: threads.filter((t) => t.rule === 'manual').length, by_kind } };
}

/** درجة المحطة (عدد الخيوط المبقاة الملامسة لها) → حجم النجمة */
export function degree(map: Pick<AtharMap, 'threads'>): Record<string, number> { const d: Record<string, number> = {}; for (const t of map.threads) if (t.status === 'kept') { d[t.from] = (d[t.from] || 0) + 1; d[t.to] = (d[t.to] || 0) + 1; } return d; }
/** سُمك الخيط: يكبر مع تفرّعات المحطة الأولى منه */
export const strokeOf = (t: Thread, deg: Record<string, number>) => t.status === 'kept' ? Math.min(5, 1.5 + 0.6 * Math.max(0, (deg[t.from] || 1) - 1)) : 1;

/** جسم اللقطة السنوية — الوجه العام فقط (بلا عناوين حسّاسة، بلا أسماء) */
export type SnapshotBody = { v: 1; type: string; year: number; stations: { key: string; kind: StationKind; at: string; title_ar: string }[]; threads: { from: string; to: string; rule: RuleKey; note_ar: string; decided_at: string | null }[]; counts: AtharMap['counts']; mirror_ar: string[]; first_at: string | null; last_at: string | null };
export function snapshotBody(map: AtharMap, year: number): SnapshotBody {
  const inYear = (at: string) => new Date(at).getUTCFullYear() <= year;
  const stations = map.stations.filter((s) => inYear(s.at)).map((s) => ({ key: s.key, kind: s.kind, at: s.at.slice(0, 10), title_ar: s.public_ar }));
  const keys = new Set(stations.map((s) => s.key));
  const threads = map.threads.filter((t) => t.status === 'kept' && keys.has(t.from) && keys.has(t.to)).map((t) => ({ from: t.from, to: t.to, rule: t.rule, note_ar: t.note_ar || '', decided_at: t.decided_at ? t.decided_at.slice(0, 10) : null }));
  const by_kind: Record<string, number> = {}; for (const s of stations) by_kind[s.kind] = (by_kind[s.kind] || 0) + 1;
  const counts = { stations: stations.length, kept: threads.length, proposed: 0, manual: threads.filter((t) => t.rule === 'manual').length, by_kind };
  const voices = map.threads.filter((t) => t.status === 'kept' && keys.has(t.from) && keys.has(t.to) && !!t.voice).length; /* P60: عدد فقط — الصوت لا يدخل اللقطة */
  const voice_line = voices === 1 ? 'خيط واحد من خيوطك بصوتك' : voices === 2 ? 'خيطان من خيوطك بصوتك' : voices > 2 ? `${voices} من خيوطك بصوتك` : null;
  return { v: 1, type: MAP_OFFICIAL.en, year, stations, threads, counts, mirror_ar: [...map.mirror.lines_ar.filter((l) => !/تنتظر كلمتك/.test(l)), ...(voice_line ? [voice_line] : [])], first_at: stations[0]?.at || null, last_at: stations[stations.length - 1]?.at || null };
}
export const CODE_RE = /^ATH-MP-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
export const snapshotTitle = (year: number) => `خريطة أثري ${year}`;
