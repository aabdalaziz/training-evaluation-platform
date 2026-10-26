// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — التوأم المهاري الرقمي (P11) — محرّك حسابي نقيّ (بلا نموذج لغوي)
 *  لكل مهارة: المستوى الآن، «الطزاجة» (منحنى نسيان إبنجهاوس مُعدّل بعمر النصف)، السرعة، موعد «الصدأ»،
 *  إسقاط المستقبل (+90/+180/+365) بنطاق ثقة، تأثير الأنشطة المخطّطة (what-if)، «أرخص مسار» إلى مستوى مستهدف،
 *  إعادة بناء الماضي من الأدلة، كوكبة المهارات (تخطيط هندسي ثابت)، وتوأم المؤسسة (تجميع).
 *  يعمل على الخادم والمتصفح معًا؛ نفس الدوال تغذّي /me/twin و/credential/[code] و/admin/twin واختبارات node:test.
 */
import type { EvidenceKind } from './profile';
import type { Lang } from './content';

export type TwinEvidence = { kind: EvidenceKind | string; level: number; weight: number; at: string; label?: string };
export type TwinSkillInput = { skill_id: string; computed_level: number; approved_level?: number | null; confidence: number; evidence: TwinEvidence[] };
export type TwinStatus = 'bright' | 'fading' | 'rusty' | 'dormant';
export type TwinSkill = {
  skill_id: string; level_now: number; approved: boolean; confidence: number; evidence_count: number; last_at: string | null; days_since: number | null;
  half_life: number; freshness: number; velocity: number; rust_in_days: number | null; rust_at: string | null; status: TwinStatus; floor: number;
  kinds: Record<string, number>;
};
export type Projection = { day: number; level: number; lo: number; hi: number; freshness: number };
export type PlannedKind = 'program' | 'simulation' | 'daily' | 'session' | 'activity';
export type PlannedActivity = { kind: PlannedKind; day: number; skills: string[]; label?: string; weight?: number; target_level?: number };

export const DAY = 86400000;
/** أثر كل نوع نشاط على المستوى (قبل تخفيض الإشباع) */
export const GAIN: Record<PlannedKind, number> = { program: 0.6, simulation: 0.3, activity: 0.25, session: 0.15, daily: 0.03 };
export const RUST_THRESHOLD = 40; // الطزاجة التي تُعدّ عندها المهارة «صدئة»
export const FADE_THRESHOLD = 70;

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
export const daysBetween = (a: Date | string, b: Date | string) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;

/** عمر النصف (أيام): يزداد مع كثافة الأدلة وتباعدها (التكرار المتباعد يثبّت)، ويطول مع اعتماد بشري. 45 → 365 يومًا */
export function halfLife(ev: TwinEvidence[], approved = false): number {
  const wsum = ev.reduce((s, e) => s + (Number(e.weight) || 0), 0);
  const days = ev.map(e => new Date(e.at).getTime()).filter(Number.isFinite).sort((a, b) => a - b);
  const span = days.length > 1 ? (days[days.length - 1] - days[0]) / DAY : 0; // تباعد الممارسة
  let h = 45 * (1 + 0.55 * Math.log(1 + wsum)) + Math.min(90, span / 4);
  if (approved) h *= 1.4;
  return Math.round(clamp(h, 45, 365));
}
/** الطزاجة 0..100 بعد t يومًا من آخر دليل، بعمر نصف h */
export const freshnessAfter = (daysSince: number, h: number) => clamp(Math.round(100 * Math.pow(2, -Math.max(0, daysSince) / h)), 0, 100);
export const statusOf = (freshness: number, hasEvidence: boolean): TwinStatus => !hasEvidence ? 'dormant' : freshness >= FADE_THRESHOLD ? 'bright' : freshness >= RUST_THRESHOLD ? 'fading' : 'rusty';
/** الأيام من آخر دليل حتى عبور عتبة الصدأ */
export const rustHorizon = (h: number, threshold = RUST_THRESHOLD) => Math.round(h * Math.log2(100 / threshold));

