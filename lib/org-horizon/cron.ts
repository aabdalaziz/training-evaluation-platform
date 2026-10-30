// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أفق الجهة — الحارس الزمني (ضمن الكرون اليومي الحالي، لا كرون جديد):
 *  1) فتح مراجعة سنة الجهة حين يحين اليوم 365 (active → review) + رسالة «ما وعدنا / ما وقع» لمديري الجهة بالقنوات القائمة
 *  2) تذكير واحد لمديري الجهة في منتصف السنة (اليوم 182) — مرة واحدة
 *  3) طيّ المراجعة التي لم تُغلق خلال 30 يومًا (review → archived) — «ما لم يُراجَع ليس فشلًا»
 */
import { notify } from '../portal/notify';
import { orgAdmins } from '../org-journey/cron';
import { loadOrgJourneyInput } from '../org-journey/load';
import { buildOrgChapters } from '../org-journey/registry';
import { orgPathInput } from './load';
import { ORG_HORIZON_COLS, ORG_PLEDGE_COLS, ORG_MIDYEAR_DAY, ORG_REVIEW_WINDOW_DAYS, addDays, buildOrgPath, orgReviewText } from './registry';
import type { OrgHorizon, OrgPledge } from './registry';

export async function runOrgHorizon(db: any, opts: { dry?: boolean; site: string; now?: Date }): Promise<{ ok: boolean; opened: number; nudged: number; archived: number; errors: string[] }> {
  const now = opts.now || new Date(); const dry = !!opts.dry; const site = opts.site.replace(/\/+$/, ''); const errors: string[] = []; let opened = 0, nudged = 0, archived = 0;
  const url = `${site}/org?tab=horizon`;
  const pledgeOf = async (h: OrgHorizon): Promise<OrgPledge | null> => { const { data } = await db.from('portal_org_horizon_pledges').select(ORG_PLEDGE_COLS).eq('horizon_id', h.id).eq('status', 'active').limit(1); return ((data || []) as OrgPledge[])[0] || null; };
  const tell = async (h: OrgHorizon, kind: string, subject: string, text: string, ref: string) => { let last: any = null; for (const a of await orgAdmins(db, h.organization_id)) last = await notify(db, { kind, to: { email: a.email, name: a.name }, subject, text: `${text}\n\n${url}`, url, ref }, { now }); return last; };
  // 1) فتح المراجعة
  try {
    const { data } = await db.from('portal_org_horizons').select(ORG_HORIZON_COLS).eq('status', 'active').lte('review_at', now.toISOString()).limit(50);
    for (const h of ((data || []) as OrgHorizon[])) {
      try {
        const p = await pledgeOf(h); if (!p) { if (!dry) await db.from('portal_org_horizons').update({ status: 'draft', review_at: null, updated_at: now.toISOString() }).eq('id', h.id); continue; }
        const inp = await loadOrgJourneyInput(db, h.organization_id); const path = buildOrgPath(p, await orgPathInput(db, h.organization_id, inp, p.signed_at), now.getTime()); const chNow = buildOrgChapters(inp).chapters.length;
        const text = orgReviewText(h.org_name, p, path, Number(h.meta?.chapters_then ?? 0), chNow, Number(h.meta?.members_then ?? 0), inp.members.length);
        if (dry) { opened++; continue; }
        const d = await tell(h, 'org_horizon_review', `سنة على عهد «${h.org_name}» — ما وعدنا / ما وقع`, text, `org_horizon:${h.id}`);
        await db.from('portal_org_horizons').update({ status: 'review', updated_at: now.toISOString(), meta: { ...(h.meta || {}), review_text: text, review_opened_at: now.toISOString(), path_at_review: path, chapters_now: chNow, members_now: inp.members.length, message_log_id: (d as any)?.id ?? null } }).eq('id', h.id);
        opened++;
      } catch (e: any) { errors.push(`review ${h.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { errors.push(`reviews: ${e?.message || e}`); }
  // 2) تذكير منتصف السنة
  try {
    const { data } = await db.from('portal_org_horizons').select(ORG_HORIZON_COLS).eq('status', 'active').lte('activated_at', addDays(now, -ORG_MIDYEAR_DAY)).gt('review_at', now.toISOString()).limit(100);
    for (const h of ((data || []) as OrgHorizon[])) {
      if (h.meta?.nudged_at) continue;
      try {
        const p = await pledgeOf(h); if (!p) continue;
        if (dry) { nudged++; continue; }
        const inp = await loadOrgJourneyInput(db, h.organization_id); const path = buildOrgPath(p, await orgPathInput(db, h.organization_id, inp, p.signed_at), now.getTime());
        await tell(h, 'org_horizon_midyear', `نصف سنة على عهد «${h.org_name}»`, `مرّ نصف السنة على عهد جهتكم: «${p.title_ar}». ${path.read_ar} لا حكم هنا — فقط تذكير بأن النصف الثاني مفتوح، وأن الدرب يُكتب من أفعال منسوبيكم.`, `org_horizon_mid:${h.id}`);
        await db.from('portal_org_horizons').update({ meta: { ...(h.meta || {}), nudged_at: now.toISOString() }, updated_at: now.toISOString() }).eq('id', h.id);
        nudged++;
      } catch (e: any) { errors.push(`nudge ${h.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { errors.push(`nudges: ${e?.message || e}`); }
  // 3) طيّ المراجعات المفتوحة بلا قرار
  try {
    const { data } = await db.from('portal_org_horizons').select(ORG_HORIZON_COLS).eq('status', 'review').lte('review_at', addDays(now, -ORG_REVIEW_WINDOW_DAYS)).limit(100);
    for (const h of ((data || []) as OrgHorizon[])) {
      if (dry) { archived++; continue; }
      await db.from('portal_org_horizons').update({ status: 'archived', decision: 'archive', updated_at: now.toISOString(), meta: { ...(h.meta || {}), auto_archived_at: now.toISOString() } }).eq('id', h.id);
      await db.from('portal_org_horizon_pledges').update({ status: 'expired' }).eq('horizon_id', h.id).eq('status', 'active').then(() => null, () => null);
      archived++;
    }
  } catch (e: any) { errors.push(`archive: ${e?.message || e}`); }
  return { ok: errors.length === 0, opened, nudged, archived, errors };
}
