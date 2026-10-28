// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — مرصد القدرة البشرية (P18) — الطبقة النقية: من مستويات وأدلة مجهولة الهوية إلى إشارة عامة آمنة
 *  • «طقس القدرة» لكل قطاع: صاعد ☀ / مستقر ⛅ / يبرد 🌧 — من اتجاه مستوى الأدلة ونشاطها في آخر 90 يومًا مقارنة بما قبلها
 *  • «مؤشر أَثَر للقدرة» 0–100 لكل قطاع/مجال (المستوى 1–5 من الأدلة + الثقة)، مقرَّب إلى أقرب 5
 *  • «إشارات مبكرة»: مهارات تصعد وتبرد في كل قطاع مع «لماذا» من مزيج الأدلة — بلا أي معرّف
 *  • «الحقيقة والادعاء»: المستوى المحسوب من الأدلة مقابل ما ادّعاه الناس عن أنفسهم (التقييم الذاتي)
 *  • الخصوصية قواعد ثابتة: k ≥ 5 أشخاص و≥ 2 جهة لكل خلية قطاعية، الأعداد شرائح لا أرقامًا، لا أسماء، كتم مسجَّل بسببه
 */
import type { T } from './content';

export const OBS_VERSION = '1.0';
export const K_PERSONS = 5; export const K_ORGS = 2; export const WINDOW_DAYS = 90;
export type Weather = 'rising' | 'stable' | 'cooling' | 'unknown';
export const WEATHER_LABEL: Record<Weather, { ar: string; en: string; icon: string; color: string }> = {
  rising: { ar: 'صاعد', en: 'Rising', icon: '☀', color: '#0b8a83' }, stable: { ar: 'مستقر', en: 'Stable', icon: '⛅', color: '#c9a24b' },
  cooling: { ar: 'يبرد', en: 'Cooling', icon: '🌧', color: '#b45309' }, unknown: { ar: 'لا دليل كافٍ', en: 'Not enough evidence', icon: '·', color: '#94a3b8' },
};
export type Band = '5–9' | '10–49' | '50–199' | '200+';
export const band = (n: number): Band => (n >= 200 ? '200+' : n >= 50 ? '50–199' : n >= 10 ? '10–49' : '5–9');
export const orgBand = (n: number): string => (n >= 20 ? '20+' : n >= 10 ? '10–19' : n >= 5 ? '5–9' : '2–4');
export const round5 = (x: number) => Math.round(x / 5) * 5;
const r1 = (x: number) => Math.round(x * 10) / 10; const r2 = (x: number) => Math.round(x * 100) / 100;
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export type Person = { user_id: string; org_id: string | null; sector: string | null };
export type EvidenceLite = { kind: string; level: number; at: string };
export type PersonLevel = { user_id: string; skill_id: string; level: number; confidence: number; approved: boolean; evidence: EvidenceLite[] };
export type SkillLite = { id: string; code: string; name_ar: string; name_en?: string | null; domain: string };
export type Claim = { user_id: string; skill_id: string; level: number; at: string };
export type SectorLite = { code: string; name_ar: string; name_en: string };
export type ObsInput = { persons: Person[]; levels: PersonLevel[]; skills: SkillLite[]; claims: Claim[]; sectors: SectorLite[]; now?: Date };

export type Confidence = 'early' | 'moderate' | 'strong';
export const CONF_LABEL: Record<Confidence, T> = { early: { ar: 'أدلة أولية', en: 'Early evidence' }, moderate: { ar: 'أدلة متوسطة', en: 'Moderate evidence' }, strong: { ar: 'أدلة قوية', en: 'Strong evidence' } };
export type Cell = { people: Band; orgs: string; index: number; level: number; confidence: Confidence; approved_pct: number };
export type Signal = { skill_id: string; code: string; name_ar: string; name_en: string | null; domain: string; delta: number; people: Band; why_ar: string; why_en: string };
export type Gap = { claimed: number; actual: number; gap: number; people: Band; verdict: 'over' | 'under' | 'aligned' };
export type SectorReport = { code: string; name_ar: string; name_en: string; weather: Weather; delta: number; activity: number; cell: Cell | null; domains: { domain: string; cell: Cell }[]; rising: Signal[]; cooling: Signal[]; gap: Gap | null; suppressed: string[] };
export type DomainReport = { domain: string; weather: Weather; delta: number; cell: Cell | null };
export type Snapshot = { version: string; computed_at: string; window: { from: string; to: string; prior_from: string }; totals: { people: Band | '<5'; orgs: string; sectors_published: number; sectors_suppressed: number; evidence: string }; sectors: SectorReport[]; domains: DomainReport[]; suppressed_log: { scope: string; reason_ar: string }[]; method_ar: string[]; method_en: string[] };

