// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «المُوفِّق» (P23) — يقترح تشكيل المجالس من محفظة القدرة: مستويات متقاربة في المهارات المختارة · تنوّع الجهات (≥ 2) · القطاع · المتقدمون أولًا
 *  دالة نقية قابلة للاختبار + محمِّل من قاعدة البيانات. الطاقم يعتمد التشكيل — المُوفِّق يقترح فقط.
 */
import { COUNCIL_MAX, COUNCIL_MIN, MIN_ORGS, lower } from './registry';

export type Candidate = { user_id: string | null; email: string; full_name: string | null; organization_id: string | null; org_name?: string | null; sector?: string | null; level: number; evidence: number; applied?: boolean; in_council?: boolean };
export type Proposal = { members: Candidate[]; orgs: number; level_avg: number; level_spread: number; score: number; reason_ar: string };

const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

/** يكوّن مجموعات من 5–7 بأقل تباين في المستوى وأكبر تنوّع في الجهات — جشع مع حدود، لا تحسين كامل (الأعداد صغيرة) */
export function proposeCouncils(cands: Candidate[], opts: { size?: number; minOrgs?: number; sector?: string | null } = {}): Proposal[] {
  const size = Math.max(COUNCIL_MIN, Math.min(COUNCIL_MAX, opts.size || COUNCIL_MIN)); const minOrgs = opts.minOrgs ?? MIN_ORGS;
  let pool = cands.filter(c => !c.in_council && c.email); if (opts.sector) pool = pool.filter(c => !c.sector || c.sector === opts.sector);
  const seen = new Set<string>(); pool = pool.filter(c => { const k = lower(c.email); if (seen.has(k)) return false; seen.add(k); return true; });
  // المتقدمون أولًا ثم الأعلى دليلًا؛ ونرتّب بالمستوى لنجمع المتقاربين
  pool.sort((a, b) => Number(!!b.applied) - Number(!!a.applied) || a.level - b.level);
  const out: Proposal[] = []; const used = new Set<string>();
  const orgsOf = (ms: Candidate[]) => new Set(ms.map(m => m.organization_id || 'none')).size;
  for (const seed of pool) {
    if (used.has(lower(seed.email))) continue; if (pool.filter(c => !used.has(lower(c.email))).length < COUNCIL_MIN) break;
    const group: Candidate[] = [seed]; used.add(lower(seed.email));
    const rest = pool.filter(c => !used.has(lower(c.email))).sort((a, b) => Math.abs(a.level - seed.level) - Math.abs(b.level - seed.level) || Number(!!b.applied) - Number(!!a.applied));
    // جولة أولى: تنوّع الجهات؛ جولة ثانية: الأقرب مستوى
    for (const c of rest) { if (group.length >= size) break; const orgs = new Set(group.map(g => g.organization_id || 'none')); if (!orgs.has(c.organization_id || 'none') && Math.abs(c.level - seed.level) <= 1.5) { group.push(c); used.add(lower(c.email)); } }
    for (const c of rest) { if (group.length >= size) break; if (used.has(lower(c.email))) continue; const sameOrg = group.filter(g => (g.organization_id || 'none') === (c.organization_id || 'none')).length; if (sameOrg >= Math.ceil(size / 2)) continue; group.push(c); used.add(lower(c.email)); }
    if (group.length < COUNCIL_MIN || orgsOf(group) < minOrgs) { group.forEach(g => used.delete(lower(g.email))); used.add(lower(seed.email)); continue; }
    const levels = group.map(g => g.level); const spread = Math.max(...levels) - Math.min(...levels); const orgs = orgsOf(group);
    const score = Math.round(100 - spread * 15 + Math.min(orgs, 4) * 5 + group.filter(g => g.applied).length * 4);
    out.push({ members: group, orgs, level_avg: Math.round(avg(levels) * 10) / 10, level_spread: Math.round(spread * 10) / 10, score, reason_ar: `${group.length} أعضاء من ${orgs} جهات · متوسط المستوى ${(Math.round(avg(levels) * 10) / 10)} بتباين ${Math.round(spread * 10) / 10}${group.some(g => g.applied) ? ` · يضم ${group.filter(g => g.applied).length} متقدمًا طلب مقعدًا` : ''}` });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** يحمّل المرشحين: مستويات المهارات المختارة + العضوية في الجهات + المتقدمون + من هم في مجالس منعقدة الآن */
export async function loadCandidates(db: any, skillIds: string[], opts: { domain?: string | null } = {}): Promise<Candidate[]> {
  let ids = skillIds.filter(Boolean);
  if (!ids.length && opts.domain) { const { data: sk } = await db.from('portal_skills').select('id').eq('domain', opts.domain).limit(50); ids = ((sk || []) as any[]).map(s => s.id); }
  const byEmail = new Map<string, Candidate>();
  const { data: mem } = await db.from('portal_org_members').select('user_id,email,full_name,organization_id,status').eq('status', 'confirmed').limit(2000);
  const { data: orgs } = await db.from('portal_organizations').select('id,name_ar,sector').limit(500);
  const orgMap = new Map<string, any>(((orgs || []) as any[]).map(o => [o.id, o]));
  const byUser = new Map<string, Candidate>();
  for (const m of (mem || []) as any[]) { const c: Candidate = { user_id: m.user_id || null, email: lower(m.email), full_name: m.full_name || null, organization_id: m.organization_id || null, org_name: orgMap.get(m.organization_id)?.name_ar || null, sector: orgMap.get(m.organization_id)?.sector || null, level: 0, evidence: 0 }; byEmail.set(c.email, c); if (m.user_id) byUser.set(m.user_id, c); }
  if (ids.length) {
    const { data: lv } = await db.from('portal_skill_levels').select('user_id,skill_id,computed_level,approved_level,evidence').in('skill_id', ids).limit(5000);
    const acc = new Map<string, { sum: number; n: number; ev: number }>();
    for (const r of (lv || []) as any[]) { const a = acc.get(r.user_id) || { sum: 0, n: 0, ev: 0 }; a.sum += Number(r.approved_level ?? r.computed_level ?? 0); a.n++; a.ev += (r.evidence || []).length; acc.set(r.user_id, a); }
    for (const [uid, a] of acc) { const c = byUser.get(uid); if (c) { c.level = Math.round((a.sum / a.n) * 10) / 10; c.evidence = a.ev; } }
  }
  const { data: applied } = await db.from('portal_council_members').select('user_id,email,full_name,organization_id,status,council_id,note').in('status', ['applied', 'active', 'invited']).limit(2000);
  for (const a of (applied || []) as any[]) {
    const k = lower(a.email); let c = byEmail.get(k); if (!c) { c = { user_id: a.user_id || null, email: k, full_name: a.full_name || null, organization_id: a.organization_id || null, org_name: orgMap.get(a.organization_id)?.name_ar || null, sector: orgMap.get(a.organization_id)?.sector || null, level: 0, evidence: 0 }; byEmail.set(k, c); }
    if (a.status === 'applied') c.applied = true; else if (a.council_id) c.in_council = true;
  }
  // من لديهم دليل في المهارات أو تقدّموا — لا نقترح من لا أثر له
  return Array.from(byEmail.values()).filter(c => c.applied || c.evidence > 0 || c.level > 0);
}
