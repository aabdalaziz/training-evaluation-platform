// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — خطوة الإبلاغ في سلسلة الكرون اليومية (P16 · بلا Cron جديد):
 *  (1) إعادة محاولة الرسائل المؤجَّلة بساعات الهدوء أو المعلّقة (حتى 3 محاولات) ثم إسقاطها في «قائمة اليد».
 *  (2) تنظيف السجل الأقدم من 180 يومًا.
 *  (3) إحصاءات 7 أيام لصفحة الصحة.
 */
import { attempt, channelEnv, type LogRow, type Prefs } from './notify';

export async function runOutreach(db: any, opts: { dry?: boolean; env?: NodeJS.ProcessEnv; now?: Date; fetchImpl?: typeof fetch; limit?: number } = {}): Promise<{ ok: boolean; retried: number; sent: number; manual: number; purged: number; dry: boolean; error?: string }> {
  const now = opts.now || new Date(); const dry = !!opts.dry; const rawEnv = opts.env || process.env; const env = channelEnv(rawEnv);
  try {
    const { data } = await db.from('portal_message_log').select('*').eq('status', 'queued').lte('next_at', now.toISOString()).order('created_at', { ascending: true }).limit(opts.limit || 100);
    const rows = (data || []) as LogRow[]; let sent = 0, manual = 0;
    for (const row of rows) {
      if (dry) continue;
      let prefs: Prefs | null = null;
      if (row.to_email) { const { data: p } = await db.from('portal_contact_prefs').select('*').eq('email', row.to_email).maybeSingle(); prefs = (p as Prefs) || null; }
      let subs: any[] = [];
      if (env.push && prefs?.user_id) { const { data: s } = await db.from('portal_push_subscriptions').select('id,endpoint,p256dh,auth,lang').eq('user_id', prefs.user_id).eq('active', true).limit(5); subs = (s || []) as any[]; }
      const r = await attempt(db, row, { prefs, subs, env, raw: rawEnv, fetchImpl: opts.fetchImpl || fetch, now });
      if (r.status === 'sent') sent++; else if (r.status === 'manual') manual++;
    }
    let purged = 0;
    if (!dry) { const { data: old } = await db.from('portal_message_log').select('id').lt('created_at', new Date(now.getTime() - 180 * 86400000).toISOString()).limit(500); const ids = ((old || []) as any[]).map(r => r.id); if (ids.length) { await db.from('portal_message_log').delete().in('id', ids); purged = ids.length; } }
    return { ok: true, retried: rows.length, sent, manual, purged, dry };
  } catch (e: any) { return { ok: false, retried: 0, sent: 0, manual: 0, purged: 0, dry, error: String(e?.message || e) }; }
}

export type ChannelStats = Record<string, { total: number; sent: number; delivered: number; failed: number; manual: number; last_ok: string | null }>;
/** إحصاءات 7 أيام لكل قناة من صفوف السجل */
export function channelStats(rows: Pick<LogRow, 'channel' | 'status' | 'sent_at' | 'created_at'>[]): ChannelStats {
  const out: ChannelStats = {};
  for (const r of rows) {
    const e = out[r.channel] || (out[r.channel] = { total: 0, sent: 0, delivered: 0, failed: 0, manual: 0, last_ok: null }); e.total++;
    if (r.status === 'sent' || r.status === 'delivered' || r.status === 'read') { e.sent++; if (r.status !== 'sent') e.delivered++; const t = r.sent_at || r.created_at; if (!e.last_ok || t > e.last_ok) e.last_ok = t; }
    else if (r.status === 'failed') e.failed++;
    else if (r.status === 'manual' || r.status === 'done') e.manual++;
  }
  return out;
}