const KIND_AR: Record<string, string> = { placement: 'اختبار مِعيار', mission: 'مهام من قلب العمل مؤكدة', media: 'أداء مُشاهَد', simulation: 'محاكاة', program_completed: 'إتمام برامج', credential: 'شهادات', activity: 'أنشطة تقويمية', daily_case: 'مواقف يومية', attended: 'حضور', daily: 'تحدٍّ يومي', viewed: 'اطلاع' };
const KIND_EN: Record<string, string> = { placement: 'placement tests', mission: 'supervisor-confirmed missions', media: 'observed performance', simulation: 'simulations', program_completed: 'program completions', credential: 'credentials', activity: 'assessment activities', daily_case: 'daily cases', attended: 'attendance', daily: 'daily challenges', viewed: 'views' };

export function confidenceOf(avgConf: number): Confidence { return avgConf >= 70 ? 'strong' : avgConf >= 35 ? 'moderate' : 'early'; }
/** مؤشر أَثَر للقدرة: 85% من موقع المستوى على سلّم 1–5 + حتى 15 نقطة من الثقة؛ مقرَّب إلى أقرب 5 */
export function capabilityIndex(level: number, avgConf: number): number { return Math.max(0, Math.min(100, round5(((Math.max(1, Math.min(5, level)) - 1) / 4) * 85 + Math.min(15, avgConf * 0.15)))); }
export function weatherOf(delta: number, current: number, prior: number): Weather {
  if (current < K_PERSONS && prior < K_PERSONS) return 'unknown';
  if (prior < K_PERSONS) return current >= 2 * K_PERSONS ? 'rising' : 'unknown';
  if (current < K_PERSONS) return 'cooling';
  if (delta >= 0.15 || current >= prior * 1.25) return 'rising'; if (delta <= -0.15 || current <= prior * 0.75) return 'cooling'; return 'stable';
}
function cellOf(rows: PersonLevel[], persons: Map<string, Person>, needOrgs: boolean): { cell: Cell | null; reason?: string } {
  const people = new Set(rows.map(r => r.user_id)); const orgs = new Set(rows.map(r => persons.get(r.user_id)?.org_id).filter(Boolean) as string[]);
  if (people.size < K_PERSONS) return { cell: null, reason: `أقل من ${K_PERSONS} أشخاص` }; if (needOrgs && orgs.size < K_ORGS) return { cell: null, reason: `أقل من ${K_ORGS} جهة` };
  const lv = mean(rows.map(r => r.level)); const cf = mean(rows.map(r => r.confidence));
  return { cell: { people: band(people.size), orgs: orgBand(orgs.size), index: capabilityIndex(lv, cf), level: r1(lv), confidence: confidenceOf(cf), approved_pct: round5((rows.filter(r => r.approved).length / rows.length) * 100) } };
}
function windows(rows: PersonLevel[], from: Date, priorFrom: Date) {
  const cur: { user: string; level: number; kind: string }[] = []; const pri: { user: string; level: number; kind: string }[] = [];
  for (const r of rows) for (const e of r.evidence || []) { const t = new Date(e.at).getTime(); if (!Number.isFinite(t)) continue; if (t >= from.getTime()) cur.push({ user: r.user_id, level: e.level, kind: e.kind }); else if (t >= priorFrom.getTime()) pri.push({ user: r.user_id, level: e.level, kind: e.kind }); }
  const cp = new Set(cur.map(x => x.user)).size; const pp = new Set(pri.map(x => x.user)).size; const delta = cp && pp ? r2(mean(cur.map(x => x.level)) - mean(pri.map(x => x.level))) : 0;
  return { cur, pri, cp, pp, delta, weather: weatherOf(delta, cp, pp), activity: pp ? r2(cur.length / Math.max(1, pri.length)) : cur.length ? 2 : 0 };
}
function whyOf(cur: { kind: string }[]): { ar: string; en: string } {
  if (!cur.length) return { ar: 'توقفت الأدلة الجديدة في هذه النافذة', en: 'No new evidence in this window' };
  const c = new Map<string, number>(); for (const x of cur) c.set(x.kind, (c.get(x.kind) || 0) + 1);
  const top = Array.from(c.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => ({ k, pct: round5((n / cur.length) * 100) }));
  return { ar: top.map(t => `${t.pct}% ${KIND_AR[t.k] || t.k}`).join(' · ') + ' من الأدلة الجديدة', en: top.map(t => `${t.pct}% ${KIND_EN[t.k] || t.k}`).join(' · ') + ' of new evidence' };
}
function signals(rows: PersonLevel[], skills: Map<string, SkillLite>, from: Date, priorFrom: Date): { rising: Signal[]; cooling: Signal[] } {
  const bySkill = new Map<string, PersonLevel[]>(); for (const r of rows) { if (!bySkill.has(r.skill_id)) bySkill.set(r.skill_id, []); bySkill.get(r.skill_id)!.push(r); }
  const all: Signal[] = [];
  for (const [sid, list] of bySkill) {
    const s = skills.get(sid); if (!s) continue; const w = windows(list, from, priorFrom); const people = Math.max(w.cp, w.pp); if (people < K_PERSONS) continue;
    let delta = w.delta; if (w.cp >= K_PERSONS && w.pp < K_PERSONS) delta = 0.5; if (w.cp < K_PERSONS && w.pp >= K_PERSONS) delta = -0.5; if (w.cp >= K_PERSONS && w.pp >= K_PERSONS && Math.abs(delta) < 0.1 && w.activity >= 1.5) delta = 0.1; if (w.cp >= K_PERSONS && w.pp >= K_PERSONS && Math.abs(delta) < 0.1 && w.activity <= 0.5) delta = -0.1;
    const why = whyOf(w.cur); all.push({ skill_id: sid, code: s.code, name_ar: s.name_ar, name_en: s.name_en || null, domain: s.domain, delta: r2(delta), people: band(people), why_ar: why.ar, why_en: why.en });
  }
  return { rising: all.filter(x => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3), cooling: all.filter(x => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3) };
}
function gapOf(rows: PersonLevel[], claims: Claim[]): Gap | null {
  const latest = new Map<string, Claim>(); for (const c of [...claims].sort((a, b) => a.at.localeCompare(b.at))) latest.set(`${c.user_id}:${c.skill_id}`, c);
  const pairs = rows.map(r => ({ r, c: latest.get(`${r.user_id}:${r.skill_id}`) })).filter(x => x.c) as { r: PersonLevel; c: Claim }[];
  if (new Set(pairs.map(p => p.r.user_id)).size < K_PERSONS) return null;
  const claimed = mean(pairs.map(p => p.c.level)); const actual = mean(pairs.map(p => p.r.level)); const gap = r2(claimed - actual);
  return { claimed: r1(claimed), actual: r1(actual), gap, people: band(new Set(pairs.map(p => p.r.user_id)).size), verdict: gap >= 0.3 ? 'over' : gap <= -0.3 ? 'under' : 'aligned' };
}