/** السرعة: تغيّر المستوى لكل 30 يومًا (انحدار خطي مرجّح على آخر 180 يومًا من الأدلة) */
export function velocityOf(ev: TwinEvidence[], now: Date): number {
  const pts = ev.map(e => ({ x: -Math.max(0, daysBetween(e.at, now)), y: Number(e.level) || 0, w: Number(e.weight) || 0.1 })).filter(p => p.x >= -180 && Number.isFinite(p.y));
  if (pts.length < 2) return 0;
  const W = pts.reduce((s, p) => s + p.w, 0); const mx = pts.reduce((s, p) => s + p.w * p.x, 0) / W; const my = pts.reduce((s, p) => s + p.w * p.y, 0) / W;
  let num = 0, den = 0; for (const p of pts) { num += p.w * (p.x - mx) * (p.y - my); den += p.w * (p.x - mx) ** 2; }
  if (!den) return 0; return round2(clamp((num / den) * 30, -1.5, 1.5));
}

/** يبني توأم مهارة واحدة من صفّ مستوى المهارة (P8) */
export function twinSkill(row: TwinSkillInput, now = new Date()): TwinSkill {
  const ev = (row.evidence || []).filter(e => e && e.at);
  const approved = row.approved_level !== null && row.approved_level !== undefined;
  const level_now = round2(approved ? Number(row.approved_level) : Number(row.computed_level) || 0);
  const last = ev.length ? ev.map(e => e.at).sort().slice(-1)[0] : null;
  const days_since = last ? Math.max(0, Math.floor(daysBetween(last, now))) : null;
  const h = halfLife(ev, approved);
  const freshness = last ? freshnessAfter(days_since || 0, h) : 0;
  const horizon = rustHorizon(h); const rust_in_days = last ? horizon - (days_since || 0) : null;
  const rust_at = last ? new Date(new Date(last).getTime() + horizon * DAY).toISOString() : null;
  const kinds: Record<string, number> = {}; for (const e of ev) kinds[String(e.kind)] = (kinds[String(e.kind)] || 0) + 1;
  // أرضية الاحتفاظ: الإهمال لا يُفقد أكثر من 1.5 مستوى (مستوى واحد إن كان معتمدًا) — الذاكرة طويلة المدى
  const floor = round2(Math.max(1, level_now - (approved ? 1 : 1.5)));
  return { skill_id: row.skill_id, level_now, approved, confidence: Number(row.confidence) || 0, evidence_count: ev.length, last_at: last, days_since, half_life: h, freshness, velocity: velocityOf(ev, now), rust_in_days, rust_at, status: statusOf(freshness, !!last), floor, kinds };
}

/** المستوى بعد t يومًا بلا نشاط: اضمحلال أسّي نحو الأرضية */
export function decayLevel(level: number, floor: number, daysSinceLast: number, h: number): number {
  return round2(floor + (level - floor) * Math.pow(2, -Math.max(0, daysSinceLast) / h));
}
/** مكسب نشاط واحد مع إشباع: كلما ارتفع المستوى صَغُر المكسب؛ لا يتجاوز 5 ولا الهدف المحدد */
export function applyGain(level: number, kind: PlannedKind, weight = 1, target = 5): number {
  const g = GAIN[kind] * weight * (1 - 0.18 * clamp(level - 1, 0, 4)); // تشبّع: كلما ارتفع المستوى صَغُر أثر النشاط الواحد
  return round2(clamp(Math.min(level + g, Math.max(level, target)), 1, 5));
}

