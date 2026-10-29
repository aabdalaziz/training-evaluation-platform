// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر (P21) — المهمة اليومية (تُستدعى من كرون /api/followups/send الموجود — لا كرون جديد):
 *  1) تنظيف الدلاء والأحداث القديمة (shield_gc) · 2) التمرين الذاتي وحفظه حدثًا · 3) إن فشل اختبار أو بقي حدث حرج بلا معالجة > 24 ساعة → تنبيه الطاقم.
 */
import { runDrill } from './drill';
import { securityEvent } from './guard';

export async function runShield(db: any, opts: { dry?: boolean; site: string; env?: Record<string, string | undefined> } = { site: '' }) {
  const env = opts.env || process.env; const out: any = { ok: true };
  try { const { data } = await db.rpc('shield_gc'); out.gc = data ?? null; } catch (e: any) { out.gc_error = e?.message || String(e); }
  try {
    const d = await runDrill(opts.site, env, db); out.drill = { passed: d.passed, total: d.total, failed: d.checks.filter(c => !c.ok).map(c => c.id), ms: d.ms };
    if (!opts.dry) await securityEvent(db, { severity: d.passed === d.total ? 'info' : 'warn', kind: 'drill', actor: 'cron', meta: { passed: d.passed, total: d.total, ms: d.ms, checks: d.checks } }, env);
  } catch (e: any) { out.ok = false; out.drill_error = e?.message || String(e); }
  try {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: stale } = await db.from('portal_security_events').select('id,kind,at').eq('severity', 'critical').is('handled_at', null).lt('at', since).limit(50);
    out.stale_critical = (stale || []).length;
    if (!opts.dry && (stale || []).length) await securityEvent(db, { severity: 'critical', kind: 'stale_critical', actor: 'cron', meta: { count: (stale || []).length, ids: (stale as any[]).slice(0, 10).map(x => x.id) } }, env);
  } catch { /* */ }
  return out;
}