export function computeSnapshot(inp: ObsInput): Snapshot {
  const now = inp.now || new Date(); const from = new Date(now.getTime() - WINDOW_DAYS * 86400000); const priorFrom = new Date(now.getTime() - 2 * WINDOW_DAYS * 86400000);
  const persons = new Map(inp.persons.map(p => [p.user_id, p])); const skills = new Map(inp.skills.map(s => [s.id, s])); const log: Snapshot['suppressed_log'] = [];
  const levels = inp.levels.filter(l => skills.has(l.skill_id) && l.level >= 1);
  const sectors: SectorReport[] = [];
  for (const sec of inp.sectors) {
    const rows = levels.filter(l => persons.get(l.user_id)?.sector === sec.code); if (!rows.length) continue;
    const { cell, reason } = cellOf(rows, persons, true); const supp: string[] = [];
    if (!cell) { log.push({ scope: `قطاع ${sec.name_ar}`, reason_ar: reason! }); sectors.push({ code: sec.code, name_ar: sec.name_ar, name_en: sec.name_en, weather: 'unknown', delta: 0, activity: 0, cell: null, domains: [], rising: [], cooling: [], gap: null, suppressed: [reason!] }); continue; }
    const w = windows(rows, from, priorFrom);
    const domains: { domain: string; cell: Cell }[] = []; const byDom = new Map<string, PersonLevel[]>(); for (const r of rows) { const d = skills.get(r.skill_id)!.domain; if (!byDom.has(d)) byDom.set(d, []); byDom.get(d)!.push(r); }
    for (const [d, list] of byDom) { const c = cellOf(list, persons, true); if (c.cell) domains.push({ domain: d, cell: c.cell }); else { supp.push(`مجال ${d}: ${c.reason}`); log.push({ scope: `قطاع ${sec.name_ar} · مجال ${d}`, reason_ar: c.reason! }); } }
    const sg = signals(rows, skills, from, priorFrom); const gap = gapOf(rows, inp.claims.filter(c => persons.get(c.user_id)?.sector === sec.code)); if (!gap) supp.push('فجوة الادعاء: أقل من 5 أشخاص لديهم تقييم ذاتي');
    sectors.push({ code: sec.code, name_ar: sec.name_ar, name_en: sec.name_en, weather: w.weather, delta: w.delta, activity: w.activity, cell, domains: domains.sort((a, b) => b.cell.index - a.cell.index), rising: sg.rising, cooling: sg.cooling, gap, suppressed: supp });
  }
  const domains: DomainReport[] = []; const byDomAll = new Map<string, PersonLevel[]>(); for (const r of levels) { const d = skills.get(r.skill_id)!.domain; if (!byDomAll.has(d)) byDomAll.set(d, []); byDomAll.get(d)!.push(r); }
  for (const [d, list] of byDomAll) { const c = cellOf(list, persons, false); const w = windows(list, from, priorFrom); if (!c.cell) log.push({ scope: `مجال ${d} (كل القطاعات)`, reason_ar: c.reason! }); domains.push({ domain: d, weather: c.cell ? w.weather : 'unknown', delta: w.delta, cell: c.cell }); }
  const people = new Set(levels.map(l => l.user_id)).size; const orgs = new Set(levels.map(l => persons.get(l.user_id)?.org_id).filter(Boolean)).size; const ev = levels.reduce((s, l) => s + (l.evidence || []).length, 0);
  return {
    version: OBS_VERSION, computed_at: now.toISOString(), window: { from: from.toISOString(), to: now.toISOString(), prior_from: priorFrom.toISOString() },
    totals: { people: people >= K_PERSONS ? band(people) : '<5', orgs: orgBand(orgs), sectors_published: sectors.filter(s => s.cell).length, sectors_suppressed: sectors.filter(s => !s.cell).length, evidence: ev >= 1000 ? `${Math.floor(ev / 1000)}k+` : ev >= 100 ? `${Math.floor(ev / 100) * 100}+` : ev >= 10 ? `${Math.floor(ev / 10) * 10}+` : '<10' },
    sectors: sectors.sort((a, b) => (b.cell?.index ?? -1) - (a.cell?.index ?? -1)), domains: domains.sort((a, b) => (b.cell?.index ?? -1) - (a.cell?.index ?? -1)), suppressed_log: log,
    method_ar: [
      'المصدر: مستويات مهارات محسوبة من أدلة أداء (اختبارات مِعيار، مهام من قلب العمل مؤكدة من مشرف، أداء مُشاهَد، محاكاة، إتمام برامج) بأوزان P8، والمعتمَد بشريًا يتقدم على المحسوب.',
      `الطقس: مقارنة مستوى الأدلة ونشاطها في آخر ${WINDOW_DAYS} يومًا بالـ${WINDOW_DAYS} يومًا التي قبلها (صاعد ≥ +0.15 مستوى أو نشاط +25%؛ يبرد ≤ −0.15 أو −25%).`,
      'المؤشر 0–100: 85% من موقع المستوى على سلّم 1–5 + حتى 15 نقطة من ثقة الأدلة، مقرَّب إلى أقرب 5.',
      `الخصوصية: لا خلية بأقل من ${K_PERSONS} أشخاص أو ${K_ORGS} جهة؛ الأعداد شرائح لا أرقامًا؛ لا أسماء أفراد ولا جهات بلا إذنها؛ كل كتم مسجَّل بسببه.`,
      'الحقيقة والادعاء: متوسط التقييم الذاتي (1–5) مقابل المستوى المحسوب من الأدلة للأشخاص أنفسهم؛ موجب = ادعاء أعلى من الدليل.',
    ],
    method_en: ['Source: skill levels computed from performance evidence (placement tests, supervisor-confirmed missions, observed performance, simulations, completions) with P8 weights; human-approved levels override computed ones.', `Weather compares evidence level and activity in the last ${WINDOW_DAYS} days with the previous ${WINDOW_DAYS}.`, 'Index 0–100: 85% level position on the 1–5 scale + up to 15 points for evidence confidence, rounded to 5.', `Privacy: no cell below ${K_PERSONS} persons or ${K_ORGS} organisations; counts shown as bands; no names; every suppression is logged.`, 'Truth vs claim: mean self-rating versus evidence-based level for the same people; positive = over-claim.'],
  };
}