/** إسقاط مسار مهارة واحدة من اليوم 0 حتى horizon، مع أنشطة مخطّطة (تُعيد النشاط عدّاد الطزاجة وتضيف مكسبًا) */
export function projectSkill(s: TwinSkill, horizon = 180, plan: PlannedActivity[] = [], step = 15): Projection[] {
  const acts = plan.filter(a => a.skills.includes(s.skill_id) && a.day >= 0 && a.day <= horizon).sort((a, b) => a.day - b.day);
  const out: Projection[] = []; let level = s.level_now; let lastDay = -(s.days_since ?? 0); let floor = s.floor; let h = s.half_life; let ai = 0;
  const spread = 0.12 + 0.6 * (1 - clamp(s.confidence, 0, 100) / 100);
  const days = Array.from(new Set([0, ...Array.from({ length: Math.floor(horizon / step) }, (_, i) => (i + 1) * step), horizon, ...acts.map(a => a.day)])).sort((a, b) => a - b);
  for (const d of days) {
    // طبّق الأنشطة التي حان يومها
    while (ai < acts.length && acts[ai].day <= d) { const a = acts[ai++]; const base = decayLevel(level, floor, a.day - lastDay, h); level = applyGain(base, a.kind, a.weight ?? 1, a.target_level ?? 5); lastDay = a.day; floor = round2(Math.max(floor, level - 1.5)); h = Math.min(365, Math.round(h * 1.08)); }
    const lv = s.last_at || acts.length ? decayLevel(level, floor, d - lastDay, h) : level;
    const band = spread * Math.sqrt(Math.max(d, 1) / 90);
    out.push({ day: d, level: lv, lo: round2(clamp(lv - band, 1, 5)), hi: round2(clamp(lv + band, 1, 5)), freshness: s.last_at || acts.length ? freshnessAfter(d - lastDay, h) : 0 });
  }
  return out;
}
export const levelAt = (s: TwinSkill, day: number, plan: PlannedActivity[] = []) => { const p = projectSkill(s, Math.max(day, 1), plan, Math.max(day, 1)); return p[p.length - 1]; };

/** إعادة بناء المستوى في تاريخ ماضٍ من الأدلة التي سبقته (متوسط مرجّح كما في P8) — null إن لم تولد المهارة بعد */
export function levelAtPast(ev: TwinEvidence[], at: Date): number | null {
  const prior = ev.filter(e => new Date(e.at).getTime() <= at.getTime()); if (!prior.length) return null;
  let ws = 0, ls = 0; for (const e of prior) { const age = daysBetween(e.at, at); const rec = age > 365 ? 0.6 : age > 180 ? 0.8 : 1; const w = (Number(e.weight) || 0.1) * rec; ws += w; ls += (Number(e.level) || 0) * w; }
  return ws ? round2(ls / ws) : null;
}

// ================================================================ أرخص مسار إلى مستوى مستهدف
export type PathOption = { id: string; kind: PlannedKind; label: string; skills: string[]; hours: number; cost: number; start_day?: number; duration_days?: number; weight?: number; href?: string };
export type PathStep = { option: PathOption; day: number; level_after: number };
export type PathResult = { reachable: boolean; target: number; weeks: number; level_start: number; level_end: number; steps: PathStep[]; hours: number; cost: number; note_ar: string };

