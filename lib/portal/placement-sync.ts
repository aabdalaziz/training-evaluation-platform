// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// مزامنة نتائج مِعيار → portal_placements + أحداث assessed (خادم فقط). يحتاج MIAAR_SUPABASE_URL + MIAAR_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';
import { parseMiaarReport, placementValid, evidenceSkills, effectiveLevel } from './placement';
import type { MiaarReportRow } from './placement';

export function miaarClient() {
  const url = process.env.MIAAR_SUPABASE_URL; const key = process.env.MIAAR_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** يستورد التقارير الجديدة (أو تقارير بريد معيّن). يُرجع عدد المستورد/المحدّث. */
export async function syncPlacements(db: any, opts: { email?: string; limit?: number; since?: string | null } = {}) {
  const miaar = miaarClient(); if (!miaar) return { ok: false, error: 'MIAAR_SUPABASE_URL / MIAAR_SERVICE_ROLE_KEY غير مضبوطين في Vercel' };
  let q = miaar.from('placement_reports').select('id, submission_id, test_version, candidate_email, created_at, report').order('created_at', { ascending: false }).limit(opts.limit || 500);
  if (opts.email) q = q.ilike('candidate_email', opts.email);
  if (opts.since) q = q.gte('created_at', opts.since);
  const { data, error } = await q; if (error) return { ok: false, error: `مِعيار: ${error.message}` };
  const rows = (data || []) as MiaarReportRow[]; if (!rows.length) return { ok: true, fetched: 0, imported: 0, skipped: 0 };
  const { data: existing } = await db.from('portal_placements').select('external_id').in('external_id', rows.map(r => String(r.id)));
  const have = new Set(((existing || []) as any[]).map(x => x.external_id));
  const { data: sk } = await db.from('portal_skills').select('id,code').in('code', ['ATH-AR-004', 'ATH-AR-005', 'ATH-AR-006']);
  const codeToId = new Map<string, string>(((sk || []) as any[]).map(x => [x.code, x.id]));
  let imported = 0, skipped = 0; const errors: string[] = [];
  for (const row of rows) {
    if (have.has(String(row.id))) { skipped++; continue; }
    const p = parseMiaarReport(row); if (!placementValid(p)) { skipped++; continue; }
    const { data: ins, error: e } = await db.from('portal_placements').insert(p).select('id,user_id').single();
    if (e) { errors.push(`${p.email}: ${e.message}`); continue; }
    imported++;
    const level = effectiveLevel(p);
    await db.from('portal_learning_events').insert({ user_id: (ins as any)?.user_id || null, email: p.email, verb: 'assessed', object_type: 'placement', object_id: (ins as any).id, skills: evidenceSkills(p, codeToId), context: { source: 'miaar', level, demonstrated: p.demonstrated_level, percent: p.overall_percent, skills: p.skills, taken_at: p.taken_at } });
    // لقطة المستوى على التسجيلات التي لا تحمل مستوى بعد
    if (level) await db.from('portal_enrollments').update({ placement_level: level, placement_id: (ins as any).id }).ilike('email', p.email).is('placement_level', null);
  }
  return { ok: true, fetched: rows.length, imported, skipped, errors: errors.length ? errors.slice(0, 5) : undefined };
}