// ---------- موقع الجهة مقابل قطاعها (خاص بمديري الجهة) ----------
export type OrgPosition = { sector: string | null; sector_report: SectorReport | null; org_index: number | null; org_level: number | null; members_band: Band | '<5'; percentile: number | null; orgs_in_sector: number; note_ar: string };
export function orgPosition(orgId: string, inp: ObsInput, snap: Snapshot): OrgPosition {
  const persons = new Map(inp.persons.map(p => [p.user_id, p])); const org = inp.persons.find(p => p.org_id === orgId); const sector = org?.sector || null;
  const mine = inp.levels.filter(l => persons.get(l.user_id)?.org_id === orgId && l.level >= 1); const people = new Set(mine.map(l => l.user_id)).size;
  const rep = snap.sectors.find(s => s.code === sector) || null;
  if (people < K_PERSONS) return { sector, sector_report: rep, org_index: null, org_level: null, members_band: '<5', percentile: null, orgs_in_sector: 0, note_ar: `يلزم ${K_PERSONS} منسوبين على الأقل بمستويات مهارات لعرض موقع الجهة (حاليًا أقل من ذلك).` };
  const lv = mean(mine.map(l => l.level)); const cf = mean(mine.map(l => l.confidence)); const idx = capabilityIndex(lv, cf);
  const orgIdx = new Map<string, number[]>(); for (const l of inp.levels) { const p = persons.get(l.user_id); if (!p?.org_id || p.sector !== sector) continue; if (!orgIdx.has(p.org_id)) orgIdx.set(p.org_id, []); orgIdx.get(p.org_id)!.push(l.level); }
  const eligible = Array.from(orgIdx.entries()).filter(([, ls]) => ls.length >= K_PERSONS).map(([id, ls]) => ({ id, m: mean(ls) }));
  const percentile = eligible.length >= 3 ? round5((eligible.filter(o => o.m < lv).length / (eligible.length - 1 || 1)) * 100) : null;
  return { sector, sector_report: rep, org_index: idx, org_level: r1(lv), members_band: band(people), percentile, orgs_in_sector: eligible.length, note_ar: percentile === null ? 'المئين يُعرض حين تتوفر 3 جهات مؤهلة في القطاع على الأقل.' : `جهتكم أعلى من ${percentile}% من الجهات المؤهلة في قطاعكم (${eligible.length} جهة) — بلا أسماء.` };
}