/** جشع بسيط: كل أسبوع اختر النشاط الأعلى «مكسب/ساعة» المتاح (برنامج مرة واحدة، محاكاة مرة أسبوعيًا، يومي 5 مرات أسبوعيًا) */
export function cheapestPath(s: TwinSkill, target: number, weeks: number, options: PathOption[]): PathResult {
  const horizon = weeks * 7; let level = s.level_now; const steps: PathStep[] = []; const used = new Set<string>(); let hours = 0, cost = 0;
  const avail = options.filter(o => o.skills.includes(s.skill_id));
  for (let w = 0; w < weeks && level < target; w++) {
    const day = w * 7;
    const cands = avail.filter(o => (o.kind !== 'program' || !used.has(o.id)) && (o.start_day === undefined || o.start_day <= day + 7)).map(o => {
      const after = applyGain(level, o.kind, o.weight ?? 1, target); const gain = after - level; const h = Math.max(0.25, o.hours || 0.25);
      return { o, after, gain, score: gain / h - (o.cost || 0) / 10000 };
    }).filter(c => c.gain > 0.001).sort((a, b) => b.score - a.score);
    if (!cands.length) break;
    const best = cands[0]; let lv = best.after;
    steps.push({ option: best.o, day: Math.max(day, best.o.start_day ?? day), level_after: lv }); used.add(best.o.id); hours += best.o.hours || 0; cost += best.o.cost || 0; level = lv;
    // أنشطة خفيفة مكمّلة في نفس الأسبوع: يومي ×5
    const daily = avail.find(o => o.kind === 'daily'); if (daily && level < target) { for (let i = 0; i < 5 && level < target; i++) level = applyGain(level, 'daily', daily.weight ?? 1, target); steps.push({ option: daily, day: day + 1, level_after: level }); hours += (daily.hours || 0) * 5; }
  }
  const reachable = level >= target - 0.01;
  const note_ar = reachable ? `يمكن الوصول إلى المستوى ${target} خلال ${Math.ceil((steps.length ? steps[steps.length - 1].day + 7 : 7) / 7)} أسبوع تقريبًا بـ ${Math.round(hours)} ساعة.` : avail.length ? `الهدف طموح لهذه المدة: المتوقع ${level.toFixed(1)} بعد ${weeks} أسبوعًا — زد المدة أو أضف برنامجًا يغطّي المهارة.` : 'لا توجد بعدُ أنشطة مرتبطة بهذه المهارة في الكتالوج — تواصل معنا لنصمّم مسارًا.';
  return { reachable, target, weeks, level_start: s.level_now, level_end: round2(level), steps, hours: Math.round(hours * 10) / 10, cost, note_ar };
}

// ================================================================ كوكبة المهارات (تخطيط ثابت بلا عشوائية)
export type StarLayout = { skill_id: string; x: number; y: number; r: number; opacity: number; angle: number; ring: number };
/** المجالات قطاعات زاوية؛ المستوى الأعلى أقرب للمركز؛ الحجم من الثقة؛ الشفافية من الطزاجة */
export function constellation(items: { skill_id: string; domain: string; level: number; confidence: number; freshness: number }[], domains: string[], size = 520): StarLayout[] {
  const cx = size / 2, cy = size / 2; const sector = (2 * Math.PI) / Math.max(1, domains.length);
  const byDomain = new Map<string, typeof items>(); for (const it of items) { const k = domains.includes(it.domain) ? it.domain : domains[0]; if (!byDomain.has(k)) byDomain.set(k, []); byDomain.get(k)!.push(it); }
  const out: StarLayout[] = [];
  for (const [d, list] of byDomain) {
    const di = Math.max(0, domains.indexOf(d)); const a0 = di * sector - Math.PI / 2 + sector * 0.12; const span = sector * 0.76;
    list.sort((a, b) => b.level - a.level).forEach((it, i) => {
      const angle = a0 + (list.length === 1 ? span / 2 : (span * i) / (list.length - 1));
      const ring = clamp(5 - it.level, 0, 4); const rad = size * (0.12 + 0.075 * ring) + (i % 2) * 10;
      out.push({ skill_id: it.skill_id, x: Math.round(cx + rad * Math.cos(angle)), y: Math.round(cy + rad * Math.sin(angle)), r: Math.round(4 + clamp(it.confidence, 0, 100) / 14), opacity: Math.round((0.3 + 0.7 * clamp(it.freshness, 0, 100) / 100) * 100) / 100, angle, ring });
    });
  }
  return out;
}

