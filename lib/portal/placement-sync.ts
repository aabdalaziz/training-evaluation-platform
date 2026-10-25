// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// مزامنة نتائج مِعيار → portal_placements + أحداث assessed (خادم فقط). يحتاج MIAAR_SUPABASE_URL + MIAAR_SERVICE_ROLE_KEY
import { createClient } from '@supabase/supabase-js';
import { parseMiaarReport, placementValid, evidenceSkills, effectiveLevel } from './placement';
import type { MiaarReportRow } from './placement';

/** يحوّل أي صيغة للرابط إلى https://<ref>.supabase.co — يقبل رابط لوحة التحكم أو رابطًا بمسار زائد أو معرّف المشروع فقط */
export function resolveMiaarUrl(raw: string | undefined): string | null {
  const v = (raw || '').trim().replace(/^['"]|['"]$/g, ''); if (!v) return null;
  if (/^[a-z]{20}$/i.test(v)) return `https://${v.toLowerCase()}.supabase.co`;                    // معرّف المشروع فقط
  const m = v.match(/\/project\/([a-z]{20})(?:[/?#]|$)/i); if (m) return `https://${m[1].toLowerCase()}.supabase.co`; // رابط لوحة التحكم
  try { const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); if (!u.hostname.includes('.')) return null; return `${u.protocol}//${u.host}`; } catch { return null; } // يزيل أي مسار زائد
}
/** يفحص إعدادات مِعيار ويُرجع رسالة الخطأ (بلا أسرار) أو null إن كانت سليمة */
export function miaarConfigError(): string | null {
  const raw = (process.env.MIAAR_SUPABASE_URL || '').trim(); const key = (process.env.MIAAR_SERVICE_ROLE_KEY || '').trim();
  if (!raw && !key) return 'MIAAR_SUPABASE_URL و MIAAR_SERVICE_ROLE_KEY غير مضبوطين في Vercel';
  if (!raw) return 'MIAAR_SUPABASE_URL غير مضبوط في Vercel';
  if (!key) return 'MIAAR_SERVICE_ROLE_KEY غير مضبوط في Vercel';
  const url = resolveMiaarUrl(raw); if (!url) return `MIAAR_SUPABASE_URL غير صالح («${raw.slice(0, 24)}…») — يجب أن يكون رابط المشروع مثل https://xxxxxxxx.supabase.co`;
  if (!/^(sb_secret_|eyJ)/.test(key)) return 'MIAAR_SERVICE_ROLE_KEY لا يبدو مفتاحًا سريًا (يبدأ بـ sb_secret_ أو eyJ)';
  return null;
}
export function miaarClient() {
  if (miaarConfigError()) return null;
  try { return createClient(resolveMiaarUrl(process.env.MIAAR_SUPABASE_URL) as string, (process.env.MIAAR_SERVICE_ROLE_KEY || '').trim(), { auth: { persistSession: false, autoRefreshToken: false } }); } catch { return null; }
}

/** يستورد التقارير الجديدة (أو تقارير بريد معيّن). يُرجع عدد المستورد/المحدّث. */
export async function syncPlacements(db: any, opts: { email?: string; limit?: number; since?: string | null } = {}) {
  const cfg = miaarConfigError(); const miaar = miaarClient(); if (cfg || !miaar) return { ok: false, error: cfg || 'تعذّر إنشاء اتصال مِعيار' };
  let q = miaar.from('placement_reports').select('id, submission_id, test_version, candidate_email, created_at, report').order('created_at', { ascending: false }).limit(opts.limit || 500);
  if (opts.email) q = q.ilike('candidate_email', opts.email);
  if (opts.since) q = q.gte('created_at', opts.since);
  const { data, error } = await q; if (error) return { ok: false, error: `مِعيار: ${error.message}` };
  const rows = (data || []) as MiaarReportRow[]; if (!rows.length) return { ok: true, fetched: 0, imported: 0, skipped: 0 };
  const { data: existing } = await db.from('portal_placements').select('external_id').in('external_id', rows.map(r => String(r.id)));
  const have = new Set(((existing || []) as any[]).map(x => x.external_id));
  const { data: sk } = await db.from('portal_skills').select('id,code').in('code', ['ATH-AR-004', 'ATH-AR-005', 'ATH-AR-006']);
  const codeToId = new Map<string, string>(((sk || []) as any[]).map(x => [x.code, x.id]));
  let skipped = 0; const errors: string[] = [];
  const fresh = rows.filter(r => { if (have.has(String(r.id))) { skipped++; return false; } return true; }).map(parseMiaarReport).filter(p => { if (!placementValid(p)) { skipped++; return false; } return true; });
  if (!fresh.length) return { ok: true, fetched: rows.length, imported: 0, skipped };
  // إدراج دفعة واحدة (سرعة + ضمن مهلة الخادم)
  const { data: ins, error: e } = await db.from('portal_placements').insert(fresh).select('id,external_id,email,user_id');
  if (e) return { ok: false, error: `أَثَر: ${e.message}`, fetched: rows.length, imported: 0, skipped };
  const byExt = new Map<string, any>(((ins || []) as any[]).map(x => [x.external_id, x]));
  const events = fresh.map(p => { const row = byExt.get(p.external_id); return row ? { user_id: row.user_id || null, email: p.email, verb: 'assessed', object_type: 'placement', object_id: row.id, skills: evidenceSkills(p, codeToId), context: { source: 'miaar', level: effectiveLevel(p), demonstrated: p.demonstrated_level, percent: p.overall_percent, skills: p.skills, taken_at: p.taken_at } } : null; }).filter(Boolean);
  if (events.length) { const { error: ee } = await db.from('portal_learning_events').insert(events); if (ee) errors.push(`events: ${ee.message}`); }
  // لقطة المستوى على التسجيلات التي لا تحمل مستوى بعد (أحدث نتيجة لكل بريد)
  const latest = new Map<string, { level: string; id: string }>();
  for (const p of [...fresh].sort((a, b) => a.taken_at.localeCompare(b.taken_at))) { const lv = effectiveLevel(p); const row = byExt.get(p.external_id); if (lv && row) latest.set(p.email, { level: lv, id: row.id }); }
  for (const [email, x] of latest) { const { error: ue } = await db.from('portal_enrollments').update({ placement_level: x.level, placement_id: x.id }).ilike('email', email).is('placement_level', null); if (ue) { errors.push(`enrollments: ${ue.message}`); break; } }
  return { ok: true, fetched: rows.length, imported: fresh.length, skipped, errors: errors.length ? errors.slice(0, 5) : undefined };
}