// ---------- العدد الربعي ----------
export function quarterOf(d = new Date()): string { return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`; }
export const issueCode = (quarter: string) => `ATH-OBS-${quarter}`;
/** يطبّق كتمًا يدويًا (رموز قطاعات) على نسخة من اللقطة قبل النشر */
export function applySuppression(snap: Snapshot, sectorCodes: string[]): Snapshot {
  const set = new Set(sectorCodes); const copy: Snapshot = JSON.parse(JSON.stringify(snap));
  copy.sectors = copy.sectors.map(s => set.has(s.code) ? { ...s, weather: 'unknown' as Weather, delta: 0, activity: 0, cell: null, domains: [], rising: [], cooling: [], gap: null, suppressed: [...s.suppressed, 'كتم يدوي من غرفة التحرير'] } : s);
  for (const c of set) if (snap.sectors.some(s => s.code === c)) copy.suppressed_log.push({ scope: `قطاع ${c}`, reason_ar: 'كتم يدوي من غرفة التحرير' });
  copy.totals.sectors_published = copy.sectors.filter(s => s.cell).length; copy.totals.sectors_suppressed = copy.sectors.filter(s => !s.cell).length; return copy;
}
/** وثيقة VC للعدد الربعي (تُوقَّع بمفتاح P17): بيان بيانات مفتوحة قابل للتحقق */
export function buildIssueDoc(inp: { quarter: string; snapshot: Snapshot; editorial_ar: string; digest: string; site: string; did: string; now?: Date; statusIndex: number | null; prev_code?: string | null }) {
  const now = inp.now || new Date(); const code = issueCode(inp.quarter); const url = `${inp.site}/observatory?issue=${encodeURIComponent(inp.quarter)}`;
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2'], id: url, type: ['VerifiableCredential', 'AtharObservatoryIssue'], name: `Athar Human Capability Observatory — ${inp.quarter}`,
    issuer: { id: inp.did, type: ['Profile'], name: 'Athar · TRACE — Human Capability Observatory', url: inp.site }, validFrom: now.toISOString(),
    credentialSubject: { id: `${url}#dataset`, type: ['Dataset'], name: `Human capability signal — ${inp.quarter}`, license: 'https://creativecommons.org/licenses/by/4.0/', version: inp.snapshot.version, computed_at: inp.snapshot.computed_at,
      sectors: inp.snapshot.sectors.map(s => ({ code: s.code, name: s.name_en, weather: s.weather, index: s.cell?.index ?? null, level: s.cell?.level ?? null, people: s.cell?.people ?? null })), totals: inp.snapshot.totals, dataDigestSha256: inp.digest, ...(inp.prev_code ? { previousIssue: inp.prev_code } : {}) },
    ...(inp.statusIndex !== null ? { credentialStatus: { id: `${inp.site}/api/vc?status=1#${inp.statusIndex}`, type: 'BitstringStatusListEntry', statusPurpose: 'revocation', statusListIndex: String(inp.statusIndex), statusListCredential: `${inp.site}/api/vc?status=1` } } : {}),
    _athar: { kind: 'observatory_issue', code, quarter: inp.quarter, editorial_ar: inp.editorial_ar.slice(0, 2000), verify_url: `${inp.site}/verify/vc?code=${encodeURIComponent(code)}`, data_url: `${inp.site}/api/observatory?issue=${encodeURIComponent(inp.quarter)}`, owner: '© 2026 Dr. Ahmed Mohamed Abdelaziz Badawi' },
  };
}

