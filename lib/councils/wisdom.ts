// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «خريطة الحكمة» (P23) — الأنماط المتكررة عبر المجالس، مجهولة: تُنشر فقط حين يقف خلف النمط ≥ k أشخاص و≥ 2 جهة
 *  RPC council_wisdom أولًا، ثم حساب من الصفوف. تغذّي الواجهة العامة والمرصد وهندسة البرامج التدريبية (برنامج يولد من قضية حقيقية).
 */
import { K_ANON, lower, themeLabel } from './registry';

export async function wisdom(db: any, k = K_ANON): Promise<{ pattern: string; label_ar: string; cases: number; persons: number; orgs: number; councils: number }[]> {
  try { const { data, error } = await db.rpc('council_wisdom', { p_k: k }); if (!error && Array.isArray(data)) return data.map((r: any) => ({ pattern: r.pattern, label_ar: themeLabel(r.pattern), cases: Number(r.cases), persons: Number(r.persons), orgs: Number(r.orgs), councils: Number(r.councils) })); } catch { /* fallback */ }
  const [{ data: sc }, { data: cs }, { data: ms }] = await Promise.all([db.from('portal_council_scribe').select('case_id,patterns').limit(5000), db.from('portal_council_cases').select('id,author_email,council_id').limit(5000), db.from('portal_council_members').select('council_id,email,organization_id').limit(5000)]);
  const caseMap = new Map(((cs || []) as any[]).map(c => [c.id, c])); const orgOf = (councilId: string, email: string) => ((ms || []) as any[]).find(m => m.council_id === councilId && lower(m.email) === lower(email))?.organization_id || null;
  const agg = new Map<string, { cases: Set<string>; persons: Set<string>; orgs: Set<string>; councils: Set<string> }>();
  for (const s of (sc || []) as any[]) { const c = caseMap.get(s.case_id); if (!c) continue; for (const p of s.patterns || []) { const a = agg.get(p) || { cases: new Set(), persons: new Set(), orgs: new Set(), councils: new Set() }; a.cases.add(c.id); a.persons.add(lower(c.author_email)); const o = orgOf(c.council_id, c.author_email); if (o) a.orgs.add(o); a.councils.add(c.council_id); agg.set(p, a); } }
  return Array.from(agg.entries()).filter(([, a]) => a.persons.size >= k && a.orgs.size >= 2).map(([pattern, a]) => ({ pattern, label_ar: themeLabel(pattern), cases: a.cases.size, persons: a.persons.size, orgs: a.orgs.size, councils: a.councils.size })).sort((x, y) => y.cases - x.cases);
}
