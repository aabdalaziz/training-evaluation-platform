// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * رحلة الجهة — الحارس الزمني (ضمن الكرون اليومي الحالي /api/followups/send، لا كرون جديد):
 *  1) تسليم «رسالة الجهة إلى نفسها» حين يحين موعدها → إلى مديري الجهة الحاليين (لا من كتبها فقط) مع «أين كنّا» و«أين صرنا»
 *  2) انتهاء صلاحية كتب السنة (12 شهرًا) → expired وإلغاء وثيقتها
 */
import { notify } from '../portal/notify';
import { lower } from '../councils/registry';
import { loadOrgJourney } from './load';
import { orgSnapshot, orgCapsuleText } from './registry';
import type { OrgSnapshot } from './registry';
import { ORG_SHARE_COLS } from './share';

export const ORG_CAPSULE_COLS = 'id,created_at,organization_id,org_name,body_ar,media_id,kind,written_by,written_email,deliver_at,delivered_at,status,snapshot_then,snapshot_now,delivered_to,meta';
export type OrgCapsule = { id: number; created_at: string; organization_id: string; org_name: string; body_ar: string; media_id: string | null; kind: 'text' | 'audio' | 'video'; written_by: string | null; written_email: string | null; deliver_at: string; delivered_at: string | null; status: 'sealed' | 'delivered' | 'cancelled'; snapshot_then: OrgSnapshot; snapshot_now: OrgSnapshot | null; delivered_to: string[]; meta: any };

export async function orgAdmins(db: any, orgId: string): Promise<{ email: string; name: string | null }[]> {
  const { data } = await db.from('portal_org_members').select('email,full_name').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').limit(20);
  const seen = new Set<string>(); const out: { email: string; name: string | null }[] = [];
  for (const m of ((data || []) as any[])) { const e = lower(m.email); if (!e || seen.has(e)) continue; seen.add(e); out.push({ email: e, name: m.full_name || null }); }
  return out;
}

export async function runOrgJourney(db: any, opts: { dry?: boolean; site: string; now?: Date }): Promise<{ ok: boolean; delivered: number; recipients: number; expired: number; errors: string[] }> {
  const now = opts.now || new Date(); const dry = !!opts.dry; const site = opts.site.replace(/\/+$/, ''); const errors: string[] = []; let delivered = 0, recipients = 0, expired = 0;
  try {
    const { data } = await db.from('portal_org_time_capsules').select(ORG_CAPSULE_COLS).eq('status', 'sealed').lte('deliver_at', now.toISOString()).order('deliver_at', { ascending: true }).limit(20);
    for (const c of ((data || []) as OrgCapsule[])) {
      try {
        const j = await loadOrgJourney(db, c.organization_id, now.getTime()); const snapNow = orgSnapshot(j); const then = (c.snapshot_then || { members: 0, chapters: 0, quarters: 0, kinds: {}, last_chapter: null }) as OrgSnapshot;
        const text = orgCapsuleText(c.org_name, then, snapNow, c.created_at); const url = `${site}/org?tab=journey#capsules`;
        let admins = await orgAdmins(db, c.organization_id); if (!admins.length && c.written_email) admins = [{ email: lower(c.written_email), name: null }];
        if (dry) { delivered++; recipients += admins.length; continue; }
        const to: string[] = [];
        for (const a of admins) {
          try { await notify(db, { kind: 'org_time_capsule', to: { email: a.email, name: a.name }, subject: `رسالة من «${c.org_name}» إلى نفسها — كُتبت قبل سنة`, text: `${text}\n\nالرسالة: ${c.media_id && !c.body_ar ? '(تسجيل صوتي/مرئي — افتحوه من رحلة الجهة)' : c.body_ar}\n\n${url}`, url, ref: `org_capsule:${c.id}:${a.email}` }, { now }); to.push(a.email); } catch (e: any) { errors.push(`org capsule ${c.id} → ${a.email}: ${e?.message || e}`); }
        }
        await db.from('portal_org_time_capsules').update({ status: 'delivered', delivered_at: now.toISOString(), snapshot_now: snapNow, delivered_to: to, meta: { ...(c.meta || {}), delivery_text: text } }).eq('id', c.id);
        delivered++; recipients += to.length;
      } catch (e: any) { errors.push(`org capsule ${c.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { errors.push(`org capsules: ${e?.message || e}`); }
  try {
    const { data } = await db.from('portal_org_journey_shares').select(ORG_SHARE_COLS).eq('status', 'active').lte('expires_at', now.toISOString()).limit(200);
    for (const s of ((data || []) as any[])) {
      if (dry) { expired++; continue; }
      await db.from('portal_org_journey_shares').update({ status: 'expired' }).eq('id', s.id);
      if (s.vc_issuance_id) await db.from('portal_vc_issuances').update({ revoked_at: now.toISOString() }).eq('id', s.vc_issuance_id).then(() => null, () => null);
      expired++;
    }
  } catch (e: any) { errors.push(`org shares: ${e?.message || e}`); }
  return { ok: errors.length === 0, delivered, recipients, expired, errors };
}