// ================================================================ توأم المؤسسة
export type OrgTwinRow = { domain: string; members: number; skills: number; level_now: number; level_180_a: number; level_180_b: number; rusty_now: number; rusty_180_a: number; rusty_180_b: number };
/** السياسة أ: لا تدخّل. السياسة ب: محاكاة واحدة شهريًا لكل عضو في كل مهارة نشطة */
export function orgTwin(rows: (TwinSkillInput & { user_id: string; domain: string })[], now = new Date()): { domains: OrgTwinRow[]; members: number; skills: number; rusty_now: number } {
  const byDomain = new Map<string, { users: Set<string>; ts: TwinSkill[] }>();
  for (const r of rows) { const t = twinSkill(r, now); if (!byDomain.has(r.domain)) byDomain.set(r.domain, { users: new Set(), ts: [] }); const g = byDomain.get(r.domain)!; g.users.add(r.user_id); g.ts.push(t); }
  const planB = (sid: string): PlannedActivity[] => [30, 60, 90, 120, 150, 180].map(day => ({ kind: 'simulation', day, skills: [sid] }));
  const domains: OrgTwinRow[] = []; const allUsers = new Set<string>(); let skills = 0, rustyNow = 0;
  for (const [domain, g] of byDomain) {
    g.users.forEach(u => allUsers.add(u)); skills += g.ts.length;
    const avg = (f: (t: TwinSkill) => number) => g.ts.length ? Math.round((g.ts.reduce((s, t) => s + f(t), 0) / g.ts.length) * 100) / 100 : 0;
    const cnt = (f: (t: TwinSkill) => boolean) => g.ts.filter(f).length;
    const a = g.ts.map(t => levelAt(t, 180)); const b = g.ts.map(t => levelAt(t, 180, planB(t.skill_id)));
    const rn = cnt(t => t.status === 'rusty'); rustyNow += rn;
    domains.push({ domain, members: g.users.size, skills: g.ts.length, level_now: avg(t => t.level_now), level_180_a: Math.round(a.reduce((s, p) => s + p.level, 0) / a.length * 100) / 100, level_180_b: Math.round(b.reduce((s, p) => s + p.level, 0) / b.length * 100) / 100, rusty_now: rn, rusty_180_a: a.filter(p => p.freshness < RUST_THRESHOLD).length, rusty_180_b: b.filter(p => p.freshness < RUST_THRESHOLD).length });
  }
  return { domains: domains.sort((x, y) => y.skills - x.skills), members: allUsers.size, skills, rusty_now: rustyNow };
}

// ================================================================ الشهادة الحية
export type LiveSkill = { code: string; name_ar: string; name_en: string | null; domain: string; level_issue: number | null; level_now: number; approved: boolean; freshness: number; status: TwinStatus; last_at: string | null; evidence_count: number; rust_in_days: number | null };
export type LiveSnapshot = Record<string, { level: number; status: TwinStatus }>;
export function pulseOf(items: { freshness: number }[]): number { return items.length ? Math.round(items.reduce((s, i) => s + i.freshness, 0) / items.length) : 0; }
export function snapshotOf(items: LiveSkill[]): LiveSnapshot { const o: LiveSnapshot = {}; for (const i of items) o[i.code] = { level: Math.round(i.level_now * 10) / 10, status: i.status }; return o; }
/** الفروق بين لقطتين (للإشعارات الأسبوعية) */
export function diffSnapshots(prev: LiveSnapshot | null | undefined, cur: LiveSnapshot): { code: string; from: number | null; to: number; status_from: TwinStatus | null; status_to: TwinStatus }[] {
  const out: ReturnType<typeof diffSnapshots> = [];
  for (const code of Object.keys(cur)) { const p = prev?.[code]; const c = cur[code]; if (!p || Math.abs(p.level - c.level) >= 0.1 || p.status !== c.status) out.push({ code, from: p?.level ?? null, to: c.level, status_from: p?.status ?? null, status_to: c.status }); }
  return out;
}

