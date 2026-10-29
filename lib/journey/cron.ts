// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * رحلة الممارس — الحارس الزمني (ضمن الكرون اليومي الحالي، لا كرون جديد):
 *  1) تسليم «رسالة إلى نفسي بعد سنة» حين يحين موعدها: لقطة «أين صرت» + نص التسليم + إشعار بقنواته (بريد/واتساب/يدوي)
 *  2) انتهاء صلاحية النسخ المشتركة (12 شهرًا) → expired وإلغاء وثيقتها
 */
import { notify } from '../portal/notify';
import { loadJourney } from './load';
import { capsuleSnapshot, capsuleDeliveryText } from './registry';
import type { CapsuleSnapshot } from './registry';
import { SHARE_COLS } from './share';

export const CAPSULE_COLS = 'id,created_at,user_id,email,full_name,body_ar,media_id,kind,deliver_at,delivered_at,status,snapshot_then,snapshot_now,message_log_id,meta';
export type Capsule = { id: number; created_at: string; user_id: string; email: string; full_name: string | null; body_ar: string; media_id: string | null; kind: 'text' | 'audio' | 'video'; deliver_at: string; delivered_at: string | null; status: 'sealed' | 'delivered' | 'cancelled'; snapshot_then: CapsuleSnapshot; snapshot_now: CapsuleSnapshot | null; message_log_id: number | null; meta: any };

export async function runJourney(db: any, opts: { dry?: boolean; site: string; now?: Date }): Promise<{ ok: boolean; delivered: number; expired: number; errors: string[] }> {
  const now = opts.now || new Date(); const dry = !!opts.dry; const site = opts.site.replace(/\/+$/, ''); const errors: string[] = []; let delivered = 0, expired = 0;
  try {
    const { data } = await db.from('portal_time_capsules').select(CAPSULE_COLS).eq('status', 'sealed').lte('deliver_at', now.toISOString()).order('deliver_at', { ascending: true }).limit(50);
    for (const c of ((data || []) as Capsule[])) {
      try {
        const j = await loadJourney(db, { id: c.user_id, email: c.email }, now.getTime()); const snapNow = capsuleSnapshot(j); const then = (c.snapshot_then || { chapters: 0, levels: [], last_chapter: null, days: 0 }) as CapsuleSnapshot;
        const text = capsuleDeliveryText(c.full_name || '', then, snapNow, c.created_at); const url = `${site}/me/journey#capsules`;
        if (dry) { delivered++; continue; }
        const d = await notify(db, { kind: 'time_capsule', to: { email: c.email, name: c.full_name }, subject: 'رسالة منك إلى نفسك — كتبتَها قبل سنة', text: `${text}\n\nرسالتك: ${c.media_id && !c.body_ar ? '(تسجيل صوتي/مرئي — افتحه من رحلتك)' : c.body_ar}\n\n${url}`, url, ref: `capsule:${c.id}` }, { now });
        await db.from('portal_time_capsules').update({ status: 'delivered', delivered_at: now.toISOString(), snapshot_now: snapNow, message_log_id: (d as any)?.id ?? null, meta: { ...(c.meta || {}), delivery_text: text } }).eq('id', c.id);
        await db.from('portal_learning_events').insert({ user_id: c.user_id, email: c.email, verb: 'received', object_type: 'time_capsule', object_id: String(c.id), skills: [], context: { then, now: snapNow } }).then(() => null, () => null);
        delivered++;
      } catch (e: any) { errors.push(`capsule ${c.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { errors.push(`capsules: ${e?.message || e}`); }
  try {
    const { data } = await db.from('portal_journey_shares').select(SHARE_COLS).eq('status', 'active').lte('expires_at', now.toISOString()).limit(200);
    for (const s of ((data || []) as any[])) {
      if (dry) { expired++; continue; }
      await db.from('portal_journey_shares').update({ status: 'expired' }).eq('id', s.id);
      if (s.vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', s.vc_issuance_id).then(() => null, () => null);
      expired++;
    }
  } catch (e: any) { errors.push(`shares: ${e?.message || e}`); }
  return { ok: errors.length === 0, delivered, expired, errors };
}