// ---------- CSV للبيانات المفتوحة ----------
export function snapshotCsv(s: Snapshot): string {
  const esc = (v: any) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows: any[][] = [['scope', 'code', 'name_ar', 'name_en', 'weather', 'delta', 'index', 'level', 'confidence', 'people_band', 'orgs_band', 'approved_pct', 'computed_at', 'version', 'license']];
  for (const x of s.sectors) rows.push(['sector', x.code, x.name_ar, x.name_en, x.weather, x.delta, x.cell?.index ?? '', x.cell?.level ?? '', x.cell?.confidence ?? 'suppressed', x.cell?.people ?? '', x.cell?.orgs ?? '', x.cell?.approved_pct ?? '', s.computed_at, s.version, 'CC BY 4.0']);
  for (const x of s.sectors) for (const d of x.domains) rows.push(['sector_domain', `${x.code}/${d.domain}`, x.name_ar, x.name_en, '', '', d.cell.index, d.cell.level, d.cell.confidence, d.cell.people, d.cell.orgs, d.cell.approved_pct, s.computed_at, s.version, 'CC BY 4.0']);
  for (const d of s.domains) rows.push(['domain', d.domain, '', '', d.weather, d.delta, d.cell?.index ?? '', d.cell?.level ?? '', d.cell?.confidence ?? 'suppressed', d.cell?.people ?? '', d.cell?.orgs ?? '', d.cell?.approved_pct ?? '', s.computed_at, s.version, 'CC BY 4.0']);
  return '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\n');
}
/** تغيّر الطقس بين لقطتين — لإبلاغ الجهات المشتركة */
export function weatherChanges(prev: Snapshot | null, next: Snapshot): { code: string; name_ar: string; from: Weather; to: Weather }[] {
  if (!prev) return []; const out: { code: string; name_ar: string; from: Weather; to: Weather }[] = [];
  for (const s of next.sectors) { const p = prev.sectors.find(x => x.code === s.code); if (p && p.weather !== s.weather && s.weather !== 'unknown' && p.weather !== 'unknown') out.push({ code: s.code, name_ar: s.name_ar, from: p.weather, to: s.weather }); }
  return out;
}