/** يحوّل ناتج portal_living_credential إلى حمولة عامة مع حساب التوأم لكل مهارة */
export function buildLiving(v: any, now = new Date()) {
  if (!v || !v.ok) return { ok: false };
  const skills: any[] = Array.isArray(v.skills) ? v.skills : []; const levels: any[] = Array.isArray(v.levels) ? v.levels : [];
  const issued = v.issued_at ? new Date(v.issued_at) : now;
  const live: LiveSkill[] = []; const chain: { kind: string; at: string; label: string; skill: string }[] = [];
  for (const s of skills) {
    const row = levels.find(l => l.skill_id === s.id);
    if (!row) { live.push({ code: s.code, name_ar: s.name_ar, name_en: s.name_en, domain: s.domain, level_issue: null, level_now: 0, approved: false, freshness: 0, status: 'dormant', last_at: null, evidence_count: 0, rust_in_days: null }); continue; }
    const t = twinSkill({ skill_id: s.id, computed_level: Number(row.computed_level) || 0, approved_level: row.approved_level, confidence: Number(row.confidence) || 0, evidence: row.evidence || [] }, now);
    live.push({ code: s.code, name_ar: s.name_ar, name_en: s.name_en, domain: s.domain, level_issue: levelAtPast(row.evidence || [], issued), level_now: t.level_now, approved: t.approved, freshness: t.freshness, status: t.status, last_at: t.last_at ? t.last_at.slice(0, 10) : null, evidence_count: t.evidence_count, rust_in_days: t.rust_in_days });
    for (const e of (row.evidence || []) as any[]) chain.push({ kind: String(e.kind || ''), at: String(e.at || '').slice(0, 10), label: String(e.label ?? '').trim().slice(0, 80), skill: s.code });
  }
  chain.sort((a, b) => b.at.localeCompare(a.at));
  const withEvidence = live.filter(l => l.evidence_count > 0);
  return {
    ok: true, code: v.code, kind: v.kind, title_ar: v.title_ar, title_en: v.title_en, full_name: v.full_name, level: v.level, hours: v.hours, issued_at: v.issued_at, valid_until: v.valid_until, revoked: !!v.revoked, program: v.program, badge: v.badge,
    live: !!v.live, skills: skills.map(s => ({ code: s.code, name_ar: s.name_ar, name_en: s.name_en, domain: s.domain, saqf_level: s.saqf_level, cefr_level: s.cefr_level, sdaia_code: s.sdaia_code })),
    pulse: v.live ? pulseOf(withEvidence) : null, levels: v.live ? live : [], chain: v.live ? chain.slice(0, 24) : [], evidence_total: v.live ? chain.length : 0,
    last_evidence_at: v.live && chain.length ? chain[0].at : null, watchers: Number(v.watchers) || 0, snapshot: v.live ? snapshotOf(live) : {}, computed_at: now.toISOString(),
  };
}

// ================================================================ تسميات
export const STATUS_LABEL: Record<TwinStatus, { ar: string; en: string; color: string }> = {
  bright: { ar: 'متوهّجة', en: 'Bright', color: '#0b8a83' }, fading: { ar: 'تخفت', en: 'Fading', color: '#c9a24b' }, rusty: { ar: 'صدئة', en: 'Rusty', color: '#b45309' }, dormant: { ar: 'خامدة', en: 'Dormant', color: '#94a3b8' },
};
export const statusLabel = (s: TwinStatus, lang: Lang) => STATUS_LABEL[s][lang === 'en' ? 'en' : 'ar'];
export function rustSentence(s: TwinSkill, name: string, lang: Lang): string {
  if (!s.last_at) return lang === 'ar' ? `«${name}» بلا أدلة بعد — نشاط واحد يوقظها.` : `“${name}” has no evidence yet — one activity wakes it.`;
  if (s.status === 'rusty') return lang === 'ar' ? `«${name}» صدئت منذ ${Math.abs(s.rust_in_days || 0)} يومًا — محاكاة واحدة تعيد توهّجها.` : `“${name}” rusted ${Math.abs(s.rust_in_days || 0)} days ago — one simulation restores it.`;
  if ((s.rust_in_days || 0) <= 21) return lang === 'ar' ? `«${name}» ستصدأ خلال ${s.rust_in_days} يومًا إن توقفت.` : `“${name}” will rust in ${s.rust_in_days} days if you stop.`;
  return lang === 'ar' ? `«${name}» متوهّجة؛ تصمد ${s.rust_in_days} يومًا بلا ممارسة.` : `“${name}” is bright; it holds ${s.rust_in_days} days without practice.`;
}
export const fmtLevel = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
