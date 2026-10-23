/**
 * صحة المنصة — جمع المؤشرات من قاعدة البيانات (خادم فقط، مفتاح الخدمة)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ENV_SPECS } from './model';
import type { HealthRaw } from './model';
import { readKey } from '../ai/provider';

export function envStatus(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const s of ENV_SPECS) out[s.key] = !!(process.env[s.key] || '').trim();
  return out;
}

/** نبضة كرون: تُسجَّل في audit_logs حتى يعرف فحص الصحة آخر تشغيل فعلي */
export async function cronHeartbeat(db: SupabaseClient, name: 'followups' | 'digest', meta: Record<string, any> = {}): Promise<void> {
  try { await db.from('audit_logs').insert({ actor_id: null, action: 'cron_heartbeat', entity_type: 'system', entity_label: name, source: 'cron', metadata: meta }); } catch { /* اختياري */ }
}

async function count(db: SupabaseClient, table: string, mod?: (q: any) => any): Promise<number> {
  let q: any = db.from(table).select('id', { count: 'exact', head: true });
  if (mod) q = mod(q);
  const { count: n, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return n || 0;
}

export async function collectHealth(db: SupabaseClient, now = new Date()): Promise<HealthRaw> {
  const errors: string[] = [];
  const iso = now.toISOString(); const d7 = new Date(now.getTime() - 7 * 86400000).toISOString(); const d14 = new Date(now.getTime() - 14 * 86400000).toISOString(); const today = iso.slice(0, 10);
  const safe = async <T,>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => { try { return await fn(); } catch (e: any) { errors.push(`${label}: ${e?.message || e}`); return fallback; } };

  // اتصال + زمن استجابة
  const t0 = Date.now(); let dbOk = true; let dbErr: string | undefined;
  try { const { error } = await db.from('programs').select('id', { count: 'exact', head: true }); if (error) throw error; } catch (e: any) { dbOk = false; dbErr = e?.message || String(e); }
  const latencyMs = Date.now() - t0;

  const [programsRows, classrooms, trainers, evals14] = await Promise.all([
    safe('programs', async () => (await db.from('programs').select('id,name_ar,status,end_date')).data as any[] || [], []),
    safe('classrooms', async () => (await db.from('classrooms').select('id,code,program_id,trainer_id')).data as any[] || [], []),
    safe('trainers', async () => (await db.from('trainers').select('id,name')).data as any[] || [], []),
    safe('evaluations14', async () => (await db.from('evaluations').select('program_id,submitted_at').gte('submitted_at', d14).limit(20000)).data as any[] || [], []),
  ]);

  const counts = {
    programs: programsRows.length,
    programs_active: programsRows.filter(p => String(p.status || '').toUpperCase() === 'ACTIVE').length,
    classrooms: classrooms.length, trainers: trainers.length,
    questions: await safe('questions', () => count(db, 'questions'), 0),
    evaluations: await safe('evaluations', () => count(db, 'evaluations'), 0),
    evaluations_7d: await safe('evaluations_7d', () => count(db, 'evaluations', q => q.gte('submitted_at', d7)), 0),
    subscriptions_active: await safe('report_subscriptions', () => count(db, 'report_subscriptions', q => q.eq('active', true)), 0),
    open_notifications: await safe('notifications', () => count(db, 'notifications', q => q.is('resolved_at', null)), 0),
    critical_notifications: await safe('notifications_critical', () => count(db, 'notifications', q => q.is('resolved_at', null).eq('severity', 'critical')), 0),
    profiles: await safe('profiles', () => count(db, 'profiles'), 0),
    profiles_no_role: await safe('profiles_no_role', () => count(db, 'profiles', q => q.is('role', null)), 0),
    audit_rows: await safe('audit_logs', () => count(db, 'audit_logs'), -1),
    outcome_kpis: await safe('outcome_kpis', () => count(db, 'outcome_kpis'), 0),
    certificates: await safe('certificates', () => count(db, 'certificates'), 0),
  };

  // سلامة البيانات
  const active = programsRows.filter(p => String(p.status || '').toUpperCase() === 'ACTIVE');
  const roomsByProgram = new Set(classrooms.map(c => c.program_id).filter(Boolean));
  const trainersWithRooms = new Set(classrooms.map(c => c.trainer_id).filter(Boolean));
  const evalProgs14 = new Set(evals14.map(e => e.program_id).filter(Boolean));
  const integrity = {
    active_programs_without_rooms: active.filter(p => !roomsByProgram.has(p.id)).map(p => p.name_ar || p.id),
    rooms_without_trainer: classrooms.filter(c => !c.trainer_id).map(c => c.code || c.id),
    trainers_without_rooms: trainers.filter(t => !trainersWithRooms.has(t.id)).map(t => t.name || t.id),
    active_programs_silent_14d: active.filter(p => roomsByProgram.has(p.id) && !evalProgs14.has(p.id)).map(p => p.name_ar || p.id),
    programs_ended_still_active: active.filter(p => p.end_date && String(p.end_date) < today).map(p => p.name_ar || p.id),
  };

  // الكرون: نبضات + تشغيلات فحص الإشعارات
  const last = async (label: string, fn: () => PromiseLike<any>): Promise<string | null> => safe(label, async () => { const { data, error } = await fn(); if (error) throw error; const r = Array.isArray(data) ? data[0] : data; return r ? (r.created_at || r.ran_at || null) : null; }, null);
  const crons = {
    followups: await last('hb_followups', () => db.from('audit_logs').select('created_at').eq('action', 'cron_heartbeat').eq('entity_label', 'followups').order('created_at', { ascending: false }).limit(1)),
    digest: await safe('hb_digest', async () => { const { data, error } = await db.from('audit_logs').select('created_at,action,entity_label').in('action', ['cron_heartbeat', 'report_digest']).order('created_at', { ascending: false }).limit(20); if (error) throw error; const r = ((data || []) as any[]).find(x => x.action === 'report_digest' || x.entity_label === 'digest'); return r?.created_at || null; }, null),
    notificationScan: await last('notification_runs', () => db.from('notification_runs').select('ran_at').eq('source', 'cron').order('ran_at', { ascending: false }).limit(1)),
  };

  // البريد خلال 7 أيام
  const tm = await safe('trainee_mail_log', async () => (await db.from('trainee_mail_log').select('ok,error,sent_at').gte('sent_at', d7).limit(5000)).data as any[] || [], []);
  const au = await safe('audit_mail', async () => (await db.from('audit_logs').select('action,metadata,created_at').in('action', ['report_email', 'report_digest', 'certificate_email']).gte('created_at', d7).limit(2000)).data as any[] || [], []);
  const mail7d = {
    trainee_ok: tm.filter(r => r.ok !== false).length, trainee_failed: tm.filter(r => r.ok === false).length,
    reports: au.filter(r => r.action === 'report_email' || r.action === 'report_digest').reduce((s, r) => s + (Array.isArray(r.metadata?.to) ? r.metadata.to.length : 1), 0),
    certificates_sent: au.filter(r => r.action === 'certificate_email').reduce((s, r) => s + Number(r.metadata?.sent || 0), 0),
    certificates_failed: au.filter(r => r.action === 'certificate_email').reduce((s, r) => s + Number(r.metadata?.failed || 0), 0),
    last_failure: tm.filter(r => r.ok === false).sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at)))[0]?.error || null,
  };

  const { key, provider } = readKey();
  return { now: iso, env: envStatus(), db: { ok: dbOk, latencyMs: dbOk ? latencyMs : null, error: dbErr }, crons, mail7d, counts, integrity, ai: { configured: !!key, provider }, errors };
}

/** مزامنة تنبيهات الجرس: إنشاء الجديد وحلّ ما زال */
export async function syncHealthAlerts(db: SupabaseClient, alerts: { dedupe_key: string; severity: 'warn' | 'critical'; title: string; body: string; href: string }[]): Promise<{ inserted: number; resolved: number }> {
  let inserted = 0, resolved = 0;
  try {
    const { data } = await db.from('notifications').select('id,dedupe_key').like('dedupe_key', 'health:%').is('resolved_at', null);
    const open = new Map(((data || []) as any[]).map(r => [r.dedupe_key, r.id]));
    const want = new Set(alerts.map(a => a.dedupe_key));
    for (const a of alerts) if (!open.has(a.dedupe_key)) { const { error } = await db.from('notifications').insert({ kind: 'system_health', severity: a.severity, title: a.title, body: a.body, href: a.href, dedupe_key: a.dedupe_key }); if (!error) inserted++; }
    for (const [k, id] of open) if (!want.has(k)) { const { error } = await db.from('notifications').update({ resolved_at: new Date().toISOString() }).eq('id', id); if (!error) resolved++; }
  } catch { /* اختياري */ }
  return { inserted, resolved };
}
